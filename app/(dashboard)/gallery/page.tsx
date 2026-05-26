// "use client";

// import * as React from "react";
// import { ImagePlus } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { useAppState } from "@/providers/app-state";

// export default function GalleryPage() {
//   const { gallery, addGalleryItem, access } = useAppState();
//   const [open, setOpen] = React.useState(false);
//   const [title, setTitle] = React.useState("");
//   const [url, setUrl] = React.useState("https://picsum.photos/seed/upload/800/600");
//   const [caption, setCaption] = React.useState("");
//   const [isSaving, setIsSaving] = React.useState(false);

//   const submit = async () => {
//     if (!title.trim() || !url.trim() || isSaving) return;
//     setIsSaving(true);
//     try {
//       await addGalleryItem({
//         title: title.trim(),
//         url: url.trim(),
//         caption: caption.trim() || undefined,
//         uploadedAt: new Date().toISOString().slice(0, 10),
//       });
//       setTitle("");
//       setCaption("");
//       setUrl("https://picsum.photos/seed/upload/800/600");
//       setOpen(false);
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
//         <div>
//           <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gallery</h1>
//           <p className="mt-1 text-muted-foreground">
//             Company moments — Cloudinary upload will plug in here later.
//           </p>
//         </div>
//         {access?.canWriteGallery && (
//           <Dialog open={open} onOpenChange={setOpen}>
//             <DialogTrigger asChild>
//               <Button className="gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
//                 <ImagePlus className="h-4 w-4" />
//                 Upload image
//               </Button>
//             </DialogTrigger>
//             <DialogContent>
//               <DialogHeader>
//                 <DialogTitle>Add gallery item</DialogTitle>
//                 <DialogDescription>
//                   Paste an image URL for this prototype (e.g. from Picsum or your CDN).
//                 </DialogDescription>
//               </DialogHeader>
//               <div className="grid gap-3 py-2">
//                 <div className="space-y-2">
//                   <Label htmlFor="g-title">Title</Label>
//                   <Input
//                     id="g-title"
//                     value={title}
//                     onChange={(e) => setTitle(e.target.value)}
//                     placeholder="Event name"
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label htmlFor="g-url">Image URL</Label>
//                   <Input
//                     id="g-url"
//                     value={url}
//                     onChange={(e) => setUrl(e.target.value)}
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label htmlFor="g-cap">Caption (optional)</Label>
//                   <Textarea
//                     id="g-cap"
//                     value={caption}
//                     onChange={(e) => setCaption(e.target.value)}
//                     rows={2}
//                   />
//                 </div>
//               </div>
//               <DialogFooter>
//                 <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isSaving}>
//                   Cancel
//                 </Button>
//                 <Button type="button" onClick={submit} disabled={isSaving}>
//                   {isSaving ? "Adding..." : "Add to gallery"}
//                 </Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//         )}
//       </div>

//       <section>
//         <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
//           Company gallery
//         </h2>
//         <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
//           {gallery.map((item) => (
//             <article
//               key={item.id}
//               className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
//             >
//               <div className="relative w-full overflow-hidden">
//                 {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user URLs; Next/Image needs every host in config */}
//                 <img
//                   src={item.url}
//                   alt={item.title}
//                   width={800}
//                   height={600}
//                   className="h-auto w-full object-cover"
//                   loading="lazy"
//                   decoding="async"
//                   referrerPolicy="no-referrer"
//                 />
//               </div>
//               <div className="space-y-1 p-4">
//                 <h3 className="font-semibold leading-tight">{item.title}</h3>
//                 {item.caption && (
//                   <p className="text-sm text-muted-foreground">{item.caption}</p>
//                 )}
//                 <p className="text-xs text-muted-foreground">{item.uploadedAt}</p>
//               </div>
//             </article>
//           ))}
//         </div>
//       </section>
//     </div>
//   );
// }


"use client";
 
import * as React from "react";
import {
  ImagePlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
 
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { GalleryImage } from "@/types";
 
export default function GalleryPage() {
  const { gallery, access, addGalleryItem, refreshData } = useAppState();
 
  const [galleryItems, setGalleryItems] = React.useState(gallery ?? []);
  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("https://picsum.photos/seed/upload/800/600");
  const [selectedItem, setSelectedItem] = React.useState<GalleryImage | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditSaving, setIsEditSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
 
  React.useEffect(() => {
    setGalleryItems(gallery ?? []);
  }, [gallery]);
 
  const handleAddSubmit = async () => {
    if (!title.trim() || !url.trim()) {
      setError("Title and image URL are required.");
      return;
    }
 
    setError(null);
    setIsSaving(true);
    try {
      await addGalleryItem({
        title: title.trim(),
        url: url.trim(),
        uploadedAt: new Date().toISOString().slice(0, 10),
      });
      setTitle("");
      setUrl("https://picsum.photos/seed/upload/800/600");
      setOpen(false);
      setSuccess("Image added successfully.");
      setTimeout(() => setSuccess(null), 3000);
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
    setError(null);
    setEditOpen(true);
  };
 
  const handleEditSave = async () => {
    if (!selectedItem) return;
    if (!editTitle.trim() || !editUrl.trim()) {
      setError("Title and image URL are required.");
      return;
    }
 
    setError(null);
    setIsEditSaving(true);
    try {
      const res = await fetch(
        `/api/gallery/${encodeURIComponent(selectedItem.id)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            url: editUrl.trim(),
            uploadedAt: selectedItem.uploadedAt,
          }),
        },
      );
 
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
 
      setEditOpen(false);
      setSelectedItem(null);
      setSuccess("Image updated successfully.");
      setTimeout(() => setSuccess(null), 3000);
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
 
      setSuccess("Image deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image.");
    } finally {
      setIsDeleting(null);
    }
  };
 
  return (
    <div className="space-y-6">
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
 
      {access?.canWriteGallery && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <ImagePlus className="h-4 w-4" />
                Add image
              </Button>
            </DialogTrigger>
 
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Add gallery image</DialogTitle>
                <DialogDescription>
                  Provide a title and image URL for the gallery.
                </DialogDescription>
              </DialogHeader>
 
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="gallery-title">Title</Label>
                  <Input
                    id="gallery-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Image title"
                  />
                </div>
 
                <div className="grid gap-2">
                  <Label htmlFor="gallery-url">Image URL</Label>
                  <Input
                    id="gallery-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
 
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddSubmit} disabled={isSaving}>
                  {isSaving ? "Adding..." : "Add image"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
 
      {galleryItems.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card p-10 text-center">
          <ImagePlus className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No gallery images yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
                {access?.canWriteGallery && (
                  <div className="absolute right-3 top-3 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
 
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(item.id)}
                          className="text-destructive focus:text-destructive"
                          disabled={isDeleting === item.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isDeleting === item.id ? "Deleting..." : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
 
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.uploadedAt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
 
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit gallery image</DialogTitle>
            <DialogDescription>Update the title and image URL.</DialogDescription>
          </DialogHeader>
 
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Image title"
              />
            </div>
 
            <div className="grid gap-2">
              <Label htmlFor="edit-url">Image URL</Label>
              <Input
                id="edit-url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
 
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
              <img src={editUrl} alt="Preview" className="h-56 w-full object-cover" />
            </div>
          </div>
 
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isEditSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isEditSaving}>
              {isEditSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
 