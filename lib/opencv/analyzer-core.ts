import { v4 as uuidv4 } from "uuid";
import type { Mat } from "@techstark/opencv-js";
import {
  classifyContour,
  computeCircularity,
  isDeskLikeShape,
  isRoomOutline,
  type ContourFeatures,
} from "@/lib/opencv/classifiers";
import {
  decodeAndResize,
  quickColorSample,
  toGrayscale,
  type CV,
} from "@/lib/opencv/mat-utils";
import type {
  BoundingBox,
  LayoutAnalysisResult,
  LayoutObject,
  Point2D,
} from "@/lib/opencv-types/layout";

const ANALYSIS_VERSION = "1.1.0";
const MIN_CONTOUR_AREA_RATIO = 0.00008;
const MAX_CONTOURS = 800;

function bboxFromRect(x: number, y: number, w: number, h: number): BoundingBox {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(w),
    height: Math.round(h),
  };
}

function overlapRatio(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const intersection = (x2 - x1) * (y2 - y1);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersection / minArea : 0;
}

function dedupeObjects(objects: LayoutObject[]): LayoutObject[] {
  const sorted = [...objects].sort((a, b) => b.confidence - a.confidence);
  const kept: LayoutObject[] = [];

  for (const obj of sorted) {
    const duplicate = kept.some(
      (existing) =>
        existing.type === obj.type && overlapRatio(existing.bbox, obj.bbox) > 0.55,
    );
    if (!duplicate) kept.push(obj);
  }

  return kept;
}

function scaleBox(box: BoundingBox, factor: number): BoundingBox {
  return {
    x: Math.round(box.x * factor),
    y: Math.round(box.y * factor),
    width: Math.round(box.width * factor),
    height: Math.round(box.height * factor),
  };
}

function scalePoint(point: Point2D, factor: number): Point2D {
  return { x: Math.round(point.x * factor), y: Math.round(point.y * factor) };
}

function extractPolygon(approx: Mat): Point2D[] {
  const polygon: Point2D[] = [];
  for (let p = 0; p < approx.rows; p++) {
    polygon.push({
      x: approx.data32S[p * 2],
      y: approx.data32S[p * 2 + 1],
    });
  }
  return polygon;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clusterDeskAreas(areas: number[]): { median: number; tolerance: number } | null {
  if (areas.length < 2) return null;
  const med = median(areas);
  if (med <= 0) return null;
  return { median: med, tolerance: med * 0.75 };
}

function wallsFromRoomPolygon(polygon: Point2D[]): LayoutObject[] {
  if (polygon.length < 4) return [];

  const walls: LayoutObject[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 20) continue;

    walls.push({
      id: uuidv4(),
      type: "wall",
      bbox: bboxFromRect(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.max(Math.abs(dx), 4),
        Math.max(Math.abs(dy), 4),
      ),
      confidence: 0.9,
      polygon: [start, end],
      metadata: { length: Math.round(length), source: "room-outline" },
    });
  }

  return walls;
}

function fallbackRoomBounds(
  width: number,
  height: number,
  objects: LayoutObject[],
): BoundingBox {
  const desks = objects.filter((o) => o.type === "table" || o.type === "seat");
  if (desks.length === 0) {
    const margin = Math.round(Math.min(width, height) * 0.04);
    return {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of desks) {
    minX = Math.min(minX, obj.bbox.x);
    minY = Math.min(minY, obj.bbox.y);
    maxX = Math.max(maxX, obj.bbox.x + obj.bbox.width);
    maxY = Math.max(maxY, obj.bbox.y + obj.bbox.height);
  }

  const padX = Math.round((maxX - minX) * 0.12);
  const padY = Math.round((maxY - minY) * 0.12);

  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: Math.min(width, maxX - minX + padX * 2),
    height: Math.min(height, maxY - minY + padY * 2),
  };
}

export async function analyzeFloorPlanCore(
  cv: CV,
  data: Uint8Array,
  filename?: string,
  onProgress?: (step: string) => void,
): Promise<LayoutAnalysisResult> {
  const start = Date.now();
  const steps: string[] = [];
  const progress = (step: string) => {
    steps.push(step);
    onProgress?.(step);
  };

  const {
    mat: source,
    scale,
    originalWidth,
    originalHeight,
    cleanup: cleanupSource,
  } = await decodeAndResize(cv, data);

  try {
    progress(
      scale < 1
        ? `Downscaled from ${originalWidth}x${originalHeight} to ${source.cols}x${source.rows}`
        : `Image decoded (${source.cols}x${source.rows})`,
    );

    const gray = new cv.Mat();
    toGrayscale(cv, source, gray);

    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

    const binary = new cv.Mat();
    cv.adaptiveThreshold(
      blurred,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      8,
    );
    progress("Applied adaptive threshold for line art");

    const closed = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      closed,
      contours,
      hierarchy,
      cv.RETR_TREE,
      cv.CHAIN_APPROX_SIMPLE,
    );

    const contourCount = contours.size();
    const limit = Math.min(contourCount, MAX_CONTOURS);
    progress(`Found ${contourCount} contours, processing ${limit}`);

    const imageArea = source.cols * source.rows;
    const objects: LayoutObject[] = [];
    const deskCandidates: {
      features: ContourFeatures;
      polygon: Point2D[];
      rect: { x: number; y: number; width: number; height: number };
    }[] = [];
    let roomPolygon: Point2D[] | null = null;
    let roomConfidence = 0;

    for (let i = 0; i < limit; i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      const relativeArea = area / imageArea;

      if (relativeArea < MIN_CONTOUR_AREA_RATIO) {
        contour.delete();
        continue;
      }

      const rect = cv.boundingRect(contour);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

      const aspectRatio =
        rect.height > 0 ? rect.width / rect.height : rect.width;
      const extent =
        rect.width * rect.height > 0 ? area / (rect.width * rect.height) : 0;
      const circularity = computeCircularity(area, perimeter);
      const polygon = extractPolygon(approx);

      const features: ContourFeatures = {
        area,
        perimeter,
        aspectRatio,
        extent,
        circularity,
        vertices: approx.rows,
        width: rect.width,
        height: rect.height,
        colorVariance: 0,
        isColored: false,
        relativeArea,
      };

      if (isRoomOutline(features) && polygon.length >= 4) {
        if (features.relativeArea > roomConfidence) {
          roomConfidence = features.relativeArea;
          roomPolygon = polygon;
        }
      }

      if (isDeskLikeShape(features)) {
        deskCandidates.push({ features, polygon, rect });
      }

      const mightBeColored =
        relativeArea >= 0.0003 && relativeArea <= 0.05 && source.channels() >= 3;
      const color = mightBeColored
        ? quickColorSample(cv, source, rect.x, rect.y, rect.width, rect.height)
        : { isColored: false, colorVariance: 0 };

      const classification = classifyContour(
        {
          ...features,
          colorVariance: color.colorVariance,
          isColored: color.isColored,
        },
        false,
      );

      if (classification && classification.type !== "wall") {
        objects.push({
          id: uuidv4(),
          type: classification.type,
          bbox: bboxFromRect(rect.x, rect.y, rect.width, rect.height),
          confidence: classification.confidence,
          polygon: polygon.length >= 3 ? polygon : undefined,
          metadata: {
            area: Math.round(area),
            vertices: approx.rows,
            circularity: Number(circularity.toFixed(3)),
          },
        });
      }

      approx.delete();
      contour.delete();
    }

    const deskAreas = deskCandidates.map((c) => c.features.area);
    const deskCluster = clusterDeskAreas(deskAreas);

    const clusteredDesks = deskCluster
      ? deskCandidates.filter((c) => {
          const diff = Math.abs(c.features.area - deskCluster.median);
          return diff <= deskCluster.tolerance;
        })
      : deskCandidates;

    if (clusteredDesks.length > 0) {
      progress(
        `Detected ${clusteredDesks.length} workstations${deskCluster ? ` (clustered around area ${Math.round(deskCluster.median)})` : ""}`,
      );

      for (const desk of clusteredDesks) {
        const bbox = bboxFromRect(
          desk.rect.x,
          desk.rect.y,
          desk.rect.width,
          desk.rect.height,
        );

        const exists = objects.some(
          (o) =>
            (o.type === "table" || o.type === "seat") &&
            overlapRatio(o.bbox, bbox) > 0.45,
        );
        if (exists) continue;

        objects.push({
          id: uuidv4(),
          type: "table",
          bbox,
          confidence: 0.88,
          polygon: desk.polygon.length >= 3 ? desk.polygon : undefined,
          metadata: {
            area: Math.round(desk.features.area),
            source: "desk-cluster",
          },
        });

        objects.push({
          id: uuidv4(),
          type: "seat",
          bbox,
          confidence: 0.86,
          polygon: desk.polygon.length >= 3 ? desk.polygon : undefined,
          metadata: {
            area: Math.round(desk.features.area),
            source: "desk-cluster",
          },
        });
      }
    }

    progress("Contour classification complete");

    const withoutWalls = objects.filter((o) => o.type !== "wall");
    let walls: LayoutObject[] = [];

    if (roomPolygon && roomPolygon.length >= 4) {
      walls = wallsFromRoomPolygon(roomPolygon);
      progress(`Room outline detected — ${walls.length} perimeter walls`);
    } else {
      const bounds = fallbackRoomBounds(source.cols, source.rows, withoutWalls);
      const poly = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height },
      ];
      walls = wallsFromRoomPolygon(poly);
      progress(`Inferred room bounds from furniture — ${walls.length} walls`);
    }

    const hasRoom = objects.some((o) => o.type === "room" || o.type === "cabin");
    if (!hasRoom) {
      const roomBounds =
        roomPolygon && roomPolygon.length >= 4
          ? (() => {
              const xs = roomPolygon.map((p) => p.x);
              const ys = roomPolygon.map((p) => p.y);
              return bboxFromRect(
                Math.min(...xs),
                Math.min(...ys),
                Math.max(...xs) - Math.min(...xs),
                Math.max(...ys) - Math.min(...ys),
              );
            })()
          : fallbackRoomBounds(source.cols, source.rows, withoutWalls);

      objects.push({
        id: uuidv4(),
        type: "room",
        bbox: roomBounds,
        confidence: roomPolygon ? 0.88 : 0.75,
        polygon: roomPolygon ?? undefined,
        metadata: { source: roomPolygon ? "outline" : "inferred" },
      });
    }

    gray.delete();
    blurred.delete();
    binary.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();

    const deduped = dedupeObjects([...withoutWalls, ...walls]);
    progress(`Final object count: ${deduped.length}`);

    const scaleFactor = 1 / scale;

    return {
      version: ANALYSIS_VERSION,
      image: {
        width: originalWidth,
        height: originalHeight,
        filename,
      },
      objects: deduped.map((obj) => ({
        ...obj,
        bbox: scale === 1 ? obj.bbox : scaleBox(obj.bbox, scaleFactor),
        polygon: obj.polygon?.map((point) =>
          scale === 1 ? point : scalePoint(point, scaleFactor),
        ),
      })),
      processing: {
        durationMs: Date.now() - start,
        method: "opencv-floor-plan-v2",
        steps,
      },
    };
  } finally {
    cleanupSource();
  }
}
