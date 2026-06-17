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
    ctx.fillStyle = "#f8fafc";
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

      ctx.shadowColor = "rgba(15,23,42,0.08)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
      grad.addColorStop(0, "#e2e8f0");
      grad.addColorStop(0.5, "#cbd5e1");
      grad.addColorStop(1, "#94a3b8");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 5);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 5);
      ctx.stroke();

      if (pillar.label) {
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillar.label, px + pw / 2, py + ph / 2);
      }
    });

    seats.forEach((seat) => {
      const occupant = occupancy.get(seat.label);
      const isSelected = selectedSeat === seat.label;
      const fill = occupant ? "#ecfdf5" : isSelected ? "#eff6ff" : "#ffffff";
      const stroke = occupant ? "#34d399" : isSelected ? "#60a5fa" : "#cbd5e1";
      const textColor = occupant ? "#047857" : "#64748b";

      ctx.shadowColor = "rgba(15,23,42,0.08)";
      ctx.shadowBlur = 6;
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
      ctx.font = occupant ? "600 9px ui-monospace, monospace" : "600 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = occupant
        ? occupant.name.split(" ")[0]?.slice(0, 8) ?? seat.label
        : seat.label;
      ctx.fillText(label, seat.x + SEAT_SIZE / 2, seat.y + SEAT_SIZE / 2 - (occupant ? 4 : 0));

      if (occupant) {
        ctx.fillStyle = "#64748b";
        ctx.font = "500 7px system-ui, sans-serif";
        const teamLabel = occupant.team.length > 10 ? `${occupant.team.slice(0, 9)}…` : occupant.team;
        ctx.fillText(teamLabel, seat.x + SEAT_SIZE / 2, seat.y + SEAT_SIZE / 2 + 10);
      }
    });

    const legendY = room.height - 26;
    const items = [
      { color: "#cbd5e1", label: "Empty" },
      { color: "#34d399", label: "Occupied" },
      { color: "#94a3b8", label: "Pillar" },
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
