// @ts-ignore - ONNX Runtime Web types
import { Tensor } from "onnxruntime-web";
import cv from "@techstark/opencv-js";

// Helper for dynamic stride calculation
function divStride(stride: number, width: number, height: number): [number, number] {
  const divWidth =
    width % stride >= stride / 2
      ? (Math.floor(width / stride) + 1) * stride
      : Math.floor(width / stride) * stride;
  const divHeight =
    height % stride >= stride / 2
      ? (Math.floor(height / stride) + 1) * stride
      : Math.floor(height / stride) * stride;
  return [divWidth, divHeight];
}

// Dynamic Input Process (Stride 32)
function dynamicInputProcess(
  mat: any,
  outputSize: [number, number],
): [any, number, number, number, number] {
  cv.cvtColor(mat, mat, cv.COLOR_RGBA2RGB);

  const [div_width, div_height] = divStride(32, mat.cols, mat.rows);

  // Create a new mat for resizing instead of resizing in place to avoid issues if mat is reused
  const resizedMat = new cv.Mat();
  cv.resize(mat, resizedMat, new cv.Size(div_width, div_height));

  const blob = cv.blobFromImage(
    resizedMat,
    1 / 255.0,
    new cv.Size(div_width, div_height),
    new cv.Scalar(0, 0, 0),
    false,
    false,
  );

  const xRatio = outputSize[0] / div_width;
  const yRatio = outputSize[1] / div_height;

  // Cleanup intermediate mat
  resizedMat.delete();

  return [blob, xRatio, yRatio, div_width, div_height];
}

// Zero Pad Input Process (Square 640x640)
function zeroPadInputProcess(
  srcMat: any,
  modelSize: [number, number],
  outputSize: [number, number],
): [any, number, number] {
  cv.cvtColor(srcMat, srcMat, cv.COLOR_RGBA2RGB);

  const [div_width, div_height] = divStride(32, srcMat.cols, srcMat.rows);

  const resizedMat = new cv.Mat();
  cv.resize(srcMat, resizedMat, new cv.Size(div_width, div_height));

  const max_dim = Math.max(div_width, div_height);
  const right_pad = max_dim - div_width;
  const bottom_pad = max_dim - div_height;

  const paddedMat = new cv.Mat();
  cv.copyMakeBorder(
    resizedMat,
    paddedMat,
    0,
    bottom_pad,
    0,
    right_pad,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0, 0, 0),
  );

  const blob = cv.blobFromImage(
    paddedMat,
    1 / 255.0,
    new cv.Size(modelSize[0], modelSize[1]),
    new cv.Scalar(0, 0, 0),
    false,
    false,
  );

  const xRatio = (outputSize[0] / div_width) * (max_dim / outputSize[0]); // Simplified from ref logic check
  const yRatio = (outputSize[1] / div_height) * (max_dim / outputSize[1]);

  // Cleanup
  resizedMat.delete();
  paddedMat.delete();

  return [blob, xRatio, yRatio];
}

export function preProcessImage(
  srcMat: any,
  outputSize: [number, number],
  imgszType: "dynamic" | "zeroPad" = "zeroPad",
): [Tensor, number, number] {
  let preProcessedMat: any;
  let xRatio: number;
  let yRatio: number;
  let inputTensor: Tensor;

  if (imgszType === "dynamic") {
    let div_width: number, div_height: number;
    [preProcessedMat, xRatio, yRatio, div_width, div_height] = dynamicInputProcess(
      srcMat,
      outputSize,
    );

    // Create tensor [1, 3, H, W]
    const dataCopy = new Float32Array(preProcessedMat.data32F);
    inputTensor = new Tensor("float32", dataCopy, [1, 3, div_height, div_width]);
  } else {
    // Zero Pad (Standard 640x640)
    const modelDefaultInputSize: [number, number] = [640, 640];
    [preProcessedMat, xRatio, yRatio] = zeroPadInputProcess(
      srcMat,
      modelDefaultInputSize,
      outputSize,
    );

    // Copy data to new Float32Array to safely release OpenCV memory
    const dataCopy = new Float32Array(preProcessedMat.data32F);
    inputTensor = new Tensor("float32", dataCopy, [
      1,
      3,
      modelDefaultInputSize[1],
      modelDefaultInputSize[0],
    ]);
  }

  // Release blob memory immediately after tensor creation
  preProcessedMat.delete();

  return [inputTensor, xRatio, yRatio];
}
