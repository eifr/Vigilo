import { useState, useEffect } from "preact/hooks";
import cvPromise from "@techstark/opencv-js";
const useOpenCv = () => {
  const [cv, setCV] = useState<null | typeof import("@techstark/opencv-js")>(
    null
  );

  useEffect(() => {
    getOpenCv().then((cv) => {
      setCV(cv);
      console.log("OpenCV.js is ready!");
    });
  }, []);

  return cv;
};

export default useOpenCv;

export async function getOpenCv() {
  const cv = await cvPromise;
  return cv;
}
