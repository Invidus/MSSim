export const DEFAULT_SHOP_NAME = "Мой магазин";
export const MAX_SHOP_NAME_LENGTH = 32;

/**
 * @param {unknown} raw
 */
export function normalizeShopName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) return DEFAULT_SHOP_NAME;
  return name.slice(0, MAX_SHOP_NAME_LENGTH);
}

/**
 * @param {object} state
 */
export function getShopName(state) {
  return normalizeShopName(state?.shopName);
}

/**
 * @param {object} state
 */
export function needsShopNamePrompt(state) {
  if (!state || state.shopNamePromptDone === true) return false;
  if (String(state.shopName || "").trim()) return false;
  if (Math.max(1, Math.round(Number(state.tutorialBeat) || 1)) > 1) return false;
  if (Number(state.day) > 1 || state.lastDayReport) return false;
  return true;
}

/**
 * @param {object} state
 */
export function markShopNamePromptDone(state) {
  if (!state) return;
  state.shopNamePromptDone = true;
}

/**
 * @param {object} state
 */
export function isShopNameLocked(state) {
  return state?.shopNamePromptDone === true;
}

/**
 * @param {object} state
 */
export function hasCustomShopName(state) {
  const name = String(state?.shopName ?? "").trim();
  return name.length > 0 && name !== DEFAULT_SHOP_NAME;
}

/**
 * @param {string} template
 * @param {object} state
 */
export function formatShopStory(template, state) {
  const shop = getShopName(state);
  return String(template || "")
    .replace(/\{shopName\}/g, shop)
    .replace(/\{shop\}/g, shop);
}
