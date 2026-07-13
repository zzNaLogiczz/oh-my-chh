import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptRoot, "..");
const reportPath = join(projectRoot, ".omx/liquid-glass-performance/report.json");
const MIN_KNOWN_ROUTE_BYTE_REDUCTION_PERCENT = 35;
const MIN_KNOWN_ROUTE_RULE_REDUCTION_PERCENT = 30;
const MIN_AGGREGATE_STYLE_READY_IMPROVEMENT_PERCENT = 10;
const MAX_FIRST_STYLE_READY_REGRESSION_PERCENT = 2;
const knownRoutes = new Set([
  "portal-home",
  "forum-index",
  "thread-list",
  "thread-detail",
  "article-view",
  "profile",
  "settings",
  "messages",
  "compose"
]);

function parseArgs(argv) {
  const args = {
    baseline: join(projectRoot, "dist/themes/liquid-glass/index.css"),
    candidate: join(projectRoot, "dist-candidate/themes/liquid-glass"),
    route: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--baseline") {
      args.baseline = resolve(projectRoot, argv[++index]);
    } else if (arg === "--candidate") {
      args.candidate = resolve(projectRoot, argv[++index]);
    } else if (arg === "--route") {
      args.route = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit" });
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(macChrome)) return macChrome;
  return null;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function terminateChrome(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  await Promise.race([exited, delay(3000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, delay(1000)]);
  }
}

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function waitForChrome(port, child) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Chrome exited before DevTools was ready with code ${child.exitCode}`);
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw new Error(`Chrome DevTools was not ready: ${lastError?.message ?? "unknown error"}`);
}

async function openPage(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener("open", resolveOpen, { once: true });
    ws.addEventListener("error", rejectOpen, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolveCommand, rejectCommand } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCommand(new Error(message.error.message));
      else resolveCommand(message.result);
    }
  });
  async function command(method, params = {}) {
    const commandId = ++id;
    ws.send(JSON.stringify({ id: commandId, method, params }));
    return new Promise((resolveCommand, rejectCommand) => {
      pending.set(commandId, { resolveCommand, rejectCommand });
    });
  }
  await command("Page.enable");
  await command("Runtime.enable");
  return { ws, command };
}

async function withChrome(callback) {
  const binary = chromePath();
  if (!binary) throw new Error("browser performance trace was not verified");
  const userDataDir = await mkdtemp(join(tmpdir(), "omchh-liquid-perf-"));
  const port = 10222 + Math.floor(Math.random() * 1000);
  const child = spawn(binary, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  try {
    await waitForChrome(port, child);
    const page = await openPage(port);
    try {
      return await callback(page);
    } finally {
      page.ws.close();
    }
  } catch (error) {
    error.message = `browser performance trace was not verified: ${error.message}${stderr ? `\nChrome stderr:\n${stderr.slice(-4000)}` : ""}`;
    throw error;
  } finally {
    await terminateChrome(child);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function injectCss(html, css) {
  const style = `<style id="omchh-performance-css">\n${css.replaceAll("</style", "<\\/style")}\n</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
}

function stateScript(route, state) {
  return `
    (() => {
      const root = document.documentElement;
      root.dataset.omchhEnabled = "1";
      root.dataset.omchhTheme = "liquid-glass";
      root.dataset.omchhRoute = ${JSON.stringify(route)};
      root.dataset.omchhDensity = ${JSON.stringify(state.density)};
      root.dataset.omchhScheme = ${JSON.stringify(state.scheme)};
      root.dataset.omchhMotion = ${JSON.stringify(state.reduceMotion ? "reduce" : "normal")};
      root.dataset.omchhReduceGlass = ${JSON.stringify(state.reduceGlass ? "1" : "0")};
      document.body?.classList.add("chh-liquid-glass");
    })()
  `;
}

async function captureMetrics(page, html, route, state, viewport) {
  await page.command("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600
  });
  await page.command("Runtime.evaluate", {
    expression: `
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
    `,
    awaitPromise: true
  });
  await page.command("Runtime.evaluate", {
    expression: stateScript(route, state),
    awaitPromise: true
  });
  const metrics = await page.command("Runtime.evaluate", {
    expression: `
      (() => {
        const started = performance.now();
        const elements = [document.documentElement, document.body, ...document.querySelectorAll("#ct, .bm, #postlist, #chh-lg-header, a, button")].filter(Boolean).slice(0, 250);
        let checksum = 0;
        for (const element of elements) {
          const style = getComputedStyle(element);
          checksum += style.cssText.length + (style.backgroundColor || "").length + (style.color || "").length;
        }
        const firstStyleReadyMs = performance.now();
        void document.body.offsetHeight;
        const styleReadyDurationMs = performance.now() - started;
        const sheets = [...document.styleSheets];
        const cssRuleCount = sheets.reduce((count, sheet) => {
          try {
            return count + sheet.cssRules.length;
          } catch {
            return count;
          }
        }, 0);
        const longTasks = performance.getEntriesByType("longtask");
        const totalBlockingScriptMs = longTasks.reduce((total, entry) => total + Math.max(0, entry.duration - 50), 0);
        return { checksum, cssRuleCount, firstStyleReadyMs, styleReadyDurationMs, totalBlockingScriptMs };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  const screenshot = await page.command("Page.captureScreenshot", { format: "png", fromSurface: true });
  return {
    ...metrics.result.value,
    screenshotSha256: sha256(screenshot.data)
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentReduction(baseline, candidate) {
  if (baseline === 0) return candidate === 0 ? 0 : -Infinity;
  return Number((((baseline - candidate) / baseline) * 100).toFixed(3));
}

function percentChange(baseline, candidate) {
  if (baseline === 0) return candidate === 0 ? 0 : Infinity;
  return Number((((candidate - baseline) / baseline) * 100).toFixed(3));
}

function compactMetric(metric) {
  return {
    cssRuleCount: metric.cssRuleCount,
    styleReadyDurationMs: Number(metric.styleReadyDurationMs.toFixed(3)),
    firstStyleReadyMs: Number(metric.firstStyleReadyMs.toFixed(3)),
    totalBlockingScriptMs: Number(metric.totalBlockingScriptMs.toFixed(3)),
    screenshotSha256: metric.screenshotSha256
  };
}

function equivalenceArgs(args) {
  const result = ["scripts/check-liquid-css-equivalence.mjs", "--baseline", args.baseline, "--candidate", args.candidate];
  if (args.route) result.push("--route", args.route);
  return result;
}

const args = parseArgs(process.argv.slice(2));
run("npm", ["run", "build"]);
run("node", ["scripts/build-liquid-glass-candidate.mjs"]);
run("node", equivalenceArgs(args));

const fixture = JSON.parse(await readFile(join(projectRoot, "test/fixtures/liquid-glass-017-runtime-equivalence.json"), "utf8"));
const routes = args.route ? fixture.routes.filter((route) => route === args.route) : fixture.routes;
if (args.route && routes.length === 0) throw new Error(`Unknown route in fixture: ${args.route}`);

const baselineCss = await readFile(args.baseline, "utf8");
const candidateIndexCss = await readFile(join(args.candidate, "index.css"), "utf8");
const report = {
  generatedAt: new Date().toISOString(),
  baseline: args.baseline,
  candidate: args.candidate,
  budgets: {
    minKnownRouteByteReductionPercent: MIN_KNOWN_ROUTE_BYTE_REDUCTION_PERCENT,
    minKnownRouteRuleReductionPercent: MIN_KNOWN_ROUTE_RULE_REDUCTION_PERCENT,
    minAggregateStyleReadyImprovementPercent: MIN_AGGREGATE_STYLE_READY_IMPROVEMENT_PERCENT,
    maxFirstStyleReadyRegressionPercent: MAX_FIRST_STYLE_READY_REGRESSION_PERCENT
  },
  aggregate: {},
  routes: [],
  failures: []
};

await withChrome(async (page) => {
  for (const route of routes) {
    const candidateRouteCss = await readFile(join(args.candidate, "routes", `${route}.css`), "utf8");
    const candidateCss = `${candidateIndexCss}\n${candidateRouteCss}`;
    const routeReport = {
      route,
      baseline: {
        cssBytes: Buffer.byteLength(baselineCss),
        cssRuleCountMedian: 0,
        styleReadyMedianMs: 0
      },
      candidate: {
        cssBytes: Buffer.byteLength(candidateCss),
        cssRuleCountMedian: 0,
        styleReadyMedianMs: 0,
        firstStyleReadyMedianMs: 0
      },
      deltas: {},
      samples: []
    };
    const fixtureHtml = await readFile(join(projectRoot, fixture.domFixtures[route]), "utf8");
    const baselineHtml = injectCss(fixtureHtml, baselineCss);
    const candidateHtml = injectCss(fixtureHtml, candidateCss);
    const baselineStyleDurations = [];
    const candidateStyleDurations = [];
    const baselineRuleCounts = [];
    const candidateRuleCounts = [];
    const baselineFirstStyleReady = [];
    const candidateFirstStyleReady = [];

    for (const state of fixture.states) {
      for (const viewport of fixture.viewports) {
        const baselineMetric = await captureMetrics(page, baselineHtml, route, state, viewport);
        const candidateMetric = await captureMetrics(page, candidateHtml, route, state, viewport);
        baselineStyleDurations.push(baselineMetric.styleReadyDurationMs);
        candidateStyleDurations.push(candidateMetric.styleReadyDurationMs);
        baselineRuleCounts.push(baselineMetric.cssRuleCount);
        candidateRuleCounts.push(candidateMetric.cssRuleCount);
        baselineFirstStyleReady.push(baselineMetric.firstStyleReadyMs);
        candidateFirstStyleReady.push(candidateMetric.firstStyleReadyMs);
        if (routeReport.samples.length < 4) {
          routeReport.samples.push({
            state: state.name,
            viewport: viewport.name,
            baseline: compactMetric(baselineMetric),
            candidate: compactMetric(candidateMetric)
          });
        }
      }
    }

    routeReport.baseline.cssRuleCountMedian = median(baselineRuleCounts);
    routeReport.baseline.styleReadyMedianMs = Number(median(baselineStyleDurations).toFixed(3));
    routeReport.baseline.firstStyleReadyMedianMs = Number(median(baselineFirstStyleReady).toFixed(3));
    routeReport.candidate.cssRuleCountMedian = median(candidateRuleCounts);
    routeReport.candidate.styleReadyMedianMs = Number(median(candidateStyleDurations).toFixed(3));
    routeReport.candidate.firstStyleReadyMedianMs = Number(median(candidateFirstStyleReady).toFixed(3));
    routeReport.deltas.cssBytes = routeReport.candidate.cssBytes - routeReport.baseline.cssBytes;
    routeReport.deltas.cssByteReductionPercent = percentReduction(routeReport.baseline.cssBytes, routeReport.candidate.cssBytes);
    routeReport.deltas.cssRuleReductionPercent = percentReduction(routeReport.baseline.cssRuleCountMedian, routeReport.candidate.cssRuleCountMedian);
    routeReport.deltas.styleReadyImprovementPercent = percentReduction(routeReport.baseline.styleReadyMedianMs, routeReport.candidate.styleReadyMedianMs);
    routeReport.deltas.styleReadyMedianPercent = percentChange(routeReport.baseline.styleReadyMedianMs, routeReport.candidate.styleReadyMedianMs);
    routeReport.deltas.firstStyleReadyRegressionPercent = percentChange(routeReport.baseline.firstStyleReadyMedianMs, routeReport.candidate.firstStyleReadyMedianMs);

    if (knownRoutes.has(route) && routeReport.candidate.cssBytes >= routeReport.baseline.cssBytes) {
      report.failures.push({ route, reason: "known-route candidate CSS byte count is not lower than baseline", baselineBytes: routeReport.baseline.cssBytes, candidateBytes: routeReport.candidate.cssBytes });
    }
    if (knownRoutes.has(route) && routeReport.deltas.cssByteReductionPercent < MIN_KNOWN_ROUTE_BYTE_REDUCTION_PERCENT) {
      report.failures.push({
        route,
        reason: "known-route CSS byte reduction is below 35%",
        baselineBytes: routeReport.baseline.cssBytes,
        candidateBytes: routeReport.candidate.cssBytes,
        reductionPercent: routeReport.deltas.cssByteReductionPercent
      });
    }
    if (knownRoutes.has(route) && routeReport.deltas.cssRuleReductionPercent < MIN_KNOWN_ROUTE_RULE_REDUCTION_PERCENT) {
      report.failures.push({
        route,
        reason: "known-route CSS rule-count reduction is below 30%",
        baselineRuleCount: routeReport.baseline.cssRuleCountMedian,
        candidateRuleCount: routeReport.candidate.cssRuleCountMedian,
        reductionPercent: routeReport.deltas.cssRuleReductionPercent
      });
    }
    if (knownRoutes.has(route) && routeReport.deltas.firstStyleReadyRegressionPercent > MAX_FIRST_STYLE_READY_REGRESSION_PERCENT) {
      report.failures.push({ route, reason: "known-route first style-ready median regressed by more than 2%", deltaPercent: routeReport.deltas.firstStyleReadyRegressionPercent });
    }
    report.routes.push(routeReport);
  }
});

const aggregateKnownRoutes = report.routes.filter((routeReport) => knownRoutes.has(routeReport.route));
if (aggregateKnownRoutes.length > 0) {
  const baselineMedian = median(aggregateKnownRoutes.map((routeReport) => routeReport.baseline.styleReadyMedianMs));
  const candidateMedian = median(aggregateKnownRoutes.map((routeReport) => routeReport.candidate.styleReadyMedianMs));
  report.aggregate = {
    knownRouteCount: aggregateKnownRoutes.length,
    baselineStyleReadyMedianMs: Number(baselineMedian.toFixed(3)),
    candidateStyleReadyMedianMs: Number(candidateMedian.toFixed(3)),
    styleReadyImprovementPercent: percentReduction(baselineMedian, candidateMedian)
  };
  if (report.aggregate.styleReadyImprovementPercent < MIN_AGGREGATE_STYLE_READY_IMPROVEMENT_PERCENT) {
    report.failures.push({
      route: "aggregate",
      reason: "aggregate style-ready median improvement is below 10%",
      baselineStyleReadyMedianMs: report.aggregate.baselineStyleReadyMedianMs,
      candidateStyleReadyMedianMs: report.aggregate.candidateStyleReadyMedianMs,
      improvementPercent: report.aggregate.styleReadyImprovementPercent
    });
  }
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (report.failures.length > 0) {
  throw new Error(`Liquid Glass CSS performance failed for ${report.failures.length} route(s). See ${reportPath}`);
}

console.log(`Liquid Glass CSS performance passed for ${routes.length} route(s). Report: ${reportPath}`);
