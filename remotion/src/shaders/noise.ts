/**
 * GLSL Noise Library - Liquescent Design System
 *
 * Ported from theme-factory Liquescent theme for Remotion video rendering.
 * All functions are production-ready, frame-deterministic, and optimized for GPU.
 *
 * Usage in ShaderMaterial:
 * ```tsx
 * import { GLSL_NOISE_COMMON, GLSL_SIMPLEX_2D } from '@/shaders/noise';
 *
 * const fragmentShader = `
 *   ${GLSL_NOISE_COMMON}
 *   ${GLSL_SIMPLEX_2D}
 *   // your shader code
 * `;
 * ```
 */

// =============================================================================
// COMMON FOUNDATION (Required by all noise functions)
// =============================================================================

/**
 * Hash and permutation functions that support all noise variants.
 * Must be included first in any shader using noise.
 */
export const GLSL_NOISE_COMMON = /* glsl */ `
// Modulo operations for hash functions
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }

// Permutation functions for noise generation
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

// 2D hash function for random values
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
`;

// =============================================================================
// 2D SIMPLEX NOISE
// =============================================================================

/**
 * 2D Simplex Noise - Fast, smooth, organic patterns
 * Range: -1 to 1
 * Cost: ~30-50 GPU ops (very fast)
 */
export const GLSL_SIMPLEX_2D = /* glsl */ `
float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  // First corner (skewed)
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  // Other corners
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  // Gradients
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}
`;

// =============================================================================
// 3D SIMPLEX NOISE
// =============================================================================

/**
 * 3D Simplex Noise - Volumetric effects with depth
 * Range: -1 to 1
 * Cost: ~80-120 GPU ops (use sparingly)
 */
export const GLSL_SIMPLEX_3D = /* glsl */ `
float snoise3D(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients
  float n_ = 0.142857142857; // 1.0/7.0
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix contributions
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;

  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// =============================================================================
// FRACTAL BROWNIAN MOTION (FBM)
// =============================================================================

/**
 * FBM functions - Layered noise for natural patterns
 * Cost: ~100-150 GPU ops (3 octaves)
 */
export const GLSL_FBM = /* glsl */ `
// Simple 2D FBM - Start here for most effects
float simpleFbm(vec2 p, float time, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    float t = time * (0.1 + float(i) * 0.05);
    value += amplitude * snoise(p * frequency + t);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Volumetric FBM - 3D with attention-responsive detail
float volumetricFbm(vec3 p, float time, float attention) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  // Base 3D octaves
  for (int i = 0; i < 3; i++) {
    float t = time * (0.1 + float(i) * 0.05);
    value += amplitude * snoise3D(p * frequency + vec3(t, t * 0.7, t * 0.3));
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  // Detail layer in 2D (attention-responsive)
  float detailAmplitude = amplitude * attention * 2.0;
  for (int i = 3; i < 5; i++) {
    float t = time * (0.15 + float(i) * 0.03);
    value += detailAmplitude * snoise(p.xy * frequency + t);
    frequency *= 2.0;
    detailAmplitude *= 0.5;
  }
  return value;
}

// Ridged FBM - Sharp membrane-like features
float ridgedNoise(vec2 p, float time) {
  float n = snoise(p + time * 0.1);
  return 1.0 - abs(n);
}

float ridgedFbm(vec2 p, float time, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float weight = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    float t = time * (0.08 + float(i) * 0.04);
    float n = ridgedNoise(p * frequency + t, t);
    n *= weight;
    weight = clamp(n * 2.0, 0.0, 1.0);
    value += n * amplitude;
    frequency *= 2.2;
    amplitude *= 0.5;
  }
  return value;
}
`;

// =============================================================================
// DOMAIN WARPING
// =============================================================================

/**
 * Domain Warping - Organic flowing patterns
 * Cost: ~200-300 GPU ops (expensive but beautiful)
 */
export const GLSL_DOMAIN_WARP = /* glsl */ `
// FBM helper for warp displacement
float warpFbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amplitude * snoise(p * frequency + time * 0.1);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Domain warping with recursive displacement (IQ technique)
// Returns: vec3(final noise value, warp offset x, warp offset y)
vec3 domainWarp(vec2 p, float time, float attention, float depth) {
  float warpStrength = 0.3 + attention * 0.5 + depth * 0.2;

  // First warp layer (q)
  vec2 q = vec2(
    warpFbm(p + vec2(0.0, 0.0), time),
    warpFbm(p + vec2(5.2, 1.3), time * 0.8)
  );

  // Second warp layer (r) - warped by q
  float recursionStrength = 3.0 + attention * 2.0;
  vec2 r = vec2(
    warpFbm(p + recursionStrength * q + vec2(1.7, 9.2), time * 0.6),
    warpFbm(p + recursionStrength * q + vec2(8.3, 2.8), time * 0.7)
  );

  // Final warped position
  vec2 warpOffset = warpStrength * r;
  float n = warpFbm(p + warpStrength * r, time * 0.5);

  return vec3(n, warpOffset);
}

// Simplified version: just returns the offset vector
vec2 domainWarpOffset(vec2 p, float time, float attention, float depth) {
  return domainWarp(p, time, attention, depth).yz;
}
`;

// =============================================================================
// CURL NOISE (Divergence-free flow)
// =============================================================================

/**
 * Curl Noise - Smooth flow field vectors
 * Cost: ~60-80 GPU ops
 */
export const GLSL_CURL_NOISE = /* glsl */ `
vec2 curlNoise(vec2 p, float time) {
  float eps = 0.01;
  float n1 = snoise(p + vec2(eps, 0.0) + time);
  float n2 = snoise(p - vec2(eps, 0.0) + time);
  float n3 = snoise(p + vec2(0.0, eps) + time);
  float n4 = snoise(p - vec2(0.0, eps) + time);

  float dx = (n3 - n4) / (2.0 * eps);
  float dy = -(n1 - n2) / (2.0 * eps);

  return normalize(vec2(dx, dy) + 0.001);
}
`;

// =============================================================================
// BUNDLED EXPORTS
// =============================================================================

/**
 * Minimal bundle - 2D noise + common
 * Best for: Simple particle effects, basic backgrounds
 */
export const GLSL_NOISE_MINIMAL = [GLSL_NOISE_COMMON, GLSL_SIMPLEX_2D].join('\n');

/**
 * Standard bundle - 2D/3D noise + FBM + domain warp
 * Best for: Most Liquescent effects
 */
export const GLSL_NOISE_STANDARD = [
  GLSL_NOISE_COMMON,
  GLSL_SIMPLEX_2D,
  GLSL_SIMPLEX_3D,
  GLSL_FBM,
  GLSL_DOMAIN_WARP,
].join('\n');

/**
 * Full bundle - Everything
 * Best for: Advanced compositions with all effects
 */
export const GLSL_NOISE_FULL = [
  GLSL_NOISE_COMMON,
  GLSL_SIMPLEX_2D,
  GLSL_SIMPLEX_3D,
  GLSL_FBM,
  GLSL_DOMAIN_WARP,
  GLSL_CURL_NOISE,
].join('\n');
