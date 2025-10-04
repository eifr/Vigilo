import { useCallback, useState } from "preact/hooks";
import "./app.css";
import MotionDetector from "./components/Motion";
import { TelegramSettings } from "./components/TelegramSettings";
import { useTelegram } from "./hooks/useTelegram";

export function App() {
  const {
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    sendTelegrams,
    setSendTelegrams,
    debounceTime,
    setDebounceTime,
    sendTelegramMessage,
    handleStartChat,
    botUsername,
  } = useTelegram();
  const [cameras, setCameras] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>(
    []
  );

  const handleMotion = useCallback(
    (_: Date, frame: string) => {
      if (!sendTelegrams) {
        return;
      }
      sendTelegramMessage(frame);
    },
    [sendTelegrams, sendTelegramMessage]
  );

  const handleAddCameraClick = async () => {
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

  return (
    <>
      <div>
        <h1>Vigilo</h1>

        <TelegramSettings
          sendTelegrams={sendTelegrams}
          setSendTelegrams={setSendTelegrams}
          telegramBotToken={telegramBotToken}
          setTelegramBotToken={setTelegramBotToken}
          telegramChatId={telegramChatId}
          debounceTime={debounceTime}
          setDebounceTime={setDebounceTime}
          onStartChat={handleStartChat}
          botUsername={botUsername}
        />
        <button onClick={handleAddCameraClick}>Add camera</button>
        {availableDevices.length > 0 && (
          <ul>
            {availableDevices.map((device) => (
              <li key={device.deviceId}>
                <button onClick={() => addCamera(device.deviceId)}>
                  {device.label || `Camera ${cameras.length + 1}`}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div class="cameras-container">
          {cameras.map((deviceId) => (
            <MotionDetector
              key={deviceId}
              deviceId={deviceId}
              onMotion={handleMotion}
              diffThreshold={25}
              motionPixelRatio={0.01}
              intervalMs={200}
            />
          ))}
        </div>
      </div>
    </>
  );
}
