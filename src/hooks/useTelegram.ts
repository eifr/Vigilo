import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Bot } from "grammy";
import { dataUrlToBlob } from "../lib/utils";
import { MOTION_DETECTED_MESSAGE_PREFIX, STATUS_COMMAND, STATUS_RESPONSE_PREFIX, STATUS_TIMESTAMP_PREFIX } from "../lib/constants";

export function useTelegram() {
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sendTelegrams, setSendTelegrams] = useState(false);
  const [debounceTime, setDebounceTime] = useState(5000);
  const [botUsername, setBotUsername] = useState("");
  const botRef = useRef<Bot | null>(null);
  const onStatusRequestRef = useRef<(() => void) | null>(null);

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
    } else if (onStatusRequestRef.current) {
      // Listen for status command when chat ID is set
      bot.command(STATUS_COMMAND, () => {
        console.log("Status command received");
        onStatusRequestRef.current?.();
      });

      bot.start().catch((err) => {
        console.error("Error starting bot for status commands:", err);
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

      const message = `${MOTION_DETECTED_MESSAGE_PREFIX} ${new Date().toLocaleTimeString()}`;

      const blob = dataUrlToBlob(frame);

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

  const sendStatusResponse = useCallback(
    (frames: { frame: string; cameraIndex: number }[]) => {
      if (!telegramBotToken || !telegramChatId) {
        return;
      }

      // Send status message first
      const statusUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: STATUS_RESPONSE_PREFIX,
        }),
      })
        .then(response => response.json())
        .then(data => {
          if (!data.ok) {
            console.error("Error sending status message:", data);
          }
        })
        .catch((error) => {
          console.error("Error sending status message:", error);
        });

      // Send photos for each camera
      frames.forEach(({ frame, cameraIndex }) => {
        const message = `${STATUS_TIMESTAMP_PREFIX} ${new Date().toLocaleTimeString()} - Camera ${cameraIndex + 1}`;

        const blob = dataUrlToBlob(frame);

        const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', telegramChatId);
        formData.append('photo', blob, `status_camera_${cameraIndex + 1}.jpg`);
        formData.append('caption', message);

        fetch(url, {
          method: 'POST',
          body: formData,
        })
          .then(response => response.json())
          .then(data => {
            if (data.ok) {
              console.log(`Status photo for camera ${cameraIndex + 1} sent successfully`);
            } else {
              console.error(`Error sending status photo for camera ${cameraIndex + 1}:`, data);
            }
          })
          .catch((error) => {
            console.error(`Error sending status photo for camera ${cameraIndex + 1}:`, error);
          });
      });
    },
    [telegramBotToken, telegramChatId]
  );

  const setStatusHandler = useCallback((handler: () => void) => {
    onStatusRequestRef.current = handler;
  }, []);

  return {
    telegramBotToken,
    setTelegramBotToken,
    telegramChatId,
    sendTelegrams,
    setSendTelegrams,
    debounceTime,
    setDebounceTime,
    sendTelegramMessage,
    sendStatusResponse,
    setStatusHandler,
    botUsername,
  };
}
