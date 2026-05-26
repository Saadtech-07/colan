"use client";

import * as React from "react";
import {
  CalendarDays,
  ImageIcon,
  ImagePlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { GalleryImage } from "@/types";

type FilterValue =
  | "all"
  | "celebrations"
  | "meetings"
  | "workshops"
  | "culture"
  | "events"
  | "workspace";

type FormMode = "add" | "edit";

type GalleryDetails = {
  category: string;
  description: string;
  filterGroup: FilterValue;
};

const GALLERY_CATEGORIES = [
  "Team Celebration",
  "Office Culture",
  "Workshop",
  "Client Meeting",
  "Town Hall",
  "Team Lunch",
  "Hackathon",
  "Product Launch",
  "Sprint Planning",
  "Training Session",
  "Annual Meetup",
  "Leadership Event",
  "Award Ceremony",
  "Workspace Life",
  "Innovation Day",
  "Design Review",
  "Engineering Session",
  "Festival Celebration",
  "Team Outing",
  "Office Moments",
] as const;

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "celebrations", label: "Celebrations" },
  { value: "meetings", label: "Meetings" },
  { value: "workshops", label: "Workshops" },
  { value: "culture", label: "Culture" },
  { value: "events", label: "Events" },
  { value: "workspace", label: "Workspace" },
];

const TITLE_SUGGESTIONS = [
  "Q2 Engineering Meetup",
  "UI/UX Design Sprint",
  "Team Collaboration Day",
  "Innovation Workshop",
  "Product Strategy Session",
  "React Hackathon 2026",
  "Employee Recognition Day",
  "Sprint Planning Workshop",
  "Workspace Culture Moments",
  "Leadership Connect",
  "Team Celebration Night",
  "Engineering Lunch Meetup",
  "Frontend Architecture Review",
  "Design Thinking Session",
  "Company Annual Meetup",
] as const;

const MAX_INLINE_IMAGE_SIZE = 2 * 1024 * 1024;

function parseCaption(caption?: string) {
  const trimmed = caption?.trim() ?? "";
  if (!trimmed) {
    return { category: "", description: "" };
  }

  const match = trimmed.match(/^Category:\s*(.+?)(?:\r?\n+([\s\S]*))?$/i);
  if (!match) {
    return { category: "", description: trimmed };
  }

  return {
    category: match[1]?.trim() ?? "",
    description: match[2]?.trim() ?? "",
  };
}

function buildCaption(category: string, description: string) {
  const parts = [
    category.trim() ? `Category: ${category.trim()}` : "",
    description.trim(),
  ].filter(Boolean);

  return parts.join("\n") || undefined;
}

function inferCategory(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes("hackathon")) return "Hackathon";
  if (text.includes("launch")) return "Product Launch";
  if (text.includes("town hall")) return "Town Hall";
  if (text.includes("client")) return "Client Meeting";
  if (text.includes("design review")) return "Design Review";
  if (text.includes("sprint")) return "Sprint Planning";
  if (text.includes("training")) return "Training Session";
  if (text.includes("workshop")) return "Workshop";
  if (text.includes("innovation")) return "Innovation Day";
  if (text.includes("engineering")) return "Engineering Session";
  if (text.includes("leadership")) return "Leadership Event";
  if (text.includes("award") || text.includes("recognition")) {
    return "Award Ceremony";
  }
  if (text.includes("festival")) return "Festival Celebration";
  if (text.includes("lunch")) return "Team Lunch";
  if (text.includes("outing")) return "Team Outing";
  if (text.includes("annual") || text.includes("meetup")) return "Annual Meetup";
  if (text.includes("celebration") || text.includes("party")) {
    return "Team Celebration";
  }
  if (text.includes("workspace")) return "Workspace Life";
  if (text.includes("culture")) return "Office Culture";

  return "Office Moments";
}

function getFilterGroup(category: string): FilterValue {
  if (
    [
      "Team Celebration",
      "Award Ceremony",
      "Festival Celebration",
      "Team Lunch",
      "Team Outing",
    ].includes(category)
  ) {
    return "celebrations";
  }

  if (
    ["Client Meeting", "Sprint Planning", "Leadership Event", "Design Review"].includes(
      category,
    )
  ) {
    return "meetings";
  }

  if (
    ["Workshop", "Training Session", "Hackathon", "Innovation Day", "Engineering Session"].includes(
      category,
    )
  ) {
    return "workshops";
  }

  if (category === "Office Culture") {
    return "culture";
  }

  if (["Workspace Life", "Office Moments"].includes(category)) {
    return "workspace";
  }

  return "events";
}

function getGalleryDetails(item: GalleryImage): GalleryDetails {
  const parsed = parseCaption(item.caption);
  const category = parsed.category || inferCategory(item.title, parsed.description);

  return {
    category,
    description: parsed.description,
    filterGroup: getFilterGroup(category),
  };
}

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
  return title.trim() || "Untitled moment";
}

function isImageLikeSource(value: string) {
  return /^(https?:\/\/|data:image\/)/i.test(value.trim());
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
  category: string;
  description: string;
  uploadedAt: string;
};

function GalleryPreview({
  url,
  title,
  category,
  description,
  uploadedAt,
}: GalleryPreviewProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  const showImage = isImageLikeSource(url) && !errored;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card/80 p-2 shadow-sm">
      <div className="relative min-h-[260px] overflow-hidden rounded-[22px] bg-muted/70">
        {showImage ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted/50" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- user-provided URLs and inline data URLs are not compatible with strict host allowlists */}
            <img
              src={url}
              alt={previewFallbackTitle(title)}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-500",
                loaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(true);
              }}
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-muted/60 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-sm">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Preview your gallery card</p>
              <p className="text-sm text-muted-foreground">
                Add an image URL or drop a small image file to see how it will look.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 px-2 pb-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="muted"
            className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-[11px] font-medium text-foreground"
          >
            {category || "Select a category"}
          </Badge>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {uploadedAt ? formatDateLabel(uploadedAt) : "Choose a date"}
          </span>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold leading-tight">
            {previewFallbackTitle(title)}
          </h3>
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {description.trim() ||
              "Use the description area to add a short note about the moment, team, or activity."}
          </p>
        </div>
      </div>
    </div>
  );
}

type GalleryCardProps = {
  item: GalleryImage;
  details: GalleryDetails;
  canWriteGallery: boolean;
  isDeleting: boolean;
  onEdit: (item: GalleryImage) => void;
  onDelete: (id: string) => void;
};

function GalleryCard({
  item,
  details,
  canWriteGallery,
  isDeleting,
  onEdit,
  onDelete,
}: GalleryCardProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  return (
    <article className="group mb-5 break-inside-avoid overflow-hidden rounded-[30px] border border-border/60 bg-card/90 p-2 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[24px] bg-muted/70">
        {canWriteGallery && (
          <div className="absolute right-3 top-3 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60"
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-muted/60 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-sm">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              This image could not be previewed, but its gallery entry is still available.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-2 pb-2 pt-4">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight">
            {item.title}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {details.description || "Company culture, collaboration, and team moments."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="muted"
            className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-[11px] font-medium text-foreground"
          >
            {details.category}
          </Badge>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
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
  const [category, setCategory] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<GalleryImage | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editUploadedAt, setEditUploadedAt] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterValue>("all");
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

  const galleryWithDetails = React.useMemo(
    () =>
      galleryItems.map((item) => ({
        item,
        details: getGalleryDetails(item),
      })),
    [galleryItems],
  );

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return galleryWithDetails.filter(({ item, details }) => {
      const matchesFilter = filter === "all" || details.filterGroup === filter;
      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.title,
        details.category,
        details.description,
        formatDateLabel(item.uploadedAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, galleryWithDetails, searchQuery]);

  const uniqueCategoryCount = React.useMemo(
    () => new Set(galleryWithDetails.map(({ details }) => details.category)).size,
    [galleryWithDetails],
  );

  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All";

  const resetAddForm = React.useCallback(() => {
    setTitle("");
    setUrl("");
    setUploadedAt(new Date().toISOString().slice(0, 10));
    setCategory("");
    setDescription("");
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
      if (!file) {
        return;
      }

      setError(null);
      try {
        const nextUrl = await fileToDataUrl(file);
        applyImageSource(mode, nextUrl);

        const nextTitle = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim();

        if (mode === "add" && !title.trim()) {
          setTitle(nextTitle);
        }
        if (mode === "edit" && !editTitle.trim()) {
          setEditTitle(nextTitle);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to use the selected image.");
      }
    },
    [applyImageSource, editTitle, title],
  );

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>, mode: FormMode) => {
      event.preventDefault();
      setDragTarget(null);

      const droppedFile = event.dataTransfer.files?.[0] ?? null;
      if (droppedFile) {
        await handleFileSelect(droppedFile, mode);
        return;
      }

      const droppedText =
        event.dataTransfer.getData("text/uri-list") ||
        event.dataTransfer.getData("text/plain");

      if (droppedText.trim()) {
        applyImageSource(mode, droppedText.trim());
        setError(null);
        return;
      }

      setError("Drop a public image URL or a small image file to continue.");
    },
    [applyImageSource, handleFileSelect],
  );

  const handleAddSubmit = async () => {
    if (!title.trim() || !url.trim() || !uploadedAt.trim()) {
      setError("Title, image source, and event date are required.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await addGalleryItem({
        title: title.trim(),
        url: url.trim(),
        caption: buildCaption(category, description),
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
    const parsed = parseCaption(item.caption);
    setSelectedItem(item);
    setEditTitle(item.title || "");
    setEditUrl(item.url || "");
    setEditUploadedAt(item.uploadedAt || "");
    setEditCategory(parsed.category || inferCategory(item.title, parsed.description));
    setEditDescription(parsed.description);
    setError(null);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedItem) return;
    if (!editTitle.trim() || !editUrl.trim() || !editUploadedAt.trim()) {
      setError("Title, image source, and event date are required.");
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
          caption: buildCaption(editCategory, editDescription),
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

  const hasFiltersApplied = filter !== "all" || Boolean(searchQuery.trim());

  return (
    <div className="space-y-8">
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

      <section className="overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <Badge
              variant="muted"
              className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              Company showcase
            </Badge>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="h-4 w-4" />
                Curated moments across culture, collaboration, and innovation
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Gallery
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                A premium visual wall for company culture, workspace life, learning
                sessions, celebrations, and technical events. All existing gallery
                actions remain intact, with a cleaner and more modern browsing
                experience.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{galleryWithDetails.length}</p>
                <p className="text-xs text-muted-foreground">Total gallery moments</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{uniqueCategoryCount}</p>
                <p className="text-xs text-muted-foreground">Active categories</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-semibold">{filteredItems.length}</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilterLabel} moments shown
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-2xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search titles, categories, or event notes"
                  className="h-11 rounded-2xl border-border/70 bg-background/85 pl-10 pr-10 shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
                <SelectTrigger className="h-11 w-full rounded-2xl border-border/70 bg-background/85 shadow-sm sm:w-[190px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/60">
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-xl">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {canWriteGallery && (
                <Dialog open={open} onOpenChange={addDialogOpenChange}>
                  <DialogTrigger asChild>
                    <Button className="h-11 rounded-2xl px-5 shadow-sm">
                      <ImagePlus className="h-4 w-4" />
                      Add image
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-background/95 sm:max-w-4xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl">Add gallery image</DialogTitle>
                      <DialogDescription>
                        Create a polished company showcase entry with a title, category,
                        event date, and a preview before publishing.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-2 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-5">
                        <div
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragTarget("add");
                          }}
                          onDragLeave={() => setDragTarget(null)}
                          onDrop={(event) => {
                            void handleDrop(event, "add");
                          }}
                          className={cn(
                            "rounded-[28px] border border-dashed p-5 transition-all",
                            dragTarget === "add"
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/70 bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-sm">
                              <UploadCloud className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">
                                Drag and drop an image URL or a small image file
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Supports public image links and local image files up to 2
                                MB.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => addFileInputRef.current?.click()}
                            >
                              Browse device
                            </Button>
                          </div>
                          <input
                            ref={addFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              void handleFileSelect(file, "add");
                              event.currentTarget.value = "";
                            }}
                          />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="gallery-title">Event title</Label>
                            <Input
                              id="gallery-title"
                              value={title}
                              onChange={(event) => setTitle(event.target.value)}
                              placeholder="Q2 Engineering Meetup"
                              className="h-11 rounded-2xl border-border/70"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="gallery-category">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                              <SelectTrigger
                                id="gallery-category"
                                className="h-11 rounded-2xl border-border/70"
                              >
                                <SelectValue placeholder="Choose a category" />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-border/60">
                                {GALLERY_CATEGORIES.map((option) => (
                                  <SelectItem
                                    key={option}
                                    value={option}
                                    className="rounded-xl"
                                  >
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="gallery-date">Event date</Label>
                            <Input
                              id="gallery-date"
                              type="date"
                              value={uploadedAt}
                              onChange={(event) => setUploadedAt(event.target.value)}
                              className="h-11 rounded-2xl border-border/70"
                            />
                          </div>

                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="gallery-url">Image source</Label>
                            <div className="relative">
                              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="gallery-url"
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                                placeholder="https://example.com/company-event.jpg"
                                className="h-11 rounded-2xl border-border/70 pl-10"
                              />
                            </div>
                          </div>

                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="gallery-description">
                              Description (optional)
                            </Label>
                            <Textarea
                              id="gallery-description"
                              value={description}
                              onChange={(event) => setDescription(event.target.value)}
                              placeholder="What was happening in this moment?"
                              className="min-h-[120px] rounded-2xl border-border/70"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-sm">Title suggestions</Label>
                            <span className="text-xs text-muted-foreground">
                              Click to autofill
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {TITLE_SUGGESTIONS.map((suggestion) => (
                              <Button
                                key={suggestion}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full border-border/70 bg-background/80"
                                onClick={() => {
                                  setTitle(suggestion);
                                  if (!category) {
                                    setCategory(inferCategory(suggestion, description));
                                  }
                                }}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <GalleryPreview
                        key={url || "add-preview"}
                        url={url}
                        title={title}
                        category={category}
                        description={description}
                        uploadedAt={uploadedAt}
                      />
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isSaving}
                        className="rounded-2xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddSubmit}
                        disabled={isSaving}
                        className="rounded-2xl"
                      >
                        {isSaving ? "Adding..." : "Add image"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    filter === option.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {galleryItems.length === 0 ? (
        <div className="rounded-[32px] border border-border/70 bg-card p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">No gallery images yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start building your company culture wall with celebrations, team events,
            training sessions, and office moments.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-[32px] border border-border/70 bg-card p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
            <Search className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">No images match your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different keyword or switch back to a broader category view.
          </p>
          {hasFiltersApplied && (
            <div className="mt-5">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setSearchQuery("");
                  setFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Company gallery</h2>
              <p className="text-sm text-muted-foreground">
                Explore a curated masonry wall of celebrations, workshops, meetings,
                and workspace moments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-background px-3 py-1.5">
                {filteredItems.length} visible
              </span>
              <span className="rounded-full border border-border/60 bg-background px-3 py-1.5">
                Filter: {activeFilterLabel}
              </span>
            </div>
          </div>

          <div className="columns-1 gap-5 md:columns-2 xl:columns-3 2xl:columns-4">
            {filteredItems.map(({ item, details }) => (
              <GalleryCard
                key={`${item.id}:${item.url}`}
                item={item}
                details={details}
                canWriteGallery={canWriteGallery}
                isDeleting={isDeleting === item.id}
                onEdit={handleEditClick}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog open={editOpen} onOpenChange={editDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-background/95 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit gallery image</DialogTitle>
            <DialogDescription>
              Update the image source, event details, and supporting copy without
              changing the existing gallery workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("edit");
                }}
                onDragLeave={() => setDragTarget(null)}
                onDrop={(event) => {
                  void handleDrop(event, "edit");
                }}
                className={cn(
                  "rounded-[28px] border border-dashed p-5 transition-all",
                  dragTarget === "edit"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/70 bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-sm">
                    <UploadCloud className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">
                      Drag and drop a replacement image URL or image file
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Use a public image link or a local file up to 2 MB for a quick
                      refresh.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    Browse device
                  </Button>
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleFileSelect(file, "edit");
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-title">Event title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="Image title"
                    className="h-11 rounded-2xl border-border/70"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger
                      id="edit-category"
                      className="h-11 rounded-2xl border-border/70"
                    >
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/60">
                      {GALLERY_CATEGORIES.map((option) => (
                        <SelectItem key={option} value={option} className="rounded-xl">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-date">Event date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editUploadedAt}
                    onChange={(event) => setEditUploadedAt(event.target.value)}
                    className="h-11 rounded-2xl border-border/70"
                  />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-url">Image source</Label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="edit-url"
                      value={editUrl}
                      onChange={(event) => setEditUrl(event.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="h-11 rounded-2xl border-border/70 pl-10"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-description">Description (optional)</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Add a short note about the moment"
                    className="min-h-[120px] rounded-2xl border-border/70"
                  />
                </div>
              </div>
            </div>

            <GalleryPreview
              key={editUrl || selectedItem?.id || "edit-preview"}
              url={editUrl}
              title={editTitle}
              category={editCategory}
              description={editDescription}
              uploadedAt={editUploadedAt}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isEditSaving}
              className="rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={isEditSaving}
              className="rounded-2xl"
            >
              {isEditSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
