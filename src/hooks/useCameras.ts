import { useState, useCallback, useEffect, useRef } from "preact/hooks";

type UseMultiCameraOptions = {
  defaultConstraints?: MediaTrackConstraints;
  autoRefreshOnDeviceChange?: boolean;
};

type UseMultiCameraReturn = {
  availableCameras: MediaDeviceInfo[];
  activeDeviceIds: string[];
  getStream: (deviceId: string) => MediaStream | undefined;
  addCamera: (deviceId: string) => Promise<void>;
  removeCamera: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
  error: string | null;
};

export function useCameras(options: UseMultiCameraOptions = {}): UseMultiCameraReturn {
  const { defaultConstraints = {}, autoRefreshOnDeviceChange = false } = options;
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Streams stored in ref → no rerenders when stream object mutates
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());

  // ------------------------------------------------
  // Refresh available devices
  // ------------------------------------------------
  const refreshDevices = useCallback(async () => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = devices.filter((d) => d.kind === "videoinput");

      // If labels are empty → permission not granted yet
      if (videoInputs.some((d) => !d.label)) {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true });
        temp.getTracks().forEach((t) => t.stop());

        devices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = devices.filter((d) => d.kind === "videoinput");
      }

      setAvailableCameras(videoInputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enumerate devices");
    }
  }, []);

  // ------------------------------------------------
  // Add Camera
  // ------------------------------------------------
  const addCamera = useCallback(async (deviceId: string) => {
    if (streamsRef.current.has(deviceId)) return;

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          ...defaultConstraints,
        },
      });

      streamsRef.current.set(deviceId, stream);
      setActiveDeviceIds((prev) => [...prev, deviceId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access camera");
    }
  }, []);

  // ------------------------------------------------
  // Remove Camera
  // ------------------------------------------------
  const removeCamera = useCallback((deviceId: string) => {
    const stream = streamsRef.current.get(deviceId);
    if (!stream) return;

    stream.getTracks().forEach((track) => track.stop());
    streamsRef.current.delete(deviceId);

    setActiveDeviceIds((prev) => prev.filter((id) => id !== deviceId));
  }, []);

  // ------------------------------------------------
  // Get Stream
  // ------------------------------------------------
  const getStream = useCallback((deviceId: string) => {
    return streamsRef.current.get(deviceId);
  }, []);

  // ------------------------------------------------
  // Device Change Handling
  // ------------------------------------------------
  useEffect(() => {
    if (!autoRefreshOnDeviceChange) return;

    const handleDeviceChange = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const validIds = new Set(
        devices.filter((d) => d.kind === "videoinput").map((d) => d.deviceId),
      );

      // Remove unplugged streams
      for (const [deviceId, stream] of streamsRef.current.entries()) {
        if (!validIds.has(deviceId)) {
          stream.getTracks().forEach((track) => track.stop());
          streamsRef.current.delete(deviceId);

          setActiveDeviceIds((prev) => prev.filter((id) => id !== deviceId));
        }
      }

      setAvailableCameras(devices.filter((d) => d.kind === "videoinput"));
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [autoRefreshOnDeviceChange]);

  return {
    availableCameras,
    activeDeviceIds,
    getStream,
    addCamera,
    removeCamera,
    refreshDevices,
    error,
  };
}
