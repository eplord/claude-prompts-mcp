/**
 * Liquescent Design System - Color Tokens
 *
 * All colors defined in oklch() for perceptual uniformity.
 * Hex fallbacks provided for environments without oklch support.
 *
 * Philosophy:
 * - THE VOID: Where light dies (backgrounds)
 * - THE LUMINESCENCE: Bioluminescent frequencies from within (accents)
 * - THE SIGNAL: Information hierarchy (text)
 */

import type { LiquescentColor, LiquescentState, OklchColor, HexColor } from '../types';

// =============================================================================
// THE VOID - Where light dies
// =============================================================================

export const void_tokens = {
  /** Absolute darkness — the deepest layer, true black with cold blue undertone */
  abyss: {
    oklch: 'oklch(4% 0.02 220)' as OklchColor,
    hex: '#030508' as HexColor,
  },
  /** Primary background — petro-black with teal cast, the default canvas */
  deep: {
    oklch: 'oklch(8% 0.03 200)' as OklchColor,
    hex: '#080E12' as HexColor,
  },
  /** Elevated surfaces — cards, modals, membranes */
  surface: {
    oklch: 'oklch(12% 0.04 200)' as OklchColor,
    hex: '#101820' as HexColor,
  },
  /** Surface film — the outermost void layer, interactive elements */
  film: {
    oklch: 'oklch(16% 0.04 200)' as OklchColor,
    hex: '#182028' as HexColor,
  },
} as const;

// =============================================================================
// THE LUMINESCENCE - Bioluminescent frequencies from within
// =============================================================================

export const light_tokens = {
  /** Dormant state — cyan, observation, potential, data flow */
  dormant: {
    oklch: 'oklch(78% 0.14 200)' as OklchColor,
    hex: '#4ECDC4' as HexColor,
  },
  /** Awakening state — amber, engagement, warming, intention */
  awakening: {
    oklch: 'oklch(82% 0.18 75)' as OklchColor,
    hex: '#F5A623' as HexColor,
  },
  /** Liquescent state — chartreuse, completion, success, merged */
  liquescent: {
    oklch: 'oklch(85% 0.24 145)' as OklchColor,
    hex: '#7FFF00' as HexColor,
  },
  /** Coral — focus pulse, attention, use sparingly */
  coral: {
    oklch: 'oklch(72% 0.16 25)' as OklchColor,
    hex: '#FF6B6B' as HexColor,
  },
} as const;

// =============================================================================
// THE SIGNAL - Information hierarchy
// =============================================================================

export const signal_tokens = {
  /** Primary text — high readability, pearl white */
  primary: {
    oklch: 'oklch(95% 0.01 200)' as OklchColor,
    hex: '#F5F3F0' as HexColor,
  },
  /** Secondary text — supporting information, muted */
  secondary: {
    oklch: 'oklch(65% 0.03 200)' as OklchColor,
    hex: '#8A9BA8' as HexColor,
  },
  /** Tertiary text — whispers, timestamps, metadata */
  tertiary: {
    oklch: 'oklch(45% 0.02 200)' as OklchColor,
    hex: '#4A5A68' as HexColor,
  },
} as const;

// =============================================================================
// SEMANTIC - Functional colors aligned with philosophy
// =============================================================================

export const semantic_tokens = {
  /** Success = liquescent state (completion is liquescence) */
  success: light_tokens.liquescent,
  /** Warning = awakening state (caution is warming) */
  warning: light_tokens.awakening,
  /** Error — distinct from coral, true error state */
  error: {
    oklch: 'oklch(65% 0.22 25)' as OklchColor,
    hex: '#DC2626' as HexColor,
  },
  /** Info = dormant state (information is dormant data) */
  info: light_tokens.dormant,
} as const;

// =============================================================================
// P3 GAMUT EXTENSIONS - "Impossible" colors for capable displays
// =============================================================================

export const p3_tokens = {
  /** Electric cyan — beyond sRGB gamut */
  electricCyan: {
    oklch: 'oklch(85% 0.37 195)' as OklchColor,
    hex: '#00FFFF' as HexColor, // sRGB fallback (not the same!)
  },
  /** Impossible magenta — P3 gamut only */
  impossibleMagenta: {
    oklch: 'oklch(65% 0.35 330)' as OklchColor,
    hex: '#FF00FF' as HexColor, // sRGB fallback
  },
  /** Nuclear chartreuse — maximum chroma */
  nuclearChartreuse: {
    oklch: 'oklch(92% 0.35 140)' as OklchColor,
    hex: '#BFFF00' as HexColor, // sRGB fallback
  },
} as const;

// =============================================================================
// STATE-BASED COLOR MAPPING
// =============================================================================

/**
 * Get the primary color for a given liquescent state
 */
export const stateColors: Record<LiquescentState, LiquescentColor> = {
  dormant: light_tokens.dormant,
  awakening: light_tokens.awakening,
  liquescent: light_tokens.liquescent,
};

/**
 * Get the hue value for a given state (for calculations)
 */
export const stateHues: Record<LiquescentState, number> = {
  dormant: 200, // Cyan
  awakening: 75, // Amber
  liquescent: 145, // Chartreuse
};

// =============================================================================
// GLOW EFFECTS
// =============================================================================

/**
 * Generate glow shadow for a color
 */
export const createGlow = (color: LiquescentColor, intensity: number = 1): string => {
  const baseOpacity = 0.4 * intensity;
  const outerOpacity = 0.2 * intensity;
  return `0 0 20px ${color.hex}${Math.round(baseOpacity * 255).toString(16).padStart(2, '0')}, 0 0 40px ${color.hex}${Math.round(outerOpacity * 255).toString(16).padStart(2, '0')}`;
};

/**
 * Pre-defined glow effects for each state
 */
export const stateGlows: Record<LiquescentState, string> = {
  dormant: createGlow(light_tokens.dormant),
  awakening: createGlow(light_tokens.awakening),
  liquescent: createGlow(light_tokens.liquescent, 1.2), // Slightly more intense
};

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Golden angle for hue rotation (137.5°)
 * Found in sunflowers, galaxies, DNA — most efficient distribution
 */
export const GOLDEN_ANGLE = 137.5;

/**
 * Golden ratio for chroma/saturation boost
 */
export const PHI = 1.618;

/**
 * Calculate golden ratio hue shift
 */
export const goldenHue = (baseHue: number): number => (baseHue + GOLDEN_ANGLE) % 360;

/**
 * Calculate fibonacci chroma boost
 */
export const fibonacciChroma = (baseChroma: number): number => baseChroma * PHI;

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

export const liquescent = {
  void: void_tokens,
  light: light_tokens,
  signal: signal_tokens,
  semantic: semantic_tokens,
  p3: p3_tokens,
} as const;

// =============================================================================
// LEGACY COMPATIBILITY LAYER
// =============================================================================

/**
 * Maps old Year3000 color names to new Liquescent tokens
 * Use for gradual migration
 */
export const legacyColorMap = {
  // Void backgrounds
  'void_backgrounds.abyss': void_tokens.abyss.hex,
  'void_backgrounds.deep': void_tokens.deep.hex,
  'void_backgrounds.cosmos': void_tokens.surface.hex,
  'void_backgrounds.nebula': void_tokens.surface.hex,
  'void_backgrounds.astral': void_tokens.film.hex,

  // Bioluminescent
  'bioluminescent.cyan.core': light_tokens.dormant.hex,
  'bioluminescent.amber.core': light_tokens.awakening.hex,
  'bioluminescent.green.core': light_tokens.liquescent.hex,
  'bioluminescent.crimson.core': semantic_tokens.error.hex,

  // Text
  'organic_text.primary.color': signal_tokens.primary.hex,
  'organic_text.secondary.color': signal_tokens.secondary.hex,
  'organic_text.muted.color': signal_tokens.tertiary.hex,
} as const;
