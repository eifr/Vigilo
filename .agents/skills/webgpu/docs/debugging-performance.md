## Debugging and Performance

### Avoid heavy readbacks

GPU readbacks stall the pipeline. Prefer:

- Small readback buffers with bounded results
- Localized queries (e.g., "particles within radius")
- Debug-only readbacks behind a toggle

### Reduce pipeline churn

- Keep bind group layouts stable
- Avoid rebuilding pipelines per frame
- Batch updates into a single buffer map/write

### Frame stability

Clamp delta time to avoid unstable physics. This is especially important when the tab is backgrounded or the GPU is busy.

### Validation and error scopes

Use `device.pushErrorScope("validation")` and `device.popErrorScope()` during development to catch errors early.

### Tuning knobs

Expose and document the key performance knobs:

- workgroup size
- max particles processed per frame
- spatial grid cell size
- neighbor count limit
