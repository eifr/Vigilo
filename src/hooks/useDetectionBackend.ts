import { useState, useEffect, useCallback } from "preact/hooks";
import type { DetectionMode, OpenCVConfig, YOLOConfig, TrackedObject } from "../lib/types";
import { STORAGE_KEYS } from "../lib/detection-backends";

const DEFAULT_OPENCV_CONFIG: OpenCVConfig = {
  diffThreshold: 25,
  motionAreaPercentage: 1.0,
};

const DEFAULT_YOLO_CONFIG: YOLOConfig = {
  confidenceThreshold: 0.25,
  scoreThreshold: 0.25,
  iouThreshold: 0.45,
  imgszType: "zeroPad",
  backend: "webgpu",
};

export const useDetectionBackend = () => {
  const [mode, setMode] = useState<DetectionMode>(() => {
    return (localStorage.getItem(STORAGE_KEYS.DETECTION_BACKEND) as DetectionMode) || "yolo";
  });

  const [opencvConfig, setOpencvConfig] = useState<OpenCVConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OPENCV_CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_OPENCV_CONFIG;
    } catch {
      return DEFAULT_OPENCV_CONFIG;
    }
  });

  const [yoloConfig, setYoloConfig] = useState<YOLOConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.YOLO_CONFIG);
      const parsed = saved ? JSON.parse(saved) : DEFAULT_YOLO_CONFIG;
      // Ensure defaults even if loaded from partial saved config
      return { ...DEFAULT_YOLO_CONFIG, ...parsed };
    } catch {
      return DEFAULT_YOLO_CONFIG;
    }
  });

  const [trackedObjects, setTrackedObjects] = useState<Record<string, TrackedObject>>(() => {
    try {
      const saved = localStorage.getItem("vigilo-tracked-objects");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [flashOnMovement, setFlashOnMovement] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FLASH_ON_MOVEMENT);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [flashDurationMs, setFlashDurationMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FLASH_DURATION_MS);
      return saved !== null ? JSON.parse(saved) : 3000;
    } catch {
      return 3000;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DETECTION_BACKEND, mode);
      localStorage.setItem(STORAGE_KEYS.OPENCV_CONFIG, JSON.stringify(opencvConfig));
      localStorage.setItem(STORAGE_KEYS.YOLO_CONFIG, JSON.stringify(yoloConfig));
      localStorage.setItem("vigilo-tracked-objects", JSON.stringify(trackedObjects));
      localStorage.setItem(STORAGE_KEYS.FLASH_ON_MOVEMENT, JSON.stringify(flashOnMovement));
      localStorage.setItem(STORAGE_KEYS.FLASH_DURATION_MS, JSON.stringify(flashDurationMs));
    } catch (error) {
      console.error("Error saving config:", error);
    }
  }, [mode, opencvConfig, yoloConfig, trackedObjects, flashOnMovement, flashDurationMs]);

  const updateOpencvConfig = useCallback((config: Partial<OpenCVConfig>) => {
    setOpencvConfig((prev) => ({ ...prev, ...config }));
  }, []);

  const updateYoloConfig = useCallback((config: Partial<YOLOConfig>) => {
    setYoloConfig((prev) => ({ ...prev, ...config }));
  }, []);

  const toggleTrackedObject = useCallback((className: string, isTracking: boolean) => {
    setTrackedObjects((prev) => ({
      ...prev,
      [className]: { className, isTracking },
    }));
  }, []);

  const addDiscoveredObject = useCallback((className: string) => {
    setTrackedObjects((prev) => {
      if (prev[className]) return prev;
      return {
        ...prev,
        [className]: { className, isTracking: false }, // Default to false until user accepts
      };
    });
  }, []);

  return {
    mode,
    setMode,
    opencvConfig,
    updateOpencvConfig,
    yoloConfig,
    updateYoloConfig,
    trackedObjects,
    toggleTrackedObject,
    addDiscoveredObject,
    flashOnMovement,
    setFlashOnMovement,
    flashDurationMs,
    setFlashDurationMs,
  };
};
