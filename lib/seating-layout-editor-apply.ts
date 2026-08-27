import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";
import type { SeatingCabin } from "@/lib/seating-cabins";
import {
  applyLayoutPromptActions,
  type PromptAction,
} from "@/lib/seating-layout-prompt";
import { cloneLayoutState } from "@/lib/seating-layout-editor-snapshot";
import type {
  ColanLayoutState,
  LayoutEditorApplyResult,
  LayoutEditorOperation,
  LayoutEditorResponse,
  RowPosition,
  SeatPosition,
} from "@/lib/seating-layout-editor-types";

function rowKeys(rows: SeatingRowConfig[]): Set<string> {
  return new Set(rows.map((row) => row.key.toUpperCase()));
}

function findRow(rows: SeatingRowConfig[], rowId: string): SeatingRowConfig | undefined {
  return rows.find((row) => row.key.toUpperCase() === rowId.toUpperCase());
}

function findRowIndex(rows: SeatingRowConfig[], rowId: string): number {
  return rows.findIndex((row) => row.key.toUpperCase() === rowId.toUpperCase());
}

function isSeat(cell: FloorCell): cell is Extract<FloorCell, { kind: "seat" }> {
  return cell.kind === "seat";
}

function splitBand(cells: FloorCell[]): { label: FloorCell[]; body: FloorCell[] } {
  const label: FloorCell[] = [];
  const body: FloorCell[] = [];
  for (const cell of cells) {
    if (body.length === 0 && cell.kind === "label") label.push(cell);
    else body.push(cell);
  }
  return { label, body };
}

function seatCountForRow(row: SeatingRowConfig): number {
  return [...row.top, ...row.bottom].filter(isSeat).length;
}

function maxSeatNumber(row: SeatingRowConfig): number {
  const prefix = row.key.toUpperCase();
  let max = 0;
  for (const cell of [...row.top, ...row.bottom]) {
    if (!isSeat(cell)) continue;
    const num = Number.parseInt(cell.id.slice(prefix.length), 10);
    if (!Number.isNaN(num)) max = Math.max(max, num);
  }
  return max;
}

function updateRowLabel(cells: FloorCell[], seatTotal: number, rowKey: string): FloorCell[] {
  return cells.map((cell) => {
    if (cell.kind !== "label" || !cell.text.trim()) return cell;
    return { kind: "label", text: `${rowKey}-ROW (${seatTotal})` };
  });
}

function findSeatBand(
  row: SeatingRowConfig,
  seatId: string,
): { band: "top" | "bottom"; body: FloorCell[]; label: FloorCell[] } | null {
  const top = splitBand(row.top);
  if (top.body.some((cell) => isSeat(cell) && cell.id.toUpperCase() === seatId.toUpperCase())) {
    return { band: "top", body: top.body, label: top.label };
  }
  const bottom = splitBand(row.bottom);
  if (bottom.body.some((cell) => isSeat(cell) && cell.id.toUpperCase() === seatId.toUpperCase())) {
    return { band: "bottom", body: bottom.body, label: bottom.label };
  }
  return null;
}

function findSeatInLayout(
  rows: SeatingRowConfig[],
  seatId: string,
): { rowIndex: number; band: "top" | "bottom"; bodyIndex: number } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (const bandKey of ["top", "bottom"] as const) {
      const band = splitBand(row[bandKey]);
      const bodyIndex = band.body.findIndex(
        (cell) => isSeat(cell) && cell.id.toUpperCase() === seatId.toUpperCase(),
      );
      if (bodyIndex >= 0) return { rowIndex, band: bandKey, bodyIndex };
    }
  }
  return null;
}

function allSeatIdsInBandOrder(row: SeatingRowConfig): string[] {
  const ids: string[] = [];
  for (const cell of [...splitBand(row.top).body, ...splitBand(row.bottom).body]) {
    if (isSeat(cell)) ids.push(cell.id);
  }
  return ids;
}

function rebuildRowFromBands(
  row: SeatingRowConfig,
  top: { label: FloorCell[]; body: FloorCell[] },
  bottom: { label: FloorCell[]; body: FloorCell[] },
): SeatingRowConfig {
  const seatTotal = seatCountForRow({
    ...row,
    top: [...top.label, ...top.body],
    bottom: [...bottom.label, ...bottom.body],
  });
  return {
    ...row,
    seatCount: seatTotal,
    top: updateRowLabel([...top.label, ...top.body], seatTotal, row.key),
    bottom: [...bottom.label, ...bottom.body],
  };
}

function replaceBandBody(
  row: SeatingRowConfig,
  band: "top" | "bottom",
  body: FloorCell[],
): SeatingRowConfig {
  const top = splitBand(row.top);
  const bottom = splitBand(row.bottom);
  if (band === "top") {
    return rebuildRowFromBands(row, { label: top.label, body }, bottom);
  }
  return rebuildRowFromBands(row, top, { label: bottom.label, body });
}

function insertAfterSeatInBand(body: FloorCell[], afterSeatId: string, insert: FloorCell[]): FloorCell[] {
  const result: FloorCell[] = [];
  let inserted = false;
  for (const cell of body) {
    result.push(cell);
    if (isSeat(cell) && cell.id.toUpperCase() === afterSeatId.toUpperCase()) {
      result.push(...insert);
      inserted = true;
    }
  }
  return inserted ? result : body;
}

function insertBeforeSeatInBand(body: FloorCell[], beforeSeatId: string, insert: FloorCell[]): FloorCell[] {
  const result: FloorCell[] = [];
  for (const cell of body) {
    if (isSeat(cell) && cell.id.toUpperCase() === beforeSeatId.toUpperCase()) {
      result.push(...insert);
    }
    result.push(cell);
  }
  return result;
}

function insertBetweenSeatsInBand(
  body: FloorCell[],
  leftSeatId: string,
  rightSeatId: string,
  insert: FloorCell[],
): FloorCell[] {
  const result: FloorCell[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const cell = body[index];
    result.push(cell);
    if (isSeat(cell) && cell.id.toUpperCase() === leftSeatId.toUpperCase()) {
      const next = body[index + 1];
      if (next && isSeat(next) && next.id.toUpperCase() === rightSeatId.toUpperCase()) {
        result.push(...insert);
      }
    }
  }
  return result;
}

function removeSeatsFromBand(body: FloorCell[], seatIds: Set<string>, replacement?: FloorCell): FloorCell[] {
  const result: FloorCell[] = [];
  for (const cell of body) {
    if (isSeat(cell) && seatIds.has(cell.id.toUpperCase())) {
      if (replacement) result.push(replacement);
      continue;
    }
    result.push(cell);
  }
  return result;
}

function operationToPromptActions(op: LayoutEditorOperation): PromptAction[] {
  switch (op.action) {
    case "REMOVE_ROWS":
      return op.rows.map((row) => ({ type: "remove_row", row: row.toUpperCase() }));
    case "REPLACE_ROW":
      return [{ type: "replace_row", targetRow: op.target.toUpperCase(), sourceRow: op.source.toUpperCase() }];
    case "ADD_SEATS_TO_ROW":
      return [{ type: "add_seats", row: op.row.toUpperCase(), count: op.count }];
    case "ADD_PILLARS_TO_ROW":
      return [{ type: "add_pillars", row: op.row.toUpperCase(), count: op.count }];
    case "REMOVE_PILLARS_FROM_ROW":
      return [{ type: "remove_pillars", row: op.row.toUpperCase(), count: op.count }];
    case "REMOVE_ALL_PILLARS":
      return [{ type: "remove_all_pillars", rows: op.rows?.map((row) => row.toUpperCase()) }];
    case "ADD_ROW":
    case "INSERT_ROW_BETWEEN": {
      const newRow = op.action === "ADD_ROW" ? op.newRow : op.newRow;
      const pillars = op.pillars ?? 0;
      if (op.action === "INSERT_ROW_BETWEEN") {
        return [
          {
            type: "create_row",
            row: newRow.toUpperCase(),
            afterRow: op.after.toUpperCase(),
            beforeRow: op.before.toUpperCase(),
            pillars,
          },
        ];
      }
      const position = op.position;
      if (position.type === "BETWEEN") {
        return [
          {
            type: "create_row",
            row: newRow.toUpperCase(),
            afterRow: position.after.toUpperCase(),
            beforeRow: position.before.toUpperCase(),
            pillars,
          },
        ];
      }
      if (position.type === "AFTER") {
        return [
          {
            type: "create_row",
            row: newRow.toUpperCase(),
            afterRow: position.target.toUpperCase(),
            beforeRow: "",
            pillars,
          },
        ];
      }
      const beforeIndex = findRowIndex([], position.target);
      void beforeIndex;
      const target = position.target.toUpperCase();
      return [
        {
          type: "create_row",
          row: newRow.toUpperCase(),
          afterRow: "",
          beforeRow: target,
          pillars,
        },
      ];
    }
    default:
      return [];
  }
}

function resolveSeatPosition(
  rows: SeatingRowConfig[],
  position: SeatPosition,
  errors: string[],
): { rowIndex: number; band: "top" | "bottom"; mode: "between" | "after" | "before"; refs: string[] } | null {
  if ("between" in position) {
    const [left, right] = position.between;
    const leftLoc = findSeatInLayout(rows, left);
    const rightLoc = findSeatInLayout(rows, right);
    if (!leftLoc || !rightLoc) {
      errors.push(`Seat reference not found for between ${left} and ${right}.`);
      return null;
    }
    if (leftLoc.rowIndex !== rightLoc.rowIndex || leftLoc.band !== rightLoc.band) {
      errors.push(`Seats ${left} and ${right} must be in the same row band.`);
      return null;
    }
    return { ...leftLoc, mode: "between", refs: [left, right] };
  }

  const ref =
    "after" in position
      ? position.after
      : "before" in position
        ? position.before
        : "leftOf" in position
          ? position.leftOf
          : position.rightOf;

  const loc = findSeatInLayout(rows, ref);
  if (!loc) {
    errors.push(`Seat ${ref} was not found.`);
    return null;
  }

  const mode =
    "after" in position || "rightOf" in position
      ? "after"
      : "before";
  return { ...loc, mode, refs: [ref] };
}

function applySeatOperation(
  rows: SeatingRowConfig[],
  op: LayoutEditorOperation,
  errors: string[],
  warnings: string[],
): SeatingRowConfig[] {
  if (op.action === "REMOVE_SEATS" || op.action === "REMOVE_SEATS_AND_COLLAPSE") {
    const seatSet = new Set(op.seats.map((seat) => seat.toUpperCase()));
    for (const seatId of op.seats) {
      if (!findSeatInLayout(rows, seatId)) {
        errors.push(`Seat ${seatId} was not found.`);
      }
    }
    if (errors.length > 0) return rows;

    return rows.map((row) => {
      const top = splitBand(row.top);
      const bottom = splitBand(row.bottom);
      const nextTop = removeSeatsFromBand(top.body, seatSet);
      const nextBottom = removeSeatsFromBand(bottom.body, seatSet);
      const removed = top.body.length + bottom.body.length - nextTop.length - nextBottom.length;
      if (removed > 0) {
        warnings.push(`Removed seat(s) ${op.seats.join(", ")} from row ${row.key}.`);
      }
      return rebuildRowFromBands(row, { label: top.label, body: nextTop }, { label: bottom.label, body: nextBottom });
    });
  }

  if (op.action === "REMOVE_SEATS_KEEP_SPACE" || op.action === "CREATE_EMPTY_SPACE") {
    const seats = op.action === "CREATE_EMPTY_SPACE" ? op.location : op.seats;
    const seatSet = new Set(seats.map((seat) => seat.toUpperCase()));
    for (const seatId of seats) {
      if (!findSeatInLayout(rows, seatId)) {
        errors.push(`Seat ${seatId} was not found.`);
      }
    }
    if (errors.length > 0) return rows;

    const gapCell: FloorCell = { kind: "gap" };
    return rows.map((row) => {
      const top = splitBand(row.top);
      const bottom = splitBand(row.bottom);
      return rebuildRowFromBands(
        row,
        { label: top.label, body: removeSeatsFromBand(top.body, seatSet, gapCell) },
        { label: bottom.label, body: removeSeatsFromBand(bottom.body, seatSet, gapCell) },
      );
    });
  }

  if (op.action === "REPLACE_SEATS_WITH_PILLAR") {
    for (const seatId of op.seats) {
      if (!findSeatInLayout(rows, seatId)) {
        errors.push(`Seat ${seatId} was not found.`);
      }
    }
    if (errors.length > 0) return rows;

    const seatSet = new Set(op.seats.map((seat) => seat.toUpperCase()));
    let replaced = false;
    const next = rows.map((row) => {
      const top = splitBand(row.top);
      const bottom = splitBand(row.bottom);
      const replaceInBand = (body: FloorCell[]): FloorCell[] => {
        const result: FloorCell[] = [];
        let pendingSeats = 0;
        for (const cell of body) {
          if (isSeat(cell) && seatSet.has(cell.id.toUpperCase())) {
            pendingSeats += 1;
            continue;
          }
          if (pendingSeats > 0) {
            result.push({ kind: "pillar" });
            replaced = true;
            pendingSeats = 0;
          }
          result.push(cell);
        }
        if (pendingSeats > 0) {
          result.push({ kind: "pillar" });
          replaced = true;
        }
        return result;
      };
      return rebuildRowFromBands(
        row,
        { label: top.label, body: replaceInBand(top.body) },
        { label: bottom.label, body: replaceInBand(bottom.body) },
      );
    });
    if (replaced) {
      warnings.push(`Replaced seat(s) ${op.seats.join(", ")} with pillar(s).`);
    }
    return next;
  }

  if (op.action === "ADD_SEAT") {
    const resolved = resolveSeatPosition(rows, op.position, errors);
    if (!resolved) return rows;

    const row = rows[resolved.rowIndex];
    const prefix = row.key.toUpperCase();
    const newId = op.seatId?.toUpperCase() ?? `${prefix}${maxSeatNumber(row) + 1}`;
    if (findSeatInLayout(rows, newId)) {
      errors.push(`Seat ${newId} already exists.`);
      return rows;
    }

    const band = splitBand(row[resolved.band]);
    let body = band.body;
    const insert: FloorCell[] = [{ kind: "seat", id: newId }];
    if (resolved.mode === "between") {
      body = insertBetweenSeatsInBand(body, resolved.refs[0], resolved.refs[1], insert);
    } else if (resolved.mode === "after") {
      body = insertAfterSeatInBand(body, resolved.refs[0], insert);
    } else {
      body = insertBeforeSeatInBand(body, resolved.refs[0], insert);
    }

    const nextRows = [...rows];
    nextRows[resolved.rowIndex] = replaceBandBody(row, resolved.band, body);
    warnings.push(`Added seat ${newId}.`);
    return nextRows;
  }

  if (op.action === "ADD_PILLAR") {
    const resolved = resolveSeatPosition(rows, op.position, errors);
    if (!resolved) return rows;

    const row = rows[resolved.rowIndex];
    const band = splitBand(row[resolved.band]);
    const insert: FloorCell[] = [{ kind: "pillar" }];
    let body = band.body;
    if (resolved.mode === "between") {
      body = insertBetweenSeatsInBand(body, resolved.refs[0], resolved.refs[1], insert);
    } else if (resolved.mode === "after") {
      body = insertAfterSeatInBand(body, resolved.refs[0], insert);
    } else {
      body = insertBeforeSeatInBand(body, resolved.refs[0], insert);
    }

    const nextRows = [...rows];
    nextRows[resolved.rowIndex] = replaceBandBody(row, resolved.band, body);
    warnings.push(`Added pillar in row ${row.key}.`);
    return nextRows;
  }

  if (op.action === "EMPTY_SPACE_TO_SEATS") {
    const targetRows = op.row
      ? rows.filter((row) => row.key.toUpperCase() === op.row!.toUpperCase())
      : rows;

    return rows.map((row) => {
      if (op.row && row.key.toUpperCase() !== op.row.toUpperCase()) return row;
      const prefix = row.key.toUpperCase();
      let nextNumber = maxSeatNumber(row) + 1;
      const convertGaps = (body: FloorCell[]): FloorCell[] =>
        body.map((cell) =>
          cell.kind === "gap"
            ? { kind: "seat", id: `${prefix}${nextNumber++}` }
            : cell,
        );

      const top = splitBand(row.top);
      const bottom = splitBand(row.bottom);
      const next = rebuildRowFromBands(
        row,
        { label: top.label, body: convertGaps(top.body) },
        { label: bottom.label, body: convertGaps(bottom.body) },
      );
      void targetRows;
      warnings.push(`Converted empty space to seats in row ${row.key}.`);
      return next;
    });
  }

  return rows;
}

function applyCabinOperation(
  layout: ColanLayoutState,
  op: LayoutEditorOperation,
  errors: string[],
  warnings: string[],
): ColanLayoutState {
  if (op.action === "ADD_CABIN") {
    const id = op.id ?? `cabin-${op.label.toLowerCase().replace(/\s+/g, "-")}`;
    if (op.placement === "side-left") {
      layout.sideCabins.hrManager = op.label;
      warnings.push(`Updated side cabin label to ${op.label}.`);
      return layout;
    }
    const list = op.placement === "before-A" ? layout.cabinsBeforeA : layout.cabinsAfterG;
    if (list.some((cabin) => cabin.id === id)) {
      errors.push(`Cabin ${id} already exists.`);
      return layout;
    }
    list.push({ id, label: op.label, placement: op.placement });
    warnings.push(`Added cabin ${op.label}.`);
    return layout;
  }

  if (op.action === "REMOVE_CABIN") {
    if (op.cabinId === "side-hr-manager") {
      layout.sideCabins.hrManager = "";
      warnings.push("Removed side HR Manager cabin label.");
      return layout;
    }
    if (op.cabinId === "side-manager") {
      layout.sideCabins.manager = "";
      warnings.push("Removed side Manager cabin label.");
      return layout;
    }

    const before = layout.cabinsBeforeA.length;
    layout.cabinsBeforeA = layout.cabinsBeforeA.filter((cabin) => cabin.id !== op.cabinId);
    layout.cabinsAfterG = layout.cabinsAfterG.filter((cabin) => cabin.id !== op.cabinId);
    if (layout.cabinsBeforeA.length === before && layout.cabinsAfterG.length === before) {
      errors.push(`Cabin ${op.cabinId} was not found.`);
    } else {
      warnings.push(`Removed cabin ${op.cabinId}.`);
    }
    return layout;
  }

  if (op.action === "UPDATE_CABIN") {
    const updateList = (list: SeatingCabin[]) => {
      const cabin = list.find((entry) => entry.id === op.cabinId);
      if (cabin) cabin.label = op.label;
      return Boolean(cabin);
    };
    if (op.cabinId === "side-hr-manager") {
      layout.sideCabins.hrManager = op.label;
      warnings.push(`Renamed side cabin to ${op.label}.`);
      return layout;
    }
    if (op.cabinId === "side-manager") {
      layout.sideCabins.manager = op.label;
      warnings.push(`Renamed side cabin to ${op.label}.`);
      return layout;
    }
    if (!updateList(layout.cabinsBeforeA) && !updateList(layout.cabinsAfterG)) {
      errors.push(`Cabin ${op.cabinId} was not found.`);
    } else {
      warnings.push(`Renamed cabin ${op.cabinId} to ${op.label}.`);
    }
    return layout;
  }

  return layout;
}

function duplicateRow(
  rows: SeatingRowConfig[],
  source: string,
  newRow: string,
  position: RowPosition | undefined,
  errors: string[],
  warnings: string[],
): SeatingRowConfig[] {
  const sourceRow = findRow(rows, source);
  if (!sourceRow) {
    errors.push(`Row ${source} was not found.`);
    return rows;
  }
  if (rowKeys(rows).has(newRow.toUpperCase())) {
    errors.push(`Row ${newRow} already exists.`);
    return rows;
  }

  const prefix = newRow.toUpperCase();
  let seatCounter = 1;
  const mapCells = (cells: FloorCell[]): FloorCell[] =>
    cells.map((cell) => {
      if (!isSeat(cell)) return { ...cell };
      const mapped = { kind: "seat" as const, id: `${prefix}${seatCounter}` };
      seatCounter += 1;
      return mapped;
    });

  const clone: SeatingRowConfig = {
    key: prefix,
    label: `${prefix}-ROW`,
    seatCount: sourceRow.seatCount,
    top: mapCells(sourceRow.top),
    bottom: mapCells(sourceRow.bottom),
  };

  let insertIndex = findRowIndex(rows, source) + 1;
  if (position?.type === "BEFORE") {
    insertIndex = findRowIndex(rows, position.target);
  } else if (position?.type === "AFTER") {
    insertIndex = findRowIndex(rows, position.target) + 1;
  } else if (position?.type === "BETWEEN") {
    insertIndex = findRowIndex(rows, position.after) + 1;
  }

  if (insertIndex < 0) {
    errors.push(`Could not resolve insert position for row ${newRow}.`);
    return rows;
  }

  const next = [...rows];
  next.splice(insertIndex, 0, clone);
  warnings.push(`Duplicated row ${source} as ${newRow}.`);
  return next;
}

export function applyLayoutEditorResponse(
  baseLayout: ColanLayoutState,
  response: LayoutEditorResponse,
): LayoutEditorApplyResult {
  const layout = cloneLayoutState(baseLayout);
  const warnings: string[] = [];
  const errors: string[] = [...(response.errors ?? [])];
  let occupancySwaps: Array<[string, string]> = [];

  if (!response.operations?.length) {
    errors.push("No operations were returned.");
    return { layout, summary: response.summary, warnings, errors, occupancySwaps };
  }

  for (const op of response.operations) {
    const promptActions = operationToPromptActions(op);
    if (promptActions.length > 0) {
      const applied = applyLayoutPromptActions(layout.rows, promptActions);
      layout.rows = applied.rows;
      warnings.push(...applied.warnings);
      occupancySwaps = [...occupancySwaps, ...applied.occupancySwaps];
      continue;
    }

    if (op.action === "DUPLICATE_ROW") {
      layout.rows = duplicateRow(
        layout.rows,
        op.source,
        op.newRow,
        op.position,
        errors,
        warnings,
      );
      continue;
    }

    if (
      op.action === "REMOVE_SEATS" ||
      op.action === "REMOVE_SEATS_KEEP_SPACE" ||
      op.action === "REMOVE_SEATS_AND_COLLAPSE" ||
      op.action === "ADD_SEAT" ||
      op.action === "ADD_PILLAR" ||
      op.action === "REPLACE_SEATS_WITH_PILLAR" ||
      op.action === "CREATE_EMPTY_SPACE" ||
      op.action === "EMPTY_SPACE_TO_SEATS"
    ) {
      layout.rows = applySeatOperation(layout.rows, op, errors, warnings);
      continue;
    }

    if (op.action === "ADD_CABIN" || op.action === "REMOVE_CABIN" || op.action === "UPDATE_CABIN") {
      applyCabinOperation(layout, op, errors, warnings);
      continue;
    }

    if (op.action === "REMOVE_PILLAR_ADD_SEATS") {
      warnings.push("REMOVE_PILLAR_ADD_SEATS is applied as removing pillars and adding seats in the target row.");
      const applied = applyLayoutPromptActions(layout.rows, [
        { type: "remove_pillars", row: layout.rows[0]?.key ?? "A", count: 1 },
        { type: "add_seats", row: layout.rows[0]?.key ?? "A", count: Math.max(1, op.seatCount) },
      ]);
      layout.rows = applied.rows;
      warnings.push(...applied.warnings);
      continue;
    }

    errors.push(`Unsupported operation: ${op.action}`);
  }

  const totalSeats = layout.rows.reduce((sum, row) => sum + seatCountForRow(row), 0);
  const summary =
    response.summary ||
    `Applied ${response.operations.length} operation(s) — ${totalSeats} seats across ${layout.rows.length} row(s).`;

  return { layout, summary, warnings, errors, occupancySwaps };
}

export function parseNaturalLanguageOperations(
  prompt: string,
  layout: ColanLayoutState,
): LayoutEditorResponse | null {
  const lower = prompt.trim().toLowerCase();
  if (!lower) return null;

  const insertRowBetween = lower.match(
    /\b(?:create|add|insert)\s+rows?\s+([a-z])\s+between\s+([a-z])\s+and\s+([a-z])(?:\s+rows?)?(?:\s+with\s+(\d+|two|three|four|five|six|seven|eight)\s+pillars?)?\b/,
  );
  if (insertRowBetween) {
    const pillarRaw = insertRowBetween[4];
    const pillars = pillarRaw
      ? Number.isNaN(Number.parseInt(pillarRaw, 10))
        ? { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }[
            pillarRaw as "two"
          ] ?? 0
        : Number.parseInt(pillarRaw, 10)
      : 0;
    return {
      summary: `Insert row ${insertRowBetween[1].toUpperCase()} between ${insertRowBetween[2].toUpperCase()} and ${insertRowBetween[3].toUpperCase()}.`,
      operations: [
        {
          action: "INSERT_ROW_BETWEEN",
          newRow: insertRowBetween[1].toUpperCase(),
          after: insertRowBetween[2].toUpperCase(),
          before: insertRowBetween[3].toUpperCase(),
          pillars,
        },
      ],
    };
  }

  const seatListMatch = lower.match(
    /\b(?:remove|delete)\s+((?:[a-z]\d+(?:\s*(?:,|and)\s*)?)+)/,
  );
  if (seatListMatch) {
    const seats = [...seatListMatch[1].matchAll(/\b([a-z]\d+)\b/gi)].map((match) =>
      match[1].toUpperCase(),
    );
    if (seats.length > 0) {
      const keepSpace = /\b(empty|space|gap)\b/.test(lower);
      const collapse = /\b(collapse|shift)\b/.test(lower);
      return {
        summary: keepSpace
          ? `Left empty space where ${seats.join(", ")} were.`
          : `Removed seat(s) ${seats.join(", ")}.`,
        operations: [
          collapse
            ? { action: "REMOVE_SEATS_AND_COLLAPSE", seats }
            : keepSpace
              ? { action: "REMOVE_SEATS_KEEP_SPACE", seats }
              : { action: "REMOVE_SEATS", seats },
        ],
      };
    }
  }

  const pillarBetween = lower.match(
    /\badd\s+pillars?\s+between\s+([a-z]\d+)\s+and\s+([a-z]\d+)\b/,
  );
  if (pillarBetween) {
    return {
      summary: `Added pillar between ${pillarBetween[1].toUpperCase()} and ${pillarBetween[2].toUpperCase()}.`,
      operations: [
        {
          action: "ADD_PILLAR",
          position: { between: [pillarBetween[1].toUpperCase(), pillarBetween[2].toUpperCase()] },
        },
      ],
    };
  }

  const replaceWithPillar = lower.match(
    /\breplace\s+((?:[a-z]\d+(?:\s*(?:,|and)\s*)?)+)\s+with\s+pillars?\b/,
  );
  if (replaceWithPillar) {
    const seats = [...replaceWithPillar[1].matchAll(/\b([a-z]\d+)\b/gi)].map((match) =>
      match[1].toUpperCase(),
    );
    if (seats.length > 0) {
      return {
        summary: `Replaced ${seats.join(", ")} with pillar.`,
        operations: [{ action: "REPLACE_SEATS_WITH_PILLAR", seats }],
      };
    }
  }

  const addSeatBetween = lower.match(
    /\badd\s+seats?\s+between\s+([a-z]\d+)\s+and\s+([a-z]\d+)\b/,
  );
  if (addSeatBetween) {
    return {
      summary: `Added seat between ${addSeatBetween[1].toUpperCase()} and ${addSeatBetween[2].toUpperCase()}.`,
      operations: [
        {
          action: "ADD_SEAT",
          position: { between: [addSeatBetween[1].toUpperCase(), addSeatBetween[2].toUpperCase()] },
        },
      ],
    };
  }

  const renameCabin = lower.match(/\brename\s+(.+?)\s+cabin\s+to\s+(.+)\b/);
  if (renameCabin) {
    const fromLabel = renameCabin[1].trim();
    const toLabel = renameCabin[2].trim();
    const cabin =
      layout.cabinsBeforeA.find((entry) => entry.label.toLowerCase() === fromLabel) ??
      layout.cabinsAfterG.find((entry) => entry.label.toLowerCase() === fromLabel);
    if (cabin) {
      return {
        summary: `Renamed cabin ${fromLabel} to ${toLabel}.`,
        operations: [{ action: "UPDATE_CABIN", cabinId: cabin.id, label: toLabel }],
      };
    }
  }

  return null;
}

export function tryParseLayoutEditorResponse(raw: string): LayoutEditorResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as LayoutEditorResponse;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.operations)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
