/**
 * Three.js Hooks for Remotion Integration
 *
 * CRITICAL: All animation must be driven by Remotion's frame count.
 * Never use Three.js Clock or requestAnimationFrame for timing.
 *
 * Frame sync ensures:
 * - Deterministic renders (same frame = same output)
 * - Scrubbing works correctly in studio
 * - Final render matches preview exactly
 */

import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useMemo } from 'react';
import * as THREE from 'three';
import { springs, breathCycle, getBreathIntensity, getViscosity } from '../../design-system/tokens/motion';
import { light_tokens, void_tokens } from '../../design-system/tokens/colors';
import type { LiquescentState, SpringConfig, DepthZone } from '../../design-system/types';

// =============================================================================
// FRAME SYNCHRONIZATION
// =============================================================================

/**
 * Core hook: Get frame-synced time for Three.js animations
 *
 * @returns Object with frame, time (seconds), and progress (0-1 for composition)
 */
export const useFrameSync = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return useMemo(
    () => ({
      frame,
      fps,
      time: frame / fps,
      progress: frame / durationInFrames,
      durationInFrames,
    }),
    [frame, fps, durationInFrames]
  );
};

/**
 * Get frame-synced uniforms for shader materials
 *
 * Usage:
 * ```tsx
 * const uniforms = useShaderUniforms(state);
 * <shaderMaterial uniforms={uniforms} />
 * ```
 */
export const useShaderUniforms = (state: LiquescentState = 'dormant', depthProgress: number = 0) => {
  const { time, progress } = useFrameSync();

  return useMemo(() => {
    const stateIntensity = state === 'liquescent' ? 1.0 : state === 'awakening' ? 0.6 : 0.2;
    const stateColor =
      state === 'liquescent'
        ? light_tokens.liquescent.hex
        : state === 'awakening'
          ? light_tokens.awakening.hex
          : light_tokens.dormant.hex;

    return {
      uTime: { value: time },
      uProgress: { value: progress },
      uStateIntensity: { value: stateIntensity },
      uStateColor: { value: new THREE.Color(stateColor) },
      uDepth: { value: depthProgress },
      uViscosity: { value: getViscosity(depthProgress) },
    };
  }, [time, progress, state, depthProgress]);
};

// =============================================================================
// BREATHING ANIMATION
// =============================================================================

/**
 * Get subtle breathing values for ambient animation
 *
 * Returns values that create organic, living motion:
 * - scale: ~0.993-1.007 (barely visible)
 * - intensity: ~0.97-1.0 (subtle glow variation)
 * - glowIntensity: ~0.9-1.1 (more visible for light effects)
 */
export const useBreathing = (seed: number = 0) => {
  const { frame, fps } = useFrameSync();

  return useMemo(() => {
    const intensity = getBreathIntensity(frame, fps, seed);

    // Center around 1.0 with tiny amplitude
    const normalizedBreath = (intensity - 0.985) / 0.015;
    const scale = 1 + normalizedBreath * breathCycle.scaleAmplitude;

    // Glow can be more dramatic
    const glowIntensity = 0.9 + (intensity - breathCycle.min) * (0.2 / (breathCycle.max - breathCycle.min));

    return {
      scale,
      intensity,
      glowIntensity,
    };
  }, [frame, fps, seed]);
};

// =============================================================================
// STATE-BASED COLORS
// =============================================================================

/**
 * Get Three.js Color objects for current state
 */
export const useStateColors = (state: LiquescentState = 'dormant') => {
  return useMemo(() => {
    const primary =
      state === 'liquescent'
        ? light_tokens.liquescent.hex
        : state === 'awakening'
          ? light_tokens.awakening.hex
          : light_tokens.dormant.hex;

    return {
      primary: new THREE.Color(primary),
      background: new THREE.Color(void_tokens.deep.hex),
      surface: new THREE.Color(void_tokens.surface.hex),
      glow: new THREE.Color(primary).multiplyScalar(1.5), // Brighter for emission
    };
  }, [state]);
};

// =============================================================================
// SPRING ANIMATION
// =============================================================================

/**
 * Convert design system spring config to Three.js/react-spring format
 */
export const useSpringConfig = (preset: keyof typeof springs = 'viscous'): SpringConfig => {
  return useMemo(() => springs[preset], [preset]);
};

/**
 * Get interpolated value using spring physics
 * (Manual implementation for when @react-spring isn't available)
 */
export const useSpringValue = (target: number, config: SpringConfig = springs.viscous): number => {
  const { frame, fps } = useFrameSync();

  // Simple spring simulation based on frame
  // For more complex animation, use Remotion's spring() directly
  return useMemo(() => {
    const { damping, stiffness, mass } = config;
    const omega = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const t = frame / fps;

    // Critically damped or overdamped spring response
    if (zeta >= 1) {
      // Overdamped
      const r1 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
      return target * (1 - Math.exp(r1 * t));
    } else {
      // Underdamped (oscillates)
      const omegaD = omega * Math.sqrt(1 - zeta * zeta);
      return target * (1 - Math.exp(-zeta * omega * t) * Math.cos(omegaD * t));
    }
  }, [target, config, frame, fps]);
};

// =============================================================================
// DEPTH & VISCOSITY
// =============================================================================

/**
 * Get depth-based modifiers for parallax and viscosity
 */
export const useDepthModifiers = (depthProgress: number = 0) => {
  return useMemo(() => {
    const viscosity = getViscosity(depthProgress);

    // Determine zone
    let zone: DepthZone;
    if (depthProgress < 0.25) zone = 'surface';
    else if (depthProgress < 0.5) zone = 'immersed';
    else if (depthProgress < 0.75) zone = 'deep';
    else zone = 'abyss';

    // Parallax speeds (foreground faster, background slower)
    const parallaxMultiplier = 1 - depthProgress * 0.9;

    // Blur amount increases with depth
    const blurAmount = depthProgress * 2;

    // Ganzfeld effect (boundaries dissolve at deep levels)
    const ganzfeldOpacity = depthProgress > 0.75 ? (depthProgress - 0.75) * 4 : 0;

    return {
      viscosity,
      zone,
      parallaxMultiplier,
      blurAmount,
      ganzfeldOpacity,
    };
  }, [depthProgress]);
};

// =============================================================================
// CAMERA HELPERS
// =============================================================================

/**
 * Default camera configuration for Liquescent scenes
 */
export const DEFAULT_CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 1000,
  position: [0, 0, 10] as [number, number, number],
} as const;

/**
 * Calculate camera position for push-in/pull-out effects
 */
export const useCameraPosition = (baseZ: number = 10, pushAmount: number = 0) => {
  const { scale } = useBreathing();

  return useMemo(() => {
    // Subtle breathing affects camera z very slightly
    const breathZ = baseZ + (scale - 1) * 2;
    return {
      x: 0,
      y: 0,
      z: breathZ - pushAmount,
    };
  }, [baseZ, pushAmount, scale]);
};

// =============================================================================
// PARTICLE SYSTEM HELPERS
// =============================================================================

/**
 * Generate deterministic particle positions based on frame
 *
 * Uses seeded random to ensure same positions every render
 */
export const useParticlePositions = (count: number, spread: number = 10, seed: number = 12345) => {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);

    // Simple seeded random (deterministic)
    const seededRandom = (i: number) => {
      const x = Math.sin(seed * 9999 + i * 7919) * 43758.5453;
      return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seededRandom(i * 3) - 0.5) * spread; // x
      positions[i * 3 + 1] = (seededRandom(i * 3 + 1) - 0.5) * spread; // y
      positions[i * 3 + 2] = (seededRandom(i * 3 + 2) - 0.5) * spread; // z
    }

    return positions;
  }, [count, spread, seed]);
};

/**
 * Animate particle positions with organic drift
 */
export const useAnimatedParticles = (
  basePositions: Float32Array,
  driftSpeed: number = 0.1,
  seed: number = 0
) => {
  const { time } = useFrameSync();
  const count = basePositions.length / 3;

  return useMemo(() => {
    const animated = new Float32Array(basePositions.length);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      // Simple Perlin-like drift using sin/cos combinations
      const drift = Math.sin(time * driftSpeed + seed + i * 0.1) * 0.3;
      const drift2 = Math.cos(time * driftSpeed * 0.7 + seed + i * 0.13) * 0.2;

      animated[idx] = basePositions[idx] + drift;
      animated[idx + 1] = basePositions[idx + 1] + drift2;
      animated[idx + 2] = basePositions[idx + 2] + drift * 0.5;
    }

    return animated;
  }, [basePositions, time, driftSpeed, seed, count]);
};
