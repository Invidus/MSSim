# Marketplace Seller Simulator - Content Spec v1

## Platform Fiction
- Marketplace name: `BerryMart`.
- Seller app name: `SellerHub`.
- Currency: `coins` (1 coin ~= 1 RUB for balancing convenience).

## Starting Categories (6)
1. Beauty and Care
2. Home and Kitchen
3. Kids and Toys
4. Apparel and Basics
5. Pet Supplies
6. Gadgets and Accessories

## Category Identity and Base Modifiers

| Category | Base Demand | Base Margin | Base Return | Volatility | Logistics Complexity |
|---|---:|---:|---:|---:|---:|
| Beauty and Care | 1.15 | 0.32 | 0.07 | 0.12 | 0.20 |
| Home and Kitchen | 1.00 | 0.28 | 0.06 | 0.10 | 0.35 |
| Kids and Toys | 0.95 | 0.30 | 0.09 | 0.18 | 0.30 |
| Apparel and Basics | 1.20 | 0.35 | 0.16 | 0.22 | 0.25 |
| Pet Supplies | 0.90 | 0.26 | 0.05 | 0.08 | 0.28 |
| Gadgets and Accessories | 1.05 | 0.33 | 0.10 | 0.20 | 0.40 |

## SKU Volume Plan
- v1 total: 72 SKUs (12 per category).
- Each category split:
  - 4 low-risk staples
  - 4 medium-risk trend products
  - 4 high-risk high-margin items

## Example SKU Matrix (18 representative items)

| SKU ID | Category | Tier | Purchase Cost | Recommended Price | Base Demand | Base Return | Lead Time |
|---|---|---|---:|---:|---:|---:|---:|
| beauty_lip_01 | Beauty | Low | 380 | 990 | 210 | 0.05 | 4 |
| beauty_mask_02 | Beauty | Low | 260 | 690 | 240 | 0.04 | 3 |
| beauty_serum_07 | Beauty | Mid | 720 | 1690 | 150 | 0.07 | 5 |
| home_box_03 | Home | Low | 410 | 1040 | 180 | 0.04 | 5 |
| home_pan_06 | Home | Mid | 980 | 2390 | 130 | 0.06 | 6 |
| home_organizer_10 | Home | High | 1450 | 3490 | 95 | 0.07 | 7 |
| kids_blocks_01 | Kids | Low | 520 | 1290 | 170 | 0.08 | 5 |
| kids_puzzle_04 | Kids | Mid | 640 | 1590 | 140 | 0.09 | 4 |
| kids_robot_11 | Kids | High | 2100 | 4990 | 70 | 0.13 | 8 |
| apparel_sock_02 | Apparel | Low | 140 | 490 | 300 | 0.10 | 3 |
| apparel_tee_06 | Apparel | Mid | 420 | 1290 | 210 | 0.15 | 4 |
| apparel_hoodie_12 | Apparel | High | 1100 | 3190 | 110 | 0.19 | 6 |
| pet_bowl_01 | Pet | Low | 220 | 690 | 160 | 0.03 | 4 |
| pet_toy_03 | Pet | Mid | 310 | 990 | 175 | 0.05 | 5 |
| pet_bed_09 | Pet | High | 1450 | 3690 | 85 | 0.06 | 7 |
| gadget_cable_01 | Gadgets | Low | 90 | 390 | 340 | 0.07 | 3 |
| gadget_powerbank_05 | Gadgets | Mid | 780 | 2190 | 165 | 0.10 | 6 |
| gadget_headset_11 | Gadgets | High | 1850 | 4790 | 100 | 0.12 | 8 |

## Demand Modifiers (Global)
- `trendMod`: 0.85..1.25 (weekly).
- `seasonMod`: from seasonal table.
- `competitionMod`: 0.90..1.10 per category.
- `reputationMod`: 0.80..1.20 from seller rating.
- `promoMod`: 1.00..1.18 for active promotion windows.

## Seasonal Calendar (12 months)

| Month | Beauty | Home | Kids | Apparel | Pet | Gadgets |
|---|---:|---:|---:|---:|---:|---:|
| Jan | 1.05 | 1.12 | 0.95 | 1.10 | 0.96 | 1.08 |
| Feb | 1.10 | 0.98 | 1.00 | 1.06 | 0.97 | 1.03 |
| Mar | 1.15 | 1.00 | 1.02 | 1.00 | 1.00 | 0.98 |
| Apr | 1.00 | 1.08 | 1.05 | 0.95 | 1.03 | 0.96 |
| May | 0.96 | 1.15 | 1.08 | 0.94 | 1.05 | 0.95 |
| Jun | 0.95 | 1.05 | 1.10 | 0.92 | 1.08 | 0.97 |
| Jul | 0.94 | 0.98 | 0.96 | 0.90 | 1.09 | 1.05 |
| Aug | 0.98 | 1.02 | 1.25 | 0.93 | 1.04 | 1.08 |
| Sep | 1.04 | 1.00 | 1.18 | 0.98 | 1.00 | 1.06 |
| Oct | 1.12 | 1.05 | 1.02 | 1.03 | 0.99 | 1.10 |
| Nov | 1.18 | 1.10 | 1.04 | 1.16 | 1.01 | 1.22 |
| Dec | 1.22 | 1.20 | 1.15 | 1.24 | 1.07 | 1.30 |

## Event Pack v1 (24 events)

### Negative Events (12)
1. Supplier delay (+2 lead time for selected category, 5 days)
2. Packaging defect spike (+4% return rate)
3. Ad auction overheated (-18% ad efficiency)
4. Storage tariff increase (+25% storage cost for 7 days)
5. Policy audit risk (possible penalty if service level < threshold)
6. Viral negative review (-0.2 rating temporary)
7. Currency wobble (+8% procurement cost)
8. Fake listing undercut (marketPrice pressure -7%)
9. Courier bottleneck (+12% late shipments)
10. Category saturation (-10% organic traffic)
11. Defect batch recall (forced return on one SKU line)
12. Low morale in team (-6% team bonuses)

### Positive Events (12)
13. Influencer mention (+16% traffic for one SKU for 4 days)
14. Supplier loyalty discount (-6% purchase cost for 10 days)
15. Platform feature placement (+22% organic traffic category-wide)
16. Efficient route rollout (-12% outbound logistics)
17. Loyal buyer streak (+5% conversion)
18. Seasonal bundle trend (+8% avg check in category)
19. Positive reviews wave (+0.15 rating)
20. Cashback campaign partner (+14% conversion, +3% fee temporary)
21. Smart ad inventory (+20% ad efficiency)
22. Warehousing optimization (-18% storage cost)
23. Staff excellence week (-10% returns and -8% delays)
24. Viral unboxing (+25% demand on one high-tier SKU)

## Event Weighting Rules
- Daily event roll chance: 18%.
- Hard cap: 1 major event per day.
- Pity timer: if no event for 6 days, force an event on day 7.
- Streak limiter: same category cannot receive more than 2 events in a row.

## Content Configuration Shape
```json
{
  "categories": [
    {
      "id": "beauty",
      "baseDemandMod": 1.15,
      "baseMarginMod": 0.32,
      "baseReturnRate": 0.07,
      "volatility": 0.12
    }
  ],
  "events": [
    {
      "id": "event_supplier_delay",
      "type": "negative",
      "durationDays": 5,
      "effects": [
        { "target": "leadTimeDays", "op": "add", "value": 2 }
      ]
    }
  ]
}
```

