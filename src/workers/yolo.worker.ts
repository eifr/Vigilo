import { InferencePipeline } from "../lib/yolo-engine/inference";
import type { WorkerMessage, WorkerResponse, YOLOConfig } from "../lib/yolo-engine/types";

// State
let pipeline: InferencePipeline | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

// Initialize Pipeline
async function init(config: YOLOConfig) {
  try {
    console.log("Worker: Initializing Inference Pipeline...");
    pipeline = new InferencePipeline(config);
    await pipeline.init();

    self.postMessage({
      type: "INITIALIZED",
      backend: config.backend,
      success: true,
    } as WorkerResponse);
  } catch (err) {
    console.error("Worker: Initialization failed", err);
    self.postMessage({
      type: "INITIALIZED",
      backend: config.backend,
      success: false,
      error: String(err),
    } as WorkerResponse);
  }
}

// Process Frame
async function process(data: ImageBitmap | ImageData, timestamp: number) {
  if (!pipeline) {
    if ("close" in data) (data as ImageBitmap).close();
    return;
  }

  try {
    let imageData: ImageData;

    // Handle ImageBitmap -> ImageData conversion via OffscreenCanvas
    if ("close" in data) {
      if (
        !offscreenCanvas ||
        offscreenCanvas.width !== data.width ||
        offscreenCanvas.height !== data.height
      ) {
        offscreenCanvas = new OffscreenCanvas(data.width, data.height);
        offscreenCtx = offscreenCanvas.getContext("2d", {
          willReadFrequently: true,
        }) as OffscreenCanvasRenderingContext2D;
      }

      if (!offscreenCtx) throw new Error("Failed to get offscreen context");

      offscreenCtx.drawImage(data as ImageBitmap, 0, 0);
      imageData = offscreenCtx.getImageData(0, 0, data.width, data.height);
      (data as ImageBitmap).close();
    } else {
      imageData = data as ImageData;
    }

    // Run Inference
    const result = await pipeline.run(imageData);

    if (result.boxes.length > 0) {
      self.postMessage({
        type: "OBJECTS_DETECTED",
        timestamp,
        boxes: result.boxes,
        inferenceTime: result.inferenceTime,
      } as WorkerResponse);
    }
  } catch (err) {
    console.error("Worker: Processing failed", err);
    self.postMessage({ type: "ERROR", error: String(err) } as WorkerResponse);
  } finally {
    self.postMessage({ type: "PROCESSING_DONE" } as WorkerResponse);
  }
}

// Message Handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT_YOLO":
      // Ensure defaults
      const defaultConfig: YOLOConfig = {
        modelPath: "/yolo11n.onnx",
        backend: "webgpu",
        scoreThreshold: 0.25,
        iouThreshold: 0.45,
        imgszType: "zeroPad",
      };

      // Handle legacy config mapping
      const inputConfig = msg.config as any;
      const mergedConfig = { ...defaultConfig };
      if (inputConfig) {
        if (inputConfig.scoreThreshold !== undefined)
          mergedConfig.scoreThreshold = inputConfig.scoreThreshold;
        if (inputConfig.iouThreshold !== undefined)
          mergedConfig.iouThreshold = inputConfig.iouThreshold;
        if (inputConfig.imgszType !== undefined) mergedConfig.imgszType = inputConfig.imgszType;
        if (inputConfig.backend !== undefined) mergedConfig.backend = inputConfig.backend;
        if (inputConfig.confidenceThreshold !== undefined) {
          mergedConfig.scoreThreshold = inputConfig.confidenceThreshold;
        }
      }

      await init(mergedConfig);
      break;

    case "PROCESS_FRAME":
      if (msg.imageBitmap) {
        await process(msg.imageBitmap, msg.timestamp || 0);
      } else if (msg.imageData) {
        await process(msg.imageData, msg.timestamp || 0);
      }
      break;

    case "UPDATE_CONFIG_YOLO":
      if (pipeline && msg.config) {
        pipeline.updateConfig(msg.config);
      }
      break;

    case "CLEANUP":
      if (pipeline) {
        await pipeline.dispose();
        pipeline = null;
      }
      offscreenCanvas = null;
      offscreenCtx = null;
      self.close(); // Cleanly exit the worker after resources are released
      break;
  }
};
