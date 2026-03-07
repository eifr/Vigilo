import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import { Bot, InlineKeyboard } from "grammy";
import { dataUrlToBlob } from "../lib/utils";
import { useDetectionBackend } from "./useDetectionBackend";
import {
  MOTION_DETECTED_MESSAGE_PREFIX,
  STATUS_COMMAND,
  STATUS_RESPONSE_PREFIX,
  STATUS_TIMESTAMP_PREFIX,
} from "../lib/constants";

export function useTelegram() {
  const [telegramBotToken, setTelegramBotToken] = useState(
    () => localStorage.getItem("telegramBotToken") || "",
  );
  const [telegramChatId, setTelegramChatId] = useState<number>(() =>
    Number(localStorage.getItem("telegramChatId") || 0),
  );
  const [sendTelegrams, setSendTelegrams] = useState(
    () => localStorage.getItem("sendTelegrams") === "true",
  );
  const [debounceTime, setDebounceTime] = useState(5000); // Wait 5 seconds minimum between global sends
  const [botUsername, setBotUsername] = useState("");

  const botRef = useRef<Bot | null>(null);
  const { toggleTrackedObject } = useDetectionBackend();
  const globalCooldownRef = useRef<number>(0);
  const onStatusRequestRef = useRef<(() => void) | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("telegramBotToken", telegramBotToken);
  }, [telegramBotToken]);

  useEffect(() => {
    localStorage.setItem("telegramChatId", telegramChatId.toString());
  }, [telegramChatId]);

  useEffect(() => {
    localStorage.setItem("sendTelegrams", sendTelegrams.toString());
  }, [sendTelegrams]);

  useEffect(() => {
    if (botRef.current) {
      botRef.current.stop().catch(() => {});
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
      .catch(console.error);

    // Initial Registration of Chat ID
    if (!telegramChatId) {
      bot.on("message", (ctx) => {
        const chatId = ctx.message.chat.id;
        setTelegramChatId(chatId);
        bot.api.sendMessage(chatId, "🚀 Vigilo System is operational!").catch(console.error);
        bot.stop();
      });
      bot.start({ allowed_updates: ["message"] }).catch(console.error);
    } else {
      // Listen for Callback Queries from Inline Keyboards
      bot.on("callback_query:data", async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (data.startsWith("track_")) {
          const className = data.replace("track_", "");
          toggleTrackedObject(className, true);
          await ctx.editMessageCaption({ caption: `✅ Tracking started for: ${className}` });
        } else if (data.startsWith("ignore_")) {
          const className = data.replace("ignore_", "");
          toggleTrackedObject(className, false);
          await ctx.editMessageCaption({ caption: `❌ Ignoring: ${className}` });
        }
        await ctx.answerCallbackQuery();
      });

      // Listen for status command
      bot.command(STATUS_COMMAND, () => {
        onStatusRequestRef.current?.();
      });

      bot.start().catch(console.error);
    }

    return () => {
      bot.stop().catch(() => {});
    };
  }, [telegramBotToken, telegramChatId, toggleTrackedObject]);

  const sendTelegramMessage = useCallback(
    async (frame: string, customMessage?: string) => {
      if (!sendTelegrams || !telegramChatId || !botRef.current) {
        if (!sendTelegrams) console.log("Telegram skip: Send toggle is off");
        if (!telegramChatId) console.log("Telegram skip: No Chat ID");
        return false;
      }

      // Global Cooldown Check
      if (Date.now() < globalCooldownRef.current) {
        console.log("Telegram skip: Global cooldown active");
        return false;
      }

      globalCooldownRef.current = Date.now() + debounceTime;

      const message =
        customMessage || `${MOTION_DETECTED_MESSAGE_PREFIX} ${new Date().toLocaleTimeString()}`;

      try {
        const blob = dataUrlToBlob(frame);
        if (blob.size === 0) return false;

        const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
        const formData = new FormData();
        formData.append("chat_id", telegramChatId.toString());
        formData.append("photo", blob, "motion.jpg");
        formData.append("caption", message);

        const res = await fetch(url, { method: "POST", body: formData });
        const text = await res.text();

        if (!res.ok) {
          console.error("Telegram API error:", res.status, text);
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error sending Telegram photo:", error);
        return false;
      }
    },
    [sendTelegrams, telegramChatId, debounceTime, telegramBotToken],
  );

  const askToTrackObject = useCallback(
    async (className: string, frame: string) => {
      if (!sendTelegrams || !telegramChatId || !telegramBotToken) return false;

      try {
        const blob = dataUrlToBlob(frame);
        if (blob.size === 0) return false;

        const keyboard = new InlineKeyboard()
          .text(`✅ Track '${className}'`, `track_${className}`)
          .text(`❌ Ignore`, `ignore_${className}`);

        const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
        const formData = new FormData();
        formData.append("chat_id", telegramChatId.toString());
        formData.append("photo", blob, "discovery.jpg");
        formData.append(
          "caption",
          `New object discovered: *${className}*\nDo you want to receive alerts for this?`,
        );
        formData.append("parse_mode", "MarkdownV2");
        formData.append("reply_markup", JSON.stringify(keyboard));

        const res = await fetch(url, { method: "POST", body: formData });
        const text = await res.text();

        if (!res.ok) {
          console.error("Telegram API error:", res.status, text);
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error sending Telegram discovery photo:", error);
        return false;
      }
    },
    [sendTelegrams, telegramChatId, telegramBotToken],
  );

  const sendStatusResponse = useCallback(
    async (frames: { frame: string; cameraIndex: number }[]) => {
      if (!telegramChatId || !botRef.current || !telegramBotToken) return;

      const bot = botRef.current;

      try {
        await bot.api.sendMessage(telegramChatId, STATUS_RESPONSE_PREFIX);

        for (const { frame, cameraIndex } of frames) {
          const message = `${STATUS_TIMESTAMP_PREFIX} ${new Date().toLocaleTimeString()} - Camera ${cameraIndex + 1}`;

          try {
            const blob = dataUrlToBlob(frame);
            if (blob.size === 0) continue;

            const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;
            const formData = new FormData();
            formData.append("chat_id", telegramChatId.toString());
            formData.append("photo", blob, `status_camera_${cameraIndex + 1}.jpg`);
            formData.append("caption", message);

            const res = await fetch(url, { method: "POST", body: formData });
            const text = await res.text();

            if (!res.ok) {
              console.error(`Telegram API error for camera ${cameraIndex + 1}:`, res.status, text);
            }
          } catch (error) {
            console.error(`Error sending frame for camera ${cameraIndex + 1}:`, error);
          }
        }
      } catch (error) {
        console.error("Error sending status response:", error);
      }
    },
    [telegramChatId, telegramBotToken],
  );

  const setStatusHandler = useCallback((handler: () => void) => {
    onStatusRequestRef.current = handler;
  }, []);

  const resetTelegramSettings = useCallback(() => {
    localStorage.removeItem("telegramBotToken");
    localStorage.removeItem("telegramChatId");
    setTelegramBotToken("");
    setTelegramChatId(0);
    setBotUsername("");
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
    askToTrackObject,
    botUsername,
    resetTelegramSettings,
  };
}
