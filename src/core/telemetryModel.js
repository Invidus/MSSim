const MAX_TELEMETRY_DAYS = 30;

const PRIORITY_BY_CATEGORY = {
  bug: "high",
  balance: "medium",
  performance: "medium",
  ux: "low",
  other: "low",
};

const VALID_TRIAGE_STATUSES = new Set(["open", "investigating", "resolved", "wontfix"]);

/**
 * @returns {object}
 */
export function defaultSessionMetrics() {
  return {
    sessionsStarted: 0,
    firstPlayAt: null,
    lastPlayAt: null,
  };
}

/**
 * @param {object} state
 */
export function bumpSessionMetrics(state) {
  if (!state) return;
  if (!state.sessionMetrics || typeof state.sessionMetrics !== "object") {
    state.sessionMetrics = defaultSessionMetrics();
  }
  const now = new Date().toISOString();
  state.sessionMetrics.sessionsStarted = Math.max(0, Number(state.sessionMetrics.sessionsStarted) || 0) + 1;
  state.sessionMetrics.lastPlayAt = now;
  if (!state.sessionMetrics.firstPlayAt) {
    state.sessionMetrics.firstPlayAt = now;
  }
}

/**
 * @param {string} categoryId
 */
export function inferFeedbackPriority(categoryId) {
  return PRIORITY_BY_CATEGORY[String(categoryId || "other")] || "low";
}

/**
 * @param {object} entry
 */
export function normalizeFeedbackEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const categoryId = String(entry.categoryId || "other");
  return {
    ...entry,
    categoryId,
    triageStatus: VALID_TRIAGE_STATUSES.has(entry.triageStatus) ? entry.triageStatus : "open",
    priority: entry.priority || inferFeedbackPriority(categoryId),
    resolved: entry.triageStatus === "resolved" || entry.triageStatus === "wontfix" || entry.resolved === true,
  };
}

/**
 * @param {object[]} log
 */
export function normalizeFeedbackLog(log) {
  if (!Array.isArray(log)) return [];
  return log.map(normalizeFeedbackEntry).filter(Boolean);
}

/**
 * @param {object} state
 */
export function pushDailyTelemetry(state) {
  if (!state) return;
  if (!Array.isArray(state.telemetryLog)) state.telemetryLog = [];
  const k = state.kpi || {};
  const onboarding = Array.isArray(state.onboardingCompletedIds) ? state.onboardingCompletedIds.length : 0;
  state.telemetryLog.push({
    day: Number(state.day) || 0,
    at: new Date().toISOString(),
    playStyleId: state.playStyleId || null,
    cash: Number(state.cash) || 0,
    kpi: {
      revenue: Number(k.revenue) || 0,
      profit: Number(k.profit) || 0,
      marginPct: Number(k.marginPct) || 0,
      returnPct: Number(k.returnPct) || 0,
      stockoutRate: Number(k.stockoutRate) || 0,
    },
    onboardingStepsDone: onboarding,
    antiExploitStatus: state.antiExploit?.status || null,
    feedbackOpen: (state.feedbackLog || []).filter((e) => !e.resolved && e.triageStatus !== "resolved" && e.triageStatus !== "wontfix").length,
  });
  if (state.telemetryLog.length > MAX_TELEMETRY_DAYS) {
    state.telemetryLog = state.telemetryLog.slice(-MAX_TELEMETRY_DAYS);
  }
}

/**
 * @param {object} state
 */
export function buildRetentionMetrics(state) {
  const day = Number(state?.day) || 0;
  const sessions = Number(state?.sessionMetrics?.sessionsStarted) || 0;
  const log = Array.isArray(state?.telemetryLog) ? state.telemetryLog : [];
  const maxTelemetryDay = log.reduce((m, row) => Math.max(m, Number(row.day) || 0), 0);
  const reachedDay7 = day >= 7 || maxTelemetryDay >= 7;
  const reachedDay14 = day >= 14 || maxTelemetryDay >= 14;
  const proxyD1Return = day >= 2 || maxTelemetryDay >= 2;
  const profitableDay = log.some((row) => Number(row.kpi?.profit) > 0) || Number(state?.kpi?.profit) > 0;
  return {
    currentDay: day,
    sessionsStarted: sessions,
    proxyD1Return,
    reachedDay7,
    reachedDay14,
    firstRunCompletionProxy: reachedDay14 && profitableDay,
    telemetryPoints: log.length,
  };
}

/**
 * @param {object[]} log
 */
export function buildTriageSummary(log) {
  const entries = normalizeFeedbackLog(log);
  const byStatus = { open: 0, investigating: 0, resolved: 0, wontfix: 0 };
  const byPriority = { high: 0, medium: 0, low: 0 };
  const byCategory = {};
  for (const entry of entries) {
    const status = entry.triageStatus || "open";
    byStatus[status] = (byStatus[status] || 0) + 1;
    const pri = entry.priority || "low";
    byPriority[pri] = (byPriority[pri] || 0) + 1;
    const cat = entry.categoryId || "other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  const openForTriage = entries.filter((e) => e.triageStatus === "open" || e.triageStatus === "investigating").length;
  return {
    total: entries.length,
    openForTriage,
    byStatus,
    byPriority,
    byCategory,
  };
}

/**
 * @param {object[]} log
 * @param {string} entryId
 * @param {string} status
 */
export function setFeedbackTriageStatus(log, entryId, status) {
  if (!Array.isArray(log) || !VALID_TRIAGE_STATUSES.has(status)) return false;
  const entry = log.find((e) => String(e.id) === String(entryId));
  if (!entry) return false;
  entry.triageStatus = status;
  entry.resolved = status === "resolved" || status === "wontfix";
  entry.triageUpdatedAt = new Date().toISOString();
  return true;
}

/**
 * @param {object[]} existing
 * @param {object[]} imported
 */
export function mergeFeedbackImport(existing, imported) {
  const base = normalizeFeedbackLog(existing);
  const incoming = normalizeFeedbackLog(imported);
  const byId = new Map(base.map((e) => [String(e.id), e]));
  for (const entry of incoming) {
    const prev = byId.get(String(entry.id));
    if (!prev) {
      byId.set(String(entry.id), entry);
      continue;
    }
    const prevAt = Date.parse(String(prev.at || "")) || 0;
    const nextAt = Date.parse(String(entry.at || "")) || 0;
    byId.set(String(entry.id), nextAt >= prevAt ? { ...prev, ...entry } : prev);
  }
  return [...byId.values()].sort((a, b) => Date.parse(String(a.at || "")) - Date.parse(String(b.at || "")));
}

/**
 * @param {object} ctx
 */
export function buildSoftLaunchAnalyticsReport(ctx) {
  const feedbackLog = normalizeFeedbackLog(ctx.feedbackLog || []);
  const triage = buildTriageSummary(feedbackLog);
  const retention = buildRetentionMetrics(ctx.gameState);
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    block: "77-78",
    day: ctx.gameState?.day || 0,
    retention,
    sessionMetrics: ctx.gameState?.sessionMetrics || defaultSessionMetrics(),
    telemetryLog: ctx.gameState?.telemetryLog || [],
    triage,
    feedbackEntries: feedbackLog,
    gameSnapshot: {
      playStyleId: ctx.gameState?.playStyleId || null,
      kpi: ctx.gameState?.kpi || null,
      onboardingCompleted: ctx.gameState?.onboardingCompletedIds || [],
      antiExploit: ctx.gameState?.antiExploit?.status || null,
    },
    platform: {
      sdkAvailable: ctx.platform?.available,
      cloudSource: ctx.cloudSource,
    },
  };
}

export { VALID_TRIAGE_STATUSES, PRIORITY_BY_CATEGORY };
