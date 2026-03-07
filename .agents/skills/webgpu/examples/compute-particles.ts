// @ts-nocheck

const particleCount = 1024;
const stride = 4 * 4;
const bufferSize = particleCount * stride;

const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");
const device = await adapter.requestDevice();

const particleBuffer = device.createBuffer({
  size: bufferSize,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});

const shader = /* wgsl */ `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${particleCount}u) { return; }
  particles[i].position += particles[i].velocity * 0.016;
}
`;

const module = device.createShaderModule({ code: shader });
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module, entryPoint: "main" },
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
});

const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
pass.end();
device.queue.submit([encoder.finish()]);

export {};
