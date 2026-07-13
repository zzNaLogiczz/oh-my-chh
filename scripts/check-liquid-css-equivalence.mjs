import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptRoot, "..");
const reportPath = join(projectRoot, ".omx/liquid-glass-equivalence/report.json");
const MAX_SCREENSHOT_CHANGED_PIXEL_RATIO = 0.0005;
const MAX_SCREENSHOT_CHANNEL_DELTA = 3;

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
  const exited = new Promise((resolveExit) => {
    child.once("exit", resolveExit);
  });
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
  if (!binary) {
    throw new Error("Browser equivalence was not verified: Chrome was not found. Set CHROME_PATH or install Google Chrome.");
  }
  const userDataDir = await mkdtemp(join(tmpdir(), "omchh-liquid-chrome-"));
  const port = 9222 + Math.floor(Math.random() * 1000);
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
    error.message = `Browser equivalence was not verified: ${error.message}${stderr ? `\nChrome stderr:\n${stderr.slice(-4000)}` : ""}`;
    throw error;
  } finally {
    await terminateChrome(child);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodePng(base64) {
  const buffer = Buffer.from(base64, "base64");
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("Unsupported screenshot format: expected PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = readUInt32(buffer, offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = readUInt32(data, 0);
      height = readUInt32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  let previous = Buffer.alloc(rowLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + rowLength));
    sourceOffset += rowLength;

    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x] ?? 0;
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 0xff;
      else if (filter === 2) row[x] = (row[x] + up) & 0xff;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) row[x] = (row[x] + paethPredictor(left, up, upperLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
    }

    for (let x = 0; x < width; x += 1) {
      const rowIndex = x * channels;
      const pixelIndex = (y * width + x) * 4;
      pixels[pixelIndex] = row[rowIndex];
      pixels[pixelIndex + 1] = row[rowIndex + 1];
      pixels[pixelIndex + 2] = row[rowIndex + 2];
      pixels[pixelIndex + 3] = channels === 4 ? row[rowIndex + 3] : 255;
    }

    previous = row;
  }

  return { width, height, pixels, byteLength: buffer.length, sha256: sha256(buffer) };
}

function compareScreenshots(baselineBase64, candidateBase64) {
  if (baselineBase64 === candidateBase64) return null;

  const baseline = decodePng(baselineBase64);
  const candidate = decodePng(candidateBase64);
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    return { baseline, candidate, dimensionsDiffer: true };
  }

  let changedPixels = 0;
  let maxChannelDelta = 0;
  let totalChannelDelta = 0;
  for (let index = 0; index < baseline.pixels.length; index += 4) {
    let pixelChanged = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(baseline.pixels[index + channel] - candidate.pixels[index + channel]);
      if (delta > 0) {
        pixelChanged = true;
        maxChannelDelta = Math.max(maxChannelDelta, delta);
        totalChannelDelta += delta;
      }
    }
    if (pixelChanged) changedPixels += 1;
  }

  const changedPixelRatio = changedPixels / (baseline.width * baseline.height);
  if (changedPixels === 0 || (changedPixelRatio <= MAX_SCREENSHOT_CHANGED_PIXEL_RATIO && maxChannelDelta <= MAX_SCREENSHOT_CHANNEL_DELTA)) {
    return null;
  }

  return {
    baselineSha256: baseline.sha256,
    candidateSha256: candidate.sha256,
    baselineBytes: baseline.byteLength,
    candidateBytes: candidate.byteLength,
    width: baseline.width,
    height: baseline.height,
    changedPixels,
    changedPixelRatio,
    maxChannelDelta,
    totalChannelDelta
  };
}

function cssOrder(css) {
  const summaries = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.matchAll(rulePattern)) {
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
    if (!selector || selector.startsWith("@")) continue;
    const declarations = match[2].split(";").map((part) => part.trim()).filter(Boolean);
    summaries.push({ selector, declarations });
  }
  return summaries;
}

function compareCssOrder(baselineCss, candidateCss) {
  const baselineOrder = cssOrder(baselineCss);
  const candidateOrder = cssOrder(candidateCss);
  const deltas = [];
  let baselineCursor = 0;

  for (let candidateIndex = 0; candidateIndex < candidateOrder.length; candidateIndex += 1) {
    const candidate = candidateOrder[candidateIndex];
    const candidateDeclarations = candidate.declarations.join(";");
    let foundIndex = -1;

    for (let baselineIndex = baselineCursor; baselineIndex < baselineOrder.length; baselineIndex += 1) {
      const baseline = baselineOrder[baselineIndex];
      if (baseline.selector === candidate.selector && baseline.declarations.join(";") === candidateDeclarations) {
        foundIndex = baselineIndex;
        break;
      }
    }

    if (foundIndex === -1) {
      deltas.push({
        candidateIndex,
        baselineCursor,
        candidate,
        reason: "candidate rule is absent from baseline or reordered before its baseline position"
      });
      if (deltas.length >= 50) break;
    } else {
      baselineCursor = foundIndex + 1;
    }
  }
  return deltas;
}

function injectCss(html, css) {
  const style = `<style id="omchh-equivalence-css">\n${css.replaceAll("</style", "<\\/style")}\n</style><style id="omchh-equivalence-harness">*{caret-color:transparent!important;}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
}

function stateScript(route, state, scrollPosition, interaction) {
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
      window.scrollTo(${Number(scrollPosition.x)}, ${Number(scrollPosition.y)});
      const skipped = [];
      const interaction = ${JSON.stringify(interaction)};
      if (interaction === "focus-first-link") {
        const target = document.querySelector("a, button, input, textarea, select");
        if (target) target.focus(); else skipped.push("focus-first-link");
      } else if (interaction === "hover-header-account") {
        const target = document.querySelector("#chh-lg-header #g_upmine");
        if (target) {
          const rect = target.getBoundingClientRect();
          return { skipped, hover: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
        }
        skipped.push("hover-header-account");
      } else if (interaction === "open-quick-nav") {
        const target = document.querySelector("#qmenu_menu");
        if (target) target.style.display = "block"; else skipped.push("open-quick-nav");
      } else if (interaction === "open-reply-editor") {
        const target = document.querySelector("#fastpostform textarea, #fastpostform [contenteditable=true]");
        if (target) target.focus(); else skipped.push("open-reply-editor");
      }
      return { skipped };
    })()
  `;
}

function snapshotScript(targets, properties) {
  return `
    (() => {
      const properties = ${JSON.stringify(properties)};
      const targets = ${JSON.stringify(targets)};
      const readStyle = (element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return Object.fromEntries(properties.map((property) => [property, style[property] ?? style.getPropertyValue(property)]));
      };
      return targets.map((selector) => {
        const elements = [...document.querySelectorAll(selector)];
        return {
          selector,
          count: elements.length,
          computed: elements.map((element) => readStyle(element, null)),
          before: elements.map((element) => readStyle(element, "::before")),
          after: elements.map((element) => readStyle(element, "::after"))
        };
      });
    })()
  `;
}

async function loadAndCapture(page, html, route, state, viewport, scrollPosition, interaction, targets, properties) {
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
  await page.command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
  await delay(20);
  const setup = await page.command("Runtime.evaluate", {
    expression: stateScript(route, state, scrollPosition, interaction),
    awaitPromise: true,
    returnByValue: true
  });
  const setupValue = setup.result.value ?? {};
  if (setupValue.hover) {
    await page.command("Input.dispatchMouseEvent", { type: "mouseMoved", x: setupValue.hover.x, y: setupValue.hover.y });
  }
  await delay(250);
  const snapshot = await page.command("Runtime.evaluate", {
    expression: snapshotScript(targets, properties),
    awaitPromise: true,
    returnByValue: true
  });
  const screenshot = await page.command("Page.captureScreenshot", { format: "png", fromSurface: true });
  return {
    skippedInteractions: setupValue.skipped ?? [],
    computed: snapshot.result.value,
    screenshot: screenshot.data
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectStyleDeltas(baseline, candidate) {
  const computed = [];
  const pseudo = [];
  for (let index = 0; index < baseline.length; index += 1) {
    const baseTarget = baseline[index];
    const candidateTarget = candidate[index];
    if (!deepEqual(baseTarget.computed, candidateTarget.computed)) {
      computed.push({ selector: baseTarget.selector, baseline: baseTarget.computed, candidate: candidateTarget.computed });
    }
    if (!deepEqual(baseTarget.before, candidateTarget.before)) {
      pseudo.push({ selector: baseTarget.selector, pseudo: "::before", baseline: baseTarget.before, candidate: candidateTarget.before });
    }
    if (!deepEqual(baseTarget.after, candidateTarget.after)) {
      pseudo.push({ selector: baseTarget.selector, pseudo: "::after", baseline: baseTarget.after, candidate: candidateTarget.after });
    }
  }
  return { computed, pseudo };
}

const args = parseArgs(process.argv.slice(2));
run("npm", ["run", "build"]);
run("node", ["scripts/build-liquid-glass-candidate.mjs"]);

const fixture = JSON.parse(await readFile(join(projectRoot, "test/fixtures/liquid-glass-017-runtime-equivalence.json"), "utf8"));
const routes = args.route ? fixture.routes.filter((route) => route === args.route) : fixture.routes;
if (args.route && routes.length === 0) throw new Error(`Unknown route in fixture: ${args.route}`);

const baselineCss = await readFile(args.baseline, "utf8");
const candidateIndexCss = await readFile(join(args.candidate, "index.css"), "utf8");
const report = {
  generatedAt: new Date().toISOString(),
  baseline: args.baseline,
  candidate: args.candidate,
  routes: [],
  failures: []
};

await withChrome(async (page) => {
  for (const route of routes) {
    const candidateRouteCss = await readFile(join(args.candidate, "routes", `${route}.css`), "utf8");
    const candidateCss = `${candidateIndexCss}\n${candidateRouteCss}`;
    const routeReport = {
      route,
      baselineSha256: sha256(baselineCss),
      candidateSha256: sha256(candidateCss),
      cssOrderDeltas: compareCssOrder(baselineCss, candidateCss),
      states: []
    };
    const fixtureHtml = await readFile(join(projectRoot, fixture.domFixtures[route]), "utf8");
    const baselineHtml = injectCss(fixtureHtml, baselineCss);
    const candidateHtml = injectCss(fixtureHtml, candidateCss);
    for (const state of fixture.states) {
      for (const viewport of fixture.viewports) {
        for (const scrollPosition of fixture.scrollPositions) {
          for (const interaction of fixture.interactionStates) {
            const baselineCapture = await loadAndCapture(page, baselineHtml, route, state, viewport, scrollPosition, interaction, fixture.targets, fixture.styleProperties);
            const candidateCapture = await loadAndCapture(page, candidateHtml, route, state, viewport, scrollPosition, interaction, fixture.targets, fixture.styleProperties);
            const styleDeltas = collectStyleDeltas(baselineCapture.computed, candidateCapture.computed);
            const screenshotDelta = compareScreenshots(baselineCapture.screenshot, candidateCapture.screenshot);
            const entry = {
              route,
              state: state.name,
              viewport: viewport.name,
              scrollPosition: scrollPosition.name,
              interaction,
              skippedInteractions: [...new Set([...baselineCapture.skippedInteractions, ...candidateCapture.skippedInteractions])].map((name) => ({ route, interaction: name })),
              computedStyleDeltas: styleDeltas.computed,
              pseudoDeltas: styleDeltas.pseudo,
              screenshotDelta,
              cssOrderDeltas: routeReport.cssOrderDeltas
            };
            routeReport.states.push(entry);
            if (entry.computedStyleDeltas.length > 0 || entry.pseudoDeltas.length > 0 || entry.screenshotDelta || routeReport.cssOrderDeltas.length > 0) {
              report.failures.push(entry);
            }
          }
        }
      }
    }
    report.routes.push(routeReport);
  }
});

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (report.failures.length > 0) {
  throw new Error(`Liquid Glass CSS equivalence failed for ${report.failures.length} scenario(s). See ${reportPath}`);
}

console.log(`Liquid Glass CSS equivalence passed for ${routes.length} route(s). Report: ${reportPath}`);
