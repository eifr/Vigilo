# WebGPU Project Template

## Files

- `index.html`: canvas and script entry
- `main.ts`: WebGPU init, compute update, and render loop
- `shaders.wgsl`: compute + render WGSL

## `index.html`

```html
<!-- Minimal canvas + module entrypoint -->
<canvas id="c"></canvas>
<script type="module" src="/src/main.ts"></script>
```

## `main.ts`

```ts
// Grab the canvas element.
const canvas = document.getElementById("c");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing canvas");
}

// Request a WebGPU adapter and device.
const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");
const device = await adapter.requestDevice();

// Acquire the WebGPU context from the canvas.
const context = canvas.getContext("webgpu");
if (!context) throw new Error("Missing WebGPU context");

// Simulation parameters.
const particleCount = 4096;
const stride = 4 * 4; // vec2 position + vec2 velocity (4 floats)
const bufferSize = particleCount * stride;

// Initialize particle data in clip-space coordinates.
const particles = new Float32Array(particleCount * 4);
for (let i = 0; i < particleCount; i++) {
  const o = i * 4;
  particles[o + 0] = (Math.random() * 2 - 1) * 0.9; // x in clip space
  particles[o + 1] = (Math.random() * 2 - 1) * 0.9; // y in clip space
  particles[o + 2] = (Math.random() * 2 - 1) * 0.002; // vx
  particles[o + 3] = (Math.random() * 2 - 1) * 0.002; // vy
}

// Create a storage buffer for particle data and upload initial state.
const particleBuffer = device.createBuffer({
  size: bufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(particleBuffer, 0, particles);

// Load WGSL source and compile it into a shader module.
const shader = await fetch("/src/shaders.wgsl").then((r) => r.text());
const module = device.createShaderModule({ code: shader });

// Build the compute pipeline for updating particle positions.
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module, entryPoint: "cs_main" },
});

// Build the render pipeline to draw particles as points.
const renderPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: { module, entryPoint: "vs_main" },
  fragment: {
    module,
    entryPoint: "fs_main",
    targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
  },
  primitive: { topology: "point-list" },
});

// Bind group for compute (storage buffer only).
const computeBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
});

// Bind group for render (storage buffer read in vertex shader).
const renderBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
});

// Configure the canvas context for the preferred swapchain format.
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "premultiplied" });

function frame() {
  // Keep the canvas resolution in sync with CSS size and device pixel ratio.
  const width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.clientHeight * devicePixelRatio;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  // Begin a command encoder for this frame.
  const encoder = device.createCommandEncoder();

  // --- Compute pass: update particle positions ---
  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(Math.ceil(particleCount / 256));
  computePass.end();

  // --- Render pass: draw particles as white points ---
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(renderPipeline);
  pass.setBindGroup(0, renderBindGroup);
  pass.draw(particleCount);
  pass.end();

  // Submit the frame to the GPU and queue the next tick.
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

// Kick off the render loop.
frame();
```

## `shaders.wgsl`

```wgsl
// Particle data layout in the storage buffer.
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
};

// Storage buffer containing all particles.
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

// Compute pass: integrate velocity into position and wrap in clip space.
@compute @workgroup_size(256)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];
  p.pos += p.vel;

  // Simple wrap-around in clip space to keep particles on screen.
  if (p.pos.x > 1.0) { p.pos.x = -1.0; }
  if (p.pos.x < -1.0) { p.pos.x = 1.0; }
  if (p.pos.y > 1.0) { p.pos.y = -1.0; }
  if (p.pos.y < -1.0) { p.pos.y = 1.0; }

  particles[i] = p;
}

// Vertex shader output (position only).
struct VSOut {
  @builtin(position) position: vec4<f32>,
};

// Vertex pass: read particle position and output clip-space position.
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  let p = particles[vid];
  var out: VSOut;
  out.position = vec4<f32>(p.pos, 0.0, 1.0);
  return out;
}

// Fragment pass: paint every point white.
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
```
