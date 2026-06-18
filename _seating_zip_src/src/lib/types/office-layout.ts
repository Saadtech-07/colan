import type { BoundingBox, Point2D } from "@/lib/types/layout";

/** Integration schema for employee management apps. */
export const OFFICE_LAYOUT_VERSION = "1.0.0";

export type ZoneType = "open_office" | "meeting_room" | "cabin" | "common";

export interface OfficeZone {
  id: string;
  label: string;
  type: ZoneType;
  bounds: BoundingBox;
  polygon?: Point2D[];
  deskIds: string[];
  seatIds: string[];
}

export interface OfficeDesk {
  id: string;
  label: string;
  bounds: BoundingBox;
  polygon?: Point2D[];
  zoneId?: string;
  seatIds: string[];
  assignable: boolean;
  confidence: number;
}

export interface OfficeSeat {
  id: string;
  label: string;
  position: Point2D;
  bounds: BoundingBox;
  deskId?: string;
  zoneId?: string;
  assignable: boolean;
  employeeId?: string | null;
  confidence: number;
}

export interface OfficeWall {
  id: string;
  start: Point2D;
  end: Point2D;
  confidence: number;
}

export interface OfficeDoor {
  id: string;
  bounds: BoundingBox;
  zoneId?: string;
  confidence: number;
}

export interface OfficeLayout {
  version: string;
  id: string;
  name: string;
  analyzedAt: string;
  source: {
    width: number;
    height: number;
    filename?: string;
  };
  zones: OfficeZone[];
  desks: OfficeDesk[];
  seats: OfficeSeat[];
  walls: OfficeWall[];
  doors: OfficeDoor[];
  stats: {
    totalSeats: number;
    assignableSeats: number;
    totalDesks: number;
    zones: number;
  };
}

export const ZONE_COLORS: Record<ZoneType, string> = {
  open_office: "#dbeafe",
  meeting_room: "#d1fae5",
  cabin: "#ccfbf1",
  common: "#f3e8f6",
};

export const DESK_COLOR = "#6366f1";
export const SEAT_COLOR = "#3b82f6";
export const WALL_COLOR = "#1f2937";
export const DOOR_COLOR = "#f59e0b";
