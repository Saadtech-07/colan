import type { Mat } from "@techstark/opencv-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

export const ANALYSIS_MAX_DIMENSION = 1600;

export async function decodeAndResize(
  cv: CV,
  data: Uint8Array,
  maxDimension = ANALYSIS_MAX_DIMENSION,
): Promise<{
  mat: Mat;
  scale: number;
  originalWidth: number;
  originalHeight: number;
  cleanup: () => void;
}> {
  const blob = new Blob([data.slice()]);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Unable to decode uploaded image");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = cv.matFromImageData(imageData);
  if (!decoded || decoded.empty()) {
    decoded?.delete();
    throw new Error("Unable to decode uploaded image");
  }

  const originalWidth = decoded.cols;
  const originalHeight = decoded.rows;
  const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));

  if (scale === 1) {
    return {
      mat: decoded,
      scale: 1,
      originalWidth,
      originalHeight,
      cleanup: () => decoded.delete(),
    };
  }

  const targetWidth = Math.round(originalWidth * scale);
  const targetHeight = Math.round(originalHeight * scale);
  const resized = new cv.Mat();
  cv.resize(
    decoded,
    resized,
    new cv.Size(targetWidth, targetHeight),
    0,
    0,
    cv.INTER_AREA,
  );
  decoded.delete();

  return {
    mat: resized,
    scale,
    originalWidth,
    originalHeight,
    cleanup: () => resized.delete(),
  };
}

export function toGrayscale(cv: CV, source: Mat, gray: Mat): void {
  const channels = source.channels();
  if (channels === 4) {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
  } else if (channels === 3) {
    cv.cvtColor(source, gray, cv.COLOR_BGR2GRAY);
  } else {
    source.copyTo(gray);
  }
}

export function quickColorSample(
  cv: CV,
  source: Mat,
  x: number,
  y: number,
  width: number,
  height: number,
): { isColored: boolean; colorVariance: number } {
  if (source.channels() < 3) {
    return { isColored: false, colorVariance: 0 };
  }

  const cx = Math.min(source.cols - 1, x + Math.floor(width / 2));
  const cy = Math.min(source.rows - 1, y + Math.floor(height / 2));
  const pixel = source.ucharPtr(cy, cx);
  const b = pixel[0];
  const g = pixel[1];
  const r = pixel[2];
  const variance = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

  return { isColored: variance > 20, colorVariance: variance };
}
