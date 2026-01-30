/**
 * Viscous Medium
 *
 * Perlin noise-driven particle field that creates the liquid atmosphere.
 * Particles drift organically, with speed affected by viscosity/depth.
 */

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { organicDrift, swarmMotion, perlin2D } from '../../design-system/physics';
import { getViscosity } from '../../design-system/tokens';
import { light_tokens, void_tokens } from '../../design-system/tokens/colors';
import type { LiquescentState } from '../../design-system/types';

export interface ViscousMediumProps {
  particleCount?: number;
  depthProgress?: number;
  state?: LiquescentState;
  intensity?: number;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Particle {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  speed: number;
  hue: number;
}

export const ViscousMedium: React.FC<ViscousMediumProps> = ({
  particleCount = 50,
  depthProgress = 0,
  state = 'dormant',
  intensity = 1,
  width = 1920,
  height = 1080,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  useVideoConfig(); // Required for Remotion context

  // Generate stable particles based on count
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }).map((_, i) => {
      const seed = i * 7.3;
      return {
        id: i,
        baseX: (perlin2D(seed, 0) + 1) / 2 * width,
        baseY: (perlin2D(0, seed) + 1) / 2 * height,
        size: 2 + perlin2D(seed, seed) * 4,
        opacity: 0.2 + perlin2D(seed * 0.5, seed * 0.3) * 0.3,
        speed: 0.5 + perlin2D(seed * 0.7, seed * 0.1) * 0.5,
        hue: perlin2D(seed * 0.2, seed * 0.8) * 30, // Slight hue variation
      };
    });
  }, [particleCount, width, height]);

  // Get viscosity for current depth
  const viscosity = getViscosity(depthProgress);

  // State color for particles
  const stateColor = state === 'liquescent'
    ? light_tokens.liquescent.hex
    : state === 'awakening'
      ? light_tokens.awakening.hex
      : light_tokens.dormant.hex;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="particle-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="particle-gradient">
            <stop offset="0%" stopColor={stateColor} stopOpacity="1" />
            <stop offset="100%" stopColor={stateColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {particles.map((particle) => {
          // Calculate organic drift with viscosity
          const drift = organicDrift(
            frame,
            particle.id,
            particle.speed / viscosity,
            0.008,
            30 * intensity
          );

          // Current position
          const x = particle.baseX + drift.x;
          const y = particle.baseY + drift.y;

          // Wrap around edges
          const wrappedX = ((x % width) + width) % width;
          const wrappedY = ((y % height) + height) % height;

          // Opacity pulses slightly
          const opacityPulse = 0.8 + perlin2D(frame * 0.02 + particle.id, particle.id) * 0.2;
          const finalOpacity = particle.opacity * opacityPulse * intensity;

          // Size breathes
          const sizePulse = 1 + perlin2D(particle.id, frame * 0.01) * 0.2;
          const finalSize = particle.size * sizePulse;

          return (
            <circle
              key={particle.id}
              cx={wrappedX}
              cy={wrappedY}
              r={finalSize}
              fill={stateColor}
              opacity={finalOpacity}
              filter="url(#particle-glow)"
            />
          );
        })}
      </svg>
    </div>
  );
};

/**
 * Swarm variant - particles that move together with individuality
 */
export const SwarmMedium: React.FC<{
  particleCount?: number;
  width?: number;
  height?: number;
  state?: LiquescentState;
}> = ({
  particleCount = 30,
  width = 1920,
  height = 1080,
  state = 'dormant',
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      baseX: width / 2,
      baseY: height / 2,
      size: 3 + Math.random() * 4,
    }));
  }, [particleCount, width, height]);

  const stateColor = state === 'liquescent'
    ? light_tokens.liquescent.hex
    : state === 'awakening'
      ? light_tokens.awakening.hex
      : light_tokens.dormant.hex;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {particles.map((particle) => {
        const motion = swarmMotion(frame, particle.id, particleCount);

        const x = particle.baseX + motion.x * 5;
        const y = particle.baseY + motion.y * 5;

        // Spread from center
        const spreadX = (particle.id / particleCount - 0.5) * width * 0.6;
        const spreadY = ((particle.id * 7) % particleCount / particleCount - 0.5) * height * 0.6;

        return (
          <circle
            key={particle.id}
            cx={x + spreadX}
            cy={y + spreadY}
            r={particle.size}
            fill={stateColor}
            opacity={0.4 + Math.sin(motion.phase) * 0.2}
          />
        );
      })}
    </svg>
  );
};

/**
 * Fog layer - subtle atmospheric haze
 */
export const FogLayer: React.FC<{
  depthProgress?: number;
  intensity?: number;
}> = ({
  depthProgress = 0,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();

  // Fog opacity increases with depth
  const baseOpacity = interpolate(depthProgress, [0, 0.5, 1], [0.05, 0.15, 0.3]);
  const opacity = baseOpacity * intensity;

  // Subtle movement
  const offsetX = perlin2D(frame * 0.005, 0) * 50;
  const offsetY = perlin2D(0, frame * 0.005) * 30;

  return (
    <div
      style={{
        position: 'absolute',
        inset: -100,
        background: `radial-gradient(
          ellipse at ${50 + offsetX * 0.5}% ${50 + offsetY * 0.5}%,
          ${void_tokens.film.hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 0%,
          transparent 70%
        )`,
        pointerEvents: 'none',
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    />
  );
};

export default ViscousMedium;
