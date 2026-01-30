/**
 * GLSL Shader Library - Liquescent Design System
 *
 * Comprehensive shader toolkit for Three.js materials in Remotion.
 *
 * Usage:
 * ```tsx
 * import {
 *   GLSL_NOISE_STANDARD,
 *   GLSL_EASING_MINIMAL,
 *   GLSL_CAUSTICS
 * } from '@/shaders';
 *
 * const fragmentShader = `
 *   ${GLSL_NOISE_STANDARD}
 *   ${GLSL_EASING_MINIMAL}
 *   ${GLSL_CAUSTICS}
 *
 *   uniform float uTime;
 *   uniform float uDepth;
 *
 *   void main() {
 *     vec2 uv = gl_FragCoord.xy / vec2(1920.0, 1080.0);
 *     float c = caustics(uv, uTime, uDepth, 0.5);
 *     gl_FragColor = vec4(vec3(c), 1.0);
 *   }
 * `;
 * ```
 */

// =============================================================================
// NOISE FUNCTIONS
// =============================================================================

export {
  // Individual chunks
  GLSL_NOISE_COMMON,
  GLSL_SIMPLEX_2D,
  GLSL_SIMPLEX_3D,
  GLSL_FBM,
  GLSL_DOMAIN_WARP,
  GLSL_CURL_NOISE,
  // Bundles
  GLSL_NOISE_MINIMAL,
  GLSL_NOISE_STANDARD,
  GLSL_NOISE_FULL,
} from './noise';

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export {
  // Individual chunks
  GLSL_SMOOTHERSTEP,
  GLSL_SMOOTHESTSTEP,
  GLSL_FALLOFF,
  GLSL_ORGANIC_EASING,
  GLSL_BLEND,
  GLSL_COLOR_UTILS,
  GLSL_DITHER,
  // Bundles
  GLSL_EASING_MINIMAL,
  GLSL_EASING_STANDARD,
  GLSL_EASING_FULL,
} from './easing';

// =============================================================================
// VISUAL EFFECTS
// =============================================================================

export {
  // Individual chunks
  GLSL_CAUSTICS,
  GLSL_GOD_RAYS,
  GLSL_BIO_GRAIN,
  GLSL_MEMBRANE,
  GLSL_RIPPLES,
  // Bundles
  GLSL_EFFECTS_CAUSTICS,
  GLSL_EFFECTS_ATMOSPHERE,
  GLSL_EFFECTS_FULL,
} from './effects';

// =============================================================================
// COMPLETE BUNDLES
// =============================================================================

import { GLSL_NOISE_STANDARD } from './noise';
import { GLSL_EASING_STANDARD } from './easing';
import { GLSL_EFFECTS_FULL } from './effects';

/**
 * Standard Liquescent shader bundle
 * Includes: 2D/3D noise, FBM, domain warp, smootherstep, falloff, blend
 * Best for: Most background and atmospheric effects
 */
export const GLSL_LIQUESCENT_STANDARD = [GLSL_NOISE_STANDARD, GLSL_EASING_STANDARD].join('\n');

/**
 * Full Liquescent shader bundle
 * Includes: All noise, all easing, all effects
 * Best for: Complex compositions with caustics, god rays, etc.
 */
export const GLSL_LIQUESCENT_FULL = [GLSL_NOISE_STANDARD, GLSL_EASING_STANDARD, GLSL_EFFECTS_FULL].join(
  '\n'
);
