import type { StateUpdater } from "preact/hooks";
import { QRCodeCanvas } from "qrcode.react";

interface TelegramSettingsProps {
  sendTelegrams: boolean;
  setSendTelegrams: (value: boolean) => void;
  telegramBotToken: string;
  setTelegramBotToken: (value: string) => void;
  telegramChatId: string;
  debounceTime: number;
  setDebounceTime: (value: number) => void;
  onStartChat: () => void;
  botUsername: string;
}

export function TelegramSettings({
  sendTelegrams,
  setSendTelegrams,
  telegramBotToken,
  setTelegramBotToken,
  telegramChatId,
  debounceTime,
  setDebounceTime,
  onStartChat,
  botUsername,
}: TelegramSettingsProps) {
  return (
    <div class="telegram-settings">
      <input
        type="checkbox"
        checked={sendTelegrams}
        onChange={(e) =>
          setSendTelegrams((e.target as HTMLInputElement).checked)
        }
      />
      <label>Send Telegram message on motion</label>
      <br />
      <input
        type="text"
        placeholder="Telegram Bot Token"
        value={telegramBotToken}
        onChange={(e) =>
          setTelegramBotToken((e.target as HTMLInputElement).value)
        }
      />
      <br />
      <button onClick={onStartChat} disabled={!telegramBotToken}>
        Start Chat
      </button>
      <input
        type="text"
        placeholder="Chat ID will appear here"
        value={telegramChatId}
        readOnly
      />
      <br />
      {botUsername && (
        <div>
          <p>Or scan this QR code:</p>
          <QRCodeCanvas value={`https://t.me/${botUsername}`} />
        </div>
      )}
      <input
        type="number"
        value={debounceTime}
        onChange={(e) =>
          setDebounceTime(parseInt((e.target as HTMLInputElement).value, 10))
        }
      />
      <label>Debounce time (ms)</label>
    </div>
  );
}
