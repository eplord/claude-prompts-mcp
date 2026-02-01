// @lifecycle canonical - Module initialization helper for runtime startup.
/**
 * Initializes framework state, MCP tools, tool descriptions, and prompt registration.
 * Reuses existing managers without duplicating orchestration inside Application.
 */

import * as path from 'node:path';

import {
  initializeResourceChangeTracker,
  compareResourceBaseline,
} from './resource-change-tracking.js';
import {
  createFrameworkStateManager,
  FrameworkStateManager,
} from '../engine/frameworks/framework-state-manager.js';
import { createGateManager, GateManager } from '../engine/gates/gate-manager.js';
import { createMetricsCollector } from '../infra/observability/metrics/index.js';
import { ResourceChangeTracker } from '../infra/observability/tracking/index.js';
import { createMcpToolsManager, McpToolsManager } from '../mcp/tools/index.js';
import {
  createToolDescriptionManager,
  ToolDescriptionManager,
} from '../mcp/tools/tool-description-manager.js';
import { isChainPrompt } from '../shared/utils/chainUtils.js';

import type { PathResolver } from './paths.js';
import type { RuntimeLaunchOptions } from './options.js';
import type { ConvertedPrompt } from '../engine/execution/types.js';
import type { EventEmittingConfigManager } from '../infra/config/index.js';
import type { Logger } from '../infra/logging/index.js';
import type { PromptAssetManager } from '../modules/prompts/index.js';
import type { Category, PromptData } from '../modules/prompts/types.js';
import type { ConversationManager } from '../modules/text-refs/conversation.js';
import type { TextReferenceManager } from '../modules/text-refs/index.js';
import type {
  FrameworksConfig,
  IHookRegistry,
  IMcpNotificationEmitter,
} from '../shared/types/index.js';
import type { ServiceManager } from '../shared/utils/service-manager.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ModuleInitCallbacks {
  fullServerRefresh: () => Promise<void>;
  restartServer: (reason: string) => Promise<void>;
  handleFrameworkConfigChange: (config: FrameworksConfig, previous?: FrameworksConfig) => void;
}

export interface ModuleInitParams {
  logger: Logger;
  configManager: EventEmittingConfigManager;
  runtimeOptions: RuntimeLaunchOptions;
  promptsData: PromptData[];
  categories: Category[];
  convertedPrompts: ConvertedPrompt[];
  promptManager: PromptAssetManager;
  conversationManager: ConversationManager;
  textReferenceManager: TextReferenceManager;
  mcpServer: McpServer;
  serviceManager: ServiceManager;
  callbacks: ModuleInitCallbacks;
  /** Server root for runtime state directories */
  serverRoot?: string;
  /** Path resolver for workspace-derived resource overlays */
  pathResolver?: PathResolver;
  /** Hook registry for pipeline event emissions */
  hookRegistry?: IHookRegistry;
  /** Notification emitter for MCP client notifications */
  notificationEmitter?: IMcpNotificationEmitter;
}

export interface ModuleInitResult {
  frameworkStateManager: FrameworkStateManager;
  gateManager: GateManager;
  mcpToolsManager: McpToolsManager;
  toolDescriptionManager: ToolDescriptionManager;
  /** Resource change tracker for audit logging (undefined if serverRoot not provided) */
  resourceChangeTracker?: ResourceChangeTracker;
}

export async function initializeModules(params: ModuleInitParams): Promise<ModuleInitResult> {
  const {
    logger,
    configManager,
    runtimeOptions,
    promptsData,
    categories,
    convertedPrompts,
    promptManager,
    conversationManager,
    textReferenceManager,
    mcpServer,
    serviceManager,
    callbacks,
    serverRoot,
    pathResolver,
    hookRegistry,
    notificationEmitter,
  } = params;

  const isVerbose = runtimeOptions.verbose;

  // Initialize Resource Change Tracker early (for audit logging)
  let resourceChangeTracker: ResourceChangeTracker | undefined;
  if (serverRoot !== undefined && serverRoot !== '') {
    if (isVerbose) logger.info('🔄 Initializing Resource Change Tracker...');
    try {
      resourceChangeTracker = await initializeResourceChangeTracker(logger, serverRoot);
      // Compare baseline to detect external changes
      const baselineResult = await compareResourceBaseline(
        resourceChangeTracker,
        configManager,
        logger
      );
      if (isVerbose) {
        const { added, modified, removed } = baselineResult;
        if (added > 0 || modified > 0 || removed > 0) {
          logger.info(
            `📊 External changes detected: ${added} added, ${modified} modified, ${removed} removed`
          );
        } else {
          logger.info('✅ ResourceChangeTracker initialized (no external changes detected)');
        }
      }
    } catch (error) {
      logger.warn('Failed to initialize ResourceChangeTracker:', error);
    }
  }

  if (isVerbose) logger.info('🔄 Initializing Framework State Manager...');
  const frameworkStateRoot =
    typeof configManager.getServerRoot === 'function'
      ? configManager.getServerRoot()
      : path.dirname(configManager.getConfigPath());
  const frameworkStateManager = await createFrameworkStateManager(logger, frameworkStateRoot);
  if (isVerbose) logger.info('✅ FrameworkStateManager initialized successfully');

  const currentFrameworkConfig = configManager.getFrameworksConfig();
  callbacks.handleFrameworkConfigChange(currentFrameworkConfig);

  // Initialize Gate Manager (Phase 4 - registry-based gate system)
  if (isVerbose) logger.info('🔄 Initializing Gate Manager...');
  const additionalGatesDirs = pathResolver?.getOverlayResourceDirs('gates') ?? [];
  const gateManager = await createGateManager(
    logger,
    additionalGatesDirs.length > 0
      ? { registryConfig: { loaderConfig: { additionalGatesDirs } } }
      : undefined
  );
  if (isVerbose) {
    const stats = gateManager.getStats();
    logger.info(`✅ GateManager initialized with ${stats.totalGates} gates`);
    if (additionalGatesDirs.length > 0) {
      logger.info(`  📂 Additional gate directories: ${additionalGatesDirs.join(', ')}`);
    }
  }

  const chainCount = convertedPrompts.filter((p) => isChainPrompt(p)).length;
  if (isVerbose) {
    logger.info(
      `🔗 Chain prompts available: ${chainCount}/${convertedPrompts.length} total prompts`
    );
  }

  if (isVerbose) logger.info('🔄 Initializing MCP tools manager...');
  const metricsCollector = createMetricsCollector(logger);
  const mcpToolsManager = await createMcpToolsManager(
    logger,
    mcpServer,
    promptManager,
    configManager,
    conversationManager,
    textReferenceManager,
    serviceManager,
    callbacks.fullServerRefresh,
    callbacks.restartServer,
    gateManager,
    metricsCollector
  );

  if (isVerbose) logger.info('🔄 Updating MCP tools manager data...');
  mcpToolsManager.updateData(promptsData, convertedPrompts, categories);

  if (isVerbose) logger.info('🔄 Connecting Framework State Manager...');
  mcpToolsManager.setFrameworkStateManager(frameworkStateManager);

  if (isVerbose) logger.info('🔄 Initializing Framework Manager...');
  await mcpToolsManager.setFrameworkManager();

  if (isVerbose) logger.info('🔄 Initializing Tool Description Manager...');
  const toolDescriptionManager = createToolDescriptionManager(logger, configManager);
  toolDescriptionManager.setFrameworkStateManager(frameworkStateManager);
  await toolDescriptionManager.initialize();

  if (isVerbose) logger.info('🔄 Connecting Tool Description Manager to MCP Tools...');
  mcpToolsManager.setToolDescriptionManager(toolDescriptionManager);

  // Wire up hook registry and notification emitter for pipeline events
  if (hookRegistry) {
    mcpToolsManager.setHookRegistry(hookRegistry);
  }
  if (notificationEmitter) {
    mcpToolsManager.setNotificationEmitter(notificationEmitter);
  }

  if (isVerbose) logger.info('🔄 Registering all MCP tools...');
  await mcpToolsManager.registerAllTools();

  return {
    frameworkStateManager,
    gateManager,
    mcpToolsManager,
    toolDescriptionManager,
    resourceChangeTracker,
  };
}
