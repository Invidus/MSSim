import {
  LUXURY_CATEGORIES,
  buyLuxuryItem,
  sellLuxuryItem,
  getLuxuryResalePrice,
  getLuxuryPortfolioSummary,
  getLuxuryItemSpecs,
  getLuxuryItemHighlight,
  LUXURY_RESALE_RATE,
} from "../core/luxuryAssetsModel.js";
import { renderLuxuryVisual } from "./luxuryArt.js";

let open = false;
let detailOpen = false;
/** @type {string | null} */
let detailItemId = null;
/** @type {(() => boolean) | null} */
let canOpenLuxury = null;
/** @type {(() => void) | null} */
let onOpen = null;
/** @type {(() => void) | null} */
let onPurchase = null;
/** @type {(() => { state: object; catalog: object[] }) | null} */
let getContext = null;

function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("ru-RU");
}

/**
 * @param {object} item
 * @param {number} size
 */
function renderLuxuryArt(item, size) {
  if (item.image) {
    const photoClass = size > 96 ? "luxury-visual luxury-visual--photo" : "luxury-visual luxury-visual--photo";
    return `<img class="${photoClass}" src="${item.image}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
  }
  return renderLuxuryVisual(item.visual, item.tier, item.accent, size);
}

/**
 * @param {{ state: object; catalog: object[]; item: object }} ctx
 */
function renderLuxuryDetail(ctx) {
  const root = document.getElementById("luxuryDetailOverlay");
  const panel = root?.querySelector(".luxury-detail-panel");
  const artEl = document.getElementById("luxuryDetailArt");
  const titleEl = document.getElementById("luxuryDetailTitle");
  const descEl = document.getElementById("luxuryDetailDesc");
  const specsEl = document.getElementById("luxuryDetailSpecs");
  const metaEl = document.getElementById("luxuryDetailMeta");
  const actionsEl = document.getElementById("luxuryDetailActions");
  if (
    !(root instanceof HTMLElement) ||
    !(panel instanceof HTMLElement) ||
    !(artEl instanceof HTMLElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(descEl instanceof HTMLElement) ||
    !(specsEl instanceof HTMLElement) ||
    !(metaEl instanceof HTMLElement) ||
    !(actionsEl instanceof HTMLElement)
  ) {
    return;
  }

  const { state, item } = ctx;
  const owned = !!state.luxury?.owned?.[item.id];
  const paid = state.luxury?.owned?.[item.id]?.price || item.paidPrice || item.price;
  const canBuy = !owned && Number(state.cash) >= item.price;
  const resale = getLuxuryResalePrice(paid);
  const specs = getLuxuryItemSpecs(item);

  artEl.innerHTML = renderLuxuryArt(item, 360);
  titleEl.textContent = item.name;
  descEl.textContent = item.desc;
  specsEl.innerHTML = specs
    .map((s) => `<li><span>${s.label}</span><span>${s.value}</span></li>`)
    .join("");

  const day = state.luxury?.owned?.[item.id]?.day || item.purchaseDay;
  metaEl.innerHTML = owned
    ? [
        `<div class="luxury-detail-price">${money(paid)} ₽</div>`,
        `<div class="muted">В коллекции · выкуп ${Math.round(LUXURY_RESALE_RATE * 100)}% · ${money(resale)} ₽</div>`,
        day ? `<div class="muted">Куплено в день ${day}</div>` : "",
      ].join("")
    : `<div class="luxury-detail-price">${money(item.price)} ₽</div>`;

  actionsEl.innerHTML = owned
    ? `<button type="button" class="btn-secondary luxury-sell-btn" data-luxury-id="${item.id}">Продать · ${money(resale)} ₽</button>`
    : `<button type="button" class="btn-secondary luxury-buy-btn${canBuy ? "" : " luxury-buy-btn--disabled"}" data-luxury-id="${item.id}" ${canBuy ? "" : "disabled"}>Купить · ${money(item.price)} ₽</button>`;
}

function openLuxuryDetail(itemId) {
  const ctx = getContext?.();
  if (!ctx?.state) return;
  const item = ctx.catalog.find((x) => x.id === itemId);
  if (!item) return;

  const root = document.getElementById("luxuryDetailOverlay");
  const panel = root?.querySelector(".luxury-detail-panel");
  if (!(root instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;

  detailItemId = itemId;
  detailOpen = true;
  renderLuxuryDetail({ ...ctx, item });
  root.hidden = false;
  document.body.classList.add("luxury-detail-open");
  requestAnimationFrame(() => panel.classList.add("luxury-detail-visible"));
}

function closeLuxuryDetail() {
  const root = document.getElementById("luxuryDetailOverlay");
  const panel = root?.querySelector(".luxury-detail-panel");
  if (!(root instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;

  detailOpen = false;
  detailItemId = null;
  panel.classList.remove("luxury-detail-visible");
  document.body.classList.remove("luxury-detail-open");
  window.setTimeout(() => {
    if (!detailOpen) root.hidden = true;
  }, 220);
}

/**
 * @param {{ state: object; catalog: object[] }} ctx
 */
export function renderLuxuryOverlay(ctx) {
  const meta = document.getElementById("luxuryOverlayMeta");
  const tabs = document.getElementById("luxuryOverlayTabs");
  const grid = document.getElementById("luxuryOverlayGrid");
  if (!(meta instanceof HTMLElement) || !(tabs instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
    return;
  }

  const { state, catalog } = ctx;
  if (!state || !catalog.length) {
    meta.textContent = "Каталог не загружен.";
    tabs.innerHTML = "";
    grid.innerHTML = "";
    return;
  }

  state.luxury = state.luxury || { owned: {}, spendTotal: 0, selectedCategory: "auto" };
  const selected = state.luxury.selectedCategory || "auto";
  const summary = getLuxuryPortfolioSummary(state, catalog);
  const status = summary.status;

  meta.innerHTML = [
    `На счёте: <b>${money(state.cash)} ₽</b>`,
    `· Коллекция: <b>${summary.ownedCount}</b> шт. на <b>${money(summary.collectionValue)} ₽</b>`,
    `· Статус: <b style="color:#c9b8ff">${status.title}</b>`,
    status.nextAt
      ? `<span class="muted">(до «${status.nextTitle}» — ещё ${money(status.nextAt - status.spendTotal)} ₽)</span>`
      : "",
  ].join(" ");

  tabs.innerHTML = LUXURY_CATEGORIES.map((c) => {
    const active = c.id === selected ? " luxury-tab--active" : "";
    const count =
      c.id === "owned"
        ? summary.ownedCount
        : catalog.filter((x) => x.category === c.id && state.luxury.owned[x.id]).length;
    const badge = count > 0 ? `<span class="luxury-tab-badge">${count}</span>` : "";
    return `<button type="button" class="luxury-tab${active}" data-luxury-cat="${c.id}">${c.label}${badge}</button>`;
  }).join("");

  let items;
  if (selected === "owned") {
    items = summary.ownedItems;
  } else {
    items = catalog.filter((x) => x.category === selected).sort((a, b) => a.price - b.price);
  }

  if (!items.length) {
    grid.innerHTML =
      selected === "owned"
        ? `<p class="muted luxury-empty">Пока пусто — выберите категорию и купите первый актив.</p>`
        : `<p class="muted luxury-empty">В этой категории пока нет позиций.</p>`;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const owned = !!state.luxury.owned[item.id];
      const art = renderLuxuryArt(item, 88);
      const ownedTag = owned ? `<span class="luxury-card-owned-tag">В коллекции</span>` : "";
      const priceLine = owned
        ? `<div class="luxury-card-price muted">${money(state.luxury.owned[item.id]?.price || item.price)} ₽</div>`
        : `<div class="luxury-card-price">${money(item.price)} ₽</div>`;
      const highlight = getLuxuryItemHighlight(item);
      const specLine = highlight ? `<div class="luxury-card-spec muted">${highlight}</div>` : "";

      return `<article class="luxury-card${owned ? " luxury-card--owned" : ""}" data-luxury-id="${item.id}" role="button" tabindex="0" aria-label="${item.name}">
        <div class="luxury-card-art">${art}</div>
        <div class="luxury-card-body">
          <div class="luxury-card-name">${item.name}${ownedTag}</div>
          <div class="luxury-card-desc muted">${item.desc}</div>
          ${specLine}
          ${priceLine}
        </div>
      </article>`;
    })
    .join("");

  if (detailOpen && detailItemId) {
    const item = catalog.find((x) => x.id === detailItemId) || summary.ownedItems.find((x) => x.id === detailItemId);
    if (item) renderLuxuryDetail({ state, catalog, item });
  }
}

/**
 * @param {string} itemId
 */
function handleLuxuryPurchase(itemId) {
  const ctx = getContext?.();
  if (!ctx?.state || !itemId) return;
  const res = buyLuxuryItem(ctx.state, ctx.catalog, itemId);
  if (!res.ok) {
    window.dispatchEvent(
      new CustomEvent("luxury-buy-error", {
        detail: { error: res.error, need: res.need, have: res.have },
      })
    );
    return;
  }
  window.dispatchEvent(
    new CustomEvent("luxury-buy-success", {
      detail: { item: res.item, status: res.status },
    })
  );
  onPurchase?.();
  renderLuxuryOverlay(ctx);
}

/**
 * @param {string} itemId
 */
function handleLuxurySell(itemId) {
  const ctx = getContext?.();
  if (!ctx?.state || !itemId) return;
  const res = sellLuxuryItem(ctx.state, ctx.catalog, itemId);
  if (!res.ok) {
    window.dispatchEvent(
      new CustomEvent("luxury-sell-error", {
        detail: { error: res.error },
      })
    );
    return;
  }
  window.dispatchEvent(
    new CustomEvent("luxury-sell-success", {
      detail: { item: res.item, paid: res.paid, resale: res.resale, status: res.status },
    })
  );
  onPurchase?.();
  closeLuxuryDetail();
  renderLuxuryOverlay(ctx);
}

/**
 * @param {{ canOpen?: () => boolean; onOpen?: () => void; onPurchase?: () => void; getContext?: () => { state: object; catalog: object[] } }} opts
 */
export function initLuxuryOverlay(opts = {}) {
  canOpenLuxury = opts.canOpen || null;
  onOpen = opts.onOpen || null;
  onPurchase = opts.onPurchase || null;
  getContext = opts.getContext || null;

  const root = document.getElementById("luxuryOverlay");
  const btn = document.getElementById("luxuryBtn");
  const closeBtn = document.getElementById("luxuryOverlayClose");
  const backdrop = root?.querySelector(".luxury-backdrop");
  const tabs = document.getElementById("luxuryOverlayTabs");
  const grid = document.getElementById("luxuryOverlayGrid");

  const detailRoot = document.getElementById("luxuryDetailOverlay");
  const detailCloseBtn = document.getElementById("luxuryDetailClose");
  const detailBackdrop = detailRoot?.querySelector(".luxury-detail-backdrop");
  const detailActions = document.getElementById("luxuryDetailActions");

  if (btn instanceof HTMLElement) {
    btn.addEventListener("click", () => {
      if (canOpenLuxury && !canOpenLuxury()) return;
      onOpen?.();
      openLuxuryOverlay();
    });
  }
  if (closeBtn instanceof HTMLElement) closeBtn.addEventListener("click", closeLuxuryOverlay);
  if (backdrop instanceof HTMLElement) backdrop.addEventListener("click", closeLuxuryOverlay);

  if (detailCloseBtn instanceof HTMLElement) detailCloseBtn.addEventListener("click", closeLuxuryDetail);
  if (detailBackdrop instanceof HTMLElement) detailBackdrop.addEventListener("click", closeLuxuryDetail);

  if (tabs instanceof HTMLElement) {
    tabs.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const tab = t.closest(".luxury-tab");
      if (!(tab instanceof HTMLElement)) return;
      const ctx = getContext?.();
      if (!ctx?.state) return;
      const cat = tab.dataset.luxuryCat;
      if (!cat) return;
      ctx.state.luxury = ctx.state.luxury || { owned: {}, spendTotal: 0, selectedCategory: "auto" };
      ctx.state.luxury.selectedCategory = cat;
      renderLuxuryOverlay(ctx);
    });
  }

  const onGridClick = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const buyBtn = t.closest(".luxury-buy-btn");
    if (buyBtn instanceof HTMLButtonElement && !buyBtn.disabled) {
      e.stopPropagation();
      handleLuxuryPurchase(buyBtn.dataset.luxuryId || "");
      return;
    }

    const sellBtn = t.closest(".luxury-sell-btn");
    if (sellBtn instanceof HTMLButtonElement) {
      e.stopPropagation();
      handleLuxurySell(sellBtn.dataset.luxuryId || "");
      return;
    }

    const card = t.closest(".luxury-card");
    if (card instanceof HTMLElement && card.dataset.luxuryId) {
      openLuxuryDetail(card.dataset.luxuryId);
    }
  };

  if (grid instanceof HTMLElement) grid.addEventListener("click", onGridClick);
  if (detailActions instanceof HTMLElement) detailActions.addEventListener("click", onGridClick);

  if (grid instanceof HTMLElement) {
    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest(".luxury-card");
      if (card instanceof HTMLElement && card.dataset.luxuryId) {
        e.preventDefault();
        openLuxuryDetail(card.dataset.luxuryId);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (detailOpen) {
      closeLuxuryDetail();
      return;
    }
    if (open) closeLuxuryOverlay();
  });
}

export function openLuxuryOverlay() {
  const root = document.getElementById("luxuryOverlay");
  const modal = root?.querySelector(".luxury-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = true;
  root.hidden = false;
  document.body.classList.add("luxury-open");
  requestAnimationFrame(() => modal.classList.add("luxury-modal-visible"));
}

export function closeLuxuryOverlay() {
  closeLuxuryDetail();
  const root = document.getElementById("luxuryOverlay");
  const modal = root?.querySelector(".luxury-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = false;
  modal.classList.remove("luxury-modal-visible");
  document.body.classList.remove("luxury-open");
  window.setTimeout(() => {
    if (!open) root.hidden = true;
  }, 220);
}

export function isLuxuryOverlayOpen() {
  return open;
}
