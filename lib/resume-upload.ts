export const ACCEPTED_RESUME_MIME_TYPES = ["application/pdf"] as const;

export const RESUME_UPLOAD_ACCEPT = [".pdf", "application/pdf"].join(",");

export const MAX_RESUME_UPLOAD_BYTES = 8 * 1024 * 1024;

export function validateResumeUpload(file: File): string | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return "Upload a PDF resume.";
  }

  if (file.size > MAX_RESUME_UPLOAD_BYTES) {
    return "Upload a resume smaller than 8 MB.";
  }

  return null;
}

export function readResumeAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read the selected resume."));
    };

    reader.onerror = () => reject(new Error("Unable to read the selected resume."));
    reader.readAsDataURL(file);
  });
}

export function sanitizeResumeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "resume.pdf";
  return trimmed.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
}
