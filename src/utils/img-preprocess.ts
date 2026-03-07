import cv from "@techstark/opencv-js";
import { Tensor } from "onnxruntime-web/webgpu";

// Define custom types for clearer return signatures
type PreProcessResult = [Tensor, number, number];
type ImgszType = "dynamic" | "zeroPad";
type RGBA = [number, number, number, number];

/**
 * Pre-process input image.
 */
const preProcessImage = (
  srcMat: cv.Mat,
  outputSize: [number, number],
  imgszType: ImgszType,
): PreProcessResult => {
  let preProcessedMat: cv.Mat;
  let xRatio: number = 1;
  let yRatio: number = 1;
  let inputTensor: Tensor;
  let div_width: number;
  let div_height: number;

  if (imgszType === "dynamic") {
    const dynamicResult = dynamicInputProcess(srcMat, outputSize);
    [preProcessedMat, xRatio, yRatio, div_width, div_height] = dynamicResult;

    // create input tensor
    inputTensor = new Tensor("float32", preProcessedMat.data32F, [1, 3, div_height, div_width]);
  } else {
    // Default to "zeroPad"
    const modelDefaultInputSize: [number, number] = [640, 640];
    const zeroPadResult = zeroPadInputProcess(srcMat, modelDefaultInputSize, outputSize);
    [preProcessedMat, xRatio, yRatio] = zeroPadResult;

    // create input tensor
    inputTensor = new Tensor("float32", preProcessedMat.data32F, [
      1,
      3,
      modelDefaultInputSize[1],
      modelDefaultInputSize[0],
    ]);
  }

  preProcessedMat.delete();
  return [inputTensor, xRatio, yRatio];
};

/**
 * Zero padding to square and resize to input size.
 */
const zeroPadInputProcess = (
  srcMat: cv.Mat,
  modelSize: [number, number],
  outputSize: [number, number],
): [cv.Mat, number, number] => {
  cv.cvtColor(srcMat, srcMat, cv.COLOR_RGBA2RGB);

  // Resize to dimensions divisible by 32
  const [div_width, div_height] = divStride(32, srcMat.cols, srcMat.rows);
  cv.resize(srcMat, srcMat, new cv.Size(div_width, div_height));

  // Padding to square
  const max_dim = Math.max(div_width, div_height);
  const right_pad = max_dim - div_width;
  const bottom_pad = max_dim - div_height;

  cv.copyMakeBorder(
    srcMat,
    srcMat,
    0,
    bottom_pad,
    0,
    right_pad,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0, 0, 0),
  );

  // Resize to input size and normalize to [0, 1]
  const preProcessed = cv.blobFromImage(
    srcMat,
    1 / 255.0,
    new cv.Size(modelSize[0], modelSize[1]),
    new cv.Scalar(0, 0, 0, 0),
    false,
    false,
  );

  const xRatio = (outputSize[0] / div_width) * (max_dim / outputSize[0]);
  const yRatio = (outputSize[1] / div_height) * (max_dim / outputSize[1]);

  return [preProcessed, xRatio, yRatio];
};

/**
 * Pre process input image for dynamic input model.
 */
const dynamicInputProcess = (
  mat: cv.Mat,
  outputSize: [number, number],
): [cv.Mat, number, number, number, number] => {
  cv.cvtColor(mat, mat, cv.COLOR_RGBA2RGB);

  const [div_width, div_height] = divStride(32, mat.cols, mat.rows);

  const preProcessedMat = cv.blobFromImage(
    mat,
    1 / 255.0,
    new cv.Size(div_width, div_height),
    new cv.Scalar(0, 0, 0, 0),
    false,
    false,
  );

  const xRatio = outputSize[0] / div_width;
  const yRatio = outputSize[1] / div_height;

  return [preProcessedMat, xRatio, yRatio, div_width, div_height];
};

/**
 * Return height and width divisible by stride.
 **/
const divStride = (stride: number, width: number, height: number): [number, number] => {
  const calc = (val: number) =>
    val % stride >= stride / 2
      ? (Math.floor(val / stride) + 1) * stride
      : Math.floor(val / stride) * stride;

  return [calc(width), calc(height)];
};

/**
 * Ultralytics default color palette
 */
class Colors {
  private static readonly hexCodes: string[] = [
    "042AFF",
    "0BDBEB",
    "F3F3F3",
    "00DFB7",
    "111F68",
    "FF6FDD",
    "FF444F",
    "CCED00",
    "00F344",
    "BD00FF",
    "00B4FF",
    "DD00BA",
    "00FFFF",
    "26C000",
    "01FFB3",
    "7D24FF",
    "7B0068",
    "FF1B6C",
    "FC6D2F",
    "A2FF0B",
  ];

  static readonly palette: RGBA[] = Colors.hexCodes.map((c) => Colors.hex2rgba(`#${c}`));
  static readonly n: number = Colors.palette.length;
  private static cache: Record<string, RGBA> = {};

  static hex2rgba(h: string, alpha: number = 1.0): RGBA {
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
      alpha,
    ];
  }

  static getColor(i: number, alpha: number = 1.0, bgr: boolean = false): RGBA {
    const key = `${i}-${alpha}-${bgr}`;
    if (Colors.cache[key]) {
      return Colors.cache[key];
    }

    const baseColor = Colors.palette[i % Colors.n];
    const rgba: RGBA = [baseColor[0], baseColor[1], baseColor[2], alpha];
    const result: RGBA = bgr ? [rgba[2], rgba[1], rgba[0], rgba[3]] : rgba;

    Colors.cache[key] = result;
    return result;
  }
}

export { preProcessImage, Colors };
