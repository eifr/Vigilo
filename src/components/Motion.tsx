import { useEffect, useRef, useState, useCallback } from "preact/hooks";
import { useDetectionBackend } from "../hooks/useDetectionBackend";
import { ErrorBoundary } from "./ErrorBoundary";
import { getUserMediaWithTimeout, stopMediaStream } from "../lib/utils";
import type { BoundingBox, WorkerMessage, WorkerResponse } from "../lib/types";
import { motion } from "motion/react";
// import { Cpu, Zap } from "lucide-react";
import { drawDetections } from "../lib/drawing-utils";

// Use standard URL construction for Vite Web Workers
import OpenCVWorker from "../workers/opencv.worker.ts?worker";
import YOLOWorker from "../workers/yolo.worker.ts?worker";

interface MotionWithOverlayProps {
  deviceId: string;
  onMotion?: (timestamp: Date, frame: string, deviceId: string, boxes: BoundingBox[]) => void;
  onLatestFrame?: (frame: string) => void;
  intervalMs?: number;
  hidePreview?: boolean;
}

type LoadingPhase = "idle" | "loading-worker" | "accessing-camera" | "ready" | "error";

export const CameraMotionDetector = ({
  deviceId,
  onMotion,
  onLatestFrame,
  // intervalMs = 200, // Unused in optimized loop
  hidePreview = false,
}: MotionWithOverlayProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [currentBoxes, setCurrentBoxes] = useState<BoundingBox[]>([]);

  const { mode, opencvConfig, yoloConfig, webgpuEnabled } = useDetectionBackend();
  const isProcessingRef = useRef(false);

  // Store callbacks in refs to avoid re-triggering effects
  const onMotionRef = useRef(onMotion);
  const onLatestFrameRef = useRef(onLatestFrame);

  useEffect(() => {
    onMotionRef.current = onMotion;
    onLatestFrameRef.current = onLatestFrame;
  }, [onMotion, onLatestFrame]);

  // Clean up function
  const cleanup = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CLEANUP" } as WorkerMessage);
      // Let the worker clean itself up via self.close()
      // workerRef.current.terminate();
      workerRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLoadingPhase("error");
    }
    return cleanup;
  }, [cleanup]);

  const captureFrame = useCallback((video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.8);
    } catch (e) {
      console.error("Failed to capture frame", e);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingPhase("loading-worker");

    // Initialize the chosen worker
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CLEANUP" } as WorkerMessage);
      // Let the worker terminate itself instead
      // workerRef.current.terminate();
    }

    const worker = mode === "opencv" ? new OpenCVWorker() : new YOLOWorker();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (!active) return;
      const res = e.data;

      switch (res.type) {
        case "INITIALIZED":
          console.log("Motion: Worker initialized", res);
          if (res.success) {
            startCamera();
          } else {
            console.error(`Worker init failed: ${res.error}`);
            setLoadingPhase("error");
          }
          break;
        case "MOTION_DETECTED":
        case "OBJECTS_DETECTED":
          setCurrentBoxes(res.boxes);
          setIsMotionDetected(true);
          window.setTimeout(() => setIsMotionDetected(false), 500);

          if (onMotionRef.current && videoRef.current) {
            const frameDataUrl = captureFrame(videoRef.current);
            if (frameDataUrl) {
              onMotionRef.current(new Date(res.timestamp), frameDataUrl, deviceId, res.boxes);
            }
          }
          break;
        case "ERROR":
          console.error(`${mode} Worker Error:`, res.error);
          break;
        case "PROCESSING_DONE":
          isProcessingRef.current = false;
          break;
      }
    };

    // Send Init message
    if (mode === "opencv") {
      worker.postMessage({ type: "INIT_OPENCV", config: opencvConfig } as WorkerMessage);
    } else {
      worker.postMessage({ type: "INIT_YOLO", config: yoloConfig, webgpuEnabled } as WorkerMessage);
    }

    const startCamera = async () => {
      console.log("Motion: requesting camera access...");
      try {
        setLoadingPhase("accessing-camera");
        const stream = await getUserMediaWithTimeout(
          {
            video: {
              deviceId: { exact: deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          5000,
        );

        console.log("Motion: Camera stream obtained");
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Motion: Video metadata loaded, setting ready");
            videoRef.current?.play().catch(console.error);
            setLoadingPhase("ready");
          };
        }
      } catch (err) {
        console.error("Motion: Camera error", err);
        setLoadingPhase("error");
      }
    };

    return () => {
      active = false;
      cleanup();
    };
  }, [mode, deviceId, cleanup, captureFrame]); // Only reinit worker on mode or deviceId change

  // Update config without reloading worker
  useEffect(() => {
    if (!workerRef.current || loadingPhase !== "ready") return;
    if (mode === "opencv") {
      workerRef.current.postMessage({
        type: "UPDATE_CONFIG_OPENCV",
        config: opencvConfig,
      } as WorkerMessage);
    } else {
      workerRef.current.postMessage({
        type: "UPDATE_CONFIG_YOLO",
        config: yoloConfig,
      } as WorkerMessage);
    }
  }, [opencvConfig, yoloConfig, mode, loadingPhase]);

  // The processing loop (RequestAnimationFrame)
  useEffect(() => {
    if (loadingPhase !== "ready" || !videoRef.current || !workerRef.current) return;

    let animationFrameId: number;
    let isActive = true;

    // Use a single offscreen canvas for resizing/capturing to avoid recreating elements
    const displayCanvas = document.createElement("canvas");
    const displayCtx = displayCanvas.getContext("2d");

    const loop = async () => {
      if (!isActive) return;

      // 1. Check if we should process this frame
      if (
        !isProcessingRef.current &&
        videoRef.current &&
        !videoRef.current.paused &&
        videoRef.current.videoWidth > 0 &&
        displayCtx
      ) {
        isProcessingRef.current = true;
        const timestamp = Date.now();

        try {
          // For latest frame preview (optional)
          if (onLatestFrameRef.current) {
            displayCanvas.width = videoRef.current.videoWidth;
            displayCanvas.height = videoRef.current.videoHeight;
            displayCtx.drawImage(videoRef.current, 0, 0);
            onLatestFrameRef.current(displayCanvas.toDataURL("image/jpeg", 0.8));
          }

          if (mode === "yolo") {
            // Fast path for YOLO
            const bitmap = await createImageBitmap(videoRef.current);
            workerRef.current?.postMessage(
              {
                type: "PROCESS_FRAME",
                imageBitmap: bitmap,
                timestamp,
              },
              [bitmap],
            );
          } else {
            // OpenCV mode - legacy path (keep using ImageData)
            if (!onLatestFrame) {
              displayCanvas.width = videoRef.current.videoWidth;
              displayCanvas.height = videoRef.current.videoHeight;
              displayCtx.drawImage(videoRef.current, 0, 0);
            }

            const imageData = displayCtx.getImageData(
              0,
              0,
              displayCanvas.width,
              displayCanvas.height,
            );

            workerRef.current?.postMessage({
              type: "PROCESS_FRAME",
              imageData,
              timestamp,
            } as WorkerMessage);
          }
        } catch (err) {
          console.error("Frame capture error:", err);
          isProcessingRef.current = false;
        }
      }

      // 2. Schedule next check immediately
      // If worker is still busy, next loop iteration will just skip processing
      animationFrameId = requestAnimationFrame(loop);
    };

    // Kick off the loop
    loop();

    return () => {
      isActive = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [loadingPhase, mode]); // Removed onLatestFrame from dependencies

  // Canvas Drawing Loop
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || hidePreview) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Sync canvas size with video
    if (
      canvasRef.current.width !== videoRef.current.videoWidth ||
      canvasRef.current.height !== videoRef.current.videoHeight
    ) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (currentBoxes.length === 0) return;

    // Use optimized drawing utility
    drawDetections(ctx, currentBoxes, mode);
  }, [currentBoxes, hidePreview, mode]);

  // const showLoading = loadingPhase !== "ready" && loadingPhase !== "idle";
  // const BackendIcon = mode === "yolo" ? Zap : Cpu;

  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">Camera feed unavailable.</p>
        </div>
      }
    >
      <motion.div
        className="relative"
        animate={{
          boxShadow: isMotionDetected
            ? "0 0 20px 5px rgba(239, 68, 68, 0.5)"
            : "0 0 0px 0px rgba(239, 68, 68, 0)",
          borderRadius: "0.5rem",
          border: isMotionDetected
            ? "2px solid hsl(var(--destructive))"
            : "1px solid hsl(var(--border))",
          overflow: "hidden",
        }}
        transition={{ duration: 0.2 }}
      >
        {/* <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-full p-1 z-10"> */}
        {/*   <BackendIcon className="w-4 h-4" /> */}
        {/* </div> */}
        {/**/}
        {/* {showLoading && ( */}
        {/*   <div className="w-full h-full absolute inset-0 bg-background/90 backdrop-blur-sm rounded-md flex flex-col items-center justify-center z-20"> */}
        {/*     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div> */}
        {/*     <div className="text-sm font-medium text-foreground mb-1"> */}
        {/*       {loadingPhase === 'loading-worker' ? `Loading ${mode.toUpperCase()} Engine...` : 'Accessing Camera...'} */}
        {/*     </div> */}
        {/*     {mode === 'yolo' && loadingPhase === 'loading-worker' && ( */}
        {/*       <div className="text-xs text-muted-foreground">Downloading AI Model on first run</div> */}
        {/*     )} */}
        {/*   </div> */}
        {/* )} */}
        {/**/}
        {/* {cameraError && loadingPhase === 'error' && ( */}
        {/*   <div className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-md flex flex-col items-center justify-center z-30 p-4"> */}
        {/*     <div className="text-destructive text-center mb-3"> */}
        {/*       <p className="font-medium">Camera Error</p> */}
        {/*       <p className="text-sm text-muted-foreground mt-1">{cameraError}</p> */}
        {/*     </div> */}
        {/*   </div> */}
        {/* )} */}
        {/**/}
        <video ref={videoRef} className="w-full h-auto rounded-md block" autoPlay playsInline />

        {/* <canvas */}
        {/*   ref={canvasRef} */}
        {/*   className="absolute inset-0 w-full h-full pointer-events-none" */}
        {/*   style={{ display: hidePreview ? "none" : "block" }} */}
        {/* /> */}
        {/**/}
        {/* {isMotionDetected && ( */}
        {/*   <motion.div */}
        {/*     initial={{ opacity: 0, scale: 0.8 }} */}
        {/*     animate={{ opacity: 1, scale: 1 }} */}
        {/*     exit={{ opacity: 0, scale: 0.8 }} */}
        {/*     className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full" */}
        {/*   > */}
        {/*     <AlertTriangle className="w-4 h-4" /> */}
        {/*   </motion.div> */}
        {/* )} */}
      </motion.div>
    </ErrorBoundary>
  );
};
