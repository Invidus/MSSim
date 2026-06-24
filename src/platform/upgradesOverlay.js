let open = false;
/** @type {(() => void)|null} */
let onClose = null;
/** @type {(() => void)|null} */
let onOpen = null;

let canOpenUpgrades = null;

/**
 * @param {{ onOpen?: () => void; onClose?: () => void; canOpen?: () => boolean }} [opts]
 */
export function initUpgradesOverlay(opts = {}) {
  onOpen = opts.onOpen || null;
  onClose = opts.onClose || null;
  canOpenUpgrades = opts.canOpen || null;
  const root = document.getElementById("upgradesOverlay");
  const btn = document.getElementById("upgradesBtn");
  const closeBtn = document.getElementById("upgradesOverlayClose");
  const backdrop = root?.querySelector(".upgrades-backdrop");

  if (btn instanceof HTMLElement) {
    btn.addEventListener("click", () => {
      if (canOpenUpgrades && !canOpenUpgrades()) return;
      onOpen?.();
      openUpgradesOverlay();
    });
  }
  if (closeBtn instanceof HTMLElement) {
    closeBtn.addEventListener("click", () => closeUpgradesOverlay());
  }
  if (backdrop instanceof HTMLElement) {
    backdrop.addEventListener("click", () => closeUpgradesOverlay());
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeUpgradesOverlay();
  });
}

export function openUpgradesOverlay() {
  const root = document.getElementById("upgradesOverlay");
  const modal = root?.querySelector(".upgrades-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = true;
  root.hidden = false;
  document.body.classList.add("upgrades-open");
  requestAnimationFrame(() => {
    modal.classList.add("upgrades-modal-visible");
    for (const card of modal.querySelectorAll(".upgrade-card-animate")) {
      card.classList.remove("upgrade-card-pulse");
      void card.offsetWidth;
      card.classList.add("upgrade-card-pulse");
      card.addEventListener(
        "animationend",
        () => {
          card.classList.remove("upgrade-card-pulse");
          card.style.transform = "";
        },
        { once: true }
      );
    }
  });
}

export function closeUpgradesOverlay() {
  const root = document.getElementById("upgradesOverlay");
  const modal = root?.querySelector(".upgrades-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = false;
  modal.classList.remove("upgrades-modal-visible");
  document.body.classList.remove("upgrades-open");
  window.setTimeout(() => {
    if (!open) root.hidden = true;
  }, 220);
  onClose?.();
}

export function isUpgradesOverlayOpen() {
  return open;
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {string} className
 */
function pulseElement(el, className) {
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  el.addEventListener("animationend", () => el.classList.remove(className), { once: true });
}

/** @param {string} nodeId */
export function playUpgradePurchaseEffect(nodeId) {
  const id = String(nodeId || "");
  if (!id) return;
  for (const root of [
    document.getElementById("upgradesOverlayPanel"),
    document.getElementById("progressionPanel"),
  ]) {
    pulseElement(root?.querySelector(`[data-prog-node="${id}"]`), "upgrade-card-purchased");
  }
  document.body.classList.remove("upgrades-btn-flash");
  void document.body.offsetWidth;
  document.body.classList.add("upgrades-btn-flash");
  window.setTimeout(() => document.body.classList.remove("upgrades-btn-flash"), 400);
}

/** @param {string} skuId */
export function playQualityUpgradeEffect(skuId) {
  pulseElement(
    document.querySelector(`.js-quality-slot[data-sku-id="${String(skuId || "")}"]`),
    "quality-slot-purchased"
  );
}
