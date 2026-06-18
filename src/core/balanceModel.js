const DEFAULT_BALANCE = {
  returns: {
    qualityReference: 48,
    qualitySpan: 38,
    qualityReturnFloor: 0.68,
    qualityReturnCeil: 1.1,
    playerLeverageMinReduction: 0.3,
    optimizedQuality: 90,
    optimizedReturnRateMod: 0.9,
    optimizedProgressionMult: 0.92,
  },
  events: {
    dailyChance: 0.18,
    pityDays: 6,
    maxActiveNegative: 2,
    maxReturnRateModMult: 1.1,
    targetEventsPer14Days: { min: 1, max: 4 },
    maxNegativeShare: 0.55,
  },
};

/**
 * @param {object} [raw]
 */
export function normalizeBalanceConfig(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const r = b.returns && typeof b.returns === "object" ? b.returns : {};
  const e = b.events && typeof b.events === "object" ? b.events : {};
  const t = e.targetEventsPer14Days && typeof e.targetEventsPer14Days === "object" ? e.targetEventsPer14Days : {};
  return {
    returns: { ...DEFAULT_BALANCE.returns, ...r },
    events: {
      ...DEFAULT_BALANCE.events,
      ...e,
      targetEventsPer14Days: { ...DEFAULT_BALANCE.events.targetEventsPer14Days, ...t },
    },
  };
}

/**
 * Качество карточки снижает долю возвратов (фаза 4 баланс).
 * Ниже референса — штраф к возвратам; выше — бонус.
 * @param {number} qualityScore
 * @param {object} [cfg]
 */
export function computeQualityReturnFactor(qualityScore, cfg = DEFAULT_BALANCE.returns) {
  const q = Math.max(0, Math.min(100, Number(qualityScore) || 35));
  const ref = Number(cfg.qualityReference) || 48;
  const span = Math.max(1, Number(cfg.qualitySpan) || 38);
  const floor = Math.max(0.5, Math.min(1, Number(cfg.qualityReturnFloor) || 0.68));
  const ceil = Math.max(1, Number(cfg.qualityReturnCeil) || 1.1);
  if (q >= ref) {
    const t = Math.max(0, Math.min(1, (q - ref) / span));
    return 1 - (1 - floor) * t;
  }
  const tBelow = Math.max(0, Math.min(1, (ref - q) / span));
  return 1 + (ceil - 1) * tBelow;
}

/**
 * @param {object} sku
 * @param {{ qualityScore?: number; returnRateMod?: number; eventMult?: number; progressionMult?: number }} opts
 * @param {object} [balanceCfg]
 */
export function computeSkuReturnRate(sku, opts, balanceCfg = DEFAULT_BALANCE) {
  const retCfg = balanceCfg.returns || DEFAULT_BALANCE.returns;
  const base = Math.max(0, Number(sku?.baseReturnRate) || 0);
  const qFactor = computeQualityReturnFactor(opts.qualityScore ?? 35, retCfg);
  const mod = Math.max(0, Number(opts.returnRateMod) || 1);
  const ev = Math.max(0, Number(opts.eventMult) || 1);
  const prog = Math.max(0, Number(opts.progressionMult) || 1);
  return Math.min(0.95, Math.max(0, base * mod * ev * prog * qFactor));
}

/**
 * Аудит: может ли игрок снизить возвраты >= 30% решениями.
 * @param {object} state
 * @param {object} [balanceCfg]
 */
export function auditReturnsLeverage(state, balanceCfg = DEFAULT_BALANCE) {
  const retCfg = balanceCfg.returns || DEFAULT_BALANCE.returns;
  const sku = (state?.skus || [])[0] || {
    baseReturnRate: 0.07,
    id: "sample",
  };
  const baseline = computeSkuReturnRate(
    sku,
    { qualityScore: 35, returnRateMod: 1, eventMult: 1, progressionMult: 1 },
    balanceCfg
  );
  const optimized = computeSkuReturnRate(
    sku,
    {
      qualityScore: retCfg.optimizedQuality,
      returnRateMod: retCfg.optimizedReturnRateMod,
      eventMult: 1,
      progressionMult: retCfg.optimizedProgressionMult,
    },
    balanceCfg
  );
  const reduction = baseline > 0 ? 1 - optimized / baseline : 0;
  const minRed = Number(retCfg.playerLeverageMinReduction) || 0.3;
  return {
    skuId: sku.id,
    baselineRate: baseline,
    optimizedRate: optimized,
    reductionPct: reduction * 100,
    pass: reduction >= minRed,
    minRequiredPct: minRed * 100,
  };
}

/**
 * @param {object} state
 * @param {number} [windowDays]
 */
export function auditEventIntensity(state, windowDays = 14) {
  const log = Array.isArray(state?.eventLog) ? state.eventLog : [];
  const day = Number(state?.day) || 0;
  const fromDay = Math.max(1, day - windowDays + 1);
  const recent = log.filter((e) => Number(e.day) >= fromDay);
  const negative = recent.filter((e) => e.type === "negative").length;
  const positive = recent.filter((e) => e.type === "positive").length;
  const total = recent.length;
  const negShare = total > 0 ? negative / total : 0;
  const activeNeg = (state?.activeEvents || []).filter((e) => e.type === "negative").length;
  return {
    windowDays,
    total,
    negative,
    positive,
    negShare,
    activeNegative: activeNeg,
  };
}

/**
 * @param {object} state
 * @param {object} balanceCfg
 * @param {object} [returnsAudit]
 * @param {object} [eventsAudit]
 */
export function buildPhase4BalanceReport(state, balanceCfg, returnsAudit, eventsAudit) {
  const evCfg = balanceCfg.events || DEFAULT_BALANCE.events;
  const ret = returnsAudit || auditReturnsLeverage(state, balanceCfg);
  const ev = eventsAudit || auditEventIntensity(state, 14);
  const target = evCfg.targetEventsPer14Days || DEFAULT_BALANCE.events.targetEventsPer14Days;
  const checks = [
    {
      id: "returns-leverage",
      label: `Снижение возвратов игроком >= ${ret.minRequiredPct.toFixed(0)}%`,
      pass: ret.pass,
    },
    {
      id: "events-frequency",
      label: `События за 14д: ${target.min}–${target.max}`,
      pass: ev.total >= target.min && ev.total <= target.max + 3,
    },
    {
      id: "events-neg-share",
      label: `Доля негативных событий <= ${((evCfg.maxNegativeShare || 0.55) * 100).toFixed(0)}%`,
      pass: ev.total === 0 || ev.negShare <= (evCfg.maxNegativeShare || 0.55) + 0.1,
    },
    {
      id: "events-neg-cap",
      label: `Активных негативных <= ${evCfg.maxActiveNegative || 2}`,
      pass: ev.activeNegative <= (evCfg.maxActiveNegative || 2),
    },
    {
      id: "kpi-returns",
      label: "Текущие возвраты <= 14%",
      pass: !state?.lastDayReport || Number(state?.kpi?.returnPct) <= 0.14,
    },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const ratio = checks.length ? passCount / checks.length : 0;
  const decision = ratio >= 0.8 ? "BALANCED" : ratio >= 0.6 ? "TUNE" : "REVIEW";
  return {
    exportedAt: new Date().toISOString(),
    phase: 4,
    block: "72-74",
    day: state?.day || 0,
    decision,
    passCount,
    totalChecks: checks.length,
    checks,
    returnsAudit: ret,
    eventsAudit: ev,
    balanceConfig: balanceCfg,
  };
}

export { DEFAULT_BALANCE };
