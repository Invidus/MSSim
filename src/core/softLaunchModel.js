const DEFAULT_SOFT_LAUNCH = {
  version: 1,
  listing: {
    title: "Marketplace Seller Simulator",
    tagline: "",
    shortDescription: "",
    softLaunchNotes: "",
  },
  support: {
    title: "Поддержка",
    instruction: "",
    channels: [],
  },
  feedbackCategories: [
    { id: "bug", label: "Баг" },
    { id: "other", label: "Другое" },
  ],
};

/**
 * @param {object} [raw]
 */
export function normalizeSoftLaunchConfig(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const listing = b.listing && typeof b.listing === "object" ? b.listing : {};
  const support = b.support && typeof b.support === "object" ? b.support : {};
  const channels = Array.isArray(support.channels) ? support.channels : [];
  const feedbackCategories = Array.isArray(b.feedbackCategories) ? b.feedbackCategories : [];
  return {
    version: Number(b.version) || DEFAULT_SOFT_LAUNCH.version,
    listing: { ...DEFAULT_SOFT_LAUNCH.listing, ...listing },
    support: {
      ...DEFAULT_SOFT_LAUNCH.support,
      ...support,
      channels: channels.filter((c) => c && c.id),
    },
    feedbackCategories: feedbackCategories.length
      ? feedbackCategories.filter((c) => c && c.id)
      : [...DEFAULT_SOFT_LAUNCH.feedbackCategories],
  };
}

/**
 * @param {object} ctx
 */
export function buildSoftLaunchReadiness(ctx) {
  const checks = [
    {
      id: "sdk-fallback",
      label: "SDK подключён или есть web-fallback",
      pass: ctx.sdkChecked === true,
    },
    {
      id: "autosave-local",
      label: "Локальное автосохранение",
      pass: ctx.localSaveOk === true,
    },
    {
      id: "cloud-adapter",
      label: "Облачный адаптер (mock/yandex)",
      pass: ctx.cloudSource === "mock" || ctx.cloudSource === "yandex",
    },
    {
      id: "onboarding",
      label: "Онбординг загружен (>= 5 шагов)",
      pass: Number(ctx.onboardingSteps) >= 5,
    },
    {
      id: "catalog-72",
      label: "Каталог >= 72 SKU",
      pass: Number(ctx.skuCount) >= 72,
    },
    {
      id: "events-24",
      label: "Пул событий >= 24",
      pass: Number(ctx.eventCount) >= 24,
    },
    {
      id: "balance-returns",
      label: "Баланс: рычаг возвратов",
      pass: ctx.balanceReturnsPass === true,
    },
    {
      id: "phase3-freeze",
      label: "Phase 3 freeze не NO-GO",
      pass: ctx.phase3Decision !== "NO-GO",
    },
    {
      id: "release-smoke",
      label: "Release smoke: READY или READY WITH RISKS",
      pass: ctx.releaseSmokeStatus === "READY" || ctx.releaseSmokeStatus === "READY WITH RISKS",
    },
    {
      id: "support-channel",
      label: "Канал поддержки настроен",
      pass: Number(ctx.supportChannels) > 0,
    },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const ratio = checks.length ? passCount / checks.length : 0;
  const decision = ratio >= 0.85 ? "GO" : ratio >= 0.65 ? "GO WITH RISKS" : "NO-GO";
  return { checks, passCount, totalChecks: checks.length, decision, ratio };
}

/**
 * @param {object} gameState
 * @param {string} categoryId
 * @param {string} text
 * @param {object} [extra]
 */
export function createFeedbackEntry(gameState, categoryId, text, extra = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  return {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    day: Number(gameState?.day) || 0,
    categoryId: String(categoryId || "other"),
    text: trimmed.slice(0, 2000),
    playStyleId: gameState?.playStyleId || null,
    kpi: gameState?.kpi ? { ...gameState.kpi } : null,
    cash: Number(gameState?.cash) || 0,
    skuCount: Array.isArray(gameState?.skus) ? gameState.skus.length : 0,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    triageStatus: "open",
    priority: null,
    resolved: false,
    ...extra,
  };
}

/**
 * @param {object} ctx
 */
export function buildSoftLaunchPackage(ctx) {
  const readiness = buildSoftLaunchReadiness(ctx.readiness || {});
  return {
    exportedAt: new Date().toISOString(),
    phase: 4,
    block: "75-76",
    packageVersion: 1,
    decision: readiness.decision,
    passCount: readiness.passCount,
    totalChecks: readiness.totalChecks,
    readiness,
    listing: ctx.config?.listing || {},
    support: ctx.config?.support || {},
    game: {
      day: ctx.gameState?.day || 0,
      cash: ctx.gameState?.cash || 0,
      playStyleId: ctx.gameState?.playStyleId || null,
      skuCount: ctx.gameState?.skus?.length || 0,
      eventPool: ctx.eventCount || 0,
    },
    platform: {
      sdkAvailable: ctx.platform?.available,
      cloudSource: ctx.cloudSource,
      lastAutoSave: ctx.lastAutoSave || null,
    },
    onboarding: ctx.onboarding || null,
    phase3Freeze: ctx.phase3Freeze || null,
    phase4Balance: ctx.phase4Balance || null,
    releaseSmoke: ctx.releaseSmoke || null,
    feedback: {
      total: Array.isArray(ctx.feedbackLog) ? ctx.feedbackLog.length : 0,
      recent: (ctx.feedbackLog || []).slice(-5),
    },
    playtestNotes: String(ctx.gameState?.playtestNotes || ""),
  };
}

/**
 * @param {object} ctx
 */
export function buildFeedbackTriageReport(ctx) {
  const log = Array.isArray(ctx.feedbackLog) ? ctx.feedbackLog : [];
  const byCategory = {};
  for (const entry of log) {
    const cat = String(entry.categoryId || "other");
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  const openForTriage = log.filter(
    (e) =>
      e.triageStatus === "open" ||
      e.triageStatus === "investigating" ||
      (!e.resolved && e.triageStatus !== "resolved" && e.triageStatus !== "wontfix")
  ).length;
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 2,
    block: "77-78",
    day: ctx.gameState?.day || 0,
    support: ctx.config?.support || {},
    summary: {
      total: log.length,
      byCategory,
      openForTriage,
    },
    entries: log,
    snapshot: {
      kpi: ctx.gameState?.kpi || null,
      playStyleId: ctx.gameState?.playStyleId || null,
      antiExploit: ctx.gameState?.antiExploit?.status || null,
      onboardingCompleted: ctx.gameState?.onboardingCompletedIds || [],
    },
    platform: {
      sdkAvailable: ctx.platform?.available,
      cloudSource: ctx.cloudSource,
    },
  };
}

export { DEFAULT_SOFT_LAUNCH };
