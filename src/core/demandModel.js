/** @param {number} v @param {number} min @param {number} max */
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * @param {number} adBudget
 * @param {number} cap
 */
export function saturationPenalty(adBudget, cap) {
  if (cap <= 0) return 1;
  const x = adBudget / cap;
  return 1 / (1 + x ** 1.15);
}

/**
 * @param {number} adBudget
 * @param {{ adEfficiency: number; saturationCap: number }} cfg
 */
export function computeAdTrafficTotal(adBudget, cfg) {
  const sat = saturationPenalty(adBudget, cfg.saturationCap);
  return adBudget * cfg.adEfficiency * sat;
}

/**
 * @param {{
 *   price: number;
 *   marketPrice: number;
 *   qualityScore: number;
 *   leadTimeDays: number;
 *   promoMod: number;
 *   baseConversion: number;
 * }} p
 */
export function computeConversionRate(p) {
  const marketPrice = p.marketPrice > 0 ? p.marketPrice : p.price;
  const priceIndex = marketPrice > 0 ? p.price / marketPrice : 1;
  const priceConvMod = clamp(1.3 - 0.6 * priceIndex, 0.55, 1.2);
  const qualityConvMod = 0.65 + p.qualityScore / 200;
  const shippingConvMod = clamp(1.1 - 0.03 * p.leadTimeDays, 0.75, 1.05);
  return p.baseConversion * priceConvMod * qualityConvMod * shippingConvMod * p.promoMod;
}
