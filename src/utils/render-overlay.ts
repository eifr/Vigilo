import { Colors } from "./img-preprocess";

interface Prediction {
  bbox: [number, number, number, number]; // [x, y, width, height]
  classIdx: number;
  score: number;
}

interface CurrentClasses {
  classes: Record<number, string> | string[];
}

/**
 * Draw bounding boxes in overlay canvas based on task type.
 */
export async function renderOverlay(
  predictions: Prediction[] | null,
  overlayCtx: CanvasRenderingContext2D,
  currentClasses: CurrentClasses,
): Promise<void> {
  // Calculate diagonal length of the canvas
  const diagonalLength = Math.sqrt(
    Math.pow(overlayCtx.canvas.width, 2) + Math.pow(overlayCtx.canvas.height, 2),
  );
  const lineWidth = diagonalLength / 250;

  if (!predictions || predictions.length === 0) return;

  draw_object_detection(predictions, overlayCtx, lineWidth, currentClasses);
}

/**
 * Draw object detection results
 */
function draw_object_detection(
  predictions: Prediction[],
  ctx: CanvasRenderingContext2D,
  lineWidth: number,
  currentClasses: CurrentClasses,
): void {
  if (!predictions || predictions.length === 0) return;

  const predictionsByClass: Record<number, Prediction[]> = {};

  predictions.forEach((predict) => {
    const classId = predict.classIdx;
    if (!predictionsByClass[classId]) predictionsByClass[classId] = [];
    predictionsByClass[classId].push(predict);
  });

  Object.entries(predictionsByClass).forEach(([classIdStr, items]) => {
    const classId = Number(classIdStr);
    const color = Colors.getColor(classId, 0.2); // Assuming returns [r, g, b, a]
    const borderColor = Colors.getColor(classId, 0.8);

    const rgbaFillColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    const rgbaBorderColor = `rgba(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]}, ${borderColor[3]})`;

    ctx.fillStyle = rgbaFillColor;
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox;
      ctx.fillRect(x1, y1, width, height);
    });

    // draw bounding box
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = rgbaBorderColor;
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox;
      ctx.strokeRect(x1, y1, width, height);
    });

    // draw score text
    ctx.fillStyle = rgbaBorderColor;
    ctx.font = "16px Arial";
    items.forEach((predict) => {
      const [x1, y1] = predict.bbox;
      const className = currentClasses.classes[predict.classIdx] || `Class ${predict.classIdx}`;
      const text = `${className} ${predict.score.toFixed(2)}`;
      drawTextWithBackground(ctx, text, x1, y1);
    });
  });
}

interface FontCache {
  font: string;
  measurements: Record<string, number>;
}

const fontCache: FontCache = {
  font: "16px Arial",
  measurements: {},
};

function getMeasuredTextWidth(text: string, ctx: CanvasRenderingContext2D): number {
  if (!fontCache.measurements[text]) {
    fontCache.measurements[text] = ctx.measureText(text).width;
  }
  return fontCache.measurements[text];
}

/**
 * Helper function to draw text with background
 */
function drawTextWithBackground(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  ctx.font = fontCache.font;
  const textWidth = getMeasuredTextWidth(text, ctx);
  const textHeight = 16;

  // Calculate the Y position for the text
  let textY = y - 5;
  let rectY = y - textHeight - 4;

  // Check if the text will be outside the canvas (collision detection for top edge)
  if (rectY < 0) {
    textY = y + textHeight + 5;
    rectY = y + 1;
  }

  const currentFillStyle = ctx.fillStyle;

  // Background rect for text
  ctx.fillRect(x - 1, rectY, textWidth + 4, textHeight + 4);

  // Actual text
  ctx.fillStyle = "white";
  ctx.fillText(text, x, textY);

  // Restore style
  ctx.fillStyle = currentFillStyle;
}
