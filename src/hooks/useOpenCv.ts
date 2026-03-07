import { useState, useEffect } from "preact/hooks";

declare global {
  interface Window {
    cv?: any;
  }
}

let openCVPromise: Promise<any> | null = null;
let openCVLoadTime: number = 0;

export interface OpenCVStatus {
  cv: any;
  loadProgress: number;
  loadStatus: "idle" | "loading" | "ready" | "error";
  loadTime: number;
  error?: string;
}

const useOpenCv = () => {
  const [cv, setCV] = useState<any>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (cv) return;

    setLoadStatus("loading");
    setLoadProgress(0);
    setError(undefined);

    const startTime = Date.now();

    getOpenCv()
      .then((cvModule) => {
        openCVLoadTime = Date.now() - startTime;
        setLoadProgress(100);
        setLoadStatus("ready");
        setCV(cvModule);
      })
      .catch((err) => {
        console.error("Failed to load OpenCV.js:", err);
        setLoadStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load OpenCV.js");
        openCVPromise = null;
      });

    let progressInterval: number;

    const updateProgress = () => {
      setLoadProgress((prev) => {
        if (prev >= 100) {
          if (progressInterval) clearInterval(progressInterval);
          return prev;
        }
        const increment = prev < 30 ? 5 : prev < 60 ? 2 : prev < 80 ? 1 : 0.5;
        return Math.min(prev + increment, 95);
      });
    };

    progressInterval = window.setInterval(updateProgress, 200);

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [cv]);

  return { cv, loadProgress, loadStatus, loadTime: openCVLoadTime, error };
};

export default useOpenCv;

export async function getOpenCv(): Promise<any> {
  if (typeof window.cv !== "undefined") {
    return window.cv;
  }

  if (!openCVPromise) {
    openCVPromise = new Promise((resolve, reject) => {
      import("@techstark/opencv-js")
        .then((cvModule) => {
          if (cvModule.default) {
            cvModule.default.onRuntimeInitialized = () => {
              window.cv = cvModule.default;
              resolve(window.cv);
            };

            // Just in case it's already initialized
            if (cvModule.default.Mat) {
              window.cv = cvModule.default;
              resolve(window.cv);
            }
          } else {
            window.cv = cvModule;
            resolve(window.cv);
          }
        })
        .catch((err) => {
          openCVPromise = null;
          reject(err);
        });
    });
  }

  return openCVPromise;
}

export function isOpenCvReady(): boolean {
  return typeof window.cv !== "undefined";
}
