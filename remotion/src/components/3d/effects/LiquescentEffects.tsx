/**
 * LiquescentEffects - State-Aware Postprocessing for Remotion
 *
 * Provides cinematic postprocessing effects that respond to
 * Liquescent state and depth progress.
 *
 * Effects pipeline:
 * 1. Bloom - Bioluminescent glow (state-responsive threshold)
 * 2. Vignette - Edge darkening (depth-responsive)
 * 3. ChromaticAberration - Subtle color fringing (depth-gated)
 * 4. ToneMapping - ACES filmic color grading
 *
 * CRITICAL: All effects use frame-based parameters, not animated values.
 */

import React, { useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  ToneMapping,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useFrameSync, useBreathing, useDepthModifiers } from '../hooks';
import type { LiquescentState } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LiquescentEffectsProps {
  /** Current liquescent state */
  state?: LiquescentState;
  /** Depth progress (0-1) */
  depthProgress?: number;
  /** Enable bloom effect */
  enableBloom?: boolean;
  /** Bloom intensity override */
  bloomIntensity?: number;
  /** Enable vignette effect */
  enableVignette?: boolean;
  /** Vignette intensity override */
  vignetteIntensity?: number;
  /** Enable chromatic aberration (depth-gated by default) */
  enableChromaticAberration?: boolean;
  /** Enable film grain noise */
  enableNoise?: boolean;
  /** Noise intensity (0-1) */
  noiseIntensity?: number;
  /** Enable tone mapping */
  enableToneMapping?: boolean;
}

// =============================================================================
// STATE-BASED CONFIGURATIONS
// =============================================================================

interface EffectConfig {
  bloomThreshold: number;
  bloomIntensity: number;
  bloomRadius: number;
  vignetteOffset: number;
  vignetteDarkness: number;
}

const STATE_CONFIGS: Record<LiquescentState, EffectConfig> = {
  dormant: {
    bloomThreshold: 0.9,
    bloomIntensity: 0.3,
    bloomRadius: 0.6,
    vignetteOffset: 0.3,
    vignetteDarkness: 0.5,
  },
  awakening: {
    bloomThreshold: 0.7,
    bloomIntensity: 0.5,
    bloomRadius: 0.7,
    vignetteOffset: 0.25,
    vignetteDarkness: 0.45,
  },
  liquescent: {
    bloomThreshold: 0.5,
    bloomIntensity: 0.8,
    bloomRadius: 0.85,
    vignetteOffset: 0.2,
    vignetteDarkness: 0.35,
  },
};

// =============================================================================
// LIQUESCENT EFFECTS COMPONENT
// =============================================================================

/**
 * LiquescentEffects - Postprocessing pipeline for Liquescent scenes
 *
 * Must be placed inside a Three.js canvas (SceneRoot children).
 * Effects are frame-deterministic for Remotion compatibility.
 */
export const LiquescentEffects: React.FC<LiquescentEffectsProps> = ({
  state = 'dormant',
  depthProgress = 0,
  enableBloom = true,
  bloomIntensity: bloomIntensityOverride,
  enableVignette = true,
  vignetteIntensity: vignetteIntensityOverride,
  enableChromaticAberration = true,
  enableNoise = false,
  noiseIntensity = 0.03,
  enableToneMapping = true,
}) => {
  const { glowIntensity } = useBreathing();
  const { ganzfeldOpacity } = useDepthModifiers(depthProgress);
  useFrameSync(); // Ensure Remotion context

  // Get state-based configuration
  const config = STATE_CONFIGS[state];

  // Calculate final bloom values with breathing modulation
  const finalBloomIntensity = useMemo(() => {
    const base = bloomIntensityOverride ?? config.bloomIntensity;
    // Subtle breathing affects bloom intensity
    return base * (0.9 + glowIntensity * 0.1);
  }, [bloomIntensityOverride, config.bloomIntensity, glowIntensity]);

  // Calculate vignette values with depth response
  const vignetteValues = useMemo(() => {
    const baseOffset = vignetteIntensityOverride ?? config.vignetteOffset;
    const baseDarkness = config.vignetteDarkness;

    // Vignette intensifies with depth (more focus on center)
    const depthMultiplier = 1 + depthProgress * 0.5;

    return {
      offset: baseOffset * depthMultiplier,
      darkness: baseDarkness * depthMultiplier + ganzfeldOpacity * 0.3,
    };
  }, [vignetteIntensityOverride, config, depthProgress, ganzfeldOpacity]);

  // Chromatic aberration offset (only at depth)
  const chromaticOffset = useMemo(() => {
    if (depthProgress < 0.3) return new THREE.Vector2(0, 0);
    const intensity = (depthProgress - 0.3) * 0.003;
    return new THREE.Vector2(intensity, intensity);
  }, [depthProgress]);

  // Build effects array dynamically to satisfy strict EffectComposer typing
  const effects: React.ReactElement[] = [];

  if (enableBloom) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={finalBloomIntensity}
        luminanceThreshold={config.bloomThreshold}
        luminanceSmoothing={0.9}
        radius={config.bloomRadius}
        mipmapBlur
      />
    );
  }

  if (enableVignette) {
    effects.push(
      <Vignette
        key="vignette"
        offset={vignetteValues.offset}
        darkness={vignetteValues.darkness}
        blendFunction={BlendFunction.NORMAL}
      />
    );
  }

  if (enableChromaticAberration && depthProgress > 0.3) {
    effects.push(
      <ChromaticAberration
        key="chromatic"
        offset={chromaticOffset}
        radialModulation={false}
        modulationOffset={0}
      />
    );
  }

  if (enableNoise) {
    effects.push(
      <Noise
        key="noise"
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={noiseIntensity}
      />
    );
  }

  if (enableToneMapping) {
    effects.push(<ToneMapping key="tonemapping" mode={ToneMappingMode.ACES_FILMIC} />);
  }

  // EffectComposer requires at least one effect
  if (effects.length === 0) {
    return null;
  }

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
};

// =============================================================================
// PRESET EFFECT CONFIGURATIONS
// =============================================================================

/**
 * CinematicEffects - Full postprocessing for hero shots
 * High bloom, deep vignette, chromatic aberration enabled
 */
export const CinematicEffects: React.FC<{
  state?: LiquescentState;
  depthProgress?: number;
}> = ({ state = 'awakening', depthProgress = 0.4 }) => (
  <LiquescentEffects
    state={state}
    depthProgress={depthProgress}
    enableBloom
    bloomIntensity={0.8}
    enableVignette
    vignetteIntensity={0.35}
    enableChromaticAberration
    enableNoise
    noiseIntensity={0.02}
    enableToneMapping
  />
);

/**
 * SubtleEffects - Minimal postprocessing for UI-heavy scenes
 * Light bloom only, no vignette or chromatic aberration
 */
export const SubtleEffects: React.FC<{
  state?: LiquescentState;
}> = ({ state = 'dormant' }) => (
  <LiquescentEffects
    state={state}
    depthProgress={0}
    enableBloom
    bloomIntensity={0.3}
    enableVignette={false}
    enableChromaticAberration={false}
    enableNoise={false}
    enableToneMapping
  />
);

/**
 * AbyssEffects - Maximum depth atmosphere
 * Heavy vignette, strong chromatic aberration, film grain
 */
export const AbyssEffects: React.FC<{
  state?: LiquescentState;
}> = ({ state = 'liquescent' }) => (
  <LiquescentEffects
    state={state}
    depthProgress={0.85}
    enableBloom
    bloomIntensity={1.0}
    enableVignette
    vignetteIntensity={0.5}
    enableChromaticAberration
    enableNoise
    noiseIntensity={0.05}
    enableToneMapping
  />
);

export default LiquescentEffects;
