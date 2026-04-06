# Marketplace Seller Simulator - Economy v1 (Yandex Games)

## Goals
- Keep the model readable for players while remaining believable.
- Ensure at least 3 viable strategies: margin-first, traffic-first, operations-first.
- Prevent runaway snowball with scale penalties and service risk.
- Fit short replayable web sessions with clear progress hooks.

## Core Tick
- Simulation unit: 1 in-game day.
- A week is 7 ticks, month is 28 ticks.
- Most analytics shown as rolling 7-day and 28-day values.
- One player run target: 7-14 days (8-15 real minutes).

## Base Variables
- `baseDemand`: category demand baseline per day.
- `qualityScore`: 0..100, derived from card quality and reviews.
- `price`: current selling price.
- `marketPrice`: dynamic benchmark.
- `adBudget`: daily ad spend.
- `inStock`: sellable units.
- `leadTimeDays`: procurement to stock delay.

## Demand and Traffic
```text
organicTraffic = baseDemand * seasonMod * trendMod * reputationMod * categoryFitMod
adTraffic = adBudget * adEfficiency * saturationPenalty
totalTraffic = organicTraffic + adTraffic
```

```text
saturationPenalty = 1 / (1 + (adBudget / saturationCap)^1.15)
```

## Conversion
```text
priceIndex = price / marketPrice
priceConvMod = clamp(1.30 - 0.60 * priceIndex, 0.55, 1.20)
qualityConvMod = 0.65 + (qualityScore / 200)
shippingConvMod = clamp(1.10 - 0.03 * leadTimeDays, 0.75, 1.05)
conversionRate = baseConversion * priceConvMod * qualityConvMod * shippingConvMod * promoMod
ordersRaw = totalTraffic * conversionRate
orders = floor(min(ordersRaw, inStock))
```

## Revenue and Returns
```text
grossRevenue = orders * price
returnRate = baseReturnRate * returnRiskMod * categoryReturnMod
returnedUnits = round(orders * returnRate)
netSoldUnits = max(orders - returnedUnits, 0)
netRevenue = netSoldUnits * price
```

## Costs
```text
cogs = orders * unitPurchaseCost
marketplaceFee = grossRevenue * feeRate
paymentProcessing = grossRevenue * paymentRate
logisticsOutbound = orders * outboundCostPerUnit * distanceMod
logisticsInbound = procurementUnits * inboundCostPerUnit
storageCost = max(inStock - freeStorageThreshold, 0) * storageCostPerUnit
adCost = adBudget
returnsCost = returnedUnits * (reverseLogisticsCost + refurbishCostPerUnit)
payrollCost = sum(staffDailyCost)
fixedOverhead = officeRentDaily + softwareDaily + utilitiesDaily
penalties = servicePenalty + policyPenalty
```

## Profit
```text
totalCosts = cogs + marketplaceFee + paymentProcessing + logisticsOutbound + logisticsInbound + storageCost + adCost + returnsCost + payrollCost + fixedOverhead + penalties
operatingProfit = netRevenue - totalCosts
cashflow = operatingProfit - capexSpend - loanPayments
```

## KPI Formulas (UI)
- `marginPct = (operatingProfit / max(netRevenue, 1)) * 100`
- `acos = adCost / max(grossRevenue, 1)` (ad cost over sales)
- `roas = grossRevenue / max(adCost, 1)`
- `sellThrough = netSoldUnits / max(inStock + netSoldUnits, 1)`
- `daysOfStock = inStock / max(avgDailyNetSales28d, 0.1)`
- `returnPct = returnedUnits / max(orders, 1)`
- `serviceLevel = onTimeShipments / max(totalShipments, 1)`
- `sellerRating` in range 1.0..5.0 (moving weighted average)

## Anti-Snowball Rules
- Operational complexity tax after SKU thresholds.
```text
complexityTaxPct = max(0, (skuCount - 30)) * 0.0015
complexityTax = grossRevenue * complexityTaxPct
```
- Storage inefficiency penalty if `daysOfStock > 45`.
- Quality drift if SKU count grows faster than staffing.
- Reputation decay after repeated late shipments or high return rate.

## Difficulty Presets
- `Relaxed`: +12% conversion, -20% penalties.
- `Standard`: baseline values.
- `Hard`: -8% conversion, +30% volatility, +15% penalties.

## Initial Balance Targets (Standard)
- First positive run possible by attempts 2-3.
- Healthy mature business margin: 12-22%.
- Return rate target by midgame: 6-10% depending on category.
- Logistics + marketplace fees should consume 22-35% of gross revenue.

## Platform Monetization Constraints (Yandex)
- Rewarded ads only at natural breakpoints (end of run, recovery helper, optional boost).
- Interstitial ads with cooldown and never during critical decision moments.
- Ad rewards must be convenience-oriented, not mandatory to progress.

### Optional Reward Effects (bounded)
```text
reward_fastShipment: leadTimeDays -1 for next procurement only
reward_returnShield: returnsCost -25% for next in-game day
reward_auditBoost: +4 qualityScore for one selected SKU for 3 days
```

### Economy Safety Caps for Ad Rewards
```text
maxRewardedPerRun = 3
maxRevenueImpactFromRewardsPct = 0.12
```

## Data Contracts (for implementation)
```json
{
  "economyTickInput": {
    "day": 1,
    "categoryId": "beauty",
    "skuId": "beauty_lip_01",
    "price": 1290,
    "marketPrice": 1390,
    "baseDemand": 220,
    "qualityScore": 72,
    "adBudget": 4800,
    "inStock": 340
  }
}
```

