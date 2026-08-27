export type SeatingCabinPlacement = "before-A" | "after-G";

export type SeatingCabin = {
  id: string;
  label: string;
  placement: SeatingCabinPlacement;
};

export const CABINS_BEFORE_A_ROW: SeatingCabin[] = [
  { id: "cabin-manager-front", label: "Manager", placement: "before-A" },
  { id: "cabin-cfo", label: "CFO", placement: "before-A" },
  { id: "cabin-hr-team", label: "HR team", placement: "before-A" },
];

export const CABINS_AFTER_G_ROW: SeatingCabin[] = [
  { id: "cabin-hr-manager", label: "HR Manager", placement: "after-G" },
  { id: "cabin-manager-back", label: "Manager", placement: "after-G" },
  { id: "cabin-conference", label: "Conference room", placement: "after-G" },
];

export function cabinsForPlacement(placement: SeatingCabinPlacement): SeatingCabin[] {
  return placement === "before-A" ? CABINS_BEFORE_A_ROW : CABINS_AFTER_G_ROW;
}
