import { saveToLocal, loadFromLocal, clearLocalSave } from "./saveLoad.js";

export const CLOUD_MOCK_KEY = "marketplace_seller_sim_cloud_v1";
export const SAVE_VERSION = 1;
export const MAX_CLOUD_BYTES = 180_000;

/**
 * @param {object} state
 * @param {string} [source]
 */
export function attachSaveMeta(state, source) {
  return {
    ...state,
    _savedAt: state._savedAt || new Date().toISOString(),
    _saveSource: source || state._saveSource || "local",
  };
}

/**
 * @param {object} state
 */
export function trimStateForCloud(state) {
  const s = { ...state };
  if (Array.isArray(s.kpiHistory) && s.kpiHistory.length > 30) {
    s.kpiHistory = s.kpiHistory.slice(-30);
  }
  if (Array.isArray(s.eventLog) && s.eventLog.length > 50) {
    s.eventLog = s.eventLog.slice(-50);
  }
  if (Array.isArray(s.serviceCauseHistory) && s.serviceCauseHistory.length > 30) {
    s.serviceCauseHistory = s.serviceCauseHistory.slice(-30);
  }
  return s;
}

/**
 * @param {object} state
 */
export function statePayloadBytes(state) {
  try {
    return new TextEncoder().encode(JSON.stringify(state)).length;
  } catch (_) {
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * @param {object | null | undefined} raw
 */
function saveTimestamp(raw) {
  if (!raw) return 0;
  const t = Date.parse(String(raw._savedAt || ""));
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {object | null | undefined} raw
 */
function saveDay(raw) {
  return Math.max(0, Math.round(Number(raw?.day) || 0));
}

/**
 * Выбирает более «прогрессивное» сохранение: сначала день, затем время записи.
 * @param {object | null | undefined} localRaw
 * @param {object | null | undefined} cloudRaw
 * @returns {{ state: object; source: "local" | "cloud" } | null}
 */
export function resolveBestSave(localRaw, cloudRaw) {
  if (!localRaw && !cloudRaw) return null;
  if (!localRaw) return { state: { ...cloudRaw, _saveSource: "cloud" }, source: "cloud" };
  if (!cloudRaw) return { state: { ...localRaw, _saveSource: "local" }, source: "local" };

  const localDay = saveDay(localRaw);
  const cloudDay = saveDay(cloudRaw);
  if (cloudDay > localDay) return { state: { ...cloudRaw, _saveSource: "cloud" }, source: "cloud" };
  if (localDay > cloudDay) return { state: { ...localRaw, _saveSource: "local" }, source: "local" };

  const localAt = saveTimestamp(localRaw);
  const cloudAt = saveTimestamp(cloudRaw);
  if (cloudAt > localAt) return { state: { ...cloudRaw, _saveSource: "cloud" }, source: "cloud" };
  return { state: { ...localRaw, _saveSource: "local" }, source: "local" };
}

/**
 * @param {object} player
 */
export function createYandexCloudAdapter(player) {
  return {
    label: "yandex",
    async load() {
      const data = await player.getData(["gameState", "saveMeta"]);
      if (!data?.gameState) return null;
      try {
        const raw = data.gameState;
        if (raw === "" || raw == null) return null;
        const state = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!state || typeof state !== "object") return null;
        if (data.saveMeta?.savedAt) state._savedAt = data.saveMeta.savedAt;
        state._saveSource = "cloud";
        return state;
      } catch (e) {
        console.warn("createYandexCloudAdapter.load parse failed", e);
        return null;
      }
    },
    async save(state, flush = false) {
      const trimmed = trimStateForCloud(state);
      const bytes = statePayloadBytes(trimmed);
      if (bytes > MAX_CLOUD_BYTES) {
        return { ok: false, error: `cloud payload too large (${bytes} bytes)` };
      }
      const savedAt = new Date().toISOString();
      await player.setData(
        {
          gameState: JSON.stringify(trimmed),
          saveMeta: { version: SAVE_VERSION, day: trimmed.day, savedAt },
        },
        !!flush
      );
      return { ok: true, savedAt, bytes };
    },
    async clear() {
      await player.setData(
        {
          gameState: "",
          saveMeta: { version: 0, day: 0, savedAt: "" },
        },
        true
      );
      return { ok: true };
    },
  };
}

/**
 * Локальный mock облака для dev без YaGames.
 */
export function createMockCloudAdapter() {
  return {
    label: "mock",
    async load() {
      try {
        const raw = localStorage.getItem(CLOUD_MOCK_KEY);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (!state || typeof state !== "object") return null;
        state._saveSource = "cloud";
        return state;
      } catch (e) {
        console.warn("createMockCloudAdapter.load failed", e);
        return null;
      }
    },
    async save(state, _flush = false) {
      try {
        const trimmed = trimStateForCloud(attachSaveMeta(state, "cloud"));
        const bytes = statePayloadBytes(trimmed);
        if (bytes > MAX_CLOUD_BYTES) {
          return { ok: false, error: `cloud payload too large (${bytes} bytes)` };
        }
        localStorage.setItem(CLOUD_MOCK_KEY, JSON.stringify(trimmed));
        return { ok: true, savedAt: trimmed._savedAt, bytes };
      } catch (e) {
        console.warn("createMockCloudAdapter.save failed", e);
        return { ok: false, error: String(e) };
      }
    },
    async clear() {
      try {
        localStorage.removeItem(CLOUD_MOCK_KEY);
      } catch (_) {
        /* ignore */
      }
      return { ok: true };
    },
  };
}

/**
 * @param {{ player?: object | null; sdk?: object | null }} platform
 */
export function createCloudAdapter(platform) {
  if (platform?.player && typeof platform.player.getData === "function") {
    return createYandexCloudAdapter(platform.player);
  }
  return createMockCloudAdapter();
}

/**
 * @param {{ load: () => Promise<object | null> } | null} adapter
 */
export async function loadCloudSave(adapter) {
  if (!adapter) return null;
  try {
    return await adapter.load();
  } catch (e) {
    console.warn("loadCloudSave failed", e);
    return null;
  }
}

/**
 * @param {{ save: (state: object, flush?: boolean) => Promise<{ ok: boolean }> } | null} adapter
 * @param {object} state
 * @param {boolean} [flush]
 */
export async function saveCloudSave(adapter, state, flush = false) {
  if (!adapter) return { ok: false, skipped: true, error: "no adapter" };
  try {
    return await adapter.save(attachSaveMeta(state, "cloud"), flush);
  } catch (e) {
    console.warn("saveCloudSave failed", e);
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {{ clear: () => Promise<{ ok: boolean }> } | null} adapter
 */
export async function clearCloudSave(adapter) {
  if (!adapter) return { ok: true, skipped: true };
  try {
    return await adapter.clear();
  } catch (e) {
    console.warn("clearCloudSave failed", e);
    return { ok: false, error: String(e) };
  }
}

/**
 * @param {object | null | undefined} adapter
 */
export function hasCloudMockSave() {
  try {
    return !!localStorage.getItem(CLOUD_MOCK_KEY);
  } catch (_) {
    return false;
  }
}

export { saveToLocal, loadFromLocal, clearLocalSave };
