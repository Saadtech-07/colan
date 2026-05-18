"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/providers/app-state";

export default function GalleryPage() {
  const { gallery, addGalleryItem, access } = useAppState();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("https://picsum.photos/seed/upload/800/600");
  const [caption, setCaption] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const submit = async () => {
    if (!title.trim() || !url.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await addGalleryItem({
        title: title.trim(),
        url: url.trim(),
        caption: caption.trim() || undefined,
        uploadedAt: new Date().toISOString().slice(0, 10),
      });
      setTitle("");
      setCaption("");
      setUrl("https://picsum.photos/seed/upload/800/600");
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gallery</h1>
          <p className="mt-1 text-muted-foreground">
            Company moments — Cloudinary upload will plug in here later.
          </p>
        </div>
        {access?.canWriteGallery && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm transition-transform hover:-translate-y-0.5">
                <ImagePlus className="h-4 w-4" />
                Upload image
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add gallery item</DialogTitle>
                <DialogDescription>
                  Paste an image URL for this prototype (e.g. from Picsum or your CDN).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="g-title">Title</Label>
                  <Input
                    id="g-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-url">Image URL</Label>
                  <Input
                    id="g-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-cap">Caption (optional)</Label>
                  <Textarea
                    id="g-cap"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" onClick={submit} disabled={isSaving}>
                  {isSaving ? "Adding..." : "Add to gallery"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Company gallery
        </h2>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {gallery.map((item) => (
            <article
              key={item.id}
              className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user URLs; Next/Image needs every host in config */}
                <img
                  src={item.url}
                  alt={item.title}
                  width={800}
                  height={600}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-1 p-4">
                <h3 className="font-semibold leading-tight">{item.title}</h3>
                {item.caption && (
                  <p className="text-sm text-muted-foreground">{item.caption}</p>
                )}
                <p className="text-xs text-muted-foreground">{item.uploadedAt}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
