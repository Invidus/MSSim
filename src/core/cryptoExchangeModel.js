/** @typedef {{ id: string; symbol: string; name: string; basePriceRub: number; minPriceRub: number; maxPriceRub: number; maxSupply: number; exchangeFloat: number; dailyLiquidityRub: number; volatility: number; drift?: number; meanReversion?: number }} CryptoAssetDef */

export const CRYPTO_TICKS_PER_UPDATE = 2;
export const CRYPTO_HISTORY_LEN = 24;

/**
 * @param {number} cur
 * @param {CryptoAssetDef} a
 */
function stepCryptoPrice(cur, a) {
  const vol = a.volatility;
  const drift = a.drift || 0;
  const r = Math.random();

  let jump = 0;
  if (r < 0.07) {
    jump = (Math.random() < 0.5 ? -1 : 1) * (0.035 + Math.random() * 0.14);
  } else if (r < 0.1) {
    jump = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.32);
  }

  const z = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  const noise = z * vol * (0.55 + Math.random() * 1.65);

  let next = cur * (1 + drift + noise + jump);

  const ratio = cur / a.basePriceRub - 1;
  next *= 1 - (a.meanReversion || 0) * ratio * 0.28;

  return Math.max(a.minPriceRub, Math.min(a.maxPriceRub, next));
}

/**
 * @param {number[]} hist
 */
function isFlatCryptoHistory(hist) {
  if (!Array.isArray(hist) || hist.length < 4) return true;
  const vals = hist.filter((x) => Number.isFinite(x) && x > 0);
  if (vals.length < 4) return true;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return (max - min) / min < 0.008;
}

/**
 * @param {CryptoAssetDef} a
 * @param {number} [points]
 */
function simulateCryptoHistory(a, points = CRYPTO_HISTORY_LEN) {
  let price = a.basePriceRub * (0.68 + Math.random() * 0.64);
  price = Math.max(a.minPriceRub, Math.min(a.maxPriceRub, price));
  const hist = [price];
  for (let i = 1; i < points; i++) {
    price = stepCryptoPrice(price, a);
    hist.push(price);
  }
  return hist;
}

/**
 * @param {CryptoAssetDef} a
 */
function seedAssetMarket(a) {
  const hist = simulateCryptoHistory(a);
  return { price: hist[hist.length - 1], history: hist };
}

/**
 * @param {unknown} raw
 * @returns {CryptoAssetDef[]}
 */
export function normalizeCryptoAssets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && a.id)
    .map((a) => ({
      id: String(a.id),
      symbol: String(a.symbol || a.id).toUpperCase(),
      name: String(a.name || a.symbol || a.id),
      basePriceRub: Math.max(0.01, Number(a.basePriceRub) || 1),
      minPriceRub: Math.max(0.01, Number(a.minPriceRub) || 0.01),
      maxPriceRub: Math.max(1, Number(a.maxPriceRub) || Number(a.basePriceRub) * 3 || 1),
      maxSupply: Math.max(1, Number(a.maxSupply) || 1e9),
      exchangeFloat: Math.max(0, Number(a.exchangeFloat) || 0),
      dailyLiquidityRub: Math.max(1000, Number(a.dailyLiquidityRub) || 100000),
      volatility: Math.max(0.01, Math.min(0.25, Number(a.volatility) || 0.05)),
      drift: Number(a.drift) || 0,
      meanReversion: Math.max(0, Math.min(0.2, Number(a.meanReversion) || 0.04)),
    }));
}

/**
 * @param {CryptoAssetDef[]} assets
 */
export function createEmptyCryptoState(assets) {
  /** @type {Record<string, number>} */
  const prices = {};
  /** @type {Record<string, number>} */
  const exchangeFloat = {};
  /** @type {Record<string, number>} */
  const holdings = {};
  /** @type {Record<string, number>} */
  const avgCost = {};
  /** @type {Record<string, number[]>} */
  const history = {};

  for (const a of assets) {
    const seeded = seedAssetMarket(a);
    prices[a.id] = seeded.price;
    exchangeFloat[a.id] = a.exchangeFloat;
    holdings[a.id] = 0;
    avgCost[a.id] = 0;
    history[a.id] = seeded.history;
  }

  return {
    prices,
    exchangeFloat,
    holdings,
    avgCost,
    history,
    tick: 0,
    ticksPerUpdate: CRYPTO_TICKS_PER_UPDATE,
    realizedPnl: 0,
    totalBoughtRub: 0,
    totalSoldRub: 0,
    selectedId: assets[0]?.id || "btc",
  };
}

/**
 * @param {object} raw
 * @param {CryptoAssetDef[]} assets
 */
export function normalizeCryptoState(raw, assets) {
  const base = createEmptyCryptoState(assets);
  if (!raw || typeof raw !== "object") return base;

  for (const a of assets) {
    const id = a.id;
    if (raw.prices?.[id] != null) base.prices[id] = Math.max(a.minPriceRub, Number(raw.prices[id]) || a.basePriceRub);
    if (raw.exchangeFloat?.[id] != null) {
      base.exchangeFloat[id] = Math.max(0, Math.min(a.exchangeFloat, Number(raw.exchangeFloat[id]) || 0));
    }
    if (raw.holdings?.[id] != null) base.holdings[id] = Math.max(0, Number(raw.holdings[id]) || 0);
    if (raw.avgCost?.[id] != null) base.avgCost[id] = Math.max(0, Number(raw.avgCost[id]) || 0);
    if (Array.isArray(raw.history?.[id]) && raw.history[id].length) {
      base.history[id] = raw.history[id].slice(-CRYPTO_HISTORY_LEN).map((x) => Number(x) || a.basePriceRub);
    }
    if (isFlatCryptoHistory(base.history[id])) {
      const seeded = seedAssetMarket(a);
      base.history[id] = seeded.history;
      base.prices[id] = seeded.price;
    }
  }

  base.tick = Math.max(0, Math.round(Number(raw.tick) || 0));
  base.ticksPerUpdate = Math.max(1, Math.round(Number(raw.ticksPerUpdate) || CRYPTO_TICKS_PER_UPDATE));
  base.realizedPnl = Number(raw.realizedPnl) || 0;
  base.totalBoughtRub = Math.max(0, Number(raw.totalBoughtRub) || 0);
  base.totalSoldRub = Math.max(0, Number(raw.totalSoldRub) || 0);
  base.selectedId = assets.some((a) => a.id === raw.selectedId) ? String(raw.selectedId) : base.selectedId;
  return base;
}

/**
 * @param {number} rubAmount
 * @param {number} dailyLiquidityRub
 */
export function calcBuySlippage(rubAmount, dailyLiquidityRub) {
  const liq = Math.max(1000, Number(dailyLiquidityRub) || 1000);
  const x = Math.max(0, Number(rubAmount) || 0) / liq;
  return Math.min(0.12, Math.pow(x, 0.55) * 0.09);
}

/**
 * @param {number} rubAmount
 * @param {number} dailyLiquidityRub
 */
export function calcSellSlippage(rubAmount, dailyLiquidityRub) {
  return calcBuySlippage(rubAmount, dailyLiquidityRub);
}

/**
 * @param {object} state
 * @param {CryptoAssetDef[]} assets
 */
export function advanceCryptoMarket(state, assets) {
  if (!state?.crypto || !assets.length) return { updated: false };
  const c = state.crypto;
  c.tick = (Number(c.tick) || 0) + 1;
  const every = Math.max(1, Math.round(Number(c.ticksPerUpdate) || CRYPTO_TICKS_PER_UPDATE));
  if (c.tick % every !== 0) return { updated: false };

  for (const a of assets) {
    const cur = Math.max(a.minPriceRub, Number(c.prices[a.id]) || a.basePriceRub);
    const next = stepCryptoPrice(cur, a);
    c.prices[a.id] = next;
    if (!Array.isArray(c.history[a.id])) c.history[a.id] = [next];
    c.history[a.id].push(next);
    if (c.history[a.id].length > CRYPTO_HISTORY_LEN) c.history[a.id] = c.history[a.id].slice(-CRYPTO_HISTORY_LEN);
  }
  return { updated: true };
}

/**
 * @param {object} state
 * @param {CryptoAssetDef[]} assets
 */
export function getCryptoPortfolioSummary(state, assets) {
  const c = state?.crypto;
  if (!c) return { holdingsValue: 0, unrealizedPnl: 0, realizedPnl: 0, totalPnl: 0, costBasis: 0 };

  let holdingsValue = 0;
  let costBasis = 0;
  for (const a of assets) {
    const qty = Math.max(0, Number(c.holdings[a.id]) || 0);
    const price = Math.max(0, Number(c.prices[a.id]) || 0);
    const avg = Math.max(0, Number(c.avgCost[a.id]) || 0);
    holdingsValue += qty * price;
    costBasis += qty * avg;
  }
  const unrealizedPnl = holdingsValue - costBasis;
  const realizedPnl = Number(c.realizedPnl) || 0;
  return {
    holdingsValue,
    costBasis,
    unrealizedPnl,
    realizedPnl,
    totalPnl: realizedPnl + unrealizedPnl,
  };
}

/**
 * @param {object} state
 * @param {CryptoAssetDef[]} assets
 * @param {string} assetId
 * @param {number} rubAmount
 */
export function buyCrypto(state, assets, assetId, rubAmount) {
  const a = assets.find((x) => x.id === assetId);
  if (!a || !state?.crypto) return { ok: false, error: "unknown_asset" };

  let rub = Math.floor(Number(rubAmount) || 0);
  if (rub < 100) return { ok: false, error: "min_amount" };
  if (Number(state.cash) < rub) return { ok: false, error: "insufficient_cash" };

  const c = state.crypto;
  const spot = Math.max(a.minPriceRub, Number(c.prices[a.id]) || a.basePriceRub);
  const slip = calcBuySlippage(rub, a.dailyLiquidityRub);
  const effPrice = spot * (1 + slip);

  let qty = rub / effPrice;
  const floatLeft = Math.max(0, Number(c.exchangeFloat[a.id]) || 0);
  if (qty > floatLeft) {
    qty = floatLeft;
    rub = Math.ceil(qty * effPrice);
  }
  if (qty < 1e-12 || rub < 100) return { ok: false, error: "no_supply" };

  const oldQty = Math.max(0, Number(c.holdings[a.id]) || 0);
  const oldAvg = Math.max(0, Number(c.avgCost[a.id]) || 0);
  const newQty = oldQty + qty;
  c.holdings[a.id] = newQty;
  c.avgCost[a.id] = oldQty > 0 ? (oldQty * oldAvg + rub) / newQty : effPrice;
  c.exchangeFloat[a.id] = floatLeft - qty;
  state.cash = Number(state.cash) - rub;
  c.totalBoughtRub = (Number(c.totalBoughtRub) || 0) + rub;

  return { ok: true, qty, rub, price: effPrice, symbol: a.symbol };
}

/**
 * @param {object} state
 * @param {CryptoAssetDef[]} assets
 * @param {string} assetId
 * @param {number} qty
 */
export function sellCrypto(state, assets, assetId, qty) {
  const a = assets.find((x) => x.id === assetId);
  if (!a || !state?.crypto) return { ok: false, error: "unknown_asset" };

  let sellQty = Number(qty) || 0;
  if (sellQty <= 0) return { ok: false, error: "invalid_qty" };

  const c = state.crypto;
  const held = Math.max(0, Number(c.holdings[a.id]) || 0);
  if (sellQty > held) sellQty = held;
  if (sellQty < 1e-12) return { ok: false, error: "no_holdings" };

  const spot = Math.max(a.minPriceRub, Number(c.prices[a.id]) || a.basePriceRub);
  const grossRub = sellQty * spot;
  const slip = calcSellSlippage(grossRub, a.dailyLiquidityRub);
  const effPrice = spot * (1 - slip);
  const rub = Math.floor(sellQty * effPrice);
  if (rub < 1) return { ok: false, error: "too_small" };

  const avg = Math.max(0, Number(c.avgCost[a.id]) || 0);
  const pnl = sellQty * (effPrice - avg);
  c.realizedPnl = (Number(c.realizedPnl) || 0) + pnl;
  c.holdings[a.id] = held - sellQty;
  if (c.holdings[a.id] < 1e-12) {
    c.holdings[a.id] = 0;
    c.avgCost[a.id] = 0;
  }
  const maxFloat = a.exchangeFloat;
  c.exchangeFloat[a.id] = Math.min(maxFloat, (Number(c.exchangeFloat[a.id]) || 0) + sellQty);
  state.cash = Number(state.cash) + rub;
  c.totalSoldRub = (Number(c.totalSoldRub) || 0) + rub;

  return { ok: true, qty: sellQty, rub, price: effPrice, pnl, symbol: a.symbol };
}

/**
 * @param {number[]} history
 */
export function cryptoPriceChangePct(history) {
  if (!Array.isArray(history) || history.length < 2) return 0;
  const prev = history[history.length - 2];
  const cur = history[history.length - 1];
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

/**
 * @param {object} state
 * @param {{ id: string }} asset
 */
export function isExchangeStackEmpty(state, asset) {
  const left = Number(state?.crypto?.exchangeFloat?.[asset.id]);
  if (!Number.isFinite(left)) return false;
  return left < 1e-9;
}

/**
 * @param {object} state
 * @param {{ id: string }} asset
 */
export function boughtFullExchangeStack(state, asset) {
  if (!isExchangeStackEmpty(state, asset)) return false;
  return (Number(state?.crypto?.holdings?.[asset.id]) || 0) > 0;
}

/**
 * @param {object} state
 * @param {import("./cryptoExchangeModel.js").CryptoAssetDef[]} assets
 */
export function boughtAnyFullExchangeStack(state, assets) {
  if (!Array.isArray(assets) || !assets.length) return false;
  return assets.some((a) => boughtFullExchangeStack(state, a));
}

/**
 * @param {object} state
 * @param {import("./cryptoExchangeModel.js").CryptoAssetDef[]} assets
 */
export function boughtAllExchangeStacks(state, assets) {
  if (!Array.isArray(assets) || !assets.length) return false;
  return assets.every((a) => boughtFullExchangeStack(state, a));
}
