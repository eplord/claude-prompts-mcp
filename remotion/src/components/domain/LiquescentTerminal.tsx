/**
 * Liquescent Terminal
 *
 * A terminal wrapped in a breathing membrane.
 * Features organic cursor, state-aware coloring, and liquid animations.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { LiquescentState, SpringPreset } from '../../design-system/types';
import { stateColors, void_tokens, signal_tokens, light_tokens } from '../../design-system/tokens/colors';
import { liquidBreath, liquidFadeIn } from '../../utils/liquescent-animations';
import { LiquescentMembrane } from '../primitives';

// Line types for terminal content
export type TerminalLine =
  | { type: 'command'; text: string }
  | { type: 'output'; text: string }
  | { type: 'tool'; name: string; args?: string }
  | { type: 'error'; text: string }
  | { type: 'success'; text: string }
  | { type: 'assistant'; text: string }  // Claude's response (client-side LLM)
  | { type: 'mcp-return'; text: string }; // MCP server return value

export interface LiquescentTerminalProps {
  state?: LiquescentState;
  title?: string;
  lines: TerminalLine[];
  typing?: {
    enabled: boolean;
    charsPerSecond?: number;
    startFrame?: number;
  };
  cursor?: {
    visible?: boolean;
    blinkRate?: number;
  };
  startFrame?: number;
  springPreset?: SpringPreset;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const LiquescentTerminal: React.FC<LiquescentTerminalProps> = ({
  state = 'dormant',
  title = 'terminal',
  lines,
  typing = { enabled: true, charsPerSecond: 25, startFrame: 0 },
  cursor = { visible: true, blinkRate: 20 },
  startFrame = 0,
  springPreset = 'membrane',
  width = '100%',
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stateColor = stateColors[state];

  // Fade in animation
  const fadeIn = liquidFadeIn(frame, startFrame, 20, springPreset, fps);

  // Breathing animation
  const breath = liquidBreath(frame, fps, { seed: 7 });

  // Calculate visible characters for typing effect
  const totalChars = lines.reduce((acc, line) => {
    if (line.type === 'command' || line.type === 'output' || line.type === 'error' || line.type === 'success' || line.type === 'assistant' || line.type === 'mcp-return') {
      return acc + line.text.length + 1;
    }
    if (line.type === 'tool') {
      return acc + line.name.length + (line.args?.length ?? 0) + 1;
    }
    return acc;
  }, 0);

  const typingStart = typing.startFrame ?? startFrame;
  const charsPerSecond = typing.charsPerSecond ?? 25;
  const visibleChars = typing.enabled
    ? Math.max(0, Math.floor(((frame - typingStart) / fps) * charsPerSecond))
    : totalChars;

  // Cursor blink - organic rate
  const blinkPhase = Math.floor(frame / (cursor.blinkRate ?? 20));
  const showCursor = cursor.visible !== false && blinkPhase % 2 === 0;

  // Cursor glow intensity varies with breath
  const cursorGlow = breath * 0.8;

  const containerStyle: React.CSSProperties = {
    opacity: fadeIn,
    width,
    ...style,
  };

  const chromeStyle: React.CSSProperties = {
    backgroundColor: `${void_tokens.surface.hex}CC`,
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${void_tokens.film.hex}`,
  };

  const contentStyle: React.CSSProperties = {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 100,
    backgroundColor: `${void_tokens.deep.hex}E6`,
  };

  return (
    <div className={className} style={containerStyle}>
      <LiquescentMembrane state={state} breathIntensity={0.5} glowIntensity={0.4}>
        {/* Chrome bar */}
        <div style={chromeStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: light_tokens.coral.hex, opacity: 0.8 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: light_tokens.awakening.hex, opacity: 0.8 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: light_tokens.liquescent.hex, opacity: 0.8 }} />
          </div>
          <span
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 11,
              color: signal_tokens.tertiary.hex,
              textTransform: 'lowercase',
              letterSpacing: '0.5px',
            }}
          >
            {title}
          </span>
          <div style={{ width: 46 }} />
        </div>

        {/* Content area */}
        <div style={contentStyle}>
          {renderTerminalLines(lines, visibleChars, state, showCursor, cursorGlow)}
        </div>

        {/* State accent bar */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, ${stateColor.hex}, transparent 80%)`,
            opacity: breath,
          }}
        />
      </LiquescentMembrane>
    </div>
  );
};

function renderTerminalLines(
  lines: TerminalLine[],
  visibleChars: number,
  state: LiquescentState,
  showCursor: boolean,
  cursorGlow: number
): React.ReactNode[] {
  const stateColor = stateColors[state];
  let charCount = 0;
  const elements: React.ReactNode[] = [];

  const monoStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: 13,
    lineHeight: 1.5,
  };

  const promptChar = '❯';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = charCount;

    if (line.type === 'command') {
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0 || visibleChars > lineStart) {
        elements.push(
          <div key={i} style={{ display: 'flex', gap: 8, ...monoStyle }}>
            <span style={{ color: stateColor.hex, flexShrink: 0 }}>{promptChar}</span>
            <span style={{ color: signal_tokens.primary.hex }}>
              {line.text.slice(0, visible)}
              {visibleChars >= lineStart && visibleChars < lineEnd && showCursor && (
                <span
                  style={{
                    color: stateColor.hex,
                    textShadow: `0 0 ${8 * cursorGlow}px ${stateColor.hex}`,
                  }}
                >
                  ▋
                </span>
              )}
            </span>
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'output') {
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ ...monoStyle, color: signal_tokens.secondary.hex, paddingLeft: 24 }}>
            {line.text.slice(0, visible)}
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'tool') {
      const toolText = `${line.name}${line.args ? `(${line.args})` : ''}`;
      const lineEnd = lineStart + toolText.length;
      const visible = Math.max(0, Math.min(toolText.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, ...monoStyle }}>
            <span
              style={{
                backgroundColor: light_tokens.awakening.hex,
                color: void_tokens.abyss.hex,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              TOOL
            </span>
            <span style={{ color: signal_tokens.primary.hex }}>{toolText.slice(0, visible)}</span>
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'error') {
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ ...monoStyle, color: light_tokens.coral.hex, paddingLeft: 24 }}>
            {line.text.slice(0, visible)}
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'success') {
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ ...monoStyle, color: light_tokens.liquescent.hex, paddingLeft: 24 }}>
            {line.text.slice(0, visible)}
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'assistant') {
      // Claude's response - shows with a distinctive icon
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...monoStyle }}>
            <span
              style={{
                backgroundColor: light_tokens.dormant.hex,
                color: void_tokens.abyss.hex,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              ⚡ CLAUDE
            </span>
            <span style={{ color: signal_tokens.primary.hex }}>{line.text.slice(0, visible)}</span>
          </div>
        );
      }
      charCount = lineEnd + 1;
    } else if (line.type === 'mcp-return') {
      // MCP server return value - shows what the server prepared
      const lineEnd = lineStart + line.text.length;
      const visible = Math.max(0, Math.min(line.text.length, visibleChars - lineStart));

      if (visible > 0) {
        elements.push(
          <div key={i} style={{ ...monoStyle, color: signal_tokens.tertiary.hex, paddingLeft: 24, fontStyle: 'italic' }}>
            {line.text.slice(0, visible)}
          </div>
        );
      }
      charCount = lineEnd + 1;
    }
  }

  // Show cursor at end if all text is visible
  if (showCursor && visibleChars >= charCount) {
    elements.push(
      <div key="cursor-end" style={{ display: 'flex', gap: 8, ...monoStyle }}>
        <span style={{ color: stateColor.hex }}>{promptChar}</span>
        <span
          style={{
            color: stateColor.hex,
            textShadow: `0 0 ${8 * cursorGlow}px ${stateColor.hex}`,
          }}
        >
          ▋
        </span>
      </div>
    );
  }

  return elements;
}

export default LiquescentTerminal;
