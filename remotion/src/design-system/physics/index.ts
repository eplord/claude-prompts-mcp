/**
 * Liquescent Design System - Physics Barrel Export
 */

// Perlin Noise
export {
  perlin2D,
  perlin3D,
  fractalNoise2D,
  fractalNoise3D,
  domainWarp2D,
  organicDrift,
  organicDrift3D,
  organicBreath,
  organicTremble,
  swarmMotion,
  createSeededNoise,
} from './perlin-noise';

// Unified Field
export {
  disturbanceAmplitudes,
  decayFunction,
  exponentialDecay,
  linearDecay,
  depthModifier,
  ganzfeldIntensity,
  calculateFieldEffect,
  calculateFieldEffectCustom,
  propagationDelay,
  propagationDelayFrames,
  rippleParameters,
  generateRippleCascade,
  magneticLean,
  gravityWellOrientation,
  depthZoneEffects,
  calculateElementState,
} from './unified-field';
export type { FieldState } from './unified-field';
