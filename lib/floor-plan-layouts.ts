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
  /**
   * D-row mirrors B-row exactly (same width / alignment).
   */
  {
    key: "D",
    label: "D-ROW",
    seatCount: 20,
    floorKey: "2",
    top: [
      rowLabel("D-ROW (20)"),
      ...seatIds("D", 1, 5),
      pillar(),
      ...seatIds("D", 6, 10),
    ],
    bottom: [
      rowLabel(""),
      ...seatIds("D", 20, 16, -1),
      pillar(),
      ...seatIds("D", 15, 11, -1),
    ],
  },
];

const CHENNAI_CABINS = {
  beforeA: CABINS_BEFORE_A_ROW.map((c) => ({ ...c })),
  afterG: CABINS_AFTER_G_ROW.map((c) => ({ ...c })),
  sideCabins: {
    ...DEFAULT_SIDE_CABINS,
    manager: "Project Manager",
  },
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

/** Bangalore: CFO / HR Team on top; Conference + CEO below; Project Manager on side. */
export const BANGALORE_CABINS = {
  beforeA: [
    {
      id: "bangalore-cabin-cfo",
      label: "CFO Room",
      placement: "before-A" as const,
    },
    {
      id: "bangalore-cabin-hr-team",
      label: "HR Team",
      placement: "before-A" as const,
    },
  ],
  afterG: [
    {
      id: "bangalore-cabin-conference",
      label: "Conference",
      placement: "after-G" as const,
    },
    {
      id: "bangalore-cabin-ceo",
      label: "CEO Room",
      placement: "after-G" as const,
    },
  ],
  sideCabins: {
    hrManager: "HR Manager",
    manager: "Project Manager",
    hrManagerId: "bangalore-side-hr-manager",
    managerId: "bangalore-side-project-manager",
  },
};

/** Pernambut: equal Manager/HR above A1–A8; HR Manager/Manager below C; Conference on the side. */
export const PERNAMBUT_CABINS = {
  beforeA: [
    { id: "pernambut-cabin-manager", label: "Manager", placement: "before-A" as const },
    { id: "pernambut-cabin-hr", label: "HR", placement: "before-A" as const },
  ],
  afterG: [
    {
      id: "pernambut-cabin-hr-manager",
      label: "HR Manager",
      placement: "after-G" as const,
    },
    {
      id: "pernambut-cabin-manager-back",
      label: "Manager",
      placement: "after-G" as const,
    },
  ],
  sideCabins: {
    hrManager: "Conference",
    manager: "Sales Team",
    hrManagerId: "pernambut-side-conference",
    managerId: "pernambut-side-sales",
    equalHeights: true,
  },
};

/** Canonical cabin layouts for seeded offices (overrides stale DB copies). */
export function catalogCabinsForSlug(slug: string): FloorPlanDocument["cabins"] | null {
  const key = normalizeOfficeSlug(slug);
  if (key === "pernambut") return PERNAMBUT_CABINS;
  if (key === "bangalore") return BANGALORE_CABINS;
  if (key === CHENNAI_BLOCK_A_SLUG) return CHENNAI_CABINS;
  if (key === CHENNAI_BLOCK_B_SLUG) return cloneChennaiCabins("chennai-b");
  return null;
}

/** Canonical row layouts for seeded offices (fixes stale D-row / entrance geometry). */
export function catalogRowsForSlug(slug: string): SeatingRowConfig[] | null {
  const key = normalizeOfficeSlug(slug);
  if (key === "bangalore") {
    return BANGALORE_ROWS.map((row) => ({
      ...row,
      top: [...row.top],
      bottom: [...row.bottom],
    }));
  }
  if (key === "pernambut") {
    return PERNAMBUT_ROWS.map((row) => ({
      ...row,
      top: [...row.top],
      bottom: [...row.bottom],
    }));
  }
  return null;
}

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
      name: "Pernambut",
      city: "Pernambut",
      building: "Main Office",
      floors: [{ key: "1", label: "Ground Floor" }],
      rows: pernambutRows,
      seatIds: seatIdsFromRows(pernambutRows),
      cabins: PERNAMBUT_CABINS,
      isActive: true,
      sortOrder: 2,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      slug: "bangalore",
      name: "Bangalore",
      city: "Bangalore",
      building: "Tech Park 1",
      floors: [
        { key: "1", label: "Floor 1" },
        { key: "2", label: "Floor 2" },
      ],
      rows: bangaloreRows,
      seatIds: seatIdsFromRows(bangaloreRows),
      cabins: BANGALORE_CABINS,
      isActive: true,
      sortOrder: 3,
      source: "seed",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}
