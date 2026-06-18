import {
  buyCrypto,
  sellCrypto,
  getCryptoPortfolioSummary,
  cryptoPriceChangePct,
} from "../core/cryptoExchangeModel.js";

let open = false;
/** @type {(() => boolean) | null} */
let canOpenCrypto = null;
/** @type {(() => void) | null} */
let onOpen = null;
/** @type {(() => void) | null} */
let onTrade = null;
/** @type {(() => { state: object; assets: object[] }) | null} */
let getContext = null;

function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("ru-RU");
}

function fmtQty(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 8 });
}

function fmtPrice(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return money(v);
  if (v >= 1) return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

/**
 * @param {number[]} history
 * @param {number} w
 * @param {number} h
 */
function sparklineSvg(history, w = 88, h = 28) {
  const pts = Array.isArray(history) ? history.filter((x) => Number.isFinite(x)) : [];
  if (pts.length < 2) return `<svg width="${w}" height="${h}" class="crypto-spark"></svg>`;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const coords = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  const stroke = up ? "#8fd694" : "#ff8f8f";
  return `<svg width="${w}" height="${h}" class="crypto-spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${coords}"/></svg>`;
}

/**
 * @param {{ state: object; assets: object[] }} ctx
 */
export function renderCryptoOverlay(ctx) {
  const meta = document.getElementById("cryptoOverlayMeta");
  const panel = document.getElementById("cryptoOverlayPanel");
  const tradePanel = document.getElementById("cryptoOverlayTrade");
  if (!(meta instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(tradePanel instanceof HTMLElement)) {
    return;
  }
  const { state, assets } = ctx;
  const c = state?.crypto;
  if (!c || !assets.length) {
    meta.textContent = "Нет данных рынка.";
    panel.innerHTML = "";
    tradePanel.innerHTML = "";
    return;
  }

  const summary = getCryptoPortfolioSummary(state, assets);
  const ticksLeft = c.ticksPerUpdate - (c.tick % c.ticksPerUpdate || 0);
  const pnlColor = summary.totalPnl >= 0 ? "#8fd694" : "#ff8f8f";

  meta.innerHTML = [
    `На счёте: <b>${money(state.cash)} ₽</b>`,
    `Портфель: <b>${money(summary.holdingsValue)} ₽</b>`,
    `P&amp;L: <span style="color:${pnlColor}"><b>${summary.totalPnl >= 0 ? "+" : ""}${money(summary.totalPnl)} ₽</b></span>`,
    `(реализ. ${money(summary.realizedPnl)} · открыт. ${money(summary.unrealizedPnl)})`,
    `· тик ${c.tick} · обновление через <b>${ticksLeft === c.ticksPerUpdate ? c.ticksPerUpdate : ticksLeft}</b> дн.`,
  ].join(" ");

  const selectedId = c.selectedId || assets[0].id;

  const rows = assets
    .map((a) => {
      const id = a.id;
      const price = Number(c.prices[id]) || a.basePriceRub;
      const hist = c.history[id] || [price];
      const chg = cryptoPriceChangePct(hist);
      const chgColor = chg >= 0 ? "#8fd694" : "#ff8f8f";
      const held = Number(c.holdings[id]) || 0;
      const val = held * price;
      const sel = id === selectedId ? " crypto-row-selected" : "";
      const floatPct = ((Number(c.exchangeFloat[id]) || 0) / a.exchangeFloat) * 100;
      return `<tr class="crypto-row${sel}" data-crypto-id="${id}">
        <td><b>${a.symbol}</b><div class="muted" style="font-size:11px">${a.name}</div></td>
        <td class="num">${fmtPrice(price)} ₽</td>
        <td class="num" style="color:${chgColor}">${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%</td>
        <td>${sparklineSvg(hist)}</td>
        <td class="num">${held > 0 ? fmtQty(held) : "—"}</td>
        <td class="num">${held > 0 ? money(val) + " ₽" : "—"}</td>
        <td class="num muted" style="font-size:11px">${floatPct.toFixed(0)}%</td>
      </tr>`;
    })
    .join("");

  panel.innerHTML = `<table class="stock crypto-table"><thead><tr>
    <th>Монета</th><th>Цена</th><th>Δ</th><th>График</th><th>У вас</th><th>Стоимость</th><th>Стакан</th>
  </tr></thead><tbody>${rows}</tbody></table>`;

  const sel = assets.find((a) => a.id === selectedId) || assets[0];
  const spot = Number(c.prices[sel.id]) || sel.basePriceRub;
  const held = Number(c.holdings[sel.id]) || 0;
  const floatLeft = Number(c.exchangeFloat[sel.id]) || 0;
  const maxBuyRub = Math.min(Number(state.cash) || 0, floatLeft * spot * 1.12);

  tradePanel.innerHTML = `
    <div class="crypto-trade-box">
      <div class="crypto-trade-title"><b>${sel.symbol}</b> · ${sel.name} · ${fmtPrice(spot)} ₽</div>
      <p class="muted" style="margin:4px 0 10px;font-size:12px">В стакане ~${fmtQty(floatLeft)} ${sel.symbol} · ликвидность ${money(sel.dailyLiquidityRub)} ₽/день</p>
      <div class="row" style="flex-wrap:wrap;gap:8px;align-items:flex-end">
        <label class="field" style="min-width:140px">Купить на, ₽
          <input id="cryptoBuyRubInput" type="number" min="100" step="100" value="${Math.min(10000, Math.max(100, maxBuyRub))}" style="width:100%"/>
        </label>
        <button type="button" class="btn-primary" id="cryptoBuyBtn">Купить</button>
        <label class="field" style="min-width:140px">Продать, ${sel.symbol}
          <input id="cryptoSellQtyInput" type="number" min="0" step="any" value="${held > 0 ? Math.min(held, held * 0.5).toFixed(6) : "0"}" style="width:100%"/>
        </label>
        <button type="button" class="btn-secondary" id="cryptoSellAllBtn"${held <= 0 ? " disabled" : ""}>Всё</button>
        <button type="button" class="btn-primary" id="cryptoSellBtn"${held <= 0 ? " disabled" : ""}>Продать</button>
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:11px">Котировки сдвигаются каждые ${c.ticksPerUpdate} игровых дня. Крупные сделки двигают цену (проскальзывание).</p>
    </div>`;
}

/**
 * @param {{ onOpen?: () => void; onTrade?: () => void; getContext?: () => { state: object; assets: object[] }; canOpen?: () => boolean }} [opts]
 */
export function initCryptoOverlay(opts = {}) {
  onOpen = opts.onOpen || null;
  onTrade = opts.onTrade || null;
  getContext = opts.getContext || null;
  canOpenCrypto = opts.canOpen || null;

  const root = document.getElementById("cryptoOverlay");
  const btn = document.getElementById("cryptoBtn");
  const closeBtn = document.getElementById("cryptoOverlayClose");
  const backdrop = root?.querySelector(".crypto-backdrop");
  const panel = document.getElementById("cryptoOverlayPanel");
  const tradePanel = document.getElementById("cryptoOverlayTrade");

  if (btn instanceof HTMLElement) {
    btn.addEventListener("click", () => {
      if (canOpenCrypto && !canOpenCrypto()) return;
      onOpen?.();
      openCryptoOverlay();
    });
  }
  if (closeBtn instanceof HTMLElement) closeBtn.addEventListener("click", closeCryptoOverlay);
  if (backdrop instanceof HTMLElement) backdrop.addEventListener("click", closeCryptoOverlay);

  if (panel instanceof HTMLElement) {
    panel.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const row = t.closest(".crypto-row");
      if (!(row instanceof HTMLElement)) return;
      const id = row.dataset.cryptoId;
      const ctx = getContext?.();
      if (!ctx?.state?.crypto || !id) return;
      ctx.state.crypto.selectedId = id;
      renderCryptoOverlay(ctx);
      onTrade?.();
    });
  }

  if (tradePanel instanceof HTMLElement) {
    tradePanel.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const ctx = getContext?.();
      if (!ctx) return;
      const id = ctx.state?.crypto?.selectedId;
      if (!id) return;

      if (t.id === "cryptoBuyBtn") {
        const inp = document.getElementById("cryptoBuyRubInput");
        const rub = inp instanceof HTMLInputElement ? inp.value : "0";
        const res = buyCrypto(ctx.state, ctx.assets, id, rub);
        if (!res.ok) {
          window.dispatchEvent(new CustomEvent("crypto-trade-error", { detail: res }));
          return;
        }
        window.dispatchEvent(new CustomEvent("crypto-trade-success", { detail: { ...res, side: "buy" } }));
        onTrade?.();
        renderCryptoOverlay(ctx);
        return;
      }
      if (t.id === "cryptoSellBtn" || t.id === "cryptoSellAllBtn") {
        const inp = document.getElementById("cryptoSellQtyInput");
        let qty = inp instanceof HTMLInputElement ? Number(inp.value) : 0;
        if (t.id === "cryptoSellAllBtn") qty = ctx.state.crypto.holdings[id] || 0;
        const res = sellCrypto(ctx.state, ctx.assets, id, qty);
        if (!res.ok) {
          window.dispatchEvent(new CustomEvent("crypto-trade-error", { detail: res }));
          return;
        }
        window.dispatchEvent(new CustomEvent("crypto-trade-success", { detail: { ...res, side: "sell" } }));
        onTrade?.();
        renderCryptoOverlay(ctx);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeCryptoOverlay();
  });
}

export function openCryptoOverlay() {
  const root = document.getElementById("cryptoOverlay");
  const modal = root?.querySelector(".crypto-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = true;
  root.hidden = false;
  document.body.classList.add("crypto-open");
  requestAnimationFrame(() => modal.classList.add("crypto-modal-visible"));
}

export function closeCryptoOverlay() {
  const root = document.getElementById("cryptoOverlay");
  const modal = root?.querySelector(".crypto-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  open = false;
  modal.classList.remove("crypto-modal-visible");
  document.body.classList.remove("crypto-open");
  window.setTimeout(() => {
    if (!open) root.hidden = true;
  }, 220);
}

export function isCryptoOverlayOpen() {
  return open;
}
