import { useState, useEffect } from "preact/hooks";

let isCvReady = false;
const listeners = new Set<(isReady: boolean) => void>();

const scriptId = "opencv-script";

const useOpenCv = () => {
  const [cvReady, setCvReady] = useState(isCvReady);

  useEffect(() => {
    if (isCvReady) {
      // If already ready, no need to do anything.
      return;
    }

    // Add a listener to update this component when OpenCV is ready.
    listeners.add(setCvReady);

    // If the script is already being loaded by another component, just wait.
    if (document.getElementById(scriptId)) {
      return () => {
        listeners.delete(setCvReady);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://docs.opencv.org/4.5.4/opencv.js";
    script.async = true;
    script.onload = () => {
      (window as any)["cv"].onRuntimeInitialized = () => {
        console.log("OpenCV ready");
        isCvReady = true;
        // Notify all listening components that OpenCV is ready.
        listeners.forEach((listener) => listener(true));
        listeners.clear();
      };
    };
    document.body.appendChild(script);

    // Cleanup function to remove the listener if the component unmounts.
    return () => {
      listeners.delete(setCvReady);
    };
  }, []);

  return cvReady;
};

export default useOpenCv;
