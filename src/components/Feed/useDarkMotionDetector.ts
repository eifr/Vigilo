import { useRef, useCallback } from "preact/hooks";

const CANVAS_SIZE = 64;
const DARKNESS_THRESHOLD = 40; // Max average pixel value to be considered "dark" (0-255)
const MOTION_THRESHOLD = 30; // Min diff for a pixel to count as "changed"
const MOTION_AREA_PERCENT = 0.05; // 5% of pixels need to change

export const useDarkMotionDetector = (onDarkMotionDetected: () => void) => {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameDataRef = useRef<Uint8ClampedArray | null>(null);

  const checkFrame = useCallback((videoElement: HTMLVideoElement) => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
      offscreenCanvasRef.current.width = CANVAS_SIZE;
      offscreenCanvasRef.current.height = CANVAS_SIZE;
    }

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Draw video to tiny canvas
    ctx.drawImage(videoElement, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = imageData.data;

    // Calculate brightness (luma)
    let totalLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
      // rough luminance
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      totalLuma += luma;
    }
    const avgLuma = totalLuma / (CANVAS_SIZE * CANVAS_SIZE);

    // If it's bright enough, we don't care about "dark" motion. Reset previous frame.
    if (avgLuma > DARKNESS_THRESHOLD) {
      previousFrameDataRef.current = null;
      return;
    }

    // It's dark! Check for motion if we have a previous frame
    if (previousFrameDataRef.current) {
      const prevData = previousFrameDataRef.current;
      let changedPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        // Just compare one channel (or avg of channels) for speed since it's dark
        const currentAvg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const prevAvg = (prevData[i] + prevData[i + 1] + prevData[i + 2]) / 3;
        
        if (Math.abs(currentAvg - prevAvg) > MOTION_THRESHOLD) {
          changedPixels++;
        }
      }

      const totalPixels = CANVAS_SIZE * CANVAS_SIZE;
      if (changedPixels / totalPixels > MOTION_AREA_PERCENT) {
        onDarkMotionDetected();
        // Clear previous frame so we don't spam
        previousFrameDataRef.current = null;
        return;
      }
    }

    // Save current frame for next comparison
    previousFrameDataRef.current = new Uint8ClampedArray(data);
  }, [onDarkMotionDetected]);

  return { checkFrame };
};
