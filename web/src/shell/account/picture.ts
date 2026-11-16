// Profile pictures: any image file → the middle square, shrunk to 128×128 in the browser (WebP, or JPEG where
// the browser can't make WebP), at most 50 KB (the server refuses bigger). Usually around 10 KB.

export const PICTURE_SIZE = 128;
export const PICTURE_MAX_BYTES = 50_000;

export class PictureError extends Error {
  constructor(public code: "too_large" | "not_an_image") {
    super(code);
  }
}

/** The centered square inside a w×h image */
export function squareCrop(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function shrinkPicture(file: File): Promise<Blob> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new PictureError("not_an_image");
  }
  const { sx, sy, size } = squareCrop(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PICTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, size, size, 0, 0, PICTURE_SIZE, PICTURE_SIZE);
  image.close();

  // WebP first. A browser that can't make WebP quietly hands back a PNG instead: then JPEG.
  let type = "image/webp";
  let blob = await toBlob(canvas, type, 0.8);
  if (!blob || blob.type !== "image/webp") {
    type = "image/jpeg";
    blob = await toBlob(canvas, type, 0.85);
  }
  for (let quality = 0.7; blob && blob.size > PICTURE_MAX_BYTES && quality >= 0.5; quality -= 0.1) blob = await toBlob(canvas, type, quality);
  if (!blob || blob.size > PICTURE_MAX_BYTES) throw new PictureError("too_large");
  return blob;
}
