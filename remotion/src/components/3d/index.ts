/**
 * Three.js Components for Remotion
 *
 * Architecture:
 * ```
 * 3d/
 * ├── SceneRoot.tsx      - Canvas wrapper (entry point)
 * ├── hooks.ts           - Frame sync, state colors, breathing
 * ├── scenes/            - Complete scene compositions
 * ├── effects/           - Postprocessing, particles
 * ├── camera/            - Camera rigs and animations
 * ├── transitions/       - Scene transition effects
 * └── materials/         - Custom shader materials
 * ```
 *
 * Usage:
 * ```tsx
 * import { SceneRoot, useFrameSync, useStateColors } from '@/components/3d';
 *
 * const MyScene = () => (
 *   <SceneRoot state="awakening">
 *     <MyMesh />
 *   </SceneRoot>
 * );
 * ```
 */

// Core canvas wrapper
export { SceneRoot, GroundPlane, DepthGrid, type SceneRootProps } from './SceneRoot';

// Frame synchronization and animation hooks
export {
  // Core frame sync
  useFrameSync,
  useShaderUniforms,

  // Breathing animation
  useBreathing,

  // State-based styling
  useStateColors,
  useSpringConfig,
  useSpringValue,

  // Depth and parallax
  useDepthModifiers,

  // Camera helpers
  DEFAULT_CAMERA_CONFIG,
  useCameraPosition,

  // Particle system helpers
  useParticlePositions,
  useAnimatedParticles,
} from './hooks';

// Custom shader materials
export {
  LiquescentMaterial,
  LiquescentBackgroundMaterial,
  LiquescentCausticsMaterial,
  type LiquescentMaterialProps,
} from './materials';

// Effects (particles, postprocessing)
export {
  // Particles
  ParticleField,
  LayeredParticles,
  type ParticleFieldProps,
  type LayeredParticlesProps,
  // Postprocessing
  LiquescentEffects,
  CinematicEffects,
  SubtleEffects,
  AbyssEffects,
  type LiquescentEffectsProps,
} from './effects';

// Complete scene compositions
export {
  BackgroundScene,
  MinimalBackground,
  type BackgroundSceneProps,
  type MinimalBackgroundProps,
} from './scenes';

// Camera rigs and animations
export {
  CinematicCamera,
  DocumentaryCamera,
  HeroCamera,
  RevealCamera,
  CameraShake,
  type CinematicCameraProps,
  type CameraKeyframe,
  type CameraMovement,
} from './camera';

// Scene transitions
export {
  // Liquid wipe
  LiquidWipe,
  SectionTransition,
  RevealTransition,
  ExitTransition,
  type LiquidWipeProps,
  type WipeDirection,
  // Ripple impact
  RippleImpact,
  CommandRipple,
  SuccessRipple,
  ErrorRipple,
  RippleSequence,
  type RippleImpactProps,
} from './transitions';

// Re-export Three.js for convenience
export * as THREE from 'three';
