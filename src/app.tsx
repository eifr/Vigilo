import { useCallback, useState, useEffect, useRef } from "preact/hooks";
import "./app.css";
import { TelegramSettings } from "./components/TelegramSettings";
import { MotionSensitivitySettings } from "./components/MotionSensitivitySettings";
import { CameraList } from "./components/CameraList";
import { useTelegram } from "./hooks/useTelegram";
import { useCamera } from "./hooks/useCamera";
import { useDetectionBackend } from "./hooks/useDetectionBackend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { useTheme } from "./hooks/useTheme";
import logo from "./assets/logo.svg";
import { Eye, EyeOff, Sun, Moon, Activity, CheckCircle, AlertCircle } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { TrackedObjectsList } from "./components/TrackedObjectsList";
import {
  MOTION_ACTIVE_DURATION_MS,
  DEFAULT_INTERVAL_MS,
  KEYBOARD_SHORTCUTS,
} from "./lib/constants";
import type { BoundingBox } from "./lib/types";
import { Camera } from "./components/Camera";

export function App() {
  const { theme, setTheme } = useTheme();
  const [cameras, setCameras] = useState<string[]>([]);
  const [showCameras, setShowCameras] = useState(true);
  const [lastMotionTime, setLastMotionTime] = useState<Date | null>(null);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [latestFrames, setLatestFrames] = useState<Record<string, string>>({});

  const { availableDevices, isLoadingCameras, cameraError, requestCameraAccess, addCamera } =
    useCamera();
  const { mode, trackedObjects, addDiscoveredObject } = useDetectionBackend();

  // Local sync to prevent multiple rapid discoveries of the same object before React state updates
  const locallyKnownObjects = useRef<Set<string>>(new Set(Object.keys(trackedObjects)));
  useEffect(() => {
    Object.keys(trackedObjects).forEach((k) => locallyKnownObjects.current.add(k));
  }, [trackedObjects]);

  const updateLatestFrame = useCallback((deviceId: string, frame: string) => {
    setLatestFrames((prev) => ({ ...prev, [deviceId]: frame }));
  }, []);

  const {
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    sendTelegrams,
    setSendTelegrams,
    debounceTime,
    setDebounceTime,
    botUsername,
    resetTelegramSettings,
    sendTelegramMessage,
    askToTrackObject,
    sendStatusResponse,
    setStatusHandler,
  } = useTelegram();

  const handleStatusRequest = useCallback(async () => {
    try {
      const frames = cameras
        .map((deviceId, index) => ({
          frame: latestFrames[deviceId] || "",
          cameraIndex: index,
        }))
        .filter((f) => f.frame);

      if (frames.length > 0) {
        sendStatusResponse(frames);
      } else {
        // Fallback to dummy if no frames
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "red";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "white";
          ctx.font = "30px Arial";
          ctx.fillText("No camera frames available", 150, 240);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          sendStatusResponse([{ frame: dataUrl, cameraIndex: 0 }]);
        }
      }
    } catch (error) {
      console.error("Error handling status request:", error);
    }
  }, [cameras, latestFrames, sendStatusResponse]);

  useEffect(() => {
    setStatusHandler(handleStatusRequest);
  }, [setStatusHandler, handleStatusRequest]);

  const isAppReady = cameras.length > 0 && telegramBotToken && telegramChatId;
  const isMotionActive =
    lastMotionTime && Date.now() - lastMotionTime.getTime() < MOTION_ACTIVE_DURATION_MS;

  const handleAddCamera = useCallback(() => {
    requestCameraAccess();
  }, [requestCameraAccess]);

  const handleSelectCamera = useCallback(
    (deviceId: string) => {
      setCameras((prev) => {
        if (!prev.includes(deviceId)) {
          return [...prev, deviceId];
        }
        return prev;
      });
      addCamera(deviceId);
    },
    [addCamera],
  );

  const handleRemoveCamera = useCallback(
    (deviceId: string) => {
      setCameras(cameras.filter((id) => id !== deviceId));
    },
    [cameras],
  );

  const handleMotion = useCallback(
    async (timestamp: Date, frame: string, _deviceId: string, boxes: BoundingBox[]) => {
      setLastMotionTime(timestamp);

      if (!sendTelegrams) return;

      if (mode === "yolo" && boxes.length > 0) {
        let sentAny = false;

        for (const box of boxes) {
          const label = box.label || "unknown";
          const trackedObj = trackedObjects[label];

          if (!locallyKnownObjects.current.has(label)) {
            // New object discovered! Ask user via Telegram.
            locallyKnownObjects.current.add(label);
            addDiscoveredObject(label);
            await askToTrackObject(label, frame);
          } else if (trackedObj && trackedObj.isTracking) {
            // It's tracked. Send a regular notification.
            if (!sentAny) {
              await sendTelegramMessage(
                frame,
                `🚨 Detected: ${label} (${Math.round((box.confidence || 0) * 100)}%)`,
              );
              sentAny = true; // prevent sending multiple photos for multiple tracked objects in the same frame
            }
          }
        }
      } else if (mode === "opencv" && boxes.length > 0) {
        await sendTelegramMessage(frame, `🚨 Pixel Motion Detected!`);
      }
    },
    [
      sendTelegrams,
      mode,
      trackedObjects,
      addDiscoveredObject,
      askToTrackObject,
      sendTelegramMessage,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case KEYBOARD_SHORTCUTS.ADD_CAMERA:
          handleAddCamera();
          break;
        case KEYBOARD_SHORTCUTS.TOGGLE_THEME:
          setTheme(theme === "dark" ? "light" : "dark");
          break;
        case KEYBOARD_SHORTCUTS.TOGGLE_CAMERAS:
          setShowCameras(!showCameras);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [theme, showCameras, handleAddCamera]);

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto p-2 sm:p-4">
      <header className="flex flex-wrap sm:flex-nowrap items-center justify-between w-full mb-8 gap-4 p-4 bg-card rounded-lg shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logo} alt="Vigilo Logo" className="logo w-8 h-8 shrink-0" />
          <h1 className="text-2xl font-bold shrink-0">Vigilo</h1>
          <div className="flex items-center gap-1 text-sm shrink-0">
            {isMotionActive ? (
              <Activity className="w-4 h-4 text-red-500" />
            ) : isAppReady ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            )}
            <span className="hidden sm:inline">
              {isMotionActive ? "Motion Detected" : isAppReady ? "Ready" : "Setup Required"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            onClick={() => setShowCameras(!showCameras)}
            variant="outline"
            size="sm"
            title="Toggle camera previews (Shortcut: H)"
          >
            {showCameras ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden xs:inline">{showCameras ? "Hide" : "Show"} Cameras</span>
          </Button>
          <Button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            variant="outline"
            size="sm"
            title="Toggle theme (Shortcut: T)"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden xs:inline">Theme</span>
          </Button>
          <a href="https://github.com/eifr/Vigilo" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <SiGithub />
              <span className="hidden xs:inline">GitHub</span>
            </Button>
          </a>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <TelegramSettings
                sendTelegrams={sendTelegrams}
                setSendTelegrams={setSendTelegrams}
                telegramBotToken={telegramBotToken}
                setTelegramBotToken={setTelegramBotToken}
                telegramChatId={telegramChatId}
                debounceTime={debounceTime}
                setDebounceTime={setDebounceTime}
                botUsername={botUsername}
                resetTelegramSettings={resetTelegramSettings}
              />
              <MotionSensitivitySettings intervalMs={intervalMs} setIntervalMs={setIntervalMs} />
              {mode === "yolo" && <TrackedObjectsList />}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Camera />
          {/* <Card> */}
          {/*   <CardHeader> */}
          {/*     <CardTitle>Cameras</CardTitle> */}
          {/*   </CardHeader> */}
          {/*   <CardContent> */}
          {/*     <CameraList */}
          {/*       cameras={cameras} */}
          {/**/}
          {/*       availableDevices={availableDevices} */}
          {/*       isLoadingCameras={isLoadingCameras} */}
          {/*       cameraError={cameraError} */}
          {/*       onAddCamera={handleAddCamera} */}
          {/*       onSelectCamera={handleSelectCamera} */}
          {/*       onRemoveCamera={handleRemoveCamera} */}
          {/*       onMotion={handleMotion} */}
          {/*       onLatestFrame={updateLatestFrame} */}
          {/*       intervalMs={intervalMs} */}
          {/*       showCameras={showCameras} */}
          {/*     /> */}
          {/*   </CardContent> */}
          {/* </Card> */}
        </motion.div>
      </main>

      <footer className="text-center p-4 text-sm text-muted-foreground mt-8 border-t">
        <p>© {new Date().getFullYear()} eifr. All rights reserved.</p>
        <p>Version 0.0.1</p>
      </footer>
    </div>
  );
}
