"use client";

import * as React from "react";
import {
  CalendarDays,
  ImageIcon,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  projectFieldClassName,
  projectFormLabelClassName,
} from "@/components/features/project-form-shared";
import { SectionTitle } from "@/components/ui/page-typography";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { GalleryImage } from "@/types";

type FormMode = "add" | "edit";

const MAX_INLINE_IMAGE_SIZE = 2 * 1024 * 1024;

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function previewFallbackTitle(title: string) {
  return title.trim() || "Untitled event";
}

function isImageSource(value: string) {
  return /^(https?:\/\/|data:image\/)/i.test(value.trim());
}

function isLocalImageDataUrl(value: string) {
  return value.trim().startsWith("data:image/");
}

async function fileToDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.size > MAX_INLINE_IMAGE_SIZE) {
    throw new Error("Please choose an image smaller than 2 MB.");
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read the selected image."));
    };
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

type GalleryPreviewProps = {
  url: string;
  title: string;
  uploadedAt: string;
};

function GalleryPreview({ url, title, uploadedAt }: GalleryPreviewProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const showImage = isImageSource(url) && !errored;

  return (
    <div className="gallery-glass-panel overflow-hidden rounded-2xl p-2">
      <div className="relative min-h-[200px] overflow-hidden rounded-xl border border-white/25 bg-black/5 dark:border-white/10">
        {showImage ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted/50" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URLs and stored gallery sources */}
            <img
              src={url}
              alt={previewFallbackTitle(title)}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                loaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(true);
              }}
              decoding="async"
            />
          </>
        ) : (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Choose an image to preview</p>
          </div>
        )}
      </div>

      <div className="gallery-glass-caption mt-2 space-y-1.5 rounded-xl px-3 py-2.5">
        <h3 className="text-base font-semibold leading-tight text-foreground">
          {previewFallbackTitle(title)}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {uploadedAt ? formatDateLabel(uploadedAt) : "Choose a date"}
        </span>
      </div>
    </div>
  );
}

type GalleryImageUploadProps = {
  inputId: string;
  dragActive: boolean;
  fileName: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onFileChange: (file: File | null) => void;
};

function GalleryImageUpload({
  inputId,
  dragActive,
  fileName,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: GalleryImageUploadProps) {
  return (
    <label
      htmlFor={inputId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200",
        dragActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/25"
          : "border-border/55 bg-muted/15 hover:border-primary/45 hover:bg-muted/25 focus-within:border-primary focus-within:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/25",
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-background shadow-sm">
        <UploadCloud className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Click or drag an image from your device
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP up to 2 MB</p>
        {fileName ? (
          <p className="max-w-full truncate pt-1 text-xs font-medium text-primary">{fileName}</p>
        ) : null}
      </div>
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"  
        className="sr-only"
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

type GalleryCardProps = {
  item: GalleryImage;
  index: number;
  canWriteGallery: boolean;
  isDeleting: boolean;
  onEdit: (item: GalleryImage) => void;
  onDelete: (id: string) => void;
};

function GalleryCard({
  item,
  index,
  canWriteGallery,
  isDeleting,
  onEdit,
  onDelete,
}: GalleryCardProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  return (
    <article
      className="gallery-glass-float group mb-6 break-inside-avoid"
      style={{ animationDelay: `${(index % 8) * 0.7}s`, animationDuration: `${5.2 + (index % 4) * 0.4}s` }}
    >
      <div className="gallery-glass-panel overflow-hidden rounded-[1.75rem] p-2.5 transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_28px_70px_-16px_rgba(15,23,42,0.28)] dark:group-hover:shadow-[0_28px_70px_-16px_rgba(0,0,0,0.55)]">
        <div
          className="gallery-glass-shine pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-br from-white/50 via-white/10 to-transparent dark:from-white/15"
          aria-hidden
        />

        <div className="relative overflow-hidden rounded-[1.25rem] border border-white/30 bg-black/5 shadow-inner dark:border-white/10">
        {canWriteGallery && (
          <div className="absolute right-3 top-3 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full border border-white/30 bg-white/20 text-foreground shadow-lg backdrop-blur-xl transition hover:bg-white/35 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-black/50"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-44 rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
              >
                <DropdownMenuItem
                  onClick={() => onEdit(item)}
                  className="rounded-xl px-3 py-2 text-sm"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="rounded-xl px-3 py-2 text-sm text-destructive focus:text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {!errored && !loaded && (
          <div className="absolute inset-0 min-h-[220px] animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted/50" />
        )}

        {!errored ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- gallery accepts arbitrary URLs and inline image data */}
            <img
              src={item.url}
              alt={item.title}
              className={cn(
                "h-auto w-full object-cover transition-all duration-500",
                loaded ? "opacity-100 group-hover:scale-[1.04]" : "opacity-0",
              )}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(true);
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/20 to-white/5 px-6 py-12 text-center backdrop-blur-sm dark:from-white/5 dark:to-transparent">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/30 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              This image could not be previewed.
            </p>
          </div>
        )}
        </div>

        <div className="gallery-glass-caption relative mt-3 space-y-1.5 rounded-xl px-3.5 py-3">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
            {item.title}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatDateLabel(item.uploadedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function GalleryPage() {
  const { gallery, access, addGalleryItem, refreshData } = useAppState();

  const galleryItems = React.useMemo(() => gallery ?? [], [gallery]);
  const canWriteGallery = Boolean(access?.canWriteGallery);

  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [uploadedAt, setUploadedAt] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [imageFileName, setImageFileName] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<GalleryImage | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editUploadedAt, setEditUploadedAt] = React.useState("");
  const [editImageFileName, setEditImageFileName] = React.useState("");
  const [dragTarget, setDragTarget] = React.useState<FormMode | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditSaving, setIsEditSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const addFileInputRef = React.useRef<HTMLInputElement>(null);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);
  const successTimeoutRef = React.useRef<number | null>(null);

  const showSuccess = React.useCallback((message: string) => {
    setSuccess(message);
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccess(null);
    }, 3000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const resetAddForm = React.useCallback(() => {
    setTitle("");
    setUrl("");
    setUploadedAt(new Date().toISOString().slice(0, 10));
    setImageFileName("");
  }, []);

  const applyImageSource = React.useCallback((mode: FormMode, nextUrl: string) => {
    if (mode === "add") {
      setUrl(nextUrl);
      return;
    }
    setEditUrl(nextUrl);
  }, []);

  const handleFileSelect = React.useCallback(
    async (file: File | null, mode: FormMode) => {
      if (!file) return;

      setError(null);
      try {
        const nextUrl = await fileToDataUrl(file);
        applyImageSource(mode, nextUrl);

        if (mode === "add") {
          setImageFileName(file.name);
        } else {
          setEditImageFileName(file.name);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to use the selected image.");
      }
    },
    [applyImageSource],
  );

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLElement>, mode: FormMode) => {
      event.preventDefault();
      setDragTarget(null);

      const droppedFile = event.dataTransfer.files?.[0] ?? null;
      if (!droppedFile) {
        setError("Drop an image file from your device to continue.");
        return;
      }

      await handleFileSelect(droppedFile, mode);
    },
    [handleFileSelect],
  );

  const handleAddSubmit = async () => {
    if (!title.trim() || !uploadedAt.trim()) {
      setError("Event title and date are required.");
      return;
    }
    if (!url.trim() || !isLocalImageDataUrl(url)) {
      setError("Please choose an image from your device.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await addGalleryItem({
        title: title.trim(),
        url: url.trim(),
        uploadedAt: uploadedAt.trim(),
      });
      resetAddForm();
      setOpen(false);
      showSuccess("Image added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (item: GalleryImage) => {
    setSelectedItem(item);
    setEditTitle(item.title || "");
    setEditUrl(item.url || "");
    setEditUploadedAt(item.uploadedAt || "");
    setEditImageFileName("");
    setError(null);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedItem) return;
    if (!editTitle.trim() || !editUploadedAt.trim()) {
      setError("Event title and date are required.");
      return;
    }
    if (!editUrl.trim()) {
      setError("Please choose an image from your device.");
      return;
    }

    setError(null);
    setIsEditSaving(true);
    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(selectedItem.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          url: editUrl.trim(),
          uploadedAt: editUploadedAt.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setEditOpen(false);
      setSelectedItem(null);
      showSuccess("Image updated successfully.");
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update image.");
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this image? This cannot be undone.")) return;

    setError(null);
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      showSuccess("Image deleted successfully.");
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image.");
    } finally {
      setIsDeleting(null);
    }
  };

  const addDialogOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDragTarget(null);
    }
  };

  const editDialogOpenChange = (nextOpen: boolean) => {
    setEditOpen(nextOpen);
    if (!nextOpen) {
      setSelectedItem(null);
      setDragTarget(null);
    }
  };

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(420px,50vh)] overflow-hidden">
        <div className="absolute left-[6%] top-[8%] h-56 w-56 rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-500/15" />
        <div className="absolute right-[10%] top-[22%] h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/12" />
      </div>
      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <SectionTitle as="h2" className="font-semibold text-muted-foreground">
          Company moments
        </SectionTitle>

        {canWriteGallery ? (
          <Dialog open={open} onOpenChange={addDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="h-10 shrink-0 rounded-lg px-4 shadow-sm">
                <ImagePlus className="h-4 w-4" />
                Add image
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-background/95 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl">Add gallery image</DialogTitle>
                <DialogDescription>
                  Enter the event title, choose a local image, and set the date.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="space-y-2.5">
                  <Label htmlFor="gallery-title" className={projectFormLabelClassName}>
                    Event title
                  </Label>
                  <Input
                    id="gallery-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Q2 Engineering Meetup"
                    className={projectFieldClassName}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="gallery-date" className={projectFormLabelClassName}>
                    Event date
                  </Label>
                  <Input
                    id="gallery-date"
                    type="date"
                    value={uploadedAt}
                    onChange={(event) => setUploadedAt(event.target.value)}
                    className={projectFieldClassName}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label className={projectFormLabelClassName}>Image</Label>
                  <GalleryImageUpload
                    inputId="gallery-file-add"
                    dragActive={dragTarget === "add"}
                    fileName={imageFileName}
                    fileInputRef={addFileInputRef}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragTarget("add");
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDrop={(event) => {
                      void handleDrop(event, "add");
                    }}
                    onFileChange={(file) => {
                      void handleFileSelect(file, "add");
                    }}
                  />
                </div>

                {url ? (
                  <GalleryPreview
                    key={url}
                    url={url}
                    title={title}
                    uploadedAt={uploadedAt}
                  />
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button onClick={handleAddSubmit} disabled={isSaving} className="rounded-lg">
                  {isSaving ? "Adding..." : "Add image"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {galleryItems.length === 0 ? (
        <div className="gallery-glass-panel rounded-2xl p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">No gallery images yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start building your company culture wall with celebrations, team events,
            training sessions, and office moments.
          </p>
        </div>
      ) : (
        <>
          <div className="columns-1 gap-6 md:columns-2 xl:columns-3 2xl:columns-4 [&>*]:px-1">
            {galleryItems.map((item, index) => (
              <GalleryCard
                key={`${item.id}:${item.url}`}
                index={index}
                item={item}
                canWriteGallery={canWriteGallery}
                isDeleting={isDeleting === item.id}
                onEdit={handleEditClick}
                onDelete={handleDelete}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-border/60 to-transparent" />
            <p className="text-xs text-muted-foreground/75">
              {galleryItems.length} {galleryItems.length === 1 ? "moment" : "moments"} in the gallery
            </p>
          </div>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={editDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-background/95 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit gallery image</DialogTitle>
            <DialogDescription>
              Update the event title, replace the image from your device, or change the date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2.5">
              <Label htmlFor="edit-title" className={projectFormLabelClassName}>
                Event title
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder="Event title"
                className={projectFieldClassName}
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="edit-date" className={projectFormLabelClassName}>
                Event date
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={editUploadedAt}
                onChange={(event) => setEditUploadedAt(event.target.value)}
                className={projectFieldClassName}
              />
            </div>

            <div className="space-y-2.5">
              <Label className={projectFormLabelClassName}>Image</Label>
              <GalleryImageUpload
                inputId="gallery-file-edit"
                dragActive={dragTarget === "edit"}
                fileName={editImageFileName}
                fileInputRef={editFileInputRef}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("edit");
                }}
                onDragLeave={() => setDragTarget(null)}
                onDrop={(event) => {
                  void handleDrop(event, "edit");
                }}
                onFileChange={(file) => {
                  void handleFileSelect(file, "edit");
                }}
              />
            </div>

            {editUrl ? (
              <GalleryPreview
                key={editUrl}
                url={editUrl}
                title={editTitle}
                uploadedAt={editUploadedAt}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isEditSaving}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isEditSaving} className="rounded-lg">
              {isEditSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
