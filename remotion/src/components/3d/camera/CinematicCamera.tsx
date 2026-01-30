/**
 * CinematicCamera - Animated Camera Rig for Remotion
 *
 * Film-quality camera movements driven by Remotion's frame system.
 * All motion uses spring physics from the Liquescent design system.
 *
 * Camera Movements:
 * - Push In/Pull Out: Emphasize key moments (command execution, success)
 * - Rack Focus: Shift attention between depth layers
 * - Orbit: Reveal 3D depth during transitions
 * - Drift: Subtle organic movement for living feel
 *
 * CRITICAL: Never use Three.js Clock - all timing from useCurrentFrame()
 */

import React, { useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import * as THREE from 'three';
import { springs } from '../../../design-system/tokens/motion';
import { useBreathing } from '../hooks';
import type { SpringPreset } from '../../../design-system/types';

// =============================================================================
// TYPES
// =============================================================================

export type CameraMovement = 'push-in' | 'pull-out' | 'orbit' | 'drift' | 'hold';

export interface CameraKeyframe {
  frame: number;
  position?: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
  movement?: CameraMovement;
}

export interface CinematicCameraProps {
  /** Starting position */
  position?: [number, number, number];
  /** Point to look at */
  lookAt?: [number, number, number];
  /** Field of view */
  fov?: number;
  /** Camera keyframes for animation */
  keyframes?: CameraKeyframe[];
  /** Spring preset for movement */
  springPreset?: SpringPreset;
  /** Enable subtle breathing drift */
  enableBreathing?: boolean;
  /** Breathing intensity (0-1) */
  breathingIntensity?: number;
  /** Push-in/pull-out amount (negative = push in) */
  pushAmount?: number;
  /** Push animation start frame */
  pushStartFrame?: number;
  /** Push animation duration in frames */
  pushDuration?: number;
  /** Orbit progress (0-1 for full rotation) */
  orbitProgress?: number;
  /** Orbit radius */
  orbitRadius?: number;
  /** Orbit height offset */
  orbitHeight?: number;
}

// =============================================================================
// CAMERA CONTROLLER COMPONENT
// =============================================================================

/**
 * CinematicCamera - Main camera component
 *
 * Usage:
 * ```tsx
 * <SceneRoot>
 *   <CinematicCamera
 *     position={[0, 0, 10]}
 *     pushAmount={-3}
 *     pushStartFrame={30}
 *     pushDuration={45}
 *     enableBreathing
 *   />
 *   <YourScene />
 * </SceneRoot>
 * ```
 */
export const CinematicCamera: React.FC<CinematicCameraProps> = ({
  position = [0, 0, 10],
  lookAt = [0, 0, 0],
  fov: baseFov = 45,
  keyframes = [],
  springPreset = 'viscous',
  enableBreathing = true,
  breathingIntensity = 0.3,
  pushAmount = 0,
  pushStartFrame = 0,
  pushDuration = 30,
  orbitProgress = 0,
  orbitRadius = 10,
  orbitHeight = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(...lookAt));

  // Breathing for organic drift
  const { scale: breathScale } = useBreathing();
  const breathOffset = enableBreathing ? (breathScale - 1) * breathingIntensity * 2 : 0;

  // Spring config
  const springConfig = springs[springPreset];

  // Calculate push-in/pull-out progress
  const pushProgress = useMemo(() => {
    if (pushAmount === 0) return 0;

    const localFrame = frame - pushStartFrame;
    if (localFrame < 0) return 0;

    return spring({
      frame: localFrame,
      fps,
      config: springConfig,
      durationInFrames: pushDuration,
    });
  }, [frame, pushStartFrame, pushAmount, pushDuration, fps, springConfig]);

  // Calculate orbit position
  const orbitPosition = useMemo(() => {
    if (orbitProgress === 0) return null;

    const angle = orbitProgress * Math.PI * 2;
    return {
      x: Math.sin(angle) * orbitRadius,
      y: orbitHeight,
      z: Math.cos(angle) * orbitRadius,
    };
  }, [orbitProgress, orbitRadius, orbitHeight]);

  // Interpolate between keyframes
  const keyframePosition = useMemo(() => {
    if (keyframes.length === 0) return null;

    // Find surrounding keyframes
    let prevKeyframe: CameraKeyframe | null = null;
    let nextKeyframe: CameraKeyframe | null = null;

    for (const kf of keyframes) {
      if (kf.frame <= frame) {
        prevKeyframe = kf;
      }
      if (kf.frame > frame && !nextKeyframe) {
        nextKeyframe = kf;
        break;
      }
    }

    if (!prevKeyframe) return null;
    if (!nextKeyframe) return prevKeyframe.position || null;

    // Interpolate between keyframes
    const progress = spring({
      frame: frame - prevKeyframe.frame,
      fps,
      config: springConfig,
      durationInFrames: nextKeyframe.frame - prevKeyframe.frame,
    });

    const prevPos = prevKeyframe.position || position;
    const nextPos = nextKeyframe.position || position;

    return [
      interpolate(progress, [0, 1], [prevPos[0], nextPos[0]]),
      interpolate(progress, [0, 1], [prevPos[1], nextPos[1]]),
      interpolate(progress, [0, 1], [prevPos[2], nextPos[2]]),
    ] as [number, number, number];
  }, [keyframes, frame, fps, springConfig, position]);

  // Calculate final camera position
  const finalPosition = useMemo(() => {
    let pos = keyframePosition || [...position];

    // Apply orbit
    if (orbitPosition) {
      pos = [orbitPosition.x, orbitPosition.y, orbitPosition.z];
    }

    // Apply push-in/pull-out
    pos[2] += pushAmount * pushProgress;

    // Apply breathing drift
    pos[0] += breathOffset * 0.5;
    pos[1] += breathOffset * 0.3;
    pos[2] += breathOffset * 0.2;

    return pos as [number, number, number];
  }, [position, keyframePosition, orbitPosition, pushAmount, pushProgress, breathOffset]);

  // Update camera every frame (Remotion drives this)
  useFrame(() => {
    camera.position.set(...finalPosition);
    camera.lookAt(targetRef.current);

    // Update FOV if needed
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }
  });

  return null; // Camera controller doesn't render anything
};

// =============================================================================
// CAMERA PRESETS
// =============================================================================

/**
 * Documentary-style camera with subtle movement
 */
export const DocumentaryCamera: React.FC<{
  focusPoint?: [number, number, number];
  distance?: number;
}> = ({ focusPoint = [0, 0, 0], distance = 10 }) => {
  return (
    <CinematicCamera
      position={[0, 0, distance]}
      lookAt={focusPoint}
      enableBreathing
      breathingIntensity={0.2}
      springPreset="viscous"
    />
  );
};

/**
 * Hero shot camera with dramatic push-in
 */
export const HeroCamera: React.FC<{
  startFrame?: number;
  pushAmount?: number;
}> = ({ startFrame = 0, pushAmount = -3 }) => {
  return (
    <CinematicCamera
      position={[0, 0, 12]}
      lookAt={[0, 0, 0]}
      pushAmount={pushAmount}
      pushStartFrame={startFrame}
      pushDuration={45}
      enableBreathing
      breathingIntensity={0.15}
      springPreset="membrane"
    />
  );
};

/**
 * Reveal camera with orbit motion
 */
export const RevealCamera: React.FC<{
  startFrame?: number;
  duration?: number;
  radius?: number;
}> = ({ startFrame = 0, duration = 90, radius = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const orbitProgress = useMemo(() => {
    const localFrame = frame - startFrame;
    if (localFrame < 0) return 0;

    return spring({
      frame: localFrame,
      fps,
      config: springs.viscous,
      durationInFrames: duration,
    }) * 0.5; // Half orbit (180 degrees)
  }, [frame, startFrame, duration, fps]);

  return (
    <CinematicCamera
      position={[0, 0, radius]}
      lookAt={[0, 0, 0]}
      orbitProgress={orbitProgress}
      orbitRadius={radius}
      enableBreathing
      breathingIntensity={0.1}
    />
  );
};

// =============================================================================
// CAMERA SHAKE EFFECT
// =============================================================================

/**
 * Add camera shake for impact moments
 */
export const CameraShake: React.FC<{
  startFrame: number;
  duration?: number;
  intensity?: number;
  decay?: boolean;
}> = ({ startFrame, duration = 15, intensity = 0.5, decay = true }) => {
  const frame = useCurrentFrame();
  const { camera } = useThree();

  const shakeOffset = useMemo(() => {
    const localFrame = frame - startFrame;
    if (localFrame < 0 || localFrame > duration) {
      return { x: 0, y: 0 };
    }

    // Decay multiplier
    const decayMult = decay ? 1 - localFrame / duration : 1;

    // Pseudo-random shake using sin
    const shake = intensity * decayMult;
    const x = Math.sin(localFrame * 17.3) * shake;
    const y = Math.cos(localFrame * 23.7) * shake * 0.7;

    return { x, y };
  }, [frame, startFrame, duration, intensity, decay]);

  useFrame(() => {
    camera.position.x += shakeOffset.x;
    camera.position.y += shakeOffset.y;
  });

  return null;
};

export default CinematicCamera;
