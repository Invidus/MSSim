const DEFAULT_DURATION_MS = 5000;

/** @type {number | null} */
let hideTimer = null;
/** @type {number | null} */
let removeTimer = null;

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

/**
 * @param {"error"|"warn"|"success"|"info"} type
 */
function iconForType(type) {
  if (type === "success") return "✓";
  if (type === "warn") return "!";
  if (type === "info") return "i";
  return "⚠";
}

/**
 * @param {string} message
 * @param {{ type?: "error"|"warn"|"success"|"info"; duration?: number }} [opts]
 */
export function showGameToast(message, opts = {}) {
  if (typeof document === "undefined") return;
  const type = opts.type || "error";
  const duration = opts.duration ?? DEFAULT_DURATION_MS;
  const root = document.getElementById("gameToastRoot");
  if (!(root instanceof HTMLElement)) return;

  if (hideTimer != null) window.clearTimeout(hideTimer);
  if (removeTimer != null) window.clearTimeout(removeTimer);

  root.innerHTML = `<div class="game-toast game-toast--${type}" role="status" style="--toast-duration:${duration}ms">
    <div class="game-toast-body">
      <span class="game-toast-icon" aria-hidden="true">${iconForType(type)}</span>
      <span class="game-toast-text">${escapeHtml(message)}</span>
    </div>
    <div class="game-toast-timer" aria-hidden="true"><div class="game-toast-timer-bar"></div></div>
  </div>`;

  const toast = root.querySelector(".game-toast");
  if (!(toast instanceof HTMLElement)) return;

  requestAnimationFrame(() => {
    toast.classList.add("game-toast-visible");
  });

  hideTimer = window.setTimeout(() => {
    const bar = toast.querySelector(".game-toast-timer-bar");
    if (bar instanceof HTMLElement) {
      bar.style.animation = "none";
      bar.style.transform = "scaleX(0)";
    }
    toast.classList.add("game-toast-hide");
    removeTimer = window.setTimeout(() => {
      root.innerHTML = "";
    }, 320);
  }, duration);
}

/** @param {string} message */
export function toastError(message) {
  showGameToast(message, { type: "error" });
}

/** @param {string} message */
export function toastWarn(message) {
  showGameToast(message, { type: "warn" });
}

/** @param {string} message */
export function toastSuccess(message) {
  showGameToast(message, { type: "success" });
}

/** @param {string} message */
export function toastInfo(message) {
  showGameToast(message, { type: "info" });
}
