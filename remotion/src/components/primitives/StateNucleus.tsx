/**
 * State Nucleus
 *
 * Shape-morphing indicator that transforms between states.
 * Pentagon (dormant) → Octagon (awakening) → Circle (liquescent)
 * Uses CSS clip-path for smooth morphing.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { LiquescentState, SpringPreset } from '../../design-system/types';
import { STATE_SHAPES } from '../../design-system/types';
import { stateColors, createGlow } from '../../design-system/tokens/colors';
import { springs } from '../../design-system/tokens';
import { liquidBreath } from '../../utils/liquescent-animations';

export interface StateNucleusProps {
  state: LiquescentState;
  previousState?: LiquescentState;
  transitionFrame?: number;
  size?: number;
  springPreset?: SpringPreset;
  glowIntensity?: number;
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Interpolate between two clip-path polygon definitions
 */
const interpolateClipPath = (from: string, to: string, progress: number): string => {
  // Extract points from clip-path strings
  const extractPoints = (path: string): number[][] => {
    const match = path.match(/polygon\(([^)]+)\)|circle\(([^)]+)\)/);
    if (!match) return [];

    if (path.startsWith('circle')) {
      // Circle: generate 8 points around the circle
      const points: number[][] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        points.push([50 + 50 * Math.cos(angle), 50 + 50 * Math.sin(angle)]);
      }
      return points;
    }

    const pointStr = match[1];
    return pointStr.split(',').map(p => {
      const [x, y] = p.trim().split(/\s+/).map(v => parseFloat(v));
      return [x, y];
    });
  };

  const fromPoints = extractPoints(from);
  const toPoints = extractPoints(to);

  // Handle different point counts by interpolating to closest approximation
  const maxPoints = Math.max(fromPoints.length, toPoints.length);

  const interpolatedPoints: number[][] = [];
  for (let i = 0; i < maxPoints; i++) {
    const fromIdx = Math.floor((i / maxPoints) * fromPoints.length);
    const toIdx = Math.floor((i / maxPoints) * toPoints.length);
    const fromPoint = fromPoints[fromIdx] || [50, 50];
    const toPoint = toPoints[toIdx] || [50, 50];

    interpolatedPoints.push([
      fromPoint[0] + (toPoint[0] - fromPoint[0]) * progress,
      fromPoint[1] + (toPoint[1] - fromPoint[1]) * progress,
    ]);
  }

  return `polygon(${interpolatedPoints.map(p => `${p[0]}% ${p[1]}%`).join(', ')})`;
};

export const StateNucleus: React.FC<StateNucleusProps> = ({
  state,
  previousState,
  transitionFrame = 0,
  size = 60,
  springPreset = 'membrane',
  glowIntensity = 0.8,
  seed = 0,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Get colors and shapes
  const currentColor = stateColors[state];
  const fromShape = previousState ? STATE_SHAPES[previousState] : STATE_SHAPES[state];
  const toShape = STATE_SHAPES[state];

  // Calculate transition progress
  const localFrame = frame - transitionFrame;
  const transitionProgress = previousState && localFrame > 0
    ? spring({
        frame: localFrame,
        fps,
        config: springs[springPreset],
        durationInFrames: 18,
      })
    : previousState ? 0 : 1;

  // Interpolate clip-path
  const currentClipPath = previousState
    ? interpolateClipPath(fromShape, toShape, transitionProgress)
    : toShape;

  // Breathing animation
  const breath = liquidBreath(frame, fps, { seed });
  const pulseScale = interpolate(breath, [0.7, 1], [0.97, 1.03]);

  // Glow effect
  const glowAmount = glowIntensity * (0.5 + transitionProgress * 0.5);
  const glow = createGlow(currentColor, glowAmount * breath);

  // Inner pulse for liquescent state
  const innerPulseOpacity = state === 'liquescent'
    ? interpolate(breath, [0.7, 1], [0.3, 0.6])
    : state === 'awakening'
      ? interpolate(breath, [0.7, 1], [0.2, 0.4])
      : interpolate(breath, [0.7, 1], [0.1, 0.2]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    transform: `scale(${pulseScale})`,
    ...style,
  };

  const nucleusStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: currentColor.hex,
    clipPath: currentClipPath,
    boxShadow: glow,
    // NOTE: No CSS transition - Remotion requires frame-based animation
  };

  const innerPulseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: '20%',
    backgroundColor: '#FFFFFF',
    opacity: innerPulseOpacity,
    clipPath: currentClipPath,
    filter: 'blur(4px)',
  };

  return (
    <div className={className} style={containerStyle}>
      <div style={innerPulseStyle} />
      <div style={nucleusStyle} />
    </div>
  );
};

/**
 * Animated state transition - automatically animates between states
 */
export const AnimatedStateNucleus: React.FC<{
  states: Array<{ state: LiquescentState; frame: number }>;
  size?: number;
  glowIntensity?: number;
}> = ({ states, size = 60, glowIntensity = 0.8 }) => {
  const frame = useCurrentFrame();

  // Find current and previous state based on frame
  let currentState: LiquescentState = 'dormant';
  let previousState: LiquescentState | undefined;
  let transitionFrame = 0;

  for (let i = states.length - 1; i >= 0; i--) {
    if (frame >= states[i].frame) {
      currentState = states[i].state;
      transitionFrame = states[i].frame;
      if (i > 0) {
        previousState = states[i - 1].state;
      }
      break;
    }
  }

  return (
    <StateNucleus
      state={currentState}
      previousState={previousState}
      transitionFrame={transitionFrame}
      size={size}
      glowIntensity={glowIntensity}
    />
  );
};

export default StateNucleus;
