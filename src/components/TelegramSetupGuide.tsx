import { useState } from "preact/hooks";
import { ChevronDown } from "lucide-react";

export function TelegramSetupGuide() {
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
          <ol className="list-decimal list-inside space-y-2">
            <li>
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
            </li>
            <li>
              Send the <code>/newbot</code> command to create a new bot.
            </li>
            <li>
              Follow the instructions from BotFather to set up a name and
              username.
            </li>
            <li>
              BotFather will give you a token. Copy this token and paste it into
              the "Telegram Bot Token" field below.
            </li>
            <li>
              Once you enter a valid token, a link and QR code will appear.
              Click it to open a chat with your bot and press the{" "}
              <strong>Start</strong> button.
            </li>
            <li>Your Chat ID will be automatically detected and filled in.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
