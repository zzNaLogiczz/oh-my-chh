# Liquid Glass CSS Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the shipped Liquid Glass CSS by removing rendering-equivalent duplicate top-level rules and collapse nine identical route candidates into one canonical source without changing CSSOM behavior.

**Architecture:** Introduce one dependency-free CSS asset utility that flattens local imports and removes only byte-identical top-level blocks while retaining their final occurrence. Store the historical route and rank baseline as repository-native canonical CSS, make unreduced route candidates import it, and run the safe deduplicator on shipped and candidate output.

**Tech Stack:** Node.js ESM, Vite, Vitest, JSDOM, CSS, Chrome MV3.

**Spec:** `src/theming/themes/liquid-glass/DESIGN.md` open questions plus the user-approved read-only measurements from 2026-08-21.

## Global Constraints

- Preserve the serialized CSSOM rule sequence and declarations; only exact repeated top-level blocks may be removed.
- Preserve first-paint, route detection, dark mode, reduced-motion, and rank-badge behavior.
- Add no dependencies.
- Keep Liquid Glass route entrypoints disabled until their route-specific performance gates pass.
- Replace the untracked `oh-my-chh-0.1.6.zip` build dependency with repository-native canonical CSS; do not add a silent fallback.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Lock exact-top-level deduplication behavior

**Files:**
- Create: `test/unit/css-assets.test.ts`
- Create: `scripts/css-assets.mjs`

**Interfaces:**
- Produces: `parseTopLevelCssBlocks(css)`, `countCssRules(css)`, `dedupeExactTopLevelBlocks(css)`, and `flattenCssImports(cssFile, options)`.

- [ ] **Step 1: Write the failing utility tests**

  Add literal fixtures proving that the utility keeps the last identical rule, retains different declarations and at-rule contexts, handles braces inside strings/comments, and reports removed byte/rule counts.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npx vitest run test/unit/css-assets.test.ts`

  Expected: FAIL because `scripts/css-assets.mjs` does not exist.

- [ ] **Step 3: Implement the minimal dependency-free utility**

  Parse top-level block byte ranges without rewriting retained text. Remove earlier exact hashes only, preserve gaps verbatim, and keep import flattening restricted to relative `.css` paths.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npx vitest run test/unit/css-assets.test.ts`

  Expected: PASS.

### Task 2: Replace repeated candidate sources with a canonical baseline

**Files:**
- Create: `src/theming/themes/liquid-glass/routes/full.css`
- Create: `src/theming/themes/liquid-glass/baseline-rank-badges.css`
- Modify: `src/theming/themes/liquid-glass/routes/{article-view,compose,forum-index,messages,profile,settings,thread-detail,thread-list,unknown}.css`
- Modify: `src/theming/themes/liquid-glass/routes/portal-home.css`
- Modify: `src/theming/themes/liquid-glass/index.css`
- Modify: `test/unit/css-assets.test.ts`

**Interfaces:**
- Consumes: `flattenCssImports` and `dedupeExactTopLevelBlocks` from Task 1.
- Produces: one full route baseline, one historical rank baseline, thin unreduced route wrappers, and a repository-native default theme entrypoint.

- [ ] **Step 1: Add failing canonical-equivalence tests**

  Assert that all unreduced wrappers flatten to the same serialized CSSOM as the canonical full route plus baseline rank CSS, and that deduplication leaves the serialized CSSOM unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npx vitest run test/unit/css-assets.test.ts`

  Expected: FAIL because the canonical baseline files and wrappers do not exist.

- [ ] **Step 3: Create canonical files and thin wrappers mechanically**

  Extract the route segment from an identical committed candidate, extract the historical rank segment from the previous shipped baseline, update the default index imports, and replace nine duplicate files with two-import wrappers.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npx vitest run test/unit/css-assets.test.ts`

  Expected: PASS with identical CSSOM serialization.

### Task 3: Apply exact deduplication to build outputs

**Files:**
- Modify: `scripts/build-extension.mjs`
- Modify: `scripts/build-liquid-glass-candidate.mjs`
- Modify: `scripts/reduce-liquid-route-css.mjs`
- Modify: `scripts/check-dist-output.mjs`
- Create: `test/fixtures/liquid-glass-016-css-golden.json`
- Modify: `test/unit/build-output.test.ts`

**Interfaces:**
- Consumes: Task 1 utility and Task 2 canonical CSS.
- Produces: reproducible default and candidate CSS without exact duplicate top-level blocks.

- [ ] **Step 1: Add a failing shipped-output budget assertion**

  Tighten the Liquid Glass built CSS budget to `1_140_000` bytes and assert the built stylesheet has zero exact duplicate top-level blocks.

- [ ] **Step 2: Run the focused build-output test and verify RED**

  Run: `npx vitest run test/unit/build-output.test.ts`

  Expected: FAIL because the existing build depends on the missing zip and does not deduplicate output.

- [ ] **Step 3: Route build scripts through the shared utility**

  Remove duplicated import flatteners and zip extraction. Flatten repository-native canonical CSS, deduplicate Liquid Glass output, retain forbidden-import boundary checks, and update the golden output hash.

- [ ] **Step 4: Run focused build and CSS tests**

  Run: `npx vitest run test/unit/css-assets.test.ts test/unit/build-output.test.ts test/unit/performance-budget.test.ts test/unit/theme-runtime.test.ts test/unit/first-paint.test.ts`

  Expected: PASS.

### Task 4: Verify behavior and measured reductions

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: final evidence for CSSOM equivalence, build size, source deduplication, and project quality gates.

- [ ] **Step 1: Run static and focused quality gates**

  Run: `npm run lint:css && npm run lint:imports && npm run typecheck && npm run lint:ts-unused`

- [ ] **Step 2: Run the complete test suite and build verification**

  Run: `npm test && npm run build && npm run lint:dist`

- [ ] **Step 3: Measure final artifacts**

  Report `dist/themes/liquid-glass/index.css`, `src/theming/themes/liquid-glass/routes/`, exact duplicate count, rule count, and SHA-256.

- [ ] **Step 4: Review the final diff for scope and fallback residue**

  Run: `git diff --check`, `git status --short`, and search the changed build scope for `oh-my-chh-0.1.6.zip`, silent fallbacks, or route-entrypoint promotion.
