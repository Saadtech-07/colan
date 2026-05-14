"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, CalendarDays, Sparkles } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";

import { useAppState } from "@/providers/app-state";

export default function GalleryPage() {
  const { gallery, addGalleryItem, isAdmin } = useAppState();

  const [open, setOpen] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState(
    "https://picsum.photos/seed/upload/1200/800"
  );
  const [caption, setCaption] = React.useState("");

  const submit = async () => {
    if (!title.trim() || !url.trim()) return;

    await addGalleryItem({
      title: title.trim(),
      url: url.trim(),
      caption: caption.trim() || undefined,
      uploadedAt: new Date().toISOString().slice(0, 10),
    });

    setTitle("");
    setCaption("");
    setUrl("https://picsum.photos/seed/upload/1200/800");

    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8 rounded-3xl border bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 rounded-full px-4 py-1 text-xs tracking-wide">
              Company Memories
            </Badge>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Creative Gallery
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Showcase team moments, office culture, events, celebrations, and
              achievements in a beautiful modern gallery layout.
            </p>
          </div>

          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-xl px-6 text-sm shadow-md transition-all hover:scale-[1.02]">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl">
                    Add Gallery Item
                  </DialogTitle>

                  <DialogDescription>
                    Add a new company image using an external image URL.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="g-title">Title</Label>

                    <Input
                      id="g-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter image title"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="g-url">Image URL</Label>

                    <Input
                      id="g-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="g-caption">
                      Caption (Optional)
                    </Label>

                    <Textarea
                      id="g-caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      placeholder="Write something about this image..."
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={submit}
                    className="rounded-xl shadow-sm"
                  >
                    Add To Gallery
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {gallery.map((item, index) => (
          <article
            key={item.id}
            className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            {/* Image */}
            <div className="relative overflow-hidden">
              <Image
                src={item.url}
                alt={item.title}
                width={1200}
                height={800}
                className="h-[260px] w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Floating Badge */}
              <div className="absolute left-4 top-4">
                <div className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium shadow">
                  <Sparkles className="h-3 w-3" />
                  #{index + 1}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-1 text-lg font-semibold">
                  {item.title}
                </h2>
              </div>

              {item.caption && (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {item.caption}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" />

                <span>{item.uploadedAt}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Empty State */}
      {gallery.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-white py-24 text-center">
          <div className="mb-4 rounded-full bg-slate-100 p-5">
            <ImagePlus className="h-10 w-10 text-slate-500" />
          </div>

          <h2 className="text-xl font-semibold">
            No gallery items yet
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Upload your first company memory to get started.
          </p>
        </div>
      )}
    </div>
  );
}