/**
 * Dissolution Overlay
 *
 * Creates the boundary-dissolving effect for transitions.
 * Radial blur and opacity that makes edges melt away.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { void_tokens, light_tokens } from '../../design-system/tokens/colors';
import { springs } from '../../design-system/tokens';
import { perlin2D } from '../../design-system/physics';
import type { LiquescentState, SpringPreset } from '../../design-system/types';

export interface DissolutionOverlayProps {
  progress?: number;
  state?: LiquescentState;
  direction?: 'in' | 'out';
  centerX?: number;
  centerY?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DissolutionOverlay: React.FC<DissolutionOverlayProps> = ({
  progress = 0,
  state = 'dormant',
  direction = 'in',
  centerX = 50,
  centerY = 50,
  className,
  style,
}) => {
  const frame = useCurrentFrame();

  // Noise modulation for organic edge
  const noiseX = perlin2D(frame * 0.02, 0) * 5;
  const noiseY = perlin2D(0, frame * 0.02) * 5;

  // Effective progress (reversed for 'out' direction)
  const effectiveProgress = direction === 'out' ? 1 - progress : progress;

  // Gradient size based on progress
  const gradientSize = interpolate(effectiveProgress, [0, 1], [0, 150]);

  // State color tint
  const stateColor = state === 'liquescent'
    ? light_tokens.liquescent.hex
    : state === 'awakening'
      ? light_tokens.awakening.hex
      : light_tokens.dormant.hex;

  // Overlay opacity
  const overlayOpacity = interpolate(effectiveProgress, [0, 0.5, 1], [0, 0.3, 0.8]);

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(
      ellipse at ${centerX + noiseX}% ${centerY + noiseY}%,
      transparent 0%,
      ${void_tokens.deep.hex}80 ${gradientSize * 0.5}%,
      ${void_tokens.abyss.hex} ${gradientSize}%
    )`,
    opacity: overlayOpacity,
    pointerEvents: 'none',
    mixBlendMode: 'multiply',
    ...style,
  };

  // Inner glow ring
  const glowRingStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(
      ellipse at ${centerX + noiseX}% ${centerY + noiseY}%,
      ${stateColor}20 0%,
      ${stateColor}10 ${gradientSize * 0.3}%,
      transparent ${gradientSize * 0.6}%
    )`,
    opacity: effectiveProgress * 0.5,
    pointerEvents: 'none',
  };

  return (
    <>
      <div className={className} style={overlayStyle} />
      <div style={glowRingStyle} />
    </>
  );
};

/**
 * Animated dissolution - transitions over frames
 */
export const AnimatedDissolution: React.FC<{
  startFrame?: number;
  durationFrames?: number;
  direction?: 'in' | 'out';
  state?: LiquescentState;
  springPreset?: SpringPreset;
}> = ({
  startFrame = 0,
  durationFrames = 30,
  direction = 'in',
  state = 'dormant',
  springPreset = 'dissolution',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;

  const progress = localFrame < 0 ? 0 : spring({
    frame: localFrame,
    fps,
    config: springs[springPreset],
    durationInFrames: durationFrames,
  });

  return (
    <DissolutionOverlay
      progress={progress}
      direction={direction}
      state={state}
    />
  );
};

/**
 * Edge dissolution - melts the edges of the viewport
 */
export const EdgeDissolution: React.FC<{
  intensity?: number;
  state?: LiquescentState;
}> = ({
  intensity = 0.5,
  state = 'dormant',
}) => {
  const frame = useCurrentFrame();

  // Subtle breathing
  const breath = 0.9 + perlin2D(frame * 0.01, 0) * 0.1;

  const stateColor = state === 'liquescent'
    ? light_tokens.liquescent.hex
    : state === 'awakening'
      ? light_tokens.awakening.hex
      : light_tokens.dormant.hex;

  // Four edge gradients
  const edgeStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
    const isVertical = side === 'top' || side === 'bottom';
    const gradientDirection = side === 'top' ? 'to bottom'
      : side === 'bottom' ? 'to top'
        : side === 'left' ? 'to right'
          : 'to left';

    return {
      position: 'absolute',
      [side]: 0,
      left: isVertical ? 0 : undefined,
      right: isVertical ? 0 : undefined,
      top: !isVertical ? 0 : undefined,
      bottom: !isVertical ? 0 : undefined,
      width: isVertical ? '100%' : `${15 * intensity * breath}%`,
      height: isVertical ? `${15 * intensity * breath}%` : '100%',
      background: `linear-gradient(${gradientDirection},
        ${void_tokens.abyss.hex} 0%,
        ${void_tokens.deep.hex}80 30%,
        transparent 100%
      )`,
      pointerEvents: 'none',
    };
  };

  return (
    <>
      <div style={edgeStyle('top')} />
      <div style={edgeStyle('bottom')} />
      <div style={edgeStyle('left')} />
      <div style={edgeStyle('right')} />
      {/* Corner glow accents */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '30%',
          height: '30%',
          background: `radial-gradient(
            ellipse at 0% 0%,
            ${stateColor}10 0%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          opacity: intensity * breath,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '30%',
          height: '30%',
          background: `radial-gradient(
            ellipse at 100% 100%,
            ${stateColor}10 0%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          opacity: intensity * breath,
        }}
      />
    </>
  );
};

/**
 * Vignette - classic darkening at edges
 */
export const Vignette: React.FC<{
  intensity?: number;
  spread?: number;
}> = ({
  intensity = 0.6,
  spread = 50,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(
          ellipse at center,
          transparent 0%,
          transparent ${spread}%,
          ${void_tokens.abyss.hex}${Math.round(intensity * 255).toString(16).padStart(2, '0')} 100%
        )`,
        pointerEvents: 'none',
      }}
    />
  );
};

export default DissolutionOverlay;
