/**
 * GLSL Easing Functions - Liquescent Design System
 *
 * Smooth transitions and falloff functions for shader animations.
 * All functions are C2 continuous (smooth acceleration) unless noted.
 */

// =============================================================================
// SMOOTHSTEP VARIANTS
// =============================================================================

/**
 * Smootherstep - Ken Perlin's 6th degree polynomial
 * C2 continuous: position, velocity, AND acceleration match at boundaries
 */
export const GLSL_SMOOTHERSTEP = /* glsl */ `
float smootherstep(float edge0, float edge1, float x) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec2 smootherstep2(float edge0, float edge1, vec2 x) {
  return vec2(
    smootherstep(edge0, edge1, x.x),
    smootherstep(edge0, edge1, x.y)
  );
}

vec3 smootherstep3(float edge0, float edge1, vec3 x) {
  return vec3(
    smootherstep(edge0, edge1, x.x),
    smootherstep(edge0, edge1, x.y),
    smootherstep(edge0, edge1, x.z)
  );
}
`;

/**
 * Smootheststep - 7th degree polynomial (maximum smoothness)
 * Use for critical transitions where smootherstep feels too sharp
 */
export const GLSL_SMOOTHESTSTEP = /* glsl */ `
float smootheststep(float edge0, float edge1, float x) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * x * x * (x * (x * (x * -20.0 + 70.0) - 84.0) + 35.0);
}
`;

// =============================================================================
// FALLOFF FUNCTIONS
// =============================================================================

/**
 * Distance-based falloff functions for glows, ripples, gradients
 */
export const GLSL_FALLOFF = /* glsl */ `
// Exponential falloff - sharp near, soft far
float expFalloff(float dist, float radius, float sharpness) {
  return exp(-pow(dist / radius, sharpness));
}

// Gaussian falloff - natural bell curve
float gaussianFalloff(float dist, float sigma) {
  return exp(-(dist * dist) / (2.0 * sigma * sigma));
}

// Inverse square falloff - physically accurate light
float inverseFalloff(float dist, float minDist) {
  return 1.0 / (1.0 + pow(dist / minDist, 2.0));
}

// Smooth circle - hard edge with soft transition
float smoothCircle(vec2 uv, vec2 center, float radius, float softness) {
  float dist = length(uv - center);
  return 1.0 - smoothstep(radius - softness, radius + softness, dist);
}

// Ring shape - donut with soft edges
float smoothRing(vec2 uv, vec2 center, float innerRadius, float outerRadius, float softness) {
  float dist = length(uv - center);
  float inner = smoothstep(innerRadius - softness, innerRadius + softness, dist);
  float outer = 1.0 - smoothstep(outerRadius - softness, outerRadius + softness, dist);
  return inner * outer;
}
`;

// =============================================================================
// SPRING / ORGANIC EASING
// =============================================================================

/**
 * Spring-like motion for organic feel
 */
export const GLSL_ORGANIC_EASING = /* glsl */ `
// Organic ease with spring wobble
float organicEase(float t, float amplitude, float frequency) {
  float decay = exp(-t * 4.0);
  float wobble = sin(t * frequency * 6.28318530718) * decay * amplitude;
  return t + wobble * (1.0 - t);
}

// Critically damped ease - lands precisely without overshoot
float criticalDampedEase(float t) {
  return 1.0 - (1.0 + t * 3.0) * exp(-t * 3.0);
}

// Elastic ease - bouncy spring effect
float elasticOut(float t) {
  float p = 0.3;
  return pow(2.0, -10.0 * t) * sin((t - p / 4.0) * (2.0 * 3.14159265) / p) + 1.0;
}

// Bounce effect
float bounceOut(float t) {
  if (t < 1.0 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2.0 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  } else {
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }
}
`;

// =============================================================================
// BLEND UTILITIES
// =============================================================================

/**
 * Smooth blending operators
 */
export const GLSL_BLEND = /* glsl */ `
// Soft maximum - smooth peak between two values
float softMax(float a, float b, float k) {
  return log(exp(k * a) + exp(k * b)) / k;
}

// Soft minimum - smooth valley between two values
float softMin(float a, float b, float k) {
  return -softMax(-a, -b, k);
}

// Soft multiply - preserves details while blending
float softMultiply(float a, float b, float preservation) {
  return mix(a * b, max(a, b), preservation);
}

// Smooth union (for SDFs)
float smoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Screen blend (like Photoshop)
vec3 screenBlend(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

// Overlay blend (like Photoshop)
vec3 overlayBlend(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}
`;

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Color manipulation in shader
 */
export const GLSL_COLOR_UTILS = /* glsl */ `
// Underwater color grading - physical light absorption
vec3 underwaterGrade(vec3 color, float depth) {
  vec3 deepTint = vec3(0.6, 0.85, 1.0);  // Blue-cyan tint
  float redAbsorption = 1.0 - depth * 0.4;  // Red absorbed first

  vec3 absorbed = color * vec3(redAbsorption, 1.0, 1.0);
  return mix(absorbed, absorbed * deepTint, depth * 0.5);
}

// Lift-Gamma-Gain color grading (industry standard)
vec3 liftGammaGain(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
  vec3 lifted = color + lift * (1.0 - color);
  vec3 gained = lifted * gain;
  return pow(gained, 1.0 / gamma);
}

// Contrast adjustment
vec3 adjustContrast(vec3 color, float contrast) {
  return (color - 0.5) * contrast + 0.5;
}

// Saturation adjustment
vec3 adjustSaturation(vec3 color, float saturation) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(gray), color, saturation);
}

// Temperature shift (warm/cool)
vec3 temperatureShift(vec3 color, float temperature) {
  // Positive = warmer (more orange), Negative = cooler (more blue)
  return color + vec3(temperature * 0.1, 0.0, -temperature * 0.1);
}
`;

// =============================================================================
// DITHERING (Anti-banding)
// =============================================================================

/**
 * Organic dithering to eliminate color banding
 */
export const GLSL_DITHER = /* glsl */ `
// Hash for dither pattern
vec2 ditherHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Organic noise for dithering (breathing texture)
float organicDitherNoise(vec2 coord, float time) {
  vec2 cell = floor(coord * 0.5);
  vec2 frac = fract(coord * 0.5);
  float minDist = 1.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = ditherHash(cell + neighbor);
      point = 0.5 + 0.4 * sin(time * 0.05 + 6.2831 * point);
      minDist = min(minDist, length(neighbor + point - frac));
    }
  }
  return minDist;
}

// Apply dither to final color (subtle, 1/128 scale)
vec3 applyDither(vec3 color, vec2 fragCoord, float time) {
  float noise = organicDitherNoise(fragCoord * 0.1, time);
  float dither = (noise - 0.5) / 128.0;
  return color + dither;
}

// Simple blue noise dither (faster)
float blueNoiseDither(vec2 fragCoord) {
  return fract(sin(dot(fragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}
`;

// =============================================================================
// BUNDLED EXPORTS
// =============================================================================

/**
 * Minimal easing bundle
 * Best for: Simple transitions
 */
export const GLSL_EASING_MINIMAL = [GLSL_SMOOTHERSTEP, GLSL_FALLOFF].join('\n');

/**
 * Standard easing bundle
 * Best for: Most Liquescent effects
 */
export const GLSL_EASING_STANDARD = [
  GLSL_SMOOTHERSTEP,
  GLSL_SMOOTHESTSTEP,
  GLSL_FALLOFF,
  GLSL_ORGANIC_EASING,
  GLSL_BLEND,
].join('\n');

/**
 * Full easing bundle
 * Best for: Advanced compositions
 */
export const GLSL_EASING_FULL = [
  GLSL_SMOOTHERSTEP,
  GLSL_SMOOTHESTSTEP,
  GLSL_FALLOFF,
  GLSL_ORGANIC_EASING,
  GLSL_BLEND,
  GLSL_COLOR_UTILS,
  GLSL_DITHER,
].join('\n');
