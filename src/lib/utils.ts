import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a data URL to a Blob object
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    throw new Error("Invalid data URL");
  }
  const parts = dataUrl.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid data URL format");
  }
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
  return new Blob([ia], { type: mimeString });
}

/**
 * Get user media with timeout protection
 * Prevents app from freezing when camera access hangs
 */
export async function getUserMediaWithTimeout(
  constraints: MediaStreamConstraints,
  timeoutMs: number = 10000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Camera access timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        clearTimeout(timeoutId);
        resolve(stream);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          reject(new Error(`Camera access timed out after ${timeoutMs}ms`));
        } else {
          reject(error);
        }
      });
  });
}

/**
 * Safely stop a media stream
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn("Error stopping track:", e);
      }
    });
  }
}
