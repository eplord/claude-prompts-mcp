/**
 * Validation Membrane
 *
 * A membrane that validates content passing through it.
 * Opens (permeable) on pass, ripples and rejects on fail.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { LiquescentState, SpringPreset } from '../../design-system/types';
import { stateColors, light_tokens, signal_tokens } from '../../design-system/tokens/colors';
import { springs } from '../../design-system/tokens';
import { liquidBreath } from '../../utils/liquescent-animations';
import { LiquescentMembrane, RippleCascade } from '../primitives';

export type ValidationStatus = 'pending' | 'validating' | 'pass' | 'fail';

export interface ValidationMembraneProps {
  status: ValidationStatus;
  criterionName: string;
  criterionDescription?: string;
  statusChangeFrame?: number;
  springPreset?: SpringPreset;
  showRipple?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const statusToState = (status: ValidationStatus): LiquescentState => {
  switch (status) {
    case 'pending': return 'dormant';
    case 'validating': return 'awakening';
    case 'pass': return 'liquescent';
    case 'fail': return 'awakening'; // Uses coral accent instead
  }
};

export const ValidationMembrane: React.FC<ValidationMembraneProps> = ({
  status,
  criterionName,
  criterionDescription,
  statusChangeFrame = 0,
  springPreset = 'membrane',
  showRipple = true,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const state = statusToState(status);
  const stateColor = status === 'fail' ? light_tokens.coral : stateColors[state];

  // Breathing animation (used for validating pulse timing)
  liquidBreath(frame, fps, { seed: 42 });

  // Status transition animation
  const localFrame = frame - statusChangeFrame;
  const transitionProgress = localFrame > 0
    ? spring({
        frame: localFrame,
        fps,
        config: springs[springPreset],
        durationInFrames: 20,
      })
    : 0;

  // Pass animation - membrane "opens"
  const passOpenness = status === 'pass' ? transitionProgress : 0;

  // Fail animation - membrane "shakes"
  const failShake = status === 'fail' && localFrame > 0 && localFrame < 20
    ? Math.sin(localFrame * 1.5) * (1 - localFrame / 20) * 3
    : 0;

  // Validating animation - pulsing
  const validatingPulse = status === 'validating'
    ? 0.9 + Math.sin(frame * 0.3) * 0.1
    : 1;

  // Icon based on status
  const statusIcon = status === 'pass' ? '✓'
    : status === 'fail' ? '✗'
      : status === 'validating' ? '◌'
        : '○';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    transform: `translateX(${failShake}px) scale(${validatingPulse})`,
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
  };

  const iconStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: status === 'pass'
      ? `${stateColor.hex}30`
      : status === 'fail'
        ? `${light_tokens.coral.hex}30`
        : `${stateColor.hex}20`,
    color: status === 'fail' ? light_tokens.coral.hex : stateColor.hex,
    fontSize: 14,
    fontWeight: 600,
    // NOTE: No CSS transition - Remotion requires frame-based animation
  };

  const nameStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 14,
    fontWeight: 500,
    color: signal_tokens.primary.hex,
    flex: 1,
  };

  const descStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 12,
    color: signal_tokens.secondary.hex,
    padding: '0 16px 12px 52px',
    opacity: 0.8,
  };

  // Permeability indicator (visual opening)
  const permeabilityStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: `linear-gradient(90deg,
      transparent ${50 - passOpenness * 40}%,
      ${stateColor.hex} 50%,
      transparent ${50 + passOpenness * 40}%
    )`,
    opacity: passOpenness,
  };

  return (
    <div className={className} style={containerStyle}>
      <LiquescentMembrane
        state={state}
        breathIntensity={status === 'validating' ? 1.5 : 0.5}
        glowIntensity={status === 'pass' ? 0.8 : status === 'fail' ? 0.6 : 0.3}
      >
        <div style={permeabilityStyle} />

        <div style={headerStyle}>
          <div style={iconStyle}>{statusIcon}</div>
          <span style={nameStyle}>{criterionName}</span>
          {status !== 'pending' && (
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: status === 'fail' ? light_tokens.coral.hex : stateColor.hex,
                fontWeight: 600,
              }}
            >
              {status}
            </span>
          )}
        </div>

        {criterionDescription && (
          <div style={descStyle}>{criterionDescription}</div>
        )}
      </LiquescentMembrane>

      {/* Ripple effect on fail */}
      {showRipple && status === 'fail' && localFrame > 0 && localFrame < 60 && (
        <RippleCascade
          startFrame={statusChangeFrame}
          ringCount={2}
          maxRadius={100}
          state="awakening"
          color={light_tokens.coral.hex}
          centerX={24}
          centerY={24}
        />
      )}
    </div>
  );
};

/**
 * Validation gate group - multiple criteria
 */
export const ValidationGateGroup: React.FC<{
  criteria: Array<{
    name: string;
    description?: string;
    status: ValidationStatus;
    statusChangeFrame?: number;
  }>;
  title?: string;
  staggerDelay?: number;
}> = ({
  criteria,
  title,
  staggerDelay = 5,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {title && (
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: signal_tokens.tertiary.hex,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
      )}
      {criteria.map((criterion, index) => (
        <ValidationMembrane
          key={criterion.name}
          status={criterion.status}
          criterionName={criterion.name}
          criterionDescription={criterion.description}
          statusChangeFrame={(criterion.statusChangeFrame ?? 0) + index * staggerDelay}
        />
      ))}
    </div>
  );
};

export default ValidationMembrane;
