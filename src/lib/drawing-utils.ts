import type { BoundingBox } from "./types";

export class Colors {
  static palette: string[] = [
    "#042AFF",
    "#0BDBEB",
    "#F3F3F3",
    "#00DFB7",
    "#111F68",
    "#FF6FDD",
    "#FF444F",
    "#CCED00",
    "#00F344",
    "#BD00FF",
    "#00B4FF",
    "#DD00BA",
    "#00FFFF",
    "#26C000",
    "#01FFB3",
    "#7D24FF",
    "#7B0068",
    "#FF1B6C",
    "#FC6D2F",
    "#A2FF0B",
  ];
  static n = Colors.palette.length;
  static cache: Record<string, string> = {};

  static hex2rgba(hex: string, alpha: number = 1): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  static getColor(i: number, alpha: number = 1): string {
    const key = `${i}-${alpha}`;
    if (Colors.cache[key]) return Colors.cache[key];

    const hex = Colors.palette[i % Colors.n];
    const rgba = Colors.hex2rgba(hex, alpha);
    Colors.cache[key] = rgba;
    return rgba;
  }
}

interface FontMeasurement {
  width: number;
}

const fontCache: {
  font: string;
  measurements: Record<string, FontMeasurement>;
} = {
  font: "16px Arial",
  measurements: {},
};

function getMeasuredTextWidth(text: string, ctx: CanvasRenderingContext2D): number {
  if (!fontCache.measurements[text]) {
    fontCache.measurements[text] = {
      width: ctx.measureText(text).width,
    };
  }
  return fontCache.measurements[text].width;
}

function drawTextWithBackground(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.font = fontCache.font;
  const textWidth = getMeasuredTextWidth(text, ctx);

  let textY = y - 5;
  let rectY = y - 16 - 4;

  // Keep label inside canvas
  if (rectY < 0) {
    rectY = y + 1;
    textY = y + 16 + 5;
  }

  const currentFillStyle = ctx.fillStyle;

  // Draw background
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, rectY, textWidth + 4, 20);

  // Draw text
  ctx.fillStyle = "white";
  ctx.fillText(text, x, textY);

  // Restore style
  ctx.fillStyle = currentFillStyle;
}

export function drawDetections(
  ctx: CanvasRenderingContext2D,
  boxes: BoundingBox[],
  mode: "yolo" | "opencv",
) {
  if (!boxes || boxes.length === 0) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Calculate line width based on canvas size (diagonal / 250)
  // This matches the reference implementation for consistent scaling
  const lineWidth = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 250;

  // Group boxes by class/label for batched state changes (optimization)
  const boxesByClass: Record<string, BoundingBox[]> = {};

  boxes.forEach((box) => {
    // For OpenCV, label might be undefined, treat as index 0
    const label = box.label || "unknown";
    // Use label string to create a unique key for grouping.
    // We'll calculate color index from it later.
    if (!boxesByClass[label]) {
      boxesByClass[label] = [];
    }
    boxesByClass[label].push(box);
  });

  Object.entries(boxesByClass).forEach(([label, classBoxes]) => {
    // Determine color index
    // For YOLO, we might parse "class_5" or use the label string hash
    // The reference implementation passes classIdx directly.
    // Here we'll hash the string to get a stable index if it's not a direct class index.
    let classIdx = 0;
    if (label.startsWith("class_")) {
      classIdx = parseInt(label.split("_")[1], 10);
    } else {
      classIdx = label.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    }

    const fillColor = Colors.getColor(classIdx, 0.2);
    const borderColor = Colors.getColor(classIdx, 0.8);

    // Batch 1: Fill Rects
    ctx.fillStyle = fillColor;
    classBoxes.forEach((box) => {
      let x, y, w, h;
      if (mode === "yolo") {
        // Normalized
        x = box.x * width;
        y = box.y * height;
        w = box.width * width;
        h = box.height * height;
      } else {
        // Pixels
        x = box.x;
        y = box.y;
        w = box.width;
        h = box.height;
      }
      ctx.fillRect(x, y, w, h);
    });

    // Batch 2: Stroke Rects
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderColor;
    classBoxes.forEach((box) => {
      let x, y, w, h;
      if (mode === "yolo") {
        x = box.x * width;
        y = box.y * height;
        w = box.width * width;
        h = box.height * height;
      } else {
        x = box.x;
        y = box.y;
        w = box.width;
        h = box.height;
      }
      ctx.strokeRect(x, y, w, h);
    });

    // Batch 3: Text Labels
    // Only draw text for YOLO or if a label exists
    if (mode === "yolo") {
      classBoxes.forEach((box) => {
        let x, y;
        if (mode === "yolo") {
          x = box.x * width;
          y = box.y * height;
        } else {
          x = box.x;
          y = box.y;
        }

        const text = `${box.label || ""} ${box.confidence ? box.confidence.toFixed(2) : ""}`;
        drawTextWithBackground(ctx, text, x, y, borderColor);
      });
    }
  });
}
