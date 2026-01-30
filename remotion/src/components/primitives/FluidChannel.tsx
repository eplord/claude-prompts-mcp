/**
 * Fluid Channel
 *
 * Animated flowing connections between elements.
 * Features particle flow along path and animated stroke dasharray.
 */

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { LiquescentState, SpringPreset } from '../../design-system/types';
import { stateColors } from '../../design-system/tokens/colors';
import { springs } from '../../design-system/tokens';
import { liquidFlow, liquidParticleStream } from '../../utils/liquescent-animations';
import { perlin2D } from '../../design-system/physics';

export interface Point {
  x: number;
  y: number;
}

export interface FluidChannelProps {
  from: Point;
  to: Point;
  state?: LiquescentState;
  active?: boolean;
  activateFrame?: number;
  strokeWidth?: number;
  particleCount?: number;
  particleSize?: number;
  flowSpeed?: number;
  curvature?: number;
  springPreset?: SpringPreset;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generate a curved path between two points using quadratic bezier
 */
const generatePath = (from: Point, to: Point, curvature: number): string => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Perpendicular offset for curve
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Control point perpendicular to the line
  const perpX = -dy / length;
  const perpY = dx / length;

  const controlX = midX + perpX * curvature * length * 0.3;
  const controlY = midY + perpY * curvature * length * 0.3;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
};

/**
 * Get point on quadratic bezier curve at t (0-1)
 */
const getPointOnCurve = (
  from: Point,
  to: Point,
  curvature: number,
  t: number
): Point => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const perpX = -dy / length;
  const perpY = dx / length;

  const controlX = midX + perpX * curvature * length * 0.3;
  const controlY = midY + perpY * curvature * length * 0.3;

  // Quadratic bezier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * from.x + 2 * oneMinusT * t * controlX + t * t * to.x,
    y: oneMinusT * oneMinusT * from.y + 2 * oneMinusT * t * controlY + t * t * to.y,
  };
};

export const FluidChannel: React.FC<FluidChannelProps> = ({
  from,
  to,
  state = 'dormant',
  active = true,
  activateFrame = 0,
  strokeWidth = 2,
  particleCount = 5,
  particleSize = 4,
  flowSpeed = 1,
  curvature = 0.5,
  springPreset = 'membrane',
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stateColor = stateColors[state];

  // Calculate path length for dash animation
  const pathLength = useMemo(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.sqrt(dx * dx + dy * dy) * 1.2; // Approximate curved length
  }, [from, to]);

  // Activation animation
  const localFrame = frame - activateFrame;
  const activationProgress = active && localFrame > 0
    ? spring({
        frame: localFrame,
        fps,
        config: springs[springPreset],
        durationInFrames: 20,
      })
    : active ? 1 : 0;

  // Flow animation offset
  const flowOffset = liquidFlow(frame, fps, { speed: flowSpeed, patternLength: pathLength });

  // Stroke dash for flow effect
  const dashLength = 20;
  const gapLength = 15;
  const strokeDasharray = `${dashLength} ${gapLength}`;
  const strokeDashoffset = -flowOffset;

  // Stroke opacity based on activation
  const strokeOpacity = interpolate(activationProgress, [0, 1], [0.1, 0.6]);

  // Glow intensity based on state
  const glowIntensity = state === 'liquescent' ? 1 : state === 'awakening' ? 0.6 : 0.3;

  // SVG bounds
  const minX = Math.min(from.x, to.x) - 50;
  const minY = Math.min(from.y, to.y) - 50;
  const maxX = Math.max(from.x, to.x) + 50;
  const maxY = Math.max(from.y, to.y) + 50;
  const width = maxX - minX;
  const height = maxY - minY;

  // Adjust path for viewBox offset
  const adjustedPath = useMemo(() => {
    return generatePath(
      { x: from.x - minX, y: from.y - minY },
      { x: to.x - minX, y: to.y - minY },
      curvature
    );
  }, [from, to, minX, minY, curvature]);

  // Generate particles
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, index) => {
      const progress = liquidParticleStream(
        frame,
        fps,
        index,
        particleCount,
        1, // normalized path length
        { speed: flowSpeed }
      );

      // Add slight perpendicular wobble using noise
      const wobble = perlin2D(frame * 0.1 + index, index) * 3;

      const point = getPointOnCurve(
        { x: from.x - minX, y: from.y - minY },
        { x: to.x - minX, y: to.y - minY },
        curvature,
        progress
      );

      // Apply wobble perpendicular to path direction
      const t = progress;
      const tangentX = 2 * (1 - t) * (to.x - from.x) * 0.5 + 2 * t * (to.x - from.x) * 0.5;
      const tangentY = 2 * (1 - t) * (to.y - from.y) * 0.5 + 2 * t * (to.y - from.y) * 0.5;
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;

      return {
        x: point.x + (-tangentY / tangentLength) * wobble,
        y: point.y + (tangentX / tangentLength) * wobble,
        opacity: activationProgress * (0.5 + 0.5 * Math.sin(progress * Math.PI)),
      };
    });
  }, [frame, fps, from, to, minX, minY, curvature, particleCount, flowSpeed, activationProgress]);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: minX,
    top: minY,
    pointerEvents: 'none',
    ...style,
  };

  return (
    <svg
      className={className}
      style={containerStyle}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <filter id={`glow-${state}`}>
          <feGaussianBlur stdDeviation={3 * glowIntensity} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow path */}
      <path
        d={adjustedPath}
        fill="none"
        stroke={stateColor.hex}
        strokeWidth={strokeWidth * 3}
        opacity={strokeOpacity * 0.3 * glowIntensity}
        filter={`url(#glow-${state})`}
      />

      {/* Main flowing path */}
      <path
        d={adjustedPath}
        fill="none"
        stroke={stateColor.hex}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        opacity={strokeOpacity}
        strokeLinecap="round"
      />

      {/* Particles */}
      {particles.map((particle, index) => (
        <circle
          key={index}
          cx={particle.x}
          cy={particle.y}
          r={particleSize}
          fill={stateColor.hex}
          opacity={particle.opacity}
          filter={`url(#glow-${state})`}
        />
      ))}
    </svg>
  );
};

/**
 * Multi-channel connection - multiple fluid channels in parallel
 */
export const MultiChannel: React.FC<{
  from: Point;
  to: Point;
  channelCount?: number;
  state?: LiquescentState;
  spread?: number;
}> = ({
  from,
  to,
  channelCount = 3,
  state = 'dormant',
  spread = 20,
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / length;
  const perpY = dx / length;

  return (
    <>
      {Array.from({ length: channelCount }).map((_, index) => {
        const offset = (index - (channelCount - 1) / 2) * spread;
        const offsetFrom = {
          x: from.x + perpX * offset,
          y: from.y + perpY * offset,
        };
        const offsetTo = {
          x: to.x + perpX * offset,
          y: to.y + perpY * offset,
        };

        return (
          <FluidChannel
            key={index}
            from={offsetFrom}
            to={offsetTo}
            state={state}
            curvature={0.3 + index * 0.1}
            flowSpeed={0.8 + index * 0.2}
            particleCount={3}
            strokeWidth={1.5}
          />
        );
      })}
    </>
  );
};

export default FluidChannel;
