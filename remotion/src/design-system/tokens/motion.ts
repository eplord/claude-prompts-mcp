/**
 * Liquescent Design System - Motion Tokens
 *
 * Philosophy: "❌ Linear = mechanical, dead. ❌ Cubic-bezier = smooth but predictable. ✅ Spring physics = ALIVE."
 *
 * Movement through viscous resistance:
 * - Low damping = LIQUESCENT (bouncy, alive)
 * - High mass = deliberate, intentional
 * - Variable stiffness = breathing
 */

import type { SpringConfig, SpringPreset, DurationToken, DepthZone } from '../types';

// =============================================================================
// SPRING PHYSICS CONFIGURATIONS
// =============================================================================

/**
 * Spring presets for different animation contexts
 *
 * These work with Remotion's spring() function:
 * ```
 * spring({ frame, fps, config: springs.viscous })
 * ```
 */
export const springs: Record<SpringPreset, SpringConfig> = {
  /**
   * Viscous — moving through honey
   * Smooth deceleration with resistance
   * Use for: Major state transitions, modal reveals
   */
  viscous: {
    damping: 30,
    stiffness: 80,
    mass: 1.2,
  },

  /**
   * Membrane — responsive but controlled
   * Low mass = reactive, moderate damping = stable
   * Use for: Container animations, hover states
   */
  membrane: {
    damping: 25,
    stiffness: 120,
    mass: 0.8,
  },

  /**
   * Dissolution — slow, deliberate settling
   * High mass + high damping = intentional movement
   * Use for: Exit animations, Ganzfeld transitions
   */
  dissolution: {
    damping: 40,
    stiffness: 60,
    mass: 1.5,
  },

  /**
   * Ripple — fast initial, long decay
   * Low damping = bouncy, high stiffness = quick response
   * Use for: Impact propagation, click feedback
   */
  ripple: {
    damping: 15,
    stiffness: 200,
    mass: 0.5,
  },

  /**
   * Breath — organic pulse
   * Balanced for slow, rhythmic motion
   * Use for: Idle animations, ambient movement
   */
  breath: {
    damping: 20,
    stiffness: 60,
    mass: 1.0,
  },
} as const;

// =============================================================================
// DURATION TOKENS
// =============================================================================

/**
 * Duration values in milliseconds
 * Aligned with breath cycle (60 BPM = 1000ms)
 */
export const durations: Record<DurationToken, number> = {
  /** Immediate feedback */
  instant: 0,
  /** Micro-interactions */
  quick: 150,
  /** Standard transitions */
  viscous: 400,
  /** Major state changes */
  drift: 800,
  /** Dramatic reveals */
  slow: 1200,
  /** 60 BPM breath cycle */
  breath: 1000,
  /** Full atmospheric cycle */
  deepBreath: 3000,
} as const;

/**
 * Convert duration to frames at given FPS
 */
export const durationToFrames = (duration: DurationToken | number, fps: number): number => {
  const ms = typeof duration === 'number' ? duration : durations[duration];
  return Math.round((ms / 1000) * fps);
};

// =============================================================================
// VISCOSITY ZONES
// =============================================================================

/**
 * Viscosity values for each depth zone
 * Lower = faster propagation, less resistance
 * Higher = slower, more controlled
 */
export const viscosityZones: Record<DepthZone, number> = {
  /** 0-25% depth: Slow, distinct ripples. Maximum clarity. */
  surface: 0.8,
  /** 25-50% depth: Engaged. Effects propagate faster. */
  immersed: 0.6,
  /** 50-75% depth: Fast, blurring. Depth cues weaken. */
  deep: 0.4,
  /** 75-100% depth: Instant propagation. Ganzfeld activates. */
  abyss: 0.2,
} as const;

/**
 * Get viscosity based on progress (0-1)
 */
export const getViscosity = (progress: number): number => {
  if (progress < 0.25) return viscosityZones.surface;
  if (progress < 0.5) return viscosityZones.immersed;
  if (progress < 0.75) return viscosityZones.deep;
  return viscosityZones.abyss;
};

/**
 * Get depth zone based on progress (0-1)
 */
export const getDepthZone = (progress: number): DepthZone => {
  if (progress < 0.25) return 'surface';
  if (progress < 0.5) return 'immersed';
  if (progress < 0.75) return 'deep';
  return 'abyss';
};

// =============================================================================
// STAGGER PATTERNS
// =============================================================================

/**
 * Stagger delay presets (in frames at 30fps)
 */
export const stagger = {
  /** Tight ripple — fast propagation */
  ripple: 3, // 100ms
  /** Natural cascade — comfortable reading pace */
  cascade: 5, // ~167ms
  /** Organic flow — breathing room */
  organic: 8, // ~267ms
  /** Deep wave — dramatic reveals */
  wave: 12, // 400ms
} as const;

/**
 * Calculate stagger delay for an element
 */
export const calculateStagger = (
  index: number,
  pattern: keyof typeof stagger = 'cascade',
  viscosity: number = 0.6
): number => {
  return Math.round(stagger[pattern] * index * viscosity);
};

// =============================================================================
// BREATH CYCLE CONFIGURATION
// =============================================================================

/**
 * Breath cycle parameters - SUBTLE, barely perceptible
 * Philosophy: Breathing adds life, not distraction
 *
 * The effect should be felt more than seen — like the difference
 * between a still image and a living interface.
 */
export const breathCycle = {
  /** Base cycle duration in ms (slow, deliberate) */
  duration: 4000,
  /** Duration in frames at 30fps */
  frames: 120,
  /** Minimum breath intensity (very close to max for subtlety) */
  min: 0.97,
  /** Maximum breath intensity */
  max: 1.0,
  /** Scale amplitude (2% variation — barely visible) */
  scaleAmplitude: 0.015,
  /** Glow amplitude (10% variation) */
  glowAmplitude: 0.1,
} as const;

/**
 * Calculate subtle breath intensity at a given frame
 *
 * Unlike a simple sine wave, this uses multiple layered frequencies
 * with Perlin-style variation so no two cycles are identical.
 *
 * Returns value in range [0.97, 1.0] — nearly imperceptible
 */
export const getBreathIntensity = (frame: number, fps: number = 30, seed: number = 0): number => {
  // Primary slow wave (4 second cycle)
  const primaryCycleFrames = breathCycle.frames * (fps / 30);
  const primaryPhase = ((frame + seed * 17) % primaryCycleFrames) / primaryCycleFrames;
  const primaryWave = Math.sin(primaryPhase * Math.PI * 2);

  // Secondary slower wave for variation (7 second cycle, offset)
  const secondaryCycleFrames = primaryCycleFrames * 1.75;
  const secondaryPhase = ((frame + seed * 31) % secondaryCycleFrames) / secondaryCycleFrames;
  const secondaryWave = Math.sin(secondaryPhase * Math.PI * 2) * 0.3;

  // Combine waves (primary dominates, secondary adds variation)
  const combinedWave = (primaryWave + secondaryWave) / 1.3;

  // Map to subtle range [0.97, 1.0]
  return breathCycle.min + (breathCycle.max - breathCycle.min) * ((combinedWave + 1) / 2);
};

/**
 * Calculate breath-based scale (very subtle)
 * Returns value like 0.993 - 1.007 (barely visible)
 */
export const getBreathScale = (frame: number, fps: number = 30, seed: number = 0): number => {
  const intensity = getBreathIntensity(frame, fps, seed);
  // Center around 1.0 with tiny amplitude
  const normalizedBreath = (intensity - 0.985) / 0.015; // -1 to 1
  return 1 + normalizedBreath * breathCycle.scaleAmplitude;
};

// =============================================================================
// LINEAR() EASING (CSS-style spring approximation)
// =============================================================================

/**
 * CSS linear() easing function for spring physics
 * Use in CSS contexts where Remotion's spring() isn't available
 */
export const linearSpring = `linear(
  0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%,
  0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%,
  1.015 55%, 1.017 63.9%, 1.001
)`;

/**
 * CSS cubic-bezier fallback for viscous motion
 */
export const cubicViscous = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * CSS cubic-bezier for drift motion
 */
export const cubicDrift = 'cubic-bezier(0.16, 1, 0.3, 1)';

// =============================================================================
// STATE TRANSITION TIMING
// =============================================================================

/**
 * Duration for state transitions (in frames at 30fps)
 */
export const stateTransitions = {
  /** dormant → awakening: warming up */
  toAwakening: 12, // 400ms
  /** awakening → liquescent: full dissolution */
  toLiquescent: 18, // 600ms
  /** Any → dormant: reset/cool down */
  toDormant: 9, // 300ms
  /** Ripple propagation between siblings */
  propagation: 3, // 100ms per unit distance
} as const;

/**
 * Get spring config for a state transition
 */
export const getTransitionSpring = (
  _from: string,
  to: string
): SpringConfig => {
  if (to === 'liquescent') return springs.dissolution;
  if (to === 'awakening') return springs.membrane;
  if (to === 'dormant') return springs.ripple;
  return springs.viscous;
};

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

export const motion = {
  springs,
  durations,
  stagger,
  viscosityZones,
  breathCycle,
  stateTransitions,
} as const;
