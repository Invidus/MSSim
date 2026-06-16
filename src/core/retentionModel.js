import { buildTriageSummary, normalizeFeedbackLog } from "./telemetryModel.js";

const DEFAULT_GATES = {
  maxOpenMajorBugs: 5,
  proxyD1ReturnMinPct: 30,
  firstRunCompletionMinPct: 75,
  minCohortVisitsForRate: 3,
};

/**
 * @returns {object}
 */
export function defaultVisitMetrics() {
  return {
    startedAt: null,
    reachedDay2: false,
    reachedDay14: false,
  };
}

/**
 * @returns {object}
 */
export function defaultRetentionCohort() {
  return {
    visits: 0,
    d1ReturnVisits: 0,
    day14Completions: 0,
  };
}

/**
 * @param {object} [raw]
 */
export function normalizeRetentionGates(raw) {
  const g = raw && typeof raw === "object" ? raw : {};
  return { ...DEFAULT_GATES, ...g };
}

/**
 * @param {object} [raw]
 */
export function normalizeMajorBugsCatalog(raw) {
  const bugs = Array.isArray(raw?.bugs) ? raw.bugs : [];
  return bugs
    .filter((b) => b && b.id)
    .map((b) => ({
      id: String(b.id),
      title: String(b.title || b.id),
      severity: String(b.severity || "major"),
      status: String(b.status || "open"),
      note: b.note != null ? String(b.note) : "",
    }));
}

/**
 * @param {object} state
 */
export function syncVisitMetrics(state) {
  if (!state) return;
  if (!state.visitMetrics || typeof state.visitMetrics !== "object") {
    state.visitMetrics = defaultVisitMetrics();
  }
  if (!state.visitMetrics.startedAt) {
    state.visitMetrics.startedAt = new Date().toISOString();
  }
  const day = Number(state.day) || 0;
  const profit = Number(state.kpi?.profit) || 0;
  if (day >= 2) state.visitMetrics.reachedDay2 = true;
  if (day >= 14 && profit > 0) state.visitMetrics.reachedDay14 = true;
}

/**
 * @param {object} state
 */
export function finalizeVisitToCohort(state) {
  if (!state) return;
  if (!state.retentionCohort || typeof state.retentionCohort !== "object") {
    state.retentionCohort = defaultRetentionCohort();
  }
  syncVisitMetrics(state);
  const visit = state.visitMetrics || defaultVisitMetrics();
  state.retentionCohort.visits = Math.max(0, Number(state.retentionCohort.visits) || 0) + 1;
  if (visit.reachedDay2) {
    state.retentionCohort.d1ReturnVisits =
      Math.max(0, Number(state.retentionCohort.d1ReturnVisits) || 0) + 1;
  }
  if (visit.reachedDay14) {
    state.retentionCohort.day14Completions =
      Math.max(0, Number(state.retentionCohort.day14Completions) || 0) + 1;
  }
  state.visitMetrics = defaultVisitMetrics();
  state.visitMetrics.startedAt = new Date().toISOString();
}

/**
 * @param {object[]} catalog
 * @param {object} overrides
 * @param {object[]} feedbackLog
 */
export function auditMajorBugs(catalog, overrides = {}, feedbackLog = []) {
  const bugs = (catalog || []).map((b) => {
    const override = overrides?.[b.id];
    const status = override || b.status || "open";
    return { ...b, status };
  });
  const openRegistry = bugs.filter((b) => b.status === "open" || b.status === "investigating").length;
  const feedback = normalizeFeedbackLog(feedbackLog);
  const openHighFeedback = feedback.filter(
    (e) =>
      e.priority === "high" &&
      (e.triageStatus === "open" || e.triageStatus === "investigating")
  ).length;
  return {
    registry: bugs,
    openRegistry,
    openHighFeedback,
    openMajorTotal: openRegistry + openHighFeedback,
  };
}

/**
 * @param {object} state
 * @param {object} gates
 * @param {object} majorAudit
 */
export function buildRetentionGateChecks(state, gates, majorAudit) {
  const cohort = state?.retentionCohort || defaultRetentionCohort();
  const visit = state?.visitMetrics || defaultVisitMetrics();
  syncVisitMetrics(state);
  const visits = Math.max(0, Number(cohort.visits) || 0);
  const d1Hits = Math.max(0, Number(cohort.d1ReturnVisits) || 0) + (visit.reachedDay2 ? 1 : 0);
  const d14Hits = Math.max(0, Number(cohort.day14Completions) || 0) + (visit.reachedDay14 ? 1 : 0);
  const visitDenominator = visits + 1;
  const d1ReturnPct = visitDenominator > 0 ? (d1Hits / visitDenominator) * 100 : 0;
  const day14Pct = visitDenominator > 0 ? (d14Hits / visitDenominator) * 100 : 0;
  const minVisits = Number(gates.minCohortVisitsForRate) || 3;
  const cohortSampleOk = visitDenominator >= minVisits;

  const checks = [
    {
      id: "major-bugs-cap",
      label: `Открытых major-багов <= ${gates.maxOpenMajorBugs}`,
      pass: majorAudit.openMajorTotal <= gates.maxOpenMajorBugs,
      value: majorAudit.openMajorTotal,
    },
    {
      id: "d1-return-cohort",
      label: `D1 return (когорта) >= ${gates.proxyD1ReturnMinPct}%`,
      pass: cohortSampleOk ? d1ReturnPct >= gates.proxyD1ReturnMinPct : null,
      value: `${d1ReturnPct.toFixed(0)}% (${d1Hits}/${visitDenominator})`,
      needsMoreData: !cohortSampleOk,
    },
    {
      id: "day14-completion-cohort",
      label: `Завершение 1-го рана (когорта) >= ${gates.firstRunCompletionMinPct}%`,
      pass: cohortSampleOk ? day14Pct >= gates.firstRunCompletionMinPct : null,
      value: `${day14Pct.toFixed(0)}% (${d14Hits}/${visitDenominator})`,
      needsMoreData: !cohortSampleOk,
    },
    {
      id: "d1-return-current",
      label: "D1 return в текущем визите",
      pass: visit.reachedDay2 || Number(state?.day) >= 2,
      value: visit.reachedDay2 || Number(state?.day) >= 2 ? "да" : "нет",
    },
    {
      id: "high-feedback-triage",
      label: "Нет открытого high-priority feedback",
      pass: majorAudit.openHighFeedback === 0,
      value: majorAudit.openHighFeedback,
    },
  ];

  const scored = checks.filter((c) => c.pass !== null);
  const passCount = scored.filter((c) => c.pass).length;
  const ratio = scored.length ? passCount / scored.length : 0;
  const pending = checks.filter((c) => c.pass === null).length;
  const decision =
    pending > 0 && ratio < 0.8
      ? "COLLECTING DATA"
      : ratio >= 0.8
        ? "GO"
        : ratio >= 0.6
          ? "GO WITH RISKS"
          : "NO-GO";

  return {
    checks,
    passCount,
    totalChecks: scored.length,
    pendingDataChecks: pending,
    decision,
    cohort: {
      visits,
      currentVisitIncluded: true,
      visitDenominator,
      d1ReturnPct,
      day14Pct,
      minVisitsRequired: minVisits,
    },
  };
}

/**
 * @param {object} ctx
 */
export function buildPhase4CloseoutReport(ctx) {
  const gates = normalizeRetentionGates(ctx.gates);
  const catalog = normalizeMajorBugsCatalog(ctx.majorBugsCatalog);
  const majorAudit = auditMajorBugs(catalog, ctx.majorBugStatus, ctx.feedbackLog);
  const retentionGates = buildRetentionGateChecks(ctx.gameState, gates, majorAudit);
  const triage = buildTriageSummary(ctx.feedbackLog || []);

  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    phase: 4,
    block: "79-80",
    day: ctx.gameState?.day || 0,
    decision: retentionGates.decision,
    passCount: retentionGates.passCount,
    totalChecks: retentionGates.totalChecks,
    retentionGates,
    majorBugs: majorAudit,
    triage,
    targets: gates,
    visitMetrics: ctx.gameState?.visitMetrics || defaultVisitMetrics(),
    retentionCohort: ctx.gameState?.retentionCohort || defaultRetentionCohort(),
  };
}

export { DEFAULT_GATES };
