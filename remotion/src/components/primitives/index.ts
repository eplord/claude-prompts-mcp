/**
 * Liquescent Primitive Components
 *
 * Atomic building blocks for the Liquescent design system.
 */

// Membrane - living glass container
export {
  LiquescentMembrane,
  DormantMembrane,
  AwakeningMembrane,
  LiquescentStateMembrane,
  type LiquescentMembraneProps,
} from './LiquescentMembrane';

// Text - coalescing fragments
export {
  CoalesceText,
  CoalesceWords,
  type CoalesceTextProps,
} from './CoalesceText';

// Nucleus - shape morphing state indicator
export {
  StateNucleus,
  AnimatedStateNucleus,
  type StateNucleusProps,
} from './StateNucleus';

// Ripple - impact visualization
export {
  RippleCascade,
  TriggeredRipple,
  ImpactRipple,
  ContinuousPulse,
  type RippleCascadeProps,
} from './RippleCascade';

// Channel - flowing connections
export {
  FluidChannel,
  MultiChannel,
  type FluidChannelProps,
  type Point,
} from './FluidChannel';
