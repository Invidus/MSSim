/**
 * @typedef {object} YandexInitResult
 * @property {boolean} available
 * @property {object | null} sdk
 * @property {object | null} player
 */

/**
 * @param {object} sdk
 */
async function loadPlayer(sdk) {
  if (!sdk || typeof sdk.getPlayer !== "function") return null;
  try {
    return await sdk.getPlayer({ signed: true });
  } catch (signedError) {
    console.warn("Yandex getPlayer(signed) failed, trying guest", signedError);
    try {
      return await sdk.getPlayer();
    } catch (guestError) {
      console.warn("Yandex getPlayer failed", guestError);
      return null;
    }
  }
}

/**
 * @returns {Promise<YandexInitResult>}
 */
export async function initYandexSdk() {
  if (!window.YaGames || typeof window.YaGames.init !== "function") {
    return { available: false, sdk: null, player: null };
  }

  try {
    const sdk = await window.YaGames.init();
    const player = await loadPlayer(sdk);
    return { available: true, sdk, player };
  } catch (error) {
    console.warn("Yandex SDK init failed", error);
    return { available: false, sdk: null, player: null };
  }
}

/**
 * Сигнал Яндекс Играм: загрузка завершена, можно скрыть splash.
 * @param {object | null | undefined} sdk
 */
export function signalYandexGameReady(sdk) {
  try {
    const api = sdk?.features?.LoadingAPI;
    if (api && typeof api.ready === "function") api.ready();
  } catch (e) {
    console.warn("LoadingAPI.ready failed", e);
  }
}

/**
 * @param {object | null | undefined} sdk
 */
export function startYandexGameplay(sdk) {
  try {
    const api = sdk?.features?.GameplayAPI;
    if (api && typeof api.start === "function") api.start();
  } catch (e) {
    console.warn("GameplayAPI.start failed", e);
  }
}

/**
 * @param {object | null | undefined} sdk
 */
export function stopYandexGameplay(sdk) {
  try {
    const api = sdk?.features?.GameplayAPI;
    if (api && typeof api.stop === "function") api.stop();
  } catch (e) {
    console.warn("GameplayAPI.stop failed", e);
  }
}

/**
 * @param {object | null | undefined} sdk
 * @param {{ onOpen?: () => void; onClose?: () => void | Promise<void> }} handlers
 */
export function bindAccountSelectionHandlers(sdk, handlers = {}) {
  if (!sdk || typeof sdk.on !== "function" || !sdk.EVENTS) return;
  try {
    if (sdk.EVENTS.ACCOUNT_SELECTION_DIALOG_OPENED) {
      sdk.on(sdk.EVENTS.ACCOUNT_SELECTION_DIALOG_OPENED, () => {
        handlers.onOpen?.();
      });
    }
    if (sdk.EVENTS.ACCOUNT_SELECTION_DIALOG_CLOSED) {
      sdk.on(sdk.EVENTS.ACCOUNT_SELECTION_DIALOG_CLOSED, () => {
        void handlers.onClose?.();
      });
    }
  } catch (e) {
    console.warn("bindAccountSelectionHandlers failed", e);
  }
}

/**
 * @param {object | null | undefined} sdk
 */
export async function refreshYandexPlayer(sdk) {
  return loadPlayer(sdk);
}
