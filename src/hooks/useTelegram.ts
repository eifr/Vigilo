import { useState, useCallback, useEffect, useRef } from "preact/hooks";

export function useTelegram() {
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [sendTelegrams, setSendTelegrams] = useState(false);
  const [debounceTime, setDebounceTime] = useState(5000);
  const [botUsername, setBotUsername] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);

  const getBotUsername = useCallback(async (token: string) => {
    if (!token) {
      setBotUsername("");
      return;
    }
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`
      );
      const data = await response.json();
      if (data.ok) {
        setBotUsername(data.result.username);
        pollForChatId(token);
      } else {
        setBotUsername("");
        console.error("Error getting bot username:", data.description);
      }
    } catch (error) {
      setBotUsername("");
      console.error("Error getting bot username:", error);
    }
  }, []);

  const pollForChatId = useCallback(
    async (token: string) => {
      if (isPolling) return;
      setIsPolling(true);
      let lastUpdateId = 0;

      const poll = async () => {
        try {
          const response = await fetch(
            `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId}`
          );
          const data = await response.json();
          if (data.ok && data.result.length > 0) {
            const lastUpdate = data.result[data.result.length - 1];
            setTelegramChatId(lastUpdate.message.chat.id.toString());
            lastUpdateId = lastUpdate.update_id + 1;
            setIsPolling(false);
            if (pollTimeoutRef.current) {
              clearTimeout(pollTimeoutRef.current);
            }
          } else if (isPolling) {
            pollTimeoutRef.current = setTimeout(poll, 1000);
          }
        } catch (error) {
          console.error("Error polling for chat ID:", error);
          setIsPolling(false);
        }
      };
      poll();
    },
    [isPolling]
  );

  useEffect(() => {
    getBotUsername(telegramBotToken);

    return () => {
      setIsPolling(false);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [telegramBotToken, getBotUsername]);

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
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;

      // Convert data URL to Blob
      const byteString = atob(frame.split(",")[1]);
      const mimeString = frame.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      const formData = new FormData();
      formData.append("chat_id", telegramChatId);
      formData.append("photo", blob, "motion.jpg");
      formData.append("caption", message);

      fetch(url, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data.ok) {
            console.error("Error sending Telegram message:", data.description);
          } else {
            console.log("Telegram message sent successfully");
          }
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
