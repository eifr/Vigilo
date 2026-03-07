import { getOpenCv } from "./cv-init";
import { preProcessImage } from "./img-preprocess";
import type { InferenceSession, Tensor } from "onnxruntime-web";

export type BBox = [number, number, number, number];

export interface Prediction {
  bbox: BBox;
  classIdx: number;
  score: number;
  keypoints?: { x: number; y: number; score: number }[];
  mask_weights?: number[];
  mask_imgData?: ImageData;
}

export interface ModelConfig {
  overlaySize: [number, number];
  imgszType: "dynamic" | "zeroPad";
  scoreThreshold: number;
  iouThreshold: number;
  [key: string]: any; // Allow for extra properties from the worker payload
}

/**
 * Inference pipeline for YOLO model.
 * @returns Tuple containing: [filtered prediction results, inference time in ms]
 */
export async function inferencePipeline(
  imageData: ImageData,
  session: InferenceSession,
  modelConfig: ModelConfig,
): Promise<[Prediction[], string]> {
  try {
    const { cv } = await getOpenCv();
    // Convert ImageData to cv.Mat
    const srcMat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    srcMat.data.set(imageData.data);

    // Pre-process img, inference
    const [inputTensor, xRatio, yRatio] = preProcessImage(
      srcMat,
      modelConfig.overlaySize,
      modelConfig.imgszType,
    );
    srcMat.delete();

    const start = performance.now();
    const { output0 } = await session.run({
      images: inputTensor,
    });
    const end = performance.now();

    // Dispose input tensor
    if (typeof (inputTensor as any).dispose === "function") {
      (inputTensor as any).dispose();
    }

    // Post process
    const results = postProcess(output0, modelConfig.scoreThreshold, xRatio, yRatio);

    // Dispose output tensor
    if (typeof (output0 as any).dispose === "function") {
      (output0 as any).dispose();
    }

    // Apply NMS
    const selectedIndices = applyNMS(
      results,
      results.map((r) => r.score),
      modelConfig.iouThreshold,
    );
    const filteredResults = selectedIndices.map((i) => results[i]);

    return [filteredResults, (end - start).toFixed(2)];
  } catch (error) {
    console.error("Inference error:", error);
    return [[], "0.00"];
  }
}

/**
 * Post process detection raw outputs.
 */
function postProcess(
  rawTensor: Tensor,
  scoreThreshold: number = 0.45,
  xRatio: number,
  yRatio: number,
): Prediction[] {
  const NUM_PREDICTIONS = rawTensor.dims[2] as number;
  const NUM_BBOX_ATTRS = 4;
  const NUM_SCORES = 80; // Assuming COCO dataset (80 classes)

  // ONNX Tensor data is a generic TypedArray. Cast to Float32Array to use .subarray()
  const predictions = rawTensor.data as Float32Array;
  const bboxData = predictions.subarray(0, NUM_PREDICTIONS * NUM_BBOX_ATTRS);
  const scoresData = predictions.subarray(NUM_PREDICTIONS * NUM_BBOX_ATTRS);

  const results: Prediction[] = [];
  let resultCount = 0;

  for (let i = 0; i < NUM_PREDICTIONS; i++) {
    let maxScore = 0;
    let classIdx = -1;

    for (let c = 0; c < NUM_SCORES; c++) {
      const score = scoresData[i + c * NUM_PREDICTIONS];
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore <= scoreThreshold) continue;

    const w = bboxData[i + NUM_PREDICTIONS * 2] * xRatio;
    const h = bboxData[i + NUM_PREDICTIONS * 3] * yRatio;
    const tlx = bboxData[i] * xRatio - 0.5 * w;
    const tly = bboxData[i + NUM_PREDICTIONS] * yRatio - 0.5 * h;

    results[resultCount++] = {
      bbox: [tlx, tly, w, h],
      classIdx,
      score: maxScore,
    };
  }
  return results;
}

function calculateIOU(box1: BBox, box2: BBox): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  // check if boxes are valid
  if (x1 > x2 + w2 || x2 > x1 + w1 || y1 > y2 + h2 || y2 > y1 + h1) {
    return 0.0;
  }

  const box1_x2 = x1 + w1;
  const box1_y2 = y1 + h1;
  const box2_x2 = x2 + w2;
  const box2_y2 = y2 + h2;

  const intersect_x1 = Math.max(x1, x2);
  const intersect_y1 = Math.max(y1, y2);
  const intersect_x2 = Math.min(box1_x2, box2_x2);
  const intersect_y2 = Math.min(box1_y2, box2_y2);

  const intersection = (intersect_x2 - intersect_x1) * (intersect_y2 - intersect_y1);
  const box1_area = w1 * h1;
  const box2_area = w2 * h2;

  return intersection / (box1_area + box2_area - intersection);
}

function applyNMS(boxes: Prediction[], scores: number[], iouThreshold: number = 0.7): number[] {
  const n = scores.length;
  if (n === 0) return [];

  // pre calculate areas
  const areas = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [, , w, h] = boxes[i].bbox;
    areas[i] = w * h;
  }

  // sort indexes by scores
  const indexes = new Uint32Array(n);
  for (let i = 0; i < n; i++) indexes[i] = i;

  // sort indexes by scores in descending order
  // Note: Standard sort works here since we override the comparator
  indexes.sort((a, b) => scores[b] - scores[a]);

  // use bitmap to track suppressed boxes
  const suppress = new Uint8Array(n);
  const picked: number[] = [];

  for (let i = 0; i < n; i++) {
    const idx = indexes[i];

    if (suppress[idx]) continue;

    picked.push(idx);

    // check remaining boxes
    for (let j = i + 1; j < n; j++) {
      const otherIdx = indexes[j];

      if (suppress[otherIdx]) continue;

      const iou = calculateIOU(boxes[idx].bbox, boxes[otherIdx].bbox);

      if (iou > iouThreshold) {
        suppress[otherIdx] = 1;
      }
    }
  }

  return picked;
}
