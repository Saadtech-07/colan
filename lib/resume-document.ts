import { downloadDataUrl } from "@/lib/seating-layout-export";

export type ResumeDocumentFields = {
  resumeUrl?: string | null;
  resumeFileName?: string | null;
  resumeMimeType?: string | null;
  resumeUploadedAt?: string | null;
};

export function hasResumeDocument(fields?: ResumeDocumentFields | null): boolean {
  return Boolean(fields?.resumeUrl?.trim());
}

export function resolveResumeFileName(
  fields: ResumeDocumentFields,
  fallbackName = "resume.pdf",
): string {
  const fromField = fields.resumeFileName?.trim();
  if (fromField) return fromField;
  return fallbackName;
}

export function formatResumeUploadedAt(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const match = dataUrl.match(/^data:([^;,]+)?(?:;([^;,]+))?,(.*)$/);
    if (!match) return null;

    const mime = match[1] || "application/pdf";
    const encoding = match[2];
    const data = match[3];

    if (encoding === "base64") {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mime });
    }

    return new Blob([decodeURIComponent(data)], { type: mime });
  } catch {
    return null;
  }
}

function resolveResumeOpenUrl(resumeUrl: string): { href: string; revoke?: () => void } {
  const trimmed = resumeUrl.trim();
  if (!trimmed.startsWith("data:")) {
    return { href: trimmed };
  }

  const blob = dataUrlToBlob(trimmed);
  if (!blob) {
    return { href: trimmed };
  }

  const objectUrl = URL.createObjectURL(blob);
  return {
    href: objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

function openResumeInNewTab(href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function viewResumeDocument(resumeUrl: string, fileName = "resume.pdf") {
  const { href, revoke } = resolveResumeOpenUrl(resumeUrl);

  try {
    openResumeInNewTab(href);
  } catch {
    downloadResumeDocument(resumeUrl, fileName);
    return;
  }

  if (revoke) {
    window.setTimeout(revoke, 60_000);
  }
}

export function downloadResumeDocument(resumeUrl: string, fileName: string) {
  downloadDataUrl(fileName, resumeUrl);
}
