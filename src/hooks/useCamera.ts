import { useState, useCallback, useRef } from "preact/hooks";
import {
  CAMERA_PERMISSION_ERROR,
  NO_CAMERAS_FOUND_ERROR,
  FAILED_TO_ACCESS_CAMERAS_ERROR,
} from "../lib/constants";
import { getUserMediaWithTimeout, stopMediaStream } from "../lib/utils";

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
  const permissionStreamRef = useRef<MediaStream | null>(null);

  const requestCameraAccess = useCallback(async () => {
    setIsLoadingCameras(true);
    setCameraError(null);

    try {
      const stream = await getUserMediaWithTimeout({ video: true }, 5000);
      permissionStreamRef.current = stream;
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Error requesting camera permission:", err);
      if (err instanceof Error && err.message.includes("timed out")) {
        setCameraError("Camera permission request timed out. Please try again.");
      } else {
        setCameraError(CAMERA_PERMISSION_ERROR);
      }
      setIsLoadingCameras(false);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
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
    setAvailableDevices((prev) => prev.filter((device) => device.deviceId !== deviceId));
  }, []);

  const clearAvailableDevices = useCallback(() => {
    setAvailableDevices([]);
  }, []);

  const captureFrames = useCallback(
    async (deviceIds: string[]): Promise<{ frame: string; cameraIndex: number }[]> => {
      const frames: { frame: string; cameraIndex: number }[] = [];

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        let stream: MediaStream | null = null;
        let video: HTMLVideoElement | null = null;
        let canvas: HTMLCanvasElement | null = null;

        try {
          stream = await getUserMediaWithTimeout(
            {
              video: { deviceId: { exact: deviceId } },
            },
            5000,
          );

          video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Video load timeout"));
            }, 5000);

            video!.onloadedmetadata = () => {
              clearTimeout(timeout);
              video!.play().then(resolve).catch(reject);
            };
            video!.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Video load error"));
            };
          });

          let width = video.videoWidth;
          let height = video.videoHeight;
          if (width > 1280) {
            height = Math.round((height * 1280) / width);
            width = 1280;
          }
          canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            frames.push({ frame: dataUrl, cameraIndex: i });
          }
        } catch (error) {
          console.error(`Error capturing frame from camera ${i + 1}:`, error);
        } finally {
          stopMediaStream(stream);
          if (video) video.remove();
          if (canvas) canvas.remove();
        }
      }

      return frames;
    },
    [],
  );

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
