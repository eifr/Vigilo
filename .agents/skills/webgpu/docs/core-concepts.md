## Core Concepts

### WebGPU execution model

WebGPU work happens on the GPU via command buffers. The usual flow:

1. Create GPU resources (buffers, textures, samplers).
2. Build pipelines (compute/render).
3. Encode commands into a command encoder.
4. Submit to the device queue.

### Resource layout basics

- **Uniform buffers**: small, frequently updated values.
- **Storage buffers**: large arrays for compute and general data.
- **Textures**: render targets or sampled data.

WGSL alignment rules matter. Most structs should align to 16 bytes. If you pack data tightly, confirm offsets and padding.

### Bind groups

Bind groups connect buffers/textures to shaders. Keep them stable:

- Create stable bind group layouts.
- Reuse bind groups across frames when possible.
- Use dynamic offsets if you need small per-object variations.

### Command encoding

Encode compute passes and render passes. The order you encode is the order the GPU executes. Split passes when you need to:

- Ping-pong textures or buffers
- Read from and write to different resources
- Insert readbacks or copy commands
