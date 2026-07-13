import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptRoot, "..");
const baselineMonolithZip = join(projectRoot, "oh-my-chh-0.1.6.zip");
const routeRoot = join(projectRoot, "src/theming/themes/liquid-glass/routes");
const reportRoot = join(projectRoot, ".omx/liquid-glass-route-reduction");
const fixtureConfigPath = join(projectRoot, "test/fixtures/liquid-glass-017-runtime-equivalence.json");
const baselineRouteStartMarker = "/* inlined routes.css */";
const baselineRouteEndMarker = "/* inlined rank-badges.css */";
const baselineRouteSourceLabel = "oh-my-chh-0.1.6.zip#themes/liquid-glass/index.css#inlined-routes.css";
const terminalPassValues = {
  equivalence: "pass",
  performance: "pass"
};

function parseArgs(argv) {
  const args = {
    maxPasses: 20,
    verifyCommand: undefined,
    traceCommand: undefined,
    allowUnknown: false,
    coverageSeed: true,
    fullSeedOnly: false,
    maxSplitAttempts: 7,
    maxVerifications: null,
    route: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--allow-unknown") {
      args.allowUnknown = true;
    } else if (arg === "--full-seed-only") {
      args.fullSeedOnly = true;
    } else if (arg === "--no-coverage-seed") {
      args.coverageSeed = false;
    } else if (arg === "--route") {
      args.route = argv[++index];
    } else if (arg === "--max-passes") {
      args.maxPasses = Number.parseInt(argv[++index], 10);
    } else if (arg === "--max-split-attempts") {
      args.maxSplitAttempts = Number.parseInt(argv[++index], 10);
    } else if (arg === "--max-verifications") {
      args.maxVerifications = Number.parseInt(argv[++index], 10);
    } else if (arg === "--verify-command") {
      args.verifyCommand = argv[++index];
    } else if (arg === "--trace-command") {
      args.traceCommand = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.route) throw new Error("Missing required --route <route>");
  if (!Number.isInteger(args.maxPasses) || args.maxPasses < 1) throw new Error("--max-passes must be a positive integer");
  if (!Number.isInteger(args.maxSplitAttempts) || args.maxSplitAttempts < 1) throw new Error("--max-split-attempts must be a positive integer");
  if (args.maxVerifications !== null && (!Number.isInteger(args.maxVerifications) || args.maxVerifications < 0)) {
    throw new Error("--max-verifications must be a non-negative integer");
  }
  args.verifyCommand ??= `npm run verify:liquid-equivalence -- --route ${args.route}`;
  args.traceCommand ??= `npm run verify:liquid-performance -- --route ${args.route}`;
  return args;
}

function summarizeBlock(block) {
  const trimmed = block.trim();
  const selector = trimmed.slice(0, trimmed.indexOf("{")).trim().replace(/\s+/g, " ");
  return selector.slice(0, 240) || trimmed.slice(0, 240);
}

function parseTopLevelBlocks(css) {
  const blocks = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let inComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\" && next) {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        const leading = css.slice(start, index);
        const lastBoundary = Math.max(leading.lastIndexOf("\n\n"), leading.lastIndexOf("}\n"));
        if (lastBoundary >= 0) start += lastBoundary + (leading[lastBoundary] === "}" ? 1 : 2);
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) throw new Error(`Unbalanced closing brace at byte ${index}`);
      if (depth === 0) {
        let end = index + 1;
        while (css[end] === "\n") end += 1;
        blocks.push({ index: blocks.length, text: css.slice(start, end) });
        start = end;
      }
    }
  }
  if (depth !== 0 || quote || inComment) throw new Error("CSS ended before all blocks were closed");
  return blocks.filter((block) => block.text.trim().length > 0);
}

export function shippedBaselineRouteSegment() {
  const css = execFileSync("unzip", ["-p", baselineMonolithZip, "themes/liquid-glass/index.css"], {
    encoding: "utf8",
    maxBuffer: 3_000_000
  });
  const start = css.indexOf(baselineRouteStartMarker);
  const end = css.indexOf(baselineRouteEndMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Unable to read shipped Liquid Glass route segment from ${baselineRouteSourceLabel}`);
  }
  return css.slice(start + baselineRouteStartMarker.length, end).trimStart();
}

function countCssRules(css) {
  let rules = 0;
  let depth = 0;
  let quote = null;
  let inComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\" && next) {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      rules += 1;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) throw new Error(`Unbalanced closing brace at byte ${index}`);
    }
  }
  if (depth !== 0 || quote || inComment) throw new Error("CSS ended before all rules were closed");
  return rules;
}

function localMetrics(css) {
  return {
    cssBytes: Buffer.byteLength(css),
    cssRuleCount: countCssRules(css)
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256ForTesting(value) {
  return sha256(value);
}

function isLocalReduction(previous, candidate) {
  return candidate.cssBytes < previous.cssBytes && candidate.cssRuleCount < previous.cssRuleCount;
}

export function renderRoute(blocks, removedIndexes) {
  const body = blocks
    .filter((block) => !removedIndexes.has(block.index))
    .map((block) => block.text.trimEnd())
    .join("\n\n");
  return `${body}\n\n@import "../rank-badges.css";\n`;
}

export function createFullRouteCss() {
  return `${shippedBaselineRouteSegment().trimEnd()}\n\n@import "../rank-badges.css";\n`;
}

export function createRouteCssFromRemovedIndexes(removedBlockIndexes, fullRouteCss = createFullRouteCss()) {
  if (removedBlockIndexes.length === 0) return fullRouteCss;
  const blocks = parseTopLevelBlocks(fullRouteCss);
  return renderRoute(blocks, new Set(removedBlockIndexes));
}

export function isBaselineDerivedRouteCss(routeCss, fullRouteCss = createFullRouteCss()) {
  try {
    const baselineBlocks = parseTopLevelBlocks(fullRouteCss).map((block) => block.text.trimEnd());
    const routeBlocks = parseTopLevelBlocks(routeCss).map((block) => block.text.trimEnd());
    let baselineCursor = 0;

    for (const routeBlock of routeBlocks) {
      let foundIndex = -1;
      for (let index = baselineCursor; index < baselineBlocks.length; index += 1) {
        if (baselineBlocks[index] === routeBlock) {
          foundIndex = index;
          break;
        }
      }
      if (foundIndex === -1) return false;
      baselineCursor = foundIndex + 1;
    }
    return true;
  } catch {
    return false;
  }
}

function isSafeSharedBlock(blockText) {
  return [
    "--chh-lg",
    "#qmenu_menu",
    "data-omchh-reduce-glass",
    "data-omchh-motion=\"reduce\"",
    "data-omchh-performance=\"reduced\"",
    "prefers-reduced-motion",
    "rank-badge"
  ].some((marker) => blockText.includes(marker));
}

function normalizeSelector(selector) {
  return selector
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/::(?:before|after|marker|placeholder|selection|backdrop|file-selector-button)/g, "")
    .replace(/:(?:hover|active|focus|focus-visible|focus-within|visited|link|checked|disabled|enabled|target)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function selectorListMatches(document, selectorList) {
  return selectorList
    .split(",")
    .map(normalizeSelector)
    .filter(Boolean)
    .some((selector) => {
      try {
        return document.querySelector(selector) !== null;
      } catch {
        return true;
      }
    });
}

function blockMatchesRouteDom(blockText, document) {
  const selectorPattern = /(^|})\s*([^@{}][^{}]*)\{/g;
  for (const match of blockText.matchAll(selectorPattern)) {
    if (selectorListMatches(document, match[2])) return true;
  }
  return false;
}

async function routeDom(route) {
  const fixture = JSON.parse(await readFile(fixtureConfigPath, "utf8"));
  const domFixture = fixture.domFixtures[route];
  if (!domFixture) return null;
  const dom = new JSDOM(await readFile(join(projectRoot, domFixture), "utf8"));
  const { document } = dom.window;
  document.documentElement.dataset.omchhEnabled = "1";
  document.documentElement.dataset.omchhTheme = "liquid-glass";
  document.documentElement.dataset.omchhRoute = route;
  document.documentElement.dataset.omchhDensity = "comfortable";
  document.documentElement.dataset.omchhScheme = "light";
  document.documentElement.dataset.omchhMotion = "normal";
  document.documentElement.dataset.omchhReduceGlass = "0";
  document.body?.classList.add("chh-liquid-glass");
  return document;
}

function routeExclusiveSeedReason(route, blockText) {
  if (isSafeSharedBlock(blockText)) return null;

  if (route === "portal-home") {
    const portalMarkers = [
      "portal-home",
      "omchh-portal-home",
      "portal-list",
      "portal-block",
      "portal.php"
    ];
    if (portalMarkers.some((marker) => blockText.includes(marker))) return null;

    const nonPortalMarkers = [
      "omchh-thread-list-route",
      "omchh-thread-list",
      "omchh-thread-row",
      "omchh-thread-table",
      "omchh-thread-detail",
      "omchh-article-view",
      "omchh-profile",
      "omchh-compose",
      "omchh-forum-index",
      "omchh-forum-heading",
      "omchh-list-toolbar",
      "omchh-thread-types",
      "omchh-subforum",
      "omchh-quick-reply",
      "omchh-settings",
      "omchh-messages",
      "spacecp",
      "pm_",
      "postlistreply",
      "fastpost"
    ];
    const marker = nonPortalMarkers.find((candidate) => blockText.includes(candidate));
    return marker ? `coverage-seed:${marker}` : null;
  }

  return null;
}

async function candidateBlocksForRoute(route, blocks, useCoverageSeed) {
  if (!useCoverageSeed) {
    return blocks.map((block) => ({ block, reason: "all-blocks" }));
  }
  const document = await routeDom(route);
  return blocks
    .map((block) => {
      const routeExclusiveReason = routeExclusiveSeedReason(route, block.text);
      if (routeExclusiveReason) return { block, reason: routeExclusiveReason };
      if (document && !isSafeSharedBlock(block.text) && !blockMatchesRouteDom(block.text, document)) {
        return { block, reason: "coverage-seed:dom-unused" };
      }
      return { block, reason: null };
    })
    .filter((candidate) => candidate.reason);
}

function groupCandidates(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!groups.has(candidate.reason)) groups.set(candidate.reason, []);
    groups.get(candidate.reason).push(candidate);
  }
  return [...groups.entries()]
    .map(([reason, groupedCandidates]) => ({ reason, candidates: groupedCandidates }))
    .sort((left, right) => {
      const leftBytes = left.candidates.reduce((total, candidate) => total + Buffer.byteLength(candidate.block.text), 0);
      const rightBytes = right.candidates.reduce((total, candidate) => total + Buffer.byteLength(candidate.block.text), 0);
      return rightBytes - leftBytes;
    });
}

function runCommand(command) {
  const startedAt = Date.now();
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20_000_000
    });
    return { ok: true, durationMs: Date.now() - startedAt, output: output.slice(-4000) };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`.slice(-4000),
      status: error.status ?? null
    };
  }
}

export function createReductionReport(args) {
  const report = {
    route: args.route,
    source: baselineRouteSourceLabel,
    maxPasses: args.maxPasses,
    verifyCommand: args.verifyCommand,
    traceCommand: args.traceCommand,
    coverageSeed: args.coverageSeed,
    fullSeedOnly: args.fullSeedOnly,
    maxSplitAttempts: args.maxSplitAttempts,
    maxVerifications: args.maxVerifications ?? null,
    verificationsRun: 0,
    stoppedByMaxVerifications: false,
    removedInFinalPass: null,
    equivalence: "not-run",
    performance: "not-run",
    finalVerification: null,
    finalTrace: null,
    finalGateStartedAt: null,
    kept: [],
    removed: [],
    failures: [],
    passes: [],
    attempts: [],
    bestPassingCandidate: null,
    bestMetrics: null,
    terminalGate: {
      equivalence: "not-run",
      performance: "not-run"
    },
    terminalFailureReason: null
  };
  Object.defineProperty(report, "_bestPassingCss", {
    value: null,
    writable: true,
    enumerable: false
  });
  return report;
}

function attemptKey(blockIndexes) {
  return [...blockIndexes].sort((left, right) => left - right).join(",");
}

function nextAttemptId(report) {
  return report.attempts.reduce((max, attempt) => Math.max(max, Number(attempt.id) || 0), 0) + 1;
}

export function restoreAttemptLedger(report, existingReport) {
  if (!Array.isArray(existingReport?.attempts)) return false;
  const restoredAt = new Date().toISOString();
  report.attempts = existingReport.attempts.map((attempt) => {
    if (attempt.status !== "verifying") return { ...attempt };
    return {
      ...attempt,
      status: "interrupted",
      reason: "previous verification was interrupted before completion",
      finishedAt: attempt.finishedAt ?? restoredAt
    };
  });
  return true;
}

export function hasFailedAttempt(report, blockIndexes) {
  const key = attemptKey(blockIndexes);
  return report.attempts.some(
    (attempt) => attempt.status === "failed" && Array.isArray(attempt.blockIndexes) && attemptKey(attempt.blockIndexes) === key
  );
}

export function recordReductionAttempt(report, attempt) {
  const entry = {
    id: nextAttemptId(report),
    pass: attempt.pass,
    blockIndexes: [...attempt.blockIndexes],
    selector: attempt.selector,
    seedReason: attempt.seedReason,
    status: "verifying",
    reason: null,
    byteDelta: attempt.byteDelta,
    ruleDelta: attempt.ruleDelta,
    previousMetrics: attempt.previousMetrics,
    candidateMetrics: attempt.candidateMetrics,
    verify: null,
    metrics: attempt.candidateMetrics,
    startedAt: attempt.startedAt ?? new Date().toISOString(),
    finishedAt: null
  };
  report.attempts.push(entry);
  return entry;
}

export function finishReductionAttempt(report, attemptId, result) {
  const attempt = report.attempts.find((candidate) => candidate.id === attemptId);
  if (!attempt) return null;
  attempt.status = result.status ?? (result.accepted ? "passed" : "failed");
  attempt.reason = result.reason ?? null;
  attempt.verify = result.verify ?? null;
  attempt.finishedAt = result.finishedAt ?? new Date().toISOString();
  return attempt;
}

export function recordSkippedReductionAttempt(report, attempt) {
  const entry = {
    id: nextAttemptId(report),
    pass: attempt.pass,
    blockIndexes: [...attempt.blockIndexes],
    selector: attempt.selector,
    seedReason: attempt.seedReason,
    status: "skipped",
    reason: attempt.reason,
    verify: null,
    startedAt: attempt.startedAt ?? new Date().toISOString(),
    finishedAt: attempt.finishedAt ?? new Date().toISOString()
  };
  report.attempts.push(entry);
  return entry;
}

function isBetterCheckpoint(current, candidate) {
  if (!current) return true;
  if (candidate.metrics.cssBytes !== current.metrics.cssBytes) {
    return candidate.metrics.cssBytes < current.metrics.cssBytes;
  }
  return candidate.metrics.cssRuleCount < current.metrics.cssRuleCount;
}

export function recordPassingCheckpoint(report, checkpoint) {
  const normalized = {
    pass: checkpoint.pass,
    removedBlockIndexes: [...checkpoint.removedBlockIndexes],
    metrics: checkpoint.metrics,
    routeCssSha256: checkpoint.routeCssSha256,
    routeCssPath: checkpoint.routeCssPath,
    reportPath: checkpoint.reportPath,
    verify: checkpoint.verify
  };
  if (isBetterCheckpoint(report.bestPassingCandidate, normalized)) {
    report.bestPassingCandidate = normalized;
    report.bestMetrics = normalized.metrics;
    if (typeof checkpoint.routeCss === "string") {
      report._bestPassingCss = checkpoint.routeCss;
    }
  }
  return report.bestPassingCandidate;
}

export function restoreBestPassingCheckpoint(report, existingReport, fullRouteCss = createFullRouteCss()) {
  const checkpoint = existingReport?.bestPassingCandidate;
  if (!checkpoint?.removedBlockIndexes || !checkpoint?.metrics || !checkpoint.routeCssSha256) {
    return false;
  }

  const routeCss = createRouteCssFromRemovedIndexes(checkpoint.removedBlockIndexes, fullRouteCss);
  if (sha256(routeCss) !== checkpoint.routeCssSha256) {
    return false;
  }

  recordPassingCheckpoint(report, {
    ...checkpoint,
    routeCss
  });
  return true;
}

function terminalFailureReason(finalVerification, finalTrace) {
  if (!finalVerification.ok) return finalVerification.output || "final equivalence failed";
  if (!finalTrace.ok) return finalTrace.output || "final performance failed";
  return null;
}

export function applyTerminalGates(report, { finalVerification, finalTrace }) {
  report.finalVerification = finalVerification;
  report.equivalence = finalVerification.ok ? terminalPassValues.equivalence : "fail";
  report.finalTrace = finalTrace;
  report.performance = finalTrace.ok ? terminalPassValues.performance : "fail";
  report.terminalGate = {
    equivalence: report.equivalence,
    performance: report.performance
  };
  report.terminalFailureReason = terminalFailureReason(finalVerification, finalTrace);
  return report;
}

export function shouldRunTerminalGates(report) {
  return !report.stoppedByMaxVerifications;
}

export function markTerminalGatesSkipped(report, reason) {
  report.finalVerification = null;
  report.equivalence = "not-run";
  report.finalTrace = null;
  report.performance = "not-run";
  report.terminalGate = {
    equivalence: "skipped",
    performance: "skipped"
  };
  report.terminalFailureReason = reason;
  return report;
}

export function selectTerminalRouteCss(report, preRunRouteCss, fullRouteCss) {
  return report._bestPassingCss ?? preRunRouteCss ?? fullRouteCss;
}

export async function tryCandidateGroup({ pass, candidates, seedReason, tryRemoval, maxAttempts }) {
  const attemptLimit = maxAttempts ?? Math.max(1, candidates.length * 2 - 1);
  const pending = [candidates];
  let attempts = 0;
  let acceptedGroups = 0;
  let acceptedCandidates = 0;

  while (pending.length > 0 && attempts < attemptLimit) {
    const current = pending.shift().filter(Boolean);
    if (current.length === 0) continue;

    attempts += 1;
    const accepted = await tryRemoval(pass, current, seedReason);
    if (accepted) {
      acceptedGroups += 1;
      acceptedCandidates += current.length;
      continue;
    }

    if (current.length <= 1) continue;
    const midpoint = Math.floor(current.length / 2);
    const left = current.slice(0, midpoint);
    const right = current.slice(midpoint);
    pending.push(left, right);
  }

  return {
    acceptedGroups,
    acceptedCandidates,
    attempts,
    exhausted: pending.length === 0
  };
}

async function writeReport(report) {
  await mkdir(reportRoot, { recursive: true });
  await writeFile(join(reportRoot, `${report.route}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

async function readExistingReport(route) {
  try {
    return JSON.parse(await readFile(join(reportRoot, `${route}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.route === "unknown" && !args.allowUnknown) {
    throw new Error("Refusing to reduce route=unknown without --allow-unknown");
  }

  const fullRouteCss = createFullRouteCss();
  const blocks = parseTopLevelBlocks(fullRouteCss);
  const removedIndexes = new Set();
  const routeFile = join(routeRoot, `${args.route}.css`);
  const report = createReductionReport(args);
  const existingReport = await readExistingReport(args.route);
  restoreAttemptLedger(report, existingReport);
  const restoredExistingCheckpoint = restoreBestPassingCheckpoint(report, existingReport, fullRouteCss);
  if (restoredExistingCheckpoint) {
    for (const blockIndex of report.bestPassingCandidate.removedBlockIndexes) {
      removedIndexes.add(blockIndex);
    }
  }
  let trustedPreRunRouteCss = report._bestPassingCss;
  try {
    const routeCss = await readFile(routeFile, "utf8");
    if (!trustedPreRunRouteCss && isBaselineDerivedRouteCss(routeCss, fullRouteCss) && sha256(routeCss) === sha256(fullRouteCss)) {
      trustedPreRunRouteCss = routeCss;
    }
  } catch {
    trustedPreRunRouteCss = null;
  }

  await mkdir(routeRoot, { recursive: true });
  if (trustedPreRunRouteCss) {
    await writeFile(routeFile, trustedPreRunRouteCss);
  } else {
    await writeFile(routeFile, fullRouteCss);
  }
  const candidates = await candidateBlocksForRoute(args.route, blocks, args.coverageSeed);
  const candidateGroups = groupCandidates(candidates);
  report.seed = {
    strategy: args.coverageSeed ? "route-exclusive-static-coverage" : "all-blocks",
    groupCount: candidateGroups.length,
    candidates: candidates.map((candidate) => ({
      blockIndex: candidate.block.index,
      selector: summarizeBlock(candidate.block.text),
      reason: candidate.reason,
      bytes: Buffer.byteLength(candidate.block.text)
    }))
  };

  async function tryRemoval(pass, candidatesToRemove, seedReason) {
  const liveCandidates = candidatesToRemove.filter((candidate) => !removedIndexes.has(candidate.block.index));
  if (liveCandidates.length === 0) return false;
  const blockIndexes = liveCandidates.map((candidate) => candidate.block.index);

  if (hasFailedAttempt(report, blockIndexes)) {
    recordSkippedReductionAttempt(report, {
      pass,
      blockIndexes,
      selector: liveCandidates.length === 1 ? summarizeBlock(liveCandidates[0].block.text) : `${seedReason} (${liveCandidates.length} blocks)`,
      seedReason,
      reason: "previously failed"
    });
    await writeReport(report);
    return false;
  }

  const previousCss = createRouteCssFromRemovedIndexes([...removedIndexes], fullRouteCss);
  const previousMetrics = localMetrics(previousCss);
  const candidateRemoved = new Set(removedIndexes);
  for (const candidate of liveCandidates) {
    candidateRemoved.add(candidate.block.index);
  }
  const candidateCss = createRouteCssFromRemovedIndexes([...candidateRemoved], fullRouteCss);
  const candidateMetrics = localMetrics(candidateCss);
  const localReduction = isLocalReduction(previousMetrics, candidateMetrics);
  const entry = {
    pass,
    blockIndexes,
    selector: liveCandidates.length === 1 ? summarizeBlock(liveCandidates[0].block.text) : `${seedReason} (${liveCandidates.length} blocks)`,
    seedReason,
    byteDelta: previousMetrics.cssBytes - candidateMetrics.cssBytes,
    ruleDelta: previousMetrics.cssRuleCount - candidateMetrics.cssRuleCount,
    previousMetrics,
    candidateMetrics
  };

  if (!localReduction) {
    const attempt = recordReductionAttempt(report, {
      ...entry,
      startedAt: new Date().toISOString()
    });
    finishReductionAttempt(report, attempt.id, {
      accepted: false,
      reason: "local metrics did not reduce",
      verify: null
    });
    report.failures.push({
      ...entry,
      reason: "local metrics did not reduce"
    });
    await writeReport(report);
    return false;
  }

  if (args.maxVerifications !== null && report.verificationsRun >= args.maxVerifications) {
    report.stoppedByMaxVerifications = true;
    recordSkippedReductionAttempt(report, {
      pass,
      blockIndexes,
      selector: entry.selector,
      seedReason,
      reason: "max verifications reached"
    });
    await writeReport(report);
    return false;
  }

  await writeFile(routeFile, candidateCss);
  runCommand("node scripts/build-liquid-glass-candidate.mjs");
  const attempt = recordReductionAttempt(report, {
    ...entry,
    startedAt: new Date().toISOString()
  });
  await writeReport(report);
  const verify = runCommand(args.verifyCommand);
  report.verificationsRun += 1;
  finishReductionAttempt(report, attempt.id, {
    accepted: verify.ok,
    reason: verify.ok ? "verify command passed" : "verify command failed",
    verify
  });
  if (verify.ok) {
    for (const candidate of liveCandidates) {
      removedIndexes.add(candidate.block.index);
    }
    report.removed.push({ ...entry, verify });
    recordPassingCheckpoint(report, {
      pass,
      removedBlockIndexes: [...candidateRemoved],
      metrics: candidateMetrics,
      routeCssSha256: sha256(candidateCss),
      routeCssPath: `src/theming/themes/liquid-glass/routes/${args.route}.css`,
      reportPath: `.omx/liquid-glass-route-reduction/${args.route}.json`,
      routeCss: candidateCss,
      verify
    });
    await writeReport(report);
    return true;
  }

  await writeFile(routeFile, selectTerminalRouteCss(report, null, createRouteCssFromRemovedIndexes([...removedIndexes], fullRouteCss)));
  report.failures.push({
    ...entry,
    verify,
    reason: "verify command failed"
  });
  await writeReport(report);
  return false;
}

for (let pass = 1; pass <= args.maxPasses; pass += 1) {
  let removedThisPass = 0;
  if (pass === 1) {
    const beforeSeed = removedIndexes.size;
    if (args.fullSeedOnly) {
      await tryRemoval(pass, candidates, "coverage-seed:all");
    } else {
      await tryCandidateGroup({
        pass,
        candidates,
        seedReason: "coverage-seed:all",
        tryRemoval,
        maxAttempts: args.maxSplitAttempts
      });
    }
    removedThisPass += removedIndexes.size - beforeSeed;
  }
  if (args.fullSeedOnly) {
    report.passes.push({ pass, removed: removedThisPass });
    report.removedInFinalPass = removedThisPass;
    break;
  }
  for (const group of candidateGroups) {
    const beforeGroup = removedIndexes.size;
    await tryCandidateGroup({
      pass,
      candidates: group.candidates,
      seedReason: group.reason,
      tryRemoval,
      maxAttempts: args.maxSplitAttempts
    });
    removedThisPass += removedIndexes.size - beforeGroup;
  }
  report.passes.push({ pass, removed: removedThisPass });
  report.removedInFinalPass = removedThisPass;
  if (removedThisPass === 0) break;
}

report.kept = blocks
  .filter((block) => !removedIndexes.has(block.index))
  .map((block) => ({ blockIndex: block.index, selector: summarizeBlock(block.text), bytes: Buffer.byteLength(block.text) }));

await writeFile(routeFile, selectTerminalRouteCss(report, null, createRouteCssFromRemovedIndexes([...removedIndexes], fullRouteCss)));
if (shouldRunTerminalGates(report)) {
  runCommand("node scripts/build-liquid-glass-candidate.mjs");
  report.finalGateStartedAt = new Date().toISOString();
  await writeReport(report);
  const finalVerification = runCommand(args.verifyCommand);
  const finalTrace = finalVerification.ok
    ? runCommand(args.traceCommand)
    : { ok: false, durationMs: 0, output: "Skipped because final verification failed" };
  applyTerminalGates(report, { finalVerification, finalTrace });
} else {
  markTerminalGatesSkipped(report, "max verifications reached");
}
await writeReport(report);
console.log(`Reduced ${args.route}: removed ${report.removed.length}/${blocks.length} blocks`);
if (report.equivalence !== "pass" || report.performance !== "pass") {
  throw new Error(`Reduction terminal gates failed for ${args.route}: equivalence=${report.equivalence}, performance=${report.performance}`);
}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
