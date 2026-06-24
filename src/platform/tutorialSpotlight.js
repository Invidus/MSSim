/** @typedef {{ step: number; totalSteps: number; title: string; body: string; tips?: string[]; spotlight?: string|null; placement?: string; highlights?: string[]; cta?: string|null; ctaLabel?: string|null; interactive?: boolean }} SpotlightContent */

let resizeHandler = null;
let activeContent = null;
/** @type {((cta: string) => void)|null} */
let spotlightActionHandler = null;

/**
 * @param {string} selector
 */
function resolveTarget(selector) {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  return el instanceof HTMLElement ? el : null;
}

function clearHighlights() {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll(".tutorial-highlight")) {
    el.classList.remove("tutorial-highlight");
  }
}

/**
 * @param {string[]} selectors
 */
function applyHighlights(selectors) {
  clearHighlights();
  if (!selectors?.length) return;
  for (const sel of selectors) {
    const el = resolveTarget(sel);
    if (el) el.classList.add("tutorial-highlight");
  }
}

function ensureRoot() {
  let root = document.getElementById("tutorialSpotlightRoot");
  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.id = "tutorialSpotlightRoot";
    root.hidden = true;
    root.innerHTML = `
      <div class="tutorial-spotlight-backdrop" data-spotlight-dismiss></div>
      <div class="tutorial-spotlight-hole" aria-hidden="true"></div>
      <div class="tutorial-spotlight-popover" role="dialog" aria-modal="true">
        <div class="tutorial-spotlight-step"></div>
        <h3 class="tutorial-spotlight-title"></h3>
        <p class="tutorial-spotlight-body"></p>
        <ul class="tutorial-spotlight-tips"></ul>
        <p class="tutorial-spotlight-wait muted"></p>
        <div class="tutorial-spotlight-actions row"></div>
      </div>
    `;
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {DOMRect} holeRect
 * @param {HTMLElement} hole
 * @param {HTMLElement} popover
 * @param {string} placement
 * @param {{ anchorRect?: DOMRect; maxWidth?: number }} [opts]
 */
function positionSpotlight(holeRect, hole, popover, placement, opts = {}) {
  const anchorRect = opts.anchorRect || holeRect;
  const pad = 8;
  const holeTop = Math.max(8, holeRect.top - pad);
  const holeLeft = Math.max(8, holeRect.left - pad);
  const holeW = holeRect.width + pad * 2;
  const holeH = holeRect.height + pad * 2;

  hole.style.top = `${holeTop}px`;
  hole.style.left = `${holeLeft}px`;
  hole.style.width = `${holeW}px`;
  hole.style.height = `${holeH}px`;

  const margin = placement === "bottom" ? 22 : 14;
  const maxW = opts.maxWidth && opts.maxWidth > 0 ? opts.maxWidth : 380;
  popover.style.maxWidth = `min(${maxW}px, calc(100vw - 24px))`;
  popover.classList.toggle("tutorial-spotlight-popover--compact", maxW <= 300);
  popover.style.visibility = "hidden";
  popover.style.top = "0";
  popover.style.left = "0";

  requestAnimationFrame(() => {
    const popH = popover.offsetHeight;
    const popW = popover.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const aTop = anchorRect.top;
    const aLeft = anchorRect.left;
    const aW = anchorRect.width;
    const aH = anchorRect.height;

    const clamp = (top, left) => ({
      top: Math.max(12, Math.min(top, vh - popH - 12)),
      left: Math.max(12, Math.min(left, vw - popW - 12)),
    });

    const overlapsHole = (top, left) =>
      left < holeLeft + holeW &&
      left + popW > holeLeft &&
      top < holeTop + holeH &&
      top + popH > holeTop;

    /** @type {{ id: string; top: number; left: number }[]} */
    const candidates = [];

    if (placement === "center") {
      const c = clamp((vh - popH) / 2, (vw - popW) / 2);
      candidates.push({ id: "center", ...c });
    } else {
      const raw = [
        { id: "left", top: aTop + aH / 2 - popH / 2, left: aLeft - popW - margin },
        { id: "right", top: aTop + aH / 2 - popH / 2, left: aLeft + aW + margin },
        { id: "bottom", top: aTop + aH + margin, left: aLeft + aW / 2 - popW / 2 },
        { id: "top", top: aTop - popH - margin, left: aLeft + aW / 2 - popW / 2 },
      ];
      for (const row of raw) {
        candidates.push({ id: row.id, ...clamp(row.top, row.left) });
      }
    }

    const preferred = candidates.find((c) => c.id === placement && !overlapsHole(c.top, c.left));
    const fallback = candidates.find((c) => !overlapsHole(c.top, c.left));
    const chosen = preferred || fallback || candidates.find((c) => c.id === placement) || candidates[0];

    popover.style.top = `${chosen.top}px`;
    popover.style.left = `${chosen.left}px`;
    popover.style.visibility = "visible";
  });
}

/**
 * @param {HTMLElement|null} target
 * @param {string} [placement]
 */
function resolveSpotlightPlacement(target, placement) {
  const p = placement || "bottom";
  if (target?.closest(".store-sidebar") && (p === "top" || p === "bottom")) return "left";
  return p;
}

/**
 * @param {SpotlightContent|null} content
 */
export function renderTutorialSpotlight(content) {
  if (typeof document === "undefined") return;
  const root = ensureRoot();

  if (!content) {
    hideTutorialSpotlight();
    return;
  }

  activeContent = content;
  const target = resolveTarget(content.spotlight || ".app-header");
  const hole = root.querySelector(".tutorial-spotlight-hole");
  const popover = root.querySelector(".tutorial-spotlight-popover");
  if (!(hole instanceof HTMLElement) || !(popover instanceof HTMLElement)) return;

  const stepEl = popover.querySelector(".tutorial-spotlight-step");
  const titleEl = popover.querySelector(".tutorial-spotlight-title");
  const bodyEl = popover.querySelector(".tutorial-spotlight-body");
  const tipsEl = popover.querySelector(".tutorial-spotlight-tips");
  const waitEl = popover.querySelector(".tutorial-spotlight-wait");
  const actionsEl = popover.querySelector(".tutorial-spotlight-actions");

  if (stepEl instanceof HTMLElement) {
    stepEl.textContent = `Шаг ${content.step} из ${content.totalSteps}`;
  }
  if (titleEl instanceof HTMLElement) titleEl.textContent = content.title;
  if (bodyEl instanceof HTMLElement) bodyEl.textContent = content.body;

  if (tipsEl instanceof HTMLUListElement) {
    const tips = content.tips || [];
    tipsEl.innerHTML = tips.map((t) => `<li>${t}</li>`).join("");
    tipsEl.hidden = tips.length === 0;
  }

  const interactive = content.interactive === true;
  if (waitEl instanceof HTMLElement) {
    if (interactive && content.waitHint) {
      waitEl.textContent = content.waitHint;
      waitEl.hidden = false;
    } else {
      waitEl.textContent = "";
      waitEl.hidden = true;
    }
  }

  if (actionsEl instanceof HTMLElement) {
    actionsEl.innerHTML = "";
    if (!interactive && content.cta && content.ctaLabel) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary js-tutorial-spotlight-cta";
      btn.dataset.cta = content.cta;
      btn.textContent = content.ctaLabel;
      actionsEl.appendChild(btn);
    }
  }

  applyHighlights(content.highlights);

  root.hidden = false;
  document.body.classList.toggle("tutorial-spotlight-interactive", interactive);
  document.body.classList.add("tutorial-spotlight-open");

  const place = () => {
    if (!target) {
      hole.style.top = "50%";
      hole.style.left = "50%";
      hole.style.width = "0";
      hole.style.height = "0";
      positionSpotlight(new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0), hole, popover, "center");
      return;
    }
    const rect = target.getBoundingClientRect();
    const useSidebarAnchor =
      content.popoverAnchor && typeof window !== "undefined" && window.innerWidth >= 920;
    const anchorEl = useSidebarAnchor ? resolveTarget(content.popoverAnchor) : target;
    const anchorRect = anchorEl instanceof HTMLElement ? anchorEl.getBoundingClientRect() : rect;
    let placement = resolveSpotlightPlacement(target, content.placement || "bottom");
    if (useSidebarAnchor) placement = content.placement || "left";
    else if (!useSidebarAnchor && content.popoverAnchor) placement = "bottom";

    positionSpotlight(rect, hole, popover, placement, {
      anchorRect,
      maxWidth: content.popoverMaxWidth || 0,
    });
    if (!target.closest(".next-day-fab")) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  place();

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    window.removeEventListener("scroll", resizeHandler, true);
  }
  resizeHandler = () => place();
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("scroll", resizeHandler, true);
}

export function hideTutorialSpotlight() {
  if (typeof document === "undefined") return;
  activeContent = null;
  clearHighlights();
  const root = document.getElementById("tutorialSpotlightRoot");
  if (root instanceof HTMLElement) root.hidden = true;
  document.body.classList.remove("tutorial-spotlight-open");
  document.body.classList.remove("tutorial-spotlight-interactive");
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    window.removeEventListener("scroll", resizeHandler, true);
    resizeHandler = null;
  }
}

/**
 * @param {(cta: string) => void} onAction
 */
export function bindTutorialSpotlightActions(onAction) {
  spotlightActionHandler = onAction;
  const root = ensureRoot();
  if (root.dataset.bound === "1") return;
  root.dataset.bound = "1";
  root.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest(".js-tutorial-spotlight-cta");
    if (btn instanceof HTMLElement && btn.dataset.cta && spotlightActionHandler) {
      spotlightActionHandler(btn.dataset.cta);
    }
  });
}
