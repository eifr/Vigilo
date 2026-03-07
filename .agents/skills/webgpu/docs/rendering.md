## Rendering Pipelines

### Render passes

Render passes write to the swapchain or intermediate textures. Use intermediate textures for post-processing and trails:

- Pass 1: render scene to texture A
- Pass 2: compute/blur into texture B
- Pass 3: composite into swapchain

### Ping-pong textures

For iterative effects (trails, blur, simulations), alternate read/write textures each frame. This avoids read-write hazards in the same texture.

### Instancing

For large numbers of similar objects (particles, lines), use instancing and keep instance data in a storage buffer.

### Color + depth

If you do 3D rendering, add a depth attachment. For 2D systems, skip depth to reduce overhead.
