export const MONITORING_LOG_MAX_BYTES = 5 * 1024 * 1024;
export const MONITORING_LOG_STORAGE_KEY = "omchh:monitoring:log";

export type MonitoringLogLevel = "info" | "warn" | "error";
export type MonitoringFieldValue = string | number | boolean | null;

export interface MonitoringLogEntry {
  timestamp: string;
  level: MonitoringLogLevel;
  source: string;
  message: string;
  route?: string;
  durationMs?: number;
  fields?: Record<string, MonitoringFieldValue>;
}

export interface MonitoringAggregate {
  route: string;
  source: string;
  refreshMode: "full" | "incremental" | "root-only" | "mixed";
  windowStartedAt: string;
  windowEndedAt: string;
  count: number;
  slowCount: number;
  maxDurationMs: number;
  totalDurationMs: number;
  ignoredMutationCount: number;
  dirtyRootCount: number;
  rootWriteCount: number;
}

export interface MonitoringLogExport {
  version: 1;
  generatedAt: string;
  maxBytes: number;
  entryCount: number;
  aggregateCount: number;
  droppedCount: number;
  truncated: boolean;
  entries: MonitoringLogEntry[];
  aggregates: MonitoringAggregate[];
}

export interface MonitoringLogSummary {
  entryCount: number;
  droppedCount: number;
  byteLength: number;
  maxBytes: number;
}

export type MonitoringEventInput = Omit<Partial<MonitoringLogEntry>, "timestamp" | "level" | "source" | "message" | "fields"> & {
  timestamp?: string;
  level?: MonitoringLogLevel;
  source: string;
  message: string;
  fields?: Record<string, unknown>;
};

type StoredMonitoringLog = {
  entries?: unknown;
  aggregates?: unknown;
  droppedCount?: unknown;
  updatedAt?: unknown;
  maxBytes?: unknown;
};

const MAX_SOURCE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 512;
const MAX_FIELD_KEY_LENGTH = 64;
const MAX_FIELD_STRING_LENGTH = 512;
const MAX_FIELD_COUNT = 20;
const MAX_ENTRY_COUNT = 2000;
const SLOW_EVENT_DURATION_MS = 50;
const DEFAULT_FLUSH_DELAY_MS = 5000;
const SLOW_FLUSH_DELAY_MS = 500;
const MAX_AGGREGATE_COUNT = 500;

function encodedLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function clampString(value: unknown, maxLength: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function validTimestamp(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  return new Date().toISOString();
}

function validLevel(value: unknown): MonitoringLogLevel {
  return value === "warn" || value === "error" || value === "info" ? value : "info";
}

function sanitizeFieldValue(value: unknown): MonitoringFieldValue | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? roundNumber(value) : undefined;
  if (typeof value === "string") return clampString(value, MAX_FIELD_STRING_LENGTH);
  if (value === undefined) return undefined;
  return clampString(value, MAX_FIELD_STRING_LENGTH);
}

function sanitizeFields(fields: Record<string, unknown> | undefined): Record<string, MonitoringFieldValue> | undefined {
  if (!fields) return undefined;

  const sanitized: Record<string, MonitoringFieldValue> = {};
  for (const [rawKey, rawValue] of Object.entries(fields).slice(0, MAX_FIELD_COUNT)) {
    const key = clampString(rawKey, MAX_FIELD_KEY_LENGTH);
    if (!key) continue;
    const value = sanitizeFieldValue(rawValue);
    if (value !== undefined) sanitized[key] = value;
  }

  return Object.keys(sanitized).length ? sanitized : undefined;
}

export function normalizeMonitoringEntry(input: MonitoringEventInput | MonitoringLogEntry): MonitoringLogEntry {
  const entry: MonitoringLogEntry = {
    timestamp: validTimestamp(input.timestamp),
    level: validLevel(input.level),
    source: clampString(input.source, MAX_SOURCE_LENGTH) || "unknown",
    message: clampString(input.message, MAX_MESSAGE_LENGTH) || "event"
  };

  if (input.route) entry.route = clampString(input.route, MAX_SOURCE_LENGTH);
  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) entry.durationMs = roundNumber(input.durationMs);

  const fields = sanitizeFields(input.fields);
  if (fields) entry.fields = fields;

  return entry;
}

function normalizeStoredEntry(value: unknown): MonitoringLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MonitoringLogEntry>;
  if (typeof candidate.source !== "string" || typeof candidate.message !== "string") return null;
  return normalizeMonitoringEntry(candidate as MonitoringLogEntry);
}

function normalizeEntries(entries: readonly unknown[]): MonitoringLogEntry[] {
  return entries.map(normalizeStoredEntry).filter((entry): entry is MonitoringLogEntry => entry !== null).slice(-MAX_ENTRY_COUNT);
}

function normalizeAggregate(value: unknown): MonitoringAggregate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MonitoringAggregate>;
  if (typeof candidate.route !== "string" || typeof candidate.source !== "string") return null;
  const refreshMode = candidate.refreshMode === "full" || candidate.refreshMode === "incremental" || candidate.refreshMode === "root-only" || candidate.refreshMode === "mixed" ? candidate.refreshMode : "mixed";
  return {
    route: clampString(candidate.route, MAX_SOURCE_LENGTH) || "unknown",
    source: clampString(candidate.source, MAX_SOURCE_LENGTH) || "unknown",
    refreshMode,
    windowStartedAt: validTimestamp(candidate.windowStartedAt),
    windowEndedAt: validTimestamp(candidate.windowEndedAt),
    count: Math.max(0, Math.round(Number(candidate.count) || 0)),
    slowCount: Math.max(0, Math.round(Number(candidate.slowCount) || 0)),
    maxDurationMs: roundNumber(Number(candidate.maxDurationMs) || 0),
    totalDurationMs: roundNumber(Number(candidate.totalDurationMs) || 0),
    ignoredMutationCount: Math.max(0, Math.round(Number(candidate.ignoredMutationCount) || 0)),
    dirtyRootCount: Math.max(0, Math.round(Number(candidate.dirtyRootCount) || 0)),
    rootWriteCount: Math.max(0, Math.round(Number(candidate.rootWriteCount) || 0))
  };
}

function normalizeAggregates(aggregates: readonly unknown[]): MonitoringAggregate[] {
  return aggregates.map(normalizeAggregate).filter((aggregate): aggregate is MonitoringAggregate => aggregate !== null).slice(-MAX_AGGREGATE_COUNT);
}

function refreshModeFromEntry(entry: MonitoringLogEntry): MonitoringAggregate["refreshMode"] {
  const value = entry.fields?.refreshMode;
  return value === "full" || value === "incremental" || value === "root-only" ? value : "mixed";
}

function numberField(entry: MonitoringLogEntry, field: string): number {
  const value = entry.fields?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function aggregateKey(entry: MonitoringLogEntry): string {
  return [entry.route ?? "unknown", entry.source, refreshModeFromEntry(entry)].join("\u001f");
}

function aggregateForEntry(entry: MonitoringLogEntry): MonitoringAggregate {
  const durationMs = entry.durationMs ?? 0;
  return {
    route: entry.route ?? "unknown",
    source: entry.source,
    refreshMode: refreshModeFromEntry(entry),
    windowStartedAt: entry.timestamp,
    windowEndedAt: entry.timestamp,
    count: 1,
    slowCount: durationMs >= SLOW_EVENT_DURATION_MS ? 1 : 0,
    maxDurationMs: durationMs,
    totalDurationMs: durationMs,
    ignoredMutationCount: numberField(entry, "ignoredMutationCount"),
    dirtyRootCount: numberField(entry, "dirtyRootCount"),
    rootWriteCount: numberField(entry, "rootWriteCount")
  };
}

function mergeAggregate(base: MonitoringAggregate, next: MonitoringAggregate): MonitoringAggregate {
  return {
    ...base,
    refreshMode: base.refreshMode === next.refreshMode ? base.refreshMode : "mixed",
    windowEndedAt: next.windowEndedAt,
    count: base.count + next.count,
    slowCount: base.slowCount + next.slowCount,
    maxDurationMs: Math.max(base.maxDurationMs, next.maxDurationMs),
    totalDurationMs: roundNumber(base.totalDurationMs + next.totalDurationMs),
    ignoredMutationCount: base.ignoredMutationCount + next.ignoredMutationCount,
    dirtyRootCount: base.dirtyRootCount + next.dirtyRootCount,
    rootWriteCount: base.rootWriteCount + next.rootWriteCount
  };
}

function serializeExport(value: MonitoringLogExport): string {
  return JSON.stringify(value, null, 2);
}

export function buildMonitoringLogExport(
  rawEntries: readonly MonitoringLogEntry[],
  opts: { maxBytes?: number; generatedAt?: string; droppedCountOffset?: number; aggregates?: readonly MonitoringAggregate[] } = {}
): MonitoringLogExport {
  const maxBytes = Math.max(256, Math.min(opts.maxBytes ?? MONITORING_LOG_MAX_BYTES, MONITORING_LOG_MAX_BYTES));
  const droppedCountOffset = typeof opts.droppedCountOffset === "number" && Number.isFinite(opts.droppedCountOffset) ? Math.max(0, opts.droppedCountOffset) : 0;
  const originalEntries = normalizeEntries(rawEntries);
  const entries = [...originalEntries];
  const aggregates = normalizeAggregates(opts.aggregates ?? []);
  let droppedCount = 0;
  let truncated = false;

  const createExport = (): MonitoringLogExport => ({
    version: 1,
    generatedAt: validTimestamp(opts.generatedAt),
    maxBytes,
    entryCount: originalEntries.length,
    aggregateCount: aggregates.length,
    droppedCount: droppedCountOffset + droppedCount,
    truncated,
    entries,
    aggregates
  });

  let exported = createExport();
  while (encodedLength(serializeExport(exported)) > maxBytes && entries.length > 0) {
    entries.shift();
    droppedCount += 1;
    truncated = true;
    exported = createExport();
  }

  if (encodedLength(serializeExport(exported)) > maxBytes) {
    entries.splice(0, entries.length);
    droppedCount = originalEntries.length;
    truncated = true;
    exported = createExport();
  }

  return exported;
}

function getLocalStorageArea(): chrome.storage.StorageArea | undefined {
  try {
    return globalThis.chrome?.storage?.local;
  } catch {
    return undefined;
  }
}

function readStorageKey(key: string): Promise<Record<string, unknown>> {
  const storage = getLocalStorageArea();
  if (!storage) return Promise.resolve({});

  return new Promise((resolve) => {
    try {
      storage.get([key], (items) => resolve((items ?? {}) as Record<string, unknown>));
    } catch {
      resolve({});
    }
  });
}

function writeStorageItems(items: Record<string, unknown>): Promise<void> {
  const storage = getLocalStorageArea();
  if (!storage) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      storage.set(items, () => resolve());
    } catch {
      resolve();
    }
  });
}

function removeStorageKey(key: string): Promise<void> {
  const storage = getLocalStorageArea();
  if (!storage) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      storage.remove(key, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function readStoredLog(): Promise<{ entries: MonitoringLogEntry[]; aggregates: MonitoringAggregate[]; droppedCount: number }> {
  const items = await readStorageKey(MONITORING_LOG_STORAGE_KEY);
  const stored = items[MONITORING_LOG_STORAGE_KEY] as StoredMonitoringLog | undefined;
  const entries = Array.isArray(stored?.entries) ? normalizeEntries(stored.entries) : [];
  const aggregates = Array.isArray(stored?.aggregates) ? normalizeAggregates(stored.aggregates) : [];
  const droppedCount = typeof stored?.droppedCount === "number" && Number.isFinite(stored.droppedCount) ? Math.max(0, stored.droppedCount) : 0;
  return { entries, aggregates, droppedCount };
}

async function writeStoredLog(entries: MonitoringLogEntry[], previousDroppedCount = 0, aggregates: MonitoringAggregate[] = []): Promise<void> {
  const exported = buildMonitoringLogExport(entries, { droppedCountOffset: previousDroppedCount, aggregates });
  await writeStorageItems({
    [MONITORING_LOG_STORAGE_KEY]: {
      entries: exported.entries,
      aggregates: exported.aggregates,
      droppedCount: exported.droppedCount,
      updatedAt: new Date().toISOString(),
      maxBytes: MONITORING_LOG_MAX_BYTES
    }
  });
}

let pendingEntries: MonitoringLogEntry[] = [];
let pendingAggregates = new Map<string, MonitoringAggregate>();
let flushTimer: number | undefined;
let writeQueue: Promise<void> = Promise.resolve();

function shouldPersistEntry(entry: MonitoringLogEntry): boolean {
  return entry.level === "error" || entry.level === "warn" || (entry.durationMs ?? 0) >= SLOW_EVENT_DURATION_MS;
}

function queueAggregate(entry: MonitoringLogEntry): void {
  const next = aggregateForEntry(entry);
  const key = aggregateKey(entry);
  const current = pendingAggregates.get(key);
  pendingAggregates.set(key, current ? mergeAggregate(current, next) : next);
}

function scheduleFlush(delayMs: number): void {
  if (flushTimer !== undefined) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    void flushMonitoringLog("timer");
  }, delayMs);
}

export function enqueueMonitoringEvent(input: MonitoringEventInput): void {
  const entry = normalizeMonitoringEntry(input);
  queueAggregate(entry);
  if (shouldPersistEntry(entry)) pendingEntries.push(entry);
  scheduleFlush((entry.durationMs ?? 0) >= SLOW_EVENT_DURATION_MS ? SLOW_FLUSH_DELAY_MS : DEFAULT_FLUSH_DELAY_MS);
}

export function flushMonitoringLog(reason = "manual"): Promise<void> {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  const entriesToFlush = pendingEntries;
  const aggregatesToFlush = [...pendingAggregates.values()];
  pendingEntries = [];
  pendingAggregates = new Map();

  if (!entriesToFlush.length && !aggregatesToFlush.length) return writeQueue;

  writeQueue = writeQueue.then(async () => {
    const stored = await readStoredLog();
    const aggregateMap = new Map(stored.aggregates.map((aggregate) => [[aggregate.route, aggregate.source, aggregate.refreshMode].join("\u001f"), aggregate]));
    aggregatesToFlush.forEach((aggregate) => {
      const key = [aggregate.route, aggregate.source, aggregate.refreshMode].join("\u001f");
      const current = aggregateMap.get(key);
      aggregateMap.set(key, current ? mergeAggregate(current, aggregate) : aggregate);
    });
    const combinedEntries = [...stored.entries, ...entriesToFlush];
    const countOverflow = Math.max(0, combinedEntries.length - MAX_ENTRY_COUNT);
    const entries = combinedEntries.slice(-MAX_ENTRY_COUNT);
    const aggregates = [...aggregateMap.values()].slice(-MAX_AGGREGATE_COUNT);
    await writeStoredLog(entries, stored.droppedCount + countOverflow, aggregates);
    void reason;
  }).catch(() => undefined);
  return writeQueue;
}

export function recordMonitoringEvent(input: MonitoringEventInput): Promise<void> {
  enqueueMonitoringEvent(input);
  return writeQueue;
}

export async function exportMonitoringLogText(): Promise<string> {
  await flushMonitoringLog("export");
  const stored = await readStoredLog();
  const exported = buildMonitoringLogExport(stored.entries, { droppedCountOffset: stored.droppedCount, aggregates: stored.aggregates });
  if (exported.truncated) {
    await writeStoredLog(exported.entries, exported.droppedCount, exported.aggregates);
  }
  return serializeExport(exported);
}

export async function getMonitoringLogSummary(): Promise<MonitoringLogSummary> {
  await flushMonitoringLog("summary");
  const stored = await readStoredLog();
  const byteLength = encodedLength(JSON.stringify({ entries: stored.entries, aggregates: stored.aggregates, droppedCount: stored.droppedCount }));
  return {
    entryCount: stored.entries.length,
    droppedCount: stored.droppedCount,
    byteLength,
    maxBytes: MONITORING_LOG_MAX_BYTES
  };
}

export function clearMonitoringLog(): Promise<void> {
  pendingEntries = [];
  pendingAggregates = new Map();
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  writeQueue = writeQueue.then(() => removeStorageKey(MONITORING_LOG_STORAGE_KEY)).catch(() => undefined);
  return writeQueue;
}
