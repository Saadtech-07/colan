import type { SeatingCabin } from "@/lib/seating-cabins";
import {
  composeFloorPlanDisplayName,
  composeFloorPlanSlug,
} from "@/lib/floor-plan-branch";
import { buildSimpleSeatingRow, slugifyFloorPlanSlug } from "@/lib/floor-plan-row-builder";
import type { CreateFloorPlanClientInput } from "@/lib/floor-plans-client";
import type { SideCabinsConfig } from "@/lib/seating-layout-editor-types";
import type { SeatingRowConfig } from "@/lib/seating-layout";
import type { FloorPlanDTO } from "@/models/floor-plan.model";

export type CabinSide = "top" | "bottom" | "left" | "right";

export type CabinDraft = {
  id: string;
  label: string;
  side: CabinSide;
  cabinId?: string;
};

export type RowDraft = {
  id: string;
  key: string;
  label: string;
  seatCount: string;
  sourceRow?: SeatingRowConfig;
};

/** One office block under a city branch (Block A, Block B, …). */
export type BlockDraft = {
  id: string;
  /** Display label in the block switcher, e.g. Block A. */
  label: string;
  /** Existing DB slug when editing; empty on create until save. */
  existingSlug?: string;
  rows: RowDraft[];
  cabins: CabinDraft[];
};

export type BranchEditorState = {
  city: string;
  blocks: BlockDraft[];
  activeBlockId: string;
};

export function newDraftId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultRows(): RowDraft[] {
  return [
    { id: newDraftId(), key: "A", label: "A-ROW", seatCount: "16" },
    { id: newDraftId(), key: "B", label: "B-ROW", seatCount: "12" },
  ];
}

export function createEmptyBlock(label: string): BlockDraft {
  return {
    id: newDraftId(),
    label,
    rows: defaultRows(),
    cabins: [],
  };
}

/** Fixed naming: Block A, Block B, Block C… (never “Main office” / custom). */
export function normalizeBlockLabel(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index >= 0 && index < letters.length) return `Block ${letters[index]}`;
  return `Block ${index + 1}`;
}

export function isPrimaryBlock(block: BlockDraft, blocks: BlockDraft[]): boolean {
  return blocks[0]?.id === block.id || /^block\s*a$/i.test(block.label.trim());
}

/** New branch starts with Block A only — Block B is optional. */
export function defaultBranchEditorState(): BranchEditorState {
  const blockA = createEmptyBlock("Block A");
  return {
    city: "",
    blocks: [blockA],
    activeBlockId: blockA.id,
  };
}

export function nextBlockLabel(existing: BlockDraft[]): string {
  return normalizeBlockLabel(existing.length);
}

export function cabinsFromPlan(plan: FloorPlanDTO): CabinDraft[] {
  const cabins: CabinDraft[] = [];
  for (const c of plan.cabins?.beforeA ?? []) {
    cabins.push({ id: newDraftId(), label: c.label, side: "top", cabinId: c.id });
  }
  for (const c of plan.cabins?.afterG ?? []) {
    cabins.push({ id: newDraftId(), label: c.label, side: "bottom", cabinId: c.id });
  }
  const side = plan.cabins?.sideCabins;
  if (side?.hrManager?.trim()) {
    cabins.push({
      id: newDraftId(),
      label: side.hrManager,
      side: "left",
      cabinId: side.hrManagerId,
    });
  }
  if (side?.manager?.trim()) {
    cabins.push({
      id: newDraftId(),
      label: side.manager,
      side: "right",
      cabinId: side.managerId,
    });
  }
  return cabins;
}

export function rowsFromPlan(plan: FloorPlanDTO): RowDraft[] {
  return plan.rows.map((row) => ({
    id: newDraftId(),
    key: row.key,
    label: row.label,
    seatCount: String(row.seatCount),
    sourceRow: row,
  }));
}

export function blockFromFloorPlan(plan: FloorPlanDTO, label: string): BlockDraft {
  return {
    id: newDraftId(),
    label,
    existingSlug: plan.slug,
    rows: rowsFromPlan(plan),
    cabins: cabinsFromPlan(plan),
  };
}

export function branchStateFromPlans(
  city: string,
  plans: FloorPlanDTO[],
  _labels?: string[],
): BranchEditorState {
  const blocks =
    plans.length > 0
      ? plans.map((plan, i) => blockFromFloorPlan(plan, normalizeBlockLabel(i)))
      : [createEmptyBlock("Block A")];
  return {
    city,
    blocks,
    activeBlockId: blocks[0]!.id,
  };
}

/** Chennai-style: first Block A → `{city}`; others → `{city}-{block-slug}`. */
export function slugForBranchBlock(city: string, building: string, index: number): string {
  const cityPart = slugifyFloorPlanSlug(city);
  const buildingPart = slugifyFloorPlanSlug(building);
  if (!cityPart && !buildingPart) return "office";
  if (!cityPart) return buildingPart;
  if (index === 0 && (!buildingPart || buildingPart === "block-a")) {
    return cityPart;
  }
  if (buildingPart) return `${cityPart}-${buildingPart}`.slice(0, 64);
  return `${cityPart}-block-${index + 1}`.slice(0, 64);
}

function cabinIdFor(
  prefix: string,
  side: CabinSide,
  index: number,
  existing?: string,
): string {
  if (existing?.trim()) return existing.trim();
  return `${prefix}-cabin-${side}-${index + 1}`;
}

export function buildCabinsPayload(
  prefix: string,
  cabins: CabinDraft[],
): FloorPlanDTO["cabins"] | undefined {
  const top = cabins.filter((c) => c.side === "top" && c.label.trim());
  const bottom = cabins.filter((c) => c.side === "bottom" && c.label.trim());
  const left = cabins.filter((c) => c.side === "left" && c.label.trim());
  const right = cabins.filter((c) => c.side === "right" && c.label.trim());
  const sideList = [...left, ...right];

  if (top.length + bottom.length + sideList.length === 0) return undefined;

  const beforeA: SeatingCabin[] = top.map((c, i) => ({
    id: cabinIdFor(prefix, "top", i, c.cabinId),
    label: c.label.trim(),
    placement: "before-A",
  }));
  const afterG: SeatingCabin[] = bottom.map((c, i) => ({
    id: cabinIdFor(prefix, "bottom", i, c.cabinId),
    label: c.label.trim(),
    placement: "after-G",
  }));

  let sideCabins: SideCabinsConfig | undefined;
  if (sideList.length > 0) {
    const first = sideList[0]!;
    const second = sideList[1];
    sideCabins = {
      hrManager: first.label.trim(),
      manager: second?.label?.trim() ?? "",
      hrManagerId: cabinIdFor(prefix, first.side, 0, first.cabinId),
      managerId: second
        ? cabinIdFor(prefix, second.side, 1, second.cabinId)
        : `${prefix}-side-manager`,
      // One cabin per seating row block (A-ROW / B-ROW), not half of the full column.
      equalHeights: false,
      spans: { hrManager: 1, manager: 1 },
    };
  }

  return {
    beforeA,
    afterG,
    ...(sideCabins ? { sideCabins } : {}),
  };
}

export function buildRowsPayload(rows: RowDraft[]): SeatingRowConfig[] {
  return rows.map((row, index) => {
    const key = row.key.trim().toUpperCase();
    if (!key) throw new Error(`Row ${index + 1}: enter a row key like A or B.`);
    const seatCount = Number(row.seatCount);
    if (!Number.isFinite(seatCount) || seatCount < 1) {
      throw new Error(`Row ${key}: seat count must be a positive number.`);
    }
    const label = row.label.trim() || `${key}-ROW`;
    const source = row.sourceRow;
    if (source && source.key === key && source.seatCount === seatCount) {
      return {
        ...source,
        label,
        top: [...source.top],
        bottom: [...source.bottom],
      };
    }
    return buildSimpleSeatingRow({ key, label, seatCount });
  });
}

export function countBlockSeats(block: BlockDraft): number {
  return block.rows.reduce((sum, row) => {
    const n = Number(row.seatCount);
    return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
  }, 0);
}

export function buildBlockPayload(
  city: string,
  block: BlockDraft,
  index: number,
): CreateFloorPlanClientInput {
  const cityTrim = city.trim();
  if (cityTrim.length < 2) {
    throw new Error("Enter a city / branch name (e.g. Hyderabad).");
  }
  const building = block.label.trim();
  if (!building) {
    throw new Error("Each block needs a name (e.g. Block A).");
  }

  const slug = (
    block.existingSlug?.trim().toLowerCase() ||
    slugForBranchBlock(cityTrim, building, index)
  ).trim();

  if (slug.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid slug for ${building}. Check the city and block names.`);
  }

  const rows = buildRowsPayload(block.rows);
  if (rows.length === 0) {
    throw new Error(`${building}: add at least one seating row.`);
  }

  const sideCabins = block.cabins.filter(
    (c) => (c.side === "left" || c.side === "right") && c.label.trim(),
  );
  if (sideCabins.length > 2) {
    throw new Error(
      `${building}: Left/Right side cabins are limited to 2 total. Move extras to Top or Bottom.`,
    );
  }

  return {
    slug,
    name: composeFloorPlanDisplayName(cityTrim, building),
    city: cityTrim,
    building,
    rows,
    cabins: buildCabinsPayload(slug, block.cabins),
    isActive: true,
    sortOrder: index,
  };
}

export function buildBranchPayloads(state: BranchEditorState): CreateFloorPlanClientInput[] {
  if (state.blocks.length === 0) {
    throw new Error("Add at least one block (e.g. Block A).");
  }
  return state.blocks.map((block, index) => buildBlockPayload(state.city, block, index));
}

/** @deprecated kept for any residual imports — prefer branch helpers. */
export type FloorPlanEditorValues = {
  slug: string;
  name: string;
  city: string;
  building: string;
  rows: RowDraft[];
  cabins: CabinDraft[];
};

export function composeSlugHint(city: string, building: string) {
  return composeFloorPlanSlug(city, building);
}
