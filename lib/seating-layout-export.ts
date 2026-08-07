export function downloadDataUrl(filename: string, dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

const EXPORT_BACKGROUND = "#f4f6f8";
const EXPORT_PADDING_PX = 64;
const EXPORT_SCALE = 2;

function stripTransformsForExport(root: HTMLElement) {
  root.style.transform = "none";
  root.style.transformOrigin = "top left";
  for (const node of root.querySelectorAll<HTMLElement>("*")) {
    if (node.style.transform && node.style.transform !== "none") {
      node.style.transform = "none";
    }
  }
}

function prepareCloneForExport(clonedElement: HTMLElement, sourceElement: HTMLElement) {
  stripTransformsForExport(clonedElement);

  const width = Math.max(sourceElement.scrollWidth, sourceElement.offsetWidth);
  const height = Math.max(sourceElement.scrollHeight, sourceElement.offsetHeight);

  clonedElement.style.overflow = "visible";
  clonedElement.style.width = `${width}px`;
  clonedElement.style.height = `${height}px`;
  clonedElement.style.maxWidth = "none";
  clonedElement.style.maxHeight = "none";
  clonedElement.style.boxSizing = "border-box";

  for (const node of clonedElement.querySelectorAll<HTMLElement>("*")) {
    node.style.overflow = "visible";
    node.style.maxWidth = "none";
  }
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function frameSnapshotWithPadding(snapshot: HTMLCanvasElement) {
  const pad = EXPORT_PADDING_PX * EXPORT_SCALE;
  const output = document.createElement("canvas");
  output.width = snapshot.width + pad * 2;
  output.height = snapshot.height + pad * 2;

  const ctx = output.getContext("2d");
  if (!ctx) {
    return snapshot.toDataURL("image/png");
  }

  ctx.fillStyle = EXPORT_BACKGROUND;
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(snapshot, pad, pad);
  return output.toDataURL("image/png");
}

export async function captureLayoutImage(options: {
  canvas?: HTMLCanvasElement | null;
  element?: HTMLElement | null;
}): Promise<string> {
  if (options.canvas) {
    return frameSnapshotWithPadding(options.canvas);
  }

  const element = options.element;
  if (!element) {
    throw new Error("Nothing to export — open the floor layout first.");
  }

  element.scrollIntoView({ block: "center", inline: "center" });
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const { default: html2canvas } = await import("html2canvas-pro");

  const snapshot = await html2canvas(element, {
    backgroundColor: null,
    scale: EXPORT_SCALE,
    useCORS: true,
    allowTaint: true,
    logging: false,
    imageTimeout: 15_000,
    onclone: (_doc, clonedElement) => {
      if (clonedElement instanceof HTMLElement) {
        prepareCloneForExport(clonedElement, element);
      }
    },
  });

  return frameSnapshotWithPadding(snapshot);
}
