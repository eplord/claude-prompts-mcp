/**
 * RippleImpact - Command Execution Visual Feedback
 *
 * Creates expanding ripple rings when commands execute.
 * Visualizes the "disturbance in the viscous medium" when
 * user actions propagate through the interface.
 *
 * Philosophy: Every action creates waves that travel through
 * the liquid interface, connecting cause to effect visually.
 *
 * Integrates with Unified Field Theory from design-system/physics.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { GLSL_NOISE_STANDARD, GLSL_EASING_MINIMAL } from '../../../shaders';
import { stateColors, light_tokens } from '../../../design-system/tokens/colors';
import { springs } from '../../../design-system/tokens/motion';
import type { LiquescentState, SpringPreset } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export interface RippleImpactProps {
  /** Impact center in world coordinates */
  center?: [number, number, number];
  /** Frame when impact occurs */
  impactFrame: number;
  /** Number of ripple rings */
  ringCount?: number;
  /** Maximum ripple radius */
  maxRadius?: number;
  /** Ring thickness */
  ringThickness?: number;
  /** Liquescent state for color */
  state?: LiquescentState;
  /** Spring preset for expansion */
  springPreset?: SpringPreset;
  /** Duration in frames */
  durationFrames?: number;
  /** Distortion intensity (for shader effects) */
  distortionIntensity?: number;
  /** Fade out at edges */
  fadeEdges?: boolean;
}

// =============================================================================
// SHADER CODE
// =============================================================================

const RIPPLE_VERTEX = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RIPPLE_FRAGMENT = `
${GLSL_NOISE_STANDARD}
${GLSL_EASING_MINIMAL}

uniform float uProgress;
uniform float uTime;
uniform int uRingCount;
uniform float uMaxRadius;
uniform float uRingThickness;
uniform vec3 uColor;
uniform float uDistortion;
uniform float uFadeEdge;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vec2 center = vec2(0.5);
  float dist = length(vUv - center) * 2.0; // Normalize to 0-1 for radius

  // Current expansion radius
  float expandedRadius = uProgress * uMaxRadius;

  // Multiple rings with stagger
  float ringAlpha = 0.0;
  float glowAlpha = 0.0;

  for (int i = 0; i < 5; i++) {
    if (i >= uRingCount) break;

    // Stagger each ring
    float ringDelay = float(i) * 0.15;
    float ringProgress = max(0.0, uProgress - ringDelay);
    float ringRadius = ringProgress * uMaxRadius;

    // Ring mask
    float ringDist = abs(dist - ringRadius);
    float ring = smoothstep(uRingThickness, 0.0, ringDist);

    // Decay intensity for outer rings
    float decayFactor = 1.0 - float(i) * 0.2;

    // Add noise distortion to ring
    float noise = snoise(vec3(vUv * 10.0, uTime + float(i))) * uDistortion;
    ring *= (1.0 + noise * 0.3);

    // Fade based on expansion
    float fadeFactor = 1.0 - ringProgress;
    ring *= fadeFactor * decayFactor;

    ringAlpha += ring;

    // Glow around ring
    float glowDist = smoothstep(uRingThickness * 3.0, 0.0, ringDist);
    glowAlpha += glowDist * fadeFactor * decayFactor * 0.3;
  }

  // Edge fade
  float edgeFade = uFadeEdge > 0.5 ? 1.0 - smoothstep(0.8, 1.0, dist) : 1.0;

  // Final alpha
  float alpha = (ringAlpha + glowAlpha) * edgeFade;

  // Bright core, softer edges
  vec3 finalColor = uColor * (1.0 + ringAlpha * 0.5);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * RippleImpact - Expanding ripple effect
 *
 * Usage:
 * ```tsx
 * <RippleImpact
 *   impactFrame={30}
 *   center={[0, 0, 0]}
 *   ringCount={3}
 *   maxRadius={5}
 *   state="liquescent"
 * />
 * ```
 */
export const RippleImpact: React.FC<RippleImpactProps> = ({
  center = [0, 0, 0],
  impactFrame,
  ringCount = 3,
  maxRadius = 5,
  ringThickness = 0.08,
  state = 'awakening',
  springPreset = 'ripple',
  durationFrames = 45,
  distortionIntensity = 0.2,
  fadeEdges = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate expansion progress
  const progress = useMemo(() => {
    const localFrame = frame - impactFrame;
    if (localFrame < 0) return 0;
    if (localFrame > durationFrames) return 1;

    return spring({
      frame: localFrame,
      fps,
      config: springs[springPreset],
      durationInFrames: durationFrames,
    });
  }, [frame, impactFrame, durationFrames, fps, springPreset]);

  // Fade out alpha
  const fadeAlpha = useMemo(() => {
    const localFrame = frame - impactFrame;
    if (localFrame < 0) return 0;
    if (localFrame > durationFrames) return 0;

    // Fade out in last 30%
    const fadeStart = durationFrames * 0.7;
    if (localFrame < fadeStart) return 1;

    return interpolate(localFrame, [fadeStart, durationFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }, [frame, impactFrame, durationFrames]);

  const time = frame / fps;

  // State-based color
  const color = useMemo(() => {
    return new THREE.Color(stateColors[state].hex);
  }, [state]);

  // Uniforms
  const uniforms = useMemo(
    () => ({
      uProgress: { value: progress },
      uTime: { value: time },
      uRingCount: { value: ringCount },
      uMaxRadius: { value: 1.0 }, // Normalized, actual size comes from geometry
      uRingThickness: { value: ringThickness },
      uColor: { value: color },
      uDistortion: { value: distortionIntensity },
      uFadeEdge: { value: fadeEdges ? 1.0 : 0.0 },
    }),
    [progress, time, ringCount, ringThickness, color, distortionIntensity, fadeEdges]
  );

  // Don't render if not visible
  if (progress <= 0 || fadeAlpha <= 0) return null;

  return (
    <mesh position={center}>
      <planeGeometry args={[maxRadius * 2, maxRadius * 2]} />
      <shaderMaterial
        vertexShader={RIPPLE_VERTEX}
        fragmentShader={RIPPLE_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// =============================================================================
// RIPPLE PRESETS
// =============================================================================

/**
 * Command execution ripple
 */
export const CommandRipple: React.FC<{
  impactFrame: number;
  center?: [number, number, number];
}> = ({ impactFrame, center = [0, 0, 0] }) => {
  return (
    <RippleImpact
      impactFrame={impactFrame}
      center={center}
      ringCount={3}
      maxRadius={4}
      state="awakening"
      durationFrames={40}
    />
  );
};

/**
 * Success confirmation ripple
 */
export const SuccessRipple: React.FC<{
  impactFrame: number;
  center?: [number, number, number];
}> = ({ impactFrame, center = [0, 0, 0] }) => {
  return (
    <RippleImpact
      impactFrame={impactFrame}
      center={center}
      ringCount={4}
      maxRadius={6}
      state="liquescent"
      durationFrames={60}
      springPreset="membrane"
    />
  );
};

/**
 * Error/fail ripple
 */
export const ErrorRipple: React.FC<{
  impactFrame: number;
  center?: [number, number, number];
}> = ({ impactFrame, center = [0, 0, 0] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Use coral color for error
  const color = useMemo(() => new THREE.Color(light_tokens.coral.hex), []);

  const progress = useMemo(() => {
    const localFrame = frame - impactFrame;
    if (localFrame < 0) return 0;
    return spring({
      frame: localFrame,
      fps,
      config: springs.ripple,
      durationInFrames: 30,
    });
  }, [frame, impactFrame, fps]);

  if (progress <= 0) return null;

  return (
    <mesh position={center}>
      <planeGeometry args={[6, 6]} />
      <shaderMaterial
        vertexShader={RIPPLE_VERTEX}
        fragmentShader={RIPPLE_FRAGMENT}
        uniforms={{
          uProgress: { value: progress },
          uTime: { value: frame / fps },
          uRingCount: { value: 2 },
          uMaxRadius: { value: 1.0 },
          uRingThickness: { value: 0.1 },
          uColor: { value: color },
          uDistortion: { value: 0.4 },
          uFadeEdge: { value: 1.0 },
        }}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// =============================================================================
// MULTI-RIPPLE COMPONENT
// =============================================================================

/**
 * Multiple ripples triggered in sequence
 */
export const RippleSequence: React.FC<{
  impacts: Array<{
    frame: number;
    center: [number, number, number];
    state?: LiquescentState;
  }>;
  ringCount?: number;
  maxRadius?: number;
}> = ({ impacts, ringCount = 3, maxRadius = 4 }) => {
  return (
    <>
      {impacts.map((impact, index) => (
        <RippleImpact
          key={`ripple-${index}-${impact.frame}`}
          impactFrame={impact.frame}
          center={impact.center}
          state={impact.state || 'awakening'}
          ringCount={ringCount}
          maxRadius={maxRadius}
        />
      ))}
    </>
  );
};

export default RippleImpact;
