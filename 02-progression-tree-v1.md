# Marketplace Seller Simulator - Progression Tree v1

## Design Principles
- Long-campaign progression with meaningful, stackable bonuses.
- Hybrid unlock model: skill points + cash investment.
- No mandatory single path; each branch supports a viable strategy.

## Currency and Unlock Rules
- `SkillPoint`: earned from level-ups and milestones.
- `CashCost`: spent to activate a node after unlocking.
- `Prereq`: required parent node(s).
- Bonuses are additive unless explicitly stated as multiplicative.
- Max active nodes: all unlockable over campaign.

## Player Level Curve
- XP from profit milestones, mission completions, and reputation gains.
- Target pacing:
  - Level 1-10: fast onboarding (1 level every 1-2 days).
  - Level 11-25: midgame (1 level every 3-4 days).
  - Level 26+: long-tail optimization (1 level every 5-7 days).

## CEO Skill Tree (18 nodes)

### Commerce Branch (6 nodes)
1. `C1_BetterTitles`
   - Effect: +4 qualityScore on all new cards.
   - Cost: 1 SP + 8k.
2. `C2_PricePsychology`
   - Effect: +3% conversion if `priceIndex <= 1.02`.
   - Cost: 1 SP + 12k. Prereq: C1.
3. `C3_ReviewFollowup`
   - Effect: -8% returnRate from expectation mismatch.
   - Cost: 2 SP + 20k. Prereq: C2.
4. `C4_BundleLogic`
   - Effect: +6% avgCheck on eligible SKUs.
   - Cost: 2 SP + 28k. Prereq: C2.
5. `C5_PremiumPresentation`
   - Effect: +7 qualityScore, +2% conversion.
   - Cost: 3 SP + 45k. Prereq: C3 or C4.
6. `C6_BrandTrust`
   - Effect: +0.15 sellerRating cap and +4% organicTraffic.
   - Cost: 4 SP + 70k. Prereq: C5.

### Operations Branch (6 nodes)
7. `O1_BasicSOP`
   - Effect: -6% late shipments.
   - Cost: 1 SP + 10k.
8. `O2_PackagingDiscipline`
   - Effect: -9% damage returns.
   - Cost: 1 SP + 14k. Prereq: O1.
9. `O3_StockRotation`
   - Effect: -12% storageCost on slow movers.
   - Cost: 2 SP + 24k. Prereq: O2.
10. `O4_ForecastBoard`
    - Effect: -15% stockout chance.
    - Cost: 2 SP + 30k. Prereq: O2.
11. `O5_FastDispatch`
    - Effect: -1 leadTimeDays (min 1).
    - Cost: 3 SP + 52k. Prereq: O3 or O4.
12. `O6_ReliabilityProgram`
    - Effect: -20% penalties, +5% reputationMod.
    - Cost: 4 SP + 75k. Prereq: O5.

### Marketing Branch (6 nodes)
13. `M1_CampaignTemplates`
    - Effect: +8% adEfficiency.
    - Cost: 1 SP + 9k.
14. `M2_AudienceSegmentation`
    - Effect: +10% adTraffic from same budget.
    - Cost: 1 SP + 15k. Prereq: M1.
15. `M3_CreativeLab`
    - Effect: +5 qualityScore impact inside ads.
    - Cost: 2 SP + 22k. Prereq: M2.
16. `M4_CrossPromo`
    - Effect: +6% organicTraffic if 3+ SKUs in category.
    - Cost: 2 SP + 32k. Prereq: M2.
17. `M5_BidAutomation`
    - Effect: -12% ACOS at same sales.
    - Cost: 3 SP + 50k. Prereq: M3 or M4.
18. `M6_BrandMomentum`
    - Effect: +9% totalTraffic, +1% conversion.
    - Cost: 4 SP + 78k. Prereq: M5.

## Team System (8 nodes)
19. `T1_HireContentManager`
   - Effect: unlock card quality autopreset, +3 qualityScore.
   - Cost: 0 SP + 20k setup + 900/day payroll.
20. `T2_HireAnalyst`
   - Effect: weekly insights, +6% forecast accuracy.
   - Cost: 0 SP + 26k + 1200/day. Prereq: T1.
21. `T3_HireBuyer`
   - Effect: -4% purchase cost after negotiations.
   - Cost: 0 SP + 34k + 1400/day.
22. `T4_HireAdSpecialist`
   - Effect: +10% adEfficiency, unlock campaign presets.
   - Cost: 0 SP + 38k + 1500/day.
23. `T5_TeamSync`
   - Effect: +5% all team effects.
   - Cost: 2 SP + 40k. Prereq: T2 + T3 + T4.
24. `T6_SecondShift`
   - Effect: +12% processing capacity, -10% late shipments.
   - Cost: 2 SP + 60k. Prereq: T5.
25. `T7_TrainingProgram`
   - Effect: -15% human-error events.
   - Cost: 2 SP + 55k. Prereq: T5.
26. `T8_DepartmentLeads`
   - Effect: +10% throughput, +8% quality consistency.
   - Cost: 3 SP + 95k. Prereq: T6 + T7.

## Automation and Tech (8 nodes)
27. `A1_AutoRepriceLite`
   - Effect: daily auto-adjust within safe margin band.
   - Cost: 1 SP + 25k.
28. `A2_ReorderRules`
   - Effect: auto procurement trigger by stock threshold.
   - Cost: 1 SP + 28k.
29. `A3_ReturnClassifier`
   - Effect: -10% refund loss via better triage.
   - Cost: 2 SP + 42k. Prereq: A2.
30. `A4_WMSSync`
   - Effect: -18% warehouse operation mistakes.
   - Cost: 2 SP + 50k. Prereq: A2.
31. `A5_DemandPredictor`
   - Effect: -20% overstock risk, -15% stockout risk.
   - Cost: 3 SP + 75k. Prereq: A3 + A4.
32. `A6_ReviewAutoReply`
   - Effect: +0.1 sellerRating over time, +3% retention.
   - Cost: 2 SP + 45k. Prereq: A1.
33. `A7_PortfolioOptimizer`
   - Effect: +8% capital efficiency across SKUs.
   - Cost: 3 SP + 85k. Prereq: A5.
34. `A8_ControlTower`
   - Effect: global +6% profit and -20% event damage.
   - Cost: 4 SP + 130k. Prereq: A6 + A7.

## Respec and Balance Safeguards
- Respec available once per campaign quarter with 15% cash penalty.
- Diminishing returns on stacking same-type bonuses above +35%.
- Hard floor for returnRate and ACOS to avoid degenerate zero-risk builds.

## Implementation Data Shape
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

