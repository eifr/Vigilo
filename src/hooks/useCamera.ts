import { useState, useCallback } from "preact/hooks";
import {
  CAMERA_PERMISSION_ERROR,
  NO_CAMERAS_FOUND_ERROR,
  FAILED_TO_ACCESS_CAMERAS_ERROR,
} from "../lib/constants";
import useOpenCv from "./useOpenCv";

export interface CameraHookResult {
  availableDevices: MediaDeviceInfo[];
  isLoadingCameras: boolean;
  cameraError: string | null;
  requestCameraAccess: () => Promise<void>;
  addCamera: (deviceId: string) => void;
  clearAvailableDevices: () => void;
  captureFrames: (deviceIds: string[]) => Promise<{ frame: string; cameraIndex: number }[]>;
}

export function useCamera(): CameraHookResult {
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cv = useOpenCv();

  const requestCameraAccess = useCallback(async () => {
    setIsLoadingCameras(true);
    setCameraError(null);

    try {
      // Request camera permission first. This is necessary for enumerateDevices()
      // to return a complete list of devices on some platforms.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately after getting permission.
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Error requesting camera permission:", err);
      setCameraError(CAMERA_PERMISSION_ERROR);
      setIsLoadingCameras(false);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      if (videoDevices.length === 0) {
        setCameraError(NO_CAMERAS_FOUND_ERROR);
      }
      setAvailableDevices(videoDevices);
    } catch (err) {
      console.error("Error enumerating devices:", err);
      setCameraError(FAILED_TO_ACCESS_CAMERAS_ERROR);
    }
    setIsLoadingCameras(false);
  }, []);

  const addCamera = useCallback((deviceId: string) => {
    // Remove the selected device from available devices
    setAvailableDevices((prev) => prev.filter((device) => device.deviceId !== deviceId));
  }, []);

  const clearAvailableDevices = useCallback(() => {
    setAvailableDevices([]);
  }, []);

  const captureFrames = useCallback(async (deviceIds: string[]): Promise<{ frame: string; cameraIndex: number }[]> => {
    if (!cv) {
      throw new Error("OpenCV not loaded");
    }

    const frames: { frame: string; cameraIndex: number }[] = [];

    for (let i = 0; i < deviceIds.length; i++) {
      const deviceId = deviceIds[i];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } }
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
          video.play();
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg');
          frames.push({ frame: dataUrl, cameraIndex: i });
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        canvas.remove();
      } catch (error) {
        console.error(`Error capturing frame from camera ${i + 1}:`, error);
      }
    }

    return frames;
  }, [cv]);

  return {
    availableDevices,
    isLoadingCameras,
    cameraError,
    requestCameraAccess,
    addCamera,
    clearAvailableDevices,
    captureFrames,
  };
}