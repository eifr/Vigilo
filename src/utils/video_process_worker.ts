import { InferenceSession } from "onnxruntime-web/webgpu";
import { MP4Demuxer } from "./demuxer";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { inferencePipeline, type ModelConfig, type Prediction } from "./inference-pipeline";
import { renderOverlay } from "./render-overlay";
import { getCv } from "./cv-init";

// --- Interfaces for incoming messages and configuration ---
export interface VideoWorkerData {
  file: File | Blob;
  modelConfig: ModelConfig & {
    model_path: string;
    backend: string;
    classes: any; // Ideally imported from your classes definition
  };
}

export interface VideoConfig {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  nb_frames: number;
  bitrate?: number;
  description?: Uint8Array; // For decoder init
}

// --- Main Worker Logic ---
self.onmessage = async function (e: MessageEvent<VideoWorkerData>) {
  const { file, modelConfig } = e.data;

  // Ensure OpenCV is initialized before doing anything
  await getCv();

  // Model Initialization
  let yolo_model: InferenceSession;
  try {
    yolo_model = await InferenceSession.create(modelConfig.model_path, {
      executionProviders: [modelConfig.backend],
    });
  } catch (err: any) {
    self.postMessage({ statusMsg: `Model Load Error: ${err.message}` });
    return;
  }

  // State variables
  let inputCanvas: OffscreenCanvas | null = null;
  let inputCtx: OffscreenCanvasRenderingContext2D | null = null;
  let resultCanvas: OffscreenCanvas | null = null;
  let resultCtx: OffscreenCanvasRenderingContext2D | null = null;

  // WebCodecs and Muxer state
  let decoder: VideoDecoder | null = null;
  let encoder: VideoEncoder | null = null;
  let muxer: Muxer<ArrayBufferTarget> | null = null;

  let frameCount = 0;
  let totalFrames = 0;

  // Frame queue for processing
  const frameQueue: VideoFrame[] = [];
  let isProcessing = false; // Changed initial state to false until frames arrive

  const onConfig = (config: VideoConfig) => {
    totalFrames = config.nb_frames;

    inputCanvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);
    resultCanvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);

    inputCtx = inputCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;

    resultCtx = resultCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;

    // Initialize Muxer
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc", // H.264
        width: config.codedWidth,
        height: config.codedHeight,
      },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    // Initialize Encoder
    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (muxer) muxer.addVideoChunk(chunk, meta as any);
      },
      error: (err) => {
        console.error("Encoder Error: ", err);
        self.postMessage({ statusMsg: `Encoder Error: ${err.message}` });
      },
    });

    encoder.configure({
      codec: "avc1.640028", // H.264 High Profile
      width: config.codedWidth,
      height: config.codedHeight,
      bitrate: config.bitrate || 2_000_000, // 2Mbps
    });

    // Initialize Decoder
    decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        frameQueue.push(frame);
        if (!isProcessing) {
          processNextFrame();
        }
      },
      error: (err) => {
        console.error("Decoder Error:", err);
        self.postMessage({ statusMsg: `Decoder Error: ${err.message}` });
      },
    });

    decoder.configure(config);

    self.postMessage({
      statusMsg: "✅ Initialize End, Start process...",
    });
  };

  // Process video chunks
  const onChunk = (chunk: EncodedVideoChunk) => {
    if (decoder && decoder.state === "configured") {
      decoder.decode(chunk);
    } else {
      console.error("Decoder not ready");
      self.postMessage({ statusMsg: "Decoder not ready" });
    }
  };

  // Finalize video processing
  const finalizeVideo = async () => {
    try {
      self.postMessage({ statusMsg: "🔄 Finalize Video Encoding..." });

      if (decoder && decoder.state !== "closed") {
        await decoder.flush();
        decoder.close();
      }

      if (encoder && encoder.state !== "closed") {
        await encoder.flush();
        encoder.close();
      }

      // Video muxer finalize
      if (muxer) {
        muxer.finalize();
        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: "video/mp4" });

        // Clean up canvases
        inputCanvas = null;
        resultCanvas = null;

        self.postMessage({
          statusMsg: "✅ Video Processing Complete!",
          processedVideo: blob,
        });
      }
    } catch (err: any) {
      console.error("Video Processing Error:", err);
      self.postMessage({ statusMsg: `Video Processing Error: ${err.message}` });
    }
  };

  // Frame process function
  const processNextFrame = async () => {
    if (frameQueue.length === 0) {
      isProcessing = false;
      // If queue is empty and decoder has finished reading chunks
      if (decoder && decoder.decodeQueueSize === 0) {
        // Wait a tiny bit to ensure no trailing frames are in the pipeline
        setTimeout(finalizeVideo, 100);
      }
      return;
    }

    isProcessing = true;
    const frame = frameQueue.shift()!;

    try {
      if (!inputCtx || !resultCtx || !inputCanvas || !resultCanvas) {
        throw new Error("Canvases not initialized");
      }

      inputCtx.drawImage(frame, 0, 0);
      resultCtx.drawImage(frame, 0, 0);

      // Note: inferencePipeline typically takes ImageData. If yours takes OffscreenCanvas,
      // make sure the signature in inference-pipeline.ts matches this!
      const imgData = inputCtx.getImageData(0, 0, inputCanvas.width, inputCanvas.height);

      // Inference, Draw
      const [results, inferenceTime] = await inferencePipeline(
        imgData, // Changed from inputCanvas to imgData to match your previous definition
        yolo_model,
        modelConfig,
      );

      await renderOverlay(results as Prediction[], resultCtx as unknown as CanvasRenderingContext2D, modelConfig.classes);

      // Create frame from result canvas
      const outputFrame = new VideoFrame(resultCanvas, {
        timestamp: frame.timestamp,
        duration: frame.duration ?? undefined, // Fallback for duration if null
      });

      // Encode output frame
      if (encoder && encoder.state === "configured") {
        encoder.encode(outputFrame);
      }
      outputFrame.close();
      frameCount++;

      const isEvenSecond = Math.floor(Date.now() / 1000) % 2 === 0;
      self.postMessage({
        statusMsg: `${isEvenSecond ? "⚫" : "🔴"} Processing - ${frameCount}/${totalFrames || "Unknown"} (${inferenceTime}ms)`,
        progress: totalFrames > 0 ? frameCount / totalFrames : 0,
      });
    } catch (err: any) {
      console.error("Frame process error:", err);
      self.postMessage({ statusMsg: `Frame process error: ${err.message}` });
    } finally {
      frame.close();
      // Recursively call for the next frame
      processNextFrame();
    }
  };

  // Start demuxer
  try {
    new MP4Demuxer(file, onConfig, onChunk);
    self.postMessage({ statusMsg: "🔄 Start demuxer..." });
  } catch (err: any) {
    console.error("Demuxer Initialize Error:", err);
    self.postMessage({ statusMsg: `Demuxer Initialize Error: ${err.message}` });
  }
};
