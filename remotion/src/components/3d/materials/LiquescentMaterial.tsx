/**
 * LiquescentMaterial - Custom shader material for Three.js
 *
 * Frame-synced shader material that integrates with Remotion and
 * the Liquescent design system.
 *
 * Features:
 * - Automatic frame synchronization (no Clock)
 * - State-aware colors and intensity
 * - Depth-responsive effects
 * - Pre-built noise and effects library
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFrameSync, useStateColors } from '../hooks';
import { GLSL_NOISE_STANDARD, GLSL_EASING_MINIMAL } from '../../../shaders';
import { getViscosity } from '../../../design-system/tokens/motion';
import type { LiquescentState } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LiquescentMaterialProps {
  /** Current liquescent state */
  state?: LiquescentState;
  /** Depth progress (0-1) */
  depthProgress?: number;
  /** Custom vertex shader (optional) */
  vertexShader?: string;
  /** Custom fragment shader (optional) */
  fragmentShader?: string;
  /** Additional uniforms */
  uniforms?: Record<string, THREE.IUniform>;
  /** Material side */
  side?: THREE.Side;
  /** Transparent */
  transparent?: boolean;
  /** Blend mode */
  blending?: THREE.Blending;
}

// =============================================================================
// DEFAULT SHADERS
// =============================================================================

const DEFAULT_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DEFAULT_FRAGMENT_SHADER = /* glsl */ `
${GLSL_NOISE_STANDARD}
${GLSL_EASING_MINIMAL}

uniform float uTime;
uniform float uProgress;
uniform float uStateIntensity;
uniform vec3 uStateColor;
uniform float uDepth;
uniform float uViscosity;
uniform vec2 uResolution;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
  // Domain-warped noise for organic flow
  vec3 warp = domainWarp(vUv * 2.0, uTime, uStateIntensity, uDepth);
  float n = warp.x;

  // Map noise to 0-1 range
  float pattern = n * 0.5 + 0.5;

  // Apply smootherstep for smoother gradients
  pattern = smootherstep(0.3, 0.7, pattern);

  // Base color from state
  vec3 baseColor = uStateColor * pattern;

  // Add depth-based darkening
  float depthDarken = 1.0 - uDepth * 0.5;
  baseColor *= depthDarken;

  // Subtle glow at edges
  float edge = smootherstep(0.0, 0.1, pattern) * smootherstep(1.0, 0.9, pattern);
  vec3 glow = uStateColor * edge * 0.3 * uStateIntensity;

  vec3 finalColor = baseColor + glow;

  // Output with state-based alpha
  float alpha = 0.3 + pattern * 0.5 * uStateIntensity;
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// =============================================================================
// MATERIAL COMPONENT
// =============================================================================

/**
 * LiquescentMaterial - Frame-synced shader material
 *
 * Usage:
 * ```tsx
 * <mesh>
 *   <planeGeometry args={[10, 10]} />
 *   <LiquescentMaterial state="awakening" depthProgress={0.3} />
 * </mesh>
 * ```
 */
export const LiquescentMaterial: React.FC<LiquescentMaterialProps> = ({
  state = 'dormant',
  depthProgress = 0,
  vertexShader = DEFAULT_VERTEX_SHADER,
  fragmentShader = DEFAULT_FRAGMENT_SHADER,
  uniforms: additionalUniforms = {},
  side = THREE.FrontSide,
  transparent = true,
  blending = THREE.NormalBlending,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { time, progress } = useFrameSync();
  const colors = useStateColors(state);

  // Calculate state intensity
  const stateIntensity = state === 'liquescent' ? 1.0 : state === 'awakening' ? 0.6 : 0.2;

  // Create uniforms object
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uStateIntensity: { value: stateIntensity },
      uStateColor: { value: colors.primary },
      uDepth: { value: depthProgress },
      uViscosity: { value: getViscosity(depthProgress) },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
      ...additionalUniforms,
    }),
    // Only recreate when additional uniforms change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additionalUniforms]
  );

  // Update uniforms every frame
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uProgress.value = progress;
      materialRef.current.uniforms.uStateIntensity.value = stateIntensity;
      materialRef.current.uniforms.uStateColor.value = colors.primary;
      materialRef.current.uniforms.uDepth.value = depthProgress;
      materialRef.current.uniforms.uViscosity.value = getViscosity(depthProgress);
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      side={side}
      transparent={transparent}
      blending={blending}
    />
  );
};

// =============================================================================
// PRESET MATERIALS
// =============================================================================

/**
 * Background material with domain-warped noise
 */
export const LiquescentBackgroundMaterial: React.FC<
  Omit<LiquescentMaterialProps, 'fragmentShader'>
> = (props) => {
  const fragmentShader = /* glsl */ `
    ${GLSL_NOISE_STANDARD}
    ${GLSL_EASING_MINIMAL}

    uniform float uTime;
    uniform float uStateIntensity;
    uniform vec3 uStateColor;
    uniform float uDepth;

    varying vec2 vUv;

    void main() {
      // Large-scale domain warp
      vec3 warp = domainWarp(vUv * 1.5, uTime * 0.3, uStateIntensity * 0.5, uDepth);
      float n = warp.x;

      // Secondary noise layer
      float n2 = simpleFbm(vUv * 3.0 + warp.yz * 0.5, uTime * 0.2, 3);

      // Combine
      float pattern = (n + n2 * 0.3) * 0.5 + 0.5;
      pattern = smootherstep(0.2, 0.8, pattern);

      // Depth gradient (darker at bottom)
      float depthGradient = 1.0 - vUv.y * 0.3 - uDepth * 0.2;

      // Very dark base color
      vec3 voidColor = vec3(0.02, 0.03, 0.04);
      vec3 glowColor = uStateColor * 0.15;

      vec3 finalColor = mix(voidColor, glowColor, pattern * uStateIntensity);
      finalColor *= depthGradient;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return <LiquescentMaterial {...props} fragmentShader={fragmentShader} transparent={false} />;
};

/**
 * Caustics overlay material
 */
export const LiquescentCausticsMaterial: React.FC<
  Omit<LiquescentMaterialProps, 'fragmentShader'>
> = (props) => {
  const fragmentShader = /* glsl */ `
    ${GLSL_NOISE_STANDARD}
    ${GLSL_EASING_MINIMAL}

    uniform float uTime;
    uniform float uStateIntensity;
    uniform vec3 uStateColor;
    uniform float uDepth;

    varying vec2 vUv;

    // Inline caustics (voronoi-based)
    vec3 voronoi(vec2 p, float time) {
      vec2 n = floor(p);
      vec2 f = fract(p);
      float F1 = 8.0, F2 = 8.0, cellId = 0.0;

      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 neighbor = vec2(float(i), float(j));
          vec2 cellPos = n + neighbor;
          vec2 cellRandom = hash2(cellPos);
          vec2 cellCenter = 0.5 + 0.4 * sin(time * 0.5 + 6.2831 * cellRandom);
          vec2 diff = neighbor + cellCenter - f;
          float dist = length(diff);

          if (dist < F1) {
            F2 = F1;
            F1 = dist;
            cellId = dot(cellPos, vec2(7.0, 113.0));
          } else if (dist < F2) {
            F2 = dist;
          }
        }
      }
      return vec3(F1, F2, cellId);
    }

    void main() {
      float scale = 4.0 + uDepth * 6.0;
      vec3 v1 = voronoi(vUv * scale, uTime);
      vec3 v2 = voronoi(vUv * scale * 1.5 + vec2(3.7, 2.1), uTime * 1.3);

      float caustic1 = v1.y - v1.x;
      float caustic2 = v2.y - v2.x;

      float sharpness = 2.0 + uStateIntensity * 3.0;
      float pattern = pow(caustic1 * caustic2, 1.0 / sharpness);

      float depthIntensity = smoothstep(0.15, 0.7, uDepth);
      float intensity = pattern * depthIntensity * 0.3;

      vec3 causticColor = uStateColor * intensity;

      gl_FragColor = vec4(causticColor, intensity);
    }
  `;

  return (
    <LiquescentMaterial {...props} fragmentShader={fragmentShader} blending={THREE.AdditiveBlending} />
  );
};

export default LiquescentMaterial;
