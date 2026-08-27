export type LayoutObjectType =
  | "seat"
  | "table"
  | "room"
  | "cabin"
  | "wall"
  | "door"
  | "text_label"
  | "logo"
  | "decoration";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface LayoutObject {
  id: string;
  type: LayoutObjectType;
  bbox: BoundingBox;
  confidence: number;
  polygon?: Point2D[];
  metadata?: Record<string, unknown>;
}

export interface LayoutAnalysisResult {
  version: string;
  image: {
    width: number;
    height: number;
    filename?: string;
  };
  objects: LayoutObject[];
  processing: {
    durationMs: number;
    method: string;
    steps: string[];
  };
}

export const OBJECT_COLORS: Record<LayoutObjectType, string> = {
  seat: "#3b82f6",
  table: "#8b5cf6",
  room: "#10b981",
  cabin: "#059669",
  wall: "#374151",
  door: "#f59e0b",
  text_label: "#ec4899",
  logo: "#ef4444",
  decoration: "#06b6d4",
};

export const OBJECT_LABELS: Record<LayoutObjectType, string> = {
  seat: "Seat",
  table: "Table",
  room: "Room",
  cabin: "Cabin",
  wall: "Wall",
  door: "Door",
  text_label: "Text Label",
  logo: "Logo",
  decoration: "Decoration",
};
