import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";

export type SeatingLayoutPromptResult = {
  rows: SeatingRowConfig[];
  summary: string;
  warnings: string[];
  /** Pairs of seat IDs whose occupants should be exchanged (preview only). */
  occupancySwaps: Array<[string, string]>;
};

/** Each pillar block is ~2 seat widths on the floor plan. */
const SEATS_PER_PILLAR = 2;

/** Seat-equivalent width per band — matches A/C rows (16 seats) and B/E rows (12 seats + 2 pillars). */
const STANDARD_BAND_WIDTH = 16;

export type PromptAction =
  | { type: "remove_row"; row: string }
  | { type: "remove_pillars"; row: string; count?: number }
  | { type: "remove_all_pillars"; rows?: string[] }
  | { type: "add_pillars"; row: string; count: number }
  | { type: "add_seats"; row: string; count: number }
  | { type: "create_row"; row: string; afterRow: string; beforeRow: string; pillars: number }
  | { type: "replace_row"; targetRow: string; sourceRow: string }
  | { type: "swap_row_seats"; rowA: string; rowB: string };

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

function countPillarsInBand(body: FloorCell[]): number {
  return body.filter((cell) => cell.kind === "pillar").length;
}

function trimSeatsForPillars(seatCells: FloorCell[], seatsToRemove: number): FloorCell[] {
  if (seatsToRemove <= 0) return seatCells;
  const keep = Math.max(1, seatCells.length - seatsToRemove);
  return seatCells.slice(0, keep);
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

  const topPillarsToAdd = Math.ceil(count / 2);
  const bottomPillarsToAdd = count - topPillarsToAdd;
  const topExistingPillars = countPillarsInBand(topBand.body);
  const bottomExistingPillars = countPillarsInBand(bottomBand.body);

  const topSeatsToRemove = topPillarsToAdd * SEATS_PER_PILLAR;
  const bottomSeatsToRemove = bottomPillarsToAdd * SEATS_PER_PILLAR;

  if (
    topSeatCells.length - topSeatsToRemove < 1 ||
    bottomSeatCells.length - bottomSeatsToRemove < 1
  ) {
    warnings.push(
      `Row ${row.key} does not have enough seats to add ${count} pillar(s) (each pillar needs ${SEATS_PER_PILLAR} seats removed).`,
    );
    return row;
  }

  const topSeatsReduced = trimSeatsForPillars(topSeatCells, topSeatsToRemove);
  const bottomSeatsReduced = trimSeatsForPillars(bottomSeatCells, bottomSeatsToRemove);
  const topTotalPillars = topExistingPillars + topPillarsToAdd;
  const bottomTotalPillars = bottomExistingPillars + bottomPillarsToAdd;

  const topIndices = computePillarInsertIndices(topSeatsReduced.length, topTotalPillars);
  const bottomIndices =
    topSeatsReduced.length === bottomSeatsReduced.length && topTotalPillars === bottomTotalPillars
      ? topIndices
      : computePillarInsertIndices(bottomSeatsReduced.length, bottomTotalPillars);

  const topBody = [
    ...extractFixedPrefix(topBand.body),
    ...insertPillarsAtIndices(topSeatsReduced, topIndices),
  ];
  const bottomBody = [
    ...extractFixedPrefix(bottomBand.body),
    ...insertPillarsAtIndices(bottomSeatsReduced, bottomIndices),
  ];

  const seatTotal = seatCountForRow({
    ...row,
    top: [...topBand.label, ...topBody],
    bottom: [...bottomBand.label, ...bottomBody],
  });

  const seatsRemoved = topSeatsToRemove + bottomSeatsToRemove;
  warnings.push(
    `Added ${count} pillar(s) to row ${row.key} and removed ${seatsRemoved} seat(s) to keep row width aligned (${seatTotal} seats remaining).`,
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

function collectSeatIdsInFloorOrder(row: SeatingRowConfig): string[] {
  const ids: string[] = [];
  for (const cell of [...row.top, ...row.bottom]) {
    if (cell.kind === "seat") ids.push(cell.id);
  }
  return ids;
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

function removeNPillarsFromRow(
  row: SeatingRowConfig,
  count: number,
  warnings: string[],
): SeatingRowConfig {
  const topBand = splitBand(row.top);
  const bottomBand = splitBand(row.bottom);
  const prefix = row.key.toUpperCase();
  let nextSeatNumber = maxSeatNumber(row) + 1;
  let remaining = Math.max(1, count);

  const replacePillarsInBand = (body: FloorCell[]): FloorCell[] => {
    const result: FloorCell[] = [];
    for (const cell of body) {
      if (cell.kind === "pillar" && remaining > 0) {
        result.push({ kind: "seat", id: `${prefix}${nextSeatNumber++}` });
        result.push({ kind: "seat", id: `${prefix}${nextSeatNumber++}` });
        remaining -= 1;
      } else {
        result.push(cell);
      }
    }
    return result;
  };

  const topBody = replacePillarsInBand(topBand.body);
  const bottomBody = replacePillarsInBand(bottomBand.body);
  const removed = count - remaining;

  if (removed === 0) {
    warnings.push(`Row ${row.key} has no pillars to remove.`);
    return row;
  }

  if (remaining > 0) {
    warnings.push(
      `Row ${row.key} only had ${removed} pillar(s); removed all available pillars.`,
    );
  }

  const top = [...topBand.label, ...topBody];
  const bottom = [...bottomBand.label, ...bottomBody];
  const seatTotal = seatCountForRow({ ...row, top, bottom });

  warnings.push(
    `Removed ${removed} pillar(s) from row ${row.key} and added ${removed * SEATS_PER_PILLAR} seat(s) (${seatTotal} total).`,
  );

  return {
    ...row,
    seatCount: seatTotal,
    top: updateRowLabel(top, seatTotal, row.key),
    bottom,
  };
}

function parseRowLettersFromList(text: string): string[] {
  const found = text.match(/\b[a-z]\b/gi);
  if (!found) return [];
  return [...new Set(found.map((letter) => letter.toUpperCase()))];
}

function parseWordOrNumber(value: string): number {
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const lower = value.toLowerCase().trim();
  if (wordMap[lower] !== undefined) return wordMap[lower];
  const parsed = Number.parseInt(lower, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function parsePillarCountFromPrompt(lower: string): number {
  if (/\b(?:with\s+)?no\s+pillars?\b/.test(lower)) return 0;

  const patterns = [
    /\b(?:need|want|require)\s+(?:only\s+)?(\d+|one|two|three|four|five|six|seven|eight)\s+pillars?\b/,
    /\b(?:with\s+)?(?:only\s+)?(\d+|one|two|three|four|five|six|seven|eight)\s+pillars?\s*(?:only)?\b/,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (!match) continue;
    const count = parseWordOrNumber(match[1]);
    if (count >= 0) return count;
  }

  return 0;
}

function buildRowWithPillars(rowKey: string, pillarCount: number): SeatingRowConfig {
  const prefix = rowKey.toUpperCase();
  const topPillars = Math.ceil(pillarCount / 2);
  const bottomPillars = pillarCount - topPillars;
  const topSeatCount = STANDARD_BAND_WIDTH - topPillars * SEATS_PER_PILLAR;
  const bottomSeatCount = STANDARD_BAND_WIDTH - bottomPillars * SEATS_PER_PILLAR;
  const seatTotal = topSeatCount + bottomSeatCount;

  const topSeatIds = Array.from({ length: topSeatCount }, (_, index) => `${prefix}${index + 1}`);
  const bottomSeatIds = Array.from(
    { length: bottomSeatCount },
    (_, index) => `${prefix}${topSeatCount + index + 1}`,
  );

  const topIndices = computePillarInsertIndices(topSeatCount, topPillars);
  const bottomIndices =
    topSeatCount === bottomSeatCount && topPillars === bottomPillars
      ? topIndices
      : computePillarInsertIndices(bottomSeatCount, bottomPillars);

  const topBody = insertPillarsAtIndices(toSeatCells(topSeatIds), topIndices);
  const bottomBody = insertPillarsAtIndices(
    toSeatCells([...bottomSeatIds].reverse()),
    bottomIndices,
  );

  return {
    key: prefix,
    label: `${prefix}-ROW`,
    seatCount: seatTotal,
    top: [{ kind: "label", text: `${prefix}-ROW (${seatTotal})` }, ...topBody],
    bottom: [{ kind: "label", text: "" }, ...bottomBody],
  };
}

function insertRowBetween(
  rows: SeatingRowConfig[],
  newRow: SeatingRowConfig,
  afterRow: string,
  beforeRow: string,
  warnings: string[],
): SeatingRowConfig[] {
  const afterIndex = rows.findIndex((row) => row.key.toUpperCase() === afterRow.toUpperCase());
  if (afterIndex === -1) {
    warnings.push(`Row ${afterRow} was not found — could not insert row ${newRow.key}.`);
    return rows;
  }

  const beforeIndex = beforeRow
    ? rows.findIndex((row) => row.key.toUpperCase() === beforeRow.toUpperCase())
    : afterIndex + 1;

  if (beforeRow && beforeIndex === -1) {
    warnings.push(`Row ${beforeRow} was not found — could not insert row ${newRow.key}.`);
    return rows;
  }

  if (beforeRow && beforeIndex !== afterIndex + 1) {
    warnings.push(
      `Row ${beforeRow} is not directly after row ${afterRow}; inserted ${newRow.key} after ${afterRow} anyway.`,
    );
  }

  if (existingRowKeys(rows).has(newRow.key.toUpperCase())) {
    warnings.push(`Row ${newRow.key} already exists.`);
    return rows;
  }

  const next = [...rows];
  next.splice(afterIndex + 1, 0, newRow);
  return next;
}

function parseCreateRowActions(lower: string): PromptAction[] {
  const actions: PromptAction[] = [];
  const pillarCount = parsePillarCountFromPrompt(lower);
  const pillarSegment =
    String.raw`\s+with\s+(?:\d+|one|two|three|four|five|six|seven|eight)\s+pillars?`;
  const optionalPillarSegment = `${pillarSegment}?`;

  const patterns: RegExp[] = [
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+rows?\s+([a-z])${optionalPillarSegment}\s+between\s+([a-z])\s+and\s+([a-z])(?:\s+rows?)?\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+rows?\s+([a-z])\s+between\s+([a-z])\s+and\s+([a-z])(?:\s+rows?)?${optionalPillarSegment}\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+(?:an?\s+)?([a-z])\s+rows?${optionalPillarSegment}\s+between\s+([a-z])\s+and\s+([a-z])(?:\s+rows?)?\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+(?:an?\s+)?([a-z])\s+rows?\s+between\s+([a-z])\s+and\s+([a-z])(?:\s+rows?)?${optionalPillarSegment}\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+rows?\s+([a-z])${optionalPillarSegment}\s+after\s+([a-z])(?:\s+rows?)?\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+rows?\s+([a-z])\s+after\s+([a-z])(?:\s+rows?)?${optionalPillarSegment}\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+(?:an?\s+)?([a-z])\s+rows?${optionalPillarSegment}\s+after\s+([a-z])(?:\s+rows?)?\b`,
      "g",
    ),
    new RegExp(
      String.raw`\b(?:create|add|insert)\s+(?:an?\s+)?([a-z])\s+rows?\s+after\s+([a-z])(?:\s+rows?)?${optionalPillarSegment}\b`,
      "g",
    ),
  ];

  const betweenPatterns = patterns.slice(0, 4);
  const afterPatterns = patterns.slice(4);

  for (const pattern of betweenPatterns) {
    for (const match of lower.matchAll(pattern)) {
      actions.push({
        type: "create_row",
        row: match[1].toUpperCase(),
        afterRow: match[2].toUpperCase(),
        beforeRow: match[3].toUpperCase(),
        pillars: pillarCount,
      });
    }
    if (actions.length > 0) return actions;
  }

  for (const pattern of afterPatterns) {
    for (const match of lower.matchAll(pattern)) {
      actions.push({
        type: "create_row",
        row: match[1].toUpperCase(),
        afterRow: match[2].toUpperCase(),
        beforeRow: "",
        pillars: pillarCount,
      });
    }
    if (actions.length > 0) return actions;
  }

  return actions;
}

function parseRowLetter(value: string): string {
  return value.toUpperCase();
}

type BodyPatternCell =
  | { kind: "seat" }
  | { kind: "pillar" }
  | { kind: "entrance"; text: string }
  | { kind: "gap" };

function extractBodyPattern(body: FloorCell[]): BodyPatternCell[] {
  return body
    .filter((cell) => cell.kind !== "label")
    .map((cell) => {
      if (cell.kind === "seat") return { kind: "seat" as const };
      if (cell.kind === "pillar") return { kind: "pillar" as const };
      if (cell.kind === "entrance") return { kind: "entrance", text: cell.text };
      return { kind: "gap" as const };
    });
}

function rebuildBandBody(pattern: BodyPatternCell[], seatIds: string[]): FloorCell[] {
  let seatIndex = 0;
  const body: FloorCell[] = [];

  for (const cell of pattern) {
    if (cell.kind === "seat") {
      body.push({ kind: "seat", id: seatIds[seatIndex] ?? `?${seatIndex}` });
      seatIndex += 1;
    } else if (cell.kind === "pillar") {
      body.push({ kind: "pillar" });
    } else if (cell.kind === "entrance") {
      body.push({ kind: "entrance", text: cell.text });
    } else {
      body.push({ kind: "gap" });
    }
  }

  return body;
}

function countPillarsInRow(row: SeatingRowConfig): number {
  return [...row.top, ...row.bottom].filter((cell) => cell.kind === "pillar").length;
}

function cloneRowLayoutFromSource(source: SeatingRowConfig, targetKey: string): SeatingRowConfig {
  const prefix = targetKey.toUpperCase();
  const topBand = splitBand(source.top);
  const bottomBand = splitBand(source.bottom);
  const topPattern = extractBodyPattern(topBand.body);
  const bottomPattern = extractBodyPattern(bottomBand.body);
  const topSeatCount = topPattern.filter((cell) => cell.kind === "seat").length;
  const bottomSeatCount = bottomPattern.filter((cell) => cell.kind === "seat").length;
  const seatTotal = topSeatCount + bottomSeatCount;

  const allSeatIds = Array.from({ length: seatTotal }, (_, index) => `${prefix}${index + 1}`);
  const topBody = rebuildBandBody(topPattern, allSeatIds.slice(0, topSeatCount));
  const bottomBody = rebuildBandBody(bottomPattern, allSeatIds.slice(topSeatCount));

  return {
    key: prefix,
    label: `${prefix}-ROW`,
    seatCount: seatTotal,
    top: [{ kind: "label", text: `${prefix}-ROW (${seatTotal})` }, ...topBody],
    bottom: [{ kind: "label", text: "" }, ...bottomBody],
  };
}

function replaceRowWithSource(
  rows: SeatingRowConfig[],
  targetRow: string,
  sourceRow: string,
  warnings: string[],
): SeatingRowConfig[] {
  const target = targetRow.toUpperCase();
  const source = sourceRow.toUpperCase();

  if (target === source) {
    warnings.push(`Row ${target} already uses its own layout.`);
    return rows;
  }

  const sourceRowConfig = rows.find((row) => row.key.toUpperCase() === source);
  const targetExists = rows.some((row) => row.key.toUpperCase() === target);

  if (!sourceRowConfig) {
    warnings.push(`Source row ${source} was not found.`);
    return rows;
  }
  if (!targetExists) {
    warnings.push(`Target row ${target} was not found.`);
    return rows;
  }

  const cloned = cloneRowLayoutFromSource(sourceRowConfig, target);
  const pillars = countPillarsInRow(cloned);
  warnings.push(
    `Replaced row ${target} with the layout from row ${source} (${cloned.seatCount} seats${pillars > 0 ? `, ${pillars} pillar(s)` : ""}).`,
  );

  return rows.map((row) => (row.key.toUpperCase() === target ? cloned : row));
}

function swapRowLayoutsAndSeats(
  rows: SeatingRowConfig[],
  rowA: string,
  rowB: string,
  warnings: string[],
  occupancySwaps: Array<[string, string]>,
): SeatingRowConfig[] {
  const a = rowA.toUpperCase();
  const b = rowB.toUpperCase();

  if (a === b) {
    warnings.push(`Row ${a} cannot be swapped with itself.`);
    return rows;
  }

  const configA = rows.find((row) => row.key.toUpperCase() === a);
  const configB = rows.find((row) => row.key.toUpperCase() === b);

  if (!configA) {
    warnings.push(`Row ${a} was not found.`);
    return rows;
  }
  if (!configB) {
    warnings.push(`Row ${b} was not found.`);
    return rows;
  }

  const aSeats = collectSeatIdsInFloorOrder(configA);
  const bSeats = collectSeatIdsInFloorOrder(configB);
  const pairCount = Math.min(aSeats.length, bSeats.length);

  for (let index = 0; index < pairCount; index += 1) {
    occupancySwaps.push([aSeats[index], bSeats[index]]);
  }

  const newA = cloneRowLayoutFromSource(configB, a);
  const newB = cloneRowLayoutFromSource(configA, b);

  warnings.push(
    `Swapped row ${a} and row ${b} — layouts exchanged and ${pairCount} seat assignment(s) switched.`,
  );

  if (aSeats.length !== bSeats.length) {
    warnings.push(
      `Rows ${a} (${aSeats.length} seats) and ${b} (${bSeats.length} seats) had different seat counts; only the first ${pairCount} positions were paired.`,
    );
  }

  return rows.map((row) => {
    if (row.key.toUpperCase() === a) return newA;
    if (row.key.toUpperCase() === b) return newB;
    return row;
  });
}

/** Apply seat-ID swap pairs on top of a base occupancy map (for prompt preview). */
export function applyOccupancySwaps<T>(
  base: Map<string, T>,
  swaps: Array<[string, string]>,
): Map<string, T> {
  const next = new Map(base);
  for (const [seatA, seatB] of swaps) {
    const valueA = next.get(seatA);
    const valueB = next.get(seatB);
    if (valueA) next.set(seatB, valueA);
    else next.delete(seatB);
    if (valueB) next.set(seatA, valueB);
    else next.delete(seatA);
  }
  return next;
}

function parseSwapRowSeatsActions(lower: string): PromptAction[] {
  const actions: PromptAction[] = [];
  const patterns = [
    /\b(?:replace|switch|exchange)\s+(?:the\s+)?([a-z])\s+rows?\s+with\s+(?:the\s+)?([a-z])\s+rows?\b/g,
    /\bswap\s+(?:the\s+)?([a-z])\s+and\s+([a-z])\s+rows?\b/g,
    /\bswap\s+(?:the\s+)?rows?\s+([a-z])\s+and\s+([a-z])\b/g,
    /\bexchange\s+(?:the\s+)?([a-z])\s+and\s+([a-z])\s+rows?\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of lower.matchAll(pattern)) {
      actions.push({
        type: "swap_row_seats",
        rowA: parseRowLetter(match[1]),
        rowB: parseRowLetter(match[2]),
      });
    }
  }

  return actions;
}

function parseReplaceRowActions(lower: string): PromptAction[] {
  const actions: PromptAction[] = [];
  const patterns = [
    /\b(?:copy|convert)\s+(?:the\s+)?([a-z])\s+rows?\s+(?:to|into)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
    /\bmake\s+(?:the\s+)?([a-z])\s+rows?\s+(?:like|same\s+as|match)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
    /\b(?:update|change)\s+(?:the\s+)?([a-z])\s+rows?\s+to\s+match\s+(?:the\s+)?([a-z])\s+rows?\b/g,
    /\b(?:copy|update|change)\s+(?:the\s+)?([a-z])\s+rows?\s+(?:layout|structure)\s+(?:with|from|to)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of lower.matchAll(pattern)) {
      actions.push({
        type: "replace_row",
        targetRow: parseRowLetter(match[1]),
        sourceRow: parseRowLetter(match[2]),
      });
    }
  }

  return actions;
}

function parseRemoveRowActions(lower: string): PromptAction[] {
  const actions: PromptAction[] = [];
  const seen = new Set<string>();

  const patterns = [
    /\b(?:remove|delete|drop)\s+(?:all\s+)?(?:the\s+)?(?:rows?\s+)?(.+?)\s+rows?\b/g,
    /\b(?:remove|delete|drop)\s+(?:the\s+)?rows?\s+([a-z][\w\s,&]*)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of lower.matchAll(pattern)) {
      const phrase = match[0];
      if (/\bpillars?\b/.test(phrase)) continue;
      for (const row of parseRowLettersFromList(match[1])) {
        if (seen.has(row)) continue;
        seen.add(row);
        actions.push({ type: "remove_row", row });
      }
    }
  }

  return actions;
}

function parseRemoveAllPillarsActions(lower: string): PromptAction[] {
  const specificMatch = lower.match(
    /\bremove\s+all\s+(?:the\s+)?pillars?\s+from\s+(?:the\s+)?([a-z][\w\s,&]*)\s+rows?\b/,
  );
  if (specificMatch) {
    const rows = parseRowLettersFromList(specificMatch[1]);
    if (rows.length > 0) {
      return [{ type: "remove_all_pillars", rows }];
    }
  }

  const globalPatterns = [
    /\bremove\s+all\s+(?:the\s+)?pillars?\s+from\s+(?:the\s+)?rows?\b/,
    /\bremove\s+all\s+(?:the\s+)?pillars?\b/,
    /\bremove\s+pillars?\s+from\s+all\s+rows?\b/,
    /\bremove\s+pillars?\s+from\s+(?:the\s+)?rows?\b/,
    /\bclear\s+all\s+(?:the\s+)?pillars?\b/,
  ];

  for (const pattern of globalPatterns) {
    if (pattern.test(lower)) {
      return [{ type: "remove_all_pillars" }];
    }
  }

  return [];
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

  for (const action of parseRemoveAllPillarsActions(lower)) {
    push(action);
  }

  if (actions.some((action) => action.type === "remove_all_pillars")) {
    return actions;
  }

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
    /\bremove\s+(\d+)\s+pillars?\s+(?:in|from)\s+(?:the\s+)?([a-z])\s+rows?\b/g,
  )) {
    push({
      type: "remove_pillars",
      row: match[2].toUpperCase(),
      count: Number.parseInt(match[1], 10),
    });
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

  for (const action of parseSwapRowSeatsActions(lower)) {
    push(action);
  }

  for (const action of parseReplaceRowActions(lower)) {
    push(action);
  }

  for (const action of parseCreateRowActions(lower)) {
    push(action);
  }

  for (const action of parseRemoveRowActions(lower)) {
    if (action.type !== "remove_row") continue;
    if (actions.some((entry) => entry.type === "remove_pillars" && entry.row === action.row)) {
      continue;
    }
    if (actions.some((entry) => entry.type === "add_pillars" && entry.row === action.row)) {
      continue;
    }
    push(action);
  }

  return actions;
}


export function applyLayoutPromptActions(
  baseRows: SeatingRowConfig[],
  actions: PromptAction[],
): Pick<SeatingLayoutPromptResult, "rows" | "warnings" | "occupancySwaps"> {
  const warnings: string[] = [];
  const occupancySwaps: Array<[string, string]> = [];
  let rows = cloneRows(baseRows);
  for (const action of actions) {
    rows = applyAction(rows, action, warnings, occupancySwaps);
  }
  return { rows, warnings, occupancySwaps };
}

export function parseLayoutPromptActions(prompt: string): PromptAction[] {
  return parsePromptActions(prompt.trim());
}

export function cloneSeatingRows(rows: SeatingRowConfig[]): SeatingRowConfig[] {
  return cloneRows(rows);
}

function applyAction(
  rows: SeatingRowConfig[],
  action: PromptAction,
  warnings: string[],
  occupancySwaps: Array<[string, string]>,
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

  if (action.type === "create_row") {
    const newRow = buildRowWithPillars(action.row, action.pillars);
    const pillarNote =
      action.pillars > 0
        ? ` with ${action.pillars} pillar(s)`
        : " with no pillars";
    warnings.push(
      `Created row ${action.row}${pillarNote} (${newRow.seatCount} seats, width aligned with other rows).`,
    );
    return insertRowBetween(rows, newRow, action.afterRow, action.beforeRow, warnings);
  }

  if (action.type === "replace_row") {
    return replaceRowWithSource(rows, action.targetRow, action.sourceRow, warnings);
  }

  if (action.type === "swap_row_seats") {
    return swapRowLayoutsAndSeats(rows, action.rowA, action.rowB, warnings, occupancySwaps);
  }

  if (action.type === "remove_all_pillars") {
    const targetRows = action.rows ? new Set(action.rows.map((row) => row.toUpperCase())) : null;

    return rows.map((entry) => {
      if (targetRows && !targetRows.has(entry.key.toUpperCase())) {
        return entry;
      }

      const pillarCount = countPillarsInRow(entry);
      if (pillarCount === 0) return entry;

      return removePillarsAndFillWithSeats(entry, warnings);
    });
  }

  const row = rows.find((entry) => entry.key.toUpperCase() === action.row);
  if (!row) {
    warnings.push(`Row ${action.row} was not found.`);
    return rows;
  }

  if (action.type === "remove_pillars") {
    return rows.map((entry) =>
      entry.key.toUpperCase() === action.row
        ? action.count !== undefined
          ? removeNPillarsFromRow(entry, action.count, warnings)
          : removePillarsAndFillWithSeats(entry, warnings)
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
  const occupancySwaps: Array<[string, string]> = [];
  if (!normalized) {
    return {
      rows: cloneRows(baseRows),
      summary: "No changes applied.",
      warnings,
      occupancySwaps,
    };
  }

  const actions = parsePromptActions(normalized);
  if (actions.length === 0) {
    return {
      rows: cloneRows(baseRows),
      summary: "No layout changes were applied.",
      warnings: [
        'Could not parse that prompt. Try: "add X row with 4 pillars between A and B row", "remove all pillars from the rows", "replace A row with B row", or "remove G and E rows".',
      ],
      occupancySwaps,
    };
  }

  let rows = cloneRows(baseRows);
  const applied = applyLayoutPromptActions(baseRows, actions);
  rows = applied.rows;

  const totalSeats = rows.reduce((sum, row) => sum + seatCountForRow(row), 0);

  return {
    rows,
    summary: `Applied ${actions.length} change(s) — ${totalSeats} seats across ${rows.length} row(s).`,
    warnings: applied.warnings,
    occupancySwaps: applied.occupancySwaps,
  };
}
