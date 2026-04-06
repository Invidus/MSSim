# Marketplace Seller Simulator — экономика v1 (Яндекс Игры)

## Цели
- Модель понятна игроку и при этом правдоподобна.
- Минимум три рабочие стратегии: маржа, трафик, операционка.
- Сдерживать «снежный ком» за счёт штрафов за масштаб и рисков сервиса.
- Подходить к коротким веб-сессиям с явным чувством прогресса.

## Базовый тик
- Единица симуляции: **1 игровой день**.
- Неделя — 7 тиков, месяц — 28 тиков (когда понадобится долгая кампания).
- Аналитика: скользящие окна 7 и 28 дней.
- Цель одного «рана» для веба: **7–14 игровых дней** (примерно **8–15 минут** реального времени).

## Базовые переменные
- `baseDemand` — базовый спрос категории в день.
- `qualityScore` — 0..100, качество карточки и отзывов.
- `price` — текущая цена продажи.
- `marketPrice` — динамический ориентир рынка.
- `adBudget` — дневной рекламный бюджет.
- `inStock` — остаток готовый к продаже.
- `leadTimeDays` — задержка от закупки до прихода на склад.

## Спрос и трафик
```text
organicTraffic = baseDemand * seasonMod * trendMod * reputationMod * categoryFitMod
adTraffic = adBudget * adEfficiency * saturationPenalty
totalTraffic = organicTraffic + adTraffic
```

```text
saturationPenalty = 1 / (1 + (adBudget / saturationCap)^1.15)
```

## Конверсия
```text
priceIndex = price / marketPrice
priceConvMod = clamp(1.30 - 0.60 * priceIndex, 0.55, 1.20)
qualityConvMod = 0.65 + (qualityScore / 200)
shippingConvMod = clamp(1.10 - 0.03 * leadTimeDays, 0.75, 1.05)
conversionRate = baseConversion * priceConvMod * qualityConvMod * shippingConvMod * promoMod
ordersRaw = totalTraffic * conversionRate
orders = floor(min(ordersRaw, inStock))
```

## Выручка и возвраты
```text
grossRevenue = orders * price
returnRate = baseReturnRate * returnRiskMod * categoryReturnMod
returnedUnits = round(orders * returnRate)
netSoldUnits = max(orders - returnedUnits, 0)
netRevenue = netSoldUnits * price
```

## Расходы
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

## Прибыль
```text
totalCosts = cogs + marketplaceFee + paymentProcessing + logisticsOutbound + logisticsInbound + storageCost + adCost + returnsCost + payrollCost + fixedOverhead + penalties
operatingProfit = netRevenue - totalCosts
cashflow = operatingProfit - capexSpend - loanPayments
```

## KPI (для UI)
- `marginPct = (operatingProfit / max(netRevenue, 1)) * 100`
- `acos = adCost / max(grossRevenue, 1)` (доля рекламы от выручки)
- `roas = grossRevenue / max(adCost, 1)`
- `sellThrough = netSoldUnits / max(inStock + netSoldUnits, 1)`
- `daysOfStock = inStock / max(avgDailyNetSales28d, 0.1)`
- `returnPct = returnedUnits / max(orders, 1)`
- `serviceLevel = onTimeShipments / max(totalShipments, 1)`
- `sellerRating` — 1.0..5.0 (скользящее взвешенное среднее)

## Анти-снежный ком
- Налог на операционную сложность после порога по числу SKU:
```text
complexityTaxPct = max(0, (skuCount - 30)) * 0.0015
complexityTax = grossRevenue * complexityTaxPct
```
- Штраф за неэффективный склад, если `daysOfStock > 45`.
- Просадка качества, если SKU растут быстрее штата.
- Просадка репутации при постоянных задержках и высоких возвратах.

## Пресеты сложности
- `Relaxed`: +12% к конверсии, −20% к штрафам.
- `Standard`: базовые значения.
- `Hard`: −8% к конверсии, +30% волатильности, +15% к штрафам.

## Целевой баланс (Standard)
- Первый «плюсовой» ран реалистичен с **2–3-й попытки**.
- Здоровая маржа зрелого бизнеса: **12–22%**.
- Возвраты к середине: **6–10%** в зависимости от категории.
- Логистика + комиссии маркетплейса: **22–35%** от валовой выручки.

## Ограничения монетизации (Яндекс Игры)
- Rewarded — только на естественных паузах (конец рана, помощь после провала, опциональный буст).
- Interstitial — с кулдауном, не в момент важного решения.
- Награды за рекламу — **удобство**, не обязательный прогресс.

### Примеры наград (ограниченные)
```text
reward_fastShipment: leadTimeDays -1 только для следующей закупки
reward_returnShield: returnsCost -25% на следующий игровой день
reward_auditBoost: +4 qualityScore одному выбранному SKU на 3 дня
```

### Потолки безопасности для рекламных бонусов
```text
maxRewardedPerRun = 3
maxRevenueImpactFromRewardsPct = 0.12
```

## Контракт данных (для кода)
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
