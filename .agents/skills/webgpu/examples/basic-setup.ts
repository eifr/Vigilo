// @ts-nocheck

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Missing canvas");

const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");

const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
if (!context) throw new Error("Missing WebGPU context");

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "premultiplied" });

const encoder = device.createCommandEncoder();
const pass = encoder.beginRenderPass({
  colorAttachments: [
    {
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
      loadOp: "clear",
      storeOp: "store",
    },
  ],
});
pass.end();
device.queue.submit([encoder.finish()]);

export {};
