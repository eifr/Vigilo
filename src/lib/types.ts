export type DetectionMode = "opencv" | "yolo";

export interface OpenCVConfig {
  diffThreshold: number;
  motionAreaPercentage: number;
}

export interface YOLOConfig {
  confidenceThreshold: number;
  modelPath?: string;
  backend?: "webgpu" | "wasm" | "cpu";
  scoreThreshold?: number;
  iouThreshold?: number;
  imgszType?: "dynamic" | "zeroPad";
}

export interface TrackedObject {
  className: string;
  isTracking: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

// Worker Messages
export type WorkerMessage =
  | { type: "INIT_OPENCV"; config: OpenCVConfig }
  | { type: "INIT_YOLO"; config: YOLOConfig }
  | { type: "UPDATE_CONFIG_OPENCV"; config: OpenCVConfig }
  | { type: "UPDATE_CONFIG_YOLO"; config: YOLOConfig }
  | { type: "PROCESS_FRAME"; imageData?: ImageData; imageBitmap?: ImageBitmap; timestamp: number }
  | { type: "CLEANUP" };

export type WorkerResponse =
  | { type: "INITIALIZED"; backend: DetectionMode; success: boolean; error?: string }
  | { type: "MOTION_DETECTED"; timestamp: number; boxes: BoundingBox[]; frameDataUrl?: string }
  | { type: "OBJECTS_DETECTED"; timestamp: number; boxes: BoundingBox[]; frameDataUrl?: string }
  | { type: "ERROR"; error: string }
  | { type: "PROCESSING_DONE" }; // used to release main thread lock
