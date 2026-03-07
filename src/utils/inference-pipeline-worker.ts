import { modelLoader } from "./model-loader.ts";
import { inferencePipeline } from "./inference-pipeline.ts";

// Key: model name, value: ort inference session
const modelCache = new Map();
const offscreen = new OffscreenCanvas(0, 0);
const ctx = offscreen.getContext("2d", { willReadFrequently: true });

self.addEventListener("message", async (event) => {
  const { type, config, bitmap } = event.data;
  const modelKey = config.model + config.backend;

  switch (event.data.type) {
    case "LOAD_MODEL": {
      let modelSession = modelCache.get(modelKey);
      let start = 0;
      let end = 0;
      let msg = `Model is already loaded in cache.`;

      if (!modelSession) {
        start = performance.now();
        modelSession = await modelLoader(config.modelPath, config.backend);
        end = performance.now();
        modelCache.set(modelKey, modelSession);
        msg = `Model loaded successfully.`;
      }

      self.postMessage({
        type: "MODEL_LOADED",
        msg: msg,
        loadTime: (end - start).toFixed(2),
      });
      break;
    }

    case "INFERENCE": {
      // get model session from cache
      const modelSession = modelCache.get(modelKey);

      offscreen.width = bitmap.width;
      offscreen.height = bitmap.height;
      ctx?.drawImage(bitmap, 0, 0);
      const imageData = ctx?.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close();
      if (!imageData) return;
      const [results, inferenceTime] = await inferencePipeline(imageData, modelSession, config);

      self.postMessage({
        type: "RESULT",
        results: results,
        inferenceTime: inferenceTime,
      });

      break;
    }

    default:
      console.warn(`Unknown message type: ${type}`);
      break;
  }
});
