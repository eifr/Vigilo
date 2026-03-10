import { useState, useEffect, useCallback, useRef } from "preact/hooks";

export const useFlashLight = (stream: MediaStream | null, enabled: boolean, durationMs: number) => {
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [isScreenFlashActive, setIsScreenFlashActive] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);

  const isTorchActiveRef = useRef(false);

  const turnOffFlash = useCallback(async () => {
    setIsFlashActive(false);
    // Turn off screen flash
    setIsScreenFlashActive(false);

    // Turn off hardware torch
    if (isTorchActiveRef.current && stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ torch: false } as any] });
          console.log("Hardware torch disabled due to inactivity.");
        } catch (err) {
          console.error("Failed to disable hardware torch.", err);
        }
      }
      isTorchActiveRef.current = false;
    }
  }, [stream]);

  const triggerFlash = useCallback(async () => {
    if (!enabled || !stream) return;

    // Clear any existing turn-off timeout. We want to KEEP the flash on!
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }

    // Try to turn on hardware torch if it's not already on
    if (!isTorchActiveRef.current) {
      const track = stream.getVideoTracks()[0];
      let torchSupported = false;
      if (track) {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true } as any] });
            torchSupported = true;
            isTorchActiveRef.current = true;
            setIsFlashActive(true);
            console.log("Hardware torch enabled.");
          }
        } catch (err) {
          console.warn("Failed to apply torch constraint, falling back to screen flash.", err);
        }
      }

      // Fallback to screen flash if torch isn't supported
      if (!torchSupported && !isScreenFlashActive) {
        setIsScreenFlashActive(true);
        setIsFlashActive(true);
        console.log("Screen flash enabled.");
      }
    }

    // Set (or reset) the timeout to turn the flash off after `durationMs` of inactivity
    flashTimeoutRef.current = window.setTimeout(() => {
      turnOffFlash();
    }, durationMs);

  }, [enabled, stream, durationMs, turnOffFlash, isScreenFlashActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      turnOffFlash();
    };
  }, [turnOffFlash]);

  return { isScreenFlashActive, isFlashActive, triggerFlash };
};
