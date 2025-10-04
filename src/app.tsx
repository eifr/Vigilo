import { useCallback, useState } from "preact/hooks";
import "./app.css";
import MotionDetector from "./components/Motion";
import { TelegramSettings } from "./components/TelegramSettings";
import { useTelegram } from "./hooks/useTelegram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { useTheme } from "./hooks/useTheme";
import logo from "./assets/logo.svg";
import { Github } from "lucide-react";

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
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>(
    []
  );
  const [showCameras, setShowCameras] = useState(true);
  const [motionDetectedDeviceId, setMotionDetectedDeviceId] = useState<
    string | null
  >(null);

  const handleMotion = useCallback(
    (deviceId: string, _: Date, frame: string) => {
      if (!sendTelegrams) {
        return;
      }
      sendTelegramMessage(frame);
      setMotionDetectedDeviceId(deviceId);
      setTimeout(() => setMotionDetectedDeviceId(null), 1000);
    },
    [sendTelegrams, sendTelegramMessage]
  );

  const handleAddCameraClick = async () => {
    try {
      // Request camera permission first. This is necessary for enumerateDevices()
      // to return a complete list of devices on some platforms.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately after getting permission.
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Error requesting camera permission:", err);
      // Optionally, inform the user that permission is needed.
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );
    setAvailableDevices(videoDevices);
  };

  const addCamera = (deviceId: string) => {
    if (!cameras.includes(deviceId)) {
      setCameras([...cameras, deviceId]);
    }
    setAvailableDevices([]); // Hide list after selection
  };

  const removeCamera = (deviceId: string) => {
    setCameras(cameras.filter((id) => id !== deviceId));
  };

  return (
    <div class="min-h-screen w-full max-w-7xl mx-auto p-4">
      <header class="flex flex-col sm:flex-row items-center justify-between w-full mb-8 gap-4">
        <div class="flex items-center gap-3">
          <img src={logo} alt="Vigilo Logo" class="logo" />
          <h1 class="text-2xl font-bold">Vigilo</h1>
        </div>
        <div class="flex gap-2">
          <Button
            onClick={() => setShowCameras(!showCameras)}
            variant="outline"
          >
            {showCameras ? "Hide" : "Show"} Cameras
          </Button>
          <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            Toggle Theme
          </Button>
          <a
            href="https://github.com/eifr/Vigilo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <Github class="w-4 h-4 mr-2" />
              Source Code
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
            </CardContent>
          </Card>
        </motion.div>
        <div class="w-full">
          <Card>
            <CardHeader>
              <CardTitle>Cameras</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAddCameraClick}>Add camera</Button>
              {availableDevices.length > 0 && (
                <ul class="my-4 space-y-2">
                  {availableDevices.map((device) => (
                    <li key={device.deviceId}>
                      <Button
                        variant="outline"
                        onClick={() => addCamera(device.deviceId)}
                      >
                        {device.label || `Camera ${cameras.length + 1}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <motion.div
                className="grid grid-cols-1 gap-4 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {cameras.map((deviceId) => (
                  <div key={deviceId} class="camera-wrapper">
                    <MotionDetector
                      deviceId={deviceId}
                      onMotion={(...args) => handleMotion(deviceId, ...args)}
                      diffThreshold={25}
                      motionPixelRatio={0.01}
                      intervalMs={200}
                      hidePreview={!showCameras}
                    />
                    <motion.div
                      animate={{
                        scale: motionDetectedDeviceId === deviceId ? 1.05 : 1,
                      }}
                      transition={{
                        duration: 0.2,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                    >
                      <Button
                        variant="destructive"
                        onClick={() => removeCamera(deviceId)}
                        class="mt-2 w-full"
                      >
                        Remove camera
                      </Button>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
