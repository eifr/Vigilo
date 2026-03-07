import { useRef, useEffect, useCallback } from "preact/hooks";

export const useInferenceWorker = ({
  onModelLoaded,
  onResult,
}: {
  onModelLoaded: (e: MessageEvent) => void;
  onResult: (e: MessageEvent) => void;
}) => {
  const workerRef = useRef<Worker | null>(null);

  // Keep callbacks fresh in ref to avoid re-creating worker on callback change
  const callbacksRef = useRef({ onModelLoaded, onResult });
  useEffect(() => {
    callbacksRef.current = { onModelLoaded, onResult };
  }, [onModelLoaded, onResult]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../../utils/inference-pipeline-worker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    worker.onmessage = (e) => {
      const { type } = e.data;
      if (type === "MODEL_LOADED") {
        callbacksRef.current.onModelLoaded?.(e.data);
      } else if (type === "RESULT") {
        callbacksRef.current.onResult?.(e.data);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const postMessage = useCallback((message: any, transfer: Transferable[]) => {
    workerRef.current?.postMessage(message, transfer);
  }, []);

  return { postMessage };
};
