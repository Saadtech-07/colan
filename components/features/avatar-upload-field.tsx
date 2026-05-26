"use client";

import * as React from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  IMAGE_UPLOAD_ACCEPT,
  readFileAsDataUrl,
  validateImageUpload,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  previewName: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function AvatarUploadField({
  value,
  previewName,
  onChange,
  disabled,
  className,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const applyFile = React.useCallback(
    async (file: File) => {
      const validationError = validateImageUpload(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        const nextValue = await readFileAsDataUrl(file);
        onChange(nextValue);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to upload image.");
      } finally {
        setIsUploading(false);
      }
    },
    [onChange],
  );

  const openPicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "rounded-[24px] border border-dashed p-4 transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-border/70 bg-muted/10",
          disabled && "pointer-events-none opacity-70",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (!file || disabled) return;
          await applyFile(file);
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 ring-2 ring-border/70">
            <AvatarImage src={value} alt={previewName} />
            <AvatarFallback className="text-lg font-semibold">
              {initials(previewName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImagePlus className="h-4 w-4 text-primary" />
              Profile image
            </div>
            <p className="text-sm text-muted-foreground">
              Upload directly from your device. Supports JPG, JPEG, PNG, and WEBP up to 5 MB.
            </p>
            <p className="text-xs text-muted-foreground">
              Drag and drop an image here, or use the upload button below.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={openPicker}
            disabled={disabled || isUploading}
            className="h-10 rounded-2xl border-border/70 bg-background/80"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {value ? "Replace Image" : "Upload Profile Image"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onChange("");
                setError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={disabled || isUploading}
              className="h-10 rounded-2xl"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_UPLOAD_ACCEPT}
          className="hidden"
          disabled={disabled || isUploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await applyFile(file);
          }}
        />
      </div>
    </div>
  );
}
