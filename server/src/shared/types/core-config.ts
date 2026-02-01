// @lifecycle canonical - Core configuration and protocol types extracted from src/types.ts.
/**
 * Core Config Types
 *
 * Contains configuration types, message types, and API/tool types
 * that are consumed across all architectural layers. Extracted from the
 * top-level src/types.ts to break the bilateral dependency between
 * src/types.ts ↔ shared/types/index.ts.
 *
 * IMPORTANT: This file must NOT import from ./index.js to avoid barrel cycles.
 */

// ===== Prompt Configuration =====
// Moved from modules/prompts/types.ts — consumed by Config interface.

/**
 * Configuration for the prompts subsystem
 */
export interface PromptsConfig {
  /** Path to the prompts directory */
  directory: string;
  /** Global default for MCP registration. Category/prompt overrides take precedence. */
  registerWithMcp?: boolean;
}

// ===== Configuration Types =====

/**
 * Configuration for the server
 */
export interface ServerConfig {
  /** Name of the server */
  name: string;
  /** Version string in semver format */
  version: string;
  /** Port number to listen on (1024-65535) */
  port: number;
}

/**
 * Transport mode options
 * - 'stdio': Standard I/O transport for Claude Desktop/CLI (default)
 * - 'sse': Server-sent events over HTTP for web clients (deprecated, use streamable-http)
 * - 'streamable-http': Streamable HTTP transport (MCP standard since 2025-03-26)
 * - 'both': Run both STDIO and SSE transports simultaneously
 */
export type TransportMode = 'stdio' | 'sse' | 'streamable-http' | 'both';

/**
 * LLM provider for semantic analysis
 */
export type LLMProvider = 'openai' | 'anthropic' | 'custom';

/**
 * LLM integration configuration
 */
export interface LLMIntegrationConfig {
  /** Whether LLM integration is enabled */
  enabled: boolean;
  /** API key for the LLM provider */
  apiKey: string | null;
  /** Custom endpoint URL for the LLM provider (provider auto-detected from URL) */
  endpoint: string | null;
  /** Model name to use */
  model: string;
  /** Maximum tokens for analysis requests */
  maxTokens: number;
  /** Temperature for analysis requests */
  temperature: number;
}

/**
 * Semantic analysis configuration
 */
export interface SemanticAnalysisConfig {
  /** LLM integration configuration */
  llmIntegration: LLMIntegrationConfig;
}

/**
 * Analysis system configuration
 */
export interface AnalysisConfig {
  /** Semantic analysis configuration */
  semanticAnalysis: SemanticAnalysisConfig;
}

/**
 * Logging system configuration
 */
export interface LoggingConfig {
  /** Directory to write log files to */
  directory: string;
  /** Log level: debug, info, warn, error */
  level: string;
}

/**
 * Tool descriptions configuration options
 */
export interface ToolDescriptionsOptions {
  /** Whether to restart server when tool descriptions change */
  restartOnChange?: boolean;
}

/**
 * Injection configuration for framework-driven content
 */
export interface FrameworkInjectionConfig {
  /** System prompt injection settings */
  systemPrompt?: {
    enabled: boolean;
    /** Inject every N steps (default: 2) */
    frequency?: number;
  };
  /** Style guidance injection (enabled/disabled only, injected per-step as needed) */
  styleGuidance?: boolean;
}

/**
 * Configuration toggles for framework-driven features
 */
export interface FrameworksConfig {
  /** Enable dynamic tool descriptions per methodology */
  dynamicToolDescriptions: boolean;
  /** Injection control for framework content */
  injection?: FrameworkInjectionConfig;
}

/**
 * Configuration for execution strategies
 */
export interface ExecutionConfig {
  /** Enable judge mode (LLM-driven step selection) */
  judge?: boolean;
}

/**
 * Complete application configuration
 */
export interface ChainSessionConfig {
  /** Minutes before idle chain sessions expire */
  sessionTimeoutMinutes: number;
  /** Minutes before pending gate reviews expire */
  reviewTimeoutMinutes: number;
  /** Minutes between background cleanup sweeps */
  cleanupIntervalMinutes: number;
}

/**
 * Unified gate system settings (shared-layer contract).
 * enabled is required (defaults applied by ConfigManager).
 */
export interface GateSystemSettings {
  /** Enable/disable the gate subsystem entirely */
  enabled: boolean;
  /** Directory containing gate definitions (e.g., 'gates' for server/gates/{id}/) */
  definitionsDirectory?: string;
  /** Enable methodology-specific gates (auto-added based on active framework) */
  enableMethodologyGates?: boolean;
}

/**
 * Configuration for gates subsystem (top-level config.json shape)
 */
export interface GatesConfig {
  /** Directory containing gate definitions (e.g., 'gates' for server/gates/{id}/) */
  definitionsDirectory?: string;
  /** New-style: directory path */
  directory?: string;
  /** Enable/disable the gate subsystem entirely */
  enabled?: boolean;
  /** Enable methodology-specific quality gates */
  enableMethodologyGates?: boolean;
  /** New-style: methodology gates */
  methodologyGates?: boolean;
}

/**
 * New-style methodologies configuration (replaces frameworks)
 */
export interface MethodologiesConfig {
  /** Enable methodology system */
  enabled?: boolean;
  /** Adapt MCP tool descriptions based on active methodology */
  dynamicToolDescriptions?: boolean;
  /** Inject methodology guidance every N chain steps */
  systemPromptFrequency?: number;
  /** Include response formatting guidance */
  styleGuidance?: boolean;
}

/**
 * Verification (Ralph Loops) configuration
 */
export interface VerificationConfig {
  /** Fix attempts within current context before spawning isolation */
  inContextAttempts?: number;
  /** Context isolation settings */
  isolation?: {
    enabled?: boolean;
    maxBudget?: number;
    timeout?: number;
    permissionMode?: 'delegate' | 'ask' | 'deny';
  };
}

/**
 * Advanced settings (internal/rarely-changed)
 */
export interface AdvancedConfig {
  sessions?: {
    timeoutMinutes?: number;
    reviewTimeoutMinutes?: number;
    cleanupIntervalMinutes?: number;
  };
}

/**
 * MCP Resources configuration
 */
export interface ResourcesConfig {
  /** Master switch: register resources with MCP (default: false) */
  registerWithMcp?: boolean;
  prompts?: { enabled?: boolean };
  gates?: { enabled?: boolean };
  methodologies?: { enabled?: boolean };
  observability?: {
    enabled?: boolean;
    sessions?: boolean;
    metrics?: boolean;
  };
  logs?: {
    enabled?: boolean;
    maxEntries?: number;
    defaultLevel?: 'error' | 'warn' | 'info' | 'debug';
  };
}

/**
 * Configuration for versioning behavior
 */
export interface VersioningConfig {
  /** Enable/disable version tracking globally */
  enabled: boolean;
  /** Maximum versions to retain per resource (FIFO pruning) */
  max_versions: number;
  /** Auto-save version on updates (can be overridden per-call) */
  auto_version: boolean;
}

/**
 * Default versioning configuration
 */
export const DEFAULT_VERSIONING_CONFIG: VersioningConfig = {
  enabled: true,
  max_versions: 50,
  auto_version: true,
};

export interface Config {
  /** Server configuration */
  server: ServerConfig;
  /** Prompts subsystem configuration */
  prompts: PromptsConfig;
  /** Analysis system configuration */
  analysis?: AnalysisConfig;
  /** Gates system configuration (quality validation) */
  gates?: GatesConfig;
  /** Execution strategy configuration (judge mode, etc.) */
  execution?: ExecutionConfig;
  /** Framework feature configuration (injection, tool descriptions) - LEGACY */
  frameworks?: FrameworksConfig;
  /** New-style: Methodology configuration */
  methodologies?: MethodologiesConfig;
  /** Chain session lifecycle configuration - LEGACY */
  chainSessions?: ChainSessionConfig;
  /**
   * Transport mode: 'stdio' (default), 'sse', or 'both'
   * STDIO is used by Claude Desktop/CLI, SSE for web clients
   */
  transport?: TransportMode;
  /** Logging configuration */
  logging?: LoggingConfig;
  /** Tool descriptions configuration */
  toolDescriptions?: ToolDescriptionsOptions;
  /** Version history configuration for resources */
  versioning?: VersioningConfig;
  /** New-style: Verification (Ralph Loops) configuration */
  verification?: VerificationConfig;
  /** New-style: Advanced internal settings */
  advanced?: AdvancedConfig;
  /** MCP Resources configuration */
  resources?: ResourcesConfig;
}

// ===== Message Types =====

/**
 * Base interface for message content
 */
export interface BaseMessageContent {
  /** Type discriminator for the content */
  type: string;
}

/**
 * Text message content
 */
export interface TextMessageContent extends BaseMessageContent {
  /** Type discriminator set to "text" */
  type: 'text';
  /** The text content */
  text: string;
}

/**
 * Types of message content supported by the system
 */
export type MessageContent = TextMessageContent;

/**
 * Role types for messages
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A message in a conversation
 */
export interface Message {
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: MessageContent;
}

// ===== Semantic Analysis Contract Type =====
// Moved from shared/types/index.ts to break barrel cycles.

/**
 * Semantic analysis result (cross-layer contract type).
 * The concrete ContentAnalyzer in modules/semantic/ produces this.
 */
export interface ContentAnalysisResult {
  executionType: 'single' | 'chain';
  requiresExecution: boolean;
  requiresFramework: boolean;
  confidence: number;
  reasoning: string[];
  capabilities: {
    canDetectStructure: boolean;
    canAnalyzeComplexity: boolean;
    canRecommendFramework: boolean;
    hasSemanticUnderstanding: boolean;
  };
  limitations: string[];
  warnings: string[];
  executionCharacteristics: {
    hasConditionals: boolean;
    hasLoops: boolean;
    hasChainSteps: boolean;
    argumentCount: number;
    templateComplexity: number;
    hasSystemMessage: boolean;
    hasUserTemplate: boolean;
    hasStructuredReasoning: boolean;
    hasMethodologyKeywords: boolean;
    hasComplexAnalysis: boolean;
    advancedChainFeatures?: {
      hasDependencies: boolean;
      hasParallelSteps: boolean;
      hasAdvancedStepTypes: boolean;
      hasAdvancedErrorHandling: boolean;
      hasStepConfigurations: boolean;
      hasCustomTimeouts: boolean;
      requiresAdvancedExecution: boolean;
      complexityScore: number;
    };
  };
  complexity: 'low' | 'medium' | 'high';
  suggestedGates: string[];
  frameworkRecommendation: {
    shouldUseFramework: boolean;
    reasoning: string[];
    confidence: number;
    requiresUserChoice?: boolean;
    availableFrameworks?: string[];
  };
  analysisMetadata: {
    version: string;
    /** Analysis mode - 'semantic' when LLM used, 'minimal' otherwise */
    mode?: 'semantic' | 'minimal';
    analysisTime: number;
    analyzer: 'content';
    cacheHit: boolean;
    fallbackUsed?: boolean;
    llmUsed?: boolean;
    hooksUsed?: boolean;
  };
}

// ===== Execution Plan Contract Types =====
// Moved from shared/types/index.ts to break barrel cycles.

/**
 * Execution strategy type enumeration (cross-layer contract type).
 */
export type ExecutionStrategyType = 'single' | 'chain';

/**
 * Execution modifier identifiers (cross-layer contract type).
 */
export type ExecutionModifier = 'clean' | 'judge' | 'lean' | 'framework';

/**
 * Execution modifiers control pipeline behavior (cross-layer contract type).
 * - clean: Skip all injection (system-prompt, gate-guidance, style-guidance)
 * - judge: Trigger judge selection phase for resource menu (%judge in command)
 * - lean: Skip system-prompt and style-guidance, keep gate-guidance only
 * - framework: Force framework methodology injection
 */
export interface ExecutionModifiers {
  clean?: boolean;
  /** Triggers judge selection phase. Use %judge in command. */
  judge?: boolean;
  lean?: boolean;
  framework?: boolean;
}

/**
 * Execution plan generated by the ExecutionPlanner (cross-layer contract type).
 * Contains strategy, gate configuration, and execution requirements.
 */
export interface ExecutionPlan {
  strategy: ExecutionStrategyType;
  gates: string[];
  requiresFramework: boolean;
  requiresSession: boolean;
  category?: string;
  modifiers?: ExecutionModifiers;
  /** Semantic analysis result from planning phase (for resource-driven guidance) */
  semanticAnalysis?: ContentAnalysisResult;
}
