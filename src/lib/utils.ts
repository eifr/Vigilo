import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a data URL to a Blob object
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const byteString = atob(dataUrl.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
  return new Blob([ia], { type: mimeString });
}