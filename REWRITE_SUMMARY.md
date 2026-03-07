# Engine Rewrite Summary

The YOLO engine logic has been completely rewritten to be modular, robust, and aligned with the reference implementation.

## New Structure (`src/lib/yolo-engine/`)

1.  **`types.ts`**: Unified type definitions for configuration, bounding boxes, and worker messages.
2.  **`loader.ts`**: Handles ONNX session creation, backend selection (WebGPU/WASM), and warmup.
3.  **`preprocess.ts`**: Implements advanced preprocessing:
    - **Dynamic Stride (32)**: Optimizes inference speed by resizing to the nearest multiple of 32 instead of full 640x640 padding.
    - **Zero Pad**: Option for standard square padding if needed.
    - Uses direct OpenCV operations for efficiency.
4.  **`postprocess.ts`**: Decoupled post-processing logic:
    - Tensor output decoding.
    - Confidence threshold filtering.
    - Non-Maximum Suppression (NMS) to remove duplicate boxes.
5.  **`inference.ts`**: Main orchestration class (`InferencePipeline`) that ties everything together.

## Worker Update (`src/workers/yolo.worker.ts`)

The worker file is now a lightweight coordinator. It:

- Initializes the `InferencePipeline`.
- Handles `OffscreenCanvas` for efficient `ImageBitmap` -> `ImageData` conversion.
- Delegates processing to the engine modules.
- Manages configuration updates and cleanup.

## Key Improvements

- **Modularity**: Logic is split into single-responsibility files, making it easier to test and maintain.
- **Performance**:
  - Pre-processing uses `stride 32` dynamic sizing by default (faster than fixed 640x640).
  - `ImageBitmap` transfer support to reduce main thread blocking.
- **Reliability**: Robust backend fallback (WebGPU -> WASM) and error handling.
- **Type Safety**: Full TypeScript definitions for all engine components.

## Verification

The project builds successfully (`npm run build`). The new worker architecture is fully integrated into the existing `Motion.tsx` component via the updated `useDetectionBackend` hook configuration defaults.
