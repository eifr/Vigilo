import { useCallback, useState, useEffect } from "preact/hooks";
import "./app.css";
import { TelegramSettings } from "./components/TelegramSettings";
import { MotionSensitivitySettings } from "./components/MotionSensitivitySettings";
import { CameraList } from "./components/CameraList";
import { useTelegram } from "./hooks/useTelegram";
import { useCamera } from "./hooks/useCamera";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { useTheme } from "./hooks/useTheme";
import logo from "./assets/logo.svg";
import { Github, Eye, EyeOff, Sun, Moon, Activity, CheckCircle, AlertCircle } from "lucide-react";
import {
  MOTION_ACTIVE_DURATION_MS,
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_MOTION_PIXEL_RATIO,
  DEFAULT_INTERVAL_MS,
  KEYBOARD_SHORTCUTS,
} from "./lib/constants";

export function App() {
  const { theme, setTheme } = useTheme();
  const {
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    sendTelegrams,
    setSendTelegrams,
    debounceTime,
    setDebounceTime,
    sendTelegramMessage,
    botUsername,
  } = useTelegram();
  const [cameras, setCameras] = useState<string[]>([]);
  const [showCameras, setShowCameras] = useState(true);
  const [lastMotionTime, setLastMotionTime] = useState<Date | null>(null);
  const [diffThreshold, setDiffThreshold] = useState(DEFAULT_DIFF_THRESHOLD);
  const [motionPixelRatio, setMotionPixelRatio] = useState(DEFAULT_MOTION_PIXEL_RATIO);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);

  const { availableDevices, isLoadingCameras, cameraError, requestCameraAccess, addCamera } = useCamera();


  const isAppReady = cameras.length > 0 && telegramBotToken && telegramChatId;
  const isMotionActive = lastMotionTime && (Date.now() - lastMotionTime.getTime()) < MOTION_ACTIVE_DURATION_MS;

  const handleAddCamera = useCallback(() => {
    requestCameraAccess();
  }, [requestCameraAccess]);

  const handleSelectCamera = useCallback((deviceId: string) => {
    if (!cameras.includes(deviceId)) {
      setCameras([...cameras, deviceId]);
    }
    addCamera(deviceId);
  }, [cameras, addCamera]);

  const handleRemoveCamera = useCallback((deviceId: string) => {
    setCameras(cameras.filter((id) => id !== deviceId));
  }, [cameras]);

  const handleMotion = useCallback(
    (deviceId: string, timestamp: Date, frame: string) => {
      if (!sendTelegrams) {
        return;
      }
      sendTelegramMessage(frame);
      setLastMotionTime(timestamp);
    },
    [sendTelegrams, sendTelegramMessage]
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, showCameras, handleAddCamera]);

  return (
    <div class="min-h-screen w-full max-w-7xl mx-auto p-2 sm:p-4">
      <header class="flex flex-col sm:flex-row items-center justify-between w-full mb-8 gap-4 p-4 bg-card rounded-lg shadow-sm">
        <div class="flex items-center gap-3">
          <img src={logo} alt="Vigilo Logo" class="logo" />
          <h1 class="text-2xl font-bold">Vigilo</h1>
          <div class="flex items-center gap-1 text-sm">
            {isMotionActive ? (
              <Activity class="w-4 h-4 text-red-500" />
            ) : isAppReady ? (
              <CheckCircle class="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle class="w-4 h-4 text-yellow-500" />
            )}
            <span class="hidden sm:inline">
              {isMotionActive ? "Motion Detected" : isAppReady ? "Ready" : "Setup Required"}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            onClick={() => setShowCameras(!showCameras)}
            variant="outline"
            size="sm"
            title="Toggle camera previews (Shortcut: H)"
          >
            {showCameras ? <EyeOff class="w-4 h-4 mr-2" /> : <Eye class="w-4 h-4 mr-2" />}
            {showCameras ? "Hide" : "Show"} Cameras
          </Button>
          <Button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            variant="outline"
            size="sm"
            title="Toggle theme (Shortcut: T)"
          >
            {theme === "dark" ? <Sun class="w-4 h-4 mr-2" /> : <Moon class="w-4 h-4 mr-2" />}
            Theme
          </Button>
          <a
            href="https://github.com/eifr/Vigilo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github class="w-4 h-4 mr-2" />
              GitHub
            </Button>
          </a>
        </div>
      </header>

      <main class="grid grid-cols-1 md:grid-cols-2 gap-8">
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
              />
              <MotionSensitivitySettings
                diffThreshold={diffThreshold}
                setDiffThreshold={setDiffThreshold}
                motionPixelRatio={motionPixelRatio}
                setMotionPixelRatio={setMotionPixelRatio}
                intervalMs={intervalMs}
                setIntervalMs={setIntervalMs}
              />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Cameras</CardTitle>
            </CardHeader>
            <CardContent>
              <CameraList
                cameras={cameras}
                availableDevices={availableDevices}
                isLoadingCameras={isLoadingCameras}
                cameraError={cameraError}
                onAddCamera={handleAddCamera}
                onSelectCamera={handleSelectCamera}
                onRemoveCamera={handleRemoveCamera}
                onMotion={handleMotion}
                diffThreshold={diffThreshold}
                motionPixelRatio={motionPixelRatio}
                intervalMs={intervalMs}
                showCameras={showCameras}
              />
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <footer class="text-center p-4 text-sm text-muted-foreground space-y-2">
        <p>© {new Date().getFullYear()} eifr. All rights reserved.</p>
        <p>
          Version 0.0.0 |{" "}
          <a
            href="https://github.com/eifr/Vigilo/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:underline"
          >
            Report Issues
          </a>{" "}
          |{" "}
          <a
            href="https://github.com/eifr/Vigilo#readme"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:underline"
          >
            Documentation
          </a>
        </p>
      </footer>
    </div>
  );
}
