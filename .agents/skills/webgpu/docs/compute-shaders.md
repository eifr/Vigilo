## Compute Shaders

### Workgroup sizing

Pick a workgroup size that balances occupancy and memory access. Common sizes are 32, 64, or 128. Make it configurable so you can tune based on the workload and device.

```wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  // ...
}
```

### Storage buffer layout

Use struct-of-arrays when you need coalesced access, and array-of-structs when you need per-element cohesion. Avoid mixing unrelated fields in a single struct if it causes heavy bandwidth.

### Simulation phases

For iterative systems, break compute into phases:

- **state**: pre-pass to compute derived state (densities, activations, caches).
- **apply**: apply updates (forces, gradient steps, rule updates).
- **integrate**: advance state with time-step or iteration.
- **constrain**: enforce bounds, invariants, or stability.
- **correct**: post-pass fixes, clamping, or projection.

This keeps WGSL readable and makes it easier to insert extra passes.

### Neighborhood queries

If you need local context, maintain a spatial grid or tiled buffers on the GPU. This avoids O(n^2) scans and is scalable for large grids or particle counts.
