import React, { useEffect, useRef, useState } from "react";
import useOpenCv from "../hooks/useOpenCv";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

interface MotionWithOverlayProps {
  deviceId: string;
  onMotion?: (timestamp: Date, frame: string) => void;
  diffThreshold?: number;
  motionPixelRatio?: number;
  intervalMs?: number;
  hidePreview?: boolean;
}

export const CameraMotionDetector: React.FC<MotionWithOverlayProps> = ({
  deviceId,
  onMotion = (ts, frame) => console.log("Motion at:", ts, "frame:", frame),
  diffThreshold = 30,
  motionPixelRatio = 0.02,
  intervalMs = 200,
  hidePreview = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevGrayRef = useRef<any | null>(null);
  const onMotionRef = useRef(onMotion);
  const capRef = useRef<any | null>(null);
  const cv = useOpenCv();
  const [isMotionDetected, setIsMotionDetected] = useState(false);

  // Update the ref whenever onMotion changes
  onMotionRef.current = onMotion;

  useEffect(() => {
    if (!cv) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let streaming = false;
    const video = videoRef.current;
    if (!video) return;

    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: deviceId } } })
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      capRef.current = new cv.VideoCapture(video);
      streaming = true;
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    const timer = setInterval(() => {
      try {
        if (!streaming || !capRef.current) return;

        const frame = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
        capRef.current.read(frame);

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
            if (import.meta.env.DEV) {
              console.log("Motion detected at:", new Date());
            }
            setIsMotionDetected(true);
            setTimeout(() => setIsMotionDetected(false), 500);
            const canvas = canvasRef.current;
            if (canvas && ctx && video.readyState === 4 && !video.paused) {
              ctx.drawImage(video, 0, 0);
              const dataUrl = canvas.toDataURL("image/jpeg");
              onMotionRef.current(new Date(), dataUrl);
            }
          }

          try {
            diff.delete();
            thresh.delete();
            oldGray.delete();
          } catch (error) {
            console.error('Error deleting OpenCV Mats:', error);
          }
        }

        try {
          frame.delete();
        } catch (error) {
          console.error('Error deleting frame Mat:', error);
        }
      } catch (error) {
        console.error("Error in motion detection:", error);
      }
    }, intervalMs);

    return () => {
      streaming = false;
      clearInterval(timer);
      if (capRef.current && typeof capRef.current.delete === 'function') {
        try {
          capRef.current.delete();
        } catch (error) {
          console.error('Error deleting VideoCapture:', error);
        }
        capRef.current = null;
      }
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      if (prevGrayRef.current && typeof prevGrayRef.current.delete === 'function') {
        try {
          prevGrayRef.current.delete();
        } catch (error) {
          console.error('Error deleting prevGray Mat:', error);
        }
      }
    };
  }, [deviceId, cv, intervalMs, diffThreshold, motionPixelRatio]);

  return (
    <motion.div
      className="relative"
      animate={{
        boxShadow: isMotionDetected
          ? "0 0 20px 5px rgba(239, 68, 68, 0.5)"
          : "0 0 0px 0px rgba(239, 68, 68, 0)",

        borderRadius: "0.5rem",
        border: isMotionDetected ? "2px solid hsl(var(--destructive))" : "1px solid hsl(var(--border))",
        overflow: "hidden",
      }}
      transition={{ duration: 0.2 }}
    >
      {!cv && <Skeleton className="w-full h-full absolute inset-0 rounded-md" />}
      <video
        ref={videoRef}
        className="w-full h-auto rounded-md"
        style={{ display: hidePreview ? "none" : "block" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {isMotionDetected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full"
        >
          <AlertTriangle className="w-4 h-4" />
        </motion.div>
      )}
    </motion.div>
  );
};
