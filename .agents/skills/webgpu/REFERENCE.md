# WebGPU Quick Reference

## Device + context

```ts
const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "premultiplied" });
```

## Buffer creation

```ts
const buffer = device.createBuffer({
  size: byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  mappedAtCreation: false,
});
```

## Uniform packing

When you have many small scalar uniforms, consider packing them into `vec4` slots:

```wgsl
struct Params {
  v0: vec4<f32>, // x, y, z, w
  v1: vec4<f32>, // a, b, c, d
};

@group(0) @binding(0) var<uniform> params: Params;
```

```ts
// v0 = [x, y, z, w], v1 = [a, b, c, d]
const u = new Float32Array(8);
u[0] = x;
u[1] = y;
u[2] = z;
u[3] = w;
u[4] = a;
u[5] = b;
u[6] = c;
u[7] = d;
device.queue.writeBuffer(uniformBuffer, 0, u);
```

This reduces bind group bindings and keeps alignment predictable.

## Pipeline setup

```ts
const module = device.createShaderModule({ code: wgslSource });
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module, entryPoint: "main" },
});
```

## Dispatch

```ts
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ);
pass.end();
device.queue.submit([encoder.finish()]);
```

## Render pass

```ts
const view = context.getCurrentTexture().createView();
const pass = encoder.beginRenderPass({
  colorAttachments: [
    {
      view,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: "clear",
      storeOp: "store",
    },
  ],
});
```

## Readback (avoid in hot paths)

```ts
const readBuffer = device.createBuffer({
  size: byteLength,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});
encoder.copyBufferToBuffer(srcBuffer, 0, readBuffer, 0, byteLength);
device.queue.submit([encoder.finish()]);
await readBuffer.mapAsync(GPUMapMode.READ);
const data = readBuffer.getMappedRange();
```

## Common pitfalls

- Ensure WGSL structs are aligned to 16 bytes.
- Keep bind group layouts stable to avoid pipeline rebuilds.
- Use ping-pong textures/buffers for multi-pass effects.
- Keep readbacks to bounded results (small buffers).
