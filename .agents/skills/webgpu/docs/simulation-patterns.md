## Simulation and Orchestration Patterns

These patterns apply to a wide range of WebGPU workloads, from particle systems to neural nets and grid simulations.

### Capability handling

Choose the strategy that fits your product:

- **Fallback runtime** when correctness matters more than speed.
- **Reduced mode** when only part of the pipeline needs WebGPU.
- **Fail fast** when the app is WebGPU-only and must guarantee performance.

### Phase-based pipelines

Split work into phases that map to compute passes:

1. **state**: compute derived state (densities, activations, caches).
2. **apply**: apply updates (forces, gradient steps, rule updates).
3. **integrate**: advance state with time-step or iteration.
4. **constrain**: enforce bounds or stability.
5. **correct**: post-pass fixes or projections.

This keeps shader composition manageable and makes it easier to swap or insert passes.

### Spatial or tiled data access

Maintain a spatial index or tiled buffers:

- GPU: bin elements into tiles or buckets to improve locality.
- CPU fallback: use spatial grids or hashed buckets.
- Expose tuning knobs like `tileSize` or `maxNeighbors` for performance control.

### Localized queries instead of readbacks

Avoid full buffer readbacks. Use a small compute pass to compact a subset into a small buffer and read back only that subset.

### Modular passes

Each module or stage declares:

- Its inputs (uniforms, storage buffers, textures).
- Which phase or render pass it contributes to.

The orchestrator composes a final pipeline from these descriptors.
