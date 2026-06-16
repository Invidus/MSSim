/** @typedef {{ id: string; branch?: string; title?: string; desc?: string; cost?: number; cashCost?: number; dailySalary?: number; requires?: string[]; effect?: Record<string, unknown> }} ProgressionNode */

export function defaultProgressionModifiers() {
  return {
    adEfficiencyMult: 1,
    baseConversionMult: 1,
    feeRateDelta: 0,
    outboundCostMult: 1,
    returnHandlingCostMult: 1,
    returnRateModMult: 1,
    organicGlobalMult: 1,
    purchaseCostMult: 1,
    qualityFloorDelta: 0,
    serviceRatingDelta: 0,
    stockoutServiceMult: 1,
    globalProfitMult: 1,
    eventDamageMult: 1,
    teamEffectMult: 1,
    forecastAccuracyBonus: 0,
    autoReprice: false,
    autoReorder: false,
    activeSynergies: [],
  };
}

/**
 * @param {object} state
 * @param {ProgressionNode[]} nodes
 * @param {Array<{ id: string; requires: string[]; effect?: Record<string, unknown>; title?: string; desc?: string }>} synergies
 */
export function getProgressionModifiers(state, nodes, synergies = []) {
  const mods = defaultProgressionModifiers();
  const unlocked = state?.progressionUnlocked || {};
  const teamSyncOn = unlocked.n26 === true;
  const teamBranches = new Set(["team"]);

  for (const node of nodes || []) {
    if (!unlocked[node.id]) continue;
    const isTeam = teamBranches.has(node.branch || "");
    const e = { ...(node.effect || {}) };
    const teamBonusMult = Number(state?.eventModifiers?.teamBonusMult) || 1;
    if (isTeam && teamBonusMult !== 1) applyMultEffects(e, teamBonusMult);
    if (isTeam && teamSyncOn && node.id !== "n26") {
      const mult = Number(mods.teamEffectMult) || 1;
      applyNumericEffects(e, mult, ["qualityFloorDelta", "forecastAccuracyBonus", "serviceRatingDelta"]);
      applyMultEffects(e, mult);
    }
    mergeEffectIntoMods(mods, e);
    if (node.id === "n26" && e.teamEffectMult) {
      mods.teamEffectMult = Number(e.teamEffectMult) || 1;
    }
  }

  for (const syn of synergies || []) {
    const deps = Array.isArray(syn.requires) ? syn.requires : [];
    if (!deps.every((id) => unlocked[id] === true)) continue;
    mergeEffectIntoMods(mods, syn.effect || {});
    mods.activeSynergies.push(syn);
  }

  return mods;
}

function applyNumericEffects(effect, mult, keys) {
  for (const key of keys) {
    if (effect[key] != null) effect[key] = Number(effect[key]) * mult;
  }
}

function applyMultEffects(effect, mult) {
  for (const key of [
    "adEfficiencyMult",
    "baseConversionMult",
    "outboundCostMult",
    "returnHandlingCostMult",
    "returnRateModMult",
    "organicGlobalMult",
    "purchaseCostMult",
    "globalProfitMult",
  ]) {
    if (effect[key] != null) {
      const base = Number(effect[key]) || 1;
      effect[key] = 1 + (base - 1) * mult;
    }
  }
}

function mergeEffectIntoMods(mods, effect) {
  if (!effect) return;
  if (effect.adEfficiencyMult) mods.adEfficiencyMult *= Number(effect.adEfficiencyMult) || 1;
  if (effect.baseConversionMult) mods.baseConversionMult *= Number(effect.baseConversionMult) || 1;
  if (effect.feeRateDelta) mods.feeRateDelta += Number(effect.feeRateDelta) || 0;
  if (effect.outboundCostMult) mods.outboundCostMult *= Number(effect.outboundCostMult) || 1;
  if (effect.returnHandlingCostMult) mods.returnHandlingCostMult *= Number(effect.returnHandlingCostMult) || 1;
  if (effect.returnRateModMult) mods.returnRateModMult *= Number(effect.returnRateModMult) || 1;
  if (effect.organicGlobalMult) mods.organicGlobalMult *= Number(effect.organicGlobalMult) || 1;
  if (effect.purchaseCostMult) mods.purchaseCostMult *= Number(effect.purchaseCostMult) || 1;
  if (effect.qualityFloorDelta) mods.qualityFloorDelta += Number(effect.qualityFloorDelta) || 0;
  if (effect.serviceRatingDelta) mods.serviceRatingDelta += Number(effect.serviceRatingDelta) || 0;
  if (effect.stockoutServiceMult) mods.stockoutServiceMult *= Number(effect.stockoutServiceMult) || 1;
  if (effect.globalProfitMult) mods.globalProfitMult *= Number(effect.globalProfitMult) || 1;
  if (effect.eventDamageMult) mods.eventDamageMult *= Number(effect.eventDamageMult) || 1;
  if (effect.forecastAccuracyBonus) mods.forecastAccuracyBonus += Number(effect.forecastAccuracyBonus) || 0;
  if (effect.autoReprice) mods.autoReprice = true;
  if (effect.autoReorder) mods.autoReorder = true;
}

/**
 * @param {object} state
 * @param {ProgressionNode[]} nodes
 */
export function computeTeamDailySalary(state, nodes) {
  const unlocked = state?.progressionUnlocked || {};
  let total = 0;
  for (const node of nodes || []) {
    if (!unlocked[node.id]) continue;
    const salary = Math.max(0, Number(node.dailySalary) || 0);
    total += salary;
  }
  return total;
}

/**
 * @param {object} state
 * @param {ProgressionNode[]} nodes
 */
export function applyQualityFloor(state, qualityFloor) {
  const floor = Math.max(0, Math.round(Number(qualityFloor) || 0));
  if (!floor || !state?.skus) return;
  for (const sku of state.skus) {
    const id = sku.id;
    const current = Number(state.qualityScore?.[id]) || 72;
    state.qualityScore[id] = Math.max(current, floor);
  }
}
