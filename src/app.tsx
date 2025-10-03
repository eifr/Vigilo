import { useCallback } from "preact/hooks";
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

  const handleMotion = useCallback(
    (_: Date, frame: string) => {
      if (!sendTelegrams) {
        return;
      }
      sendTelegramMessage(frame);
    },
    [sendTelegrams, sendTelegramMessage]
  );

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
        <MotionDetector
          onMotion={handleMotion}
          diffThreshold={25}
          motionPixelRatio={0.01}
          intervalMs={200}
        />
      </div>
    </>
  );
}
