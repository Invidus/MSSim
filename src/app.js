import { simulateSalesDay } from "./core/daySim.js";
import { clamp } from "./core/demandModel.js";
import { saveToLocal, loadFromLocal } from "./persistence/saveLoad.js";

const defaultCategories = [
  {
    id: "beauty",
    name: "Beauty and Care",
    baseDemandMod: 1.15,
    baseMarginMod: 0.32,
    baseReturnRate: 0.07,
    volatility: 0.12,
  },
];

const defaultSkus = [
  { id: "beauty_lip_01", name: "Lip Set", purchaseCost: 380, recommendedPrice: 990, baseDemand: 210, baseReturnRate: 0.05, leadTimeDays: 4 },
  { id: "beauty_mask_02", name: "Face Mask", purchaseCost: 260, recommendedPrice: 690, baseDemand: 240, baseReturnRate: 0.04, leadTimeDays: 3 },
  { id: "beauty_serum_07", name: "Serum", purchaseCost: 720, recommendedPrice: 1690, baseDemand: 150, baseReturnRate: 0.07, leadTimeDays: 5 },
  { id: "beauty_brush_03", name: "Brush Pack", purchaseCost: 300, recommendedPrice: 840, baseDemand: 180, baseReturnRate: 0.05, leadTimeDays: 4 },
  { id: "beauty_cream_04", name: "Cream", purchaseCost: 460, recommendedPrice: 1190, baseDemand: 170, baseReturnRate: 0.06, leadTimeDays: 4 },
  { id: "beauty_shampoo_05", name: "Shampoo", purchaseCost: 340, recommendedPrice: 910, baseDemand: 220, baseReturnRate: 0.05, leadTimeDays: 3 },
  { id: "beauty_perfume_06", name: "Perfume", purchaseCost: 980, recommendedPrice: 2490, baseDemand: 120, baseReturnRate: 0.08, leadTimeDays: 6 },
  { id: "beauty_kit_08", name: "Care Kit", purchaseCost: 640, recommendedPrice: 1590, baseDemand: 145, baseReturnRate: 0.06, leadTimeDays: 5 },
  { id: "beauty_wipes_09", name: "Wipes", purchaseCost: 120, recommendedPrice: 390, baseDemand: 260, baseReturnRate: 0.04, leadTimeDays: 2 },
  { id: "beauty_tonic_10", name: "Tonic", purchaseCost: 280, recommendedPrice: 790, baseDemand: 205, baseReturnRate: 0.05, leadTimeDays: 3 },
];

const defaultConstants = {
  adEfficiency: 0.028,
  saturationCap: 8000,
  baseConversion: 0.012,
  feeRate: 0.18,
  paymentRate: 0.01,
  fixedOverheadDaily: 900,
  outboundCostPerUnit: 28,
  distanceMod: 1,
  returnHandlingCostPerUnit: 45,
};

let gameState;
/** @type {typeof defaultConstants} */
let economyConstants;

const els = {
  nextDayBtn: document.getElementById("nextDayBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  stateDump: document.getElementById("stateDump"),
  summary: document.getElementById("summary"),
  skuSelect: document.getElementById("skuSelect"),
  qtyInput: document.getElementById("qtyInput"),
  buyBtn: document.getElementById("buyBtn"),
  buyHint: document.getElementById("buyHint"),
  incomingList: document.getElementById("incomingList"),
  stockTable: document.getElementById("stockTable"),
  adBudgetRange: document.getElementById("adBudgetRange"),
  adBudgetLabel: document.getElementById("adBudgetLabel"),
  merchRoot: document.getElementById("merchRoot"),
  yesterdayReport: document.getElementById("yesterdayReport"),
  costBreakdown: document.getElementById("costBreakdown"),
};

function normalizeConstants(raw) {
  return {
    adEfficiency: Number(raw.adEfficiency) || defaultConstants.adEfficiency,
    saturationCap: Number(raw.saturationCap) || defaultConstants.saturationCap,
    baseConversion: Number(raw.baseConversion) || defaultConstants.baseConversion,
    feeRate: Number(raw.feeRate) || defaultConstants.feeRate,
    paymentRate: Number(raw.paymentRate) || defaultConstants.paymentRate,
    fixedOverheadDaily: Number(raw.fixedOverheadDaily) || defaultConstants.fixedOverheadDaily,
    outboundCostPerUnit: Number(raw.outboundCostPerUnit) || defaultConstants.outboundCostPerUnit,
    distanceMod: Number(raw.distanceMod) || defaultConstants.distanceMod,
    returnHandlingCostPerUnit:
      Number(raw.returnHandlingCostPerUnit) || defaultConstants.returnHandlingCostPerUnit,
  };
}

/** Нормализация полей из JSON (иначе leadTimeDays строкой даёт баг: 1 + "2" === "12"). */
function normalizeSku(raw) {
  return {
    ...raw,
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    tier: raw.tier != null ? String(raw.tier) : undefined,
    purchaseCost: Number(raw.purchaseCost) || 0,
    recommendedPrice: Number(raw.recommendedPrice) || 0,
    baseDemand: Number(raw.baseDemand) || 0,
    baseReturnRate: Number(raw.baseReturnRate) || 0,
    leadTimeDays: Math.max(0, Math.round(Number(raw.leadTimeDays) || 0)),
  };
}

function skuById(id) {
  return gameState.skus.find((s) => s.id === id);
}

function processIncomingShipments() {
  const day = gameState.day;
  const remaining = [];
  for (const shipment of gameState.incomingShipments) {
    const arrivalDay = Math.round(Number(shipment.arrivalDay));
    const qty = Math.max(0, Math.round(Number(shipment.qty) || 0));
    const skuId = String(shipment.skuId);

    if (!Number.isFinite(arrivalDay)) {
      remaining.push(shipment);
      continue;
    }
    if (arrivalDay <= day) {
      if (qty > 0) {
        gameState.inStock[skuId] = (gameState.inStock[skuId] || 0) + qty;
      }
    } else {
      remaining.push({ ...shipment, skuId, arrivalDay, qty });
    }
  }
  gameState.incomingShipments = remaining;
}

function purchase() {
  const skuId = els.skuSelect.value;
  const qty = Math.max(1, parseInt(els.qtyInput.value, 10) || 0);
  const sku = skuById(skuId);
  if (!sku) return;

  const totalCost = qty * sku.purchaseCost;
  if (gameState.cash < totalCost) {
    alert("Недостаточно средств");
    return;
  }

  const lead = sku.leadTimeDays;
  const arrivalDay = gameState.day + lead;

  gameState.cash -= totalCost;
  gameState.incomingShipments.push({
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    skuId: String(skuId),
    qty,
    orderDay: gameState.day,
    arrivalDay,
    totalCost,
  });

  render();
}

function updateBuyHint() {
  const skuId = els.skuSelect.value;
  const qty = Math.max(1, parseInt(els.qtyInput.value, 10) || 0);
  const sku = skuById(skuId);
  if (!sku) {
    els.buyHint.textContent = "";
    return;
  }
  const total = qty * sku.purchaseCost;
  const arrival = gameState.day + sku.leadTimeDays;
  els.buyHint.textContent = `Стоимость: ${total.toLocaleString("ru-RU")} · прибытие в день ${arrival} (срок ${sku.leadTimeDays} дн.) · закупка ${sku.purchaseCost}/шт.`;
}

function renderStockTable() {
  const rows = gameState.skus
    .map((sku) => {
      const q = gameState.inStock[sku.id] ?? 0;
      const p = gameState.skuPrices[sku.id] ?? sku.recommendedPrice;
      return `<tr><td>${sku.name}</td><td><code>${sku.id}</code></td><td class="num">${p}</td><td class="num">${q}</td></tr>`;
    })
    .join("");
  els.stockTable.innerHTML = `<table class="stock"><thead><tr><th>Название</th><th>ID</th><th>Цена</th><th>Остаток</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function fillSkuSelect() {
  els.skuSelect.innerHTML = "";
  for (const sku of gameState.skus) {
    const opt = document.createElement("option");
    opt.value = sku.id;
    opt.textContent = `${sku.name} (${sku.id})`;
    els.skuSelect.appendChild(opt);
  }
}

function renderIncoming() {
  if (!gameState.incomingShipments.length) {
    els.incomingList.innerHTML = '<span class="muted">Нет активных поставок</span>';
    return;
  }
  const items = gameState.incomingShipments
    .slice()
    .sort((a, b) => a.arrivalDay - b.arrivalDay)
    .map((s) => {
      const sku = skuById(s.skuId);
      const name = sku ? sku.name : s.skuId;
      return `<li>${name}: <b>${s.qty}</b> шт. · прибытие день <b>${s.arrivalDay}</b> · заказ в день ${s.orderDay}</li>`;
    })
    .join("");
  els.incomingList.innerHTML = `<ul class="incoming">${items}</ul>`;
}

function resetMerchDom() {
  els.merchRoot.innerHTML = "";
  delete els.merchRoot.dataset.built;
}

function buildMerchTableOnce() {
  if (els.merchRoot.dataset.built === "1") return;

  const rows = gameState.skus
    .map((sku) => {
      const p = gameState.skuPrices[sku.id] ?? sku.recommendedPrice;
      const q = gameState.qualityScore[sku.id] ?? 72;
      const promo = gameState.promoOn[sku.id] ? "checked" : "";
      return `<tr>
        <td>${sku.name}<br/><code style="font-size:11px">${sku.id}</code></td>
        <td class="num"><input class="js-price" data-sku-id="${sku.id}" type="number" min="1" step="10" value="${p}" style="width:96px"/></td>
        <td class="num"><input class="js-quality" data-sku-id="${sku.id}" type="number" min="0" max="100" step="1" value="${q}" style="width:64px"/></td>
        <td class="num"><input class="js-promo" data-sku-id="${sku.id}" type="checkbox" ${promo}/></td>
      </tr>`;
    })
    .join("");

  els.merchRoot.innerHTML = `<table class="stock"><thead><tr><th>SKU</th><th>Цена</th><th>Качество 0–100</th><th>Промо</th></tr></thead><tbody>${rows}</tbody></table>`;
  els.merchRoot.dataset.built = "1";
}

function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("ru-RU");
}

function renderCostBreakdown() {
  if (!els.costBreakdown) return;
  const r = gameState.lastDayReport;
  if (!r?.totals) {
    els.costBreakdown.textContent = "Нет данных — сначала нажми Next Day.";
    return;
  }
  const t = r.totals;
  const rows = [
    ["Чистая выручка (после возвратов)", t.netRevenue, "+"],
    ["Себестоимость проданного (COGS)", t.cogs, "−"],
    ["Комиссия маркетплейса", t.fee, "−"],
    ["Эквайринг / платежи", t.payment, "−"],
    ["Исходящая логистика (отгрузки)", t.logistics ?? 0, "−"],
    ["Обработка возвратов", t.returnsCost ?? 0, "−"],
    ["Реклама (день)", t.adCost, "−"],
    ["Постоянные расходы (оверхед)", t.overhead, "−"],
  ];
  const body = rows
    .map(
      ([label, val, sign]) =>
        `<tr><td>${label}</td><td class="num" style="color:${sign === "+" ? "#8fd694" : "#e7e7ea"}">${sign === "+" ? "+" : "−"} ${money(Math.abs(val))}</td></tr>`
    )
    .join("");
  els.costBreakdown.innerHTML = `<p class="muted" style="margin:0 0 8px">День симуляции: <b>${r.day}</b></p><table class="stock"><tbody>${body}<tr><td><strong>Операционная прибыль</strong></td><td class="num"><strong>${money(t.operatingProfit)}</strong></td></tr></tbody></table>`;
}

function renderYesterday() {
  const r = gameState.lastDayReport;
  if (!r) {
    els.yesterdayReport.textContent = "Ещё не было симуляции (нажми Next Day).";
    return;
  }
  const t = r.totals;
  const unmet = t.unmetUnits ?? 0;
  const ow = t.ordersWanted ?? 0;
  const logi = t.logistics ?? 0;
  const retCost = t.returnsCost ?? 0;
  const head = `День ${r.day}: чистая выручка ${money(t.netRevenue)} · операц. прибыль ${money(t.operatingProfit)} · логистика ${money(logi)} · возвраты (расход) ${money(retCost)} · рекл. трафик ${t.adTrafficTotal.toFixed(1)} · рекл. ${money(t.adCost)} · оверхед ${money(t.overhead)} · <b>stockout</b>: ${unmet}${ow > 0 ? ` из ${ow} желаемых заказов` : ""}`;
  const lines = r.perSku
    .filter((x) => x.orders > 0 || x.traffic > 50 || (x.unmetUnits ?? 0) > 0)
    .slice(0, 8)
    .map(
      (x) =>
        `${x.name}: хотели ${x.ordersWanted ?? "?"} → отгрузили ${x.orders}${(x.unmetUnits ?? 0) > 0 ? ` (не хватило ${x.unmetUnits})` : ""}, возвратов ${x.returned}, чистых продаж ${x.netSold}, raw ${(x.ordersRaw ?? 0).toFixed(1)}`
    )
    .join(" · ");
  els.yesterdayReport.innerHTML = `${head}<br/><span class="muted" style="font-size:12px">${lines || "Мало активности — проверь остатки и цену."}</span>`;
}

function syncAdUiFromState() {
  els.adBudgetRange.value = String(gameState.adBudget);
  els.adBudgetLabel.textContent = `${gameState.adBudget.toLocaleString("ru-RU")} / день`;
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to load ${path}, using fallback`, err);
    return fallback;
  }
}

async function initGame() {
  const [categories, rawSkus, rawConst] = await Promise.all([
    loadJson("./src/data/categories.json", defaultCategories),
    loadJson("./src/data/skus_beauty_m1.json", defaultSkus),
    loadJson("./src/data/constants.json", defaultConstants),
  ]);

  economyConstants = normalizeConstants(rawConst);
  const skus = rawSkus.map(normalizeSku);

  gameState = {
    day: 1,
    cash: 120000,
    adBudget: 0,
    categories,
    skus,
    inStock: Object.fromEntries(skus.map((sku) => [sku.id, 0])),
    incomingShipments: [],
    skuPrices: Object.fromEntries(skus.map((s) => [s.id, s.recommendedPrice])),
    qualityScore: Object.fromEntries(skus.map((s) => [s.id, 72])),
    promoOn: Object.fromEntries(skus.map((s) => [s.id, false])),
    lastDayReport: null,
    kpi: defaultKpi(),
  };

  resetMerchDom();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = gameState.skus[0].id;
  syncAdUiFromState();
  buildMerchTableOnce();
  render();
}

function defaultKpi() {
  return {
    revenue: 0,
    profit: 0,
    marginPct: 0,
    acos: 0,
    returnPct: 0,
    daysOfStock: 0,
    unmetUnits: 0,
    stockoutRate: 0,
  };
}

/**
 * @param {object} raw
 * @returns {boolean}
 */
function applyLoadedState(raw) {
  if (!raw || !Array.isArray(raw.skus)) return false;

  const skus = raw.skus.map(normalizeSku);
  const inStock = { ...(raw.inStock || {}) };
  for (const s of skus) {
    if (inStock[s.id] == null) inStock[s.id] = 0;
  }

  gameState = {
    day: Math.max(1, Math.round(Number(raw.day) || 1)),
    cash: Number(raw.cash) || 0,
    adBudget: Math.max(0, Number(raw.adBudget) || 0),
    categories:
      Array.isArray(raw.categories) && raw.categories.length
        ? raw.categories
        : gameState?.categories ?? defaultCategories,
    skus,
    inStock,
    incomingShipments: Array.isArray(raw.incomingShipments) ? raw.incomingShipments : [],
    skuPrices: { ...(raw.skuPrices || {}) },
    qualityScore: { ...(raw.qualityScore || {}) },
    promoOn: { ...(raw.promoOn || {}) },
    lastDayReport: raw.lastDayReport ?? null,
    kpi: { ...defaultKpi(), ...(raw.kpi || {}) },
  };

  for (const s of skus) {
    if (gameState.skuPrices[s.id] == null) gameState.skuPrices[s.id] = s.recommendedPrice;
    if (gameState.qualityScore[s.id] == null) gameState.qualityScore[s.id] = 72;
    if (gameState.promoOn[s.id] == null) gameState.promoOn[s.id] = false;
  }

  return true;
}

function saveGame() {
  const res = saveToLocal(gameState);
  if (res.ok) alert("Сохранено в браузере (localStorage).");
  else alert("Не удалось сохранить: " + (res.error || ""));
}

function loadGame() {
  const raw = loadFromLocal();
  if (!raw) {
    alert("Нет сохранения.");
    return;
  }
  if (!applyLoadedState(raw)) {
    alert("Файл сохранения повреждён.");
    return;
  }
  resetMerchDom();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = gameState.skus[0].id;
  syncAdUiFromState();
  buildMerchTableOnce();
  render();
}

function nextDay() {
  gameState.day += 1;
  processIncomingShipments();
  simulateSalesDay(gameState, economyConstants);
  render();
  console.log("Day advanced", gameState);
}

function resetGame() {
  initGame();
}

function totalStock() {
  return Object.values(gameState.inStock).reduce((a, b) => a + b, 0);
}

function render() {
  const salesLine = gameState.lastDayReport
    ? `Итог последнего Next Day: выручка <b>${Math.round(gameState.kpi.revenue).toLocaleString("ru-RU")}</b> · прибыль <b>${Math.round(gameState.kpi.profit).toLocaleString("ru-RU")}</b> · маржа <b>${gameState.kpi.marginPct.toFixed(1)}%</b> · ACOS <b>${(gameState.kpi.acos * 100).toFixed(1)}%</b> · возвраты <b>${(gameState.kpi.returnPct * 100).toFixed(1)}%</b> · stockout <b>${gameState.kpi.unmetUnits}</b> шт. (${(gameState.kpi.stockoutRate * 100).toFixed(1)}% от «желаемых» заказов) · запас ~<b>${gameState.kpi.daysOfStock.toFixed(1)}</b> дн. (оценка по чистым продажам)`
    : `Итог дня: <span style="color:#a9acb7">симуляция ещё не запускалась — нажми Next Day</span>`;

  els.summary.innerHTML = [
    `День: <b>${gameState.day}</b>`,
    `Кэш: <b>${gameState.cash.toLocaleString("ru-RU")}</b>`,
    `Реклама: <b>${gameState.adBudget.toLocaleString("ru-RU")}</b>/день`,
    `Остаток (всего): <b>${totalStock()}</b>`,
    `Поставок в пути: <b>${gameState.incomingShipments.length}</b>`,
    salesLine,
  ].join("<br/>");

  syncAdUiFromState();
  buildMerchTableOnce();
  renderIncoming();
  renderStockTable();
  renderYesterday();
  renderCostBreakdown();
  updateBuyHint();
  els.stateDump.textContent = JSON.stringify(gameState, null, 2);
}

els.merchRoot.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  const id = el.dataset.skuId;
  if (!id || !gameState) return;
  if (el.classList.contains("js-price")) {
    gameState.skuPrices[id] = Math.max(1, Number(el.value) || 0);
  }
  if (el.classList.contains("js-quality")) {
    gameState.qualityScore[id] = clamp(Math.round(Number(el.value) || 0), 0, 100);
  }
});

els.merchRoot.addEventListener("change", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") return;
  const id = el.dataset.skuId;
  if (!id || !gameState) return;
  if (el.classList.contains("js-promo")) {
    gameState.promoOn[id] = el.checked;
  }
});

els.adBudgetRange.addEventListener("input", () => {
  if (!gameState) return;
  gameState.adBudget = Math.max(0, Number(els.adBudgetRange.value) || 0);
  els.adBudgetLabel.textContent = `${gameState.adBudget.toLocaleString("ru-RU")} / день`;
});

els.nextDayBtn.addEventListener("click", nextDay);
els.resetBtn.addEventListener("click", resetGame);
els.saveBtn?.addEventListener("click", saveGame);
els.loadBtn?.addEventListener("click", loadGame);
els.buyBtn.addEventListener("click", purchase);
els.skuSelect.addEventListener("change", updateBuyHint);
els.qtyInput.addEventListener("input", updateBuyHint);

initGame();
