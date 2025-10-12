import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Bot } from "grammy";

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

      const message = `Movement detected at ${new Date().toLocaleTimeString()}`;

      // Convert data URL to Blob
      const byteString = atob(frame.split(",")[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ia], { type: "image/jpeg" });

      // Send photo using fetch
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
      const formData = new FormData();
      formData.append('chat_id', telegramChatId);
      formData.append('photo', blob, 'motion.jpg');
      formData.append('caption', message);

      fetch(url, {
        method: 'POST',
        body: formData,
      })
        .then(response => response.json())
        .then(data => {
          if (data.ok) {
            console.log("Telegram photo sent successfully");
          } else {
            console.error("Error sending Telegram photo:", data);
          }
        })
        .catch((error) => {
          console.error("Error sending Telegram photo:", error);
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
