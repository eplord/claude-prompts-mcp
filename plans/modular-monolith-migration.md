# Modular Monolith Migration Plan (Final)

## Overview

Reorganize `server/src/` from **28 flat directories** to a **5-layer screaming architecture** with strict dependency injection and enforced boundaries.

## Target Structure

```
src/
├── shared/          # Layer 0: Primitives (types, errors, utils - pure functions only)
├── infra/           # Layer 1: Adapters (http, logging, metrics, notifications, tracking)
├── engine/          # Layer 2: Mechanics (execution pipeline, frameworks, gates executor)
├── modules/         # Layer 3: Domain (prompts, chains, semantic, automation, formatting)
└── mcp/             # Layer 4: Interface (contracts, protocol handlers - the "front door")
```

## Key Architectural Decisions

### 1. Strict Dependency Injection (modules ↛ infra)

**Rule**: Modules CANNOT import directly from infra.

```typescript
// ❌ FORBIDDEN in modules/
import { logger } from '../../infra/logging';
import { sendNotification } from '../../infra/notifications';

// ✅ REQUIRED pattern
// engine/ defines interfaces
interface ILogger { info(msg: string): void; }
interface INotifier { send(msg: string): void; }

// infra/ implements interfaces
class ConsoleLogger implements ILogger { ... }
class McpNotifier implements INotifier { ... }

// modules/ receives via constructor injection
class PromptService {
  constructor(private logger: ILogger, private notifier: INotifier) {}
}
```

**Why**: Forces testability, prevents spaghetti, enables mocking.

### 2. Engine Layer (not "kernel")

The execution mechanics layer is called `engine/` - more intuitive than "kernel".

### 3. Gate Definitions Stay in YAML

- **Gate definitions** (business rules): `server/gates/{id}/gate.yaml` - NOT in src/
- **Gate engine** (TypeScript executor): `src/engine/gates/` - the code that runs rules

## Layer Definitions

| Layer | Purpose | Can Import From | Cannot Import From |
|-------|---------|-----------------|-------------------|
| `shared/` | Pure primitives | Nothing | Everything |
| `infra/` | I/O adapters | `shared/` | `engine/`, `modules/`, `mcp/` |
| `engine/` | Mechanics + interfaces | `shared/`, `infra/` | `modules/`, `mcp/` |
| `modules/` | Business domain | `shared/`, `engine/` (interfaces only) | `infra/`, `mcp/` |
| `mcp/` | Protocol interface | `shared/`, `engine/`, `modules/` | `infra/` (via engine) |

## Dependency Flow

```
         mcp/            ← External interface (MCP protocol)
           │
           ▼
       modules/          ← Business domain (WHAT) - uses interfaces
           │
           ▼
       engine/           ← Mechanics (HOW) - defines interfaces, uses infra
           │
           ▼
       infra/            ← I/O adapters (implements interfaces)
           │
           ▼
       shared/           ← Pure primitives (foundation)
```

## Migration Tooling Strategy

### Evaluated Alternatives

| Tool | Type | Verdict | Rationale |
|------|------|---------|-----------|
| **[ts-morph](https://github.com/dsherret/ts-morph)** | AST manipulation (TS-native) | **Primary** | `file.move()` auto-updates all import paths; full TypeScript type awareness; 6.9M weekly downloads |
| **[Knip](https://knip.dev)** | Dead code detection | **Pre-migration cleanup** | Identifies unused exports/files/deps before we move anything — no point migrating dead code |
| **[ast-grep](https://ast-grep.github.io/)** | Pattern-based search/replace (Rust) | **Supplementary** | Fast structural rewrites for non-TS files (package.json paths, config strings, markdown refs) |
| **[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)** | Architecture enforcement | **Post-migration validation** | Already planned — enforces layer boundaries after moves |
| [jscodeshift](https://github.com/facebook/jscodeshift) | AST codemods (Facebook) | Skipped | More JS-oriented; ts-morph is strictly better for pure TS projects |
| [Moderne](https://www.moderne.ai/blog/automated-javascript-refactoring-at-enterprise-scale) | Enterprise LST platform | Skipped | Multi-repo enterprise scale; overkill for single repo |
| [Grit](https://www.grit.io/) | AI-powered migration | Skipped | Less deterministic; we need reproducible scripts |
| [ts-migrate](https://medium.com/airbnb-engineering/ts-migrate-a-tool-for-migrating-to-typescript-at-scale-cd23bfeb5cc) | JS→TS conversion (Airbnb) | Skipped | Solves JS→TS, not directory restructuring |
| VS Code "Move TS" | IDE extension | Skipped | [Known bugs with project references](https://github.com/microsoft/vscode/issues/215271); not scriptable |

### Chosen Stack

```
Phase 0 ──► Knip (clean dead code)
Phase 1-5 ─► ts-morph (move files + rewrite imports)
Phase 1-5 ─► ast-grep (rewrite non-TS references: configs, docs, scripts)
Phase 6 ──► dependency-cruiser (enforce boundaries)
```

### Why ts-morph (Primary)

ts-morph wraps the TypeScript Compiler API with a convenient, chainable interface. For our migration, the critical capability is:

```typescript
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });

// Move entire directory — ALL imports across codebase updated automatically
project.getSourceFiles('src/utils/**/*.ts').forEach(file => {
  const newPath = file.getFilePath().replace('/src/utils/', '/src/shared/utils/');
  file.move(newPath);
});

await project.save();
```

**What ts-morph handles automatically:**
- Relative import path recalculation (`../../utils/` → `../../shared/utils/`)
- Re-export barrel updates
- Dynamic import paths (string literals)
- Type-only imports

**What ts-morph does NOT handle (use ast-grep / manual):**
- Non-TS files: `package.json` lint patterns, `.dependency-cruiser.cjs` paths, docs, CLAUDE.md
- String-interpolated paths in configs
- Jest `moduleNameMapper` or `pathsToModuleNameMapper` entries

### Why Knip (Pre-Migration)

Before moving ~200 files, first identify what's dead:

```bash
npx knip --reporter compact
```

Knip builds a dependency graph from entry points and flags:
- Unused exports (functions, types, classes never imported)
- Unused files (never reached from entry points)
- Unused dependencies in `package.json`

**Run before Phase 1** to avoid migrating dead code into the new structure.

### Why ast-grep (Supplementary)

[ast-grep](https://ast-grep.github.io/catalog/typescript/) is a Rust-based structural search/replace tool. We use it for bulk rewrites that ts-morph doesn't cover:

```bash
# Example: Update all import paths in markdown code blocks
ast-grep --pattern 'from "$PATH/utils/$REST"' --rewrite 'from "$PATH/shared/utils/$REST"' --lang ts

# Example: Find all string references to old paths in any file type
ast-grep --pattern '"src/utils/$REST"' --rewrite '"src/shared/utils/$REST"'
```

### Migration Script Architecture

```
server/scripts/migration/
├── 00-knip-audit.ts          # Pre-migration dead code report
├── 01-move-shared.ts         # Phase 1: types/, utils/, core/ → shared/
├── 02-move-infra.ts          # Phase 2: logging/, config/, etc. → infra/
├── 03-move-engine.ts         # Phase 3: execution/, frameworks/, gates/ → engine/
├── 04-move-modules.ts        # Phase 4: prompts/, chains/, etc. → modules/
├── 05-move-mcp.ts            # Phase 5: mcp-contracts/, mcp-tools/ → mcp/
├── 06-update-configs.ts      # Phase 6: package.json, tsconfig, docs
└── shared/
    ├── project-loader.ts     # Shared ts-morph Project instance
    └── config-updater.ts     # ast-grep wrappers for non-TS files
```

Each script is idempotent — safe to rerun if interrupted.

## Migration Phases

### Phase 0: Preparation (Day 1) --- COMPLETE
- [x] Install migration tooling: `npm install -D ts-morph knip` (ast-grep deferred to Phase 1)
- [x] Run Knip audit: found 30 unused files, 97 unused exports, removed unused deps (cors, ts-prune, ws)
- [x] Replaced `lint:unused:internal` + `lint:unused:full` (ts-prune) with `lint:unused` (knip)
- [x] Create `server/scripts/migration/` scaffold with shared project loader + phase stubs (01-06)
- [x] Create empty target directory structure (shared/, infra/, engine/, modules/, mcp/ with subdirs)
- [x] Add tsconfig path aliases (`@shared/*`, `@infra/*`, `@engine/*`, `@modules/*`, `@mcp/*`)
- [x] Update esbuild config with `alias` for path resolution
- [x] Update jest.config.cjs with `moduleNameMapper` for path aliases
- [ ] Create migration tracking branch (deferred — committing on current branch first)

**Validation**: typecheck, lint:ratchet, test:ci (936/936), build, start:test — all pass

### Phase 1: Shared Layer (Days 2-3) --- COMPLETE

| Source | Target | Files |
|--------|--------|-------|
| `types/` | `shared/types/` | 2 |
| `utils/` | `shared/utils/` | 14 |
| `core/` | `shared/core/` | 4 |

**Deviation**: `core/` → `shared/core/` (not `shared/errors/`). Core contains `BaseResourceManager` abstract class, not error handling.

**Execution details**:
- ts-morph moved 20 files, updated imports in 115 files
- ts-morph drops `.js` extensions on rewrite — fixed with `fix-extensions.ts` script (153 import decls + 5 inline import() expressions)
- 22 test files updated (old `src/types/` → `src/shared/types/` etc.)
- 11 test files updated (old `dist/utils/` → `src/shared/utils/` etc.)
- ESLint lifecycle annotation targets updated
- Old empty directories (`types/`, `utils/`, `core/`) removed

**Known architectural violations** (expected, resolved in Phase 6):
- `shared/utils/chainUtils.ts` imports from `execution/types.js` (engine dep)
- `shared/utils/resource-loader.ts` imports from `logging/index.js` (infra dep)
- `shared/core/resource-manager/base-resource-manager.ts` imports `Logger` from `logging/` (infra dep)

**Validation**: typecheck (0 errors), lint:ratchet (3690 errors — improved from 3692), test:ci (936/936), build, start:test — all pass

### Phase 2: Infrastructure Layer (Days 4-6) --- COMPLETE

| Source | Target | Files |
|--------|--------|-------|
| `logging/` | `infra/logging/` | 1 |
| `config/` | `infra/config/` | 1 |
| `cache/` | `infra/cache/` | 2 |
| `server/` | `infra/http/` | 2 |
| `api/` | `infra/http/api/` | 1 |
| `metrics/` | `infra/observability/metrics/` | 3 |
| `tracking/` | `infra/observability/tracking/` | 2 |
| `notifications/` | `infra/observability/notifications/` | 2 |
| `performance/` | `infra/observability/performance/` | 2 |
| `hooks/` | `infra/hooks/` | 2 |

**Execution details**:
- ts-morph moved 18 files across 10 directories, updated imports in 146 files
- `fix-extensions.ts` restored 219 import/export specifiers + 7 inline import() expressions
- Test files updated: `src/` paths (logging, config, hooks, notifications) and `dist/` paths (logging, config) bulk-replaced
- ESLint lifecycle annotation targets consolidated from 6 individual dirs to single `src/infra/**/*.ts` glob
- Added `@lifecycle canonical` annotation to `tracking/index.ts` (newly matched by infra glob)
- All 10 old directories removed, `.gitkeep` placeholders cleaned from infra/

**Validation**: typecheck (0 errors), lint:ratchet (3691 errors — improved from 3692), test:ci (84 suites, 936/936), build (4.73 MB, 669 inputs), start:test — all pass

### Phase 3: Engine Layer + Interfaces (Days 7-14) --- COMPLETE (file moves)

The engine that runs business logic + interface definitions for DI.

| Source | Target | Files |
|--------|--------|-------|
| `frameworks/` | `engine/frameworks/` | 26 |
| `gates/` | `engine/gates/` | 42 |
| `execution/` | `engine/execution/` | 76 |

**Execution details**:
- ts-morph moved 144 files across 3 directories, updated imports in 179 files
- `fix-extensions.ts` restored 678 import/export specifiers + 9 inline import() expressions
- 74 test files updated (src/ paths) + 18 test files updated (dist/ paths)
- ESLint lifecycle annotation targets consolidated from 3 individual dirs to single `src/engine/**/*.ts` glob
- Fixed `scripts/generate-operators.ts` output path (was regenerating to stale `src/execution/` location)
- Fixed stale comment in `scripts/validate-methodologies.js`
- Moved `src/execution/parsers/README.md` (non-TS file skipped by ts-morph)
- All 3 old directories (`execution/`, `frameworks/`, `gates/`) removed

**Validation**: typecheck (0 errors), lint:ratchet (3692 errors — no regressions), test:ci (84 suites, 936/936), build (4.73 MB, 669 inputs), start:test — all pass

**DI approach (resolved in Phases 6-8):**
Interfaces extracted to `shared/types/` (Layer 0) instead of `engine/interfaces/`:
- [x] Logger → `shared/types/index.ts` (Phase 6)
- [x] ConfigManager → `shared/types/config-manager.ts` (Phase 7)
- [x] MetricsCollector → `shared/types/metrics.ts` (Phase 8)
- [ ] ICache, INotifier (future — lower priority)

```
engine/
├── execution/       # Pipeline mechanics (76 files) ✅
├── frameworks/      # Methodology engine (26 files) ✅
├── gates/           # Gate executor (42 files) ✅
└── index.ts         # Public API + interface exports (Phase 6)
```

### Phase 4: Modules Layer (Days 15-18) --- COMPLETE

Business domain - receives infra via DI.

| Source | Target | Files | Notes |
|--------|--------|-------|-------|
| `prompts/` | `modules/prompts/` | 13 | |
| `chain-session/` | `modules/chains/` | 3 | Renamed |
| `text-references/` | `modules/text-refs/` | 4 | Renamed |
| `semantic/` | `modules/semantic/` | 5 | Domain logic |
| `styles/` | `modules/formatting/` | 7 | Renamed |
| `resources/` | `modules/resources/` | 6 | |
| `versioning/` | `modules/versioning/` | 3 | |
| `scripts/` | `modules/automation/` | 14 | Renamed |

**Execution details**:
- ts-morph moved 55 files across 8 directories, updated imports in 107 files
- `fix-extensions.ts` restored 261 import/export specifiers + 3 inline import() expressions
- 30 test files updated (src/ paths) + 4 test files updated (dist/ paths)
- ESLint lifecycle annotation targets consolidated from 4 individual dirs to single `src/modules/**/*.ts` glob
- Added `@lifecycle canonical` annotations with descriptions to 6 `modules/resources/` files (newly covered by modules glob)
- All 8 old directories removed

**Validation**: typecheck (0 errors), lint:ratchet (3691 errors — improved from 3692), test:ci (84 suites, 936/936), build (4.73 MB, 669 inputs), start:test — all pass

**DI setup deferred to Phase 6:**
```typescript
// modules/prompts/prompt-service.ts
export class PromptService {
  constructor(
    private readonly logger: ILogger,      // Injected
    private readonly config: IConfigReader // Injected
  ) {}
}
```

### Phase 5: MCP Layer ✅ COMPLETE

External protocol interface.

| Source | Target | Files |
|--------|--------|-------|
| `mcp-contracts/` | `mcp/contracts/` | 7 |
| `action-metadata/` | `mcp/metadata/` | 6 |
| `mcp-tools/` | `mcp/tools/` | 51 |

**Execution details:**
- ts-morph moved 64 files, updated imports in 81 files
- fix-extensions restored 348 import specifiers + 8 inline `import()` expressions
- Manually moved 2 non-TS files: `tool-descriptions.contracts.json`, `action-metadata/README.md`
- Fixed 3 generator scripts: `generate-contracts.ts`, `validate-filesize.js`, `verify-action-inventory.js`
- Updated `.dependency-cruiser.cjs`, `graphs/prompts-config.json`
- Updated ESLint lifecycle targets: `src/mcp-tools/**/*.ts` → `src/mcp/**/*.ts`, added `_generated/` exclusion
- Updated 18 test files (src/ refs) + 1 test file (dist/ ref)
- Validation: typecheck 0 errors, lint:ratchet 3689 (improved by 2), tests 936/936, build 4.73MB/669 inputs, clean startup

### Phase 6: Finalization (Days 21-22) — COMPLETED

**Approach**: Pragmatic type-extraction over full DI container. Logger interface moved to shared/types/ (Layer 0) so all layers can import it without cross-layer violations. Full DI container deferred as future optimization since type-only imports are erased at compile time.

**Completed:**
- [x] Move Logger interface to `shared/types/` — fixes 50+ cross-layer imports
- [x] Bulk-rewrite Logger imports in modules/ (22 files) and mcp/ (24 files)
- [x] Fix shared/ layer violations (resource-loader.ts, base-resource-manager.ts, chainUtils.ts)
- [x] Add 5-layer dependency-cruiser rules with value/type-only split
- [x] Update pre-migration paths in existing rules
- [x] Final validation (typecheck, lint:ratchet, test:ci, build all pass)

**Deferred (resolved in Phases 7-9):**
- [x] Extract ConfigManager interface to `shared/types/config-manager.ts`, impl `EventEmittingConfigManager` in `infra/config/` (Phase 7)
- [x] Extract MetricsCollector interface to `shared/types/metrics.ts`, impl `InMemoryMetricsCollector` in `infra/observability/metrics/` (Phase 8)
- [x] Remove backward-compat re-exports from shared/types/index.ts (Phase 9 — 5 re-export blocks removed, 48 consumers redirected)

**Remaining future work:**
- [ ] ICache, INotifier interfaces (lower priority — fewer consumers)

**Violation Baseline (validate:arch) — Phase 6:**

| Rule | Errors | Warnings | Notes |
|------|--------|----------|-------|
| engine-no-modules-or-mcp-value | 6 | — | Value imports: semantic, automation, mcp utils |
| infra-no-cross-layer-value | 5 | — | API routes wire modules+mcp, config→injection |
| shared-no-cross-layer-value | 3 | — | Barrel re-exports, DEFAULT_VERSIONING_CONFIG |
| modules-no-mcp | 3 | — | chains/prompts → mcp/tools types |
| engine-cross-layer-type-only | — | 39 | Type imports (compile-time erased) |
| mcp-no-infra-direct | — | 26 | ConfigManager, logging, hooks, metrics |
| no-circular | — | 26 | Pre-existing circular deps |
| modules-no-infra | — | 6 | ConfigManager DI pending |
| shared-cross-layer-type-only | — | 6 | Type re-exports from engine/modules |
| infra-cross-layer-type-only | — | 2 | Type imports from engine/gates |
| **Total** | **17** | **105** | Baseline for ratchet enforcement |

**Final Violation State (after Phases 7-10):**

| Rule | Errors | Warnings | Notes |
|------|--------|----------|-------|
| engine-no-modules-or-mcp-value | 2 | — | semantic integration (2 files) |
| engine-cross-layer-type-only | — | 35 | Type imports (compile-time erased) |
| no-circular | — | 18 | Pre-existing circular deps |
| mcp-no-infra-direct | — | 9 | logging, hooks, metrics, notifications |
| shared-cross-layer-type-only | — | 5 | Remaining type deps from shared/ utils |
| infra-cross-layer-type-only | — | 3 | Type imports from engine/gates, mcp |
| modules-no-infra | — | 0 | Resolved via ConfigManager interface |
| modules-no-mcp | 0 | — | Resolved |
| shared-no-cross-layer-value | 0 | — | Resolved via Phase 9 cleanup |
| infra-no-cross-layer-value | 0 | — | Resolved |
| **Total** | **2** | **79** | **-88% errors, -25% warnings** |

## Dependency-Cruiser Rules

```javascript
// .dependency-cruiser.cjs
{
  forbidden: [
    // ========================================
    // LAYER BOUNDARIES (Strict)
    // ========================================
    {
      name: 'shared-is-foundation',
      comment: 'Shared cannot import from any other layer',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(infra|engine|modules|mcp)/' }
    },
    {
      name: 'infra-only-shared',
      comment: 'Infra can only import from shared',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: { path: '^src/(engine|modules|mcp)/' }
    },
    {
      name: 'engine-no-modules-or-mcp',
      comment: 'Engine cannot import from modules or MCP',
      severity: 'error',
      from: { path: '^src/engine/' },
      to: { path: '^src/(modules|mcp)/' }
    },

    // ========================================
    // STRICT DI: modules cannot import infra
    // ========================================
    {
      name: 'modules-no-infra',
      comment: 'CRITICAL: Modules must use DI, not direct infra imports',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/infra/' }
    },
    {
      name: 'modules-no-mcp',
      comment: 'Modules cannot import from MCP layer',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/mcp/' }
    },

    // ========================================
    // MCP LAYER RULES
    // ========================================
    {
      name: 'mcp-no-infra-direct',
      comment: 'MCP uses engine interfaces, not direct infra',
      severity: 'error',
      from: { path: '^src/mcp/' },
      to: { path: '^src/infra/' }
    },

    // ========================================
    // ENGINE INTERNAL ISOLATION
    // ========================================
    {
      name: 'gates-frameworks-decoupled',
      severity: 'error',
      from: { path: '^src/engine/gates/' },
      to: { path: '^src/engine/frameworks/' }
    },
    {
      name: 'frameworks-gates-decoupled',
      severity: 'error',
      from: { path: '^src/engine/frameworks/' },
      to: { path: '^src/engine/gates/' }
    },

    // ========================================
    // MODULE ISOLATION (barrel imports only)
    // ========================================
    {
      name: 'no-cross-module-internals',
      severity: 'warn',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/(?!$1)[^/]+/',
        pathNot: 'index\\.ts$'
      }
    },

    // ========================================
    // ENGINE FACADE RULE
    // ========================================
    {
      name: 'mcp-uses-engine-facade',
      comment: 'MCP tools use engine public API, not internals',
      severity: 'warn',
      from: { path: '^src/mcp/' },
      to: {
        path: '^src/engine/execution/pipeline/stages/',
        pathNot: 'index\\.ts$'
      }
    }
  ]
}
```

## Validation Checklist

Run after each phase:

```bash
npm run typecheck        # Type checking
npm run lint:ratchet     # Lint (no regressions)
npm run test:ci          # Unit tests
npm run build            # Build succeeds
npm run validate:arch    # Architecture rules (CRITICAL)
npm run start:test       # Startup test
```

## Critical Files

| File | Role | Migration Notes |
|------|------|-----------------|
| `src/types/index.ts` | Type hub | Move first to shared/ |
| `src/execution/` | Engine (76 files) | Move to engine/execution/ |
| `src/scripts/` | Runtime automation | Rename to modules/automation/ |
| `src/semantic/` | Domain logic | Move to modules/semantic/ |
| `.dependency-cruiser.cjs` | Architecture rules | Add `modules-no-infra` rule |

## Estimated Effort

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 0: Preparation | 1 day | Low |
| Phase 1: Shared | 2 days | Low |
| Phase 2: Infrastructure | 3 days | Medium |
| Phase 3: Engine + Interfaces | 8 days | **High** (DI setup) |
| Phase 4: Modules (with DI) | 4 days | Medium |
| Phase 5: MCP | 2 days | Medium |
| Phase 6: Finalization | 2 days | Medium |
| **Total** | **22 days** | |

## Success Criteria

- [x] 5-layer architecture enforced by dependency-cruiser (14 rules, value/type-only split)
- [x] `modules-no-infra` rule active as `warn` (0 violations — resolved via interface extraction in Phases 7-8)
- [x] Core infra interfaces extracted to `shared/types/`: Logger, ConfigManager, MetricsCollector (Phases 6-8)
- [x] `infra/` implements interfaces: `EventEmittingConfigManager`, `InMemoryMetricsCollector` (Phases 7-8)
- [x] `modules/` answers "what does this app do?" (prompts, chains, semantic, automation, formatting, text-refs, resources, versioning)
- [x] `engine/` answers "how does it run?" (execution pipeline, gates, frameworks)
- [x] Gate definitions remain in YAML (`server/gates/`)
- [x] All tests pass (936/936), build works (4.73MB), typecheck clean, lint:ratchet no regressions
- [x] shared/types/ re-exports cleaned (Phase 9 — 5 higher-layer re-export blocks removed)
- [ ] ICache, INotifier interfaces (future — lower priority, extract when consumers warrant it)

## Migration Summary

| Phase | Status | Files Moved | Key Changes |
|-------|--------|-------------|-------------|
| Phase 0: Preparation | Done | 0 | Path aliases, tsconfig, esbuild config |
| Phase 1: Shared | Done | ~20 | types/, utils/, core/ → shared/ |
| Phase 2: Infrastructure | Done | ~16 | logging, config, cache, server, metrics, hooks → infra/ |
| Phase 3: Engine | Done | ~144 | execution, frameworks, gates → engine/ |
| Phase 4: Modules | Done | ~50 | prompts, chains, semantic, scripts, styles → modules/ |
| Phase 5: MCP | Done | ~64 | mcp-tools, contracts, metadata → mcp/ |
| Phase 6: Finalization | Done | ~50 | Logger DI, dep-cruiser rules, import rewrites |
| Phase 7: ConfigManager interface | Done | ~30 | Interface in shared/types/, impl in infra/config/ |
| Phase 8: MetricsCollector interface | Done | ~25 | Interface in shared/types/, impl in infra/metrics/ |
| Phase 9: shared/types/ cleanup | Done | ~48 | Removed 5 re-export blocks, redirected 48 consumers |
| Phase 10: Hungarian notation | Done | ~10 | Renamed IConfigManager→ConfigManager, IMetricsCollector→MetricsCollector |
| **Total** | **Complete** | **~350+** | 28 flat dirs → 5-layer architecture |

### Violation Trend

| Metric | Phase 6 Baseline | Final (Phase 10) | Delta |
|--------|-----------------|-------------------|-------|
| Errors | 17 | 2 | **-88%** |
| Warnings | 105 | 79 | **-25%** |
| Total | 122 | 81 | **-34%** |

### What's Left (Future Work)

1. **ICache, INotifier interfaces**: Lower priority — extract when consumer count warrants it
2. **Engine→Modules Decoupling**: 2 remaining value imports from engine/ to modules/semantic/
3. **Circular Dependency Cleanup**: ~18 circular dep warnings to resolve

**Rejected: Formal DI Container** — Explicit imports are optimal for LLM-driven development. Import paths encode layer information, are greppable, and visible to static analysis (dependency-cruiser). A DI container adds indirection that costs context tokens, hides dependency resolution behind string tokens/decorators, and solves a human-team coordination problem we don't have. Layer enforcement via dependency-cruiser is sufficient.
