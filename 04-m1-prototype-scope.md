# Marketplace Seller Simulator - M1 Prototype Scope (Yandex Games)

## M1 Goal
Deliver a web-first playable loop for Yandex Games:
short run (7-14 in-game days) -> clear decisions -> meta reward -> replay.

## Timebox
- Target duration: 2-3 weeks.
- Scope lock rule: no new systems after day 10, only polish and bugfix.
- Performance target: first load under 5-7 seconds on average desktop browser.

## Must-Have Systems
1. Day simulation tick (1 day advance button).
2. Single category (`Beauty`) with 10 SKUs.
3. Procurement panel (buy quantity, ETA, purchase cost).
4. Product card panel (title quality preset, price, promo toggle).
5. Ad control (daily budget slider + on/off).
6. Sales processing and stock decrement.
7. Cost stack and profit computation.
8. Return system (basic rate + cost impact).
9. KPI dashboard (Revenue, Profit, Margin, ACOS, Return Rate, Stock Days).
10. Save/load run state (local JSON).
11. Yandex Games SDK init wrapper (`ysdk`) with graceful fallback.
12. Rewarded ad placement at natural breakpoints (optional reward, no forced flow break).
13. Interstitial ad placement after run summary with cooldown.

## Nice-to-Have (only if ahead of schedule)
- 3 random events from v1 pool.
- 1 mini-upgrade branch with 4 nodes.
- Weekly summary modal with actionable tips.
- Cloud save via platform profile when available.

## Out of Scope for M1
- Multi-category portfolio.
- Full 34-node progression tree.
- Staff hiring UI.
- Advanced automation (auto-reprice, reorder rules).
- External backend and leaderboards.
- Complex art pipeline and voice/audio polish.
- In-app purchases (IAP) integration (move to post-M1).

## UX Flow (Target)
1. Start run with initial cash and starter SKU list.
2. Quick tutorial (60-90 seconds).
3. Choose 1-2 SKUs, purchase inventory.
4. Configure card quality and pricing.
5. Run 7-14 days with quick decisions.
6. End run with summary, reward option, and clear next-run hook.

## M1 Starting Balance
- Initial cash: 120000.
- Fixed daily overhead: 900.
- Fee rate: 18%.
- Base ad efficiency: 0.028 traffic per coin.
- Starter SKUs: 10 beauty items, demand 120-260/day.
- Intended first profitable run: within 2-3 attempts.

## KPI Acceptance Criteria
- Player understands why profit changes (clear breakdown visible).
- At least 2 viable short-run strategies:
  - Conservative margin strategy.
  - Aggressive ad growth strategy.
- A full run (7-14 days) completes in 8-15 minutes.
- No deadlock state where player cannot continue from day 5 onward.
- Retention hook: player sees at least 1 meaningful unlock in first 10 minutes.

## Definition of Done (M1)
- All Must-Have systems implemented and connected.
- 0 critical blockers in a full run playthrough.
- 3 internal playtests completed with notes addressed.
- Telemetry log exported as JSON for each run.
- Ads are non-blocking and do not break core flow.

## Telemetry to Capture
- Day-level snapshot: traffic, orders, returns, net revenue, profit.
- Player actions: price changes, ad budget changes, procurement decisions.
- Failure causes: stockout, cash crash, penalty spike.
- End-run metrics: final cash, peak cash drawdown, average margin, rating.
- Ad metrics: rewarded show rate, reward accept rate, interstitial completion.
- Session metrics: first-session length, run completion, day-1 return probability proxy.

## M1 File/Module Skeleton
```text
src/
  core/
    economyEngine.js
    demandModel.js
    costModel.js
  data/
    categories.json
    skus_beauty_m1.json
  ui/
    dashboard.js
    procurementPanel.js
    cardEditorPanel.js
    adsPanel.js
  persistence/
    saveLoad.js
  platform/
    yandexSdk.js
    adsService.js
  app.js
```

