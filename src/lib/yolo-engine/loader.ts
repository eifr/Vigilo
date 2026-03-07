// @ts-ignore - ONNX Runtime Web types
import * as ort from "onnxruntime-web";

export class ModelLoader {
  static async load(modelPath: string, backend: "webgpu" | "wasm" | "cpu" = "webgpu") {
    console.log(`ModelLoader: Loading ${modelPath} with backend ${backend}...`);

    const options: any = {
      executionProviders: [backend],
      graphOptimizationLevel: "all",
    };

    try {
      const session = await ort.InferenceSession.create(modelPath, options);
      console.log("ModelLoader: Session created");

      // Warmup
      const DEFAULT_INPUT_SIZE = [1, 3, 640, 640];
      const dummyTensor = new ort.Tensor(
        "float32",
        new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
        DEFAULT_INPUT_SIZE,
      );

      console.log("ModelLoader: Running warmup...");
      const warmupResults = await session.run({ images: dummyTensor });

      // Dispose warmup outputs
      for (const key in warmupResults) {
        const val = warmupResults[key];
        if (val && typeof val.dispose === "function") {
          val.dispose();
        }
      }

      dummyTensor.dispose();
      console.log("ModelLoader: Warmup complete");

      return session;
    } catch (err) {
      console.error("ModelLoader: Failed to load model", err);
      throw err;
    }
  }
}
