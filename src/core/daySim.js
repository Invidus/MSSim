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
  const categoryModById = new Map(
    (state.categories || []).map((c) => [String(c.id), Number(c.baseDemandMod) || 1])
  );

  const sumDemand = state.skus.reduce((acc, sku) => acc + sku.baseDemand, 0);
  const adBudget = Math.max(
    0,
    Number(state.adBudgetEffective != null ? state.adBudgetEffective : state.adBudget) || 0
  );
  const adTotal = computeAdTrafficTotal(adBudget, cfg);
  const prevStockoutRate = Math.max(0, Number(state?.kpi?.stockoutRate) || 0);
  const demandDamp =
    prevStockoutRate > 0.35 ? Math.max(0.55, 1 - (prevStockoutRate - 0.35) * 0.9) : 1;
  const conversionDamp =
    prevStockoutRate > 0.35 ? Math.max(0.72, 1 - (prevStockoutRate - 0.35) * 0.45) : 1;

  const progMods = state.progressionModifiers && typeof state.progressionModifiers === "object" ? state.progressionModifiers : {};
  const eventMods = state.eventModifiers && typeof state.eventModifiers === "object" ? state.eventModifiers : {};
  const organicGlobalMult = (Number(eventMods.organicGlobalMult) || 1) * (Number(progMods.organicGlobalMult) || 1);
  const returnEventMult =
    (Number(eventMods.returnRateModMult) || 1) * (Number(progMods.returnRateModMult) || 1);
  const serviceRatingDelta =
    (Number(eventMods.serviceRatingDelta) || 0) + (Number(progMods.serviceRatingDelta) || 0);
  const stockoutServiceMult =
    (Number(progMods.stockoutServiceMult) || 1) * (Number(eventMods.stockoutServiceMult) || 1);
  const purchaseCostProgMult = Number(progMods.purchaseCostMult) || 1;
  const globalProfitMult = Number(progMods.globalProfitMult) || 1;
  const teamDailyCost = Math.max(0, Number(cfg.teamDailyCost) || 0);

  const outbound =
    (Number(cfg.outboundCostPerUnit) || 0) * (Number(cfg.distanceMod) || 1);
  const returnUnitCost = Math.max(0, Number(cfg.returnHandlingCostPerUnit) || 0);
  const feeRateEffective = Math.max(
    0,
    (Number(cfg.feeRate) || 0) + (Number(eventMods.feeRateDelta) || 0)
  );

  /** @type {Array<Record<string, unknown>>} */
  const perSku = [];

  let totalNetRevenue = 0;
  let totalGrossRevenue = 0;
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
    const catId = String(sku.categoryId || "beauty");
    const marketPriceMult =
      Number(eventMods.marketPriceMultBySku?.[skuId]) ||
      Number(eventMods.marketPriceMultByCategory?.[catId]) ||
      1;
    const marketPrice = sku.recommendedPrice * marketPriceMult;
    const qualityScore = state.qualityScore[skuId] ?? 65;
    const promoMod = state.promoOn[skuId] ? 1.12 : 1;

    const catMod = categoryModById.get(catId) || 1;
    const catEventOrganic = Number(eventMods.categoryOrganicMult?.[catId]) || 1;
    const skuEventOrganic = Number(eventMods.skuOrganicMult?.[skuId]) || 1;
    const organic = sku.baseDemand * catMod * demandDamp * organicGlobalMult * catEventOrganic * skuEventOrganic;
    const weight = sumDemand > 0 ? sku.baseDemand / sumDemand : 0;
    const adShare = adTotal * weight * demandDamp;
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
      conversion: conversion * conversionDamp,
      inStock: stockStart,
    });

    const returnRateMod = Math.max(0, Number(state.returnRateMod) || 1) * returnEventMult;
    const skuReturnMult = Number(eventMods.skuReturnRateMult?.[skuId]) || 1;
    const returnRate = Math.min(0.95, Math.max(0, sku.baseReturnRate * returnRateMod * skuReturnMult));
    const returned = Math.round(orders * returnRate);
    const netSold = Math.max(orders - returned, 0);

    const grossRevenue = orders * price;
    const netRevenue = netSold * price;
    const purchaseCostMult =
      (Number(eventMods.purchaseCostMultByCategory?.[catId]) || 1) * purchaseCostProgMult;
    const effectivePurchaseCost = sku.purchaseCost * purchaseCostMult;
    const cogs = netSold * effectivePurchaseCost;
    const fee = netRevenue * feeRateEffective;
    const payment = netRevenue * cfg.paymentRate;
    const logistics = orders * outbound;
    const returnsCost = returned * returnUnitCost;

    state.inStock[skuId] = stockStart - orders + returned;

    totalGrossRevenue += grossRevenue;
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
      grossRevenue,
      netSold,
      netRevenue,
      cogs,
      fee,
      payment,
      logistics,
      returnsCost,
    });
  }

  const adCost = adBudget;
  const overhead = cfg.fixedOverheadDaily * (Number(eventMods.overheadMult) || 1);
  const returnPct = totalOrders > 0 ? totalReturned / totalOrders : 0;
  const stockoutRate = totalOrdersWanted > 0 ? totalUnmetUnits / totalOrdersWanted : 0;
  const serviceStockoutImpact = stockoutRate * 2.3 * stockoutServiceMult;
  const serviceReturnsImpact = returnPct * 2.0;
  const serviceRating = Math.max(
    1,
    Math.min(5, 5 - serviceStockoutImpact - serviceReturnsImpact + serviceRatingDelta)
  );
  const servicePenalty = Math.max(0, (5 - serviceRating) * 350);
  let operatingProfit =
    totalNetRevenue -
    totalCogs -
    totalFee -
    totalPayment -
    adCost -
    overhead -
    totalLogistics -
    totalReturnsCost -
    servicePenalty -
    teamDailyCost;
  operatingProfit *= globalProfitMult;

  state.cash += operatingProfit;

  const marginPct = totalNetRevenue > 0 ? (operatingProfit / totalNetRevenue) * 100 : 0;
  const acos = totalNetRevenue > 0 ? adCost / totalNetRevenue : 0;

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
    serviceRating,
  };

  state.lastDayReport = {
    day: state.day,
    totals: {
      grossRevenue: totalGrossRevenue,
      netRevenue: totalNetRevenue,
      cogs: totalCogs,
      fee: totalFee,
      payment: totalPayment,
      adCost,
      overhead,
      logistics: totalLogistics,
      returnsCost: totalReturnsCost,
      servicePenalty,
      teamCost: teamDailyCost,
      globalProfitMult,
      serviceRating,
      serviceStockoutImpact,
      serviceReturnsImpact,
      operatingProfit,
      adTrafficTotal: adTotal,
      unmetUnits: totalUnmetUnits,
      ordersWanted: totalOrdersWanted,
    },
    perSku,
  };

  const prevUnmetMemory = state.unmetMemory && typeof state.unmetMemory === "object" ? state.unmetMemory : {};
  const nextUnmetMemory = { ...prevUnmetMemory };
  for (const row of perSku) {
    const skuId = String(row.skuId);
    const unmet = Math.max(0, Number(row.unmetUnits) || 0);
    const prev = Math.max(0, Number(prevUnmetMemory[skuId]) || 0);
    // EMA по unmet, чтобы видеть устойчивый дефицит по SKU.
    nextUnmetMemory[skuId] = prev * 0.62 + unmet * 0.38;
  }
  state.unmetMemory = nextUnmetMemory;

  return state.lastDayReport;
}
