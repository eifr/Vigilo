export interface YOLOConfig {
  modelPath: string;
  backend: "webgpu" | "wasm" | "cpu";
  scoreThreshold: number;
  iouThreshold: number;
  imgszType: "dynamic" | "zeroPad"; // dynamic (stride 32) or zeroPad (square 640x640)
  overlaySize?: [number, number]; // For scaling back
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  classId: number;
}

export interface InferenceResult {
  boxes: BoundingBox[];
  inferenceTime: number;
}

export interface WorkerMessage {
  type: "INIT_YOLO" | "PROCESS_FRAME" | "UPDATE_CONFIG_YOLO" | "CLEANUP";
  config?: YOLOConfig;
  imageData?: ImageData;
  imageBitmap?: ImageBitmap;
  timestamp?: number;
}

export interface WorkerResponse {
  type: "INITIALIZED" | "OBJECTS_DETECTED" | "PROCESSING_DONE" | "ERROR" | "MODEL_LOADED";
  success?: boolean;
  backend?: string;
  error?: string;
  boxes?: BoundingBox[];
  timestamp?: number;
  inferenceTime?: number;
  loadTime?: number;
  msg?: string;
}
