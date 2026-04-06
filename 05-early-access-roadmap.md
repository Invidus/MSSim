# Marketplace Seller Simulator - Yandex Games Roadmap

## Release Objective
Ship and scale a web build on Yandex Games with strong retention and ad monetization:
stable economy core, clear progression, and repeatable short sessions.

## Timeline (14 Weeks)

### Phase 1 - Foundation (Weeks 1-3)
- Implement M1 systems and complete short-run core loop (7-14 days per run).
- Lock economy equations and KPI dashboards.
- Add telemetry hooks for day-level analytics.
- Integrate Yandex SDK init with fallback path.
- Exit criteria:
  - 3 complete internal runs with no blockers.
  - At least 2 viable opening strategies.

### Phase 2 - Web Playable Loop Expansion (Weeks 4-6)
- Expand from 1 to 3 categories and 36 SKUs.
- Add 10 random events (5 negative, 5 positive).
- Introduce seller rating and penalty logic.
- Add basic progression: 12 nodes from tree.
- Add rewarded/interstitial placements with cooldown and UX safety.
- Exit criteria:
  - Average session > 8 minutes.
  - First session completion of one full run >= 60%.

### Phase 3 - Progression and Depth (Weeks 7-10)
- Integrate full 34-node progression system.
- Add team hiring and payroll mechanics.
- Add automation tier 1 and 2 features.
- Expand content to full 72 SKUs and 24 events.
- Exit criteria:
  - At least 3 viable playstyles (marketing, operations, assortment).
  - No dominant build with >75% win-rate in test cohort.

### Phase 4 - Soft Launch and Polish (Weeks 11-12)
- UI polish and onboarding with guided first month.
- Balance pass on margins, return rates, and event intensity.
- Add quality-of-life: filters, alerts, KPI tooltips, presets.
- Run soft launch cohort on Yandex Games listing visibility.
- Exit criteria:
  - Major bug count <= 5.
  - Completion rate of first run >= 75%.
  - Day-1 return ratio >= 30%.

### Phase 5 - Yandex Release Prep (Weeks 13-14)
- Prepare Yandex store assets (icon, screenshots, short/long descriptions).
- Stability and browser performance pass.
- Final balancing freeze and release notes.
- Set up support channel and issue triage workflow.
- Exit criteria:
  - Release candidate accepted after 10 full regression runs.
  - Crash-free rate >= 98% in test sessions.

## Balance Test Protocol

### Test Matrix
- Difficulty presets: Relaxed, Standard, Hard.
- Player archetypes:
  - `Optimizer`: max margin focus.
  - `Marketer`: ad-heavy growth.
  - `Operator`: low-risk stable throughput.
- Run checkpoints: day 7, day 14, day 28.

### Required Balance Signals
- Margin range midgame (Standard): 8-20%.
- Early fail rate by day 7 (new players): 20-35%.
- Return rate controllability: player can reduce by at least 30% via good decisions.
- Stockout frequency target: 8-18% of SKU-days.

### Anti-Exploit Checks
- Infinite profit loops from ad arbitrage.
- Zero-risk setups with stacked reductions.
- Excessive compounding from automation + marketing.

## Playtest Program

### Cohorts
- Cohort A: 8 experienced sim players.
- Cohort B: 8 casual strategy players.
- Cohort C: 8 business-sim creators/streamers (optional stretch).

### Session Cadence
- Closed test wave every 2 weeks.
- Each tester runs 3 short runs on Standard.
- Structured survey after each run:
  - clarity of decisions
  - fairness of events
  - perceived strategic diversity
  - pacing and fatigue

### Target Metrics Before Release
- Day-1 retention equivalent: >30% (goal 35%+ after patches).
- Average session length: >8 minutes.
- Tutorial completion: >85%.
- Reported "confusing economy moments": <15% of sessions.
- 3+ distinct successful strategies verified in telemetry.
- Rewarded ad opt-in: 20-45% on eligible moments.

## Risk Register
- `EconomyTooOpaque`: mitigate with drill-down cost panels and tooltips.
- `EventFrustration`: mitigate with event intensity caps and pity system.
- `ContentFatigue`: mitigate with category-specific objectives and rotating modifiers.
- `LegalSimilarityRisk`: keep unique brand language, iconography, and UI layout patterns.
- `AdFatigueRisk`: cap interstitial frequency and preserve player agency.

## Yandex Go/No-Go Checklist
- Core loop stable across 120+ in-game days.
- Progression tree complete and functional.
- 6 categories and 72 SKUs active.
- 24 events live and weighted.
- Performance acceptable on low-mid hardware target.
- Known issues documented with public roadmap.
- Store page assets prepared for Yandex moderation.
- Privacy policy and user agreement links published.

## Post-Release First 8 Weeks (Live Ops)
- Bi-weekly balance patches.
- New event pack (+8 events) in week 4 post-launch.
- One new category in week 6 post-launch.
- Community poll-driven roadmap update in week 8.

