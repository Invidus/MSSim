/**
 * Player UI: скрывает dev-панели в release и по умолчанию в dev.
 * Полный dev-интерфейс: добавьте ?dev=1 в URL.
 *
 * @param {object} [manifest]
 * @returns {"player" | "dev"}
 */
export function resolveUiMode(manifest) {
  if (typeof window === "undefined") return "player";
  const params = new URLSearchParams(window.location.search);
  if (params.get("dev") === "1") return "dev";
  if (manifest?.mode === "release") return "player";
  return "player";
}

/**
 * @param {"player" | "dev"} mode
 */
export function applyPlayerUiMode(mode) {
  if (typeof document === "undefined") return;
  const dev = mode === "dev";
  document.body.dataset.uiMode = dev ? "dev" : "player";
  for (const el of document.querySelectorAll("[data-dev-only]")) {
    if (el instanceof HTMLElement) {
      el.hidden = !dev;
      el.style.display = dev ? "" : "none";
    }
  }
  const hint = document.getElementById("devModeHint");
  if (hint instanceof HTMLElement) {
    hint.hidden = !dev;
  }
  if (dev) {
    applyBeginnerUi(4, true);
  }
}

/**
 * Постепенное открытие разделов для новичков (tier 1–4).
 * @param {1|2|3|4} tier
 * @param {boolean} [isDev]
 */
export function applyBeginnerUi(tier, isDev = false) {
  if (typeof document === "undefined") return;
  document.body.dataset.beginnerTier = String(tier);
  document.body.dataset.tutorialActive = "0";
  for (const el of document.querySelectorAll("[data-ui-section]")) {
    if (el instanceof HTMLElement) {
      el.hidden = false;
      el.style.display = "";
    }
  }
  for (const el of document.querySelectorAll("[data-beginner-min]")) {
    if (!(el instanceof HTMLElement)) continue;
    const min = Number(el.getAttribute("data-beginner-min")) || 1;
    const show = isDev || tier >= min;
    el.hidden = !show;
    el.style.display = show ? "" : "none";
  }
  const teaser = document.getElementById("beginnerTeaser");
  if (teaser instanceof HTMLElement) {
    const showTeaser = !isDev && tier < 4;
    teaser.hidden = !showTeaser;
    teaser.style.display = showTeaser ? "" : "none";
  }
  setTutorialChrome(false, 0, {});
}

/**
 * Режим обучения — видны только нужные блоки + подсветка в chrome.
 * @param {number} step
 * @param {string[]} visibleSections
 * @param {{ highlightNextDay?: boolean; hideBuyManual?: boolean; hideReset?: boolean }} [chrome]
 */
export function applyTutorialUi(step, visibleSections, chrome = {}) {
  if (typeof document === "undefined") return;
  const allowed = new Set(visibleSections);
  document.body.dataset.tutorialActive = "1";
  document.body.dataset.tutorialStep = String(step);
  document.body.dataset.beginnerTier = "1";

  for (const el of document.querySelectorAll("[data-ui-section]")) {
    if (!(el instanceof HTMLElement)) continue;
    const id = el.getAttribute("data-ui-section") || "";
    const show = allowed.has(id);
    el.hidden = !show;
    el.style.display = show ? "" : "none";
  }

  for (const el of document.querySelectorAll("[data-beginner-min]")) {
    if (!(el instanceof HTMLElement)) continue;
    const sectionId = el.getAttribute("data-ui-section") || "";
    if (sectionId && allowed.has(sectionId)) continue;
    el.hidden = true;
    el.style.display = "none";
  }

  const teaser = document.getElementById("beginnerTeaser");
  if (teaser instanceof HTMLElement) {
    teaser.hidden = true;
    teaser.style.display = "none";
  }

  setTutorialChrome(true, step, chrome);
}

/**
 * @param {boolean} active
 * @param {number} step
 * @param {{ highlightNextDay?: boolean; hideBuyManual?: boolean; hideReset?: boolean }} chrome
 */
function setTutorialChrome(active, step, chrome = {}) {
  const highlightNextDay = chrome.highlightNextDay === true;
  const hideBuyManual = chrome.hideBuyManual === true;
  const hideReset = chrome.hideReset !== false && step <= 5;
  const allowNextDay = !active || highlightNextDay;

  const nextBtn = document.getElementById("nextDayBtn");
  if (nextBtn instanceof HTMLButtonElement) {
    nextBtn.disabled = !allowNextDay;
    nextBtn.classList.toggle("tutorial-highlight", active && highlightNextDay);
    nextBtn.classList.toggle("tutorial-locked", active && !highlightNextDay);
  }
  const upgradesBtn = document.getElementById("upgradesBtn");
  if (upgradesBtn instanceof HTMLButtonElement) {
    upgradesBtn.disabled = active;
    upgradesBtn.classList.toggle("tutorial-locked", active);
  }
  const menuResetBtn = document.getElementById("gameMenuResetBtn");
  if (menuResetBtn instanceof HTMLElement) {
    menuResetBtn.hidden = active && hideReset;
    menuResetBtn.style.display = active && hideReset ? "none" : "";
  }
  const showAll = document.getElementById("showAllSectionsBtn");
  if (showAll instanceof HTMLElement) {
    showAll.hidden = active;
    showAll.style.display = active ? "none" : "";
  }
  const buyManual = document.getElementById("buyManualRow");
  if (buyManual instanceof HTMLElement) {
    buyManual.hidden = active && hideBuyManual;
    buyManual.style.display = active && hideBuyManual ? "none" : "";
  }
  const skipTutorial = document.getElementById("skipTutorialBtn");
  if (skipTutorial instanceof HTMLElement) {
    skipTutorial.hidden = !active;
    skipTutorial.style.display = active ? "" : "none";
  }
  const tagline = document.querySelector(".app-tagline");
  if (tagline instanceof HTMLElement) {
    tagline.hidden = active;
    tagline.style.display = active ? "none" : "";
  }
}
