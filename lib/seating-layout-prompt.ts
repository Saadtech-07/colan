import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";

export type SeatingLayoutPromptResult = {
  rows: SeatingRowConfig[];
  summary: string;
  warnings: string[];
};

/** Each pillar block is ~2 seat widths on the floor plan. */
const SEATS_PER_PILLAR = 2;

type PromptAction =
  | { type: "remove_row"; row: string }
  | { type: "remove_pillars"; row: string }
  | { type: "add_pillars"; row: string; count: number }
  | { type: "add_seats"; row: string; count: number };

function cloneRows(rows: SeatingRowConfig[]): SeatingRowConfig[] {
  return rows.map((row) => ({
    ...row,
    top: row.top.map((c) => ({ ...c }) as FloorCell),
    bottom: row.bottom.map((c) => ({ ...c }) as FloorCell),
  }));
}

function isSeat(cell: FloorCell): cell is Extract<FloorCell, { kind: "seat" }> {
  return cell.kind === "seat";
}

function isLabel(cell: FloorCell): cell is Extract<FloorCell, { kind: "label" }> {
  return cell.kind === "label";
}

function existingRowKeys(rows: SeatingRowConfig[]): Set<string> {
  return new Set(rows.map((row) => row.key.toUpperCase()));
}

function maxSeatNumber(row: SeatingRowConfig): number {
  const prefix = row.key.toUpperCase();
  let max = 0;
  for (const cell of [...row.top, ...row.bottom]) {
    if (cell.kind !== "seat") continue;
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

function seatCountForRow(row: SeatingRowConfig): number {
  return [...row.top, ...row.bottom].filter(isSeat).length;
}

function splitBand(cells: FloorCell[]): { label: FloorCell[]; body: FloorCell[] } {
  const label: FloorCell[] = [];
  const body: FloorCell[] = [];
  for (const cell of cells) {
    if (body.length === 0 && isLabel(cell)) label.push(cell);
    else body.push(cell);
  }
  return { label, body };
}

function extractSeatCells(body: FloorCell[]): FloorCell[] {
  return body.filter(isSeat);
}

function extractFixedPrefix(body: FloorCell[]): FloorCell[] {
  return body.filter((cell) => cell.kind === "entrance" || cell.kind === "gap");
}

/**
 * Colan B/E rows place pillars after the 3rd and 8th seat in each band.
 * Reuse those columns so every row lines up on the floor plan grid.
 */
function computePillarInsertIndices(seatCount: number, pillarCount: number): number[] {
  if (pillarCount <= 0 || seatCount < 2) return [];

  const pillarsToInsert = Math.min(pillarCount, seatCount - 1);
  const colanStandard = [2, 7];

  if (pillarsToInsert <= colanStandard.length && seatCount >= 8) {
    const aligned = colanStandard.slice(0, pillarsToInsert).filter((index) => index < seatCount - 1);
    if (aligned.length === pillarsToInsert) return aligned;
  }

  const groupCount = pillarsToInsert + 1;
  let baseSize = Math.floor(seatCount / groupCount);
  let remainder = seatCount % groupCount;
  const indices: number[] = [];
  let seatIndex = 0;

  for (let group = 0; group < groupCount; group += 1) {
    const groupSize = baseSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    seatIndex += groupSize;
    if (group < pillarsToInsert) {
      indices.push(seatIndex - 1);
    }
  }

  return indices;
}

function insertPillarsAtIndices(seatCells: FloorCell[], indices: number[]): FloorCell[] {
  if (indices.length === 0) return seatCells;

  const insertAfter = new Set(indices);
  const result: FloorCell[] = [];

  for (let index = 0; index < seatCells.length; index += 1) {
    result.push(seatCells[index]);
    if (insertAfter.has(index)) {
      result.push({ kind: "pillar" });
    }
  }

  return result;
}

function addPillarsToRow(row: SeatingRowConfig, count: number, warnings: string[]): SeatingRowConfig {
  const topBand = splitBand(row.top);
  const bottomBand = splitBand(row.bottom);
  const topSeatCells = extractSeatCells(topBand.body);
  const bottomSeatCells = extractSeatCells(bottomBand.body);

  if (topSeatCells.length + bottomSeatCells.length < 2) {
    warnings.push(`Row ${row.key} does not have enough seats to add pillars.`);
    return row;
  }

  const topPillars = Math.ceil(count / 2);
  const bottomPillars = count - topPillars;

  const topIndices = computePillarInsertIndices(topSeatCells.length, topPillars);
  const bottomIndices =
    topSeatCells.length === bottomSeatCells.length && topPillars === bottomPillars
      ? topIndices
      : computePillarInsertIndices(bottomSeatCells.length, bottomPillars);

  const topBody = [
    ...extractFixedPrefix(topBand.body),
    ...insertPillarsAtIndices(topSeatCells, topIndices),
  ];
  const bottomBody = [
    ...extractFixedPrefix(bottomBand.body),
    ...insertPillarsAtIndices(bottomSeatCells, bottomIndices),
  ];

  const seatTotal = seatCountForRow({
    ...row,
    top: [...topBand.label, ...topBody],
    bottom: [...bottomBand.label, ...bottomBody],
  });

  warnings.push(
    `Added ${count} pillar(s) to row ${row.key} (aligned with Colan B/E column grid).`,
  );

  return {
    ...row,
    seatCount: seatTotal,
    top: updateRowLabel([...topBand.label, ...topBody], seatTotal, row.key),
    bottom: [...bottomBand.label, ...bottomBody],
  };
}

function addSeatsToRow(row: SeatingRowConfig, count: number, warnings: string[]): SeatingRowConfig {
  const prefix = row.key.toUpperCase();
  let nextSeatNumber = maxSeatNumber(row) + 1;
  const newSeats: FloorCell[] = Array.from({ length: count }, () => ({
    kind: "seat" as const,
    id: `${prefix}${nextSeatNumber++}`,
  }));

  const topBand = splitBand(row.top);
  const bottomBand = splitBand(row.bottom);
  const topSeatCount = topBand.body.filter(isSeat).length;
  const bottomSeatCount = bottomBand.body.filter(isSeat).length;

  const top = [...topBand.label, ...topBand.body];
  const bottom = [...bottomBand.label, ...bottomBand.body];

  if (topSeatCount <= bottomSeatCount) {
    top.push(...newSeats);
  } else {
    bottom.push(...newSeats);
  }

  const seatTotal = seatCountForRow({ ...row, top, bottom });
  warnings.push(`Added ${count} seat(s) to row ${row.key} (${seatTotal} total).`);

  return {
    ...row,
    seatCount: seatTotal,
    top: updateRowLabel(top, seatTotal, row.key),
    bottom,
  };
}

function seatNumber(seatId: string, prefix: string): number {
  return Number.parseInt(seatId.slice(prefix.length), 10);
}

function collectSeatIdsSorted(row: SeatingRowConfig): string[] {
  const prefix = row.key.toUpperCase();
  const ids: string[] = [];
  for (const cell of [...row.top, ...row.bottom]) {
    if (cell.kind === "seat") ids.push(cell.id);
  }
  return ids.sort((a, b) => seatNumber(a, prefix) - seatNumber(b, prefix));
}

function toSeatCells(ids: string[]): FloorCell[] {
  return ids.map((id) => ({ kind: "seat", id }));
}

function splitSeatIdsForBands(allIds: string[], totalSeats: number): {
  topSeatIds: string[];
  bottomSeatIds: string[];
} {
  // Standard Colan 32-seat rows: E1–E16 top, E17–E32 bottom (same as A/C rows).
  const topCount = totalSeats >= 32 ? 16 : Math.ceil(totalSeats / 2);
  return {
    topSeatIds: allIds.slice(0, topCount),
    bottomSeatIds: allIds.slice(topCount),
  };
}

function removePillarsAndFillWithSeats(
  row: SeatingRowConfig,
  warnings: string[],
): SeatingRowConfig {
  const pillarCount = [...row.top, ...row.bottom].filter((cell) => cell.kind === "pillar").length;
  if (pillarCount === 0) {
    warnings.push(`Row ${row.key} has no pillars to replace.`);
    return row;
  }

  const prefix = row.key.toUpperCase();
  const existingIds = collectSeatIdsSorted(row);
  let nextSeatNumber = maxSeatNumber(row) + 1;

  const newIds = Array.from({ length: pillarCount * SEATS_PER_PILLAR }, () => {
    const id = `${prefix}${nextSeatNumber}`;
    nextSeatNumber += 1;
    return id;
  });

  const allIds = [...existingIds, ...newIds].sort(
    (a, b) => seatNumber(a, prefix) - seatNumber(b, prefix),
  );

  const topBand = splitBand(row.top);
  const bottomBand = splitBand(row.bottom);

  const topFixed = topBand.body.filter(
    (cell) => cell.kind === "entrance" || cell.kind === "gap",
  );
  const bottomFixed = bottomBand.body.filter((cell) => cell.kind === "gap");

  const { topSeatIds, bottomSeatIds } = splitSeatIdsForBands(allIds, allIds.length);

  const top = [...topBand.label, ...topFixed, ...toSeatCells(topSeatIds)];
  const bottom = [...bottomBand.label, ...bottomFixed, ...toSeatCells(bottomSeatIds)];
  const seatTotal = allIds.length;

  warnings.push(
    `Replaced ${pillarCount} pillar(s) in row ${row.key} with ${pillarCount * SEATS_PER_PILLAR} seats (${seatTotal} total: ${prefix}1–${prefix}${topSeatIds.length} top, ${prefix}${topSeatIds.length + 1}–${prefix}${seatTotal} bottom).`,
  );

  return {
    ...row,
    seatCount: seatTotal,
    top: updateRowLabel(top, seatTotal, row.key),
    bottom,
  };
}

function parsePromptActions(prompt: string): PromptAction[] {
  const lower = prompt.toLowerCase();
  const actions: PromptAction[] = [];
  const seen = new Set<string>();

  const push = (action: PromptAction) => {
    const key = JSON.stringify(action);
    if (seen.has(key)) return;
    seen.add(key);
    actions.push(action);
  };

  for (const match of lower.matchAll(
    /\badd\s+(\d+)\s+pillars?\s+(?:in|to)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({ type: "add_pillars", row: match[2].toUpperCase(), count: Number.parseInt(match[1], 10) });
  }

  for (const match of lower.matchAll(
    /\badd\s+pillars?\s+(?:in|to)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({ type: "add_pillars", row: match[1].toUpperCase(), count: 1 });
  }

  for (const match of lower.matchAll(
    /\badd\s+(\d+)\s+seats?\s+(?:in|to)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({ type: "add_seats", row: match[2].toUpperCase(), count: Number.parseInt(match[1], 10) });
  }

  for (const match of lower.matchAll(
    /\bremove\s+all\s+([a-z])\s+rows?\b/g,
  )) {
    push({ type: "remove_row", row: match[1].toUpperCase() });
  }

  for (const match of lower.matchAll(
    /\bremove\s+(?:the\s+)?([a-z])\s+rows?\s+pillars?\b/g,
  )) {
    push({ type: "remove_pillars", row: match[1].toUpperCase() });
  }

  for (const match of lower.matchAll(
    /\bremove\s+(?:the\s+)?pillars?\s+(?:in|from)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({ type: "remove_pillars", row: match[1].toUpperCase() });
  }

  for (const match of lower.matchAll(
    /\bremove\s+pillars?\s+in\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({ type: "remove_pillars", row: match[1].toUpperCase() });
  }

  for (const match of lower.matchAll(
    /\bremove\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    const row = match[1].toUpperCase();
    if (actions.some((action) => action.type === "remove_pillars" && action.row === row)) continue;
    if (actions.some((action) => action.type === "add_pillars" && action.row === row)) continue;
    push({ type: "remove_row", row });
  }

  return actions;
}

function applyAction(
  rows: SeatingRowConfig[],
  action: PromptAction,
  warnings: string[],
): SeatingRowConfig[] {
  const known = existingRowKeys(rows);

  if (action.type === "remove_row") {
    if (!known.has(action.row)) {
      warnings.push(`Row ${action.row} was not found.`);
      return rows;
    }
    warnings.push(`Removed row ${action.row}.`);
    return rows.filter((row) => row.key.toUpperCase() !== action.row);
  }

  const row = rows.find((entry) => entry.key.toUpperCase() === action.row);
  if (!row) {
    warnings.push(`Row ${action.row} was not found.`);
    return rows;
  }

  if (action.type === "remove_pillars") {
    return rows.map((entry) =>
      entry.key.toUpperCase() === action.row
        ? removePillarsAndFillWithSeats(entry, warnings)
        : entry,
    );
  }

  if (action.type === "add_pillars") {
    return rows.map((entry) =>
      entry.key.toUpperCase() === action.row
        ? addPillarsToRow(entry, Math.max(1, action.count), warnings)
        : entry,
    );
  }

  return rows.map((entry) =>
    entry.key.toUpperCase() === action.row
      ? addSeatsToRow(entry, Math.max(1, action.count), warnings)
      : entry,
  );
}

export function applySeatingLayoutPrompt(
  baseRows: SeatingRowConfig[],
  prompt: string,
): SeatingLayoutPromptResult {
  const normalized = prompt.trim();
  const warnings: string[] = [];
  if (!normalized) {
    return {
      rows: cloneRows(baseRows),
      summary: "No changes applied.",
      warnings,
    };
  }

  const actions = parsePromptActions(normalized);
  if (actions.length === 0) {
    return {
      rows: cloneRows(baseRows),
      summary: "No layout changes were applied.",
      warnings: [
        'Could not parse that prompt. Try: "add 4 pillars in A row", "remove the pillars in E rows", or "remove all G rows".',
      ],
    };
  }

  let rows = cloneRows(baseRows);
  for (const action of actions) {
    rows = applyAction(rows, action, warnings);
  }

  const totalSeats = rows.reduce((sum, row) => sum + seatCountForRow(row), 0);

  return {
    rows,
    summary: `Applied ${actions.length} change(s) — ${totalSeats} seats across ${rows.length} row(s).`,
    warnings,
  };
}
