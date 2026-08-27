"use client";

import { ChevronDown, Download, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onExportImage: () => void | Promise<void>;
  onExportPdf: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
};

export function SeatingDownloadMenu({
  onExportImage,
  onExportPdf,
  onExportExcel,
  disabled = false,
  size = "sm",
}: Props) {
  const buttonClass =
    size === "sm"
      ? "h-9 rounded-xl border-slate-300 bg-white gap-1.5 px-3 text-xs font-semibold shadow-sm dark:border-border dark:bg-background"
      : "h-10 rounded-xl gap-2 px-4 font-semibold";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={buttonClass}
          disabled={disabled}
        >
          <Download className="h-3.5 w-3.5" />
          Download
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
      >
        <DropdownMenuItem
          className="rounded-xl px-3 py-2 text-sm"
          onClick={() => void onExportImage()}
        >
          <FileImage className="h-4 w-4" />
          Image (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl px-3 py-2 text-sm" onClick={onExportPdf}>
          <FileText className="h-4 w-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl px-3 py-2 text-sm" onClick={onExportExcel}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
