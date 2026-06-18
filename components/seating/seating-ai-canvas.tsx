"use client";

import * as React from "react";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { Employee } from "@/types";

const SEAT_SIZE = 60;
const SEAT_RADIUS = 8;
const BLOCK_DEPTH = 8;

type BlockColors = {
  top: string;
  front: string;
  side: string;
  stroke: string;
  lineWidth?: number;
};

function drawSeatBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  colors: BlockColors,
  emphasis: "base" | "lifted",
) {
  const lift = emphasis === "lifted" ? 8 : 4;
  const depth = emphasis === "lifted" ? BLOCK_DEPTH + 6 : BLOCK_DEPTH + 3;
  drawExtrudedBlock(ctx, x, y - lift, w, h, depth, radius, colors);
}

function drawExtrudedBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  radius: number,
  colors: BlockColors,
) {
  ctx.fillStyle = "rgba(15,23,42,0.1)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + depth * 0.6, w * 0.42, depth * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.front;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + h - 1, w - 5, depth, Math.min(4, radius));
  ctx.fill();

  ctx.fillStyle = colors.side;
  ctx.beginPath();
  ctx.roundRect(x + w - 4, y + 3, 4, h - 2, 2);
  ctx.fill();

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = colors.lineWidth ?? 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

type Props = {
  layout: GeneratedSeatingLayout;
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  onSeatClick: (seatLabel: string) => void;
};

export function SeatingAiCanvas({
  layout,
  occupancy,
  selectedSeat,
  onSeatClick,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hoveredSeat, setHoveredSeat] = React.useState<string | null>(null);

  const hitTest = React.useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      for (const seat of layout.seats) {
        if (
          x >= seat.x &&
          x <= seat.x + SEAT_SIZE &&
          y >= seat.y &&
          y <= seat.y + SEAT_SIZE
        ) {
          return seat.label;
        }
      }
      return null;
    },
    [layout.seats],
  );

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { room, seats, pillars, walls } = layout;

    ctx.clearRect(0, 0, room.width, room.height);
    const floorGrad = ctx.createLinearGradient(0, 0, 0, room.height);
    floorGrad.addColorStop(0, "#f4f6f8");
    floorGrad.addColorStop(0.55, "#eceff3");
    floorGrad.addColorStop(1, "#e2e6eb");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
    for (let gx = 20; gx < room.width; gx += 40) {
      for (let gy = 20; gy < room.height; gy += 40) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, room.width - 2, room.height - 2);

    walls.forEach((wall) => {
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });

    pillars.forEach((pillar) => {
      const px = Math.round(pillar.x);
      const py = Math.round(pillar.y);
      const pw = Math.round(pillar.width);
      const ph = Math.round(pillar.height);
      const isStage = pillar.label?.toUpperCase() === "STAGE";
      const isEntrance = pillar.label?.toUpperCase() === "ENTRANCE";

      drawExtrudedBlock(ctx, px, py, pw, ph, BLOCK_DEPTH + 4, 6, {
        top: isStage ? "#cbd5e1" : isEntrance ? "#bae6fd" : "#64748b",
        front: isStage ? "#94a3b8" : isEntrance ? "#7dd3fc" : "#475569",
        side: isStage ? "#64748b" : isEntrance ? "#38bdf8" : "#334155",
        stroke: isStage ? "#475569" : isEntrance ? "#0284c7" : "#334155",
        lineWidth: 1.5,
      });

      if (pillar.label) {
        ctx.fillStyle = isEntrance ? "#0c4a6e" : "#f8fafc";
        ctx.font = isEntrance
          ? "bold 8px ui-monospace, monospace"
          : "bold 10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = isEntrance ? "ENTRANCE" : pillar.label;
        ctx.fillText(label, px + pw / 2, py + ph / 2);
      }
    });

    seats.forEach((seat) => {
      const occupant = occupancy.get(seat.label);
      const isSelected = selectedSeat === seat.label;
      const isHovered = hoveredSeat === seat.label;
      const emphasis = isSelected || isHovered ? "lifted" : "base";
      const top = occupant ? "#ede9fe" : isSelected ? "#eff6ff" : "#ffffff";
      const stroke = occupant ? "#a78bfa" : isSelected ? "#60a5fa" : "#cbd5e1";
      const textColor = occupant ? "#5b21b6" : "#64748b";
      const lift = emphasis === "lifted" ? 8 : 4;

      drawSeatBlock(
        ctx,
        seat.x,
        seat.y,
        SEAT_SIZE,
        SEAT_SIZE,
        SEAT_RADIUS,
        {
          top,
          front: occupant ? "#c4b5fd" : "#cbd5e1",
          side: occupant ? "#a78bfa" : "#94a3b8",
          stroke,
          lineWidth: isSelected ? 2.5 : 1.5,
        },
        emphasis,
      );

      ctx.fillStyle = textColor;
      ctx.font = occupant ? "600 9px ui-monospace, monospace" : "600 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = occupant
        ? occupant.name.split(" ")[0]?.slice(0, 8) ?? seat.label
        : seat.label;
      ctx.fillText(label, seat.x + SEAT_SIZE / 2, seat.y + SEAT_SIZE / 2 - lift - (occupant ? 4 : 0));

      if (occupant) {
        ctx.fillStyle = "#64748b";
        ctx.font = "500 7px system-ui, sans-serif";
        const teamLabel = occupant.team.length > 10 ? `${occupant.team.slice(0, 9)}…` : occupant.team;
        ctx.fillText(teamLabel, seat.x + SEAT_SIZE / 2, seat.y + SEAT_SIZE / 2 - lift + 10);
      }
    });

    const legendY = room.height - 26;
    const items = [
      { color: "#ffffff", label: "Empty" },
      { color: "#ede9fe", label: "Occupied" },
      { color: "#64748b", label: "Pillar" },
      { color: "#bae6fd", label: "Entrance" },
    ];

    ctx.font = "10px system-ui, sans-serif";
    let lx = 12;
    items.forEach(({ color, label }) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx, legendY, 10, 10, 2);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, lx + 14, legendY + 5);
      lx += ctx.measureText(label).width + 30;
    });
  }, [layout, occupancy, selectedSeat, hoveredSeat]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={layout.room.width}
      height={layout.room.height}
      className="cursor-pointer rounded-lg"
      style={{ display: "block" }}
      onClick={(event) => {
        const seatLabel = hitTest(event.clientX, event.clientY);
        if (seatLabel) onSeatClick(seatLabel);
      }}
      onMouseMove={(event) => {
        const seatLabel = hitTest(event.clientX, event.clientY);
        setHoveredSeat((current) => (current === seatLabel ? current : seatLabel));
      }}
      onMouseLeave={() => setHoveredSeat(null)}
    />
  );
}
