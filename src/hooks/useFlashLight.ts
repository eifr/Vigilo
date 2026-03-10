import { useState, useEffect, useCallback, useRef } from "preact/hooks";

export const useFlashLight = (stream: MediaStream | null, enabled: boolean, durationMs: number) => {
  const [isScreenFlashActive, setIsScreenFlashActive] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const isCooldownRef = useRef(false);

  const triggerFlash = useCallback(async () => {
    if (!enabled || isCooldownRef.current || !stream) return;

    // Put into cooldown mode immediately to prevent rapid re-triggering
    isCooldownRef.current = true;

    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);

    let torchSupported = false;

    // Try hardware torch first
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: true } as any] });
          torchSupported = true;
          console.log("Hardware torch enabled.");
        }
      } catch (err) {
        console.warn("Failed to apply torch constraint, falling back to screen flash.", err);
      }
    }

    // Fallback to screen flash if torch isn't supported/failed
    if (!torchSupported) {
      setIsScreenFlashActive(true);
      console.log("Screen flash enabled.");
    }

    // Turn off flash after duration
    flashTimeoutRef.current = window.setTimeout(async () => {
      // Turn off hardware torch
      if (torchSupported && track) {
        try {
          await track.applyConstraints({ advanced: [{ torch: false } as any] });
          console.log("Hardware torch disabled.");
        } catch (err) {
          console.error("Failed to disable hardware torch.", err);
        }
      }

      // Turn off screen flash
      setIsScreenFlashActive(false);

      // Start the strict cooldown period (e.g., 5 seconds)
      cooldownTimeoutRef.current = window.setTimeout(() => {
        isCooldownRef.current = false;
        console.log("Flash cooldown ended.");
      }, 5000); // 5 second hardcoded cooldown after flash ends

    }, durationMs);
  }, [enabled, stream, durationMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {});
          } catch(e) {}
        }
      }
    };
  }, [stream]);

  return { isScreenFlashActive, triggerFlash };
};
