/**
 * BackgroundScene - Main 3D Background Composition
 *
 * Combines the LiquescentMaterial background plane with layered
 * particle fields to create an immersive underwater atmosphere.
 *
 * Features:
 * - Domain-warped noise background
 * - Multi-layer particle system with parallax
 * - Optional caustics overlay
 * - State-aware color transitions
 * - Frame-deterministic rendering
 */

import React from 'react';
import * as THREE from 'three';
import { LiquescentBackgroundMaterial, LiquescentCausticsMaterial } from '../materials';
import { LayeredParticles } from '../effects';
import { useBreathing } from '../hooks';
import type { LiquescentState } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export interface BackgroundSceneProps {
  /** Current liquescent state */
  state?: LiquescentState;
  /** Depth progress (0-1) affects viscosity and effects */
  depthProgress?: number;
  /** Enable particle field */
  enableParticles?: boolean;
  /** Particle intensity (0-1) */
  particleIntensity?: number;
  /** Enable caustics overlay */
  enableCaustics?: boolean;
  /** Caustics intensity (0-1) */
  causticsIntensity?: number;
  /** Background plane size */
  planeSize?: number;
}

// =============================================================================
// BACKGROUND PLANE
// =============================================================================

interface BackgroundPlaneProps {
  state: LiquescentState;
  depthProgress: number;
  size: number;
}

/**
 * Full-screen background plane with domain-warped noise
 */
const BackgroundPlane: React.FC<BackgroundPlaneProps> = ({ state, depthProgress, size }) => {
  return (
    <mesh position={[0, 0, -30]} rotation={[0, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <LiquescentBackgroundMaterial state={state} depthProgress={depthProgress} />
    </mesh>
  );
};

// =============================================================================
// CAUSTICS OVERLAY
// =============================================================================

interface CausticsOverlayProps {
  state: LiquescentState;
  depthProgress: number;
  intensity: number;
  size: number;
}

/**
 * Caustics plane that overlays the background
 * Only visible at deeper depth levels
 */
const CausticsOverlay: React.FC<CausticsOverlayProps> = ({
  state,
  depthProgress,
  intensity,
  size,
}) => {
  // Caustics fade in as depth increases
  const causticsOpacity = Math.max(0, (depthProgress - 0.15) * 2) * intensity;

  if (causticsOpacity <= 0) return null;

  return (
    <mesh position={[0, 0, -25]} rotation={[0, 0, 0]}>
      <planeGeometry args={[size * 0.8, size * 0.8]} />
      <LiquescentCausticsMaterial state={state} depthProgress={depthProgress} />
    </mesh>
  );
};

// =============================================================================
// AMBIENT GLOW SPHERES
// =============================================================================

interface AmbientGlowProps {
  state: LiquescentState;
  count?: number;
  spread?: number;
  seed?: number;
}

/**
 * Subtle glowing spheres for ambient light points
 */
const AmbientGlow: React.FC<AmbientGlowProps> = ({
  state,
  count = 5,
  spread = 12,
  seed = 99999,
}) => {
  const { glowIntensity } = useBreathing(seed);

  // Generate positions deterministically
  const positions = React.useMemo(() => {
    const pos: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + seed * 0.01;
      const radius = spread * (0.4 + Math.sin(seed + i * 1.7) * 0.3);
      const z = -10 - Math.cos(seed + i * 2.3) * 5;
      pos.push([Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, z]);
    }
    return pos;
  }, [count, spread, seed]);

  // State-based emissive color
  const emissiveColor =
    state === 'liquescent'
      ? '#a8e6cf'
      : state === 'awakening'
        ? '#f5c469'
        : '#69d2e7';

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.3 + i * 0.05, 16, 16]} />
          <meshBasicMaterial
            color={emissiveColor}
            transparent
            opacity={0.15 * glowIntensity}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

// =============================================================================
// BACKGROUND SCENE
// =============================================================================

/**
 * BackgroundScene - Complete 3D background composition
 *
 * Wrap with SceneRoot and pass state/depth props.
 * Includes background plane, caustics, ambient glow, and particles.
 */
export const BackgroundScene: React.FC<BackgroundSceneProps> = ({
  state = 'dormant',
  depthProgress = 0,
  enableParticles = true,
  particleIntensity = 1,
  enableCaustics = true,
  causticsIntensity = 0.5,
  planeSize = 50,
}) => {
  return (
    <group>
      {/* Base background plane - furthest back */}
      <BackgroundPlane state={state} depthProgress={depthProgress} size={planeSize} />

      {/* Caustics overlay - slightly in front of background */}
      {enableCaustics && (
        <CausticsOverlay
          state={state}
          depthProgress={depthProgress}
          intensity={causticsIntensity}
          size={planeSize}
        />
      )}

      {/* Ambient glow points */}
      <AmbientGlow state={state} />

      {/* Layered particle system */}
      {enableParticles && (
        <LayeredParticles
          state={state}
          depthProgress={depthProgress}
          intensity={particleIntensity}
        />
      )}
    </group>
  );
};

// =============================================================================
// MINIMAL BACKGROUND (for performance-critical scenes)
// =============================================================================

export interface MinimalBackgroundProps {
  state?: LiquescentState;
  depthProgress?: number;
}

/**
 * MinimalBackground - Lightweight version for complex foreground scenes
 *
 * Only includes the background plane, no particles or caustics.
 * Use when foreground elements are computationally expensive.
 */
export const MinimalBackground: React.FC<MinimalBackgroundProps> = ({
  state = 'dormant',
  depthProgress = 0,
}) => {
  return (
    <group>
      <BackgroundPlane state={state} depthProgress={depthProgress} size={50} />
    </group>
  );
};

export default BackgroundScene;
