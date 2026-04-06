import { computeAdTrafficTotal, computeConversionRate } from "./demandModel.js";
import { computeCappedOrders } from "./salesModel.js";

/**
 * @param {object} state
 * @param {{
 *   adEfficiency: number;
 *   saturationCap: number;
 *   baseConversion: number;
 *   feeRate: number;
 *   paymentRate: number;
 *   fixedOverheadDaily: number;
 *   outboundCostPerUnit: number;
 *   distanceMod: number;
 *   returnHandlingCostPerUnit: number;
 * }} cfg
 */
export function simulateSalesDay(state, cfg) {
  const category = state.categories[0];
  const catMod = category ? Number(category.baseDemandMod) || 1 : 1;

  const sumDemand = state.skus.reduce((acc, sku) => acc + sku.baseDemand, 0);
  const adTotal = computeAdTrafficTotal(state.adBudget, cfg);

  const outbound =
    (Number(cfg.outboundCostPerUnit) || 0) * (Number(cfg.distanceMod) || 1);
  const returnUnitCost = Math.max(0, Number(cfg.returnHandlingCostPerUnit) || 0);

  /** @type {Array<Record<string, unknown>>} */
  const perSku = [];

  let totalNetRevenue = 0;
  let totalCogs = 0;
  let totalFee = 0;
  let totalPayment = 0;
  let totalOrders = 0;
  let totalReturned = 0;
  let totalUnmetUnits = 0;
  let totalOrdersWanted = 0;
  let totalLogistics = 0;
  let totalReturnsCost = 0;

  for (const sku of state.skus) {
    const skuId = sku.id;
    const stockStart = state.inStock[skuId] ?? 0;
    const price = state.skuPrices[skuId] ?? sku.recommendedPrice;
    const marketPrice = sku.recommendedPrice;
    const qualityScore = state.qualityScore[skuId] ?? 65;
    const promoMod = state.promoOn[skuId] ? 1.12 : 1;

    const organic = sku.baseDemand * catMod;
    const weight = sumDemand > 0 ? sku.baseDemand / sumDemand : 0;
    const adShare = adTotal * weight;
    const traffic = organic + adShare;

    const conversion = computeConversionRate({
      price,
      marketPrice,
      qualityScore,
      leadTimeDays: sku.leadTimeDays,
      promoMod,
      baseConversion: cfg.baseConversion,
    });

    const { ordersRaw, ordersWanted, orders, unmetUnits } = computeCappedOrders({
      traffic,
      conversion,
      inStock: stockStart,
    });

    const returnRate = Math.min(0.95, Math.max(0, sku.baseReturnRate));
    const returned = Math.round(orders * returnRate);
    const netSold = Math.max(orders - returned, 0);

    const netRevenue = netSold * price;
    const cogs = netSold * sku.purchaseCost;
    const fee = netRevenue * cfg.feeRate;
    const payment = netRevenue * cfg.paymentRate;
    const logistics = orders * outbound;
    const returnsCost = returned * returnUnitCost;

    state.inStock[skuId] = stockStart - orders + returned;

    totalNetRevenue += netRevenue;
    totalCogs += cogs;
    totalFee += fee;
    totalPayment += payment;
    totalOrders += orders;
    totalReturned += returned;
    totalUnmetUnits += unmetUnits;
    totalOrdersWanted += ordersWanted;
    totalLogistics += logistics;
    totalReturnsCost += returnsCost;

    perSku.push({
      skuId,
      name: sku.name,
      stockStart,
      organic,
      adShare,
      traffic,
      conversion,
      ordersRaw,
      ordersWanted,
      orders,
      unmetUnits,
      returned,
      netSold,
      netRevenue,
      cogs,
      fee,
      payment,
      logistics,
      returnsCost,
    });
  }

  const adCost = state.adBudget;
  const overhead = cfg.fixedOverheadDaily;
  const operatingProfit =
    totalNetRevenue -
    totalCogs -
    totalFee -
    totalPayment -
    adCost -
    overhead -
    totalLogistics -
    totalReturnsCost;

  state.cash += operatingProfit;

  const marginPct = totalNetRevenue > 0 ? (operatingProfit / totalNetRevenue) * 100 : 0;
  const acos = totalNetRevenue > 0 ? adCost / totalNetRevenue : 0;
  const returnPct = totalOrders > 0 ? totalReturned / totalOrders : 0;
  const stockoutRate = totalOrdersWanted > 0 ? totalUnmetUnits / totalOrdersWanted : 0;

  let daysOfStock = 0;
  let dsCount = 0;
  for (const sku of state.skus) {
    const stock = state.inStock[sku.id] ?? 0;
    const row = perSku.find((r) => r.skuId === sku.id);
    const sold = row && typeof row.netSold === "number" ? row.netSold : 0;
    if (sold > 0) {
      daysOfStock += stock / sold;
      dsCount += 1;
    }
  }
  const avgDaysOfStock = dsCount > 0 ? daysOfStock / dsCount : 0;

  state.kpi = {
    revenue: totalNetRevenue,
    profit: operatingProfit,
    marginPct,
    acos,
    returnPct,
    daysOfStock: avgDaysOfStock,
    unmetUnits: totalUnmetUnits,
    stockoutRate,
  };

  state.lastDayReport = {
    day: state.day,
    totals: {
      netRevenue: totalNetRevenue,
      cogs: totalCogs,
      fee: totalFee,
      payment: totalPayment,
      adCost,
      overhead,
      logistics: totalLogistics,
      returnsCost: totalReturnsCost,
      operatingProfit,
      adTrafficTotal: adTotal,
      unmetUnits: totalUnmetUnits,
      ordersWanted: totalOrdersWanted,
    },
    perSku,
  };

  return state.lastDayReport;
}
