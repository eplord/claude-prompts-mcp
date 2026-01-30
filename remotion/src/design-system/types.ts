/**
 * Liquescent Design System - Core Types
 *
 * The three states of liquescent existence:
 * - Dormant: Waiting, observing, potential (Cyan, Pentagon)
 * - Awakening: Engaging, warming, intention (Amber, Octagon)
 * - Liquescent: Dissolved, merged, completion (Chartreuse, Circle)
 */

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * The three states of a liquescent element
 */
export type LiquescentState = 'dormant' | 'awakening' | 'liquescent';

/**
 * The four types of disturbance that propagate through the viscous medium
 */
export type DisturbanceType = 'hover' | 'click' | 'scroll' | 'focus';

/**
 * Depth zones that affect viscosity and propagation speed
 */
export type DepthZone = 'surface' | 'immersed' | 'deep' | 'abyss';

// =============================================================================
// COLOR TYPES
// =============================================================================

/**
 * oklch color value (perceptually uniform)
 */
export type OklchColor = `oklch(${string})`;

/**
 * Hex color fallback for environments without oklch support
 */
export type HexColor = `#${string}`;

/**
 * Color with both oklch and hex fallback
 */
export interface LiquescentColor {
  oklch: OklchColor;
  hex: HexColor;
}

// =============================================================================
// MOTION TYPES
// =============================================================================

/**
 * Spring configuration for Remotion's spring() function
 */
export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

/**
 * Named spring presets
 */
export type SpringPreset = 'viscous' | 'membrane' | 'dissolution' | 'ripple' | 'breath';

/**
 * Duration tokens in milliseconds
 */
export type DurationToken =
  | 'instant'
  | 'quick'
  | 'viscous'
  | 'drift'
  | 'slow'
  | 'breath'
  | 'deepBreath';

// =============================================================================
// COMPONENT PROPS TYPES
// =============================================================================

/**
 * Common props for liquescent components
 */
export interface LiquescentComponentProps {
  /** Current state of the element */
  state?: LiquescentState;
  /** Enable breathing animation */
  breathe?: boolean;
  /** Glow intensity (0-1) */
  glowIntensity?: number;
  /** Current viscosity (affects animation speed) */
  viscosity?: number;
}

/**
 * Props for elements that participate in disturbance propagation
 */
export interface DisturbanceProps {
  /** Distance from disturbance origin (for decay calculation) */
  siblingDistance?: number;
  /** Current depth in the medium (0-1) */
  depthProgress?: number;
  /** Type of disturbance affecting this element */
  disturbanceType?: DisturbanceType;
}

// =============================================================================
// SHAPE TYPES
// =============================================================================

/**
 * CSS clip-path values for the three state shapes
 */
export const STATE_SHAPES: Record<LiquescentState, string> = {
  dormant: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', // Pentagon
  awakening:
    'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', // Octagon
  liquescent: 'circle(50%)', // Circle
} as const;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract numeric values from oklch string for calculations
 */
export interface OklchComponents {
  lightness: number; // 0-100%
  chroma: number; // 0-0.4 typically
  hue: number; // 0-360
}

/**
 * Animation frame context
 */
export interface FrameContext {
  frame: number;
  fps: number;
  durationInFrames: number;
}
