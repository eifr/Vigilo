import { useState, useEffect } from "preact/hooks";

export interface ConnectivityStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType?: string;
  effectiveType?: string;
}

export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
  });

  useEffect(() => {
    const updateStatus = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      setStatus({
        isOnline: navigator.onLine,
        isOffline: !navigator.onLine,
        connectionType: connection?.type,
        effectiveType: connection?.effectiveType,
      });
    };

    const handleOnline = () => {
      updateStatus();
    };

    const handleOffline = () => {
      updateStatus();
    };

    const handleConnectionChange = () => {
      updateStatus();
    };

    // Initial status
    updateStatus();

    // Event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for connection changes if available
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener("change", handleConnectionChange);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (connection) {
        connection.removeEventListener("change", handleConnectionChange);
      }
    };
  }, []);

  return status;
}
