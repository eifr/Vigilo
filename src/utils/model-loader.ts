import { InferenceSession, Tensor, env } from "onnxruntime-web/webgpu";

// Configure ONNX Runtime to use CDN for WASM files to bypass Cloudflare Pages 25MB limit
env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/";

/**
 * Loads an ONNX model and performs a warm-up inference run.
 * @param modelPath - URL or path to the .onnx model file
 * @param backend - Execution provider (e.g., 'webgpu', 'wasm')
 * @returns A promise that resolves to the loaded InferenceSession
 */
export async function modelLoader(
  modelPath: string, // <-- Changed to strictly string to satisfy the overload
  backend: string,
): Promise<InferenceSession> {
  const DEFAULT_INPUT_SIZE: [number, number, number, number] = [1, 3, 640, 640];

  // load model
  const yolo_model = await InferenceSession.create(modelPath, {
    executionProviders: [backend],
  });

  // Calculate the total number of elements for the flat array
  const tensorSize = DEFAULT_INPUT_SIZE.reduce((a, b) => a * b);

  // warm up
  const dummy_input_tensor = new Tensor(
    "float32",
    new Float32Array(tensorSize),
    DEFAULT_INPUT_SIZE,
  );

  const { output0 } = await yolo_model.run({ images: dummy_input_tensor });

  // Explicitly dispose of WebGPU tensors
  if (typeof (output0 as any).dispose === "function") {
    (output0 as any).dispose();
  }
  if (typeof (dummy_input_tensor as any).dispose === "function") {
    (dummy_input_tensor as any).dispose();
  }

  return yolo_model;
}
