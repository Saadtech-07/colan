"use client";

import * as React from "react";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { Employee } from "@/types";

const SEAT_SIZE = 60;
const SEAT_RADIUS = 8;

type Props = {
  layout: GeneratedSeatingLayout;
  occupancy: Map<string, Employee>;
  selectedSeat: string | null;
  zoom: number;
  onSeatClick: (seatLabel: string) => void;
};

export function SeatingAiCanvas({
  layout,
  occupancy,
  selectedSeat,
  zoom,
  onSeatClick,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const hitTest = React.useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / zoom;
      const y = (clientY - rect.top) / zoom;

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
    [layout.seats, zoom],
  );

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { room, seats, pillars, walls } = layout;

    ctx.clearRect(0, 0, room.width, room.height);
    ctx.fillStyle = "#12151f";
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.fillStyle = "rgba(58, 64, 96, 0.3)";
    for (let gx = 20; gx < room.width; gx += 40) {
      for (let gy = 20; gy < room.height; gy += 40) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = "#2a3050";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, room.width - 2, room.height - 2);

    walls.forEach((wall) => {
      ctx.strokeStyle = "#3a4060";
      ctx.lineWidth = 8;
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

      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
      grad.addColorStop(0, "#6b4c2a");
      grad.addColorStop(0.45, "#8a6535");
      grad.addColorStop(1, "#4a3018");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 5);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = "#b8924a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 5);
      ctx.stroke();

      if (pillar.label) {
        ctx.fillStyle = "#d4a855";
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillar.label, px + pw / 2, py + ph / 2);
      }
    });

    seats.forEach((seat) => {
      const occupant = occupancy.get(seat.label);
      const isSelected = selectedSeat === seat.label;
      const fill = occupant ? "#1a3d2e" : isSelected ? "#2a3050" : "#1f2436";
      const stroke = occupant ? "#34d399" : isSelected ? "#a78bfa" : "#3a4060";
      const textColor = occupant ? "#6ee7b7" : "#8892b0";

      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(seat.x, seat.y, SEAT_SIZE, SEAT_SIZE, SEAT_RADIUS);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = stroke;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(seat.x, seat.y, SEAT_SIZE, SEAT_SIZE, SEAT_RADIUS);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = occupant ? "600 10px ui-monospace, monospace" : "600 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = occupant
        ? occupant.name.split(" ")[0]?.slice(0, 8) ?? seat.label
        : seat.label;
      ctx.fillText(label, seat.x + SEAT_SIZE / 2, seat.y + SEAT_SIZE / 2);
    });

    const legendY = room.height - 26;
    const items = [
      { color: "#3a4060", label: "Empty" },
      { color: "#34d399", label: "Occupied" },
      { color: "#b8924a", label: "Pillar" },
    ];

    ctx.font = "10px system-ui, sans-serif";
    let lx = 12;
    items.forEach(({ color, label }) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx, legendY, 10, 10, 2);
      ctx.fill();
      ctx.fillStyle = "#4a5270";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, lx + 14, legendY + 5);
      lx += ctx.measureText(label).width + 30;
    });
  }, [layout, occupancy, selectedSeat]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={layout.room.width}
      height={layout.room.height}
      className="cursor-pointer rounded-lg"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
        display: "block",
      }}
      onClick={(event) => {
        const seatLabel = hitTest(event.clientX, event.clientY);
        if (seatLabel) onSeatClick(seatLabel);
      }}
    />
  );
}
