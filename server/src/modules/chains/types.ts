// @lifecycle canonical - Type definitions for chain sessions.
// Types relocated to shared/types/chain-session.ts for cross-layer access.
// This barrel re-exports from shared/ for backward compatibility.

export {
  StepState,
  type ChainSession,
  type ChainSessionLifecycle,
  type ChainSessionLookupOptions,
  type ChainSessionService,
  type ChainSessionSummary,
  type GateReviewOutcomeUpdate,
  type ParsedCommandSnapshot,
  type PersistedChainRunRegistry,
  type SessionBlueprint,
} from '../../shared/types/chain-session.js';
