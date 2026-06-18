export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export async function captureLayoutImage(options: {
  canvas?: HTMLCanvasElement | null;
  element?: HTMLElement | null;
}): Promise<string> {
  if (options.canvas) {
    return options.canvas.toDataURL("image/png");
  }

  if (options.element) {
    const { default: html2canvas } = await import("html2canvas");
    const snapshot = await html2canvas(options.element, {
      backgroundColor: "#f4f6f8",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return snapshot.toDataURL("image/png");
  }

  throw new Error("Nothing to export — open the floor layout first.");
}
