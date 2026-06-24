import { DEFAULT_SHOP_NAME, MAX_SHOP_NAME_LENGTH, normalizeShopName } from "../core/storeIdentityModel.js";
import { SHOP_NAME_SUGGESTIONS } from "../data/shopNameSuggestions.js";

let open = false;
let welcomeBound = false;
let welcomeSubmitting = false;
/** @type {((name: string) => void) | null} */
let onSubmit = null;

export function isShopNameWelcomeOpen() {
  return open;
}

export function closeShopNameWelcome() {
  const root = document.getElementById("shopNameWelcomeOverlay");
  if (root instanceof HTMLElement) root.hidden = true;
  document.body.classList.remove("shop-welcome-open");
  open = false;
}

function renderSuggestionChips() {
  const wrap = document.getElementById("shopNameSuggestions");
  if (!(wrap instanceof HTMLElement)) return;
  wrap.innerHTML = SHOP_NAME_SUGGESTIONS.map(
    (name) =>
      `<button type="button" class="shop-name-suggestion-chip" data-name="${name.replace(/"/g, "&quot;")}">${name}</button>`
  ).join("");
}

/**
 * @param {{ initialName?: string; onSubmit?: (name: string) => void }} [opts]
 */
export function openShopNameWelcome(opts = {}) {
  const root = document.getElementById("shopNameWelcomeOverlay");
  const input = document.getElementById("shopNameWelcomeInput");
  if (!(root instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;

  onSubmit = opts.onSubmit || null;
  input.value = String(opts.initialName || "").slice(0, MAX_SHOP_NAME_LENGTH);
  renderSuggestionChips();
  root.hidden = false;
  document.body.classList.add("shop-welcome-open");
  open = true;

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function submitWelcome() {
  if (welcomeSubmitting) return;
  const input = document.getElementById("shopNameWelcomeInput");
  if (!(input instanceof HTMLInputElement)) return;
  const raw = input.value.trim();
  const name = raw ? normalizeShopName(raw) : "";
  welcomeSubmitting = true;
  closeShopNameWelcome();
  try {
    onSubmit?.(name);
  } finally {
    welcomeSubmitting = false;
  }
}

/**
 * @param {{ onSubmit: (name: string) => void }} opts
 */
export function initShopNameWelcome(opts) {
  onSubmit = opts.onSubmit;

  const root = document.getElementById("shopNameWelcomeOverlay");
  const form = document.getElementById("shopNameWelcomeForm");
  const backdrop = root?.querySelector(".shop-welcome-backdrop");
  const input = document.getElementById("shopNameWelcomeInput");
  const suggestions = document.getElementById("shopNameSuggestions");

  if (!welcomeBound) {
    welcomeBound = true;
    if (form instanceof HTMLFormElement) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitWelcome();
      });
    }
    if (suggestions instanceof HTMLElement) {
      suggestions.addEventListener("click", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const chip = t.closest(".shop-name-suggestion-chip");
        if (!(chip instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
        const name = chip.dataset.name || chip.textContent || "";
        input.value = String(name).slice(0, MAX_SHOP_NAME_LENGTH);
        for (const el of suggestions.querySelectorAll(".shop-name-suggestion-chip")) {
          el.classList.toggle("is-selected", el === chip);
        }
        input.focus();
      });
    }
    if (backdrop instanceof HTMLElement) {
      backdrop.addEventListener("click", (e) => {
        e.preventDefault();
      });
    }
  }

  if (input instanceof HTMLInputElement) {
    input.setAttribute("placeholder", DEFAULT_SHOP_NAME);
    input.setAttribute("maxlength", String(MAX_SHOP_NAME_LENGTH));
  }
  renderSuggestionChips();
}
