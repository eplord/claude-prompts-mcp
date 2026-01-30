/**
 * Flow Channel
 *
 * Domain-specific wrapper around FluidChannel for MCP chain visualizations.
 * Represents the flow of context between chain steps.
 *
 * Philosophy: Chain context flows like liquid through channels.
 * The connection is not just a line — it's a conduit of meaning.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { LiquescentState, SpringPreset } from '../../design-system/types';
import { stateColors, light_tokens, signal_tokens } from '../../design-system/tokens/colors';
import { springs } from '../../design-system/tokens';
import { FluidChannel, type Point } from '../primitives/FluidChannel';
import { liquidBreath, liquidFadeIn } from '../../utils/liquescent-animations';

export type FlowStatus = 'pending' | 'flowing' | 'complete' | 'error';

export interface FlowChannelProps {
  from: Point;
  to: Point;
  status?: FlowStatus;
  label?: string;
  activateFrame?: number;
  springPreset?: SpringPreset;
  showLabels?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Map flow status to Liquescent state
 */
const statusToState = (status: FlowStatus): LiquescentState => {
  switch (status) {
    case 'pending':
      return 'dormant';
    case 'flowing':
      return 'awakening';
    case 'complete':
      return 'liquescent';
    case 'error':
      return 'awakening'; // Uses coral override
  }
};

export const FlowChannel: React.FC<FlowChannelProps> = ({
  from,
  to,
  status = 'pending',
  label,
  activateFrame = 0,
  springPreset = 'membrane',
  showLabels = false,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const state = statusToState(status);
  const stateColor = status === 'error' ? light_tokens.coral : stateColors[state];

  // Calculate midpoint for label
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Breathing for ambient animation
  const breath = liquidBreath(frame, fps, { seed: 23 });

  // Activation progress (used for future enhancements)
  const localFrame = frame - activateFrame;
  const _activationProgress = localFrame > 0
    ? spring({
        frame: localFrame,
        fps,
        config: springs[springPreset],
        durationInFrames: 20,
      })
    : 0;
  void _activationProgress; // Reserved for future pulse effects

  // Label fade in (slightly delayed)
  const labelOpacity = showLabels && label
    ? liquidFadeIn(frame, activateFrame + 10, 15, springPreset, fps)
    : 0;

  // Flow speed varies by status
  const flowSpeed = status === 'flowing' ? 1.5 : status === 'complete' ? 0.8 : 0.3;

  // Particle count varies by status
  const particleCount = status === 'flowing' ? 8 : status === 'complete' ? 5 : 3;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      <FluidChannel
        from={from}
        to={to}
        state={state}
        active={status !== 'pending'}
        activateFrame={activateFrame}
        strokeWidth={status === 'flowing' ? 3 : 2}
        particleCount={particleCount}
        particleSize={status === 'flowing' ? 5 : 4}
        flowSpeed={flowSpeed}
        curvature={0.4}
        springPreset={springPreset}
      />

      {/* Label at midpoint */}
      {showLabels && label && (
        <div
          style={{
            position: 'absolute',
            left: midX,
            top: midY,
            transform: 'translate(-50%, -50%)',
            opacity: labelOpacity * breath,
            backgroundColor: `${stateColor.hex}20`,
            border: `1px solid ${stateColor.hex}40`,
            borderRadius: 4,
            padding: '4px 8px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            fontWeight: 600,
            color: stateColor.hex,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/**
 * Chain Flow Connector - connects chain steps in a workflow visualization
 */
export interface ChainStepConnectorProps {
  steps: Array<{
    id: string;
    label: string;
    position: Point;
    status: FlowStatus;
  }>;
  activateFrame?: number;
  staggerDelay?: number;
}

export const ChainStepConnector: React.FC<ChainStepConnectorProps> = ({
  steps,
  activateFrame = 0,
  staggerDelay = 15,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {steps.slice(0, -1).map((step, index) => {
        const nextStep = steps[index + 1];
        const connectionActivateFrame = activateFrame + index * staggerDelay;

        // Derive connection status from step statuses
        const connectionStatus: FlowStatus =
          step.status === 'complete' && nextStep.status !== 'pending'
            ? 'complete'
            : step.status === 'complete' && nextStep.status === 'pending'
              ? 'flowing'
              : step.status === 'error' || nextStep.status === 'error'
                ? 'error'
                : 'pending';

        return (
          <FlowChannel
            key={`${step.id}-${nextStep.id}`}
            from={step.position}
            to={nextStep.position}
            status={connectionStatus}
            activateFrame={connectionActivateFrame}
            showLabels={false}
          />
        );
      })}

      {/* Step nodes */}
      {steps.map((step, index) => {
        const nodeActivateFrame = activateFrame + index * staggerDelay;
        const nodeOpacity = liquidFadeIn(frame, nodeActivateFrame, 15, 'membrane', fps);

        const state = statusToState(step.status);
        const stateColor = step.status === 'error' ? light_tokens.coral : stateColors[state];

        return (
          <div
            key={step.id}
            style={{
              position: 'absolute',
              left: step.position.x,
              top: step.position.y,
              transform: 'translate(-50%, -50%)',
              opacity: nodeOpacity,
            }}
          >
            {/* Node circle */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: step.status === 'complete'
                  ? stateColor.hex
                  : `${stateColor.hex}40`,
                border: `2px solid ${stateColor.hex}`,
                boxShadow: step.status === 'flowing'
                  ? `0 0 12px ${stateColor.hex}`
                  : step.status === 'complete'
                    ? `0 0 8px ${stateColor.hex}`
                    : 'none',
              }}
            />

            {/* Step label below */}
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10,
                color: signal_tokens.secondary.hex,
                whiteSpace: 'nowrap',
              }}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default FlowChannel;
