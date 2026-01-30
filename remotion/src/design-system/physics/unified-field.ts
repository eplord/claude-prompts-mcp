/**
 * Liquescent Design System - Unified Field Theory
 *
 * "The interface is a viscous medium. Every interaction creates disturbance."
 *
 * All user interactions follow a single equation:
 * effect(element) = disturbance × decay(distance) × depth_modifier × (1 / viscosity)
 *
 * This creates consistent, predictable propagation physics across all elements.
 */

import type { DisturbanceType, DepthZone } from '../types';
import { getViscosity, getDepthZone } from '../tokens/motion';

// =============================================================================
// DISTURBANCE AMPLITUDES
// =============================================================================

/**
 * Base amplitude for each disturbance type
 * - hover: Gentle awareness (surface tension bends)
 * - click: Definitive impact (stone dropped)
 * - focus: Moderate attraction (gravity well)
 * - scroll: Infinite (affects entire medium)
 */
export const disturbanceAmplitudes: Record<DisturbanceType, number> = {
  hover: 0.2,
  click: 1.0,
  focus: 0.6,
  scroll: Infinity,
};

// =============================================================================
// DECAY FUNCTIONS
// =============================================================================

/**
 * Distance decay function
 * Returns a value between 0 and 1 based on distance from origin
 *
 * @param distance - Distance from disturbance origin (in arbitrary units)
 * @param decayRate - How quickly effect diminishes (default 0.15)
 */
export const decayFunction = (distance: number, decayRate: number = 0.15): number => {
  return 1 / (1 + distance * decayRate);
};

/**
 * Exponential decay (faster falloff)
 */
export const exponentialDecay = (distance: number, halfLife: number = 3): number => {
  return Math.pow(0.5, distance / halfLife);
};

/**
 * Linear decay with cutoff
 */
export const linearDecay = (distance: number, maxDistance: number = 10): number => {
  return Math.max(0, 1 - distance / maxDistance);
};

// =============================================================================
// DEPTH MODIFIERS
// =============================================================================

/**
 * Depth modifier based on scroll/progress position
 * Deeper = effects are amplified (less resistance)
 *
 * @param progress - Current depth (0-1)
 */
export const depthModifier = (progress: number): number => {
  return 1 + progress * 0.5;
};

/**
 * Ganzfeld intensity based on depth
 * Activates at 75%+ depth (abyss zone)
 *
 * @param progress - Current depth (0-1)
 */
export const ganzfeldIntensity = (progress: number): number => {
  if (progress < 0.75) return 0;
  return (progress - 0.75) * 4; // 0→1 over last 25%
};

// =============================================================================
// MAIN UNIFIED FIELD CALCULATION
// =============================================================================

/**
 * Calculate the effect magnitude for an element
 *
 * @param disturbance - Type of disturbance
 * @param siblingDistance - Distance from disturbance origin (in sibling indices)
 * @param depthProgress - Current depth (0-1)
 * @returns Effect magnitude (0-∞)
 */
export const calculateFieldEffect = (
  disturbance: DisturbanceType,
  siblingDistance: number,
  depthProgress: number
): number => {
  const amplitude = disturbanceAmplitudes[disturbance];
  const decay = decayFunction(siblingDistance);
  const depth = depthModifier(depthProgress);
  const viscosity = getViscosity(depthProgress);

  // The unified equation
  return amplitude * decay * depth * (1 / viscosity);
};

/**
 * Calculate effect with custom parameters
 */
export const calculateFieldEffectCustom = (options: {
  amplitude: number;
  distance: number;
  depthProgress: number;
  decayRate?: number;
  viscosity?: number;
}): number => {
  const {
    amplitude,
    distance,
    depthProgress,
    decayRate = 0.15,
    viscosity = getViscosity(depthProgress),
  } = options;

  const decay = decayFunction(distance, decayRate);
  const depth = depthModifier(depthProgress);

  return amplitude * decay * depth * (1 / viscosity);
};

// =============================================================================
// PROPAGATION TIMING
// =============================================================================

/**
 * Calculate propagation delay for chain reaction
 *
 * @param siblingIndex - Index of sibling from origin
 * @param baseDelay - Base delay in milliseconds (default 100)
 * @param depthProgress - Current depth (affects speed)
 */
export const propagationDelay = (
  siblingIndex: number,
  baseDelay: number = 100,
  depthProgress: number = 0
): number => {
  const viscosity = getViscosity(depthProgress);
  // Lower viscosity = faster propagation
  return baseDelay * siblingIndex * viscosity;
};

/**
 * Convert propagation delay to frames
 */
export const propagationDelayFrames = (
  siblingIndex: number,
  fps: number,
  baseDelay: number = 100,
  depthProgress: number = 0
): number => {
  const ms = propagationDelay(siblingIndex, baseDelay, depthProgress);
  return Math.round((ms / 1000) * fps);
};

// =============================================================================
// RIPPLE CASCADE
// =============================================================================

/**
 * Calculate ripple parameters for a cascade effect
 *
 * @param originIndex - Index of the impact origin
 * @param targetIndex - Index of the target element
 * @param totalElements - Total number of elements
 * @param depthProgress - Current depth
 */
export const rippleParameters = (
  originIndex: number,
  targetIndex: number,
  _totalElements: number,
  depthProgress: number = 0
): {
  distance: number;
  delay: number;
  intensity: number;
  phase: number;
} => {
  const distance = Math.abs(targetIndex - originIndex);
  const delay = propagationDelay(distance, 100, depthProgress);
  const intensity = calculateFieldEffect('click', distance, depthProgress);
  const phase = distance * 0.1; // Slight phase offset per distance unit

  return { distance, delay, intensity, phase };
};

/**
 * Generate ripple cascade for all siblings
 */
export const generateRippleCascade = (
  originIndex: number,
  totalElements: number,
  depthProgress: number = 0
): Array<{
  index: number;
  distance: number;
  delay: number;
  intensity: number;
}> => {
  return Array.from({ length: totalElements }, (_, i) => {
    const params = rippleParameters(originIndex, i, totalElements, depthProgress);
    return {
      index: i,
      ...params,
    };
  });
};

// =============================================================================
// MAGNETIC FIELD (HOVER AWARENESS)
// =============================================================================

/**
 * Calculate magnetic lean toward disturbance point
 * Elements "lean" toward the user's attention
 *
 * @param elementX - Element X position
 * @param elementY - Element Y position
 * @param focusX - Focus/hover X position
 * @param focusY - Focus/hover Y position
 * @param maxDistance - Maximum distance for effect
 * @param maxLean - Maximum lean in pixels
 */
export const magneticLean = (
  elementX: number,
  elementY: number,
  focusX: number,
  focusY: number,
  maxDistance: number = 300,
  maxLean: number = 10
): { x: number; y: number; intensity: number } => {
  const dx = focusX - elementX;
  const dy = focusY - elementY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > maxDistance || distance === 0) {
    return { x: 0, y: 0, intensity: 0 };
  }

  const intensity = 1 - distance / maxDistance;
  const normalizedX = dx / distance;
  const normalizedY = dy / distance;

  return {
    x: normalizedX * maxLean * intensity,
    y: normalizedY * maxLean * intensity,
    intensity,
  };
};

// =============================================================================
// GRAVITY WELL (FOCUS)
// =============================================================================

/**
 * Calculate orientation toward gravity well (focused element)
 * Siblings orient toward the focused element
 *
 * @param siblingIndex - Index of the sibling
 * @param focusedIndex - Index of the focused element
 * @param totalSiblings - Total number of siblings
 */
export const gravityWellOrientation = (
  siblingIndex: number,
  focusedIndex: number,
  _totalSiblings: number
): {
  rotationDeg: number;
  scaleX: number;
  translateX: number;
} => {
  if (focusedIndex < 0 || siblingIndex === focusedIndex) {
    return { rotationDeg: 0, scaleX: 1, translateX: 0 };
  }

  const distance = siblingIndex - focusedIndex;
  const absDistance = Math.abs(distance);
  const direction = Math.sign(distance);

  // Rotation toward focus (max 5 degrees)
  const rotationDeg = -direction * Math.min(absDistance * 2, 5);

  // Slight scale reduction with distance
  const scaleX = 1 - absDistance * 0.02;

  // Lean toward focus
  const translateX = -direction * Math.min(absDistance * 3, 15);

  return { rotationDeg, scaleX, translateX };
};

// =============================================================================
// DEPTH ZONE EFFECTS
// =============================================================================

/**
 * Get visual parameters for current depth zone
 */
export const depthZoneEffects = (progress: number): {
  zone: DepthZone;
  viscosity: number;
  blur: number;
  contrast: number;
  saturation: number;
  ganzfeld: number;
} => {
  const zone = getDepthZone(progress);
  const viscosity = getViscosity(progress);
  const ganzfeld = ganzfeldIntensity(progress);

  // Visual effects increase with depth
  const blur = progress > 0.5 ? (progress - 0.5) * 20 : 0; // 0-10px blur at deep/abyss
  const contrast = 1 - progress * 0.15; // Slight contrast reduction
  const saturation = 1 - progress * 0.2; // Desaturation at depth

  return { zone, viscosity, blur, contrast, saturation, ganzfeld };
};

// =============================================================================
// UNIFIED FIELD STATE
// =============================================================================

/**
 * Complete field state for an element
 */
export interface FieldState {
  disturbance: DisturbanceType | null;
  disturbanceOrigin: number;
  depthProgress: number;
  focusedIndex: number;
}

/**
 * Calculate complete element state based on field
 */
export const calculateElementState = (
  elementIndex: number,
  fieldState: FieldState
): {
  effect: number;
  delay: number;
  orientation: { rotationDeg: number; scaleX: number; translateX: number };
  depthEffects: ReturnType<typeof depthZoneEffects>;
} => {
  const { disturbance, disturbanceOrigin, depthProgress, focusedIndex } = fieldState;

  // Calculate disturbance effect
  const distance = Math.abs(elementIndex - disturbanceOrigin);
  const effect = disturbance
    ? calculateFieldEffect(disturbance, distance, depthProgress)
    : 0;

  // Calculate propagation delay
  const delay = propagationDelayFrames(distance, 30, 100, depthProgress);

  // Calculate focus orientation
  const orientation = gravityWellOrientation(
    elementIndex,
    focusedIndex,
    10 // Assume 10 siblings for calculation
  );

  // Get depth effects
  const depthEffects = depthZoneEffects(depthProgress);

  return { effect, delay, orientation, depthEffects };
};
