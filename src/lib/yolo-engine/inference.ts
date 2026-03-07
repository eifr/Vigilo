// @ts-ignore - ONNX Runtime Web types
import * as ort from "onnxruntime-web";
import cv from "@techstark/opencv-js";

import type { YOLOConfig, InferenceResult } from "./types";
import { ModelLoader } from "./loader";
import { preProcessImage } from "./preprocess";
import { postProcess } from "./postprocess";

export class InferencePipeline {
  private session: any = null;
  private config: YOLOConfig;

  constructor(config: YOLOConfig) {
    this.config = config;
  }

  async init(webgpuEnabled: boolean = true) {
    if (this.session) return;

    // Initialize OpenCV
    if (cv instanceof Promise) {
      await cv;
    } else if ((cv as any).onRuntimeInitialized !== undefined) {
      await new Promise((resolve) => {
        (cv as any).onRuntimeInitialized = () => resolve(true);
      });
    }

    // Use config backend or fallback logic
    let backend: "webgpu" | "wasm" | "cpu" = this.config.backend || "webgpu";

    // Override if webgpuEnabled matches legacy flag
    if (!webgpuEnabled && backend === "webgpu") {
      backend = "wasm";
    }

    if (backend === "webgpu") {
      const nav = navigator as any;
      if (!nav.gpu) {
        console.warn("WebGPU not available, falling back to WASM");
        backend = "wasm";
      }
    }

    try {
      this.session = await ModelLoader.load(this.config.modelPath, backend);
    } catch (e) {
      console.warn(`InferencePipeline: Failed to load with ${backend}, falling back to wasm`);
      if (backend === "webgpu") {
        this.session = await ModelLoader.load(this.config.modelPath, "wasm");
      } else {
        throw e;
      }
    }
  }

  async run(imageData: ImageData): Promise<InferenceResult> {
    if (!this.session) throw new Error("Session not initialized");

    const start = performance.now();

    // 1. Convert to Mat
    const mat = cv.matFromImageData(imageData);

    // 2. Preprocess
    const [inputTensor, xRatio, yRatio] = preProcessImage(
      mat,
      [imageData.width, imageData.height],
      this.config.imgszType,
    );

    // Release the input mat immediately to prevent memory leak
    mat.delete();

    // 3. Run Inference
    const feeds: Record<string, any> = {};
    feeds[this.session.inputNames[0]] = inputTensor;

    let outputTensor: any = null;

    try {
      const results = await this.session.run(feeds);
      outputTensor = results[this.session.outputNames[0]];
      const end = performance.now();

      // 4. Postprocess
      const boxes = postProcess(
        { data: outputTensor.data, dims: outputTensor.dims },
        this.config.scoreThreshold,
        this.config.iouThreshold,
        xRatio,
        yRatio,
      );

      return {
        boxes,
        inferenceTime: end - start,
      };
    } finally {
      // Cleanup
      inputTensor.dispose();
      if (outputTensor) {
        outputTensor.dispose();
      }
    }
  }

  updateConfig(newConfig: YOLOConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  async dispose() {
    if (this.session) {
      try {
        await this.session.release();
      } catch (e) {
        console.warn("Error releasing session:", e);
      }
      this.session = null;
    }
  }
}
