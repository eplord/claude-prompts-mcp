/**
 * Coalesce Text
 *
 * Text that assembles from scattered fragments.
 * Uses Perlin-seeded scatter positions and spring-based assembly.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { fractalNoise2D, perlin2D } from '../../design-system/physics';
import { springs, calculateStagger } from '../../design-system/tokens';
import type { SpringPreset } from '../../design-system/types';

export interface CoalesceTextProps {
  text: string;
  startFrame?: number;
  scatterRadius?: number;
  springPreset?: SpringPreset;
  staggerPattern?: 'ripple' | 'cascade' | 'organic' | 'wave';
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  glowColor?: string;
  glowIntensity?: number;
  letterSpacing?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CoalesceText: React.FC<CoalesceTextProps> = ({
  text,
  startFrame = 0,
  scatterRadius = 150,
  springPreset = 'dissolution',
  staggerPattern = 'cascade',
  fontSize = 48,
  fontWeight = 600,
  color = '#FFFFFF',
  glowColor,
  glowIntensity = 0.5,
  letterSpacing = 0,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const characters = text.split('');
  const effectiveGlowColor = glowColor || color;

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    position: 'relative',
    fontSize,
    fontWeight,
    color,
    letterSpacing,
    ...style,
  };

  return (
    <span className={className} style={containerStyle}>
      {characters.map((char, index) => {
        // Unique seed per character
        const seed = index * 7.3;

        // Calculate stagger delay
        const staggerDelay = calculateStagger(index, staggerPattern, 0.7);
        const charStartFrame = startFrame + staggerDelay;
        const localFrame = frame - charStartFrame;

        // Initial scattered position using Perlin noise
        const scatterX = fractalNoise2D(seed, 0) * scatterRadius;
        const scatterY = fractalNoise2D(0, seed) * scatterRadius;
        const scatterRotation = perlin2D(seed, seed * 0.5) * 30;

        // Animation progress
        const progress = localFrame < 0 ? 0 : spring({
          frame: localFrame,
          fps,
          config: springs[springPreset],
          durationInFrames: 20,
        });

        // Interpolate from scattered to final position
        const x = scatterX * (1 - progress);
        const y = scatterY * (1 - progress);
        const rotation = scatterRotation * (1 - progress);
        const opacity = 0.2 + 0.8 * progress;
        const scale = 0.8 + 0.2 * progress;

        // Glow increases as character settles
        const glowAmount = glowIntensity * progress;

        const charStyle: React.CSSProperties = {
          display: 'inline-block',
          transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
          opacity,
          textShadow: glowAmount > 0 ? `
            0 0 ${10 * glowAmount}px ${effectiveGlowColor}60,
            0 0 ${20 * glowAmount}px ${effectiveGlowColor}40,
            0 0 ${30 * glowAmount}px ${effectiveGlowColor}20
          ` : 'none',
          whiteSpace: char === ' ' ? 'pre' : 'normal',
        };

        return (
          <span key={index} style={charStyle}>
            {char}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Word-level coalesce for better readability with long text
 */
export const CoalesceWords: React.FC<Omit<CoalesceTextProps, 'text'> & { words: string[] }> = ({
  words,
  startFrame = 0,
  scatterRadius = 200,
  springPreset = 'dissolution',
  staggerPattern = 'cascade',
  fontSize = 48,
  fontWeight = 600,
  color = '#FFFFFF',
  glowColor,
  glowIntensity = 0.5,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const effectiveGlowColor = glowColor || color;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3em',
    fontSize,
    fontWeight,
    color,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {words.map((word, index) => {
        const seed = index * 13.7;
        const staggerDelay = calculateStagger(index, staggerPattern, 0.8);
        const wordStartFrame = startFrame + staggerDelay;
        const localFrame = frame - wordStartFrame;

        const scatterX = fractalNoise2D(seed, 0) * scatterRadius;
        const scatterY = fractalNoise2D(0, seed) * scatterRadius;
        const scatterRotation = perlin2D(seed, seed * 0.5) * 20;

        const progress = localFrame < 0 ? 0 : spring({
          frame: localFrame,
          fps,
          config: springs[springPreset],
          durationInFrames: 25,
        });

        const x = scatterX * (1 - progress);
        const y = scatterY * (1 - progress);
        const rotation = scatterRotation * (1 - progress);
        const opacity = 0.1 + 0.9 * progress;
        const scale = 0.7 + 0.3 * progress;
        const glowAmount = glowIntensity * progress;

        const wordStyle: React.CSSProperties = {
          display: 'inline-block',
          transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
          opacity,
          textShadow: glowAmount > 0 ? `
            0 0 ${15 * glowAmount}px ${effectiveGlowColor}60,
            0 0 ${30 * glowAmount}px ${effectiveGlowColor}40
          ` : 'none',
        };

        return (
          <span key={index} style={wordStyle}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

export default CoalesceText;
