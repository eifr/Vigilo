import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Bot, InputFile } from "grammy";

export function useTelegram() {
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sendTelegrams, setSendTelegrams] = useState(false);
  const [debounceTime, setDebounceTime] = useState(5000);
  const [botUsername, setBotUsername] = useState("");
  const botRef = useRef<Bot | null>(null);

  useEffect(() => {
    if (botRef.current) {
      botRef.current.stop().catch(() => {
        /* ignore error if already stopped */
      });
    }

    if (!telegramBotToken) {
      setBotUsername("");
      botRef.current = null;
      return;
    }

    const bot = new Bot(telegramBotToken);
    botRef.current = bot;

    bot.api
      .getMe()
      .then((me) => setBotUsername(me.username))
      .catch((err) => {
        console.error("Error getting bot username:", err);
        setBotUsername("");
      });

    if (!telegramChatId) {
      bot.on("message", (ctx) => {
        console.log(ctx);
        setTelegramChatId(ctx.message.chat.id.toString());
        bot.stop();
      });

      bot
        .start({
          allowed_updates: ["message"],
          onStart: (me) => {
            console.log(`Bot ${me.username} started listening for chat ID.`);
          },
        })
        .catch((err) => {
          console.error("Error with bot polling:", err);
        });
    }

    return () => {
      bot.stop().catch(() => {
        /* ignore error if already stopped */
      });
    };
  }, [telegramBotToken, telegramChatId]);

  const isThrottled = useRef(false);

  const sendTelegramMessage = useCallback(
    (frame: string) => {
      if (isThrottled.current) {
        return;
      }
      if (!sendTelegrams || !telegramBotToken || !telegramChatId) {
        return;
      }

      isThrottled.current = true;
      setTimeout(() => {
        isThrottled.current = false;
      }, debounceTime);

      if (!botRef.current) return;

      const message = `Movement detected at ${new Date().toLocaleTimeString()}`;

      // Convert data URL to Blob
      const byteString = atob(frame.split(",")[1]);
      const mimeString = frame.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const inputFile = new InputFile(blob, "motion.jpg");

      botRef.current.api
        .sendPhoto(telegramChatId, inputFile, { caption: message })
        .then(() => {
          console.log("Telegram message sent successfully");
        })
        .catch((error) => {
          console.error("Error sending Telegram message:", error);
        });
    },
    [sendTelegrams, telegramBotToken, telegramChatId, debounceTime]
  );

  return {
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    sendTelegrams,
    setSendTelegrams,
    debounceTime,
    setDebounceTime,
    sendTelegramMessage,
    botUsername,
  };
}
