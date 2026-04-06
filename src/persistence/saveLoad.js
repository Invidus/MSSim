const STORAGE_KEY = "marketplace_seller_sim_v1";

/**
 * @param {object} state
 */
export function saveToLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    console.warn("saveToLocal failed", e);
    return { ok: false, error: String(e) };
  }
}

/**
 * @returns {object | null}
 */
export function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("loadFromLocal failed", e);
    return null;
  }
}

export function clearLocalSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}
