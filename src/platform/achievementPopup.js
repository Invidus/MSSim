/** @type {number | null} */
let hideTimer = null;
/** @type {number | null} */
let removeTimer = null;
/** @type {Array<{ title: string; desc: string; icon: string }>} */
let queue = [];
let draining = false;

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHOW_MS = 3000;
const FADE_MS = 420;

/**
 * @param {{ title: string; desc: string; icon: string }} ach
 */
function showOneAchievement(ach) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }
    const root = document.getElementById("achievementPopupRoot");
    if (!(root instanceof HTMLElement)) {
      resolve();
      return;
    }

    if (hideTimer != null) window.clearTimeout(hideTimer);
    if (removeTimer != null) window.clearTimeout(removeTimer);

    root.innerHTML = `<div class="achievement-popup" role="status" aria-live="polite">
      <div class="achievement-popup-glow" aria-hidden="true"></div>
      <div class="achievement-popup-icon" aria-hidden="true">${escapeHtml(ach.icon || "🏆")}</div>
      <div class="achievement-popup-body">
        <div class="achievement-popup-kicker">Достижение разблокировано</div>
        <div class="achievement-popup-title">${escapeHtml(ach.title)}</div>
        <div class="achievement-popup-desc">${escapeHtml(ach.desc)}</div>
      </div>
    </div>`;

    root.hidden = false;
    requestAnimationFrame(() => {
      const card = root.querySelector(".achievement-popup");
      if (card instanceof HTMLElement) card.classList.add("achievement-popup--visible");
    });

    hideTimer = window.setTimeout(() => {
      const card = root.querySelector(".achievement-popup");
      if (card instanceof HTMLElement) card.classList.add("achievement-popup--hide");
      removeTimer = window.setTimeout(() => {
        root.innerHTML = "";
        root.hidden = true;
        resolve();
      }, FADE_MS);
    }, SHOW_MS);
  });
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const next = queue.shift();
    if (next) await showOneAchievement(next);
  }
  draining = false;
}

/**
 * @param {Array<{ title: string; desc: string; icon: string }>} list
 */
export function enqueueAchievementPopups(list) {
  if (!list?.length) return;
  queue.push(...list);
  void drainQueue();
}

export function clearAchievementPopupQueue() {
  queue = [];
}
