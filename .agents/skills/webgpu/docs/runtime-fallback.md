## Runtime Fallback Strategy

### Why it matters

WebGPU is not guaranteed on every device. Some projects can offer a fallback, while others may choose to fail fast or provide a reduced feature set.

### Options

Pick the approach that matches your product goals:

1. **Fallback runtime**: switch to CPU or a simplified WebGL path.
2. **Reduced mode**: keep WebGPU-only features gated and disable heavy paths.
3. **Fail fast**: show a clear error and prompt for a supported device/browser.

### Practical tips

- Keep CPU and GPU codepaths in sync for scale and units if you provide fallback.
- Document feature availability for modules that do not support all runtimes.
- Add a feature probe in UI to display the active mode.
