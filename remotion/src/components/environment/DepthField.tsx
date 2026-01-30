/**
 * Depth Field
 *
 * Creates depth perception through parallax layers and the Ganzfeld effect.
 * At 75%+ depth, visual cues dissolve creating perceptual unity.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { depthZoneEffects, ganzfeldIntensity } from '../../design-system/physics';
import { void_tokens } from '../../design-system/tokens/colors';
import { liquidBreath } from '../../utils/liquescent-animations';

export interface DepthFieldProps {
  progress?: number;
  children: React.ReactNode;
  enableGanzfeld?: boolean;
  enableParallax?: boolean;
  parallaxLayers?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DepthField: React.FC<DepthFieldProps> = ({
  progress = 0,
  children,
  enableGanzfeld = true,
  enableParallax = true,
  parallaxLayers = 3,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Get depth zone effects
  const effects = depthZoneEffects(progress);
  const ganzfeld = enableGanzfeld ? ganzfeldIntensity(progress) : 0;

  // Breathing modulation
  const breath = liquidBreath(frame, fps, { seed: 42 });

  // Background color transitions with depth
  const bgOpacity = interpolate(progress, [0, 0.5, 1], [0.9, 0.95, 1]);

  // Parallax offset for layers (decreases with depth as things "flatten")
  const parallaxStrength = enableParallax
    ? interpolate(progress, [0, 0.75, 1], [1, 0.5, 0])
    : 0;

  // Ganzfeld overlay - uniform field that dissolves boundaries
  const ganzfeldStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `radial-gradient(
      ellipse at center,
      transparent 0%,
      ${void_tokens.deep.hex}${Math.round(ganzfeld * 0.6 * 255).toString(16).padStart(2, '0')} 50%,
      ${void_tokens.abyss.hex}${Math.round(ganzfeld * 0.9 * 255).toString(16).padStart(2, '0')} 100%
    )`,
    opacity: ganzfeld,
    pointerEvents: 'none',
    // NOTE: No CSS transition - Remotion requires frame-based animation
  };

  // Blur effect increases with depth (after 50%)
  const depthBlur = effects.blur;

  // Contrast and saturation reduction with depth
  const filterValue = `
    blur(${depthBlur}px)
    contrast(${effects.contrast})
    saturate(${effects.saturation})
  `.trim();

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: void_tokens.deep.hex,
    overflow: 'hidden',
    ...style,
  };

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    filter: depthBlur > 0 ? filterValue : undefined,
    // NOTE: No CSS transition - Remotion requires frame-based animation
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Background gradient layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(
            ellipse at 50% 30%,
            ${void_tokens.surface.hex} 0%,
            ${void_tokens.deep.hex} 50%,
            ${void_tokens.abyss.hex} 100%
          )`,
          opacity: bgOpacity,
        }}
      />

      {/* Parallax background layers */}
      {enableParallax && Array.from({ length: parallaxLayers }).map((_, index) => {
        const layerDepth = (index + 1) / (parallaxLayers + 1);
        const layerOffset = parallaxStrength * (1 - layerDepth) * 20;

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateY(${layerOffset * breath}px) scale(${1 + layerDepth * 0.02})`,
              opacity: 0.1 * (1 - layerDepth),
              background: `radial-gradient(
                circle at ${50 + (index - 1) * 20}% ${30 + index * 10}%,
                ${void_tokens.film.hex}40 0%,
                transparent 40%
              )`,
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* Main content */}
      <div style={contentStyle}>
        {children}
      </div>

      {/* Ganzfeld overlay */}
      {enableGanzfeld && ganzfeld > 0 && (
        <div style={ganzfeldStyle} />
      )}

      {/* Depth zone indicator (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            padding: '4px 8px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            fontSize: 10,
            fontFamily: 'monospace',
            borderRadius: 4,
          }}
        >
          {effects.zone} | v:{effects.viscosity.toFixed(2)} | g:{ganzfeld.toFixed(2)}
        </div>
      )}
    </div>
  );
};

/**
 * Animated depth field that progresses over time
 */
export const AnimatedDepthField: React.FC<{
  startFrame?: number;
  endFrame?: number;
  startProgress?: number;
  endProgress?: number;
  children: React.ReactNode;
}> = ({
  startFrame = 0,
  endFrame = 300,
  startProgress = 0,
  endProgress = 1,
  children,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [startProgress, endProgress],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <DepthField progress={progress}>
      {children}
    </DepthField>
  );
};

export default DepthField;
