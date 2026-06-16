/**
 * @typedef {object} YandexInitResult
 * @property {boolean} available
 * @property {object | null} sdk
 * @property {object | null} player
 */

/**
 * @returns {Promise<YandexInitResult>}
 */
export async function initYandexSdk() {
  if (!window.YaGames || typeof window.YaGames.init !== "function") {
    return { available: false, sdk: null, player: null };
  }

  try {
    const sdk = await window.YaGames.init();
    let player = null;
    if (sdk && typeof sdk.getPlayer === "function") {
      try {
        player = await sdk.getPlayer();
      } catch (playerError) {
        console.warn("Yandex getPlayer failed", playerError);
      }
    }
    return { available: true, sdk, player };
  } catch (error) {
    console.warn("Yandex SDK init failed", error);
    return { available: false, sdk: null, player: null };
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
  if (!sdk || typeof sdk.getPlayer !== "function") return null;
  try {
    return await sdk.getPlayer();
  } catch (e) {
    console.warn("refreshYandexPlayer failed", e);
    return null;
  }
}
