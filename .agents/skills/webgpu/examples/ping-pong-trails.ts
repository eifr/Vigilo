// @ts-nocheck

const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");
const device = await adapter.requestDevice();

const width = 512;
const height = 512;
const format = "rgba16float";

const textureA = device.createTexture({
  size: [width, height],
  format,
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

const textureB = device.createTexture({
  size: [width, height],
  format,
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

const shader = /* wgsl */ `
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let uv = vec2<i32>(gid.xy);
  let color = textureLoad(inputTex, uv, 0);
  textureStore(outputTex, uv, color * 0.98);
}
`;

const module = device.createShaderModule({ code: shader });
const pipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module, entryPoint: "main" },
});

function dispatch(input: GPUTexture, output: GPUTexture) {
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: input.createView() },
      { binding: 1, resource: output.createView() },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  device.queue.submit([encoder.finish()]);
}

let swap = false;
function frame() {
  if (swap) {
    dispatch(textureA, textureB);
  } else {
    dispatch(textureB, textureA);
  }
  swap = !swap;
  requestAnimationFrame(frame);
}

frame();

export {};
