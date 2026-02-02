// @lifecycle canonical - Exports canonical YAML resources to client-native skill packages.
/**
 * Skills Sync CLI
 *
 * Compiler-style tool: server/resources/**\/*.yaml → client skill packages.
 * Two adapter paths: ClaudeCodeAdapter + AgentSkillsAdapter (cursor/codex/opencode variants).
 *
 * Usage: tsx scripts/skills-sync.ts export|diff|pull [options]
 */
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { createTwoFilesPatch } from 'diff';

// ─── Constants ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const RESOURCES_DIR = path.join(SERVER_ROOT, 'resources');
const CONFIG_PATH = path.join(SERVER_ROOT, 'skills-sync.yaml');
const CACHE_DIR = path.join(SERVER_ROOT, 'cache');

// ─── Section 1: Types ──────────────────────────────────────────────────────

type ResourceType = 'prompt' | 'gate' | 'methodology' | 'style';

interface IRArgument {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface IRChainStep {
  promptId: string;
  stepName: string;
}

interface IRScriptTool {
  id: string;
  name: string;
  runtime: string;
  scriptContent: string;
}

interface SkillIR {
  id: string;
  name: string;
  description: string;
  resourceType: ResourceType;
  category: string | null;
  enabled: boolean;

  systemMessage: string | null;
  userMessage: string | null;
  guidanceContent: string | null;

  arguments: IRArgument[];
  chainSteps: IRChainStep[];
  scriptTools: IRScriptTool[];

  gateData: { type: string; passCriteria: unknown[]; activation?: unknown } | null;
  methodologyData: {
    type: string;
    version: string;
    systemPromptGuidance: string;
    phases: unknown[];
  } | null;
  styleData: {
    priority: number;
    enhancementMode: string;
    compatibleFrameworks?: string[];
  } | null;

  extensions: Record<string, unknown>;
  sourcePaths: string[];
  sourceHash: string;
}

interface ClientCapabilities {
  scripts: boolean;
  references: boolean;
  assets: boolean;
}

interface ClientConfig {
  adapter: 'claude-code' | 'agent-skills';
  variant?: string;
  outputDir: { user: string; project: string };
  capabilities: ClientCapabilities;
  extensions?: Record<string, unknown>;
}

interface SyncConfig {
  exports?: string[] | 'all';
  overrides?: Record<string, { outputDir?: { user?: string; project?: string } }>;
}

/** Built-in defaults shared across adapters. */
const SYNC_DEFAULTS = { license: 'MIT', adapterVersion: '1.0.0' } as const;

/**
 * Hardcoded client registry — the CLI knows everything about each client.
 * Users configure WHAT to export; the CLI handles HOW.
 */
const CLIENT_REGISTRY: Record<string, ClientConfig> = {
  'claude-code': {
    adapter: 'claude-code',
    outputDir: { user: '~/.claude/skills', project: '.claude/skills' },
    capabilities: { scripts: true, references: true, assets: false },
  },
  cursor: {
    adapter: 'agent-skills',
    variant: 'cursor',
    outputDir: { user: '~/.cursor/skills', project: '.cursor/skills' },
    capabilities: { scripts: true, references: true, assets: true },
    extensions: { alwaysApply: false },
  },
  codex: {
    adapter: 'agent-skills',
    variant: 'codex',
    outputDir: { user: '~/.codex/skills', project: 'agents' },
    capabilities: { scripts: true, references: true, assets: true },
  },
  opencode: {
    adapter: 'agent-skills',
    variant: 'opencode',
    outputDir: { user: '~/.opencode/skills', project: '.opencode/skills' },
    capabilities: { scripts: false, references: false, assets: false },
  },
};

interface OutputFile {
  relativePath: string;
  content: string;
}

interface SyncManifestEntry {
  resourceId: string;
  resourceType: ResourceType;
  sourceHash: string;
  outputHash: string;
  outputFiles: string[];
  exportedAt: string;
}

interface SyncManifest {
  version: '1.0';
  client: string;
  generatedAt: string;
  configHash: string;
  entries: Record<string, SyncManifestEntry>;
}

interface CLIOptions {
  command: string;
  client?: string;
  scope?: 'user' | 'project';
  resourceType?: ResourceType;
  id?: string;
  dryRun?: boolean;
  force?: boolean;
  output?: string;
}

// ─── Section 2: Config Loader ───────────────────────────────────────────────

async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return (yaml.load(raw) as SyncConfig | null) ?? {};
  } catch {
    const example = CONFIG_PATH.replace('skills-sync.yaml', 'skills-sync.example.yaml');
    console.error(`No skills-sync.yaml found. Copy the example to get started:`);
    console.error(`  cp ${example} ${CONFIG_PATH}`);
    process.exit(1);
  }
}

/** Resolve a client config from the hardcoded registry, applying user overrides. */
function resolveClientConfig(clientId: string, config: SyncConfig): ClientConfig | null {
  const base = CLIENT_REGISTRY[clientId];
  if (!base) return null;

  const overrides = config.overrides?.[clientId];
  if (!overrides?.outputDir) return base;

  return {
    ...base,
    outputDir: {
      user: overrides.outputDir.user ?? base.outputDir.user,
      project: overrides.outputDir.project ?? base.outputDir.project,
    },
  };
}

function resolveOutputDir(clientConfig: ClientConfig, scope: 'user' | 'project'): string {
  const dir = clientConfig.outputDir[scope];
  if (dir.startsWith('~')) {
    return path.join(process.env.HOME ?? '', dir.slice(1));
  }
  return path.resolve(dir);
}

// ─── Section 3: Resource Loaders ────────────────────────────────────────────

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function computeHash(contents: string[]): string {
  const h = createHash('sha256');
  for (const c of contents.sort()) h.update(c);
  return h.digest('hex');
}

async function loadPromptIR(promptDir: string, category: string): Promise<SkillIR> {
  const yamlPath = path.join(promptDir, 'prompt.yaml');
  const raw = await readFile(yamlPath, 'utf-8');
  const data = yaml.load(raw) as Record<string, unknown>;

  const sysMsg = await readOptionalFile(path.join(promptDir, 'system-message.md'));
  const userMsgFile = (data.userMessageTemplateFile as string) ?? 'user-message.md';
  const userMsg = await readOptionalFile(path.join(promptDir, userMsgFile));

  // Load tool scripts
  const scriptTools: IRScriptTool[] = [];
  const toolIds = (data.tools as string[]) ?? [];
  for (const toolId of toolIds) {
    const toolDir = path.join(promptDir, 'tools', toolId);
    const toolYamlPath = path.join(toolDir, 'tool.yaml');
    const toolRaw = await readOptionalFile(toolYamlPath);
    if (!toolRaw) continue;

    const toolData = yaml.load(toolRaw) as Record<string, unknown>;
    const scriptFile = (toolData.script as string) ?? '';
    const scriptContent = await readOptionalFile(path.join(toolDir, scriptFile));

    scriptTools.push({
      id: toolId,
      name: (toolData.name as string) ?? toolId,
      runtime: (toolData.runtime as string) ?? 'unknown',
      scriptContent: scriptContent ?? '',
    });
  }

  // Load chain steps
  const chainSteps: IRChainStep[] = [];
  const rawSteps = data.chain_steps as Array<{ step_id?: string; name?: string }> | undefined;
  if (rawSteps) {
    for (const s of rawSteps) {
      chainSteps.push({
        promptId: (s.step_id as string) ?? '',
        stepName: (s.name as string) ?? '',
      });
    }
  }

  const args = ((data.arguments as Array<Record<string, unknown>>) ?? []).map((a) => ({
    name: a.name as string,
    type: a.type as string,
    description: a.description as string,
    required: (a.required as boolean) ?? false,
  }));

  const sourceContents = [raw, sysMsg ?? '', userMsg ?? ''];
  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string,
    resourceType: 'prompt',
    category,
    enabled: true,
    systemMessage: sysMsg,
    userMessage: userMsg,
    guidanceContent: null,
    arguments: args,
    chainSteps,
    scriptTools,
    gateData: null,
    methodologyData: null,
    styleData: null,
    extensions: {},
    sourcePaths: [yamlPath],
    sourceHash: computeHash(sourceContents),
  };
}

async function loadGateIR(gateDir: string): Promise<SkillIR> {
  const yamlPath = path.join(gateDir, 'gate.yaml');
  const raw = await readFile(yamlPath, 'utf-8');
  const data = yaml.load(raw) as Record<string, unknown>;

  const guidanceFile = (data.guidanceFile as string) ?? 'guidance.md';
  const guidance = await readOptionalFile(path.join(gateDir, guidanceFile));

  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string,
    resourceType: 'gate',
    category: null,
    enabled: (data.enabled as boolean) ?? true,
    systemMessage: null,
    userMessage: null,
    guidanceContent: guidance,
    arguments: [],
    chainSteps: [],
    scriptTools: [],
    gateData: {
      type: (data.type as string) ?? 'validation',
      passCriteria: (data.pass_criteria as unknown[]) ?? [],
      activation: data.activation,
    },
    methodologyData: null,
    styleData: null,
    extensions: { retryConfig: data.retry_config },
    sourcePaths: [yamlPath],
    sourceHash: computeHash([raw, guidance ?? '']),
  };
}

async function loadMethodologyIR(methDir: string): Promise<SkillIR> {
  const yamlPath = path.join(methDir, 'methodology.yaml');
  const raw = await readFile(yamlPath, 'utf-8');
  const data = yaml.load(raw) as Record<string, unknown>;

  const phasesFile = (data.phasesFile as string) ?? 'phases.yaml';
  const phasesRaw = await readOptionalFile(path.join(methDir, phasesFile));
  const phases = phasesRaw ? (yaml.load(phasesRaw) as unknown[]) : [];

  const sysPromptFile = data.systemPromptFile as string | undefined;
  const sysPromptContent = sysPromptFile
    ? await readOptionalFile(path.join(methDir, sysPromptFile))
    : null;

  const guidance = (data.systemPromptGuidance as string) ?? sysPromptContent ?? '';

  return {
    id: data.id as string,
    name: data.name as string,
    description: `${data.name} methodology (${data.type})`,
    resourceType: 'methodology',
    category: null,
    enabled: (data.enabled as boolean) ?? true,
    systemMessage: null,
    userMessage: null,
    guidanceContent: guidance,
    arguments: [],
    chainSteps: [],
    scriptTools: [],
    gateData: null,
    methodologyData: {
      type: (data.type as string) ?? '',
      version: (data.version as string) ?? '1.0.0',
      systemPromptGuidance: guidance,
      phases,
    },
    styleData: null,
    extensions: {
      gates: data.gates,
      methodologyGates: data.methodologyGates,
    },
    sourcePaths: [yamlPath],
    sourceHash: computeHash([raw, phasesRaw ?? '', guidance]),
  };
}

async function loadStyleIR(styleDir: string): Promise<SkillIR> {
  const yamlPath = path.join(styleDir, 'style.yaml');
  const raw = await readFile(yamlPath, 'utf-8');
  const data = yaml.load(raw) as Record<string, unknown>;

  const guidanceFile = (data.guidanceFile as string) ?? 'guidance.md';
  const guidance = await readOptionalFile(path.join(styleDir, guidanceFile));

  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string,
    resourceType: 'style',
    category: null,
    enabled: (data.enabled as boolean) ?? true,
    systemMessage: null,
    userMessage: null,
    guidanceContent: guidance,
    arguments: [],
    chainSteps: [],
    scriptTools: [],
    gateData: null,
    methodologyData: null,
    styleData: {
      priority: (data.priority as number) ?? 0,
      enhancementMode: (data.enhancementMode as string) ?? 'prepend',
      compatibleFrameworks: data.compatibleFrameworks as string[] | undefined,
    },
    extensions: { activation: data.activation },
    sourcePaths: [yamlPath],
    sourceHash: computeHash([raw, guidance ?? '']),
  };
}

interface LoadFilters {
  resourceType?: ResourceType;
  id?: string;
  exportAllowList?: Set<string>;
}

async function loadAllResources(filters?: LoadFilters): Promise<SkillIR[]> {
  const resources: SkillIR[] = [];

  // Prompts: resources/prompts/{category}/{id}/prompt.yaml
  if (!filters?.resourceType || filters.resourceType === 'prompt') {
    const promptsBase = path.join(RESOURCES_DIR, 'prompts');
    try {
      const categories = await readdir(promptsBase, { withFileTypes: true });
      for (const cat of categories) {
        if (!cat.isDirectory()) continue;
        const catDir = path.join(promptsBase, cat.name);
        const promptDirs = await readdir(catDir, { withFileTypes: true });
        for (const pd of promptDirs) {
          if (!pd.isDirectory()) continue;
          if (filters?.id && pd.name !== filters.id) continue;
          try {
            resources.push(await loadPromptIR(path.join(catDir, pd.name), cat.name));
          } catch (e) {
            console.error(`  skip prompt ${cat.name}/${pd.name}: ${(e as Error).message}`);
          }
        }
      }
    } catch {
      /* no prompts dir */
    }
  }

  // Gates: resources/gates/{id}/gate.yaml
  if (!filters?.resourceType || filters.resourceType === 'gate') {
    const gatesBase = path.join(RESOURCES_DIR, 'gates');
    try {
      const gateDirs = await readdir(gatesBase, { withFileTypes: true });
      for (const gd of gateDirs) {
        if (!gd.isDirectory()) continue;
        if (filters?.id && gd.name !== filters.id) continue;
        try {
          resources.push(await loadGateIR(path.join(gatesBase, gd.name)));
        } catch (e) {
          console.error(`  skip gate ${gd.name}: ${(e as Error).message}`);
        }
      }
    } catch {
      /* no gates dir */
    }
  }

  // Methodologies: resources/methodologies/{id}/methodology.yaml
  if (!filters?.resourceType || filters.resourceType === 'methodology') {
    const methBase = path.join(RESOURCES_DIR, 'methodologies');
    try {
      const methDirs = await readdir(methBase, { withFileTypes: true });
      for (const md of methDirs) {
        if (!md.isDirectory()) continue;
        if (filters?.id && md.name !== filters.id) continue;
        try {
          resources.push(await loadMethodologyIR(path.join(methBase, md.name)));
        } catch (e) {
          console.error(`  skip methodology ${md.name}: ${(e as Error).message}`);
        }
      }
    } catch {
      /* no methodologies dir */
    }
  }

  // Styles: resources/styles/{id}/style.yaml
  if (!filters?.resourceType || filters.resourceType === 'style') {
    const stylesBase = path.join(RESOURCES_DIR, 'styles');
    try {
      const styleDirs = await readdir(stylesBase, { withFileTypes: true });
      for (const sd of styleDirs) {
        if (!sd.isDirectory()) continue;
        if (filters?.id && sd.name !== filters.id) continue;
        try {
          resources.push(await loadStyleIR(path.join(stylesBase, sd.name)));
        } catch (e) {
          console.error(`  skip style ${sd.name}: ${(e as Error).message}`);
        }
      }
    } catch {
      /* no styles dir */
    }
  }

  // Filter disabled resources
  const enabled = resources.filter((r) => {
    if (!r.enabled) {
      console.log(`  skip disabled: ${r.resourceType}/${r.id}`);
    }
    return r.enabled;
  });

  // Filter by export allow-list (if provided)
  if (filters?.exportAllowList) {
    const allowed = filters.exportAllowList;
    const filtered = enabled.filter((r) => allowed.has(manifestKey(r)));
    const skipped = enabled.length - filtered.length;
    if (skipped > 0) {
      console.log(`  ${skipped} resource(s) not in exports allow-list (skipped)`);
    }
    return filtered;
  }

  return enabled;
}

/** Qualified manifest key: prevents collisions across categories and resource types. */
function manifestKey(ir: SkillIR): string {
  if (ir.resourceType === 'prompt' && ir.category) {
    return `prompt:${ir.category}/${ir.id}`;
  }
  return `${ir.resourceType}:${ir.id}`;
}

// ─── Template Compiler ──────────────────────────────────────────────────────

/**
 * Compiles Nunjucks templates to Claude Code skill syntax.
 * - {{argName}} → $N (positional based on argument order)
 * - {% if argName %}content{% endif %} → content (with $N substitutions)
 * - {% else %}content{% endif %} → removed (optional fallback not supported)
 */
function compileTemplate(template: string, args: IRArgument[]): string {
  const argIndex = new Map(args.map((a, i) => [a.name, i]));
  let result = template;

  // Replace {% if argName %}...{% endif %} blocks (keep inner content, substitute vars)
  // Handle {% if %}...{% else %}...{% endif %} — keep the if-branch, drop else-branch
  result = result.replace(
    /\{%-?\s*if\s+(\w+)\s*-?%\}([\s\S]*?)(?:\{%-?\s*else\s*-?%\}[\s\S]*?)?\{%-?\s*endif\s*-?%\}/g,
    (_match, _varName: string, ifContent: string) => {
      return ifContent.trim();
    }
  );

  // Replace {{argName}} and {{ argName }} with $N
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, varName: string) => {
    const idx = argIndex.get(varName);
    if (idx !== undefined) return `$${idx}`;
    return `$ARGUMENTS`; // fallback for unknown vars
  });

  return result;
}

/**
 * Compiles Nunjucks templates to plain text for Agent Skills (no template syntax).
 * - {{argName}} → {argName} (readable placeholder)
 * - {% if argName %}content{% endif %} → content (always included)
 */
function compileTemplateToPlaintext(template: string, _args: IRArgument[]): string {
  let result = template;

  // Strip {% if %}...{% else %}...{% endif %} — keep if-branch
  result = result.replace(
    /\{%-?\s*if\s+(\w+)\s*-?%\}([\s\S]*?)(?:\{%-?\s*else\s*-?%\}[\s\S]*?)?\{%-?\s*endif\s*-?%\}/g,
    (_match, _varName: string, ifContent: string) => ifContent.trim()
  );

  // Replace {{argName}} with readable {argName}
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, varName: string) => `{${varName}}`);

  return result;
}

/** Output subdirectory for a resource. Flat structure — clients expect one level. */
function outputSubDir(ir: SkillIR, duplicateIds?: Set<string>): string {
  if (ir.resourceType === 'prompt') {
    // Prefix with category only when IDs collide across categories
    if (duplicateIds?.has(ir.id) && ir.category) {
      return `${ir.category}-${ir.id}`;
    }
    return ir.id;
  }
  const plural = ir.resourceType === 'methodology' ? 'methodologies' : ir.resourceType + 's';
  return `${plural}-${ir.id}`;
}

/** Build argument-hint string from arguments list. */
function buildArgumentHint(args: IRArgument[]): string {
  return args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ');
}

// ─── Section 4: Claude Code Adapter ─────────────────────────────────────────

function buildClaudeCodeSkill(ir: SkillIR, duplicateIds?: Set<string>): OutputFile[] {
  const files: OutputFile[] = [];
  const subDir = outputSubDir(ir, duplicateIds);

  // Frontmatter
  const fm: Record<string, unknown> = { name: ir.name, description: ir.description };
  if (ir.scriptTools.length > 0) fm.tools = ir.scriptTools.map((t) => t.name);
  if (ir.arguments.length > 0) fm['argument-hint'] = buildArgumentHint(ir.arguments);

  let body = `---\n${yaml.dump(fm, { lineWidth: 120 }).trim()}\n---\n\n`;

  // Instructions section
  if (ir.systemMessage) {
    body += `## Instructions\n\n${compileTemplate(ir.systemMessage.trim(), ir.arguments)}\n\n`;
  }
  if (ir.guidanceContent) {
    body += `## Guidance\n\n${compileTemplate(ir.guidanceContent.trim(), ir.arguments)}\n\n`;
  }

  // Arguments reference
  if (ir.arguments.length > 0) {
    body += `## Arguments\n\n`;
    for (const [i, a] of ir.arguments.entries()) {
      body += `- \`$${i}\` — **${a.name}**${a.required ? ' (required)' : ''}: ${a.description}\n`;
    }
    body += '\n';
  }

  // Usage / user message template (compiled)
  if (ir.userMessage) {
    body += `## Usage\n\n${compileTemplate(ir.userMessage.trim(), ir.arguments)}\n`;
  }

  // Gate-specific: pass criteria checklist
  if (ir.gateData) {
    body += `## Pass Criteria\n\n`;
    for (const c of ir.gateData.passCriteria) {
      const criterion = c as Record<string, unknown>;
      body += `- [${criterion.type}] ${JSON.stringify(criterion)}\n`;
    }
    body += '\n';
  }

  // Methodology-specific: phase summary
  if (ir.methodologyData && Array.isArray(ir.methodologyData.phases)) {
    body += `## Phases\n\n`;
    const phases = ir.methodologyData.phases as Array<Record<string, unknown>>;
    for (const phase of phases) {
      const pName = (phase.name as string) ?? (phase.id as string) ?? 'Phase';
      body += `### ${pName}\n\n${(phase.description as string) ?? ''}\n\n`;
    }
  }

  // Style-specific: activation info
  if (ir.styleData) {
    body += `## Style Configuration\n\n`;
    body += `- **Priority**: ${ir.styleData.priority}\n`;
    body += `- **Enhancement Mode**: ${ir.styleData.enhancementMode}\n`;
    if (ir.styleData.compatibleFrameworks) {
      body += `- **Compatible Frameworks**: ${ir.styleData.compatibleFrameworks.join(', ')}\n`;
    }
    body += '\n';
  }

  files.push({ relativePath: `${subDir}/SKILL.md`, content: body });

  // Script files
  for (const tool of ir.scriptTools) {
    if (tool.scriptContent) {
      const ext = tool.runtime === 'python' ? '.py' : tool.runtime === 'node' ? '.js' : '';
      files.push({
        relativePath: `${subDir}/scripts/${tool.id}${ext}`,
        content: tool.scriptContent,
      });
    }
  }

  return files;
}

// ─── Section 5: Agent Skills Adapter ────────────────────────────────────────

function buildAgentSkillsSkill(
  ir: SkillIR,
  config: ClientConfig,
  duplicateIds?: Set<string>
): OutputFile[] {
  const files: OutputFile[] = [];
  const subDir = outputSubDir(ir, duplicateIds);
  const variant = config.variant ?? 'codex';

  // Core Agent Skills frontmatter
  const fm: Record<string, unknown> = {
    name: ir.name,
    description: ir.description,
    license: SYNC_DEFAULTS.license,
    compatibility: { 'agent-skills': SYNC_DEFAULTS.adapterVersion },
  };

  // Metadata
  const metadata: Record<string, unknown> = {
    'resource-type': ir.resourceType,
    'source-hash': ir.sourceHash,
  };
  if (ir.category) metadata.category = ir.category;
  fm.metadata = metadata;

  // Allowed tools
  if (ir.scriptTools.length > 0) {
    fm['allowed-tools'] = ir.scriptTools.map((t) => t.id);
  }

  // Variant-specific extensions
  if (variant === 'cursor') {
    fm.alwaysApply = config.extensions?.alwaysApply ?? false;
    if (ir.category) fm.category = ir.category;
  }
  // OpenCode: strict subset — only name, description, license, compatibility, metadata
  if (variant === 'opencode') {
    delete fm['allowed-tools'];
  }

  let body = `---\n${yaml.dump(fm, { lineWidth: 120 }).trim()}\n---\n\n`;

  // Body content (compiled to plain markdown — Agent Skills has no template syntax)
  if (ir.systemMessage) {
    body += `## Instructions\n\n${compileTemplateToPlaintext(ir.systemMessage.trim(), ir.arguments)}\n\n`;
  }
  if (ir.guidanceContent) {
    body += `## Guidance\n\n${compileTemplateToPlaintext(ir.guidanceContent.trim(), ir.arguments)}\n\n`;
  }

  // Arguments (descriptive — no positional syntax in Agent Skills)
  if (ir.arguments.length > 0) {
    body += `## Arguments\n\n`;
    for (const a of ir.arguments) {
      body += `- **${a.name}**${a.required ? ' (required)' : ''}: ${a.description}\n`;
    }
    body += '\n';
  }

  if (ir.userMessage) {
    body += `## Usage\n\n${compileTemplateToPlaintext(ir.userMessage.trim(), ir.arguments)}\n`;
  }

  // Gate pass criteria
  if (ir.gateData) {
    body += `## Pass Criteria\n\n`;
    for (const c of ir.gateData.passCriteria) {
      const criterion = c as Record<string, unknown>;
      body += `- [${criterion.type}] ${JSON.stringify(criterion)}\n`;
    }
    body += '\n';
  }

  // Methodology phases
  if (ir.methodologyData && Array.isArray(ir.methodologyData.phases)) {
    body += `## Phases\n\n`;
    const phases = ir.methodologyData.phases as Array<Record<string, unknown>>;
    for (const phase of phases) {
      const pName = (phase.name as string) ?? (phase.id as string) ?? 'Phase';
      body += `### ${pName}\n\n${(phase.description as string) ?? ''}\n\n`;
    }
  }

  // Style config
  if (ir.styleData) {
    body += `## Style Configuration\n\n`;
    body += `- **Priority**: ${ir.styleData.priority}\n`;
    body += `- **Enhancement Mode**: ${ir.styleData.enhancementMode}\n`;
    if (ir.styleData.compatibleFrameworks) {
      body += `- **Compatible Frameworks**: ${ir.styleData.compatibleFrameworks.join(', ')}\n`;
    }
    body += '\n';
  }

  files.push({ relativePath: `${subDir}/SKILL.md`, content: body });

  // Scripts (if client supports)
  if (config.capabilities.scripts) {
    for (const tool of ir.scriptTools) {
      if (tool.scriptContent) {
        const ext = tool.runtime === 'python' ? '.py' : tool.runtime === 'node' ? '.js' : '';
        files.push({
          relativePath: `${subDir}/scripts/${tool.id}${ext}`,
          content: tool.scriptContent,
        });
      }
    }
  }

  // References (if client supports)
  if (config.capabilities.references) {
    if (ir.methodologyData?.systemPromptGuidance) {
      files.push({
        relativePath: `${subDir}/references/system-prompt.md`,
        content: ir.methodologyData.systemPromptGuidance,
      });
    }
    if (ir.methodologyData?.phases && ir.methodologyData.phases.length > 0) {
      files.push({
        relativePath: `${subDir}/references/phases.md`,
        content: `# Phases\n\n${yaml.dump(ir.methodologyData.phases, { lineWidth: 120 })}`,
      });
    }
  }

  return files;
}

// ─── Section 6: Adapter Dispatch ────────────────────────────────────────────

function adaptResource(
  ir: SkillIR,
  clientConfig: ClientConfig,
  duplicateIds?: Set<string>
): OutputFile[] {
  if (clientConfig.adapter === 'claude-code') {
    return buildClaudeCodeSkill(ir, duplicateIds);
  }
  return buildAgentSkillsSkill(ir, clientConfig, duplicateIds);
}

// ─── Section 7: Manifest Operations ─────────────────────────────────────────

function manifestPath(clientId: string): string {
  return path.join(CACHE_DIR, `skills-sync.${clientId}.json`);
}

async function loadManifest(clientId: string): Promise<SyncManifest | null> {
  try {
    const raw = await readFile(manifestPath(clientId), 'utf-8');
    return JSON.parse(raw) as SyncManifest;
  } catch {
    return null;
  }
}

async function saveManifest(clientId: string, manifest: SyncManifest): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(manifestPath(clientId), JSON.stringify(manifest, null, 2) + '\n');
}

function hashOutputFiles(files: OutputFile[]): string {
  return computeHash(files.map((f) => f.content));
}

// ─── Section 8: Export Command ──────────────────────────────────────────────

async function exportCommand(opts: CLIOptions): Promise<void> {
  const config = await loadSyncConfig();
  const scope = opts.scope ?? 'user';
  const clientIds =
    opts.client === 'all' || !opts.client ? Object.keys(CLIENT_REGISTRY) : [opts.client];

  const filters: LoadFilters = {};
  if (opts.resourceType) filters.resourceType = opts.resourceType;
  if (opts.id) filters.id = opts.id;

  // Build export allow-list from config (unless CLI --id overrides)
  if (!opts.id && Array.isArray(config.exports)) {
    filters.exportAllowList = new Set(config.exports);
  }

  const resources = await loadAllResources(filters);
  console.log(`Loaded ${resources.length} resources`);

  // Detect duplicate prompt IDs across categories
  const idCounts = new Map<string, number>();
  for (const r of resources) {
    if (r.resourceType === 'prompt') {
      idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);
    }
  }
  const duplicateIds = new Set([...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  if (duplicateIds.size > 0) {
    console.log(
      `  note: ${duplicateIds.size} duplicate prompt ID(s) will be category-prefixed: ${[...duplicateIds].join(', ')}`
    );
  }

  const configRaw = await readFile(CONFIG_PATH, 'utf-8');
  const configHash = computeHash([configRaw]);

  for (const clientId of clientIds) {
    const clientConfig = resolveClientConfig(clientId, config);
    if (!clientConfig) {
      console.error(
        `Unknown client: ${clientId} (available: ${Object.keys(CLIENT_REGISTRY).join(', ')})`
      );
      continue;
    }

    const baseDir = resolveOutputDir(clientConfig, scope);
    const manifest: SyncManifest = {
      version: '1.0',
      client: clientId,
      generatedAt: new Date().toISOString(),
      configHash,
      entries: {},
    };

    console.log(`\n── ${clientId} → ${baseDir}`);

    for (const ir of resources) {
      const outputFiles = adaptResource(ir, clientConfig, duplicateIds);
      const outputHash = hashOutputFiles(outputFiles);

      for (const file of outputFiles) {
        const fullPath = path.join(baseDir, file.relativePath);
        if (opts.dryRun) {
          console.log(`  [dry-run] ${file.relativePath}`);
        } else {
          await mkdir(path.dirname(fullPath), { recursive: true });
          await writeFile(fullPath, file.content);
          console.log(`  wrote ${file.relativePath}`);
        }
      }

      manifest.entries[manifestKey(ir)] = {
        resourceId: ir.id,
        resourceType: ir.resourceType,
        sourceHash: ir.sourceHash,
        outputHash,
        outputFiles: outputFiles.map((f) => f.relativePath),
        exportedAt: new Date().toISOString(),
      };
    }

    if (!opts.dryRun) {
      await saveManifest(clientId, manifest);
      console.log(`  manifest saved`);
    }
  }
}

// ─── Section 9: Diff Command ────────────────────────────────────────────────

async function diffCommand(opts: CLIOptions): Promise<void> {
  const config = await loadSyncConfig();
  const clientIds =
    opts.client === 'all' || !opts.client ? Object.keys(CLIENT_REGISTRY) : [opts.client];

  const filters: LoadFilters = {};
  if (opts.resourceType) filters.resourceType = opts.resourceType;
  if (Array.isArray(config.exports)) {
    filters.exportAllowList = new Set(config.exports);
  }

  for (const clientId of clientIds) {
    const clientConfig = resolveClientConfig(clientId, config);
    if (!clientConfig) continue;

    const manifest = await loadManifest(clientId);
    if (!manifest) {
      console.log(`${clientId}: no manifest found (run export first)`);
      continue;
    }

    console.log(`\n── ${clientId} drift report`);
    const resources = await loadAllResources(filters);
    const idCounts = new Map<string, number>();
    for (const r of resources) {
      if (r.resourceType === 'prompt') idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);
    }
    const duplicateIds = new Set(
      [...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id)
    );
    let driftCount = 0;

    for (const ir of resources) {
      const entry = manifest.entries[manifestKey(ir)];
      if (!entry) {
        console.log(`  [NEW] ${ir.id} — not in manifest`);
        driftCount++;
        continue;
      }

      // Source drift: canonical YAML changed
      if (ir.sourceHash !== entry.sourceHash) {
        console.log(`  [SOURCE DRIFT] ${ir.id} — canonical sources changed`);
        driftCount++;
      }

      // Output drift: generated files edited locally
      const outputFiles = adaptResource(ir, clientConfig, duplicateIds);
      const currentOutputHash = hashOutputFiles(outputFiles);
      if (currentOutputHash !== entry.outputHash) {
        // Show unified diff for each file
        for (const file of outputFiles) {
          const baseDir = resolveOutputDir(clientConfig, 'user');
          const fullPath = path.join(baseDir, file.relativePath);
          const existing = await readOptionalFile(fullPath);
          if (existing && existing !== file.content) {
            const patch = createTwoFilesPatch(
              `a/${file.relativePath}`,
              `b/${file.relativePath}`,
              existing,
              file.content
            );
            console.log(patch);
          }
        }
        driftCount++;
      }
    }

    // Check for orphans (in manifest but no longer in resources)
    const resourceKeys = new Set(resources.map((r) => manifestKey(r)));
    for (const [key, entry] of Object.entries(manifest.entries)) {
      if (!resourceKeys.has(key)) {
        console.log(`  [ORPHAN] ${key} (${entry.resourceType}) — no longer in sources`);
        driftCount++;
      }
    }

    if (driftCount === 0) {
      console.log(`  no drift detected`);
    } else {
      console.log(`  ${driftCount} drift(s) found`);
    }
  }
}

// ─── Section 10: Pull Command ───────────────────────────────────────────────

async function pullCommand(opts: CLIOptions): Promise<void> {
  const config = await loadSyncConfig();
  const outputDir = opts.output ?? path.join(SERVER_ROOT, 'cache', 'patches');
  const clientIds =
    opts.client === 'all' || !opts.client ? Object.keys(CLIENT_REGISTRY) : [opts.client];

  await mkdir(outputDir, { recursive: true });

  for (const clientId of clientIds) {
    const clientConfig = resolveClientConfig(clientId, config);
    if (!clientConfig) continue;

    const baseDir = resolveOutputDir(clientConfig, 'user');
    const resources = await loadAllResources();
    const idCounts = new Map<string, number>();
    for (const r of resources) {
      if (r.resourceType === 'prompt') idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);
    }
    const duplicateIds = new Set(
      [...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id)
    );
    const patches: string[] = [];
    const summary: string[] = [`# Pull Summary: ${clientId}`, ''];

    for (const ir of resources) {
      const outputFiles = adaptResource(ir, clientConfig, duplicateIds);
      for (const file of outputFiles) {
        const fullPath = path.join(baseDir, file.relativePath);
        const existing = await readOptionalFile(fullPath);
        if (!existing) continue;
        if (existing === file.content) continue;

        const patch = createTwoFilesPatch(
          `a/${file.relativePath}`,
          `b/${file.relativePath}`,
          existing,
          file.content
        );
        patches.push(patch);
        summary.push(`- **${ir.id}**: ${file.relativePath} modified`);
      }
    }

    if (patches.length === 0) {
      console.log(`${clientId}: no differences found`);
      continue;
    }

    const patchFile = path.join(outputDir, `${clientId}.patch`);
    await writeFile(patchFile, patches.join('\n'));

    const summaryFile = path.join(outputDir, `${clientId}-summary.md`);
    await writeFile(summaryFile, summary.join('\n') + '\n');

    console.log(`${clientId}: ${patches.length} patch(es) → ${patchFile}`);
    console.log(`  summary → ${summaryFile}`);
  }
}

// ─── Section 11: CLI Main ───────────────────────────────────────────────────

function parseCLIArgs(argv: string[]): CLIOptions {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: {
      client: { type: 'string' },
      scope: { type: 'string' },
      'resource-type': { type: 'string' },
      id: { type: 'string' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      output: { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });

  return {
    command: positionals[0] ?? 'help',
    client: values.client,
    scope: values.scope as 'user' | 'project' | undefined,
    resourceType: values['resource-type'] as ResourceType | undefined,
    id: values.id,
    dryRun: values['dry-run'] ?? false,
    force: values.force ?? false,
    output: values.output,
  };
}

function printHelp(): void {
  console.log(`
skills-sync — Export canonical resources to client skill packages

Usage:
  tsx scripts/skills-sync.ts <command> [options]

Commands:
  export    Export resources to client skill directories
  diff      Show drift between canonical sources and exported skills
  pull      Generate .patch files for locally modified skills

Options:
  --client <id|all>           Target client (${Object.keys(CLIENT_REGISTRY).join(', ')}, all)
  --scope <user|project>      Output scope (default: user)
  --resource-type <type>      Filter by type (prompt, gate, methodology, style)
  --id <resourceId>           Export single resource
  --dry-run                   Show what would be written without writing
  --force                     Overwrite even with local modifications
  --output <dir>              Patch output directory (pull command)
`);
}

async function main(): Promise<void> {
  const opts = parseCLIArgs(process.argv);

  switch (opts.command) {
    case 'export':
      await exportCommand(opts);
      break;
    case 'diff':
      await diffCommand(opts);
      break;
    case 'pull':
      await pullCommand(opts);
      break;
    default:
      printHelp();
  }
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
