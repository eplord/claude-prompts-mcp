/**
 * Liquescent Membrane
 *
 * A living glass container that responds to state changes.
 * State-based border color, breathing animation, viscous physics.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { LiquescentState } from '../../design-system/types';
import { stateColors } from '../../design-system/tokens/colors';
import { liquidBreath, liquidBreathScale, liquidBreathGlow } from '../../utils/liquescent-animations';

export interface LiquescentMembraneProps {
  state?: LiquescentState;
  children: React.ReactNode;
  seed?: number;
  breathIntensity?: number;
  glowIntensity?: number;
  borderWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LiquescentMembrane: React.FC<LiquescentMembraneProps> = ({
  state = 'dormant',
  children,
  seed = 0,
  breathIntensity = 1,
  glowIntensity = 0.6,
  borderWidth = 1,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Get state-based color
  const stateColor = stateColors[state];

  // Subtle breathing animations - barely perceptible
  const breath = liquidBreath(frame, fps, { intensity: breathIntensity, seed });
  const scale = liquidBreathScale(frame, fps, breathIntensity, seed);
  const glowBreath = liquidBreathGlow(frame, fps, seed);

  // Glow intensity based on state with subtle breath modulation
  const baseGlow = state === 'liquescent' ? 1 : state === 'awakening' ? 0.7 : 0.4;
  const currentGlow = baseGlow * glowBreath * glowIntensity;

  // Background opacity - very subtle variation (0.04-0.05)
  const bgOpacity = 0.04 + (breath - 0.97) * 0.3;

  // Border opacity - subtle variation (0.25-0.30)
  const borderOpacity = 0.25 + (breath - 0.97) * 1.5;

  const membraneStyle: React.CSSProperties = {
    position: 'relative',
    backgroundColor: `rgba(255, 255, 255, ${bgOpacity})`,
    border: `${borderWidth}px solid`,
    borderColor: stateColor.hex,
    borderRadius: '12px',
    backdropFilter: 'blur(8px)',
    boxShadow: `
      0 0 ${20 * currentGlow}px ${stateColor.hex}40,
      0 0 ${40 * currentGlow}px ${stateColor.hex}20,
      inset 0 1px 0 rgba(255, 255, 255, ${0.08 + (breath - 0.97) * 0.6})
    `,
    transform: `scale(${scale})`,
    // NOTE: No CSS transition - Remotion requires frame-based animation
    ...style,
  };

  // Inner glow layer
  const innerGlowStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    background: `radial-gradient(ellipse at 50% 0%, ${stateColor.hex}${Math.round(borderOpacity * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
    pointerEvents: 'none',
  };

  return (
    <div className={className} style={membraneStyle}>
      <div style={innerGlowStyle} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Membrane variant with dormant state appearance
 */
export const DormantMembrane: React.FC<Omit<LiquescentMembraneProps, 'state'>> = (props) => (
  <LiquescentMembrane {...props} state="dormant" />
);

/**
 * Membrane variant with awakening state appearance
 */
export const AwakeningMembrane: React.FC<Omit<LiquescentMembraneProps, 'state'>> = (props) => (
  <LiquescentMembrane {...props} state="awakening" />
);

/**
 * Membrane variant with liquescent state appearance
 */
export const LiquescentStateMembrane: React.FC<Omit<LiquescentMembraneProps, 'state'>> = (props) => (
  <LiquescentMembrane {...props} state="liquescent" />
);

export default LiquescentMembrane;
