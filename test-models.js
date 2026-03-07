import { pipeline, env } from "@huggingface/transformers";
console.log(env.backends.onnx.wasm.numThreads);
