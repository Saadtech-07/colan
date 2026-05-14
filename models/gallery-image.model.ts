import type { ObjectId } from "mongodb";
import type { GalleryImage } from "@/types";
import { COLLECTIONS } from "./collections";

export const GALLERY_COLLECTION = COLLECTIONS.gallery;

export type GalleryImageDocument = {
  _id: ObjectId;
  url: string;
  title: string;
  caption?: string;
  uploadedAt: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export function galleryImageDocToDTO(doc: GalleryImageDocument): GalleryImage {
  return {
    id: doc._id.toHexString(),
    url: doc.url,
    title: doc.title,
    caption: doc.caption,
    uploadedAt: doc.uploadedAt,
  };
}
