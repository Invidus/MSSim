# Marketplace Seller Simulator - daily roadmap for Yandex Games

Goal: **playable M1 in ~3 weeks**, then **Yandex Games release-ready build** by phases from [05-early-access-roadmap.md](05-early-access-roadmap.md).

**Как читать:** один **день** = один фокусированный рабочий день (примерно 4–6 часов глубокой работы). Если занимаешься вдвое меньше по времени — сдвигай сроки ×2. Если 7 дней в неделю — можно укладывать быстрее.

---

## Phase 0 - Setup (before Day 1, 0.5-1 day)

- Lock stack: browser-first JS app, JSON data, optional bundler.
- Create repository, `index.html`, `app.js`, and dev build command.
- Copy constants from [01-economy-v1.md](01-economy-v1.md) and M1 from [04-m1-prototype-scope.md](04-m1-prototype-scope.md) to `config.js`.
- Prepare Yandex SDK placeholder module (`src/platform/yandexSdk.js`).

---

## M1 - Prototype (Days 1-21)

Must-have follows [04-m1-prototype-scope.md](04-m1-prototype-scope.md). **After Day 10 no new systems**, only polish, bugfix, balance, UX.

| Day | Task |
|------|--------|
| **1** | Project skeleton: `src/core`, `src/data`, `src/ui`, `src/persistence`, `src/platform`. Base game state fields. |
| **2** | `categories.json` + `skus_beauty_m1.json` with 10 SKUs and load pipeline. |
| **3** | Day tick button and run lifecycle (`startRun`, `endRun`). |
| **4** | `demandModel.js`: organic + paid traffic formulas. |
| **5** | Conversion and orders formulas with stock cap. |
| **6** | Procurement panel with incoming shipments queue. |
| **7** | Shipment arrivals and stock updates at day start. |
| **8** | Product card panel: quality preset, price, promo toggle. |
| **9** | Ads panel: daily budget and spend integration. |
| **10** | **Scope lock from now on**. Cost model: fee, logistics, overhead, COGS. |
| **11** | Returns model and net revenue recalculation. |
| **12** | KPI stockout tracking and deadlock guards. |
| **13** | KPI dashboard: Revenue, Profit, Margin, ACOS, Return %, Stock Days. |
| **14** | Cost breakdown panel for decision clarity. |
| **15** | Save/load to `localStorage` and JSON export. |
| **16** | Yandex SDK init wrapper and safe fallback when SDK unavailable. |
| **17** | Rewarded ad integration at end-of-run reward prompt. |
| **18** | Interstitial integration on run summary with cooldown policy. |
| **19** | Playtest #1 and fix top 3 UX and economy pain points. |
| **20** | Playtests #2-3, telemetry export including ad events. |
| **21** | M1 freeze and draft Yandex store-ready asset checklist. |

Optional if ahead: 3 events from [03-content-v1.md](03-content-v1.md), mini 4-node branch, weekly summary modal.

---

## Phase 2 - Loop Expansion (Days 22-45)

Goal: 3 categories, ~36 SKUs, rating, penalties, 10 events, and 12 progression nodes.

| Day | Task |
|------|-------------------|
| **22-25** | Multi-SKU day flow and category filtering. |
| **26-29** | Rating, penalties, and service-level impact. |
| **30-33** | Event system and first 10 events. |
| **34-37** | 12-node progression and UI. |
| **38-41** | 60-day campaign readability and KPI tooltips. |
| **42-45** | Balance pass and internal Phase 2 build. |

---

## Phase 3 - Depth (Days 46-65)

Goal: full 34 nodes, team/payroll, tier 1-2 automation, 72 SKUs, 24 events.

| Day | Task |
|------|-------------------|
| **46-48** | Remaining nodes + team/payroll wiring. |
| **49-51** | Automation features and balancing hooks. |
| **52-54** | Expand content to 72 SKUs and 24 events. |
| **55-60** | Anti-exploit checks and 3-playstyle viability tests. |
| **61-65** | Long regression runs and critical bug fixes. |

---

## Phase 4 - Soft Launch Polish (Days 66-80)

Goal: onboarding, QoL, and soft launch feedback loop.

| Day | Task |
|------|-------------------|
| **66-68** | Onboarding for first run and fail-safe hints. |
| **69-71** | QoL (filters, alerts, presets). |
| **72-74** | Balance pass for return/event intensity. |
| **75-76** | Soft launch package and feedback channel. |
| **77-78** | Collect user data and triage bugs. |
| **79-80** | Close major bugs and verify retention/session metrics. |

---

## Phase 5 - Yandex Release Candidate (Days 81-90)

Goal: Yandex listing readiness, stability, and RC.

| Day | Task |
|------|--------|
| **81-82** | Final web build optimization and compatibility checks. |
| **83-84** | Yandex listing assets and store copy. |
| **85-86** | 10 regression runs and performance pass. |
| **87-88** | Final balance freeze and release notes. |
| **89-90** | Go/No-Go using [05-early-access-roadmap.md](05-early-access-roadmap.md). |

---

## Daily habits (15 minutes)

- One journal line: done today / next tomorrow.
- One stable build or git tag each week.
- One short 7-day run after economy changes.

---

## Summary

| Stage | Working days | Outcome |
|------|-------------------------|-----------|
| M1 | 1-21 | Playable short runs, save/load, KPI, 10 Beauty SKUs |
| Expansion | 22-45 | 3 categories, events, rating, 12 nodes |
| Depth | 46-65 | 72 SKUs, 24 events, 34 nodes, automation |
| Soft launch | 66-80 | onboarding, QoL, retention tuning |
| Release prep | 81-90 | Yandex listing readiness, stability, RC |

If you only need M1, complete Days 1-21 first; the rest is the path to full Yandex-ready release.
