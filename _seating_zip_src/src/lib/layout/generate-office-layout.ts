import { v4 as uuidv4 } from "uuid";
import type {
  OfficeDesk,
  OfficeDoor,
  OfficeLayout,
  OfficeSeat,
  OfficeWall,
  OfficeZone,
  ZoneType,
} from "@/lib/types/office-layout";
import { OFFICE_LAYOUT_VERSION } from "@/lib/types/office-layout";
import type {
  BoundingBox,
  LayoutAnalysisResult,
  LayoutObject,
  Point2D,
} from "@/lib/types/layout";

function bboxCenter(box: BoundingBox): Point2D {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function pointInBox(point: Point2D, box: BoundingBox, padding = 0): boolean {
  return (
    point.x >= box.x - padding &&
    point.x <= box.x + box.width + padding &&
    point.y >= box.y - padding &&
    point.y <= box.y + box.height + padding
  );
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function zoneTypeFromObject(type: LayoutObject["type"]): ZoneType {
  if (type === "cabin") return "cabin";
  if (type === "room") return "meeting_room";
  return "open_office";
}

function findContainingZone(
  point: Point2D,
  zones: OfficeZone[],
): OfficeZone | undefined {
  let best: OfficeZone | undefined;
  let bestArea = Infinity;

  for (const zone of zones) {
    if (!pointInBox(point, zone.bounds, 4)) continue;
    const area = zone.bounds.width * zone.bounds.height;
    if (area < bestArea) {
      bestArea = area;
      best = zone;
    }
  }

  return best;
}

function nearestDesk(
  point: Point2D,
  desks: OfficeDesk[],
  maxDistance: number,
): OfficeDesk | undefined {
  let best: OfficeDesk | undefined;
  let bestDist = maxDistance;

  for (const desk of desks) {
    const dist = distance(point, bboxCenter(desk.bounds));
    if (dist < bestDist) {
      bestDist = dist;
      best = desk;
    }
  }

  return best;
}

function sortByPosition(objects: LayoutObject[]): LayoutObject[] {
  return [...objects].sort((a, b) => {
    const rowA = Math.round(a.bbox.y / 40);
    const rowB = Math.round(b.bbox.y / 40);
    if (rowA !== rowB) return rowA - rowB;
    return a.bbox.x - b.bbox.x;
  });
}

function boxesNearlyEqual(a: BoundingBox, b: BoundingBox): boolean {
  return overlapRatio(a, b) > 0.75;
}

export function generateOfficeLayout(
  analysis: LayoutAnalysisResult,
  options?: { name?: string },
): OfficeLayout {
  const layoutId = uuidv4();
  const name =
    options?.name ??
    analysis.image.filename?.replace(/\.[^.]+$/, "") ??
    "Office Layout";

  const roomObjects = analysis.objects.filter(
    (o) => o.type === "room" || o.type === "cabin",
  );
  const tableObjects = sortByPosition(
    analysis.objects.filter((o) => o.type === "table"),
  );
  const seatObjects = analysis.objects.filter((o) => o.type === "seat");
  const wallObjects = analysis.objects.filter((o) => o.type === "wall");
  const doorObjects = analysis.objects.filter((o) => o.type === "door");

  const zones: OfficeZone[] = roomObjects.map((obj, index) => ({
    id: `zone-${index + 1}`,
    label: obj.type === "cabin" ? `Cabin ${index + 1}` : `Room ${index + 1}`,
    type: zoneTypeFromObject(obj.type),
    bounds: { ...obj.bbox },
    polygon: obj.polygon,
    deskIds: [],
    seatIds: [],
  }));

  const desks: OfficeDesk[] = [];
  const seats: OfficeSeat[] = [];
  const usedSeatIndices = new Set<number>();

  tableObjects.forEach((obj, index) => {
    const deskId = `desk-${index + 1}`;
    const desk: OfficeDesk = {
      id: deskId,
      label: `Desk ${index + 1}`,
      bounds: { ...obj.bbox },
      polygon: obj.polygon,
      seatIds: [],
      assignable: true,
      confidence: obj.confidence,
    };

    const matchedSeatIdx = seatObjects.findIndex(
      (s, i) => !usedSeatIndices.has(i) && boxesNearlyEqual(s.bbox, obj.bbox),
    );

    if (matchedSeatIdx >= 0) {
      usedSeatIndices.add(matchedSeatIdx);
      const seatObj = seatObjects[matchedSeatIdx];
      const center = bboxCenter(seatObj.bbox);
      const zone = findContainingZone(center, zones);
      const seat: OfficeSeat = {
        id: `seat-${index + 1}`,
        label: `Seat ${index + 1}`,
        position: center,
        bounds: { ...seatObj.bbox },
        deskId,
        zoneId: zone?.id,
        assignable: true,
        employeeId: null,
        confidence: seatObj.confidence,
      };
      desk.seatIds.push(seat.id);
      desk.zoneId = zone?.id;
      seats.push(seat);
      if (zone) zone.seatIds.push(seat.id);
    } else {
      const center = bboxCenter(obj.bbox);
      const zone = findContainingZone(center, zones);
      const seat: OfficeSeat = {
        id: `seat-${index + 1}`,
        label: `Seat ${index + 1}`,
        position: center,
        bounds: { ...obj.bbox },
        deskId,
        zoneId: zone?.id,
        assignable: true,
        employeeId: null,
        confidence: obj.confidence,
      };
      desk.seatIds.push(seat.id);
      desk.zoneId = zone?.id;
      seats.push(seat);
      if (zone) zone.seatIds.push(seat.id);
    }

    desks.push(desk);
    const zone = zones.find((z) => z.id === desk.zoneId);
    if (zone) zone.deskIds.push(desk.id);
  });

  const imageDiag = Math.hypot(analysis.image.width, analysis.image.height);
  const seatLinkDistance = imageDiag * 0.06;

  seatObjects.forEach((obj, index) => {
    if (usedSeatIndices.has(index)) return;

    const center = bboxCenter(obj.bbox);
    const overlapsDesk = desks.some((d) => boxesNearlyEqual(d.bounds, obj.bbox));
    if (overlapsDesk) return;

    const zone = findContainingZone(center, zones);
    const desk = nearestDesk(center, desks, seatLinkDistance);
    const seatId = `seat-${seats.length + 1}`;

    const seat: OfficeSeat = {
      id: seatId,
      label: `Seat ${seats.length + 1}`,
      position: center,
      bounds: { ...obj.bbox },
      deskId: desk?.id,
      zoneId: zone?.id,
      assignable: true,
      employeeId: null,
      confidence: obj.confidence,
    };

    if (desk) {
      desk.seatIds.push(seat.id);
    } else {
      const deskIndex = desks.length + 1;
      const newDesk: OfficeDesk = {
        id: `desk-${deskIndex}`,
        label: `Desk ${deskIndex}`,
        bounds: { ...obj.bbox },
        seatIds: [seat.id],
        zoneId: zone?.id,
        assignable: true,
        confidence: obj.confidence,
      };
      desks.push(newDesk);
      seat.deskId = newDesk.id;
      if (zone) zone.deskIds.push(newDesk.id);
    }

    if (zone) zone.seatIds.push(seat.id);
    seats.push(seat);
  });

  for (const desk of desks) {
    if (desk.zoneId) continue;
    const center = bboxCenter(desk.bounds);
    const zone = findContainingZone(center, zones);
    if (zone) {
      desk.zoneId = zone.id;
      if (!zone.deskIds.includes(desk.id)) zone.deskIds.push(desk.id);
    }
  }

  const walls: OfficeWall[] = wallObjects.map((obj, index) => {
    const [start, end] =
      obj.polygon && obj.polygon.length >= 2
        ? [obj.polygon[0], obj.polygon[1]]
        : [
            { x: obj.bbox.x, y: obj.bbox.y },
            {
              x: obj.bbox.x + obj.bbox.width,
              y: obj.bbox.y + obj.bbox.height,
            },
          ];

    return {
      id: `wall-${index + 1}`,
      start,
      end,
      confidence: obj.confidence,
    };
  });

  const doors: OfficeDoor[] = doorObjects.map((obj, index) => {
    const center = bboxCenter(obj.bbox);
    const zone = findContainingZone(center, zones);

    return {
      id: `door-${index + 1}`,
      bounds: { ...obj.bbox },
      zoneId: zone?.id,
      confidence: obj.confidence,
    };
  });

  return {
    version: OFFICE_LAYOUT_VERSION,
    id: layoutId,
    name,
    analyzedAt: new Date().toISOString(),
    source: {
      width: analysis.image.width,
      height: analysis.image.height,
      filename: analysis.image.filename,
    },
    zones,
    desks,
    seats,
    walls,
    doors,
    stats: {
      totalSeats: seats.length,
      assignableSeats: seats.filter((s) => s.assignable).length,
      totalDesks: desks.length,
      zones: zones.length,
    },
  };
}

export function toEmployeeAppPayload(layout: OfficeLayout) {
  return {
    layoutId: layout.id,
    layoutName: layout.name,
    version: layout.version,
    analyzedAt: layout.analyzedAt,
    floorPlan: {
      width: layout.source.width,
      height: layout.source.height,
      filename: layout.source.filename,
    },
    assignableSeats: layout.seats
      .filter((s) => s.assignable)
      .map((s) => ({
        seatId: s.id,
        label: s.label,
        deskId: s.deskId ?? null,
        zoneId: s.zoneId ?? null,
        position: s.position,
        bounds: s.bounds,
        employeeId: s.employeeId ?? null,
      })),
    desks: layout.desks.map((d) => ({
      deskId: d.id,
      label: d.label,
      zoneId: d.zoneId ?? null,
      bounds: d.bounds,
      seatIds: d.seatIds,
      assignable: d.assignable,
    })),
    zones: layout.zones.map((z) => ({
      zoneId: z.id,
      label: z.label,
      type: z.type,
      bounds: z.bounds,
      deskIds: z.deskIds,
      seatIds: z.seatIds,
    })),
    walls: layout.walls,
    doors: layout.doors,
    stats: layout.stats,
  };
}

export function downloadLayoutJson(
  layout: OfficeLayout,
  format: "full" | "employee-app" = "employee-app",
) {
  const payload =
    format === "employee-app" ? toEmployeeAppPayload(layout) : layout;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${layout.name.replace(/\s+/g, "-").toLowerCase()}-layout.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
