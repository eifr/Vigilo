struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  particles[i].position += particles[i].velocity * 0.016;
}

