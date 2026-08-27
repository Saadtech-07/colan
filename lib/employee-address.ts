import type { EmployeeDirectoryInfo } from "@/types";

type EmployeeAddressFields = {
  currentAddress: string;
  permanentAddress: string;
};

/** Map legacy `location` / `fullAddress` into current address when loading older records. */
export function addressesFromDirectory(
  directory?: Partial<EmployeeDirectoryInfo> | null,
): EmployeeAddressFields {
  const legacy =
    directory?.currentAddress?.trim() ||
    directory?.fullAddress?.trim() ||
    directory?.location?.trim() ||
    "";
  return {
    currentAddress: legacy,
    permanentAddress: directory?.permanentAddress?.trim() ?? "",
  };
}

export function directoryPatchFromAddresses(
  fields: EmployeeAddressFields,
  extras?: Partial<EmployeeDirectoryInfo>,
): Partial<EmployeeDirectoryInfo> {
  const currentAddress = fields.currentAddress.trim();
  const permanentAddress = fields.permanentAddress.trim();

  return {
    ...extras,
    currentAddress: currentAddress || undefined,
    permanentAddress: permanentAddress || undefined,
    location: currentAddress || undefined,
  };
}
