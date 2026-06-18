/** Шесть дискретных уровней качества карточки товара (внутри — score для симуляции). */

export const CARD_QUALITY_LEVELS = [
  { level: 1, name: "Низкое", score: 35 },
  { level: 2, name: "Базовое", score: 48 },
  { level: 3, name: "Среднее", score: 61 },
  { level: 4, name: "Хорошее", score: 74 },
  { level: 5, name: "Отличное", score: 87 },
  { level: 6, name: "Премиум", score: 100 },
];

/** Стартовый уровень качества (1) и цена для новых карточек. */
export const LOWEST_QUALITY_SCORE = CARD_QUALITY_LEVELS[0].score;
export const DEFAULT_QUALITY_SCORE = LOWEST_QUALITY_SCORE;

/** Минимальная стартовая цена — ~88% рекомендованной, не ниже себестоимости. */
export const STARTER_PRICE_RATIO = 0.88;

/**
 * Стартовая цена продажи (минимальный уровень).
 * @param {{ purchaseCost?: number; recommendedPrice?: number }} sku
 */
export function getStarterSkuPrice(sku) {
  const rec = Math.max(1, Number(sku?.recommendedPrice) || 1);
  const cost = Math.max(1, Number(sku?.purchaseCost) || 1);
  const floor = Math.ceil(cost * 1.32);
  const budget = Math.round(rec * STARTER_PRICE_RATIO);
  return Math.max(floor, Math.min(budget, rec));
}

export const QUALITY_HELP_TEXT =
  "Качество карточки — фото, описание и оформление на маркетплейсе. Новые товары начинают с низкого уровня. Чем выше уровень, тем больше заказов и меньше возвратов. Улучшайте кнопкой «Улучшить» — уровень растёт по шагам, деньги списываются сразу.";

const UPGRADE_COST_BY_TARGET_LEVEL = {
  2: 2000,
  3: 5000,
  4: 11000,
  5: 24000,
  6: 52000,
};

/**
 * @param {number} score
 */
export function snapQualityScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return DEFAULT_QUALITY_SCORE;
  let best = CARD_QUALITY_LEVELS[0];
  let bestDist = Infinity;
  for (const lvl of CARD_QUALITY_LEVELS) {
    const d = Math.abs(lvl.score - n);
    if (d < bestDist) {
      bestDist = d;
      best = lvl;
    }
  }
  return best.score;
}

/**
 * @param {number} score
 */
export function getQualityLevel(score) {
  const snapped = snapQualityScore(score);
  return CARD_QUALITY_LEVELS.find((l) => l.score === snapped) || CARD_QUALITY_LEVELS[0];
}

/**
 * @param {number} score
 */
export function getQualityLevelName(score) {
  return getQualityLevel(score).name;
}

/**
 * @param {number} score
 */
export function getNextQualityLevel(score) {
  const cur = getQualityLevel(score);
  return CARD_QUALITY_LEVELS.find((l) => l.level === cur.level + 1) || null;
}

/**
 * @param {number} floorScore
 */
export function scoreAtOrAboveFloor(floorScore) {
  const floor = Math.max(0, Math.round(Number(floorScore) || 0));
  for (const lvl of CARD_QUALITY_LEVELS) {
    if (lvl.score >= floor) return lvl.score;
  }
  return CARD_QUALITY_LEVELS[CARD_QUALITY_LEVELS.length - 1].score;
}

/**
 * @param {{ tier?: string }} sku
 * @param {number} score
 */
export function getQualityUpgradeCost(sku, score) {
  const next = getNextQualityLevel(score);
  if (!next) return 0;
  const base = UPGRADE_COST_BY_TARGET_LEVEL[next.level] || 5000;
  const tier = String(sku?.tier || "low");
  const tierMult = tier === "high" ? 1.4 : tier === "mid" ? 1.15 : 1;
  return Math.round(base * tierMult);
}

/**
 * @param {object} state
 * @param {string} skuId
 */
export function canUpgradeCardQuality(state, skuId) {
  if (!state?.skus) return false;
  const sku = state.skus.find((s) => s.id === skuId);
  if (!sku) return false;
  const score = Number(state.qualityScore?.[skuId]) || DEFAULT_QUALITY_SCORE;
  const next = getNextQualityLevel(score);
  if (!next) return false;
  const cost = getQualityUpgradeCost(sku, score);
  return Number(state.cash) >= cost;
}

/**
 * @param {object} state
 * @param {string} skuId
 * @returns {{ ok: boolean; error?: string; levelName?: string; cost?: number }}
 */
export function upgradeCardQuality(state, skuId) {
  if (!state?.skus) return { ok: false, error: "no state" };
  const sku = state.skus.find((s) => s.id === skuId);
  if (!sku) return { ok: false, error: "sku not found" };
  const current = snapQualityScore(Number(state.qualityScore?.[skuId]) || DEFAULT_QUALITY_SCORE);
  const next = getNextQualityLevel(current);
  if (!next) return { ok: false, error: "max level" };
  const cost = getQualityUpgradeCost(sku, current);
  if (Number(state.cash) < cost) return { ok: false, error: "insufficient cash" };
  state.cash -= cost;
  if (!state.qualityScore) state.qualityScore = {};
  state.qualityScore[skuId] = next.score;
  return { ok: true, levelName: next.name, cost };
}

/**
 * @param {object} state
 */
export function normalizeQualityScores(state) {
  if (!state?.qualityScore || !state?.skus) return;
  for (const sku of state.skus) {
    const id = sku.id;
    const raw = state.qualityScore[id];
    state.qualityScore[id] =
      raw == null ? DEFAULT_QUALITY_SCORE : snapQualityScore(Number(raw) || DEFAULT_QUALITY_SCORE);
  }
}
