export async function initYandexSdk() {
  if (!window.YaGames || typeof window.YaGames.init !== "function") {
    return { available: false, sdk: null };
  }

  try {
    const sdk = await window.YaGames.init();
    return { available: true, sdk };
  } catch (error) {
    console.warn("Yandex SDK init failed", error);
    return { available: false, sdk: null };
  }
}
