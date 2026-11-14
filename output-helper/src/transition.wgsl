struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Uni {
  progress: f32,
  kind: u32,
  screen_aspect: f32,
  opacity: f32,
  cols: f32,
  rows: f32,
  seed: f32,
  fit: f32,
  prev_aspect: f32,
  next_aspect: f32,
  prev_framed: f32,
  next_framed: f32,
}

@group(0) @binding(0) var prev_tex: texture_2d<f32>;
@group(0) @binding(1) var next_tex: texture_2d<f32>;
@group(0) @binding(2) var tex_samp: sampler;
@group(0) @binding(3) var<uniform> uni: Uni;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VsOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(positions[index], 0.0, 1.0);
  out.uv = uvs[index];
  return out;
}

fn inside(uv: vec2<f32>) -> bool {
  return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
}

fn fit_uv(uv: vec2<f32>, img_aspect: f32, framed: f32) -> vec2<f32> {
  if (framed > 0.5 || img_aspect <= 0.0) { return uv; }
  let screen_aspect = max(uni.screen_aspect, 0.01);
  let wider = img_aspect > screen_aspect;
  let cover = uni.fit > 0.5;
  var p = uv;
  if (cover) {
    if (wider) {
      p.x = (uv.x - 0.5) * (img_aspect / screen_aspect) + 0.5;
    } else {
      p.y = (uv.y - 0.5) * (screen_aspect / img_aspect) + 0.5;
    }
  } else {
    if (wider) {
      let band = screen_aspect / img_aspect;
      p.y = (uv.y - 0.5) / band + 0.5;
    } else {
      let band = img_aspect / screen_aspect;
      p.x = (uv.x - 0.5) / band + 0.5;
    }
  }
  return p;
}

fn sample_prev(uv: vec2<f32>) -> vec4<f32> {
  let mapped = fit_uv(uv, uni.prev_aspect, uni.prev_framed);
  let color = textureSample(prev_tex, tex_samp, clamp(mapped, vec2<f32>(0.0), vec2<f32>(1.0)));
  return select(vec4<f32>(0.0), color, inside(mapped));
}

fn sample_next(uv: vec2<f32>) -> vec4<f32> {
  let mapped = fit_uv(uv, uni.next_aspect, uni.next_framed);
  let color = textureSample(next_tex, tex_samp, clamp(mapped, vec2<f32>(0.0), vec2<f32>(1.0)));
  return select(vec4<f32>(0.0), color, inside(mapped));
}

fn hashed(col: f32, row: f32, seed: f32) -> f32 {
  let x = u32(col) + 1u;
  let y = u32(row) + 1u;
  let s = u32(seed) + 1u;
  var h = (x * 0x27d4eb2du) ^ (y * 0x165667b1u) ^ (s * 0x2c1b3c6du);
  h = (h ^ (h >> 15u)) * 0x85ebca6bu;
  h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967296.0;
}

@fragment
fn fs(frag: VsOut) -> @location(0) vec4<f32> {
  let uv = frag.uv;
  let prev = sample_prev(uv);
  let incoming = sample_next(uv);
  var color = incoming;

  if (uni.kind == 1u) {
    color = mix(prev, incoming, uni.progress);
  } else if (uni.kind == 2u) {
    if (uni.progress < 0.5) {
      color = mix(prev, vec4<f32>(0.0), uni.progress * 2.0);
    } else {
      color = mix(vec4<f32>(0.0), incoming, (uni.progress - 0.5) * 2.0);
    }
  } else if (uni.kind == 3u) {
    color = select(prev, incoming, uv.x < uni.progress);
  } else if (uni.kind == 4u) {
    let next_uv = vec2<f32>(uv.x - (1.0 - uni.progress), uv.y);
    let prev_uv = vec2<f32>(uv.x + uni.progress, uv.y);
    let moved_next = sample_next(next_uv);
    let moved_prev = sample_prev(prev_uv);
    let from_right = select(vec4<f32>(0.0), moved_next, inside(next_uv));
    let from_left = select(vec4<f32>(0.0), moved_prev, inside(prev_uv));
    color = select(from_left, from_right, uv.x >= 1.0 - uni.progress);
  } else if (uni.kind == 5u) {
    let next_uv = vec2<f32>(uv.x - (1.0 - uni.progress), uv.y);
    let moved_next = sample_next(next_uv);
    color = select(prev, moved_next, uv.x >= 1.0 - uni.progress && inside(next_uv));
  } else if (uni.kind == 6u) {
    let prev_uv = vec2<f32>(uv.x + uni.progress, uv.y);
    let moved_prev = sample_prev(prev_uv);
    let covered = uv.x < 1.0 - uni.progress && inside(prev_uv);
    color = select(incoming, moved_prev, covered);
  } else if (uni.kind == 7u) {
    color = select(prev, incoming, abs(uv.x - 0.5) < uni.progress * 0.5);
  } else if (uni.kind == 8u) {
    let s = mix(0.92, 1.0, uni.progress);
    let next_uv = (uv - vec2<f32>(0.5)) / s + vec2<f32>(0.5);
    let zoomed = sample_next(next_uv);
    color = select(prev, mix(prev, zoomed, uni.progress), inside(next_uv));
  } else if (uni.kind == 9u) {
    let p = (uv - vec2<f32>(0.5)) * vec2<f32>(uni.screen_aspect, 1.0);
    let limit = length(vec2<f32>(uni.screen_aspect * 0.5, 0.5));
    color = select(prev, incoming, length(p) <= uni.progress * limit);
  } else if (uni.kind == 10u) {
    color = select(prev, incoming, fract(uv.x * 12.0) < uni.progress);
  } else if (uni.kind == 11u) {
    let col = floor(uv.x * max(uni.cols, 1.0));
    let row = floor(uv.y * max(uni.rows, 1.0));
    color = select(prev, incoming, uni.progress >= hashed(col, row, uni.seed));
  }

  return vec4<f32>(color.rgb, color.a * uni.opacity);
}
