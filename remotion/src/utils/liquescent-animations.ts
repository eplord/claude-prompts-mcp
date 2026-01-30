/**
 * Liquescent Animation Utilities
 *
 * Replaces organic-animations.ts with Perlin-based liquid motion.
 * All animations follow the viscous physics model.
 */

import { spring } from 'remotion';
import {
  organicDrift,
  organicTremble,
  fractalNoise2D,
  perlin2D,
} from '../design-system/physics';
import {
  springs,
  durations,
  durationToFrames,
  getBreathIntensity,
  getBreathScale,
  breathCycle,
  calculateStagger,
} from '../design-system/tokens';
import type { LiquescentState, SpringPreset } from '../design-system/types';

// =============================================================================
// BREATHING ANIMATIONS — SUBTLE, BARELY PERCEPTIBLE
// =============================================================================

/**
 * Liquid breathing — subtle organic variation
 *
 * Philosophy: The breath should be FELT, not SEEN.
 * It adds life to static elements without being distracting.
 *
 * Returns value in range ~[0.97, 1.03] with Perlin variation
 *
 * @param frame - Current frame
 * @param fps - Frames per second
 * @param options - Configuration options
 */
export const liquidBreath = (
  frame: number,
  fps: number,
  options: {
    intensity?: number;
    seed?: number;
  } = {}
): number => {
  const { intensity = 1, seed = 0 } = options;

  // Use the design system's subtle breath intensity (0.97-1.0)
  const baseBreath = getBreathIntensity(frame, fps, seed);

  // Add very subtle Perlin noise for organic uniqueness
  // Much lower frequency and amplitude than before
  const noiseT = frame * 0.002; // Slower noise evolution
  const noiseModulation = perlin2D(noiseT + seed, seed * 0.7) * 0.02; // 2% variation

  // Scale by intensity but keep very subtle
  const scaledIntensity = 1 + (intensity - 1) * 0.3; // Dampen intensity multiplier

  return baseBreath * (1 + noiseModulation) * scaledIntensity;
};

/**
 * Liquid breathing opacity — very subtle fade variation
 *
 * Returns opacity in a narrow range (default: 0.92-1.0)
 * Much more subtle than before to avoid "pulsing" effect
 */
export const liquidBreathOpacity = (
  frame: number,
  fps: number,
  min: number = 0.92,
  max: number = 1.0,
  seed: number = 0
): number => {
  const breath = liquidBreath(frame, fps, { seed });
  // Map breath (0.97-1.03) to subtle opacity range
  const normalized = (breath - 0.97) / 0.06; // 0-1 range
  return min + Math.max(0, Math.min(1, normalized)) * (max - min);
};

/**
 * Liquid breathing scale — barely visible size variation
 *
 * Returns scale in range ~[0.993, 1.007] (1.5% variation)
 * Amplitude parameter further reduces this for ultra-subtle use
 */
export const liquidBreathScale = (
  frame: number,
  fps: number,
  amplitude: number = 1.0, // Multiplier for base amplitude (1.0 = 1.5% variation)
  seed: number = 0
): number => {
  // Use design system's breath scale (already very subtle)
  const baseScale = getBreathScale(frame, fps, seed);

  // Apply amplitude multiplier (capped for subtlety)
  const cappedAmplitude = Math.min(amplitude, 2.0);
  const deviation = (baseScale - 1) * cappedAmplitude;

  return 1 + deviation;
};

/**
 * Liquid breathing glow — subtle glow intensity variation
 *
 * Returns glow multiplier in range ~[0.9, 1.1] (10% variation)
 * Slower cycle than scale for layered organic effect
 */
export const liquidBreathGlow = (
  frame: number,
  fps: number,
  seed: number = 0
): number => {
  // Offset seed for different phase from scale
  const breath = getBreathIntensity(frame, fps, seed + 100);

  // Map to glow range (0.9-1.1)
  const normalized = (breath - 0.97) / 0.03; // 0-1 range
  return 0.9 + normalized * breathCycle.glowAmplitude * 2;
};

// =============================================================================
// FLOATING/DRIFT ANIMATIONS
// =============================================================================

/**
 * Liquid floating motion - Perlin-based drift
 * Replaces: floatingMotionY, floatingMotionXY
 *
 * @param frame - Current frame
 * @param seed - Unique seed for this element
 * @param options - Configuration
 */
export const liquidDrift = (
  frame: number,
  seed: number,
  options: {
    speed?: number;
    amplitude?: number;
    viscosity?: number;
  } = {}
): { x: number; y: number } => {
  const { speed = 1, amplitude = 8, viscosity = 0.6 } = options;

  // Get organic drift from physics system
  const drift = organicDrift(frame, seed, speed * viscosity, 0.01, amplitude);

  return drift;
};

/**
 * Liquid Y-only float (for compatibility)
 */
export const liquidFloatY = (
  frame: number,
  _fps: number,
  amplitude: number = 8,
  seed: number = 0
): number => {
  const drift = liquidDrift(frame, seed, { amplitude });
  return drift.y;
};

// =============================================================================
// REVEAL ANIMATIONS
// =============================================================================

/**
 * Liquid fade in with viscous easing
 * Replaces: organicFadeIn
 */
export const liquidFadeIn = (
  frame: number,
  startFrame: number,
  durationFrames: number,
  springPreset: SpringPreset = 'membrane',
  fps: number = 30
): number => {
  if (frame < startFrame) return 0;
  if (frame >= startFrame + durationFrames) return 1;

  // Use spring physics for organic feel
  return spring({
    frame: frame - startFrame,
    fps,
    config: springs[springPreset],
    durationInFrames: durationFrames,
  });
};

/**
 * Liquid bloom reveal - scale + opacity with glow
 * Replaces: bloomReveal
 */
export const liquidBloom = (
  frame: number,
  startFrame: number,
  fps: number,
  durationMs: number = durations.viscous
): {
  scale: number;
  opacity: number;
  glowIntensity: number;
} => {
  const durationFrames = durationToFrames(durationMs, fps);
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return { scale: 0, opacity: 0, glowIntensity: 0 };
  }

  if (localFrame >= durationFrames) {
    return { scale: 1, opacity: 1, glowIntensity: 0.8 };
  }

  // Spring-based scale
  const scale = spring({
    frame: localFrame,
    fps,
    config: springs.membrane,
    durationInFrames: durationFrames,
  });

  // Opacity follows scale
  const opacity = scale;

  // Glow peaks in middle, settles at end
  const progress = localFrame / durationFrames;
  const glowIntensity = progress < 0.5
    ? progress * 2
    : 1 - (progress - 0.5) * 0.4;

  return { scale, opacity, glowIntensity };
};

/**
 * Cascade reveal with stagger
 * Replaces: cascadeReveal
 */
export const liquidCascade = (
  frame: number,
  startFrame: number,
  totalItems: number,
  options: {
    staggerPattern?: 'ripple' | 'cascade' | 'organic' | 'wave';
    viscosity?: number;
    springPreset?: SpringPreset;
  } = {}
): number[] => {
  const {
    staggerPattern = 'cascade',
    viscosity = 0.6,
    springPreset = 'membrane',
  } = options;

  return Array.from({ length: totalItems }, (_, index) => {
    const staggerDelay = calculateStagger(index, staggerPattern, viscosity);
    const itemStart = startFrame + staggerDelay;
    return liquidFadeIn(frame, itemStart, 15, springPreset);
  });
};

// =============================================================================
// COALESCE ANIMATION (NEW)
// =============================================================================

/**
 * Coalesce animation - elements gather from scattered positions
 * This is a signature Liquescent effect
 */
export const liquidCoalesce = (
  frame: number,
  startFrame: number,
  fps: number,
  elementIndex: number,
  _totalElements: number,
  options: {
    scatterRadius?: number;
    durationMs?: number;
  } = {}
): {
  x: number;
  y: number;
  opacity: number;
  rotation: number;
} => {
  const { scatterRadius = 200, durationMs = durations.drift } = options;
  const durationFrames = durationToFrames(durationMs, fps);
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    // Initial scattered state - use Perlin for organic scatter
    const scatterX = fractalNoise2D(elementIndex * 1.7, 0) * scatterRadius;
    const scatterY = fractalNoise2D(0, elementIndex * 1.7) * scatterRadius;
    const rotation = perlin2D(elementIndex, elementIndex * 0.5) * 45;
    return { x: scatterX, y: scatterY, opacity: 0.3, rotation };
  }

  if (localFrame >= durationFrames) {
    return { x: 0, y: 0, opacity: 1, rotation: 0 };
  }

  // Progress with stagger
  const stagger = calculateStagger(elementIndex, 'cascade', 0.8);
  const adjustedFrame = Math.max(0, localFrame - stagger);
  const adjustedDuration = durationFrames - stagger;

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: springs.dissolution,
    durationInFrames: adjustedDuration,
  });

  // Interpolate from scattered to center
  const scatterX = fractalNoise2D(elementIndex * 1.7, 0) * scatterRadius;
  const scatterY = fractalNoise2D(0, elementIndex * 1.7) * scatterRadius;
  const rotation = perlin2D(elementIndex, elementIndex * 0.5) * 45;

  return {
    x: scatterX * (1 - progress),
    y: scatterY * (1 - progress),
    opacity: 0.3 + 0.7 * progress,
    rotation: rotation * (1 - progress),
  };
};

// =============================================================================
// STATE TRANSITION ANIMATIONS
// =============================================================================

/**
 * State transition animation
 * Animates between dormant → awakening → liquescent
 */
export const stateTransition = (
  frame: number,
  startFrame: number,
  fps: number,
  fromState: LiquescentState,
  toState: LiquescentState
): {
  progress: number;
  currentHue: number;
  currentChroma: number;
} => {
  // State hue values
  const stateHues: Record<LiquescentState, number> = {
    dormant: 200, // Cyan
    awakening: 75, // Amber
    liquescent: 145, // Chartreuse
  };

  // State chroma values
  const stateChromas: Record<LiquescentState, number> = {
    dormant: 0.14,
    awakening: 0.18,
    liquescent: 0.24,
  };

  // Determine spring config based on transition
  const springConfig = toState === 'liquescent'
    ? springs.dissolution
    : toState === 'awakening'
      ? springs.membrane
      : springs.ripple;

  const durationFrames = toState === 'liquescent' ? 18 : toState === 'awakening' ? 12 : 9;

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: springConfig,
    durationInFrames: durationFrames,
  });

  const currentHue = stateHues[fromState] + (stateHues[toState] - stateHues[fromState]) * progress;
  const currentChroma = stateChromas[fromState] + (stateChromas[toState] - stateChromas[fromState]) * progress;

  return { progress, currentHue, currentChroma };
};

// =============================================================================
// TREMBLING/LIQUEFACTION
// =============================================================================

/**
 * Trembling animation for "about to liquefy" effect
 */
export const liquidTremble = (
  frame: number,
  seed: number,
  intensity: number = 1
): { x: number; y: number; rotation: number } => {
  return organicTremble(frame, seed, intensity);
};

/**
 * Liquefaction animation - element melts/flows
 */
export const liquidMelt = (
  frame: number,
  startFrame: number,
  fps: number,
  durationMs: number = durations.drift
): {
  scaleY: number;
  translateY: number;
  opacity: number;
  blur: number;
} => {
  const durationFrames = durationToFrames(durationMs, fps);
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return { scaleY: 1, translateY: 0, opacity: 1, blur: 0 };
  }

  const progress = Math.min(1, localFrame / durationFrames);

  // Elastic-ish melt effect
  const meltProgress = progress < 0.3
    ? progress * 3.33 // Fast initial stretch
    : 1 + (progress - 0.3) * 0.5; // Slow settling

  return {
    scaleY: 1 + meltProgress * 0.3, // Stretch vertically
    translateY: meltProgress * 20, // Flow downward
    opacity: 1 - progress * 0.3, // Slight fade
    blur: progress * 5, // Increase blur as it melts
  };
};

// =============================================================================
// RIPPLE EFFECTS
// =============================================================================

/**
 * Ripple ring animation
 */
export const liquidRipple = (
  frame: number,
  startFrame: number,
  fps: number,
  ringIndex: number,
  options: {
    maxRadius?: number;
    durationMs?: number;
    ringDelay?: number;
  } = {}
): {
  radius: number;
  opacity: number;
  strokeWidth: number;
} => {
  const { maxRadius = 200, durationMs = durations.slow, ringDelay = 100 } = options;

  const durationFrames = durationToFrames(durationMs, fps);
  const delayFrames = durationToFrames(ringDelay * ringIndex, fps);
  const localFrame = frame - startFrame - delayFrames;

  if (localFrame < 0) {
    return { radius: 0, opacity: 0, strokeWidth: 3 };
  }

  if (localFrame >= durationFrames) {
    return { radius: maxRadius, opacity: 0, strokeWidth: 0.5 };
  }

  const progress = localFrame / durationFrames;

  // Spring-like expansion
  const springProgress = spring({
    frame: localFrame,
    fps,
    config: springs.ripple,
    durationInFrames: durationFrames,
  });

  return {
    radius: springProgress * maxRadius,
    opacity: (1 - progress) * 0.8,
    strokeWidth: 3 - progress * 2.5,
  };
};

// =============================================================================
// FLOW ANIMATIONS
// =============================================================================

/**
 * Energy flow for connections
 * Replaces: energyFlow
 */
export const liquidFlow = (
  frame: number,
  fps: number,
  options: {
    speed?: number;
    patternLength?: number;
    viscosity?: number;
  } = {}
): number => {
  const { speed = 1, patternLength = 100, viscosity = 0.6 } = options;

  // Flow speed affected by viscosity
  const adjustedSpeed = speed / viscosity;
  return (frame * adjustedSpeed * 2) % patternLength;
};

/**
 * Particle stream position along path
 */
export const liquidParticleStream = (
  frame: number,
  _fps: number,
  particleIndex: number,
  totalParticles: number,
  pathLength: number,
  options: {
    speed?: number;
    viscosity?: number;
    cycleFrames?: number;
  } = {}
): number => {
  const { speed = 1, viscosity = 0.6, cycleFrames = 60 } = options;

  const offset = particleIndex / totalParticles;
  const adjustedSpeed = speed / viscosity;
  const progress = ((frame / cycleFrames) * adjustedSpeed + offset) % 1;

  return progress * pathLength;
};

// =============================================================================
// LEGACY COMPATIBILITY EXPORTS
// =============================================================================

// Map old names to new functions for gradual migration
export const breathingGlow = liquidBreath;
export const breathingOpacity = liquidBreathOpacity;
export const breathingScale = liquidBreathScale;
export const floatingMotionY = liquidFloatY;
export const organicFadeIn = liquidFadeIn;
export const bloomReveal = liquidBloom;
export const cascadeReveal = liquidCascade;
export const energyFlow = liquidFlow;
