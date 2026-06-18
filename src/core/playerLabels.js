/** Подписи для игрока вместо англ. терминов в UI. */

export const STOCKOUT_NOUN = "дефицит на складе";
export const STOCKOUT_RATE = "доля невыполненных заказов";
export const STOCKOUT_CAUSE = "нехватка товара";

/**
 * @param {number} units
 * @param {number} ratePct
 */
export function formatStockoutSummaryLine(units, ratePct) {
  return `${STOCKOUT_NOUN}: <b>${units}</b> шт. (${ratePct.toFixed(1)}% от желаемых заказов)`;
}
