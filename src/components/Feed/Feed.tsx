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

interface FeedProps {
  stream: MediaStream;
  deviceId: string;
  onMotion: (timestamp: Date, frame: string, deviceId: string, boxes: any[]) => void;
  onLatestFrame: (deviceId: string, frame: string) => void;
  intervalMs: number;
}

export const Feed = ({ stream, deviceId, onMotion, onLatestFrame, intervalMs }: FeedProps) => {
  const videoRef = useVideoElement(stream);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelConfigRef = useRef(DEFAULT_MODEL_CONFIG);
  const isProcessingRef = useRef(false);
  const lastMotionTimeRef = useRef<number>(0);
  const lastFrameCaptureTimeRef = useRef<number>(0);

  const handleInferenceResult = useCallback((data: any) => {
    // Determine context for drawing
    const overlayCtx = canvasRef.current?.getContext("2d");
    if (!overlayCtx) return;

    // Clear and draw
    overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
    renderOverlay(data.results, overlayCtx, modelConfigRef.current.classes);
    
    // Check for objects and send motion event if interval passed
    if (data.results && data.results.length > 0) {
      const now = Date.now();
      if (now - lastMotionTimeRef.current >= intervalMs) {
        lastMotionTimeRef.current = now;
        
        // Capture frame for Telegram
        if (videoRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            onMotion(new Date(now), dataUrl, deviceId, data.results);
          }
        }
      }
    }
    
    isProcessingRef.current = false;
  }, [deviceId, onMotion, intervalMs]);

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
  }, [loadModel]);

  // Camera Loop
  const startCameraLoop = useCallback(() => {
    const loop = async () => {
      if (!isProcessingRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        isProcessingRef.current = true;
        
        // Background frame capture for /status command (every 1 second max)
        const now = Date.now();
        if (now - lastFrameCaptureTimeRef.current > 1000) {
          lastFrameCaptureTimeRef.current = now;
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.5); // lower quality for fast status
            onLatestFrame(deviceId, dataUrl);
          }
        }
        
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
  }, [postInferenceMessage, deviceId, onLatestFrame]);

  useEffect(() => {
    startCameraLoop();
  }, [startCameraLoop]);

  return (
    <div className="relative flex justify-center items-center mt-4">
      <video
        ref={videoRef}
        style={{ borderRadius: 8 }}
        className="block w-full rounded-lg object-contain"
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
  );
};
