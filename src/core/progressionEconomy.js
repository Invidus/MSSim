/**
 * Экономика улучшений магазина: SP + деньги на каждый узел.
 */

/** @param {{ cost?: number }} node */
export function getNodeSpCost(node) {
  if (!node) return 1;
  const raw = node.cost;
  return raw != null ? Math.max(0, Math.round(Number(raw))) : 1;
}

/** @param {{ cashCost?: number }} node */
export function getNodeCashCost(node) {
  if (!node) return 0;
  return Math.max(0, Math.round(Number(node.cashCost) || 0));
}

/**
 * Подпись стоимости для карточки улучшения.
 * @param {{ cost?: number; cashCost?: number }} node
 */
export function formatNodeCostLabel(node) {
  const sp = getNodeSpCost(node);
  const cash = getNodeCashCost(node);
  const parts = [];
  if (sp > 0) parts.push(`${sp} SP`);
  if (cash > 0) parts.push(`${cash.toLocaleString("ru-RU")} ₽`);
  return parts.length ? parts.join(" + ") : "бесплатно";
}

/**
 * @param {object} state
 * @param {{ cost?: number; cashCost?: number }} node
 */
export function getNodeUnlockBlockers(state, node) {
  /** @type {string[]} */
  const blockers = [];
  if (!state || !node) return ["нет данных"];
  const sp = getNodeSpCost(node);
  const cash = getNodeCashCost(node);
  const haveSp = Number(state.progressionPoints) || 0;
  const haveCash = Number(state.cash) || 0;
  if (haveSp < sp) blockers.push(`нужно ${sp} SP (сейчас ${haveSp})`);
  if (haveCash < cash) blockers.push(`не хватает ${(cash - haveCash).toLocaleString("ru-RU")} ₽`);
  return blockers;
}
