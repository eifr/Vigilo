import { motion } from "motion/react";
import { Camera, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraMotionDetector } from "./Motion";

interface CameraListProps {
  cameras: string[];
  availableDevices: MediaDeviceInfo[];
  isLoadingCameras: boolean;
  cameraError: string | null;
  onAddCamera: () => void;
  onSelectCamera: (deviceId: string) => void;
  onRemoveCamera: (deviceId: string) => void;
  onMotion: (timestamp: Date, frame: string) => void;
  diffThreshold: number;
  motionPixelRatio: number;
  intervalMs: number;
  showCameras: boolean;
}

export function CameraList({
  cameras,
  availableDevices,
  isLoadingCameras,
  cameraError,
  onAddCamera,
  onSelectCamera,
  onRemoveCamera,
  onMotion,
  diffThreshold,
  motionPixelRatio,
  intervalMs,
  showCameras,
}: CameraListProps) {
  return (
    <div>
      <Button onClick={onAddCamera} disabled={isLoadingCameras}>
        {isLoadingCameras ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        {isLoadingCameras ? "Loading..." : "Add Camera"}
      </Button>
      {cameraError && (
        <p className="text-sm text-destructive mt-2">{cameraError}</p>
      )}
      {availableDevices.length > 0 && (
        <motion.div
          className="my-4"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-sm font-medium mb-2">Available Cameras:</p>
          <ul className="space-y-2">
            {availableDevices.map((device, index) => (
              <motion.li
                key={device.deviceId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
              >
                <Button
                  variant="outline"
                  onClick={() => onSelectCamera(device.deviceId)}
                  className="w-full justify-start"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {device.label || `Camera ${index + 1}`}
                </Button>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
      <motion.div
        className="grid grid-cols-1 gap-4 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {cameras.map((deviceId, index) => (
          <div key={deviceId} className="camera-wrapper space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="text-sm font-medium">Camera {index + 1}</span>
            </div>
            <CameraMotionDetector
              deviceId={deviceId}
              onMotion={(...args) => onMotion(...args)}
              diffThreshold={diffThreshold}
              motionPixelRatio={motionPixelRatio}
              intervalMs={intervalMs}
              hidePreview={!showCameras}
            />
            <Button
              variant="destructive"
              onClick={() => onRemoveCamera(deviceId)}
              className="w-full"
              size="sm"
            >
              Remove Camera
            </Button>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
