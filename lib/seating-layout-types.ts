export type SeatStatus = "empty" | "occupied" | "reserved" | "disabled";

export interface GeneratedSeat {
  id: string;
  label: string;
  row: number;
  col: number;
  x: number;
  y: number;
  status: SeatStatus;
  employeeId?: string;
  employeeName?: string;
  employeeDept?: string;
}

export interface GeneratedPillar {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface GeneratedWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GeneratedRoom {
  width: number;
  height: number;
  label?: string;
}

export interface GeneratedSeatGroup {
  id: string;
  name: string;
  seatIds: string[];
  color: string;
}

export interface GeneratedSeatingLayout {
  id: string;
  name: string;
  prompt: string;
  room: GeneratedRoom;
  seats: GeneratedSeat[];
  pillars: GeneratedPillar[];
  walls: GeneratedWall[];
  groups?: GeneratedSeatGroup[];
  createdAt: string;
}

export interface AILayoutSchema {
  name: string;
  description: string;
  room: {
    width: number;
    height: number;
  };
  seats: Array<{
    id: string;
    label: string;
    row: number;
    col: number;
    x: number;
    y: number;
  }>;
  pillars: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }>;
  walls: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    seatIds: string[];
    color: string;
  }>;
}
