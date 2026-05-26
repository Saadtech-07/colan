export const ACCEPTED_IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_IMAGE_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const IMAGE_UPLOAD_ACCEPT = [
  ...ACCEPTED_IMAGE_UPLOAD_EXTENSIONS,
  ...ACCEPTED_IMAGE_UPLOAD_TYPES,
].join(",");

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export function validateImageUpload(file: File) {
  if (!ACCEPTED_IMAGE_UPLOAD_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_UPLOAD_TYPES)[number])) {
    return "Upload a JPG, JPEG, PNG, or WEBP image.";
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "Upload an image smaller than 5 MB.";
  }

  return null;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read the selected image."));
    };

    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}
