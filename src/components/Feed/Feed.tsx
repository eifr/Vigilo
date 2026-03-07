import { useCallback, useRef, useEffect } from "preact/hooks";
import { useVideoElement } from "./useVideoElement";
import { useInferenceWorker } from "./useInferenceWorker";

import classes from "../../utils/yolo_classes.json";
import { renderOverlay } from "@/utils/render-overlay";

const DEFAULT_MODEL_CONFIG = {
  inputShape: [1, 3, 640, 640],
  overlaySize: [640, 640],
  iouThreshold: 0.35,
  scoreThreshold: 0.45,
  backend: "webgpu",
  model: "yolo11n",
  modelPath: "",
  task: "detect",
  imgszType: "dynamic",
  classes: classes,
};
export const Feed = ({ stream }: { stream: MediaStream }) => {
  const videoRef = useVideoElement(stream);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelConfigRef = useRef(DEFAULT_MODEL_CONFIG);
  const isProcessingRef = useRef(false);

  const handleInferenceResult = useCallback((data: any) => {
    // Determine context for drawing
    const overlayCtx = canvasRef.current?.getContext("2d");
    if (!overlayCtx) return;

    // Clear and draw
    overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
    renderOverlay(data.results, overlayCtx, modelConfigRef.current.classes);
    isProcessingRef.current = false;
  }, []);

  const { postMessage: postInferenceMessage } = useInferenceWorker({
    onModelLoaded: (e) => console.log("Model loaded", e.data),
    onResult: handleInferenceResult,
  });

  const loadModel = useCallback(async () => {
    const modelPath = `${window.location.href}models/${modelConfigRef.current.model}-${modelConfigRef.current.task}.onnx`;

    modelConfigRef.current.modelPath = modelPath;

    postInferenceMessage(
      {
        type: "LOAD_MODEL",
        config: modelConfigRef.current,
      },
      [],
    );
  }, [postInferenceMessage]);
  // Initial load
  useEffect(() => {
    loadModel();
  }, []);

  // Camera Loop
  const startCameraLoop = useCallback(() => {
    const loop = async () => {
      if (!isProcessingRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        isProcessingRef.current = true;
        // Create bitmap from camera
        try {
          const bitmap = await createImageBitmap(videoRef.current);

          // Adjust overlay size if needed
          if (canvasRef.current) {
            if (
              canvasRef.current.width !== videoRef.current.videoWidth ||
              canvasRef.current.height !== videoRef.current.videoHeight
            ) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          }

          modelConfigRef.current.overlaySize = [
            canvasRef.current?.width ?? 0,
            canvasRef.current?.height ?? 0,
          ];

          postInferenceMessage(
            {
              type: "INFERENCE",
              config: modelConfigRef.current,
              bitmap: bitmap,
            },
            [bitmap],
          );
        } catch (e) {
          console.error("Frame capture error:", e);
          isProcessingRef.current = false;
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }, [postInferenceMessage]);

  useEffect(() => {
    startCameraLoop();
  }, []);

  return (
    <div className="relative flex justify-center items-center">
      <video
        ref={videoRef}
        style={{ borderRadius: 8 }}
        className="block w-full rounded-lg object-contain"
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
  );
};
