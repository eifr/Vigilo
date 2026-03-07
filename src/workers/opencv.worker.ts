import type { WorkerMessage, WorkerResponse, BoundingBox, OpenCVConfig } from "../lib/types";
import cv from "@techstark/opencv-js";

let isInitialized = false;
let config: OpenCVConfig = { diffThreshold: 25, motionAreaPercentage: 1.0 };
let previousFrame: any = null;

// Initialize OpenCV asynchronously
async function initOpenCV(initialConfig: OpenCVConfig) {
  config = initialConfig;
  try {
    // Wait for runtime to be ready if it isn't
    if (cv instanceof Promise) {
      await cv;
    } else if (cv.onRuntimeInitialized !== undefined) {
      await new Promise((resolve) => {
        cv.onRuntimeInitialized = () => resolve(true);
      });
    }

    isInitialized = true;
    self.postMessage({ type: "INITIALIZED", backend: "opencv", success: true } as WorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "INITIALIZED",
      backend: "opencv",
      success: false,
      error: String(err),
    } as WorkerResponse);
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT_OPENCV":
      await initOpenCV(msg.config);
      break;

    case "UPDATE_CONFIG_OPENCV":
      config = msg.config;
      break;

    case "PROCESS_FRAME":
      if (!isInitialized) {
        self.postMessage({ type: "PROCESSING_DONE" } as WorkerResponse);
        return;
      }
      if (msg.imageData) {
        processFrame(msg.imageData, msg.timestamp);
      }
      break;

    case "CLEANUP":
      if (previousFrame) {
        previousFrame.delete();
        previousFrame = null;
      }
      isInitialized = false;
      break;
  }
};

function processFrame(imageData: ImageData, timestamp: number) {
  let currentFrame: any = null;
  let currentGray: any = null;
  let previousGray: any = null;
  let diff: any = null;
  let threshold: any = null;
  let contours: any = null;
  let hierarchy: any = null;

  try {
    currentFrame = cv.matFromImageData(imageData);

    if (!previousFrame) {
      previousFrame = currentFrame.clone();
      self.postMessage({ type: "PROCESSING_DONE" } as WorkerResponse);
      return;
    }

    currentGray = new cv.Mat();
    previousGray = new cv.Mat();

    cv.cvtColor(currentFrame, currentGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(previousFrame, previousGray, cv.COLOR_RGBA2GRAY);

    diff = new cv.Mat();
    cv.absdiff(currentGray, previousGray, diff);

    threshold = new cv.Mat();
    cv.threshold(diff, threshold, config.diffThreshold, 255, cv.THRESH_BINARY);

    // Optional: Morphological operations to remove noise
    // let M = cv.Mat.ones(5, 5, cv.CV_8U);
    // cv.erode(threshold, threshold, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    // cv.dilate(threshold, threshold, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    // M.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.findContours(threshold, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const totalArea = imageData.width * imageData.height;
    const minContourArea = (config.motionAreaPercentage / 100) * totalArea;
    const boxes: BoundingBox[] = [];

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= minContourArea) {
        const rect = cv.boundingRect(cnt);
        boxes.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
      cnt.delete();
    }

    // Update previous frame
    previousFrame.delete();
    previousFrame = currentFrame.clone();

    if (boxes.length > 0) {
      self.postMessage({
        type: "MOTION_DETECTED",
        timestamp,
        boxes,
      } as WorkerResponse);
    }
  } catch (error) {
    console.error("OpenCV processing error:", error);
    self.postMessage({ type: "ERROR", error: String(error) } as WorkerResponse);
  } finally {
    // Cleanup
    if (currentFrame) currentFrame.delete();
    if (currentGray) currentGray.delete();
    if (previousGray) previousGray.delete();
    if (diff) diff.delete();
    if (threshold) threshold.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }

  self.postMessage({ type: "PROCESSING_DONE" } as WorkerResponse);
}
