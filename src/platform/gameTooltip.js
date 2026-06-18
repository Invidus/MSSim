/** @type {HTMLElement | null} */
let tipRoot = null;
/** @type {HTMLElement | null} */
let activeAnchor = null;
let hideTimer = 0;

function getTipRoot() {
  if (!tipRoot) tipRoot = document.getElementById("gameTooltipRoot");
  return tipRoot instanceof HTMLElement ? tipRoot : null;
}

/**
 * @param {HTMLElement} anchor
 */
function positionTooltip(anchor) {
  const root = getTipRoot();
  if (!root) return;
  const r = anchor.getBoundingClientRect();
  const margin = 10;
  const gap = 8;
  let top = r.bottom + gap;
  let left = r.left + r.width / 2 - root.offsetWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - root.offsetWidth - margin));
  if (top + root.offsetHeight > window.innerHeight - margin) {
    top = r.top - root.offsetHeight - gap;
  }
  top = Math.max(margin, top);
  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;
}

/**
 * @param {HTMLElement} anchor
 * @param {string} text
 */
function showGameTooltip(anchor, text) {
  const root = getTipRoot();
  if (!root || !text) return;
  window.clearTimeout(hideTimer);
  activeAnchor = anchor;
  root.textContent = text;
  root.hidden = false;
  root.classList.remove("game-tooltip-visible");
  positionTooltip(anchor);
  requestAnimationFrame(() => root.classList.add("game-tooltip-visible"));
}

function hideGameTooltip() {
  const root = getTipRoot();
  if (!root) return;
  activeAnchor = null;
  root.classList.remove("game-tooltip-visible");
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!activeAnchor) root.hidden = true;
  }, 150);
}

export function initGameTooltips() {
  const root = getTipRoot();
  if (!root) return;

  document.addEventListener(
    "mouseover",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest("[data-tip].kpi-help, [data-tip].game-tip");
      if (!(el instanceof HTMLElement)) return;
      const text = el.getAttribute("data-tip") || "";
      showGameTooltip(el, text);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest("[data-tip].kpi-help, [data-tip].game-tip");
      if (!(el instanceof HTMLElement) || activeAnchor !== el) return;
      const related = e.relatedTarget;
      if (related instanceof Node && (el.contains(related) || root.contains(related))) return;
      hideGameTooltip();
    },
    true
  );

  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches("[data-tip].kpi-help, [data-tip].game-tip")) return;
    showGameTooltip(t, t.getAttribute("data-tip") || "");
  });

  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.matches("[data-tip].kpi-help, [data-tip].game-tip")) return;
    hideGameTooltip();
  });

  window.addEventListener("scroll", () => {
    if (activeAnchor) positionTooltip(activeAnchor);
  }, true);

  window.addEventListener("resize", () => {
    if (activeAnchor) positionTooltip(activeAnchor);
  });
}
