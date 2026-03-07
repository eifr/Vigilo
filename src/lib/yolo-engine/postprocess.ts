import type { BoundingBox } from "./types";

// COCO 80 class labels
export const COCO_LABELS = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
];

function calculateIOU(box1: number[], box2: number[]): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  const box1_x2 = x1 + w1;
  const box1_y2 = y1 + h1;
  const box2_x2 = x2 + w2;
  const box2_y2 = y2 + h2;

  if (x1 > box2_x2 || x2 > box1_x2 || y1 > box2_y2 || y2 > box1_y2) return 0;

  const intersect_x1 = Math.max(x1, x2);
  const intersect_y1 = Math.max(y1, y2);
  const intersect_x2 = Math.min(box1_x2, box2_x2);
  const intersect_y2 = Math.min(box1_y2, box2_y2);

  const intersection =
    Math.max(0, intersect_x2 - intersect_x1) * Math.max(0, intersect_y2 - intersect_y1);
  const box1_area = w1 * h1;
  const box2_area = w2 * h2;

  return intersection / (box1_area + box2_area - intersection);
}

function applyNMS(
  boxes: { bbox: number[]; score: number; classIdx: number }[],
  scores: number[],
  iouThreshold: number = 0.5,
): number[] {
  const n = scores.length;
  if (n === 0) return [];

  const indexes = new Uint32Array(n);
  for (let i = 0; i < n; i++) indexes[i] = i;

  // Sort by score descending
  indexes.sort((a, b) => scores[b] - scores[a]);

  const suppress = new Uint8Array(n); // 0 = keep, 1 = suppress
  const picked: number[] = [];

  for (let i = 0; i < n; i++) {
    const idx = indexes[i];
    if (suppress[idx]) continue;

    picked.push(idx);

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

export function postProcess(
  rawTensor: { data: Float32Array; dims: readonly number[] },
  scoreThreshold: number,
  iouThreshold: number,
  xRatio: number,
  yRatio: number,
): BoundingBox[] {
  const NUM_PREDICTIONS = rawTensor.dims[2];
  // const NUM_BBOX_ATTRS = 4;
  const NUM_SCORES = 80;

  const predictions = rawTensor.data;
  // Based on [1, 84, N] shape
  const bboxData = predictions.subarray(0, 4 * NUM_PREDICTIONS);
  const scoresData = predictions.subarray(4 * NUM_PREDICTIONS);

  const candidates: { bbox: number[]; score: number; classIdx: number }[] = [];
  const candidateScores: number[] = [];

  for (let i = 0; i < NUM_PREDICTIONS; i++) {
    let maxScore = 0;
    let classIdx = -1;

    // Find best class for this anchor
    for (let c = 0; c < NUM_SCORES; c++) {
      const score = scoresData[i + c * NUM_PREDICTIONS];
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore <= scoreThreshold) continue;

    // Extract bbox
    const cx = bboxData[i];
    const cy = bboxData[i + NUM_PREDICTIONS];
    const w = bboxData[i + 2 * NUM_PREDICTIONS];
    const h = bboxData[i + 3 * NUM_PREDICTIONS];

    // Scale to original image
    const width = w * xRatio;
    const height = h * yRatio;
    const x = cx * xRatio - 0.5 * width;
    const y = cy * yRatio - 0.5 * height;

    candidates.push({
      bbox: [x, y, width, height],
      score: maxScore,
      classIdx: classIdx,
    });
    candidateScores.push(maxScore);
  }

  // Apply NMS
  const selectedIndices = applyNMS(candidates, candidateScores, iouThreshold);

  return selectedIndices.map((idx) => {
    const c = candidates[idx];
    return {
      x: c.bbox[0],
      y: c.bbox[1],
      width: c.bbox[2],
      height: c.bbox[3],
      classId: c.classIdx,
      label: COCO_LABELS[c.classIdx] || `class_${c.classIdx}`,
      confidence: c.score,
    };
  });
}
