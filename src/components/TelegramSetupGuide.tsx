import { useState } from "preact/hooks";
import { ChevronDown, CheckCircle, Circle } from "lucide-react";

interface TelegramSetupGuideProps {
  botUsername?: string;
  telegramChatId?: number;
}

export function TelegramSetupGuide({ botUsername, telegramChatId }: TelegramSetupGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg bg-muted/40">
      <button
        className="w-full flex items-center justify-between p-4 text-sm font-semibold"
        onClick={() => setIsOpen(!isOpen)}
      >
        How to connect your Telegram Bot
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 text-sm">
          <ol className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                Open Telegram and search for{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @BotFather
                </a>
                , or click the link.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                Send the <code>/newbot</code> command to create a new bot.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                Follow the instructions from BotFather to set up a name and
                username.
              </span>
            </li>
            <li className="flex items-start gap-2">
              {botUsername ? (
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <span>
                BotFather will give you a token. Copy this token and paste it into
                the "Telegram Bot Token" field below.
              </span>
            </li>
            <li className="flex items-start gap-2">
              {botUsername ? (
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <span>
                Once you enter a valid token, a link and QR code will appear.
                Click it to open a chat with your bot and press the{" "}
                <strong>Start</strong> button.
              </span>
            </li>
            <li className="flex items-start gap-2">
              {telegramChatId ? (
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <span>Your Chat ID will be automatically detected and filled in.</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
