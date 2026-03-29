import { useCallback, useRef, useEffect, useState } from "preact/hooks";
import { Loader2 } from "lucide-react";
import { useVideoElement } from "./useVideoElement";
import { useInferenceWorker } from "./useInferenceWorker";
import { useDarkMotionDetector } from "./useDarkMotionDetector";
import { useFlashLight } from "../../hooks/useFlashLight";
import { useDetectionBackend } from "../../hooks/useDetectionBackend";

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

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const { flashOnMovement, flashDurationMs, yoloConfig } = useDetectionBackend();

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

  const { isScreenFlashActive, isFlashActive, triggerFlash } = useFlashLight(stream, flashOnMovement, flashDurationMs);
  const { checkFrame: checkDarkMotion } = useDarkMotionDetector(triggerFlash, isFlashActive);

  const handleModelLoaded = useCallback((e: any) => {
    console.log("Model loaded", e.data);
    setIsModelLoaded(true);
  }, []);

  const { postMessage: postInferenceMessage } = useInferenceWorker({
    onModelLoaded: handleModelLoaded,
    onResult: handleInferenceResult,
  });

  const loadModel = useCallback(async () => {
    setIsModelLoaded(false);
    const modelPath = `${window.location.href}models/${modelConfigRef.current.model}-${modelConfigRef.current.task}.onnx`;

    modelConfigRef.current.modelPath = modelPath;
    modelConfigRef.current.backend = yoloConfig.backend || "webgpu";
    modelConfigRef.current.scoreThreshold = yoloConfig.confidenceThreshold || 0.45;
    modelConfigRef.current.iouThreshold = yoloConfig.iouThreshold || 0.45;

    postInferenceMessage(
      {
        type: "LOAD_MODEL",
        config: modelConfigRef.current,
      },
      [],
    );
  }, [postInferenceMessage, yoloConfig]);
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
        
        if (flashOnMovement) {
          checkDarkMotion(videoRef.current);
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
    <>
      {isScreenFlashActive && (
        <div className="fixed inset-0 z-[9999] bg-white w-screen h-screen pointer-events-none" />
      )}
    <div className="relative flex justify-center items-center mt-4 min-h-[300px] bg-black/5 dark:bg-white/5 rounded-lg">
      {!isModelLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-background/80 backdrop-blur-sm rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">Loading AI Model...</p>
          <p className="text-xs text-muted-foreground mt-1 text-center max-w-[80%]">
            First load may take a moment while downloading the model.
          </p>
        </div>
      )}
      <video
        ref={videoRef}
        style={{ borderRadius: 8 }}
        className="block w-full rounded-lg object-contain"
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
    </>
  );
};
