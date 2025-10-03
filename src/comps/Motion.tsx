import React, { useEffect, useRef, useState } from "react";

interface MotionWithOverlayProps {
  onMotion?: (timestamp: Date, frame: string) => void;
  diffThreshold?: number;
  motionPixelRatio?: number;
  intervalMs?: number;
}

const MotionWithOverlay: React.FC<MotionWithOverlayProps> = ({
  onMotion = (ts, frame) => console.log("Motion at:", ts, "frame:", frame),
  diffThreshold = 30,
  motionPixelRatio = 0.02,
  intervalMs = 200,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevGrayRef = useRef<any | null>(null);
  const [isCvReady, setCvReady] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.5.4/opencv.js";
    script.async = true;
    script.onload = () => {
      (window as any)["cv"].onRuntimeInitialized = () => {
        console.log("OpenCV ready");
        setCvReady(true);
      };
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!isCvReady) return;

    const cv = (window as any)["cv"];
    let streaming = false;
    let cap: any | null = null;
    const video = videoRef.current;
    if (!video) return;

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => {
        console.error("Error accessing camera:", err);
      });

    const handleLoadedMetadata = () => {
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      cap = new cv.VideoCapture(video);
      streaming = true;
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    const timer = setInterval(() => {
      if (!streaming || !cap) return;

      const frame = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
      cap.read(frame);

      const gray = new cv.Mat();
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

      const oldGray = prevGrayRef.current;
      prevGrayRef.current = gray;

      if (oldGray) {
        const diff = new cv.Mat();
        cv.absdiff(prevGrayRef.current, oldGray, diff);

        const thresh = new cv.Mat();
        cv.threshold(diff, thresh, diffThreshold, 255, cv.THRESH_BINARY);

        const nonZero = cv.countNonZero(thresh);
        const total = video.videoWidth * video.videoHeight;
        const ratio = nonZero / total;

        if (ratio > motionPixelRatio) {
          const canvas = document.createElement("canvas");
          cv.imshow(canvas, frame);
          const dataUrl = canvas.toDataURL("image/jpeg");
          onMotion(new Date(), dataUrl);
        }

        diff.delete();
        thresh.delete();
        oldGray.delete();
      }

      frame.delete();
    }, intervalMs);

    return () => {
      streaming = false;
      clearInterval(timer);
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      if (prevGrayRef.current) {
        prevGrayRef.current.delete();
      }
    };
  }, [isCvReady, intervalMs, diffThreshold, motionPixelRatio, onMotion]);

  return (
    <div>
      <video ref={videoRef} />
      {!isCvReady && <div>Loading OpenCV...</div>}
    </div>
  );
};

export default MotionWithOverlay;
