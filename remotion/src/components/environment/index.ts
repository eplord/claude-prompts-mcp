/**
 * Liquescent Environment Components
 *
 * Atmospheric components that create the liquid world.
 */

// Depth Field - parallax and Ganzfeld effect
export {
  DepthField,
  AnimatedDepthField,
  type DepthFieldProps,
} from './DepthField';

// Viscous Medium - particle atmosphere
export {
  ViscousMedium,
  SwarmMedium,
  FogLayer,
  type ViscousMediumProps,
} from './ViscousMedium';

// Dissolution - boundary melting
export {
  DissolutionOverlay,
  AnimatedDissolution,
  EdgeDissolution,
  Vignette,
  type DissolutionOverlayProps,
} from './DissolutionOverlay';
