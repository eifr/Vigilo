import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Bot } from "grammy";
import { dataUrlToBlob } from "../lib/utils";
import { MOTION_DETECTED_MESSAGE_PREFIX, STATUS_COMMAND, STATUS_RESPONSE_PREFIX, STATUS_TIMESTAMP_PREFIX } from "../lib/constants";

export function useTelegram() {
  const [telegramBotToken, setTelegramBotToken] = useState(() => {
    return localStorage.getItem("telegramBotToken") || "";
  });
  const [telegramChatId, setTelegramChatId] = useState<number>(() => {
    const stored = localStorage.getItem("telegramChatId");
    return stored ? Number(stored) : 0;
  });
  const [sendTelegrams, setSendTelegrams] = useState(false);
  const [debounceTime, setDebounceTime] = useState(5000);
  const [botUsername, setBotUsername] = useState("");
  const [hasStatusHandler, setHasStatusHandler] = useState(false);
  const botRef = useRef<Bot | null>(null);
  const onStatusRequestRef = useRef<(() => void) | null>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("telegramBotToken", telegramBotToken);
  }, [telegramBotToken]);

  useEffect(() => {
    localStorage.setItem("telegramChatId", telegramChatId.toString());
  }, [telegramChatId]);

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
        const chatId = ctx.message.chat.id;
        setTelegramChatId(chatId);
        // Send operational message
        bot.api.sendMessage(chatId, "🚀 System is operational! You can now send /status to get system status and camera snapshots.").catch((error) => {
          console.error("Error sending operational message:", error);
        });
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
     } else if (hasStatusHandler) {
       console.log("Registering status command");
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
  }, [telegramBotToken, telegramChatId, hasStatusHandler]);

  const isThrottled = useRef(false);

  const sendTelegramMessage = useCallback(
    (frame: string) => {
      if (isThrottled.current) {
        return;
      }
      if (!sendTelegrams || !telegramChatId || !botRef.current) {
        return;
      }

      isThrottled.current = true;
      setTimeout(() => {
        isThrottled.current = false;
      }, debounceTime);

      const message = `${MOTION_DETECTED_MESSAGE_PREFIX} ${new Date().toLocaleTimeString()}`;

       let blob: Blob;
       try {
         blob = dataUrlToBlob(frame);
       } catch (error) {
         console.error("Error converting data URL to blob:", error);
         return;
       }
       console.log("Blob size:", blob.size, "Blob type:", blob.type);
       if (blob.size === 0) {
         console.error("Blob is empty, not sending photo");
         return;
       }
       console.log("Sending photo to chat_id:", telegramChatId);
       const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
       const formData = new FormData();
       formData.append('chat_id', telegramChatId.toString());
       formData.append('photo', blob, 'motion.jpg');
       formData.append('caption', message);
       fetch(url, {
         method: 'POST',
         body: formData,
       })
         .then((res) => res.json())
         .then((data) => {
           if (!data.ok) {
             throw new Error(`Telegram API error: ${data.error_code} - ${data.description}`);
           }
           console.log("Telegram photo sent successfully");
         })
         .catch((error) => {
           console.error("Error sending Telegram photo:", error);
           // Check if it's a CORS or network error
           if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
             console.error("Possible CORS or network issue. Telegram Bot API should be called from server-side.");
           }
         });
    },
    [sendTelegrams, telegramChatId, debounceTime]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!telegramChatId || !botRef.current) {
        return;
      }

      botRef.current.api.sendMessage(telegramChatId, text).catch((error) => {
        console.error("Error sending message:", error);
      });
    },
    [telegramChatId]
  );

  const sendStatusResponse = useCallback(
    (frames: { frame: string; cameraIndex: number }[]) => {
      if (!telegramChatId || !botRef.current) {
        return;
      }

      const bot = botRef.current;

      // Send status message first
      bot.api.sendMessage(telegramChatId, STATUS_RESPONSE_PREFIX).catch((error) => {
        console.error("Error sending status message:", error);
      });

       // Send photos for each camera
       frames.forEach(({ frame, cameraIndex }) => {
         const message = `${STATUS_TIMESTAMP_PREFIX} ${new Date().toLocaleTimeString()} - Camera ${cameraIndex + 1}`;

          let blob: Blob;
          try {
            blob = dataUrlToBlob(frame);
          } catch (error) {
            console.error(`Error converting data URL to blob for camera ${cameraIndex + 1}:`, error);
            return;
          }
          console.log("Blob size:", blob.size, "Blob type:", blob.type);
          if (blob.size === 0) {
            console.error(`Blob for camera ${cameraIndex + 1} is empty, not sending photo`);
            return;
          }
          console.log("Sending status photo to chat_id:", telegramChatId);
          const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
          const formData = new FormData();
          formData.append('chat_id', telegramChatId.toString());
          formData.append('photo', blob, `status_camera_${cameraIndex + 1}.jpg`);
          formData.append('caption', message);
          fetch(url, {
            method: 'POST',
            body: formData,
          })
            .then((res) => res.json())
            .then((data) => {
              if (!data.ok) {
                throw new Error(`Telegram API error: ${data.error_code} - ${data.description}`);
              }
              console.log(`Status photo for camera ${cameraIndex + 1} sent successfully`);
            })
            .catch((error) => {
              console.error(`Error sending status photo for camera ${cameraIndex + 1}:`, error);
              // Check if it's a CORS or network error
              if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.error("Possible CORS or network issue. Telegram Bot API should be called from server-side.");
              }
            });
       });
    },
    [telegramChatId]
  );

  const setStatusHandler = useCallback((handler: () => void) => {
    onStatusRequestRef.current = handler;
    setHasStatusHandler(true);
  }, []);

  const resetTelegramSettings = useCallback(() => {
    // Send off message before resetting
    if (telegramBotToken && telegramChatId) {
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: "🔴 System is off. Telegram notifications disabled.",
        }),
      }).catch((error) => {
        console.error("Error sending off message:", error);
      });
    }

    localStorage.removeItem("telegramBotToken");
    localStorage.removeItem("telegramChatId");
    setTelegramChatId(0);
    setBotUsername("");
    setHasStatusHandler(false);
  }, [telegramBotToken, telegramChatId]);

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
    sendMessage,
    setStatusHandler,
    botUsername,
    resetTelegramSettings,
  };
}
