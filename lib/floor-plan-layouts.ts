import {
  CABINS_AFTER_G_ROW,
  CABINS_BEFORE_A_ROW,
  type SeatingCabin,
} from "@/lib/seating-cabins";
import { SEATING_ROWS, type FloorCell, type SeatingRowConfig } from "@/lib/seating-layout";
import { DEFAULT_SIDE_CABINS } from "@/lib/seating-layout-editor-snapshot";
import type { FloorPlanDocument } from "@/models/floor-plan.model";

export const DEFAULT_OFFICE_SLUG = "chennai";
export const CHENNAI_BLOCK_A_SLUG = "chennai";
export const CHENNAI_BLOCK_B_SLUG = "chennai-block-b";

export function normalizeOfficeSlug(slug?: string | null): string {
  const value = (slug ?? "").trim().toLowerCase();
  return value || DEFAULT_OFFICE_SLUG;
}

export function isChennaiOfficeSlug(slug?: string | null): boolean {
  const value = normalizeOfficeSlug(slug);
  return value === CHENNAI_BLOCK_A_SLUG || value === CHENNAI_BLOCK_B_SLUG;
}

function seatIds(prefix: string, from: number, to: number, step = 1): FloorCell[] {
  const cells: FloorCell[] = [];
  if (step > 0) {
    for (let i = from; i <= to; i++) cells.push({ kind: "seat", id: `${prefix}${i}` });
  } else {
    for (let i = from; i >= to; i += step) cells.push({ kind: "seat", id: `${prefix}${i}` });
  }
  return cells;
}

function rowLabel(text: string): FloorCell {
  return { kind: "label", text };
}

const pillar = (): FloorCell => ({ kind: "pillar" });
const gap = (): FloorCell => ({ kind: "gap" });

export function seatIdsFromRows(rows: SeatingRowConfig[]): string[] {
  return rows.flatMap((row) =>
    [...row.top, ...row.bottom]
      .filter((c): c is Extract<FloorCell, { kind: "seat" }> => c.kind === "seat")
      .map((c) => c.id),
  );
}

/** Smaller Pernambut branch layout */
export const PERNAMBUT_ROWS: SeatingRowConfig[] = [
  {
    key: "A",
    label: "A-ROW",
    seatCount: 16,
    floorKey: "1",
    top: [rowLabel("A-ROW (16)"), ...seatIds("A", 1, 8)],
    bottom: [rowLabel(""), ...seatIds("A", 9, 16)],
  },
  {
    key: "B",
    label: "B-ROW",
    seatCount: 12,
    floorKey: "1",
    top: [
      rowLabel("B-ROW (12)"),
      ...seatIds("B", 1, 3),
      pillar(),
      ...seatIds("B", 4, 6),
    ],
    bottom: [
      rowLabel(""),
      ...seatIds("B", 12, 10, -1),
      pillar(),
      ...seatIds("B", 9, 7, -1),
    ],
  },
  {
    key: "C",
    label: "C-ROW",
    seatCount: 16,
    floorKey: "1",
    top: [rowLabel("C-ROW (16)"), ...seatIds("C", 1, 8)],
    bottom: [rowLabel(""), ...seatIds("C", 16, 9, -1)],
  },
];

/** Bangalore branch layout */
export const BANGALORE_ROWS: SeatingRowConfig[] = [
  {
    key: "A",
    label: "A-ROW",
    seatCount: 24,
    floorKey: "1",
    top: [rowLabel("A-ROW (24)"), ...seatIds("A", 1, 12)],
    bottom: [rowLabel(""), ...seatIds("A", 13, 24)],
  },
  {
    key: "B",
    label: "B-ROW",
    seatCount: 20,
    floorKey: "1",
    top: [
      rowLabel("B-ROW (20)"),
      ...seatIds("B", 1, 5),
      pillar(),
      ...seatIds("B", 6, 10),
    ],
    bottom: [
      rowLabel(""),
      ...seatIds("B", 20, 16, -1),
      pillar(),
      ...seatIds("B", 15, 11, -1),
    ],
  },
  {
    key: "C",
    label: "C-ROW",
    seatCount: 24,
    floorKey: "2",
    top: [rowLabel("C-ROW (24)"), ...seatIds("C", 1, 12)],
    bottom: [rowLabel(""), ...seatIds("C", 24, 13, -1)],
  },
  {
    key: "D",
    label: "D-ROW",
    seatCount: 14,
    floorKey: "2",
    top: [
      rowLabel("D-ROW (14)"),
      { kind: "entrance", text: "*** ENTRANCE ***" },
      pillar(),
      ...seatIds("D", 1, 4),
      pillar(),
      ...seatIds("D", 5, 7),
    ],
    bottom: [
      rowLabel(""),
      gap(),
      pillar(),
      ...seatIds("D", 14, 11, -1),
      pillar(),
      ...seatIds("D", 10, 8, -1),
    ],
  },
];

const CHENNAI_CABINS = {
  beforeA: CABINS_BEFORE_A_ROW.map((c) => ({ ...c })),
  afterG: CABINS_AFTER_G_ROW.map((c) => ({ ...c })),
  sideCabins: { ...DEFAULT_SIDE_CABINS },
};

function cloneChennaiCabins(prefix: string) {
  return {
    beforeA: CABINS_BEFORE_A_ROW.map((c) => ({
      ...c,
      id: `${prefix}-${c.id}`,
    })),
    afterG: CABINS_AFTER_G_ROW.map((c) => ({
      ...c,
      id: `${prefix}-${c.id}`,
    })),
    sideCabins: { ...DEFAULT_SIDE_CABINS },
  };
}

function cloneChennaiRows() {
  return SEATING_ROWS.map((row) => ({
    ...row,
    floorKey: row.key === "G" ? "3" : ["A", "B", "C"].includes(row.key) ? "2" : "1",
    top: [...row.top],
    bottom: [...row.bottom],
  }));
}

const SIMPLE_CABINS = (prefix: string): {
  beforeA: SeatingCabin[];
  afterG: SeatingCabin[];
  sideCabins: { hrManager: string; manager: string };
} => ({
  beforeA: [
    { id: `${prefix}-cabin-manager`, label: "Manager", placement: "before-A" },
    { id: `${prefix}-cabin-hr`, label: "HR", placement: "before-A" },
  ],
  afterG: [
    { id: `${prefix}-cabin-conference`, label: "Conference", placement: "after-G" },
  ],
  sideCabins: { hrManager: "HR Manager", manager: "Manager" },
});

export type FloorPlanSeed = Omit<FloorPlanDocument, "_id">;

export function buildFloorPlanSeeds(): FloorPlanSeed[] {
  const chennaiBlockARows = cloneChennaiRows();
  const chennaiBlockBRows = cloneChennaiRows();
  const pernambutRows = PERNAMBUT_ROWS.map((row) => ({
    ...row,
    top: [...row.top],
    bottom: [...row.bottom],
  }));
  const bangaloreRows = BANGALORE_ROWS.map((row) => ({
    ...row,
    top: [...row.top],
    bottom: [...row.bottom],
  }));

  const chennaiFloors = [
    { key: "1", label: "Floor 1" },
    { key: "2", label: "Floor 2" },
    { key: "3", label: "Floor 3" },
  ];

  return [
    {
      slug: CHENNAI_BLOCK_A_SLUG,
      name: "Chennai · Block A",
      city: "Chennai",
      building: "Block A",
      floors: chennaiFloors,
      rows: chennaiBlockARows,
      seatIds: seatIdsFromRows(chennaiBlockARows),
      cabins: CHENNAI_CABINS,
      isActive: true,
      sortOrder: 0,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      slug: CHENNAI_BLOCK_B_SLUG,
      name: "Chennai · Block B",
      city: "Chennai",
      building: "Block B",
      floors: chennaiFloors.map((f) => ({ ...f })),
      rows: chennaiBlockBRows,
      seatIds: seatIdsFromRows(chennaiBlockBRows),
      cabins: cloneChennaiCabins("chennai-b"),
      isActive: true,
      sortOrder: 1,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      slug: "pernambut",
      name: "Pernambut · Block A",
      city: "Pernambut",
      building: "Block A",
      floors: [{ key: "1", label: "Ground Floor" }],
      rows: pernambutRows,
      seatIds: seatIdsFromRows(pernambutRows),
      cabins: SIMPLE_CABINS("pernambut"),
      isActive: true,
      sortOrder: 2,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      slug: "bangalore",
      name: "Bangalore · Block A",
      city: "Bangalore",
      building: "Block A",
      floors: [
        { key: "1", label: "Floor 1" },
        { key: "2", label: "Floor 2" },
      ],
      rows: bangaloreRows,
      seatIds: seatIdsFromRows(bangaloreRows),
      cabins: SIMPLE_CABINS("bangalore"),
      isActive: true,
      sortOrder: 3,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}
