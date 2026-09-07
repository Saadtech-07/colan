import type { EmployeeDirectoryInfo } from "@/types";

type EmployeeAddressFields = {
  currentAddress: string;
  permanentAddress: string;
};

/** Fields persisted on `employee_details` (legacy location/fullAddress excluded). */
export type EmployeeDetailsAddressFields = {
  personalEmail?: string;
  workEmail?: string;
  phone?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
};

export const LEGACY_EMPLOYEE_DIRECTORY_UNSET = {
  "directory.location": "",
  "directory.fullAddress": "",
} as const;

export const LEGACY_EMPLOYEE_DETAILS_UNSET = {
  location: "",
  fullAddress: "",
} as const;

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
  };
}

/** Normalize directory/contact fields for `employee_details` writes. */
export function employeeDetailsFieldsFromDirectory(
  directory: Partial<EmployeeDirectoryInfo>,
): EmployeeDetailsAddressFields {
  const { currentAddress, permanentAddress } = addressesFromDirectory(directory);

  return {
    personalEmail: directory.personalEmail?.trim() || undefined,
    workEmail: directory.workEmail?.trim() || undefined,
    phone: directory.phone?.trim() || undefined,
    currentAddress: currentAddress || undefined,
    permanentAddress: permanentAddress || undefined,
    joinedDate: directory.joinedDate?.trim() || undefined,
  };
}
