## WebGPU Use Cases

WebGPU is useful for a broad range of workloads that benefit from parallel execution:

- **Neural networks**: inference and training, including backprop and gradient descent.
- **Grid simulations**: Game of Life, cellular automata, reaction-diffusion.
- **Physics and systems**: particle dynamics, fluid-like solvers, constraint systems.
- **Chaos and dynamics**: coupled oscillators, pendulum systems, attractors.
- **Signal processing**: filters, FFT-based pipelines, image transforms.
- **Rendering**: forward/deferred rendering, post-processing, UI compositing.

### Picking the right model

- Use **compute** for large parallel workloads with heavy data movement.
- Use **render** pipelines when rasterization is the core step.
- Combine both when you need compute pre-processing and render post-processing.
