/**
 * Ripple Cascade
 *
 * Concentric rings that propagate outward from an impact point.
 * Used for visualizing disturbances, clicks, and state changes.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, Sequence } from 'remotion';
import type { LiquescentState } from '../../design-system/types';
import { stateColors } from '../../design-system/tokens/colors';
import { liquidRipple } from '../../utils/liquescent-animations';
import { durations, durationToFrames } from '../../design-system/tokens';

export interface RippleCascadeProps {
  startFrame?: number;
  ringCount?: number;
  maxRadius?: number;
  ringDelay?: number;
  durationMs?: number;
  state?: LiquescentState;
  color?: string;
  strokeWidth?: number;
  centerX?: number;
  centerY?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const RippleCascade: React.FC<RippleCascadeProps> = ({
  startFrame = 0,
  ringCount = 3,
  maxRadius = 200,
  ringDelay = 100,
  durationMs = durations.slow,
  state = 'dormant',
  color,
  strokeWidth: baseStrokeWidth = 3,
  centerX = 0,
  centerY = 0,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stateColor = color || stateColors[state].hex;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: centerX,
    top: centerY,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      <svg
        width={maxRadius * 2 + 20}
        height={maxRadius * 2 + 20}
        viewBox={`0 0 ${maxRadius * 2 + 20} ${maxRadius * 2 + 20}`}
        style={{ overflow: 'visible' }}
      >
        {Array.from({ length: ringCount }).map((_, index) => {
          const { radius, opacity, strokeWidth } = liquidRipple(
            frame,
            startFrame,
            fps,
            index,
            { maxRadius, durationMs, ringDelay }
          );

          if (opacity === 0) return null;

          return (
            <circle
              key={index}
              cx={maxRadius + 10}
              cy={maxRadius + 10}
              r={radius}
              fill="none"
              stroke={stateColor}
              strokeWidth={strokeWidth * (baseStrokeWidth / 3)}
              opacity={opacity}
            />
          );
        })}
      </svg>
    </div>
  );
};

/**
 * Triggered ripple - starts on a specific frame
 */
export const TriggeredRipple: React.FC<{
  triggerFrame: number;
  centerX: number;
  centerY: number;
  state?: LiquescentState;
  maxRadius?: number;
}> = ({ triggerFrame, centerX, centerY, state = 'liquescent', maxRadius = 150 }) => {
  const { fps } = useVideoConfig();
  const durationFrames = durationToFrames(durations.slow, fps);

  return (
    <Sequence from={triggerFrame} durationInFrames={durationFrames}>
      <RippleCascade
        startFrame={0}
        centerX={centerX}
        centerY={centerY}
        state={state}
        maxRadius={maxRadius}
      />
    </Sequence>
  );
};

/**
 * Impact ripple - single large ring for emphasis
 */
export const ImpactRipple: React.FC<{
  startFrame?: number;
  maxRadius?: number;
  state?: LiquescentState;
  centerX?: number;
  centerY?: number;
}> = ({
  startFrame = 0,
  maxRadius = 300,
  state = 'liquescent',
  centerX = 0,
  centerY = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { radius, opacity, strokeWidth } = liquidRipple(
    frame,
    startFrame,
    fps,
    0,
    { maxRadius, durationMs: durations.viscous, ringDelay: 0 }
  );

  const stateColor = stateColors[state].hex;

  return (
    <svg
      style={{
        position: 'absolute',
        left: centerX,
        top: centerY,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      width={maxRadius * 2 + 20}
      height={maxRadius * 2 + 20}
      viewBox={`0 0 ${maxRadius * 2 + 20} ${maxRadius * 2 + 20}`}
    >
      <circle
        cx={maxRadius + 10}
        cy={maxRadius + 10}
        r={radius}
        fill="none"
        stroke={stateColor}
        strokeWidth={strokeWidth * 2}
        opacity={opacity}
        style={{
          filter: `drop-shadow(0 0 10px ${stateColor})`,
        }}
      />
    </svg>
  );
};

/**
 * Continuous pulse - repeating ripple effect
 */
export const ContinuousPulse: React.FC<{
  cycleFrames?: number;
  ringCount?: number;
  maxRadius?: number;
  state?: LiquescentState;
  centerX?: number;
  centerY?: number;
}> = ({
  cycleFrames = 60,
  ringCount = 2,
  maxRadius = 100,
  state = 'dormant',
  centerX = 0,
  centerY = 0,
}) => {
  const frame = useCurrentFrame();

  // Calculate which cycle we're in
  const cycleStart = Math.floor(frame / cycleFrames) * cycleFrames;
  const localFrame = frame - cycleStart;

  return (
    <RippleCascade
      startFrame={-localFrame} // Offset to current position in cycle
      ringCount={ringCount}
      maxRadius={maxRadius}
      state={state}
      centerX={centerX}
      centerY={centerY}
      durationMs={cycleFrames * (1000 / 30)} // Convert frames to ms assuming 30fps
    />
  );
};

export default RippleCascade;
