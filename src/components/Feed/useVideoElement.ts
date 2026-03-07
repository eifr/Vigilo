import { useRef, useEffect } from "preact/hooks";

type UseVideoElementOptions = {
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
};

export function useVideoElement(
  stream: MediaStream | undefined,
  options: UseVideoElementOptions = {},
) {
  const { autoPlay = true, muted = true, playsInline = true } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    if (muted) video.muted = true;
    if (playsInline) video.playsInline = true;

    if (autoPlay) {
      video.play().catch(() => {
        // Autoplay might fail if not muted or not user-initiated
      });
    }

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream, autoPlay, muted, playsInline]);

  return videoRef;
}
