/**
 * LiquidWipe - Shader-based Section Transition
 *
 * Creates an organic wipe effect for transitioning between scenes.
 * Uses Perlin noise for a liquid, organic edge rather than a hard line.
 *
 * Philosophy: Transitions should feel like moving through viscous medium,
 * not like cutting between two separate realities.
 *
 * CRITICAL: All timing from Remotion's frame system.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { GLSL_NOISE_STANDARD, GLSL_EASING_MINIMAL } from '../../../shaders';
import { stateColors, void_tokens } from '../../../design-system/tokens/colors';
import { springs } from '../../../design-system/tokens/motion';
import type { LiquescentState, SpringPreset } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export type WipeDirection = 'left' | 'right' | 'up' | 'down' | 'radial';

export interface LiquidWipeProps {
  /** Wipe progress (0-1) */
  progress?: number;
  /** Frame-driven progress (alternative to progress prop) */
  startFrame?: number;
  /** Duration in frames */
  durationFrames?: number;
  /** Wipe direction */
  direction?: WipeDirection;
  /** Edge noise intensity (0-1) */
  edgeNoise?: number;
  /** Edge thickness (world units) */
  edgeThickness?: number;
  /** Liquescent state for edge color */
  state?: LiquescentState;
  /** Spring preset for animation */
  springPreset?: SpringPreset;
  /** Render as full-screen plane */
  fullScreen?: boolean;
  /** Plane size if not fullScreen */
  size?: [number, number];
  /** Z position */
  zPosition?: number;
}

// =============================================================================
// SHADER CODE
// =============================================================================

const LIQUID_WIPE_VERTEX = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LIQUID_WIPE_FRAGMENT = `
${GLSL_NOISE_STANDARD}
${GLSL_EASING_MINIMAL}

uniform float uProgress;
uniform float uTime;
uniform float uEdgeNoise;
uniform float uEdgeThickness;
uniform vec3 uEdgeColor;
uniform vec3 uBackgroundColor;
uniform int uDirection;

varying vec2 vUv;

float getDirectionalProgress(vec2 uv, int dir) {
  // 0: left, 1: right, 2: up, 3: down, 4: radial
  if (dir == 0) return uv.x;
  if (dir == 1) return 1.0 - uv.x;
  if (dir == 2) return uv.y;
  if (dir == 3) return 1.0 - uv.y;
  // Radial
  vec2 center = vec2(0.5);
  return length(uv - center) * 1.414; // Normalize to 0-1 for corners
}

void main() {
  vec2 uv = vUv;

  // Get directional progress
  float dirProgress = getDirectionalProgress(uv, uDirection);

  // Add noise to the edge
  float noise = snoise(vec3(uv * 8.0, uTime * 0.5)) * uEdgeNoise;

  // Calculate wipe position with noise
  float wipePos = uProgress + noise * 0.1;

  // Edge mask with soft falloff
  float edge = smoothstep(wipePos - uEdgeThickness, wipePos, dirProgress);
  float edgeGlow = smoothstep(wipePos - uEdgeThickness * 2.0, wipePos - uEdgeThickness * 0.5, dirProgress)
                 - smoothstep(wipePos - uEdgeThickness * 0.5, wipePos, dirProgress);

  // Background visibility
  float bgAlpha = edge;

  // Edge glow
  vec3 glowColor = uEdgeColor * edgeGlow * 2.0;

  // Final color
  vec3 finalColor = mix(uBackgroundColor, glowColor, edgeGlow * 0.8);
  float finalAlpha = bgAlpha + edgeGlow * 0.5;

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * LiquidWipe - Organic wipe transition
 *
 * Usage:
 * ```tsx
 * // Frame-driven (recommended)
 * <LiquidWipe
 *   startFrame={240}
 *   durationFrames={30}
 *   direction="right"
 *   state="awakening"
 * />
 *
 * // Progress-driven
 * <LiquidWipe progress={0.5} direction="radial" />
 * ```
 */
export const LiquidWipe: React.FC<LiquidWipeProps> = ({
  progress: progressProp,
  startFrame = 0,
  durationFrames = 30,
  direction = 'right',
  edgeNoise = 0.4,
  edgeThickness = 0.08,
  state = 'awakening',
  springPreset = 'membrane',
  fullScreen = true,
  size = [20, 12],
  zPosition = 5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate progress
  const progress = useMemo(() => {
    if (progressProp !== undefined) return progressProp;

    const localFrame = frame - startFrame;
    if (localFrame < 0) return 0;
    if (localFrame > durationFrames) return 1;

    return spring({
      frame: localFrame,
      fps,
      config: springs[springPreset],
      durationInFrames: durationFrames,
    });
  }, [progressProp, frame, startFrame, durationFrames, fps, springPreset]);

  // Time for noise animation
  const time = frame / fps;

  // Direction mapping
  const directionIndex = useMemo(() => {
    const map: Record<WipeDirection, number> = {
      left: 0,
      right: 1,
      up: 2,
      down: 3,
      radial: 4,
    };
    return map[direction];
  }, [direction]);

  // State-based edge color
  const edgeColor = useMemo(() => {
    return new THREE.Color(stateColors[state].hex);
  }, [state]);

  const backgroundColor = useMemo(() => {
    return new THREE.Color(void_tokens.abyss.hex);
  }, []);

  // Uniforms
  const uniforms = useMemo(
    () => ({
      uProgress: { value: progress },
      uTime: { value: time },
      uEdgeNoise: { value: edgeNoise },
      uEdgeThickness: { value: edgeThickness },
      uEdgeColor: { value: edgeColor },
      uBackgroundColor: { value: backgroundColor },
      uDirection: { value: directionIndex },
    }),
    [progress, time, edgeNoise, edgeThickness, edgeColor, backgroundColor, directionIndex]
  );

  // Don't render if not visible
  if (progress <= 0 || progress >= 1) return null;

  return (
    <mesh position={[0, 0, zPosition]}>
      <planeGeometry args={fullScreen ? [100, 100] : size} />
      <shaderMaterial
        vertexShader={LIQUID_WIPE_VERTEX}
        fragmentShader={LIQUID_WIPE_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/**
 * Section transition - standard liquid wipe between sections
 */
export const SectionTransition: React.FC<{
  startFrame: number;
  duration?: number;
  direction?: WipeDirection;
}> = ({ startFrame, duration = 30, direction = 'right' }) => {
  return (
    <LiquidWipe
      startFrame={startFrame}
      durationFrames={duration}
      direction={direction}
      state="awakening"
      edgeNoise={0.5}
      edgeThickness={0.1}
    />
  );
};

/**
 * Reveal transition - radial reveal from center
 */
export const RevealTransition: React.FC<{
  startFrame: number;
  duration?: number;
}> = ({ startFrame, duration = 45 }) => {
  return (
    <LiquidWipe
      startFrame={startFrame}
      durationFrames={duration}
      direction="radial"
      state="liquescent"
      edgeNoise={0.6}
      edgeThickness={0.12}
      springPreset="dissolution"
    />
  );
};

/**
 * Exit transition - wipe to black
 */
export const ExitTransition: React.FC<{
  startFrame: number;
  duration?: number;
  direction?: WipeDirection;
}> = ({ startFrame, duration = 20, direction = 'left' }) => {
  return (
    <LiquidWipe
      startFrame={startFrame}
      durationFrames={duration}
      direction={direction}
      state="dormant"
      edgeNoise={0.3}
      edgeThickness={0.06}
      springPreset="viscous"
    />
  );
};

export default LiquidWipe;
