/** @typedef {{ id: string; name: string; type: string; durationDays: number; weight?: number; scope?: string; effect?: Record<string, unknown> }} EventDef */

export let EVENT_DAILY_CHANCE = 0.18;
export let EVENT_PITY_DAYS = 6;

let eventBalanceOpts = {
  maxActiveNegative: 2,
  maxReturnRateModMult: 1.1,
};

/**
 * @param {{ maxActiveNegative?: number; maxReturnRateModMult?: number; dailyChance?: number; pityDays?: number }} opts
 */
export function configureEventBalance(opts = {}) {
  if (opts.maxActiveNegative != null) {
    eventBalanceOpts.maxActiveNegative = Math.max(1, Number(opts.maxActiveNegative) || 2);
  }
  if (opts.maxReturnRateModMult != null) {
    eventBalanceOpts.maxReturnRateModMult = Math.max(1, Number(opts.maxReturnRateModMult) || 1.1);
  }
  if (opts.dailyChance != null) {
    EVENT_DAILY_CHANCE = Math.max(0, Math.min(1, Number(opts.dailyChance) || 0.18));
  }
  if (opts.pityDays != null) {
    EVENT_PITY_DAYS = Math.max(1, Math.round(Number(opts.pityDays) || 6));
  }
}

/**
 * @returns {object}
 */
export function emptyEventState() {
  return {
    activeEvents: [],
    eventLog: [],
    daysSinceLastEvent: 0,
    lastEventCategoryId: null,
    consecutiveCategoryEvents: 0,
    lastDayEvent: null,
    eventModifiers: defaultEventModifiers(),
  };
}

export function defaultEventModifiers() {
  return {
    adEfficiencyMult: 1,
    baseConversionMult: 1,
    organicGlobalMult: 1,
    categoryOrganicMult: {},
    skuOrganicMult: {},
    returnRateModMult: 1,
    outboundCostMult: 1,
    overheadMult: 1,
    feeRateDelta: 0,
    teamBonusMult: 1,
    stockoutServiceMult: 1,
    purchaseCostMultByCategory: {},
    marketPriceMultBySku: {},
    marketPriceMultByCategory: {},
    serviceRatingDelta: 0,
    purchaseLeadTimeExtraByCategory: {},
    skuReturnRateMult: {},
  };
}

/**
 * @param {object} state
 * @param {EventDef[]} eventDefs
 * @param {() => number} [rng]
 */
export function processDailyEvents(state, eventDefs, rng = Math.random) {
  if (!state || !Array.isArray(eventDefs) || !eventDefs.length) {
    if (state) state.eventModifiers = defaultEventModifiers();
    return;
  }

  ensureEventFields(state);
  tickActiveEvents(state);
  state.lastDayEvent = null;

  const shouldForce = state.daysSinceLastEvent >= EVENT_PITY_DAYS;
  const shouldRoll = shouldForce || rng() < EVENT_DAILY_CHANCE;
  if (shouldRoll) {
    let picked = pickEvent(state, eventDefs, rng);
    if (picked?.type === "negative") {
      const negActive = (state.activeEvents || []).filter((e) => e.type === "negative").length;
      const cap = eventBalanceOpts.maxActiveNegative || 2;
      if (negActive >= cap && !shouldForce) {
        const positives = eventDefs.filter((d) => d.type === "positive");
        picked = positives.length ? pickEventWeighted(positives, rng) : null;
      }
    }
    if (picked) applyEvent(state, picked, rng);
  }

  if (!state.lastDayEvent) {
    state.daysSinceLastEvent = Math.max(0, (state.daysSinceLastEvent || 0) + 1);
  }

  state.eventModifiers = computeEventModifiers(state, eventDefs);
}

function ensureEventFields(state) {
  if (!Array.isArray(state.activeEvents)) state.activeEvents = [];
  if (!Array.isArray(state.eventLog)) state.eventLog = [];
  if (state.daysSinceLastEvent == null) state.daysSinceLastEvent = 0;
}

function tickActiveEvents(state) {
  const next = [];
  for (const inst of state.activeEvents) {
    const remaining = Math.max(0, Math.round(Number(inst.remainingDays) || 0) - 1);
    if (remaining > 0) next.push({ ...inst, remainingDays: remaining });
  }
  state.activeEvents = next;
}

/**
 * @param {object} state
 * @param {EventDef} def
 * @param {() => number} rng
 */
function applyEvent(state, def, rng) {
  const inst = {
    eventId: def.id,
    name: def.name,
    type: def.type,
    scope: def.scope || "global",
    categoryId: null,
    skuId: null,
    remainingDays: Math.max(1, Math.round(Number(def.durationDays) || 1)),
    effect: { ...(def.effect || {}) },
    startedDay: state.day,
  };

  if (def.scope === "category" || def.effect?.categoryOrganicMult != null || def.effect?.purchaseCostMultByCategory != null) {
    inst.categoryId = pickRandomCategory(state, rng);
  }
  if (def.scope === "sku" || def.effect?.skuOrganicMult != null || def.effect?.skuReturnRateMult != null) {
    inst.skuId = def.pickHighTier ? pickHighTierSku(state, rng) : pickRandomSku(state, rng);
  }

  if (inst.effect.leadTimeExtraByCategory && inst.categoryId) {
    delayIncomingShipments(state, inst.categoryId, Number(inst.effect.leadTimeExtraByCategory) || 0);
  }

  state.activeEvents.push(inst);
  state.eventLog.push({
    day: state.day,
    eventId: def.id,
    name: def.name,
    type: def.type,
    categoryId: inst.categoryId,
    skuId: inst.skuId,
  });
  state.lastDayEvent = {
    id: def.id,
    name: def.name,
    type: def.type,
    categoryId: inst.categoryId,
    skuId: inst.skuId,
  };
  state.daysSinceLastEvent = 0;

  if (inst.categoryId) {
    if (inst.categoryId === state.lastEventCategoryId) {
      state.consecutiveCategoryEvents = Math.max(1, (state.consecutiveCategoryEvents || 0) + 1);
    } else {
      state.lastEventCategoryId = inst.categoryId;
      state.consecutiveCategoryEvents = 1;
    }
  }
}

function delayIncomingShipments(state, categoryId, extraDays) {
  if (!extraDays || !Array.isArray(state.incomingShipments)) return;
  for (const sh of state.incomingShipments) {
    const sku = (state.skus || []).find((s) => String(s.id) === String(sh.skuId));
    if (sku && String(sku.categoryId) === String(categoryId)) {
      sh.arrivalDay = Math.round(Number(sh.arrivalDay) || 0) + extraDays;
    }
  }
}

function pickEventWeighted(pool, rng) {
  if (!pool.length) return null;
  const totalWeight = pool.reduce((acc, e) => acc + (Number(e.weight) || 1), 0);
  let roll = rng() * totalWeight;
  for (const def of pool) {
    roll -= Number(def.weight) || 1;
    if (roll <= 0) return def;
  }
  return pool[pool.length - 1];
}

/**
 * @param {object} state
 * @param {import("./eventEngine.js").EventDef[]} eventDefs
 * @param {() => number} rng
 */
function pickEvent(state, eventDefs, rng) {
  let pool = eventDefs.filter((def) => {
    if (def.scope === "category" && (state.consecutiveCategoryEvents || 0) >= 2) return false;
    return true;
  });
  if (!pool.length) pool = eventDefs.filter((d) => d.scope === "global");
  if (!pool.length) pool = [...eventDefs];
  if (!pool.length) return null;

  return pickEventWeighted(pool, rng);
}

function pickRandomCategory(state, rng) {
  const cats = [...new Set((state.skus || []).map((s) => String(s.categoryId || "beauty")))];
  if (!cats.length) return "beauty";
  return cats[Math.floor(rng() * cats.length)];
}

function pickHighTierSku(state, rng) {
  const pool = (state.skus || []).filter((s) => String(s.tier || "").toLowerCase() === "high");
  if (!pool.length) return pickRandomSku(state, rng);
  return String(pool[Math.floor(rng() * pool.length)].id);
}

function pickRandomSku(state, rng) {
  const skus = state.skus || [];
  if (!skus.length) return null;
  return String(skus[Math.floor(rng() * skus.length)].id);
}

/**
 * @param {object} state
 * @param {EventDef[]} eventDefs
 */
export function computeEventModifiers(state, eventDefs) {
  const mods = defaultEventModifiers();
  const defsById = new Map((eventDefs || []).map((d) => [d.id, d]));

  for (const inst of state.activeEvents || []) {
    const def = defsById.get(inst.eventId);
    const effect = { ...(def?.effect || {}), ...(inst.effect || {}) };

    if (effect.adEfficiencyMult) mods.adEfficiencyMult *= Number(effect.adEfficiencyMult) || 1;
    if (effect.baseConversionMult) mods.baseConversionMult *= Number(effect.baseConversionMult) || 1;
    if (effect.organicGlobalMult) mods.organicGlobalMult *= Number(effect.organicGlobalMult) || 1;
    if (effect.returnRateModMult) mods.returnRateModMult *= Number(effect.returnRateModMult) || 1;
    if (effect.outboundCostMult) mods.outboundCostMult *= Number(effect.outboundCostMult) || 1;
    if (effect.overheadMult) mods.overheadMult *= Number(effect.overheadMult) || 1;
    if (effect.feeRateDelta) mods.feeRateDelta += Number(effect.feeRateDelta) || 0;
    if (effect.teamBonusMult) mods.teamBonusMult *= Number(effect.teamBonusMult) || 1;
    if (effect.stockoutServiceMult) mods.stockoutServiceMult *= Number(effect.stockoutServiceMult) || 1;
    if (effect.serviceRatingDelta) mods.serviceRatingDelta += Number(effect.serviceRatingDelta) || 0;

    if (effect.categoryOrganicMult && inst.categoryId) {
      const prev = mods.categoryOrganicMult[inst.categoryId] ?? 1;
      mods.categoryOrganicMult[inst.categoryId] = prev * Number(effect.categoryOrganicMult);
    }
    if (effect.skuOrganicMult && inst.skuId) {
      const prev = mods.skuOrganicMult[inst.skuId] ?? 1;
      mods.skuOrganicMult[inst.skuId] = prev * Number(effect.skuOrganicMult);
    }
    if (effect.skuReturnRateMult && inst.skuId) {
      const prev = mods.skuReturnRateMult[inst.skuId] ?? 1;
      mods.skuReturnRateMult[inst.skuId] = prev * Number(effect.skuReturnRateMult);
    }
    if (effect.purchaseCostMultByCategory && inst.categoryId) {
      const prev = mods.purchaseCostMultByCategory[inst.categoryId] ?? 1;
      mods.purchaseCostMultByCategory[inst.categoryId] = prev * Number(effect.purchaseCostMultByCategory);
    }
    if (effect.marketPriceMultByCategory && inst.categoryId) {
      const prev = mods.marketPriceMultByCategory[inst.categoryId] ?? 1;
      mods.marketPriceMultByCategory[inst.categoryId] = prev * Number(effect.marketPriceMultByCategory);
    }
    if (effect.purchaseLeadTimeExtraByCategory && inst.categoryId) {
      const prev = mods.purchaseLeadTimeExtraByCategory[inst.categoryId] ?? 0;
      mods.purchaseLeadTimeExtraByCategory[inst.categoryId] =
        prev + (Number(effect.purchaseLeadTimeExtraByCategory) || 0);
    }
    if (effect.leadTimeExtraByCategory && inst.categoryId && effect.purchaseLeadTimeExtraByCategory == null) {
      const prev = mods.purchaseLeadTimeExtraByCategory[inst.categoryId] ?? 0;
      mods.purchaseLeadTimeExtraByCategory[inst.categoryId] =
        prev + (Number(effect.leadTimeExtraByCategory) || 0);
    }
  }

  const cap = eventBalanceOpts.maxReturnRateModMult || 1.1;
  if (mods.returnRateModMult > cap) mods.returnRateModMult = cap;

  return mods;
}

/**
 * @param {object} state
 * @param {string} categoryId
 */
export function getPurchaseLeadTimeExtra(state, categoryId) {
  const extra = state?.eventModifiers?.purchaseLeadTimeExtraByCategory?.[categoryId];
  return Math.max(0, Math.round(Number(extra) || 0));
}
