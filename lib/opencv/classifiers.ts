import type { LayoutObjectType } from "@/lib/opencv-types/layout";

export interface ContourFeatures {
  area: number;
  perimeter: number;
  aspectRatio: number;
  extent: number;
  circularity: number;
  vertices: number;
  width: number;
  height: number;
  colorVariance: number;
  isColored: boolean;
  relativeArea: number;
}

export function computeCircularity(area: number, perimeter: number): number {
  if (perimeter <= 0) return 0;
  return (4 * Math.PI * area) / (perimeter * perimeter);
}

/** True for rectangular desk/table shapes common on line-drawn floor plans. */
export function isDeskLikeShape(features: ContourFeatures): boolean {
  const { relativeArea, aspectRatio, extent, vertices } = features;
  return (
    relativeArea >= 0.001 &&
    relativeArea <= 0.045 &&
    aspectRatio >= 0.35 &&
    aspectRatio <= 2.8 &&
    extent >= 0.52 &&
    vertices >= 4 &&
    vertices <= 12
  );
}

/** True for the outer room boundary contour. */
export function isRoomOutline(features: ContourFeatures): boolean {
  const { relativeArea, extent, vertices } = features;
  return (
    relativeArea >= 0.12 &&
    relativeArea <= 0.92 &&
    extent >= 0.45 &&
    vertices >= 4 &&
    vertices <= 16
  );
}

export function classifyContour(
  features: ContourFeatures,
  isLineLike: boolean,
): { type: LayoutObjectType; confidence: number } | null {
  const {
    relativeArea,
    aspectRatio,
    circularity,
    vertices,
    width,
    height,
    isColored,
    colorVariance,
    extent,
  } = features;

  if (isLineLike && (width > height * 4 || height > width * 4)) {
    return { type: "wall", confidence: 0.72 };
  }

  if (isRoomOutline(features)) {
    return {
      type: relativeArea > 0.35 ? "room" : "cabin",
      confidence: 0.85,
    };
  }

  if (isDeskLikeShape(features)) {
    return { type: "table", confidence: 0.8 };
  }

  if (
    relativeArea >= 0.002 &&
    relativeArea <= 0.06 &&
    vertices >= 4 &&
    vertices <= 6 &&
    aspectRatio >= 0.4 &&
    aspectRatio <= 2.5
  ) {
    return { type: "table", confidence: 0.68 };
  }

  if (
    relativeArea >= 0.00005 &&
    relativeArea <= 0.006 &&
    (circularity > 0.65 || (vertices >= 4 && vertices <= 6 && extent > 0.7))
  ) {
    return { type: "seat", confidence: 0.62 };
  }

  if (
    relativeArea >= 0.0002 &&
    relativeArea <= 0.015 &&
    aspectRatio >= 0.15 &&
    aspectRatio <= 0.85 &&
    vertices >= 4 &&
    vertices <= 8
  ) {
    return { type: "door", confidence: 0.58 };
  }

  if (
    relativeArea >= 0.00001 &&
    relativeArea <= 0.003 &&
    aspectRatio >= 1.8 &&
    aspectRatio <= 12 &&
    height < width
  ) {
    return { type: "text_label", confidence: 0.55 };
  }

  if (isColored && colorVariance > 25 && relativeArea >= 0.0005 && relativeArea <= 0.05) {
    if (relativeArea > 0.008) {
      return { type: "logo", confidence: 0.6 };
    }
    return { type: "decoration", confidence: 0.52 };
  }

  if (
    relativeArea >= 0.0003 &&
    relativeArea <= 0.02 &&
    isColored &&
    circularity < 0.5
  ) {
    return { type: "decoration", confidence: 0.48 };
  }

  return null;
}
