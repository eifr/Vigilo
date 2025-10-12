import { useState, useRef, useCallback } from "preact/hooks";
import { NOTIFICATION_TIMEOUT_MS, NOTIFICATION_TYPES } from "../lib/constants";

export type NotificationType = typeof NOTIFICATION_TYPES.SUCCESS | typeof NOTIFICATION_TYPES.INFO;

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

export interface NotificationHookResult {
  notifications: Notification[];
  addNotification: (message: string, type?: NotificationType) => void;
}

export function useNotifications(): NotificationHookResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationIdRef = useRef(0);

  const addNotification = useCallback((message: string, type: NotificationType = NOTIFICATION_TYPES.INFO) => {
    const id = ++notificationIdRef.current;
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, NOTIFICATION_TIMEOUT_MS);
  }, []);

  return {
    notifications,
    addNotification,
  };
}