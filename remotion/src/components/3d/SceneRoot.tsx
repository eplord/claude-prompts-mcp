/**
 * SceneRoot - Three.js Canvas Container for Remotion
 *
 * This component wraps @remotion/three's ThreeCanvas to provide
 * a consistent foundation for all 3D scenes in the video.
 *
 * Key features:
 * - Frame-synced rendering (no requestAnimationFrame)
 * - Default camera and lighting setup
 * - State-aware color temperature
 * - Performance-optimized defaults for video rendering
 */

import React, { type ReactNode, useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { useStateColors, useBreathing, DEFAULT_CAMERA_CONFIG } from './hooks';
import { void_tokens } from '../../design-system/tokens/colors';
import type { LiquescentState } from '../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export interface SceneRootProps {
  /** Children to render inside the Three.js canvas */
  children: ReactNode;
  /** Current liquescent state (affects lighting color) */
  state?: LiquescentState;
  /** Custom camera configuration */
  camera?: {
    fov?: number;
    position?: [number, number, number];
    near?: number;
    far?: number;
  };
  /** Enable orbit controls (for debugging, disabled in production) */
  enableOrbitControls?: boolean;
  /** Custom background color (defaults to void.deep) */
  backgroundColor?: string;
  /** Additional CSS styles for the canvas container */
  style?: React.CSSProperties;
}

// =============================================================================
// INNER SCENE COMPONENT
// =============================================================================

interface SceneLightingProps {
  state: LiquescentState;
}

/**
 * Default lighting setup for Liquescent scenes
 *
 * Three-point lighting with state-aware colors:
 * - Key light: Primary direction, drives shadows and god rays
 * - Fill light: Opposite side, prevents harsh shadows
 * - Rim light: Behind elements, creates bioluminescent edge glow
 */
const SceneLighting: React.FC<SceneLightingProps> = ({ state }) => {
  const colors = useStateColors(state);
  const { glowIntensity } = useBreathing();

  // Animate light intensity with breathing
  const keyIntensity = 1.0 * glowIntensity;
  const fillIntensity = 0.4 * glowIntensity;
  const rimIntensity = 0.6 * glowIntensity;

  return (
    <>
      {/* Ambient - very low to maintain dark void feel */}
      <ambientLight intensity={0.05} color={colors.background} />

      {/* Key light - primary direction (top-left-front) */}
      <pointLight
        position={[-5, 5, 8]}
        intensity={keyIntensity}
        color={colors.primary}
        distance={30}
        decay={2}
      />

      {/* Fill light - opposite side (right-bottom) */}
      <pointLight
        position={[4, -2, 5]}
        intensity={fillIntensity}
        color={colors.surface}
        distance={20}
        decay={2}
      />

      {/* Rim light - behind (creates edge glow) */}
      <pointLight
        position={[0, 0, -5]}
        intensity={rimIntensity}
        color={colors.glow}
        distance={15}
        decay={2}
      />
    </>
  );
};

// =============================================================================
// SCENE ROOT COMPONENT
// =============================================================================

/**
 * SceneRoot - Main Three.js canvas wrapper for Remotion
 *
 * Usage:
 * ```tsx
 * <SceneRoot state="awakening">
 *   <mesh>
 *     <boxGeometry />
 *     <meshStandardMaterial color="orange" />
 *   </mesh>
 * </SceneRoot>
 * ```
 */
export const SceneRoot: React.FC<SceneRootProps> = ({
  children,
  state = 'dormant',
  camera: cameraProps,
  backgroundColor,
  style,
}) => {
  const { width, height } = useVideoConfig();

  // Merge default camera config with props
  const cameraConfig = useMemo(
    () => ({
      fov: cameraProps?.fov ?? DEFAULT_CAMERA_CONFIG.fov,
      position: cameraProps?.position ?? DEFAULT_CAMERA_CONFIG.position,
      near: cameraProps?.near ?? DEFAULT_CAMERA_CONFIG.near,
      far: cameraProps?.far ?? DEFAULT_CAMERA_CONFIG.far,
    }),
    [cameraProps]
  );

  // Background color
  const bgColor = useMemo(
    () => new THREE.Color(backgroundColor ?? void_tokens.deep.hex),
    [backgroundColor]
  );

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        fov: cameraConfig.fov,
        position: cameraConfig.position,
        near: cameraConfig.near,
        far: cameraConfig.far,
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {/* Background */}
      <color attach="background" args={[bgColor.getHex()]} />

      {/* Fog for depth - color matches background */}
      <fog attach="fog" args={[bgColor.getHex(), 15, 50]} />

      {/* Default lighting */}
      <SceneLighting state={state} />

      {/* Scene content */}
      {children}
    </ThreeCanvas>
  );
};

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

/**
 * Simple ground plane for receiving shadows/caustics
 */
export const GroundPlane: React.FC<{
  size?: number;
  position?: [number, number, number];
  opacity?: number;
}> = ({ size = 100, position = [0, -5, 0], opacity = 0.3 }) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={void_tokens.surface.hex}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Depth reference grid (for debugging depth staging)
 */
export const DepthGrid: React.FC<{
  visible?: boolean;
}> = ({ visible = false }) => {
  if (!visible) return null;

  return (
    <group>
      {/* Foreground plane (z: 0) */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.1} />
      </mesh>

      {/* Mid-ground plane (z: -5) */}
      <mesh position={[0, 0, -5]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.1} />
      </mesh>

      {/* Background plane (z: -15) */}
      <mesh position={[0, 0, -15]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#0000ff" wireframe transparent opacity={0.1} />
      </mesh>

      {/* Deep plane (z: -30) */}
      <mesh position={[0, 0, -30]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#ff00ff" wireframe transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

export default SceneRoot;
