/**
 * ThreeTest - Three.js Integration Test Composition
 *
 * Verifies that the 3D background system renders correctly with Remotion.
 * Tests: SceneRoot, BackgroundScene, particles, state transitions.
 *
 * Duration: 15 seconds (450 frames @ 30fps)
 * Sections:
 * - 0:00-0:05: Dormant state (cyan)
 * - 0:05-0:10: Awakening state (amber)
 * - 0:10-0:15: Liquescent state (chartreuse)
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { SceneRoot, BackgroundScene, LiquescentEffects } from '../components/3d';
import type { LiquescentState } from '../design-system/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATE_TRANSITION_FRAMES = 150; // 5 seconds per state

// =============================================================================
// STATE OVERLAY (2D UI)
// =============================================================================

interface StateOverlayProps {
  state: LiquescentState;
  depthProgress: number;
  frame: number;
}

const StateOverlay: React.FC<StateOverlayProps> = ({ state, depthProgress, frame }) => {
  const { fps } = useVideoConfig();

  // Fade in text
  const opacity = spring({
    frame: frame % STATE_TRANSITION_FRAMES,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const stateColors: Record<LiquescentState, string> = {
    dormant: '#69d2e7',
    awakening: '#f5c469',
    liquescent: '#a8e6cf',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 60,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 24,
        color: stateColors[state],
        opacity,
        textShadow: `0 0 20px ${stateColors[state]}`,
      }}
    >
      <div style={{ fontSize: 16, opacity: 0.6, marginBottom: 8 }}>THREE.JS TEST</div>
      <div>
        State: <strong>{state.toUpperCase()}</strong>
      </div>
      <div style={{ fontSize: 18, opacity: 0.8, marginTop: 4 }}>
        Depth: {(depthProgress * 100).toFixed(0)}%
      </div>
    </div>
  );
};

// =============================================================================
// CENTER CONTENT (3D test)
// =============================================================================

interface CenterContentProps {
  state: LiquescentState;
  frame: number;
}

const CenterContent: React.FC<CenterContentProps> = ({ state, frame }) => {
  const { fps } = useVideoConfig();

  // Rotating cube to verify 3D is working
  const rotation = (frame / fps) * 0.5;

  const stateColors: Record<LiquescentState, string> = {
    dormant: '#69d2e7',
    awakening: '#f5c469',
    liquescent: '#a8e6cf',
  };

  return (
    <group>
      {/* Test cube */}
      <mesh rotation={[rotation, rotation * 0.7, 0]} position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={stateColors[state]}
          emissive={stateColors[state]}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Orbiting sphere */}
      <mesh
        position={[Math.cos(rotation * 2) * 3, Math.sin(rotation * 2) * 3, 0]}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={stateColors[state]}
          emissive={stateColors[state]}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

// =============================================================================
// MAIN COMPOSITION
// =============================================================================

export const ThreeTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate current state based on frame
  const stateIndex = Math.floor(frame / STATE_TRANSITION_FRAMES);
  const states: LiquescentState[] = ['dormant', 'awakening', 'liquescent'];
  const currentState = states[Math.min(stateIndex, states.length - 1)];

  // Depth progress increases over time
  const depthProgress = interpolate(
    frame,
    [0, durationInFrames],
    [0, 0.7],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0d12' }}>
      {/* 3D Scene */}
      <SceneRoot state={currentState}>
        {/* Background with particles and caustics */}
        <BackgroundScene
          state={currentState}
          depthProgress={depthProgress}
          enableParticles
          particleIntensity={1}
          enableCaustics
          causticsIntensity={0.6}
        />

        {/* Test content */}
        <CenterContent state={currentState} frame={frame} />

        {/* Postprocessing effects */}
        <LiquescentEffects
          state={currentState}
          depthProgress={depthProgress}
          enableBloom
          enableVignette
          enableChromaticAberration
          enableNoise={depthProgress > 0.5}
          noiseIntensity={0.02}
          enableToneMapping
        />
      </SceneRoot>

      {/* 2D Overlay */}
      <StateOverlay
        state={currentState}
        depthProgress={depthProgress}
        frame={frame}
      />

      {/* Frame counter (dev) */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          fontFamily: 'monospace',
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.4)',
        }}
      >
        {frame}/{durationInFrames}
      </div>
    </AbsoluteFill>
  );
};

export default ThreeTest;
