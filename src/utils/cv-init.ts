import cvModule from "@techstark/opencv-js";

export async function getOpenCv() {
  let cv;
  if (cvModule instanceof Promise) {
    cv = await cvModule;
  } else {
    if (cvModule.Mat) {
      cv = cvModule;
    } else {
      await new Promise<void>((resolve) => {
        cvModule.onRuntimeInitialized = () => resolve();
      });
      cv = cvModule;
    }
  }
  return { cv };
}
