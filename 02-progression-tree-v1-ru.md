# Marketplace Seller Simulator — дерево прокачки v1

## Принципы
- Длинная кампания с осмысленными, стакающимися бонусами.
- Гибрид разблокировки: очки навыков + вложение денег в узел.
- Нет жёстко единственного пути: каждая ветка поддерживает свою стратегию.

## Валюта и правила открытия
- `SkillPoint` — за уровни и вехи.
- `CashCost` — оплата активации после разблокировки.
- `Prereq` — обязательные родительские узлы.
- Бонусы суммируются, если не указано иначе (мультипликативно).
- За кампанию можно открыть все узлы.

## Кривая уровня игрока
- XP за прибыльные вехи, задания и рост репутации.
- Темп:
  - уровни 1–10: быстро (1 уровень за 1–2 игровых дня);
  - 11–25: мидгейм (1 уровень за 3–4 дня);
  - 26+: долгая оптимизация (1 уровень за 5–7 дней).

## Дерево CEO (18 узлов)

### Ветка Commerce (6 узлов)
1. `C1_BetterTitles` — +4 `qualityScore` ко всем новым карточкам; 1 SP + 8k.
2. `C2_PricePsychology` — +3% конверсии при `priceIndex <= 1.02`; 1 SP + 12k; prereq: C1.
3. `C3_ReviewFollowup` — −8% `returnRate` от «несовпадения ожиданий»; 2 SP + 20k; prereq: C2.
4. `C4_BundleLogic` — +6% среднего чека на подходящих SKU; 2 SP + 28k; prereq: C2.
5. `C5_PremiumPresentation` — +7 `qualityScore`, +2% конверсии; 3 SP + 45k; prereq: C3 или C4.
6. `C6_BrandTrust` — потолок `sellerRating` +0.15 и +4% органики; 4 SP + 70k; prereq: C5.

### Ветка Operations (6 узлов)
7. `O1_BasicSOP` — −6% поздних отгрузок; 1 SP + 10k.
8. `O2_PackagingDiscipline` — −9% возвратов из-за брака упаковки; 1 SP + 14k; prereq: O1.
9. `O3_StockRotation` — −12% `storageCost` на медленные позиции; 2 SP + 24k; prereq: O2.
10. `O4_ForecastBoard` — −15% шанса stockout; 2 SP + 30k; prereq: O2.
11. `O5_FastDispatch` — −1 `leadTimeDays` (минимум 1); 3 SP + 52k; prereq: O3 или O4.
12. `O6_ReliabilityProgram` — −20% штрафов, +5% `reputationMod`; 4 SP + 75k; prereq: O5.

### Ветка Marketing (6 узлов)
13. `M1_CampaignTemplates` — +8% `adEfficiency`; 1 SP + 9k.
14. `M2_AudienceSegmentation` — +10% рекламного трафика при том же бюджете; 1 SP + 15k; prereq: M1.
15. `M3_CreativeLab` — +5 влияния `qualityScore` внутри рекламы; 2 SP + 22k; prereq: M2.
16. `M4_CrossPromo` — +6% органики при 3+ SKU в категории; 2 SP + 32k; prereq: M2.
17. `M5_BidAutomation` — −12% ACOS при тех же продажах; 3 SP + 50k; prereq: M3 или M4.
18. `M6_BrandMomentum` — +9% суммарного трафика, +1% конверсии; 4 SP + 78k; prereq: M5.

## Команда (8 узлов)
19. `T1_HireContentManager` — пресет качества карточки, +3 `qualityScore`; 0 SP + 20k + 900/день.
20. `T2_HireAnalyst` — еженедельные инсайты, +6% точности прогноза; 0 SP + 26k + 1200/день; prereq: T1.
21. `T3_HireBuyer` — −4% закупки после переговоров; 0 SP + 34k + 1400/день.
22. `T4_HireAdSpecialist` — +10% `adEfficiency`, пресеты кампаний; 0 SP + 38k + 1500/день.
23. `T5_TeamSync` — +5% ко всем эффектам команды; 2 SP + 40k; prereq: T2+T3+T4.
24. `T6_SecondShift` — +12% пропускной способности, −10% опозданий; 2 SP + 60k; prereq: T5.
25. `T7_TrainingProgram` — −15% человеческих ошибок; 2 SP + 55k; prereq: T5.
26. `T8_DepartmentLeads` — +10% throughput, +8% стабильности качества; 3 SP + 95k; prereq: T6+T7.

## Автоматизация и технологии (8 узлов)
27. `A1_AutoRepriceLite` — ежедневная подстройка цены в безопасном коридоре; 1 SP + 25k.
28. `A2_ReorderRules` — авто-заказ по порогу остатка; 1 SP + 28k.
29. `A3_ReturnClassifier` — −10% потерь на возвратах за счёт сортировки; 2 SP + 42k; prereq: A2.
30. `A4_WMSSync` — −18% складских ошибок; 2 SP + 50k; prereq: A2.
31. `A5_DemandPredictor` — −20% перестока, −15% stockout; 3 SP + 75k; prereq: A3+A4.
32. `A6_ReviewAutoReply` — +0.1 `sellerRating` со временем, +3% удержания; 2 SP + 45k; prereq: A1.
33. `A7_PortfolioOptimizer` — +8% эффективности капитала по SKU; 3 SP + 85k; prereq: A5.
34. `A8_ControlTower` — +6% прибыли глобально, −20% урона от событий; 4 SP + 130k; prereq: A6+A7.

## Пересборка и баланс-ограничители
- Respec раз в игровой квартал с штрафом 15% от кэша.
- Убывающая отдача от одинаковых бонусов выше +35%.
- Жёсткий пол для `returnRate` и ACOS, чтобы не было «нулевого риска».

## Форма данных узла (для кода)
```json
{
  "nodeId": "M5_BidAutomation",
  "group": "marketing",
  "skillPointCost": 3,
  "cashCost": 50000,
  "prerequisites": ["M3_CreativeLab"],
  "effects": [
    { "stat": "acos", "op": "mul", "value": 0.88 }
  ]
}
```
