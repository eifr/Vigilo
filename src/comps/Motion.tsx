
import React, { useEffect, useRef, useState } from "react";
import cvReadyPromise, * as cvModule from "@techstark/opencv-js";

interface MotionWithOverlayProps {
  onMotion?: (timestamp: Date) => void;
  diffThreshold?: number;
  motionPixelRatio?: number;
  intervalMs?: number;
}

const MotionWithOverlay: React.FC<MotionWithOverlayProps> = ({
  onMotion = (ts) => console.log("Motion at:", ts),
  diffThreshold = 30,
  motionPixelRatio = 0.02,
  intervalMs = 200,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const prevGrayRef = useRef<cvModule.Mat | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isCvReady, setCvReady] = useState(false);

  useEffect(() => {
    let streaming = false;
    let cap: cvModule.VideoCapture | null = null;

    cvReadyPromise
      .then((cv) => {
        console.log("OpenCV ready");
        setCvReady(true);

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
          // Match the video element's size to its intrinsic resolution
          video.width = video.videoWidth;
          video.height = video.videoHeight;

          const overlay = overlayRef.current;
          if (overlay) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
          }

          cap = new cv.VideoCapture(video);
          streaming = true;

          const processFrame = () => {
            if (!streaming || !cap) return;

            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w === 0 || h === 0) {
              return;
            }

            const frame = new cv.Mat(h, w, cv.CV_8UC4);
            const gray = new cv.Mat(h, w, cv.CV_8UC1);

            cap.read(frame);
            cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

            if (prevGrayRef.current) {
              const diff = new cv.Mat();
              cv.absdiff(gray, prevGrayRef.current, diff);

              const thresh = new cv.Mat();
              cv.threshold(diff, thresh, diffThreshold, 255, cv.THRESH_BINARY);

              const nonZero = cv.countNonZero(thresh);
              const total = w * h;
              const ratio = nonZero / total;

              if (ratio > motionPixelRatio) {
                onMotion(new Date());
              }

              // Draw overlay mask
              if (overlay) {
                const ctx = overlay.getContext("2d");
                if (ctx) {
                  ctx.clearRect(0, 0, w, h);
                  const imgData = ctx.createImageData(w, h);
                  // thresh is single-channel; convert to RGBA
                  for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                      const v = thresh.ucharPtr(y, x)[0];
                      const idx = (y * w + x) * 4;
                      imgData.data[idx] = v;
                      imgData.data[idx + 1] = v;
                      imgData.data[idx + 2] = v;
                      imgData.data[idx + 3] = 255;
                    }
                  }
                  ctx.putImageData(imgData, 0, 0);
                }
              }

              diff.delete();
              thresh.delete();
            }

            if (prevGrayRef.current) {
              prevGrayRef.current.delete();
            }
            prevGrayRef.current = gray.clone();

            frame.delete();
            gray.delete();
          };

          timerRef.current = window.setInterval(() => {
            processFrame();
          }, intervalMs);
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
      })
      .catch((err) => {
        console.error("Failed to load OpenCV:", err);
      });

    return () => {
      streaming = false;
      const video = videoRef.current;
      if (video && video.srcObject) {
        (video.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
      if (prevGrayRef.current) {
        prevGrayRef.current.delete();
      }
    };
  }, [diffThreshold, motionPixelRatio, intervalMs, onMotion]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <video
        ref={videoRef}
        style={{ display: "block", width: "100%", height: "auto" }}
      />
      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />
      {!isCvReady && <div>Loading OpenCV...</div>}
    </div>
  );
};

export default MotionWithOverlay;

