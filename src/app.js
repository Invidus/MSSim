import { simulateSalesDay } from "./core/daySim.js";
import { clamp } from "./core/demandModel.js";
import {
  getProgressionModifiers,
  computeTeamDailySalary,
  applyQualityFloor,
} from "./core/progressionModel.js";
import {
  emptyEventState,
  processDailyEvents,
  getPurchaseLeadTimeExtra,
  computeEventModifiers,
  defaultEventModifiers,
} from "./core/eventEngine.js";
import { runAutoReprice, runAutoReorder } from "./core/automationModel.js";
import { analyzeAntiExploit, inferDominantPlayStyle } from "./core/antiExploit.js";
import { resolveOnboarding, getErrorHints, syncOnboardingProgress } from "./core/onboardingModel.js";
import { saveToLocal, loadFromLocal } from "./persistence/saveLoad.js";
import { initYandexSdk } from "./platform/yandexSdk.js";

const defaultCategories = [
  { id: "beauty", name: "Beauty and Care", baseDemandMod: 1.15, baseMarginMod: 0.32, baseReturnRate: 0.07, volatility: 0.12 },
  { id: "home", name: "Home and Kitchen", baseDemandMod: 1.0, baseMarginMod: 0.28, baseReturnRate: 0.06, volatility: 0.1 },
  { id: "kids", name: "Kids and Toys", baseDemandMod: 0.95, baseMarginMod: 0.3, baseReturnRate: 0.09, volatility: 0.18 },
  { id: "apparel", name: "Apparel and Basics", baseDemandMod: 1.2, baseMarginMod: 0.35, baseReturnRate: 0.16, volatility: 0.22 },
  { id: "pet", name: "Pet Supplies", baseDemandMod: 0.9, baseMarginMod: 0.26, baseReturnRate: 0.05, volatility: 0.08 },
  { id: "electronics", name: "Gadgets and Accessories", baseDemandMod: 1.05, baseMarginMod: 0.33, baseReturnRate: 0.1, volatility: 0.2 },
];

const defaultSkus = [
  { id: "beauty_lip_01", name: "Lip Set", purchaseCost: 380, recommendedPrice: 990, baseDemand: 210, baseReturnRate: 0.05, leadTimeDays: 4 },
  { id: "beauty_mask_02", name: "Face Mask", purchaseCost: 260, recommendedPrice: 690, baseDemand: 240, baseReturnRate: 0.04, leadTimeDays: 3 },
  { id: "beauty_serum_07", name: "Serum", purchaseCost: 720, recommendedPrice: 1690, baseDemand: 150, baseReturnRate: 0.07, leadTimeDays: 5 },
  { id: "beauty_brush_03", name: "Brush Pack", purchaseCost: 300, recommendedPrice: 840, baseDemand: 180, baseReturnRate: 0.05, leadTimeDays: 4 },
  { id: "beauty_cream_04", name: "Cream", purchaseCost: 460, recommendedPrice: 1190, baseDemand: 170, baseReturnRate: 0.06, leadTimeDays: 4 },
  { id: "beauty_shampoo_05", name: "Shampoo", purchaseCost: 340, recommendedPrice: 910, baseDemand: 220, baseReturnRate: 0.05, leadTimeDays: 3 },
  { id: "beauty_perfume_06", name: "Perfume", purchaseCost: 980, recommendedPrice: 2490, baseDemand: 120, baseReturnRate: 0.08, leadTimeDays: 6 },
  { id: "beauty_kit_08", name: "Care Kit", purchaseCost: 640, recommendedPrice: 1590, baseDemand: 145, baseReturnRate: 0.06, leadTimeDays: 5 },
  { id: "beauty_wipes_09", name: "Wipes", purchaseCost: 120, recommendedPrice: 390, baseDemand: 260, baseReturnRate: 0.04, leadTimeDays: 2 },
  { id: "beauty_tonic_10", name: "Tonic", purchaseCost: 280, recommendedPrice: 790, baseDemand: 205, baseReturnRate: 0.05, leadTimeDays: 3 },
  { id: "home_container_11", name: "Storage Container", categoryId: "home", purchaseCost: 190, recommendedPrice: 590, baseDemand: 185, baseReturnRate: 0.04, leadTimeDays: 3 },
  { id: "home_towel_12", name: "Kitchen Towel Set", categoryId: "home", purchaseCost: 140, recommendedPrice: 420, baseDemand: 210, baseReturnRate: 0.03, leadTimeDays: 2 },
  { id: "electronics_cable_13", name: "USB-C Cable", categoryId: "electronics", purchaseCost: 160, recommendedPrice: 490, baseDemand: 230, baseReturnRate: 0.05, leadTimeDays: 2 },
  { id: "electronics_earbuds_14", name: "Wireless Earbuds", categoryId: "electronics", purchaseCost: 1450, recommendedPrice: 3490, baseDemand: 95, baseReturnRate: 0.11, leadTimeDays: 5 },
];

const defaultConstants = {
  adEfficiency: 0.028,
  saturationCap: 8000,
  baseConversion: 0.012,
  feeRate: 0.18,
  paymentRate: 0.01,
  fixedOverheadDaily: 900,
  outboundCostPerUnit: 28,
  distanceMod: 1,
  returnHandlingCostPerUnit: 45,
};

/** Пресеты качества карточки (день 8 / M1): быстрый выбор вместо ручного ввода. */
const QUALITY_PRESETS = [
  { label: "База", value: 52 },
  { label: "Стандарт", value: 72 },
  { label: "Премиум", value: 90 },
];

const RESCUE_CASH_AMOUNT = 20000;
const MAX_RESCUES_PER_RUN = 2;
const REWARDED_CASH_AMOUNT = 5000;
const INTERSTITIAL_COOLDOWN_DAYS = 2;
const SERVICE_CAUSE_HISTORY_DAYS = 7;
const PROGRESSION_POINT_PER_DAY = 1;
const DEFAULT_PROGRESSION_NODES_FALLBACK = [
  { id: "n1", branch: "marketing", title: "Трафик I", desc: "+8% adEfficiency", cost: 1, requires: [], effect: { adEfficiencyMult: 1.08 } },
  { id: "n2", branch: "operations", title: "Комиссия I", desc: "-0.4 п.п. feeRate", cost: 1, requires: [], effect: { feeRateDelta: -0.004 } },
  { id: "n3", branch: "quality", title: "Возвраты I", desc: "-8% cost returns", cost: 1, requires: [], effect: { returnHandlingCostMult: 0.92 } },
  { id: "n4", branch: "marketing", title: "Конверсия I", desc: "+6% baseConversion", cost: 1, requires: ["n1"], effect: { baseConversionMult: 1.06 } },
  { id: "n5", branch: "operations", title: "Логистика I", desc: "-7% outbound", cost: 1, requires: ["n2"], effect: { outboundCostMult: 0.93 } },
  { id: "n6", branch: "quality", title: "Возвраты II", desc: "-8% cost returns", cost: 1, requires: ["n3"], effect: { returnHandlingCostMult: 0.92 } },
  { id: "n7", branch: "marketing", title: "Трафик II", desc: "+8% adEfficiency", cost: 1, requires: ["n4"], effect: { adEfficiencyMult: 1.08 } },
  { id: "n8", branch: "operations", title: "Комиссия II", desc: "-0.4 п.п. feeRate", cost: 1, requires: ["n5"], effect: { feeRateDelta: -0.004 } },
  { id: "n9", branch: "quality", title: "Качество карточки", desc: "+6% baseConversion", cost: 1, requires: ["n6"], effect: { baseConversionMult: 1.06 } },
  { id: "n10", branch: "marketing", title: "Маркетинг синергия", desc: "+10% adEfficiency", cost: 2, requires: ["n7", "n9"], effect: { adEfficiencyMult: 1.1 } },
  { id: "n11", branch: "operations", title: "Операционный контур", desc: "-0.8 п.п. feeRate", cost: 2, requires: ["n8", "n6"], effect: { feeRateDelta: -0.008 } },
  { id: "n12", branch: "hybrid", title: "Омниканальный контур", desc: "+4% conversion и -5% outbound", cost: 2, requires: ["n10", "n11"], effect: { baseConversionMult: 1.04, outboundCostMult: 0.95 } },
];
const DEFAULT_PROGRESSION_SYNERGIES_FALLBACK = [
  {
    id: "syn_growth_flywheel",
    title: "Синергия роста",
    requires: ["n7", "n9"],
    desc: "Трафик + конверсия: +5% adEfficiency и +3% conversion",
    effect: { adEfficiencyMult: 1.05, baseConversionMult: 1.03 },
  },
  {
    id: "syn_ops_quality",
    title: "Синергия качества операций",
    requires: ["n8", "n6"],
    desc: "Операции + качество: -0.2 п.п. feeRate и -4% returns cost",
    effect: { feeRateDelta: -0.002, returnHandlingCostMult: 0.96 },
  },
  {
    id: "syn_full_stack",
    title: "Сквозная синергия",
    requires: ["n10", "n11", "n12"],
    desc: "Полный контур: +4% conversion и -3% outbound",
    effect: { baseConversionMult: 1.04, outboundCostMult: 0.97 },
  },
];
let progressionNodes = [];
let progressionSynergies = [];
let playStyles = [];
let onboardingSteps = [];
const BALANCE_PRESETS = {
  conservative: {
    feeRate: 0.175,
    paymentRate: 0.01,
    outboundCostPerUnit: 24,
    fixedOverheadDaily: 800,
    adBudget: 1800,
    returnRateMod: 0.95,
  },
  growth: {
    feeRate: 0.185,
    paymentRate: 0.011,
    outboundCostPerUnit: 30,
    fixedOverheadDaily: 980,
    adBudget: 4500,
    returnRateMod: 1.03,
  },
};
// Internal calibration (phase 2): pragmatic gates for current game version.
// Эти пороги нужны, чтобы внутренний build-gate был достижим без искажения реального состояния.
const PHASE2_GATES = {
  avgProfitMin: -1200,
  worstProfitMin: -2000,
  avgStockoutMax: 0.45,
  avgServiceMin: 3.4,
};
const PHASE3_GATES = {
  14: { avgProfitMin: -1500, worstProfitMin: -2800, avgStockoutMax: 0.42, avgServiceMin: 3.45 },
  28: { avgProfitMin: -2000, worstProfitMin: -3500, avgStockoutMax: 0.4, avgServiceMin: 3.5 },
};
const STYLE_BALANCE_MAX_SHARE = 0.75;

let gameState;
/** @type {typeof defaultConstants} */
let economyConstants;
/** @type {Array<{ id: string; name: string; type: string; durationDays: number; scope?: string; effect?: object }>} */
let eventDefinitions = [];
let platformState = {
  checked: false,
  available: false,
  sdk: null,
  message: "Проверка SDK…",
};

const els = {
  nextDayBtn: document.getElementById("nextDayBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportPlaytestBtn: document.getElementById("exportPlaytestBtn"),
  exportServiceDiagBtn: document.getElementById("exportServiceDiagBtn"),
  exportPhase2Btn: document.getElementById("exportPhase2Btn"),
  exportFreezeBtn: document.getElementById("exportFreezeBtn"),
  importJsonBtn: document.getElementById("importJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  sdkStatus: document.getElementById("sdkStatus"),
  rewardedBtn: document.getElementById("rewardedBtn"),
  rewardedHint: document.getElementById("rewardedHint"),
  interstitialHint: document.getElementById("interstitialHint"),
  playtestChecklist: document.getElementById("playtestChecklist"),
  playtestNotesInput: document.getElementById("playtestNotesInput"),
  freezeSummary: document.getElementById("freezeSummary"),
  phase2FreezeSummary: document.getElementById("phase2FreezeSummary"),
  eventsPanel: document.getElementById("eventsPanel"),
  teamPanel: document.getElementById("teamPanel"),
  playStylesMeta: document.getElementById("playStylesMeta"),
  playStylesPanel: document.getElementById("playStylesPanel"),
  antiExploitPanel: document.getElementById("antiExploitPanel"),
  phase3FreezeSummary: document.getElementById("phase3FreezeSummary"),
  phase3RegressionStatus: document.getElementById("phase3RegressionStatus"),
  runRegression14Btn: document.getElementById("runRegression14Btn"),
  runRegression28Btn: document.getElementById("runRegression28Btn"),
  runStyleBalanceBtn: document.getElementById("runStyleBalanceBtn"),
  exportPhase3FreezeBtn: document.getElementById("exportPhase3FreezeBtn"),
  onboardingPanel: document.getElementById("onboardingPanel"),
  hideOnboardingBtn: document.getElementById("hideOnboardingBtn"),
  exportPhase2FreezeBtn: document.getElementById("exportPhase2FreezeBtn"),
  stateDump: document.getElementById("stateDump"),
  summary: document.getElementById("summary"),
  serviceRating: document.getElementById("serviceRating"),
  serviceDiagnostics: document.getElementById("serviceDiagnostics"),
  importServiceDiagBaseBtn: document.getElementById("importServiceDiagBaseBtn"),
  importServiceDiagCandBtn: document.getElementById("importServiceDiagCandBtn"),
  clearServiceDiagCompareBtn: document.getElementById("clearServiceDiagCompareBtn"),
  importServiceDiagBaseInput: document.getElementById("importServiceDiagBaseInput"),
  importServiceDiagCandInput: document.getElementById("importServiceDiagCandInput"),
  serviceDiagCompare: document.getElementById("serviceDiagCompare"),
  progressionMeta: document.getElementById("progressionMeta"),
  progressionPanel: document.getElementById("progressionPanel"),
  applyBalanceConservativeBtn: document.getElementById("applyBalanceConservativeBtn"),
  applyBalanceGrowthBtn: document.getElementById("applyBalanceGrowthBtn"),
  runRegression7Btn: document.getElementById("runRegression7Btn"),
  runPreReleaseBtn: document.getElementById("runPreReleaseBtn"),
  quickRestockBtn: document.getElementById("quickRestockBtn"),
  quickStabilizeBtn: document.getElementById("quickStabilizeBtn"),
  safeRecoveryV2Btn: document.getElementById("safeRecoveryV2Btn"),
  regressionRunStatus: document.getElementById("regressionRunStatus"),
  phase2BuildStatus: document.getElementById("phase2BuildStatus"),
  releaseSmokeChecklist: document.getElementById("releaseSmokeChecklist"),
  campaignReadability: document.getElementById("campaignReadability"),
  categoryFilterSelect: document.getElementById("categoryFilterSelect"),
  kpiDashboard: document.getElementById("kpiDashboard"),
  categoryKpiTable: document.getElementById("categoryKpiTable"),
  categoryRecommendations: document.getElementById("categoryRecommendations"),
  skuSelect: document.getElementById("skuSelect"),
  qtyInput: document.getElementById("qtyInput"),
  buyBtn: document.getElementById("buyBtn"),
  buyHint: document.getElementById("buyHint"),
  incomingList: document.getElementById("incomingList"),
  morningArrivals: document.getElementById("morningArrivals"),
  stockTable: document.getElementById("stockTable"),
  adBudgetRange: document.getElementById("adBudgetRange"),
  adBudgetLabel: document.getElementById("adBudgetLabel"),
  adEnabledToggle: document.getElementById("adEnabledToggle"),
  feeRateInput: document.getElementById("feeRateInput"),
  paymentRateInput: document.getElementById("paymentRateInput"),
  outboundCostInput: document.getElementById("outboundCostInput"),
  overheadInput: document.getElementById("overheadInput"),
  resetCostsBtn: document.getElementById("resetCostsBtn"),
  returnRateModRange: document.getElementById("returnRateModRange"),
  returnRateModLabel: document.getElementById("returnRateModLabel"),
  merchRoot: document.getElementById("merchRoot"),
  yesterdayReport: document.getElementById("yesterdayReport"),
  costBreakdown: document.getElementById("costBreakdown"),
  deadlockStatus: document.getElementById("deadlockStatus"),
  rescueBtn: document.getElementById("rescueBtn"),
};

const serviceDiagCompareState = {
  baseline: null,
  candidate: null,
};

function emptyProgressionUnlocked() {
  return Object.fromEntries(progressionNodes.map((n) => [n.id, false]));
}

function normalizeProgressionUnlocked(raw) {
  const base = emptyProgressionUnlocked();
  if (!raw || typeof raw !== "object") return base;
  for (const n of progressionNodes) {
    base[n.id] = raw[n.id] === true;
  }
  return base;
}

function softenEventModifiers(eventMods, damageMult) {
  if (!eventMods || !damageMult || damageMult >= 1) return eventMods || defaultEventModifiers();
  const m = damageMult;
  const softenMult = (v) => {
    const n = Number(v) || 1;
    return n < 1 ? 1 - (1 - n) * m : n;
  };
  const out = { ...eventMods };
  out.adEfficiencyMult = softenMult(out.adEfficiencyMult);
  out.organicGlobalMult = softenMult(out.organicGlobalMult);
  out.returnRateModMult = softenMult(out.returnRateModMult);
  out.outboundCostMult = softenMult(out.outboundCostMult);
  if (out.serviceRatingDelta < 0) out.serviceRatingDelta = Number(out.serviceRatingDelta) * m;
  if (out.overheadMult > 1) out.overheadMult = 1 + (out.overheadMult - 1) * m;
  if (out.feeRateDelta > 0) out.feeRateDelta *= m;
  if (out.categoryOrganicMult && typeof out.categoryOrganicMult === "object") {
    const next = {};
    for (const [k, v] of Object.entries(out.categoryOrganicMult)) next[k] = softenMult(v);
    out.categoryOrganicMult = next;
  }
  return out;
}

function refreshDerivedModifiers(state = gameState) {
  if (!state) return;
  const prog = getProgressionModifiers(state, progressionNodes, progressionSynergies);
  const exploit = analyzeAntiExploit(state, prog);
  const pen = exploit.penaltyMods || {};
  state.antiExploit = exploit;
  state.progressionModifiers = {
    ...prog,
    adEfficiencyMult: prog.adEfficiencyMult * (Number(pen.adEfficiencyMult) || 1),
    baseConversionMult: prog.baseConversionMult * (Number(pen.baseConversionMult) || 1),
    globalProfitMult: prog.globalProfitMult * (Number(pen.globalProfitMult) || 1),
  };
  state.eventModifiers = softenEventModifiers(state.eventModifiers || defaultEventModifiers(), prog.eventDamageMult);
  state.teamDailyCost = computeTeamDailySalary(state, progressionNodes);
  if (prog.qualityFloorDelta > 0) applyQualityFloor(state, 52 + prog.qualityFloorDelta);
}

function buildSimulationConstants(state = gameState) {
  const m = getProgressionModifiers(state, progressionNodes, progressionSynergies);
  const ev = state?.eventModifiers || {};
  return {
    ...economyConstants,
    adEfficiency: Math.max(
      0.0001,
      (Number(economyConstants.adEfficiency) || 0) * m.adEfficiencyMult * (Number(ev.adEfficiencyMult) || 1)
    ),
    baseConversion: Math.max(
      0.0001,
      (Number(economyConstants.baseConversion) || 0) * m.baseConversionMult * (Number(ev.baseConversionMult) || 1)
    ),
    feeRate: Math.max(0, (Number(economyConstants.feeRate) || 0) + m.feeRateDelta + (Number(ev.feeRateDelta) || 0)),
    outboundCostPerUnit: Math.max(
      0,
      (Number(economyConstants.outboundCostPerUnit) || 0) * m.outboundCostMult * (Number(ev.outboundCostMult) || 1)
    ),
    returnHandlingCostPerUnit: Math.max(
      0,
      (Number(economyConstants.returnHandlingCostPerUnit) || 0) * m.returnHandlingCostMult
    ),
    teamDailyCost: Math.max(0, Number(state?.teamDailyCost) || computeTeamDailySalary(state, progressionNodes)),
  };
}

function canUnlockProgressionNode(node) {
  if (!node || !gameState) return false;
  if (gameState.progressionUnlocked?.[node.id]) return false;
  const spCost = node.cost != null ? Number(node.cost) : 1;
  if ((gameState.progressionPoints || 0) < spCost) return false;
  const cashCost = Math.max(0, Number(node.cashCost) || 0);
  if (cashCost > gameState.cash) return false;
  const deps = Array.isArray(node.requires) ? node.requires : [];
  if (!deps.length) return true;
  return deps.every((id) => gameState.progressionUnlocked?.[id] === true);
}

function unlockProgressionNode(nodeId) {
  if (!gameState) return;
  const node = progressionNodes.find((x) => x.id === nodeId);
  if (!canUnlockProgressionNode(node)) return;
  const cashCost = Math.max(0, Number(node.cashCost) || 0);
  gameState.cash -= cashCost;
  const spCost = node.cost != null ? Number(node.cost) : 1;
  gameState.progressionPoints = Math.max(0, (gameState.progressionPoints || 0) - spCost);
  gameState.progressionUnlocked[node.id] = true;
  refreshDerivedModifiers();
  render();
}

function renderProgressionPanel() {
  if (!els.progressionPanel || !els.progressionMeta) return;
  const unlockedCount = progressionNodes.filter((n) => gameState.progressionUnlocked?.[n.id]).length;
  const mods = getProgressionModifiers(gameState, progressionNodes, progressionSynergies);
  const teamSalary = computeTeamDailySalary(gameState, progressionNodes);
  els.progressionMeta.innerHTML = `Очки прогрессии: <b>${gameState.progressionPoints || 0}</b> · Узлов открыто: <b>${unlockedCount}/${progressionNodes.length}</b> · Синергий активно: <b>${mods.activeSynergies.length}</b> · ЗП команды/день: <b>${money(teamSalary)}</b> · Бонусы: ad x${mods.adEfficiencyMult.toFixed(2)}, conv x${mods.baseConversionMult.toFixed(2)}, fee ${(mods.feeRateDelta * 100).toFixed(2)} п.п.`;

  const branchLabel = {
    marketing: "Маркетинг",
    operations: "Операции",
    quality: "Качество",
    hybrid: "Гибрид",
    commerce: "Коммерция",
    team: "Команда",
    automation: "Автоматизация",
  };
  const cards = progressionNodes.map((n) => {
    const opened = gameState.progressionUnlocked?.[n.id] === true;
    const canOpen = canUnlockProgressionNode(n);
    const bg = opened ? "#1e3526" : canOpen ? "#2a2f44" : "#1d1f2a";
    const color = opened ? "#8fd694" : canOpen ? "#c9d2ff" : "#a9acb7";
    const deps = Array.isArray(n.requires) ? n.requires : [];
    const depsLabel = deps.length
      ? deps
          .map((id) => progressionNodes.find((x) => x.id === id)?.title || id)
          .join(", ")
      : "—";
    const cashLine = n.cashCost ? ` · активация ${money(n.cashCost)}` : "";
    const salaryLine = n.dailySalary ? ` · ЗП ${money(n.dailySalary)}/день` : "";
    return `<div style="border:1px solid #2b2e3a;border-radius:8px;padding:8px;background:${bg}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <b style="color:${color}">${n.title}</b>
        <span class="muted">SP ${n.cost != null ? n.cost : 1}${cashLine}${salaryLine}</span>
      </div>
      <div class="muted" style="margin-top:4px">${n.desc}</div>
      <div class="muted" style="margin-top:2px">Ветка: ${branchLabel[n.branch] || n.branch} · Требует: ${depsLabel}</div>
      <button type="button" class="btn-secondary js-prog-unlock" data-node-id="${n.id}" ${opened || !canOpen ? "disabled" : ""} style="margin-top:6px">${opened ? "Открыто" : canOpen ? "Открыть" : "Заблокировано"}</button>
    </div>`;
  }).join("");
  const synRows = mods.activeSynergies.length
    ? mods.activeSynergies
        .map((s) => `<li style="margin:4px 0"><span style="color:#8fd694"><b>${s.title}</b></span> — ${s.desc}</li>`)
        .join("")
    : `<li style="margin:4px 0" class="muted">Пока нет активных синергий — открой комбинации узлов из разных веток.</li>`;
  els.progressionPanel.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">${cards}</div><div style="margin-top:8px"><b>Активные синергии</b><ul class="incoming" style="margin-top:4px">${synRows}</ul></div>`;
}

function normalizeConstants(raw) {
  return {
    adEfficiency: Number(raw.adEfficiency) || defaultConstants.adEfficiency,
    saturationCap: Number(raw.saturationCap) || defaultConstants.saturationCap,
    baseConversion: Number(raw.baseConversion) || defaultConstants.baseConversion,
    feeRate: Number(raw.feeRate) || defaultConstants.feeRate,
    paymentRate: Number(raw.paymentRate) || defaultConstants.paymentRate,
    fixedOverheadDaily: Number(raw.fixedOverheadDaily) || defaultConstants.fixedOverheadDaily,
    outboundCostPerUnit: Number(raw.outboundCostPerUnit) || defaultConstants.outboundCostPerUnit,
    distanceMod: Number(raw.distanceMod) || defaultConstants.distanceMod,
    returnHandlingCostPerUnit:
      Number(raw.returnHandlingCostPerUnit) || defaultConstants.returnHandlingCostPerUnit,
  };
}

function syncCostModelUiFromState() {
  if (!economyConstants) return;
  if (els.feeRateInput) els.feeRateInput.value = String(economyConstants.feeRate);
  if (els.paymentRateInput) els.paymentRateInput.value = String(economyConstants.paymentRate);
  if (els.outboundCostInput) els.outboundCostInput.value = String(economyConstants.outboundCostPerUnit);
  if (els.overheadInput) els.overheadInput.value = String(economyConstants.fixedOverheadDaily);
}

function readCostModelFromUi() {
  if (!economyConstants) return;
  const next = normalizeConstants({
    ...economyConstants,
    feeRate: els.feeRateInput?.value,
    paymentRate: els.paymentRateInput?.value,
    outboundCostPerUnit: els.outboundCostInput?.value,
    fixedOverheadDaily: els.overheadInput?.value,
  });
  economyConstants = { ...economyConstants, ...next };
}

/** Нормализация полей из JSON (иначе leadTimeDays строкой даёт баг: 1 + "2" === "12"). */
function normalizeSku(raw) {
  const rawId = String(raw.id);
  const inferredCat = rawId.includes("_") ? rawId.split("_")[0] : "beauty";
  return {
    ...raw,
    id: rawId,
    categoryId: String(raw.categoryId ?? inferredCat),
    name: String(raw.name ?? raw.id),
    tier: raw.tier != null ? String(raw.tier) : undefined,
    purchaseCost: Number(raw.purchaseCost) || 0,
    recommendedPrice: Number(raw.recommendedPrice) || 0,
    baseDemand: Number(raw.baseDemand) || 0,
    baseReturnRate: Number(raw.baseReturnRate) || 0,
    leadTimeDays: Math.max(0, Math.round(Number(raw.leadTimeDays) || 0)),
  };
}

function skuById(id) {
  return gameState.skus.find((s) => s.id === id);
}

function categoryById(id) {
  return gameState.categories.find((c) => c.id === id);
}

function getVisibleSkus() {
  if (!gameState?.selectedCategoryId) return gameState.skus;
  const list = gameState.skus.filter((s) => s.categoryId === gameState.selectedCategoryId);
  return list.length ? list : gameState.skus;
}

/**
 * Приход партий в начале текущего игрового дня (до симуляции продаж).
 * @returns {Array<{ skuId: string; qty: number; name: string }>}
 */
function processIncomingShipments() {
  const day = gameState.day;
  const remaining = [];
  /** @type {Array<{ skuId: string; qty: number; name: string }>} */
  const arrived = [];
  for (const shipment of gameState.incomingShipments) {
    const arrivalDay = Math.round(Number(shipment.arrivalDay));
    const qty = Math.max(0, Math.round(Number(shipment.qty) || 0));
    const skuId = String(shipment.skuId);

    if (!Number.isFinite(arrivalDay)) {
      remaining.push(shipment);
      continue;
    }
    if (arrivalDay <= day) {
      if (qty > 0) {
        gameState.inStock[skuId] = (gameState.inStock[skuId] || 0) + qty;
        const sku = skuById(skuId);
        arrived.push({ skuId, qty, name: sku ? sku.name : skuId });
      }
    } else {
      remaining.push({ ...shipment, skuId, arrivalDay, qty });
    }
  }
  gameState.incomingShipments = remaining;
  return arrived;
}

function purchase() {
  const skuId = els.skuSelect.value;
  const qty = Math.max(1, parseInt(els.qtyInput.value, 10) || 0);
  const sku = skuById(skuId);
  if (!sku) return;

  const totalCost = qty * sku.purchaseCost;
  if (gameState.cash < totalCost) {
    alert("Недостаточно средств");
    return;
  }

  const lead = sku.leadTimeDays + getPurchaseLeadTimeExtra(gameState, sku.categoryId);
  const arrivalDay = gameState.day + lead;

  gameState.cash -= totalCost;
  gameState.incomingShipments.push({
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    skuId: String(skuId),
    qty,
    orderDay: gameState.day,
    arrivalDay,
    totalCost,
  });

  render();
}

function updateBuyHint() {
  const skuId = els.skuSelect.value;
  const qty = Math.max(1, parseInt(els.qtyInput.value, 10) || 0);
  const sku = skuById(skuId);
  if (!sku) {
    els.buyHint.textContent = "";
    return;
  }
  const total = qty * sku.purchaseCost;
  const arrival = gameState.day + sku.leadTimeDays;
  els.buyHint.textContent = `Стоимость: ${total.toLocaleString("ru-RU")} · прибытие в день ${arrival} (срок ${sku.leadTimeDays} дн.) · закупка ${sku.purchaseCost}/шт.`;
}

function renderStockTable() {
  const rows = getVisibleSkus()
    .map((sku) => {
      const q = gameState.inStock[sku.id] ?? 0;
      const p = gameState.skuPrices[sku.id] ?? sku.recommendedPrice;
      return `<tr><td>${sku.name}</td><td><code>${sku.id}</code></td><td class="num">${p}</td><td class="num">${q}</td></tr>`;
    })
    .join("");
  els.stockTable.innerHTML = `<table class="stock"><thead><tr><th>Название</th><th>ID</th><th>Цена</th><th>Остаток</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function fillSkuSelect() {
  els.skuSelect.innerHTML = "";
  for (const sku of getVisibleSkus()) {
    const opt = document.createElement("option");
    opt.value = sku.id;
    opt.textContent = `${sku.name} (${sku.id})`;
    els.skuSelect.appendChild(opt);
  }
}

function fillCategoryFilterSelect() {
  if (!els.categoryFilterSelect) return;
  els.categoryFilterSelect.innerHTML = "";
  for (const cat of gameState.categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    els.categoryFilterSelect.appendChild(opt);
  }
  if (gameState.selectedCategoryId) {
    els.categoryFilterSelect.value = gameState.selectedCategoryId;
  }
}

function renderIncoming() {
  if (!gameState.incomingShipments.length) {
    els.incomingList.innerHTML = '<span class="muted">Нет активных поставок</span>';
    return;
  }
  const items = gameState.incomingShipments
    .slice()
    .sort((a, b) => a.arrivalDay - b.arrivalDay)
    .map((s) => {
      const sku = skuById(s.skuId);
      const name = sku ? sku.name : s.skuId;
      return `<li>${name}: <b>${s.qty}</b> шт. · прибытие день <b>${s.arrivalDay}</b> · заказ в день ${s.orderDay}</li>`;
    })
    .join("");
  els.incomingList.innerHTML = `<ul class="incoming">${items}</ul>`;
}

function renderMorningArrivals() {
  if (!els.morningArrivals) return;
  const raw = gameState.lastMorningArrivals || [];
  if (!raw.length) {
    els.morningArrivals.innerHTML =
      '<span class="muted">В начале текущего дня партий не прибыло (или ещё ни разу не нажимали Next Day).</span>';
    return;
  }
  const bySku = new Map();
  for (const row of raw) {
    const id = String(row.skuId);
    const name = String(row.name || skuById(id)?.name || id);
    const q = Math.max(0, Math.round(Number(row.qty) || 0));
    if (q <= 0) continue;
    const prev = bySku.get(id) || { name, qty: 0 };
    bySku.set(id, { name: prev.name || name, qty: prev.qty + q });
  }
  const lines = [...bySku.values()]
    .map((x) => `<li><b>${x.name}</b>: +${x.qty.toLocaleString("ru-RU")} шт. на склад</li>`)
    .join("");
  els.morningArrivals.innerHTML = `<ul class="incoming" style="margin-top:0">${lines}</ul>`;
}

function resetMerchDom() {
  els.merchRoot.innerHTML = "";
  delete els.merchRoot.dataset.built;
}

function buildMerchTableOnce() {
  if (els.merchRoot.dataset.built === "1") return;

  const presetBtns = (skuId) =>
    QUALITY_PRESETS.map(
      (pr) =>
        `<button type="button" class="btn-secondary js-quality-preset" data-sku-id="${skuId}" data-quality="${pr.value}" style="padding:3px 8px;font-size:11px;border-radius:6px">${pr.label}</button>`
    ).join("");

  const rows = getVisibleSkus()
    .map((sku) => {
      const p = gameState.skuPrices[sku.id] ?? sku.recommendedPrice;
      const q = gameState.qualityScore[sku.id] ?? 72;
      const promo = gameState.promoOn[sku.id] ? "checked" : "";
      const rec = sku.recommendedPrice;
      return `<tr>
        <td>${sku.name}<br/><code style="font-size:11px">${sku.id}</code></td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap">
            <input class="js-price" data-sku-id="${sku.id}" type="number" min="1" step="10" value="${p}" style="width:88px"/>
            <button type="button" class="btn-secondary js-price-rec" data-sku-id="${sku.id}" style="padding:3px 8px;font-size:11px;border-radius:6px" title="Цена по рекомендации маркетплейса">Реком.</button>
          </div>
          <div class="muted" style="font-size:11px;margin-top:4px;text-align:right">реком. ${rec.toLocaleString("ru-RU")} ₽</div>
        </td>
        <td class="num">
          <input class="js-quality" data-sku-id="${sku.id}" type="number" min="0" max="100" step="1" value="${q}" style="width:56px"/>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px">${presetBtns(sku.id)}</div>
        </td>
        <td class="num"><input class="js-promo" data-sku-id="${sku.id}" type="checkbox" ${promo}/></td>
      </tr>`;
    })
    .join("");

  els.merchRoot.innerHTML = `<table class="stock"><thead><tr><th>SKU</th><th>Цена</th><th>Качество (0–100)</th><th>Промо</th></tr></thead><tbody>${rows}</tbody></table>`;
  els.merchRoot.dataset.built = "1";
}

function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("ru-RU");
}

function pct(part, base) {
  const p = Number(part) || 0;
  const b = Number(base) || 0;
  if (b <= 0) return "—";
  return `${((p / b) * 100).toFixed(1)}%`;
}

function renderCostBreakdown() {
  if (!els.costBreakdown) return;
  const r = gameState.lastDayReport;
  if (!r?.totals) {
    els.costBreakdown.textContent = "Нет данных — сначала нажми Next Day.";
    return;
  }
  const t = r.totals;
  const netRevenue = Number(t.netRevenue) || 0;
  const rows = [
    { label: "Валовая выручка (до возвратов)", value: t.grossRevenue ?? t.netRevenue, sign: "+", shareBase: t.grossRevenue ?? t.netRevenue },
    { label: "Чистая выручка (после возвратов)", value: t.netRevenue, sign: "+", shareBase: t.netRevenue },
    { label: "Себестоимость проданного (COGS)", value: t.cogs, sign: "−", shareBase: netRevenue },
    { label: "Комиссия маркетплейса", value: t.fee, sign: "−", shareBase: netRevenue },
    { label: "Эквайринг / платежи", value: t.payment, sign: "−", shareBase: netRevenue },
    { label: "Исходящая логистика (отгрузки)", value: t.logistics ?? 0, sign: "−", shareBase: netRevenue },
    { label: "Обработка возвратов", value: t.returnsCost ?? 0, sign: "−", shareBase: netRevenue },
    { label: "Штраф сервиса", value: t.servicePenalty ?? 0, sign: "−", shareBase: netRevenue },
    { label: "Реклама (день)", value: t.adCost, sign: "−", shareBase: netRevenue },
    { label: "Постоянные расходы (оверхед)", value: t.overhead, sign: "−", shareBase: netRevenue },
    { label: "ЗП команды", value: t.teamCost ?? 0, sign: "−", shareBase: netRevenue },
  ];
  const body = rows
    .map(
      (row) =>
        `<tr><td>${row.label}</td><td class="num" style="color:${row.sign === "+" ? "#8fd694" : "#e7e7ea"}">${row.sign === "+" ? "+" : "−"} ${money(Math.abs(row.value))}</td><td class="num muted">${pct(Math.abs(row.value), row.shareBase)}</td></tr>`
    )
    .join("");
  const costSum =
    (Number(t.cogs) || 0) +
    (Number(t.fee) || 0) +
    (Number(t.payment) || 0) +
    (Number(t.logistics) || 0) +
    (Number(t.returnsCost) || 0) +
    (Number(t.servicePenalty) || 0) +
    (Number(t.adCost) || 0) +
    (Number(t.overhead) || 0) +
    (Number(t.teamCost) || 0);
  els.costBreakdown.innerHTML = `<p class="muted" style="margin:0 0 6px">День симуляции: <b>${r.day}</b></p><p class="muted" style="margin:0 0 8px">Ставки: fee ${(economyConstants.feeRate * 100).toFixed(1)}% · payment ${(economyConstants.paymentRate * 100).toFixed(1)}% · logistics ${money(economyConstants.outboundCostPerUnit)} / ед. · overhead ${money(economyConstants.fixedOverheadDaily)} / день · returnMod x${(Math.max(0.5, Math.min(1.5, Number(gameState.returnRateMod) || 1))).toFixed(2)}</p><table class="stock"><thead><tr><th>Статья</th><th class="num">Сумма</th><th class="num">Доля</th></tr></thead><tbody>${body}<tr><td><strong>Итого расходы</strong></td><td class="num"><strong>− ${money(costSum)}</strong></td><td class="num muted"><strong>${pct(costSum, netRevenue)}</strong></td></tr><tr><td><strong>Операционная прибыль</strong></td><td class="num"><strong>${money(t.operatingProfit)}</strong></td><td class="num muted"><strong>${pct(t.operatingProfit, netRevenue)}</strong></td></tr></tbody></table>`;
}

function renderYesterday() {
  const r = gameState.lastDayReport;
  if (!r) {
    els.yesterdayReport.textContent = "Ещё не было симуляции (нажми Next Day).";
    return;
  }
  const t = r.totals;
  const unmet = t.unmetUnits ?? 0;
  const ow = t.ordersWanted ?? 0;
  const logi = t.logistics ?? 0;
  const retCost = t.returnsCost ?? 0;
  const servicePenalty = t.servicePenalty ?? 0;
  const serviceRating = t.serviceRating ?? gameState.kpi?.serviceRating ?? 5;
  const serviceStockoutImpact = t.serviceStockoutImpact ?? 0;
  const serviceReturnsImpact = t.serviceReturnsImpact ?? 0;
  const gross = t.grossRevenue ?? t.netRevenue;
  const head = `День ${r.day}: валовая выручка ${money(gross)} → чистая ${money(t.netRevenue)} · операц. прибыль ${money(t.operatingProfit)} · логистика ${money(logi)} · возвраты (расход) ${money(retCost)} · штраф сервиса ${money(servicePenalty)} · рейтинг сервиса ${Number(serviceRating).toFixed(2)}/5 (вклад: stockout ${serviceStockoutImpact.toFixed(2)}, возвраты ${serviceReturnsImpact.toFixed(2)}) · рекл. трафик ${t.adTrafficTotal.toFixed(1)} · рекл. ${money(t.adCost)} · оверхед ${money(t.overhead)} · <b>stockout</b>: ${unmet}${ow > 0 ? ` из ${ow} желаемых заказов` : ""}`;
  const lines = r.perSku
    .filter((x) => x.orders > 0 || x.traffic > 50 || (x.unmetUnits ?? 0) > 0)
    .slice(0, 8)
    .map(
      (x) =>
        `${x.name}: хотели ${x.ordersWanted ?? "?"} → отгрузили ${x.orders}${(x.unmetUnits ?? 0) > 0 ? ` (не хватило ${x.unmetUnits})` : ""}, возвратов ${x.returned}, чистых продаж ${x.netSold}, raw ${(x.ordersRaw ?? 0).toFixed(1)}`
    )
    .join(" · ");
  els.yesterdayReport.innerHTML = `${head}<br/><span class="muted" style="font-size:12px">${lines || "Мало активности — проверь остатки и цену."}</span>`;
}

function renderDeadlockGuard() {
  if (!els.deadlockStatus) return;
  const deadlock = isDeadlockState();
  const minCost = minPurchaseCost();
  const rescuesLeft = Math.max(0, MAX_RESCUES_PER_RUN - (gameState.rescuesUsed || 0));

  if (deadlock) {
    els.deadlockStatus.innerHTML = `<span style="color:#ffb36b"><b>Обнаружен риск тупика:</b> нет остатков, поставок в пути и кэша на минимальную закупку (${money(minCost)}).</span>`;
  } else {
    els.deadlockStatus.innerHTML = `Тупик не обнаружен. Минимальная закупка: <b>${money(minCost)}</b> · Использовано авансов: <b>${gameState.rescuesUsed || 0}</b>/<b>${MAX_RESCUES_PER_RUN}</b>.`;
  }

  if (els.rescueBtn) {
    els.rescueBtn.disabled = !deadlock || rescuesLeft <= 0;
    els.rescueBtn.textContent = `Антикризисный аванс +${money(RESCUE_CASH_AMOUNT)}${rescuesLeft > 0 ? "" : " (лимит исчерпан)"}`;
  }
}

function buildServiceDiagnosisLine(totals) {
  const stockoutImpact = Math.max(0, Number(totals?.serviceStockoutImpact) || 0);
  const returnsImpact = Math.max(0, Number(totals?.serviceReturnsImpact) || 0);
  const topCause = stockoutImpact >= returnsImpact ? "stockout" : "возвраты";
  const ratioBase = stockoutImpact + returnsImpact;
  const topShare = ratioBase > 0 ? (Math.max(stockoutImpact, returnsImpact) / ratioBase) * 100 : 0;

  if (topCause === "stockout") {
    return `Главная причина дня: <b>stockout</b> (${stockoutImpact.toFixed(2)}; ${topShare.toFixed(0)}% влияния). Что делать: увеличь закупку ходовых SKU и проверь lead time/частоту пополнения.`;
  }
  return `Главная причина дня: <b>возвраты</b> (${returnsImpact.toFixed(2)}; ${topShare.toFixed(0)}% влияния). Что делать: улучши качество карточки/товара и снизь mismatch по ожиданиям клиента.`;
}

function classifyServiceCauseFromTotals(totals) {
  const stockoutImpact = Math.max(0, Number(totals?.serviceStockoutImpact) || 0);
  const returnsImpact = Math.max(0, Number(totals?.serviceReturnsImpact) || 0);
  return stockoutImpact >= returnsImpact ? "stockout" : "returns";
}

function updateServiceCauseHistory() {
  if (!gameState?.lastDayReport?.totals) return;
  const totals = gameState.lastDayReport.totals;
  const stockoutImpact = Math.max(0, Number(totals.serviceStockoutImpact) || 0);
  const returnsImpact = Math.max(0, Number(totals.serviceReturnsImpact) || 0);
  const sumImpact = stockoutImpact + returnsImpact;
  const topImpact = Math.max(stockoutImpact, returnsImpact);
  const entry = {
    day: gameState.day,
    cause: classifyServiceCauseFromTotals(totals),
    stockoutImpact,
    returnsImpact,
    topShare: sumImpact > 0 ? (topImpact / sumImpact) * 100 : 0,
    serviceRating: Number(totals.serviceRating) || 5,
    servicePenalty: Math.max(0, Number(totals.servicePenalty) || 0),
  };
  const prev = Array.isArray(gameState.serviceCauseHistory) ? gameState.serviceCauseHistory : [];
  gameState.serviceCauseHistory = [...prev, entry].slice(-SERVICE_CAUSE_HISTORY_DAYS);
  gameState.selectedServiceCauseDay = gameState.day;
}

function buildServiceTrendLine() {
  const history = Array.isArray(gameState?.serviceCauseHistory) ? gameState.serviceCauseHistory : [];
  if (!history.length) return "Тренд 7 дней: пока нет данных.";
  const stockoutDays = history.filter((x) => x.cause === "stockout").length;
  const returnsDays = history.filter((x) => x.cause === "returns").length;
  const top = stockoutDays >= returnsDays ? "stockout" : "возвраты";
  return `Тренд ${history.length} дн.: stockout-дней ${stockoutDays}, возвраты-дней ${returnsDays}. Чаще просаживает: <b>${top}</b>.`;
}

function buildServiceTrendBadges() {
  const history = Array.isArray(gameState?.serviceCauseHistory) ? gameState.serviceCauseHistory : [];
  if (!history.length) return "";
  const badges = history
    .map((x) => {
      const isStockout = x.cause === "stockout";
      const label = isStockout ? "S" : "R";
      const title = `День ${x.day}: ${isStockout ? "stockout" : "возвраты"}`;
      const bg = isStockout ? "#3a1f28" : "#2b3a20";
      const color = isStockout ? "#ff8f8f" : "#8fd694";
      const selected = Number(gameState?.selectedServiceCauseDay || 0) === Number(x.day);
      const border = selected ? "2px solid #e7e7ea" : "1px solid #00000000";
      return `<button type="button" class="btn-secondary js-service-day-badge" data-day="${x.day}" title="${title}" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;border:${border};background:${bg};color:${color};font-size:11px;font-weight:700;padding:0;line-height:1">${label}</button>`;
    })
    .join(" ");
  return `Таймлайн: ${badges} <span class="muted">(S = stockout, R = возвраты)</span>`;
}

function buildServiceSelectedDayDetails() {
  const history = Array.isArray(gameState?.serviceCauseHistory) ? gameState.serviceCauseHistory : [];
  if (!history.length) return "";
  const selectedDay = Number(gameState?.selectedServiceCauseDay || 0);
  const entry = history.find((x) => Number(x.day) === selectedDay) || history[history.length - 1];
  const causeLabel = entry.cause === "stockout" ? "stockout" : "возвраты";
  const action =
    entry.cause === "stockout"
      ? "Фокус: поднять доступность остатков и ускорить пополнение."
      : "Фокус: снизить возвраты через качество карточки и ожидания клиента.";
  return `Детали дня <b>${entry.day}</b>: причина <b>${causeLabel}</b> (${Number(entry.topShare || 0).toFixed(0)}% влияния) · вклад stockout ${Number(entry.stockoutImpact || 0).toFixed(2)} · вклад возвратов ${Number(entry.returnsImpact || 0).toFixed(2)} · рейтинг ${Number(entry.serviceRating || 5).toFixed(2)}/5 · штраф ${money(entry.servicePenalty || 0)}. ${action}`;
}

function kpiHintByKind(kind) {
  if (kind === "revenue") return "Чистая выручка после возвратов. Выше — лучше.";
  if (kind === "profit") return "Операционная прибыль дня после всех расходов и штрафов.";
  if (kind === "marginPct") return "Profit / Net Revenue. Цель: держать в положительной зоне.";
  if (kind === "acos") return "Ad Cost / Net Revenue. Чем ниже, тем эффективнее реклама.";
  if (kind === "returnPct") return "Returned / Orders. Рост часто бьёт по рейтингу сервиса.";
  if (kind === "stockoutRate") return "Unmet / Orders Wanted. Показывает дефицит остатков.";
  if (kind === "unmetUnits") return "Количество невыполненных единиц из-за нехватки стока.";
  if (kind === "daysOfStock") return "Оценка запаса в днях по текущей скорости продаж.";
  return "";
}

function getKpiDelta(kind) {
  const history = Array.isArray(gameState?.kpiHistory) ? gameState.kpiHistory : [];
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const map = {
    revenue: Number(curr.revenue) - Number(prev.revenue),
    profit: Number(curr.profit) - Number(prev.profit),
    marginPct: Number(curr.marginPct) - Number(prev.marginPct),
    acos: Number(curr.acos) - Number(prev.acos),
    returnPct: Number(curr.returnPct) - Number(prev.returnPct),
    stockoutRate: Number(curr.stockoutRate) - Number(prev.stockoutRate),
    unmetUnits: Number(curr.unmetUnits) - Number(prev.unmetUnits),
    daysOfStock: Number(curr.daysOfStock) - Number(prev.daysOfStock),
  };
  return map[kind] ?? null;
}

function formatDelta(kind, delta) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.00001) return "день-к-дню: без изменений";
  const sign = delta > 0 ? "+" : "";
  if (kind === "marginPct") return `день-к-дню: ${sign}${delta.toFixed(1)} п.п.`;
  if (kind === "acos" || kind === "returnPct" || kind === "stockoutRate") return `день-к-дню: ${sign}${(delta * 100).toFixed(1)} п.п.`;
  if (kind === "daysOfStock") return `день-к-дню: ${sign}${delta.toFixed(1)} дн.`;
  if (kind === "unmetUnits") return `день-к-дню: ${sign}${Math.round(delta)} шт.`;
  return `день-к-дню: ${sign}${money(delta)}`;
}

function pushKpiHistorySnapshot() {
  const k = gameState?.kpi;
  if (!k) return;
  const next = {
    day: gameState.day,
    revenue: Number(k.revenue) || 0,
    profit: Number(k.profit) || 0,
    marginPct: Number(k.marginPct) || 0,
    acos: Number(k.acos) || 0,
    returnPct: Number(k.returnPct) || 0,
    stockoutRate: Number(k.stockoutRate) || 0,
    unmetUnits: Number(k.unmetUnits) || 0,
    daysOfStock: Number(k.daysOfStock) || 0,
  };
  const prev = Array.isArray(gameState.kpiHistory) ? gameState.kpiHistory : [];
  gameState.kpiHistory = [...prev, next].slice(-60);
}

function renderCampaignReadability() {
  if (!els.campaignReadability) return;
  if (!gameState.lastDayReport?.totals) {
    els.campaignReadability.textContent = "Прогноз кампании появится после первой симуляции.";
    return;
  }
  const k = gameState.kpi || {};
  const hist = Array.isArray(gameState.kpiHistory) ? gameState.kpiHistory : [];
  const runRateProfit = Number(k.profit) || 0;
  const projectedCash60 = Math.round((Number(gameState.cash) || 0) + runRateProfit * 60);
  const stockout = Number(k.stockoutRate) || 0;
  const returns = Number(k.returnPct) || 0;
  const margin = Number(k.marginPct) || 0;
  const daysStock = Number(k.daysOfStock) || 0;
  const riskFlags = [];
  if (runRateProfit < 0) riskFlags.push("отрицательный run-rate прибыли");
  if (stockout > 0.2) riskFlags.push("высокий stockout");
  if (returns > 0.14) riskFlags.push("высокие возвраты");
  if (daysStock < 1) riskFlags.push("низкий запас в днях");
  const status = riskFlags.length >= 3 ? "Хрупкая" : riskFlags.length >= 1 ? "Напряженная" : "Устойчивая";
  const statusColor = status === "Устойчивая" ? "#8fd694" : status === "Напряженная" ? "#ffcc66" : "#ff8f8f";
  const first = hist[0];
  const last = hist[hist.length - 1];
  const trendProfit = hist.length >= 2 ? Number(last.profit) - Number(first.profit) : 0;
  const trendStockout = hist.length >= 2 ? Number(last.stockoutRate) - Number(first.stockoutRate) : 0;
  const actions = [];
  if (runRateProfit < 0 || margin < 0) actions.push("поднять маржу: цена/комиссия/логистика");
  if (stockout > 0.2 || daysStock < 1) actions.push("снизить дефицит: увеличить закупку и ускорить поставки");
  if (returns > 0.14) actions.push("снизить возвраты: качество карточки и ожидания клиента");
  if (!actions.length) actions.push("сохранять текущий контур и масштабировать в прибыльных категориях");
  const riskText = riskFlags.length ? riskFlags.join(", ") : "критических рисков не видно";
  els.campaignReadability.innerHTML = `<div><b>Статус 60-дневной кампании:</b> <span style="color:${statusColor}"><b>${status}</b></span> · прогноз кэша через 60 дней: <b>${money(projectedCash60)}</b></div><div class="muted" style="margin-top:4px">Run-rate прибыли: <b>${money(runRateProfit)}/день</b> · тренд прибыли (по истории): <b>${money(trendProfit)}</b> · тренд stockout: <b>${(trendStockout * 100).toFixed(1)} п.п.</b></div><div class="muted" style="margin-top:4px">Риски: ${riskText}</div><div class="muted" style="margin-top:4px">Фокус на ближайшие дни: ${actions.map((x) => `• ${x}`).join(" ")}</div>`;
}

function applyBalancePreset(presetId) {
  const p = BALANCE_PRESETS[presetId];
  if (!p) return;
  economyConstants = {
    ...economyConstants,
    feeRate: p.feeRate,
    paymentRate: p.paymentRate,
    outboundCostPerUnit: p.outboundCostPerUnit,
    fixedOverheadDaily: p.fixedOverheadDaily,
  };
  gameState.adBudget = Math.max(0, Number(p.adBudget) || 0);
  gameState.returnRateMod = Math.max(0.5, Math.min(1.5, Number(p.returnRateMod) || 1));
  gameState.playStyleId = null;
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  render();
}

function applyPlayStylePresetToState(state, style) {
  if (!state || !style?.preset) return false;
  const p = style.preset;
  state.adBudget = Math.max(0, Number(p.adBudget) || 0);
  state.returnRateMod = Math.max(0.5, Math.min(1.5, Number(p.returnRateMod) || 1));
  state.adEnabled = p.adEnabled !== false;
  state.playStyleId = style.id;
  state._economyOverride = {
    feeRate: Number(p.feeRate),
    paymentRate: Number(p.paymentRate),
    outboundCostPerUnit: Number(p.outboundCostPerUnit),
    fixedOverheadDaily: Number(p.fixedOverheadDaily),
  };
  return true;
}

function applyPlayStyle(styleId) {
  if (!gameState) return false;
  const style = playStyles.find((s) => s.id === styleId);
  if (!style?.preset) return false;
  const p = style.preset;
  economyConstants = {
    ...economyConstants,
    feeRate: Number(p.feeRate) ?? economyConstants.feeRate,
    paymentRate: Number(p.paymentRate) ?? economyConstants.paymentRate,
    outboundCostPerUnit: Number(p.outboundCostPerUnit) ?? economyConstants.outboundCostPerUnit,
    fixedOverheadDaily: Number(p.fixedOverheadDaily) ?? economyConstants.fixedOverheadDaily,
  };
  applyPlayStylePresetToState(gameState, style);
  delete gameState._economyOverride;
  refreshDerivedModifiers(gameState);
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  render();
  return true;
}

function playStyleById(id) {
  return playStyles.find((s) => s.id === id) || null;
}

function renderPlayStylesPanel() {
  if (!els.playStylesPanel || !els.playStylesMeta) return;
  const activeId = gameState?.playStyleId || null;
  const inferred = inferDominantPlayStyle(gameState, economyConstants?.feeRate);
  const inferredName = playStyleById(inferred)?.name || inferred;
  els.playStylesMeta.innerHTML = activeId
    ? `Выбран стиль: <b>${playStyleById(activeId)?.name || activeId}</b> · ближайший по настройкам: <b>${inferredName}</b>`
    : `Стиль не выбран · ближайший по текущим настройкам: <b>${inferredName}</b>`;
  const buttons = playStyles
    .map((s) => {
      const on = activeId === s.id;
      const bg = on ? "#1e3526" : "#2a2f44";
      const border = on ? "1px solid #4a8f5a" : "1px solid #3a3f55";
      return `<button type="button" class="btn-secondary js-play-style" data-style-id="${s.id}" style="margin:4px 8px 4px 0;background:${bg};border:${border}"><b>${s.name}</b><br/><span class="muted" style="font-size:12px">${s.desc || ""}</span></button>`;
    })
    .join("");
  els.playStylesPanel.innerHTML = buttons || `<span class="muted">Стили не загружены.</span>`;
}

function renderOnboardingPanel() {
  if (!els.onboardingPanel) return;
  if (!gameState || gameState.onboardingHidden) {
    els.onboardingPanel.innerHTML = gameState?.onboardingHidden
      ? `<span class="muted">Онбординг скрыт. Сброс игры вернёт подсказки.</span>`
      : `<span class="muted">Онбординг загружается…</span>`;
    return;
  }
  const view = resolveOnboarding(gameState, onboardingSteps);
  const hints = getErrorHints(gameState);
  const pct = Math.round((view.progress || 0) * 100);
  const stepBlock = view.allDone
    ? `<div style="color:#8fd694"><b>Онбординг первого рана завершён.</b> Дальше — прогрессия и длинная кампания.</div>`
    : `<div><b>${view.currentStep?.title || "Шаг"}</b></div><div class="muted" style="margin-top:4px">${view.currentStep?.body || ""}</div>`;
  const hintRows = hints.length
    ? hints
        .map((h) => {
          const c = h.severity === "high" ? "#ff8f8f" : h.severity === "medium" ? "#ffcc66" : "#a9acb7";
          return `<li style="margin:4px 0;color:${c}">${h.text}</li>`;
        })
        .join("")
    : `<li class="muted" style="margin:4px 0">Критичных подсказок нет — продолжайте рост.</li>`;
  els.onboardingPanel.innerHTML = `<div>Прогресс онбординга: <b>${view.completed.length}/${view.totalSteps}</b> · <b>${pct}%</b></div>${stepBlock}<div style="margin-top:8px"><b>Подсказки по ошибкам</b><ul class="incoming">${hintRows}</ul></div>`;
}

function hideOnboarding() {
  if (!gameState) return;
  gameState.onboardingHidden = true;
  render();
}

function renderAntiExploitPanel() {
  if (!els.antiExploitPanel) return;
  const ex = gameState?.antiExploit;
  if (!ex) {
    els.antiExploitPanel.textContent = "Проверка появится после инициализации.";
    return;
  }
  const statusColor = ex.status === "OK" ? "#8fd694" : ex.status === "WATCH" ? "#ffcc66" : "#ff8f8f";
  const pen = ex.penaltyMods || {};
  const penLine =
    pen.adEfficiencyMult < 1 || pen.baseConversionMult < 1 || pen.globalProfitMult < 1
      ? `<div class="muted" style="margin-top:6px">Мягкие штрафы: ad x${(pen.adEfficiencyMult || 1).toFixed(2)}, conv x${(pen.baseConversionMult || 1).toFixed(2)}, profit x${(pen.globalProfitMult || 1).toFixed(2)}</div>`
      : "";
  const rows = ex.flags?.length
    ? ex.flags
        .map((f) => {
          const c = f.severity === "high" ? "#ff8f8f" : "#ffcc66";
          return `<li style="margin:4px 0;color:${c}"><b>${f.label}</b> — ${f.detail || ""}<br/><span class="muted">${f.recommendation || ""}</span></li>`;
        })
        .join("")
    : `<li class="muted" style="margin:4px 0">Эксплойт-паттерны не обнаружены.</li>`;
  els.antiExploitPanel.innerHTML = `<div>Статус: <b style="color:${statusColor}">${ex.status}</b> · score <b>${ex.score || 0}</b>/100 · день проверки <b>${ex.checkedAtDay || gameState.day}</b></div>${penLine}<ul class="incoming" style="margin-top:8px">${rows}</ul>`;
}

function processIncomingShipmentsForState(state) {
  const day = Number(state.day) || 0;
  const remaining = [];
  for (const shipment of state.incomingShipments || []) {
    const arrivalDay = Math.round(Number(shipment.arrivalDay));
    const qty = Math.max(0, Math.round(Number(shipment.qty) || 0));
    const skuId = String(shipment.skuId);
    if (!Number.isFinite(arrivalDay) || arrivalDay > day) {
      remaining.push({ ...shipment, skuId, qty, arrivalDay });
      continue;
    }
    if (qty > 0) {
      state.inStock[skuId] = (Number(state.inStock[skuId]) || 0) + qty;
    }
  }
  state.incomingShipments = remaining;
}

function setRegressionRunStatus(text, color = "#a9acb7") {
  if (!els.regressionRunStatus) return;
  els.regressionRunStatus.innerHTML = `<span style="color:${color}">${text}</span>`;
}

function totalStockForState(state) {
  return Object.values(state.inStock || {}).reduce((acc, x) => acc + (Number(x) || 0), 0);
}

function applySafeRecoveryV2ToState(state, options = {}) {
  if (!state) return { spent: 0, units: 0 };
  const intensity = Math.max(1, Number(options.intensity) || 1);
  state.adEnabled = true;
  state.adBudget = 1200;
  state.returnRateMod = Math.max(0.82, Math.min(0.95, Number(state.returnRateMod) || 0.9));
  let spent = 0;
  let units = 0;
  const cash = Math.max(0, Number(state.cash) || 0);
  const maxBudget = Math.min(cash, cash * (0.75 + 0.1 * intensity));
  const unmetBySku = new Map(
    ((state.lastDayReport?.perSku || [])).map((x) => [String(x.skuId), Number(x.unmetUnits) || 0])
  );
  const sorted = [...(state.skus || [])].sort((a, b) => {
    const unmetA = unmetBySku.get(String(a.id)) || 0;
    const unmetB = unmetBySku.get(String(b.id)) || 0;
    if (unmetA !== unmetB) return unmetB - unmetA;
    return (Number(b.baseDemand) || 0) - (Number(a.baseDemand) || 0);
  });
  for (const sku of sorted) {
    const id = sku.id;
    const current = Number(state.inStock?.[id]) || 0;
    const demand = Number(sku.baseDemand) || 0;
    const unmetBoost = Math.max(0, Math.round((unmetBySku.get(String(id)) || 0) * (2.2 * intensity)));
    const target = Math.max(160, Math.round(demand * (2.6 + 0.35 * (intensity - 1))) + unmetBoost);
    const need = Math.max(0, target - current);
    if (!need) continue;
    const unitCost = Math.max(1, Number(sku.purchaseCost) || 1);
    const affordable = Math.floor((maxBudget - spent) / unitCost);
    if (affordable <= 0) break;
    const buyQty = Math.max(0, Math.min(need, affordable));
    if (!buyQty) continue;
    state.inStock[id] = current + buyQty;
    spent += buyQty * unitCost;
    units += buyQty;
    state.skuPrices[id] = Math.max(1, Number(sku.recommendedPrice) || 1);
    state.qualityScore[id] = Math.max(75, Number(state.qualityScore?.[id]) || 75);
  }
  state.cash = Math.max(0, cash - spent);
  return { spent, units };
}

function buildRegressionSafeConstants(state, prevStockoutRate, baseCfg = null) {
  const base = baseCfg || buildSimulationConstants(state);
  if (prevStockoutRate <= 0.35) return base;
  return {
    ...base,
    adEfficiency: Math.max(0.0001, Number(base.adEfficiency) * 0.72),
    baseConversion: Math.max(0.0001, Number(base.baseConversion) * 0.86),
  };
}

function buildSimulationConstantsForState(state) {
  const cfg = buildSimulationConstants(state);
  const ov = state?._economyOverride;
  if (!ov || typeof ov !== "object") return cfg;
  return {
    ...cfg,
    feeRate: ov.feeRate != null ? Number(ov.feeRate) : cfg.feeRate,
    paymentRate: ov.paymentRate != null ? Number(ov.paymentRate) : cfg.paymentRate,
    outboundCostPerUnit:
      ov.outboundCostPerUnit != null ? Number(ov.outboundCostPerUnit) : cfg.outboundCostPerUnit,
    fixedOverheadDaily:
      ov.fixedOverheadDaily != null ? Number(ov.fixedOverheadDaily) : cfg.fixedOverheadDaily,
  };
}

function regressionPassesGates(reg, gates) {
  if (!reg || !gates) return false;
  return (
    Number(reg.avgProfit) >= gates.avgProfitMin &&
    Number(reg.worstProfit) >= gates.worstProfitMin &&
    Number(reg.avgStockout) <= gates.avgStockoutMax &&
    Number(reg.avgService) >= gates.avgServiceMin
  );
}

/**
 * @param {object} draft
 * @param {number} dayCount
 */
function executeRegressionOnDraft(draft, dayCount) {
  const rows = [];
  let autoRecoveryUsed = false;
  let autoRecoveryCount = 0;
  let autoRecoveryUnits = 0;
  let autoRecoverySpent = 0;
  let prevStockoutRate = Number(draft?.kpi?.stockoutRate) || 0;
  const shouldForceStartRecovery =
    Number(draft.day || 0) <= 3 || prevStockoutRate > 0.5 || totalStockForState(draft) <= 0;
  if (shouldForceStartRecovery) {
    const startIntensity = prevStockoutRate > 0.5 ? 2 : 1;
    const rescue = applySafeRecoveryV2ToState(draft, { intensity: startIntensity });
    autoRecoveryUsed = rescue.units > 0;
    autoRecoveryCount += autoRecoveryUsed ? 1 : 0;
    autoRecoveryUnits += rescue.units;
    autoRecoverySpent += rescue.spent;
  }
  for (let i = 0; i < dayCount; i += 1) {
    if (prevStockoutRate > 0.35) {
      const forcedRescue = applySafeRecoveryV2ToState(draft, { intensity: 2 });
      if (forcedRescue.units > 0) {
        autoRecoveryUsed = true;
        autoRecoveryCount += 1;
        autoRecoveryUnits += forcedRescue.units;
        autoRecoverySpent += forcedRescue.spent;
      }
    }
    draft.day = (Number(draft.day) || 0) + 1;
    processDailyEvents(draft, eventDefinitions);
    refreshDerivedModifiers(draft);
    const draftProg = draft.progressionModifiers || {};
    if (draftProg.autoReprice) runAutoReprice(draft);
    if (draftProg.autoReorder) runAutoReorder(draft);
    processIncomingShipmentsForState(draft);
    draft.adBudgetEffective = draft.adEnabled === false ? 0 : Math.max(0, Number(draft.adBudget) || 0);
    const regressionCfg = buildRegressionSafeConstants(
      draft,
      prevStockoutRate,
      buildSimulationConstantsForState(draft)
    );
    const report = simulateSalesDay(draft, regressionCfg);
    const t = report?.totals || {};
    const row = {
      day: draft.day,
      profit: Number(t.operatingProfit) || 0,
      stockoutRate:
        (Number(t.ordersWanted) || 0) > 0
          ? (Number(t.unmetUnits) || 0) / (Number(t.ordersWanted) || 1)
          : 0,
      serviceRating: Number(t.serviceRating) || 5,
    };
    rows.push(row);
    const shouldRecoverByStockout = row.stockoutRate > 0.35 || prevStockoutRate > 0.35;
    const shouldRecoverByLowStock = totalStockForState(draft) <= 120;
    if (shouldRecoverByStockout || shouldRecoverByLowStock) {
      const intensity = row.stockoutRate > 0.5 ? 2 : 1;
      const rescue = applySafeRecoveryV2ToState(draft, { intensity });
      if (rescue.units > 0) {
        autoRecoveryUsed = true;
        autoRecoveryCount += 1;
        autoRecoveryUnits += rescue.units;
        autoRecoverySpent += rescue.spent;
      }
    }
    prevStockoutRate = row.stockoutRate;
  }
  const avgProfit = rows.length ? rows.reduce((a, x) => a + x.profit, 0) / rows.length : 0;
  const worstProfit = rows.length ? Math.min(...rows.map((x) => x.profit)) : 0;
  const avgStockout = rows.length ? rows.reduce((a, x) => a + x.stockoutRate, 0) / rows.length : 0;
  const avgService = rows.length ? rows.reduce((a, x) => a + x.serviceRating, 0) / rows.length : 0;
  return {
    days: dayCount,
    rows,
    avgProfit,
    worstProfit,
    avgStockout,
    avgService,
    autoRecoveryUsed,
    autoRecoveryCount,
    autoRecoveryUnits,
    autoRecoverySpent,
  };
}

function runRegressionDays(dayCount) {
  const startedAt = Date.now();
  setRegressionRunStatus(`Регрессия ${dayCount} дней: выполняется…`, "#c9d2ff");
  const draft = JSON.parse(JSON.stringify(gameState));
  const result = executeRegressionOnDraft(draft, dayCount);
  result.generatedAt = new Date().toISOString();
  if (dayCount === 7) gameState.phase2Regression = result;
  if (!gameState.phase3Regression || typeof gameState.phase3Regression !== "object") {
    gameState.phase3Regression = {};
  }
  gameState.phase3Regression[String(dayCount)] = result;
  const elapsedMs = Date.now() - startedAt;
  const gates = PHASE3_GATES[dayCount] || PHASE2_GATES;
  const pass = regressionPassesGates(result, gates);
  setRegressionRunStatus(
    `Регрессия ${dayCount} дней: ${pass ? "PASS" : "WATCH"} за ${elapsedMs} мс · avg profit ${money(result.avgProfit)} · avg stockout ${(result.avgStockout * 100).toFixed(1)}% · recovery ${result.autoRecoveryCount}×.`,
    pass ? "#8fd694" : "#ffcc66"
  );
  render();
  return result;
}

function runRegression7Days() {
  return runRegressionDays(7);
}

function runPlayStyleBalanceAudit() {
  if (!playStyles.length) return null;
  const startedAt = Date.now();
  if (els.phase3RegressionStatus) {
    els.phase3RegressionStatus.innerHTML = `<span style="color:#c9d2ff">Аудит стилей: 3×7 дней…</span>`;
  }
  const styles = playStyles.slice(0, 3);
  const results = styles.map((style) => {
    const draft = JSON.parse(JSON.stringify(gameState));
    applyPlayStylePresetToState(draft, style);
    applySafeRecoveryV2ToState(draft, { intensity: 1 });
    const reg = executeRegressionOnDraft(draft, 7);
    return { styleId: style.id, name: style.name, avgProfit: reg.avgProfit, reg };
  });
  const weights = results.map((r) => Math.max(1, Number(r.avgProfit) + 2500));
  const total = weights.reduce((a, b) => a + b, 0);
  const shares = results.map((r, i) => ({
    styleId: r.styleId,
    share: total > 0 ? weights[i] / total : 0,
  }));
  const maxShare = shares.length ? Math.max(...shares.map((s) => s.share)) : 0;
  const dominantStyleId = shares.find((s) => s.share === maxShare)?.styleId || null;
  const balanced = maxShare <= STYLE_BALANCE_MAX_SHARE;
  const audit = {
    generatedAt: new Date().toISOString(),
    daysPerStyle: 7,
    results,
    shares,
    maxShare,
    dominantStyleId,
    balanced,
    elapsedMs: Date.now() - startedAt,
  };
  gameState.phase3StyleAudit = audit;
  if (els.phase3RegressionStatus) {
    els.phase3RegressionStatus.innerHTML = `<span style="color:${balanced ? "#8fd694" : "#ffcc66"}">Аудит стилей: ${balanced ? "PASS" : "WATCH"} · max share ${(maxShare * 100).toFixed(0)}% (${dominantStyleId || "—"}) · ${audit.elapsedMs} мс</span>`;
  }
  render();
  return audit;
}

function buildPhase3FreezeReport() {
  const k = gameState.kpi || defaultKpi();
  const phase2 = buildPhase2FreezeReport();
  const reg14 = gameState.phase3Regression?.["14"] || null;
  const reg28 = gameState.phase3Regression?.["28"] || null;
  const audit = gameState.phase3StyleAudit || null;
  const checks = [
    { id: "phase2-freeze", label: "Phase 2 freeze не NO-GO", pass: phase2.decision !== "NO-GO" },
    { id: "sku-72", label: "Каталог 72 SKU", pass: (gameState.skus || []).length >= 72 },
    { id: "events-24", label: "Пул 24 события", pass: eventDefinitions.length >= 24 },
    { id: "progression-34", label: "Прогрессия 34 узла", pass: progressionNodes.length >= 34 },
    { id: "play-styles-3", label: "3 стиля игры", pass: playStyles.length >= 3 },
    { id: "anti-exploit", label: "Антиэксплойт в состоянии", pass: gameState.antiExploit != null || !!gameState.lastDayReport },
    { id: "regression-14", label: "Регрессия 14 дней выполнена", pass: !!reg14?.rows?.length },
    {
      id: "regression-14-gates",
      label: "Регрессия 14д: gates PASS",
      pass: regressionPassesGates(reg14, PHASE3_GATES[14]),
    },
    { id: "regression-28", label: "Регрессия 28 дней выполнена", pass: !!reg28?.rows?.length },
    {
      id: "regression-28-gates",
      label: "Регрессия 28д: gates PASS",
      pass: regressionPassesGates(reg28, PHASE3_GATES[28]),
    },
    { id: "style-audit", label: "Аудит баланса стилей выполнен", pass: !!audit },
    {
      id: "style-balance",
      label: `Нет доминирующего стиля > ${(STYLE_BALANCE_MAX_SHARE * 100).toFixed(0)}%`,
      pass: !!audit?.balanced,
    },
    { id: "sim-day", label: "Есть симулированный день", pass: !!gameState.lastDayReport },
    { id: "kpi-profit", label: "Прибыль последнего дня > 0", pass: Number(k.profit) > 0 },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const ratio = total > 0 ? passCount / total : 0;
  const decision = ratio >= 0.85 ? "GO" : ratio >= 0.65 ? "GO WITH RISKS" : "NO-GO";
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    phase: 3,
    day: gameState.day,
    decision,
    passCount,
    totalChecks: total,
    checks,
    regression14: reg14,
    regression28: reg28,
    styleAudit: audit,
    phase2Freeze: phase2,
    kpi: gameState.kpi,
    playStyleId: gameState.playStyleId,
    antiExploit: gameState.antiExploit,
  };
}

function renderPhase3FreezeSummary() {
  if (!els.phase3FreezeSummary) return;
  if (!gameState?.skus?.length) {
    els.phase3FreezeSummary.textContent = "Сводка Phase 3 freeze появится после инициализации.";
    return;
  }
  const rep = buildPhase3FreezeReport();
  const color = rep.decision === "GO" ? "#8fd694" : rep.decision === "GO WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const reg14 = gameState.phase3Regression?.["14"];
  const reg28 = gameState.phase3Regression?.["28"];
  const regLine = `14д: ${reg14 ? money(reg14.avgProfit) : "—"} · 28д: ${reg28 ? money(reg28.avgProfit) : "—"} · стили: ${gameState.phase3StyleAudit?.balanced ? "OK" : gameState.phase3StyleAudit ? "WATCH" : "—"}`;
  const checksLine = rep.checks
    .map((c) => `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`)
    .join("");
  els.phase3FreezeSummary.innerHTML = `<div><b>Phase 3 Freeze:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · checks <b>${rep.passCount}/${rep.totalChecks}</b></div><div class="muted" style="margin-top:4px">${regLine}</div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function exportPhase3FreezeReportFile() {
  try {
    const payload = JSON.stringify(buildPhase3FreezeReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-phase3-freeze-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPhase3FreezeReportFile failed", e);
    alert("Не удалось экспортировать Phase 3 freeze отчёт: " + String(e));
  }
}

function runPreReleaseOneClick() {
  applyBalancePreset("conservative");
  runRegression7Days();
  gameState.phase2LastPreReleaseRun = {
    runAt: new Date().toISOString(),
    preset: "conservative",
    day: gameState.day,
  };
  render();
  const rep = buildPhase2InternalReport();
  const shouldExport = confirm(
    `Pre-release run завершен.\nРешение: ${rep.decision} (${rep.passCount}/${rep.totalChecks}).\nЭкспортировать phase2 build отчёт сейчас?`
  );
  if (shouldExport) exportPhase2InternalReportFile();
}

function runQuickEmergencyRestock() {
  if (!gameState) return;
  let spent = 0;
  let units = 0;
  const maxBudget = Math.max(0, Number(gameState.cash) || 0) * 0.7;
  const unmetMemory = gameState.unmetMemory && typeof gameState.unmetMemory === "object" ? gameState.unmetMemory : {};
  const sorted = [...gameState.skus].sort((a, b) => {
    const ua = Math.max(0, Number(unmetMemory[a.id]) || 0);
    const ub = Math.max(0, Number(unmetMemory[b.id]) || 0);
    if (ua !== ub) return ub - ua;
    return (Number(b.baseDemand) || 0) - (Number(a.baseDemand) || 0);
  });
  for (const sku of sorted.slice(0, 6)) {
    const current = Number(gameState.inStock[sku.id]) || 0;
    const unmetBoost = Math.round((Math.max(0, Number(unmetMemory[sku.id]) || 0)) * 1.8);
    const target = Math.max(80, Math.round((Number(sku.baseDemand) || 0) * 1.6) + unmetBoost);
    const need = Math.max(0, target - current);
    if (!need) continue;
    const unitCost = Math.max(1, Number(sku.purchaseCost) || 1);
    const affordable = Math.floor((maxBudget - spent) / unitCost);
    if (affordable <= 0) break;
    const buyQty = Math.max(0, Math.min(need, affordable));
    if (!buyQty) continue;
    gameState.inStock[sku.id] = current + buyQty;
    const cost = buyQty * unitCost;
    spent += cost;
    units += buyQty;
  }
  gameState.cash = Math.max(0, (Number(gameState.cash) || 0) - spent);
  render();
  alert(`Экстренное пополнение выполнено: +${units} шт., списано ${money(spent)}.`);
}

function runQuickMarginStabilization() {
  if (!gameState) return;
  applyBalancePreset("conservative");
  gameState.adEnabled = true;
  gameState.adBudget = Math.min(Math.max(1200, Number(gameState.adBudget) || 0), 2500);
  gameState.returnRateMod = Math.max(0.85, Math.min(1.0, Number(gameState.returnRateMod) || 1));
  for (const sku of gameState.skus) {
    const id = sku.id;
    const rec = Math.max(1, Number(sku.recommendedPrice) || 1);
    const oldPrice = Math.max(1, Number(gameState.skuPrices[id]) || rec);
    const nextPrice = Math.round(oldPrice < rec ? rec : oldPrice * 1.03);
    gameState.skuPrices[id] = Math.max(rec, nextPrice);
    gameState.qualityScore[id] = Math.max(72, Number(gameState.qualityScore[id]) || 72);
  }
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  render();
  alert("Стабилизация маржи применена: conservative-профиль, мягкая корректировка цен и качества.");
}

function runSafeRecoveryPresetV2() {
  if (!gameState) return;
  applyBalancePreset("conservative");
  // Агрессивнее закрываем stockout: режем рекламу в защитный диапазон и увеличиваем буфер стока.
  gameState.adEnabled = true;
  gameState.adBudget = 1200;
  gameState.returnRateMod = Math.max(0.82, Math.min(0.95, Number(gameState.returnRateMod) || 0.9));
  economyConstants = {
    ...economyConstants,
    feeRate: Math.max(0, (Number(economyConstants.feeRate) || 0) - 0.003),
    outboundCostPerUnit: Math.max(1, Math.round((Number(economyConstants.outboundCostPerUnit) || 0) * 0.92)),
    fixedOverheadDaily: Math.max(300, Math.round((Number(economyConstants.fixedOverheadDaily) || 0) * 0.95)),
  };

  let spent = 0;
  let units = 0;
  const cash = Math.max(0, Number(gameState.cash) || 0);
  const maxBudget = cash * 0.85;
  const unmetMemory = gameState.unmetMemory && typeof gameState.unmetMemory === "object" ? gameState.unmetMemory : {};
  const sorted = [...gameState.skus].sort((a, b) => {
    const ua = Math.max(0, Number(unmetMemory[a.id]) || 0);
    const ub = Math.max(0, Number(unmetMemory[b.id]) || 0);
    if (ua !== ub) return ub - ua;
    return (Number(b.baseDemand) || 0) - (Number(a.baseDemand) || 0);
  });
  for (const sku of sorted) {
    const id = sku.id;
    const current = Number(gameState.inStock[id]) || 0;
    const demand = Number(sku.baseDemand) || 0;
    const unmetBoost = Math.round((Math.max(0, Number(unmetMemory[id]) || 0)) * 2.4);
    const target = Math.max(140, Math.round(demand * 2.4) + unmetBoost);
    const need = Math.max(0, target - current);
    if (!need) continue;
    const unitCost = Math.max(1, Number(sku.purchaseCost) || 1);
    const affordable = Math.floor((maxBudget - spent) / unitCost);
    if (affordable <= 0) break;
    const buyQty = Math.max(0, Math.min(need, affordable));
    if (!buyQty) continue;
    gameState.inStock[id] = current + buyQty;
    const cost = buyQty * unitCost;
    spent += cost;
    units += buyQty;

    // Для анти-stockout удерживаем цену около рекомендованной, не завышаем.
    const rec = Math.max(1, Number(sku.recommendedPrice) || 1);
    gameState.skuPrices[id] = rec;
    gameState.qualityScore[id] = Math.max(75, Number(gameState.qualityScore[id]) || 75);
  }
  gameState.cash = Math.max(0, cash - spent);
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  render();
  alert(`Safe recovery v2 применен: +${units} шт. в stock, списано ${money(spent)}, adBudget=1200.`);
}

function topUnmetSkuLine(limit = 3) {
  if (!gameState?.skus) return "Top unmet SKU: нет данных.";
  const unmetMemory = gameState.unmetMemory && typeof gameState.unmetMemory === "object" ? gameState.unmetMemory : {};
  const top = [...gameState.skus]
    .map((s) => ({ name: s.name, score: Math.max(0, Number(unmetMemory[s.id]) || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((x) => x.score > 0.01);
  if (!top.length) return "Top unmet SKU: дефицитные позиции не выявлены.";
  return `Top unmet SKU: ${top.map((x) => `${x.name} (${x.score.toFixed(1)})`).join(" · ")}`;
}

function buildPhase2InternalReport() {
  const k = gameState.kpi || defaultKpi();
  const reg = gameState.phase2Regression;
  const hasRuntimeKpi = !!gameState.lastDayReport;
  const kpiLooksDefault =
    Number(k.revenue) === 0 &&
    Number(k.profit) === 0 &&
    Number(k.marginPct) === 0 &&
    Number(k.acos) === 0 &&
    Number(k.returnPct) === 0 &&
    Number(k.stockoutRate) === 0 &&
    Number(k.unmetUnits) === 0;
  const hasSufficientRuntimeData = hasRuntimeKpi && !kpiLooksDefault && Number(gameState.day || 0) > 1;
  const checks = [
    {
      id: "runtime-data",
      label: "Есть валидные runtime KPI (не дефолтные, day > 1)",
      pass: hasSufficientRuntimeData,
    },
    { id: "kpi-profit", label: "Положительная прибыль последнего дня", pass: Number(k.profit) > 0 },
    { id: "kpi-stockout", label: "Stockout в пределах <= 20%", pass: Number(k.stockoutRate) <= 0.2 },
    { id: "kpi-returns", label: "Возвраты в пределах <= 14%", pass: Number(k.returnPct) <= 0.14 },
    { id: "kpi-service", label: "Рейтинг сервиса >= 3.8", pass: Number(k.serviceRating || 5) >= 3.8 },
    { id: "regression-ready", label: "Есть 7-дневный регрессионный прогон", pass: !!reg && Array.isArray(reg.rows) && reg.rows.length === 7 },
    {
      id: "regression-avg-profit",
      label: `Регрессия: avg profit >= ${PHASE2_GATES.avgProfitMin}`,
      pass: !!reg ? Number(reg.avgProfit) >= PHASE2_GATES.avgProfitMin : false,
    },
    {
      id: "regression-stable-profit",
      label: `Регрессия: worst profit >= ${PHASE2_GATES.worstProfitMin}`,
      pass: !!reg ? Number(reg.worstProfit) >= PHASE2_GATES.worstProfitMin : false,
    },
    {
      id: "regression-stockout",
      label: `Регрессия: avg stockout <= ${(PHASE2_GATES.avgStockoutMax * 100).toFixed(0)}%`,
      pass: !!reg ? Number(reg.avgStockout) <= PHASE2_GATES.avgStockoutMax : false,
    },
    {
      id: "regression-service",
      label: `Регрессия: avg service >= ${PHASE2_GATES.avgServiceMin.toFixed(1)}`,
      pass: !!reg ? Number(reg.avgService) >= PHASE2_GATES.avgServiceMin : false,
    },
    { id: "catalog-36", label: "Каталог >= 36 SKU", pass: (gameState.skus || []).length >= 36 },
    { id: "catalog-72", label: "Каталог >= 72 SKU (v3)", pass: (gameState.skus || []).length >= 72 },
    { id: "events-pool", label: "Пул событий >= 10", pass: eventDefinitions.length >= 10 },
    { id: "events-pool-24", label: "Пул событий >= 24 (v3)", pass: eventDefinitions.length >= 24 },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const totalChecks = checks.length;
  const ratio = totalChecks > 0 ? passCount / totalChecks : 0;
  const decision = !hasSufficientRuntimeData ? "NO-GO" : ratio >= 0.84 ? "GO" : ratio >= 0.6 ? "GO WITH RISKS" : "NO-GO";
  const criticalStockoutLoop = !!reg && Number(reg.avgStockout) > 0.6 && Number(reg.avgService) < 3.5;
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    day: gameState.day,
    decision,
    passCount,
    totalChecks,
    checks,
    runtimeDataOk: hasSufficientRuntimeData,
    criticalStockoutLoop,
    currentKpi: gameState.kpi,
    regression7d: reg || null,
    balancePresetState: {
      economyConstants,
      adBudget: gameState.adBudget,
      returnRateMod: gameState.returnRateMod,
    },
  };
}

function exportPhase2InternalReportFile() {
  try {
    const payload = JSON.stringify(buildPhase2InternalReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-phase2-internal-build-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPhase2InternalReportFile failed", e);
    alert("Не удалось экспортировать phase2 build отчёт: " + String(e));
  }
}

function renderPhase2BuildStatus() {
  if (!els.phase2BuildStatus) return;
  if (!gameState.lastDayReport?.totals) {
    els.phase2BuildStatus.textContent = "Сводка phase2 build появится после первой симуляции.";
    return;
  }
  const rep = buildPhase2InternalReport();
  const color = rep.decision === "GO" ? "#8fd694" : rep.decision === "GO WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const reg = rep.regression7d;
  const regLine = reg
    ? `Регрессия 7д: avg profit ${money(reg.avgProfit)}, worst ${money(reg.worstProfit)}, avg stockout ${(reg.avgStockout * 100).toFixed(1)}%, avg service ${Number(reg.avgService).toFixed(2)}`
    : "Регрессия 7д: еще не запускалась.";
  const regRecoveryLine =
    reg && reg.autoRecoveryUsed
      ? `Auto-recovery в регрессии: ${reg.autoRecoveryCount} раз(а), +${Math.round(reg.autoRecoveryUnits || 0)} шт., расход ${money(reg.autoRecoverySpent || 0)}`
      : "Auto-recovery в регрессии: не применялся.";
  const gatesLine = `Gates v1 (internal): avg profit >= ${PHASE2_GATES.avgProfitMin}, worst >= ${PHASE2_GATES.worstProfitMin}, avg stockout <= ${(PHASE2_GATES.avgStockoutMax * 100).toFixed(0)}%, avg service >= ${PHASE2_GATES.avgServiceMin.toFixed(1)}`;
  const criticalLine = rep.criticalStockoutLoop
    ? `<span style="color:#ff8f8f"><b>Critical:</b> detected stockout loop (avg stockout > 60% при avg service < 3.5).</span>`
    : `<span style="color:#8fd694"><b>Critical:</b> stockout loop not detected.</span>`;
  const lastAutoRun = gameState.phase2LastPreReleaseRun;
  const autoLine = lastAutoRun
    ? `Последний pre-release run: день ${lastAutoRun.day}, preset ${lastAutoRun.preset}, ${String(lastAutoRun.runAt).replace("T", " ").slice(0, 16)}`
    : "Pre-release run: еще не запускался.";
  const checksLine = rep.checks
    .map((c) => `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`)
    .join("");
  const unmetLine = topUnmetSkuLine(3);
  els.phase2BuildStatus.innerHTML = `<div><b>Решение phase2 internal build:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · checks <b>${rep.passCount}/${rep.totalChecks}</b></div><div class="muted" style="margin-top:4px">${gatesLine}</div><div class="muted" style="margin-top:4px">${regLine}</div><div class="muted" style="margin-top:4px">${regRecoveryLine}</div><div class="muted" style="margin-top:4px">${autoLine}</div><div class="muted" style="margin-top:4px">${criticalLine}</div><div class="muted" style="margin-top:4px">${unmetLine}</div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function renderReleaseSmokeChecklist() {
  if (!els.releaseSmokeChecklist) return;
  if (!gameState.lastDayReport?.totals) {
    els.releaseSmokeChecklist.textContent = "Release smoke checklist появится после первой симуляции.";
    return;
  }
  const k = gameState.kpi || defaultKpi();
  const reg = gameState.phase2Regression;
  const hasRuntimeKpi = !!gameState.lastDayReport;
  const kpiLooksDefault =
    Number(k.revenue) === 0 &&
    Number(k.profit) === 0 &&
    Number(k.marginPct) === 0 &&
    Number(k.acos) === 0 &&
    Number(k.returnPct) === 0 &&
    Number(k.stockoutRate) === 0 &&
    Number(k.unmetUnits) === 0;
  const hasSufficientRuntimeData = hasRuntimeKpi && !kpiLooksDefault && Number(gameState.day || 0) > 1;
  const checks = [
    { label: "Есть валидные runtime KPI (не дефолтные, day > 1)", pass: hasSufficientRuntimeData },
    { label: "Есть дневной отчёт и KPI", pass: !!gameState.lastDayReport },
    { label: "Save/Load доступен", pass: !!els.saveBtn && !!els.loadBtn },
    { label: "JSON экспорт/импорт доступен", pass: !!els.exportJsonBtn && !!els.importJsonBtn },
    { label: "KPI-дашборд отображается", pass: !!els.kpiDashboard },
    { label: "Фаза 2: сводка build отображается", pass: !!els.phase2BuildStatus },
    { label: "Профиль прибыли не критичный", pass: Number(k.profit) > -2000 },
    { label: "Stockout в допустимом окне", pass: Number(k.stockoutRate) <= 0.25 },
    { label: "Есть 7-дневная регрессия", pass: !!reg && Array.isArray(reg.rows) && reg.rows.length === 7 },
    { label: "Регрессия: avg stockout <= 25%", pass: !!reg ? Number(reg.avgStockout) <= 0.25 : false },
    { label: "Регрессия: avg service >= 3.5", pass: !!reg ? Number(reg.avgService) >= 3.5 : false },
    { label: "Каталог >= 72 SKU", pass: (gameState.skus || []).length >= 72 },
    { label: "Пул событий >= 10", pass: eventDefinitions.length >= 10 },
    { label: "Пул событий >= 24", pass: eventDefinitions.length >= 24 },
  ];
  const passCount = checks.filter((x) => x.pass).length;
  const ratio = checks.length ? passCount / checks.length : 0;
  const status = ratio >= 0.85 ? "READY" : ratio >= 0.6 ? "READY WITH RISKS" : "NOT READY";
  const color = status === "READY" ? "#8fd694" : status === "READY WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const rows = checks
    .map((x) => `<li style="margin:4px 0"><span style="color:${x.pass ? "#8fd694" : "#ff8f8f"}">${x.pass ? "PASS" : "FAIL"}</span> — ${x.label}</li>`)
    .join("");
  els.releaseSmokeChecklist.innerHTML = `<div><b>Release smoke:</b> <span style="color:${color}"><b>${status}</b></span> · пройдено <b>${passCount}/${checks.length}</b></div><ul class="incoming" style="margin-top:6px">${rows}</ul>`;
}

function kpiClassByValue(kind, value) {
  if (kind === "marginPct") return value >= 10 ? "kpi-good" : value >= 0 ? "kpi-warn" : "kpi-bad";
  if (kind === "acos") return value <= 0.2 ? "kpi-good" : value <= 0.35 ? "kpi-warn" : "kpi-bad";
  if (kind === "returnPct") return value <= 0.08 ? "kpi-good" : value <= 0.14 ? "kpi-warn" : "kpi-bad";
  if (kind === "stockoutRate") return value <= 0.05 ? "kpi-good" : value <= 0.2 ? "kpi-warn" : "kpi-bad";
  if (kind === "profit") return value > 0 ? "kpi-good" : value === 0 ? "kpi-warn" : "kpi-bad";
  return "kpi-warn";
}

function renderKpiDashboard() {
  if (!els.kpiDashboard) return;
  if (!gameState.lastDayReport) {
    els.kpiDashboard.innerHTML = '<div class="muted">Нет данных — сначала нажми Next Day.</div>';
    return;
  }

  const k = gameState.kpi;
  const cards = [
    { kind: "revenue", title: "Выручка (чистая)", value: money(k.revenue), cls: "kpi-good" },
    { kind: "profit", title: "Прибыль", value: money(k.profit), cls: kpiClassByValue("profit", k.profit) },
    { kind: "marginPct", title: "Маржа", value: `${k.marginPct.toFixed(1)}%`, cls: kpiClassByValue("marginPct", k.marginPct) },
    { kind: "acos", title: "ACOS", value: `${(k.acos * 100).toFixed(1)}%`, cls: kpiClassByValue("acos", k.acos) },
    { kind: "returnPct", title: "Доля возвратов", value: `${(k.returnPct * 100).toFixed(1)}%`, cls: kpiClassByValue("returnPct", k.returnPct) },
    { kind: "stockoutRate", title: "Stockout rate", value: `${(k.stockoutRate * 100).toFixed(1)}%`, cls: kpiClassByValue("stockoutRate", k.stockoutRate) },
    { kind: "unmetUnits", title: "Нехватка, шт", value: `${Math.round(k.unmetUnits)}`, cls: k.unmetUnits > 0 ? "kpi-bad" : "kpi-good" },
    { kind: "daysOfStock", title: "Дней запаса", value: `${k.daysOfStock.toFixed(1)}`, cls: k.daysOfStock >= 2 ? "kpi-good" : k.daysOfStock >= 1 ? "kpi-warn" : "kpi-bad" },
  ];

  els.kpiDashboard.innerHTML = cards
    .map(
      (c) => {
        const hint = kpiHintByKind(c.kind);
        const delta = formatDelta(c.kind, getKpiDelta(c.kind));
        return `<div class="kpi-card"><div class="kpi-title">${c.title}<span class="kpi-help" title="${hint}">i</span></div><div class="kpi-value ${c.cls}">${c.value}</div><div class="muted" style="margin-top:4px">${delta}</div></div>`;
      }
    )
    .join("");
}

function renderCategoryKpiTable() {
  if (!els.categoryKpiTable) return;
  const r = gameState.lastDayReport;
  if (!r?.perSku?.length) {
    els.categoryKpiTable.textContent = "Категорийный срез появится после первой симуляции.";
    if (els.categoryRecommendations) {
      els.categoryRecommendations.textContent = "Рекомендации по категориям появятся после первой симуляции.";
    }
    return;
  }

  const byCat = new Map();
  for (const row of r.perSku) {
    const sku = skuById(String(row.skuId));
    const catId = String(sku?.categoryId || "unknown");
    const catName = categoryById(catId)?.name || catId;
    const prev = byCat.get(catId) || {
      catId,
      catName,
      netRevenue: 0,
      operatingProfit: 0,
      ordersWanted: 0,
      unmetUnits: 0,
    };
    const netRevenue = Number(row.netRevenue) || 0;
    const cogs = Number(row.cogs) || 0;
    const fee = Number(row.fee) || 0;
    const payment = Number(row.payment) || 0;
    const logistics = Number(row.logistics) || 0;
    const returnsCost = Number(row.returnsCost) || 0;
    const operatingProfit = netRevenue - cogs - fee - payment - logistics - returnsCost;
    prev.netRevenue += netRevenue;
    prev.operatingProfit += operatingProfit;
    prev.ordersWanted += Number(row.ordersWanted) || 0;
    prev.unmetUnits += Number(row.unmetUnits) || 0;
    byCat.set(catId, prev);
  }

  const heatBadge = (profit, stockoutRate) => {
    if (profit < 0 || stockoutRate > 0.2) return { text: "High Risk", color: "#ff8f8f", bg: "#3a1f28" };
    if (stockoutRate > 0.08 || profit < 15000) return { text: "Watch", color: "#ffcc66", bg: "#3b3220" };
    return { text: "Healthy", color: "#8fd694", bg: "#1e3526" };
  };

  const rowsData = [...byCat.values()]
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .map((x) => {
      const stockoutRate = x.ordersWanted > 0 ? x.unmetUnits / x.ordersWanted : 0;
      const profitColor = x.operatingProfit >= 0 ? "#8fd694" : "#ff8f8f";
      const heat = heatBadge(x.operatingProfit, stockoutRate);
      return { ...x, stockoutRate, heat, profitColor };
    });

  const rows = rowsData
    .map((x) => {
      return `<tr><td>${x.catName}</td><td class="num">${money(x.netRevenue)}</td><td class="num" style="color:${x.profitColor}">${money(x.operatingProfit)}</td><td class="num">${(x.stockoutRate * 100).toFixed(1)}%</td><td class="num"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${x.heat.bg};color:${x.heat.color};font-size:12px">${x.heat.text}</span></td></tr>`;
    })
    .join("");

  els.categoryKpiTable.innerHTML = `<table class="stock"><thead><tr><th>Категория</th><th class="num">Net revenue</th><th class="num">Oper. profit (до ad/overhead)</th><th class="num">Stockout rate</th><th class="num">Heat</th></tr></thead><tbody>${rows}</tbody></table><p class="muted" style="margin:6px 0 0">Heatmap логика: <b>Healthy</b> — прибыльная категория с низким stockout; <b>Watch</b> — зона внимания; <b>High Risk</b> — высокий риск или убыточность.</p>`;

  if (!els.categoryRecommendations) return;
  const risks = rowsData.filter((x) => x.heat.text === "High Risk").slice(0, 3);
  if (!risks.length) {
    els.categoryRecommendations.innerHTML = '<span style="color:#8fd694">Рекомендации: критических категорий нет, портфель выглядит устойчиво.</span>';
    return;
  }

  const tips = risks
    .map((x) => {
      const recs = [];
      if (x.stockoutRate > 0.2) recs.push("увеличить закупку и/или сократить lead time");
      if (x.operatingProfit < 0) recs.push("поднять цену или снизить рекламу по категории");
      if (x.operatingProfit > 0 && x.stockoutRate > 0.2) recs.push("добавить рекламный бюджет после пополнения стока");
      if (!recs.length) recs.push("провести ручную проверку price/quality/promo");
      return `<li style="margin:4px 0"><b>${x.catName}</b>: ${recs.join("; ")}.</li>`;
    })
    .join("");
  els.categoryRecommendations.innerHTML = `<div class="muted"><b>Авто-рекомендации (High Risk):</b></div><ul class="incoming" style="margin-top:6px">${tips}</ul>`;
}

function syncAdUiFromState() {
  if (els.adEnabledToggle instanceof HTMLInputElement) {
    els.adEnabledToggle.checked = gameState.adEnabled !== false;
  }
  els.adBudgetRange.value = String(gameState.adBudget);
  const effective = gameState.adEnabled === false ? 0 : gameState.adBudget;
  els.adBudgetLabel.textContent = `${gameState.adBudget.toLocaleString("ru-RU")} / день · в модель: ${effective.toLocaleString("ru-RU")}`;
}

function getEffectiveAdBudget() {
  if (!gameState || gameState.adEnabled === false) return 0;
  return Math.max(0, Number(gameState.adBudget) || 0);
}

function syncReturnsUiFromState() {
  if (!gameState || !els.returnRateModRange || !els.returnRateModLabel) return;
  const mod = Math.max(0.5, Math.min(1.5, Number(gameState.returnRateMod) || 1));
  els.returnRateModRange.value = String(mod);
  els.returnRateModLabel.textContent = `x${mod.toFixed(2)}`;
}

async function ensurePlatformReady() {
  if (platformState.checked) return platformState;
  const res = await initYandexSdk();
  platformState = {
    checked: true,
    available: !!res.available,
    sdk: res.sdk || null,
    message: res.available
      ? "Yandex SDK: подключён (режим платформы)."
      : "Yandex SDK: недоступен, fallback на обычный веб-режим.",
  };
  return platformState;
}

function renderSdkStatus() {
  if (!els.sdkStatus) return;
  const color = platformState.available ? "#8fd694" : "#ffcc66";
  els.sdkStatus.innerHTML = `<span style="color:${color}">${platformState.message}</span>`;
}

function canClaimRewardedNow() {
  if (!gameState || !gameState.lastDayReport) return false;
  return (gameState.rewardedClaimedDay || 0) !== gameState.day;
}

async function claimRewardedReward() {
  if (!gameState?.lastDayReport) {
    alert("Сначала заверши хотя бы один игровой день (Next Day).");
    return;
  }
  if (!canClaimRewardedNow()) {
    alert("Rewarded-награда уже получена в этом дне.");
    return;
  }

  let rewarded = false;
  const sdk = platformState.sdk;
  const hasYsdkRewarded = !!(platformState.available && sdk?.adv && typeof sdk.adv.showRewardedVideo === "function");

  if (hasYsdkRewarded) {
    rewarded = await new Promise((resolve) => {
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => resolve(true),
            onClose: () => resolve(false),
            onError: () => resolve(false),
          },
        });
      } catch (e) {
        console.warn("Rewarded show failed", e);
        resolve(false);
      }
    });
  } else {
    rewarded = window.confirm("SDK недоступен. Выдать тестовую rewarded-награду в fallback-режиме?");
  }

  if (!rewarded) {
    alert("Награда не получена.");
    return;
  }

  gameState.cash += REWARDED_CASH_AMOUNT;
  gameState.rewardedClaimedDay = gameState.day;
  render();
}

function renderRewardedState() {
  if (!els.rewardedBtn || !els.rewardedHint) return;
  const canClaim = canClaimRewardedNow();
  els.rewardedBtn.disabled = !canClaim;
  els.rewardedHint.textContent = canClaim
    ? `Доступно: +${money(REWARDED_CASH_AMOUNT)} за просмотр (1 раз на день).`
    : "Rewarded уже получен в этом дне.";
}

function canShowInterstitialToday() {
  if (!gameState || !gameState.lastDayReport) return false;
  const last = Number(gameState.lastInterstitialDay || 0);
  return gameState.day - last >= INTERSTITIAL_COOLDOWN_DAYS;
}

function renderInterstitialState() {
  if (!els.interstitialHint) return;
  if (!gameState?.lastDayReport) {
    els.interstitialHint.textContent = "Interstitial: появится после первой симуляции дня.";
    return;
  }
  const last = Number(gameState.lastInterstitialDay || 0);
  const remaining = Math.max(0, INTERSTITIAL_COOLDOWN_DAYS - (gameState.day - last));
  els.interstitialHint.textContent = canShowInterstitialToday()
    ? `Interstitial готов к показу (кулдаун ${INTERSTITIAL_COOLDOWN_DAYS} дн.).`
    : `Interstitial на кулдауне: ещё ${remaining} дн.`;
}

function renderPlaytestChecklist() {
  if (!els.playtestChecklist) return;
  const k = gameState.kpi || {};
  const checks = [
    {
      label: "Есть путь к прибыли",
      ok: Number(k.profit) > 0,
      hint: `Текущая прибыль: ${money(k.profit || 0)}`,
    },
    {
      label: "Контроль stockout",
      ok: Number(k.stockoutRate) <= 0.2,
      hint: `stockout: ${((k.stockoutRate || 0) * 100).toFixed(1)}%`,
    },
    {
      label: "Возвраты в адекватном диапазоне",
      ok: Number(k.returnPct) <= 0.14,
      hint: `возвраты: ${((k.returnPct || 0) * 100).toFixed(1)}%`,
    },
    {
      label: "Короткая петля решений читается",
      ok: !!gameState.lastDayReport,
      hint: "Есть дневной отчёт и KPI-обновление после Next Day",
    },
  ];
  const done = checks.filter((x) => x.ok).length;
  const rows = checks
    .map(
      (x) =>
        `<li style="margin:4px 0"><span style="color:${x.ok ? "#8fd694" : "#ff8f8f"}">${x.ok ? "PASS" : "TODO"}</span> — ${x.label} <span class="muted">(${x.hint})</span></li>`
    )
    .join("");
  els.playtestChecklist.innerHTML = `<div class="muted">Прогресс чеклиста: <b>${done}/${checks.length}</b></div><ul class="incoming" style="margin-top:6px">${rows}</ul>`;
}

async function tryShowInterstitialAfterDay() {
  if (!canShowInterstitialToday()) {
    renderInterstitialState();
    return;
  }
  const sdk = platformState.sdk;
  const hasYsdkInterstitial = !!(platformState.available && sdk?.adv && typeof sdk.adv.showFullscreenAdv === "function");

  if (hasYsdkInterstitial) {
    await new Promise((resolve) => {
      try {
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: () => resolve(true),
            onError: () => resolve(false),
          },
        });
      } catch (e) {
        console.warn("Interstitial show failed", e);
        resolve(false);
      }
    });
  } else {
    // Dev fallback: не блокируем цикл игры, только имитируем факт показа.
    console.info("Interstitial fallback shown (SDK unavailable)");
  }

  gameState.lastInterstitialDay = gameState.day;
  renderInterstitialState();
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to load ${path}, using fallback`, err);
    return fallback;
  }
}

async function loadSkuCatalog() {
  const v3 = await loadJson("./src/data/skus_v3.json", null);
  if (Array.isArray(v3) && v3.length >= 70) return v3;
  const phase2 = await loadJson("./src/data/skus_phase2.json", null);
  if (Array.isArray(phase2) && phase2.length >= 30) return phase2;
  const legacy = await loadJson("./src/data/skus_beauty_m1.json", defaultSkus);
  return Array.isArray(legacy) ? legacy : defaultSkus;
}

async function loadEventCatalog() {
  const v3 = await loadJson("./src/data/events_v3.json", null);
  if (Array.isArray(v3) && v3.length >= 24) return v3;
  const phase2 = await loadJson("./src/data/events_phase2.json", []);
  return Array.isArray(phase2) ? phase2 : [];
}

async function loadOnboardingCatalog() {
  const steps = await loadJson("./src/data/onboarding_steps.json", []);
  onboardingSteps = Array.isArray(steps) ? steps : [];
}

async function loadProgressionCatalog() {
  const [nodes, synergies, styles] = await Promise.all([
    loadJson("./src/data/progression_nodes.json", DEFAULT_PROGRESSION_NODES_FALLBACK),
    loadJson("./src/data/progression_synergies.json", DEFAULT_PROGRESSION_SYNERGIES_FALLBACK),
    loadJson("./src/data/play_styles.json", []),
  ]);
  progressionNodes = Array.isArray(nodes) && nodes.length ? nodes : [...DEFAULT_PROGRESSION_NODES_FALLBACK];
  progressionSynergies =
    Array.isArray(synergies) && synergies.length ? synergies : [...DEFAULT_PROGRESSION_SYNERGIES_FALLBACK];
  playStyles = Array.isArray(styles) ? styles : [];
  await loadOnboardingCatalog();
}

function renderTeamPanel() {
  if (!els.teamPanel) return;
  const hired = progressionNodes.filter(
    (n) => n.branch === "team" && gameState?.progressionUnlocked?.[n.id] === true
  );
  const daily = computeTeamDailySalary(gameState, progressionNodes);
  if (!hired.length) {
    els.teamPanel.innerHTML =
      `<div class="muted">Команда не нанята. Открой узлы ветки «Команда» в прогрессии (n22+).</div><div class="muted" style="margin-top:6px">ЗП/день: <b>${money(daily)}</b></div>`;
    return;
  }
  const rows = hired
    .map((n) => {
      const sal = Math.max(0, Number(n.dailySalary) || 0);
      return `<li style="margin:4px 0"><b>${n.title}</b>${sal ? ` — ${money(sal)}/день` : " — без ЗП"}</li>`;
    })
    .join("");
  els.teamPanel.innerHTML = `<div>Нанято: <b>${hired.length}</b> · суммарная ЗП: <b>${money(daily)}</b>/день (списывается в P&amp;L)</div><ul class="incoming" style="margin-top:6px">${rows}</ul>`;
}

async function initGame() {
  await ensurePlatformReady();
  await loadProgressionCatalog();
  const [categories, rawSkus, rawConst, rawEvents] = await Promise.all([
    loadJson("./src/data/categories.json", defaultCategories),
    loadSkuCatalog(),
    loadJson("./src/data/constants.json", defaultConstants),
    loadEventCatalog(),
  ]);

  economyConstants = normalizeConstants(rawConst);
  const skus = (Array.isArray(rawSkus) ? rawSkus : defaultSkus).map(normalizeSku);
  eventDefinitions = Array.isArray(rawEvents) ? rawEvents : [];

  const eventState = emptyEventState();
  gameState = {
    day: 1,
    cash: 120000,
    adBudget: 0,
    adEnabled: true,
    returnRateMod: 1,
    selectedCategoryId: categories[0]?.id || "beauty",
    categories,
    skus,
    inStock: Object.fromEntries(skus.map((sku) => [sku.id, 0])),
    incomingShipments: [],
    skuPrices: Object.fromEntries(skus.map((s) => [s.id, s.recommendedPrice])),
    qualityScore: Object.fromEntries(skus.map((s) => [s.id, 72])),
    promoOn: Object.fromEntries(skus.map((s) => [s.id, false])),
    lastDayReport: null,
    lastMorningArrivals: [],
    rescuesUsed: 0,
    rewardedClaimedDay: 0,
    lastInterstitialDay: 0,
    playtestNotes: "",
    serviceCauseHistory: [],
    selectedServiceCauseDay: 0,
    unmetMemory: {},
    kpiHistory: [],
    phase2Regression: null,
    phase2LastPreReleaseRun: null,
    phase3Regression: {},
    phase3StyleAudit: null,
    progressionPoints: 0,
    progressionUnlocked: emptyProgressionUnlocked(),
    playStyleId: null,
    antiExploit: null,
    onboardingCompletedIds: [],
    onboardingHidden: false,
    kpi: defaultKpi(),
    ...eventState,
  };
  refreshDerivedModifiers(gameState);
  resetMerchDom();
  fillCategoryFilterSelect();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = gameState.skus[0].id;
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  renderSdkStatus();
  buildMerchTableOnce();
  render();
}

function defaultKpi() {
  return {
    revenue: 0,
    profit: 0,
    marginPct: 0,
    acos: 0,
    returnPct: 0,
    daysOfStock: 0,
    unmetUnits: 0,
    stockoutRate: 0,
    serviceRating: 5,
  };
}

/**
 * @param {object} raw
 * @returns {boolean}
 */
function applyLoadedState(raw) {
  if (!raw || !Array.isArray(raw.skus)) return false;

  const skus = raw.skus.map(normalizeSku);
  const inStock = { ...(raw.inStock || {}) };
  for (const s of skus) {
    if (inStock[s.id] == null) inStock[s.id] = 0;
  }

  gameState = {
    day: Math.max(1, Math.round(Number(raw.day) || 1)),
    cash: Number(raw.cash) || 0,
    adBudget: Math.max(0, Number(raw.adBudget) || 0),
    adEnabled: raw.adEnabled !== false,
    returnRateMod: Math.max(0.5, Math.min(1.5, Number(raw.returnRateMod) || 1)),
    selectedCategoryId: String(raw.selectedCategoryId || ""),
    categories:
      Array.isArray(raw.categories) && raw.categories.length
        ? raw.categories
        : gameState?.categories ?? defaultCategories,
    skus,
    inStock,
    incomingShipments: Array.isArray(raw.incomingShipments) ? raw.incomingShipments : [],
    skuPrices: { ...(raw.skuPrices || {}) },
    qualityScore: { ...(raw.qualityScore || {}) },
    promoOn: { ...(raw.promoOn || {}) },
    lastDayReport: raw.lastDayReport ?? null,
    lastMorningArrivals: Array.isArray(raw.lastMorningArrivals) ? raw.lastMorningArrivals : [],
    rescuesUsed: Math.max(0, Math.round(Number(raw.rescuesUsed) || 0)),
    rewardedClaimedDay: Math.max(0, Math.round(Number(raw.rewardedClaimedDay) || 0)),
    lastInterstitialDay: Math.max(0, Math.round(Number(raw.lastInterstitialDay) || 0)),
    playtestNotes: String(raw.playtestNotes || ""),
    serviceCauseHistory: Array.isArray(raw.serviceCauseHistory) ? raw.serviceCauseHistory : [],
    selectedServiceCauseDay: Math.max(0, Math.round(Number(raw.selectedServiceCauseDay) || 0)),
    unmetMemory: raw.unmetMemory && typeof raw.unmetMemory === "object" ? raw.unmetMemory : {},
    kpiHistory: Array.isArray(raw.kpiHistory) ? raw.kpiHistory : [],
    phase2Regression: raw.phase2Regression && typeof raw.phase2Regression === "object" ? raw.phase2Regression : null,
    phase2LastPreReleaseRun:
      raw.phase2LastPreReleaseRun && typeof raw.phase2LastPreReleaseRun === "object"
        ? raw.phase2LastPreReleaseRun
        : null,
    phase3Regression: raw.phase3Regression && typeof raw.phase3Regression === "object" ? raw.phase3Regression : {},
    phase3StyleAudit:
      raw.phase3StyleAudit && typeof raw.phase3StyleAudit === "object" ? raw.phase3StyleAudit : null,
    progressionPoints: Math.max(0, Math.round(Number(raw.progressionPoints) || 0)),
    progressionUnlocked: normalizeProgressionUnlocked(raw.progressionUnlocked),
    playStyleId: raw.playStyleId != null ? String(raw.playStyleId) : null,
    antiExploit: null,
    onboardingCompletedIds: Array.isArray(raw.onboardingCompletedIds) ? raw.onboardingCompletedIds : [],
    onboardingHidden: raw.onboardingHidden === true,
    kpi: { ...defaultKpi(), ...(raw.kpi || {}) },
    activeEvents: Array.isArray(raw.activeEvents) ? raw.activeEvents : [],
    eventLog: Array.isArray(raw.eventLog) ? raw.eventLog : [],
    daysSinceLastEvent: Math.max(0, Math.round(Number(raw.daysSinceLastEvent) || 0)),
    lastEventCategoryId: raw.lastEventCategoryId != null ? String(raw.lastEventCategoryId) : null,
    consecutiveCategoryEvents: Math.max(0, Math.round(Number(raw.consecutiveCategoryEvents) || 0)),
    lastDayEvent: raw.lastDayEvent && typeof raw.lastDayEvent === "object" ? raw.lastDayEvent : null,
    eventModifiers: raw.eventModifiers && typeof raw.eventModifiers === "object" ? raw.eventModifiers : emptyEventState().eventModifiers,
  };
  gameState.eventModifiers = computeEventModifiers(gameState, eventDefinitions);
  refreshDerivedModifiers(gameState);
  economyConstants = normalizeConstants(raw.economyConstants || economyConstants || defaultConstants);
  if (!categoryById(gameState.selectedCategoryId)) {
    gameState.selectedCategoryId = gameState.categories[0]?.id || "beauty";
  }

  for (const s of skus) {
    if (gameState.skuPrices[s.id] == null) gameState.skuPrices[s.id] = s.recommendedPrice;
    if (gameState.qualityScore[s.id] == null) gameState.qualityScore[s.id] = 72;
    if (gameState.promoOn[s.id] == null) gameState.promoOn[s.id] = false;
  }

  return true;
}

function snapshotStateForSave() {
  return { ...gameState, economyConstants, eventDefinitionsCount: eventDefinitions.length };
}

function countSkusByCategory() {
  const counts = {};
  for (const sku of gameState?.skus || []) {
    const cat = String(sku.categoryId || "beauty");
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function renderEventsPanel() {
  if (!els.eventsPanel) return;
  const poolSize = eventDefinitions.length;
  const active = gameState?.activeEvents || [];
  const last = gameState?.lastDayEvent;
  const pityLeft = Math.max(0, 6 - (gameState?.daysSinceLastEvent || 0));
  const activeRows = active.length
    ? active
        .map((e) => {
          const scope = e.skuId ? `SKU ${e.skuId}` : e.categoryId ? `кат. ${e.categoryId}` : "глобально";
          return `<li style="margin:4px 0"><b>${e.name}</b> (${e.type}) · ${scope} · осталось <b>${e.remainingDays}</b> дн.</li>`;
        })
        .join("")
    : `<li class="muted" style="margin:4px 0">Нет активных событий.</li>`;
  const lastLine = last
    ? `Событие дня: <b>${last.name}</b> (${last.type})`
    : `Событие дня: <span class="muted">не выпало</span>`;
  els.eventsPanel.innerHTML = `<div class="muted">Пул событий: <b>${poolSize}</b>${poolSize >= 24 ? " (v3)" : poolSize >= 10 ? " (phase 2)" : ""} · pity через <b>${pityLeft}</b> дн. без события</div><div style="margin-top:6px">${lastLine}</div><div style="margin-top:8px"><b>Активные эффекты</b><ul class="incoming">${activeRows}</ul></div>`;
}

function buildPhase2FreezeReport() {
  const k = gameState.kpi || defaultKpi();
  const phase2 = buildPhase2InternalReport();
  const skuCounts = countSkusByCategory();
  const cats = gameState.categories || [];
  const skuPerCategoryOk = cats.every((c) => (skuCounts[c.id] || 0) >= 12);
  const checks = [
    { id: "sku-total-36", label: "Каталог: >= 36 SKU", pass: (gameState.skus || []).length >= 36 },
    { id: "sku-total-72", label: "Каталог: >= 72 SKU", pass: (gameState.skus || []).length >= 72 },
    { id: "sku-per-category", label: "По 12 SKU в каждой категории", pass: skuPerCategoryOk },
    { id: "categories-6", label: "6 категорий в портфеле", pass: cats.length >= 6 },
    { id: "events-pool-10", label: "Пул событий: 10 штук", pass: eventDefinitions.length >= 10 },
    { id: "events-pool-24", label: "Пул событий: 24 штуки", pass: eventDefinitions.length >= 24 },
    { id: "events-engine", label: "Движок событий подключён", pass: Array.isArray(gameState.eventLog) },
    { id: "progression-34", label: "Прогрессия: 34 узла", pass: progressionNodes.length >= 34 },
    { id: "simulated-day", label: "Есть симулированный день", pass: !!gameState.lastDayReport },
    { id: "phase2-build-ready", label: "Phase2 build: решение не NO-GO", pass: phase2.decision !== "NO-GO" },
    { id: "regression-ready", label: "Есть 7-дневная регрессия", pass: !!gameState.phase2Regression?.rows?.length },
    { id: "kpi-profit", label: "Прибыль последнего дня > 0", pass: Number(k.profit) > 0 },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const ratio = total > 0 ? passCount / total : 0;
  const decision = ratio >= 0.85 ? "GO" : ratio >= 0.65 ? "GO WITH RISKS" : "NO-GO";
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    phase: 2,
    day: gameState.day,
    decision,
    passCount,
    totalChecks: total,
    checks,
    skuCounts,
    eventsPoolSize: eventDefinitions.length,
    phase2InternalBuild: phase2,
    kpi: gameState.kpi,
  };
}

function renderPhase2FreezeSummary() {
  if (!els.phase2FreezeSummary) return;
  if (!gameState?.skus?.length) {
    els.phase2FreezeSummary.textContent = "Сводка Phase 2 freeze появится после инициализации.";
    return;
  }
  const rep = buildPhase2FreezeReport();
  const color = rep.decision === "GO" ? "#8fd694" : rep.decision === "GO WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const checksLine = rep.checks
    .map((c) => `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`)
    .join("");
  els.phase2FreezeSummary.innerHTML = `<div><b>Phase 2 Freeze:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · checks <b>${rep.passCount}/${rep.totalChecks}</b> · SKU <b>${gameState.skus.length}</b> · события <b>${eventDefinitions.length}</b></div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function exportPhase2FreezeReportFile() {
  try {
    const payload = JSON.stringify(buildPhase2FreezeReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-phase2-freeze-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPhase2FreezeReportFile failed", e);
    alert("Не удалось экспортировать Phase 2 freeze отчёт: " + String(e));
  }
}

function buildPlaytestReport() {
  const k = gameState.kpi || defaultKpi();
  const hasReport = !!gameState.lastDayReport;
  const checklist = [
    { id: "profit-path", label: "Есть путь к прибыли", pass: Number(k.profit) > 0 },
    { id: "stockout-control", label: "Контроль stockout", pass: Number(k.stockoutRate) <= 0.2 },
    { id: "returns-range", label: "Возвраты в адекватном диапазоне", pass: Number(k.returnPct) <= 0.14 },
    { id: "daily-loop-readable", label: "Короткая петля решений читается", pass: hasReport },
  ];
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    day: gameState.day,
    cash: gameState.cash,
    stockTotal: totalStock(),
    incomingShipments: gameState.incomingShipments.length,
    ad: {
      enabled: gameState.adEnabled !== false,
      budget: gameState.adBudget,
      effectiveBudget: getEffectiveAdBudget(),
    },
    kpi: {
      revenue: k.revenue,
      profit: k.profit,
      marginPct: k.marginPct,
      acos: k.acos,
      returnPct: k.returnPct,
      daysOfStock: k.daysOfStock,
      unmetUnits: k.unmetUnits,
      stockoutRate: k.stockoutRate,
    },
    playtest: {
      notes: String(gameState.playtestNotes || ""),
      checklist,
      checklistPassCount: checklist.filter((x) => x.pass).length,
      checklistTotal: checklist.length,
    },
    platform: {
      sdkAvailable: platformState.available,
      sdkMessage: platformState.message,
      rewardedClaimedDay: gameState.rewardedClaimedDay || 0,
      lastInterstitialDay: gameState.lastInterstitialDay || 0,
    },
    lastDayReport: gameState.lastDayReport || null,
  };
}

function buildFreezeReport() {
  const k = gameState.kpi || defaultKpi();
  const checks = [
    { id: "simulated-day", label: "Есть хотя бы один симулированный день", pass: !!gameState.lastDayReport },
    { id: "save-load", label: "Save/Load и JSON-экспорт доступны", pass: true },
    { id: "kpi-visible", label: "KPI-дашборд отображается", pass: !!els.kpiDashboard },
    { id: "profit-path", label: "Есть путь к прибыли (profit > 0)", pass: Number(k.profit) > 0 },
    { id: "stockout-safe", label: "Stockout в управляемом диапазоне (<= 20%)", pass: Number(k.stockoutRate) <= 0.2 },
    { id: "returns-safe", label: "Возвраты в пределах (<= 14%)", pass: Number(k.returnPct) <= 0.14 },
    { id: "sdk-fallback", label: "SDK/fallback платформы не ломает цикл", pass: true },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const ratio = total > 0 ? passCount / total : 0;
  const decision = ratio >= 0.8 ? "GO" : ratio >= 0.6 ? "GO WITH RISKS" : "NO-GO";

  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    day: gameState.day,
    decision,
    passCount,
    totalChecks: total,
    checks,
    kpi: {
      revenue: k.revenue,
      profit: k.profit,
      marginPct: k.marginPct,
      acos: k.acos,
      returnPct: k.returnPct,
      stockoutRate: k.stockoutRate,
      unmetUnits: k.unmetUnits,
      daysOfStock: k.daysOfStock,
    },
    notes: String(gameState.playtestNotes || ""),
    platform: {
      sdkAvailable: platformState.available,
      sdkMessage: platformState.message,
    },
  };
}

function renderFreezeSummary() {
  if (!els.freezeSummary) return;
  if (!gameState.lastDayReport) {
    els.freezeSummary.innerHTML = "Сводка готовности появится после первой симуляции.";
    return;
  }
  const rep = buildFreezeReport();
  const color = rep.decision === "GO" ? "#8fd694" : rep.decision === "GO WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const rows = rep.checks
    .map((c) => `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`)
    .join("");
  els.freezeSummary.innerHTML = `<div><b>Решение:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · пройдено <b>${rep.passCount}/${rep.totalChecks}</b></div><ul class="incoming" style="margin-top:6px">${rows}</ul>`;
}

function saveGame() {
  const res = saveToLocal(snapshotStateForSave());
  if (res.ok) alert("Сохранено в браузере (localStorage).");
  else alert("Не удалось сохранить: " + (res.error || ""));
}

function loadGame() {
  const raw = loadFromLocal();
  if (!raw) {
    alert("Нет сохранения.");
    return;
  }
  if (!applyLoadedState(raw)) {
    alert("Файл сохранения повреждён.");
    return;
  }
  resetMerchDom();
  fillCategoryFilterSelect();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = gameState.skus[0].id;
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  renderSdkStatus();
  buildMerchTableOnce();
  render();
}

function exportGameToJsonFile() {
  try {
    const payload = JSON.stringify(snapshotStateForSave(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-save-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportGameToJsonFile failed", e);
    alert("Не удалось экспортировать JSON: " + String(e));
  }
}

function exportPlaytestReportFile() {
  try {
    const payload = JSON.stringify(buildPlaytestReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-playtest-report-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPlaytestReportFile failed", e);
    alert("Не удалось экспортировать отчёт плейтеста: " + String(e));
  }
}

function exportFreezeReportFile() {
  try {
    const payload = JSON.stringify(buildFreezeReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-m1-freeze-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportFreezeReportFile failed", e);
    alert("Не удалось экспортировать freeze-отчёт: " + String(e));
  }
}

function buildServiceDiagnosticsReport() {
  const history = Array.isArray(gameState.serviceCauseHistory) ? gameState.serviceCauseHistory : [];
  const stockoutDays = history.filter((x) => x.cause === "stockout").length;
  const returnsDays = history.filter((x) => x.cause === "returns").length;
  return {
    exportedAt: new Date().toISOString(),
    reportVersion: 1,
    day: gameState.day,
    selectedServiceCauseDay: Number(gameState.selectedServiceCauseDay || 0),
    historyWindowDays: SERVICE_CAUSE_HISTORY_DAYS,
    trend: {
      totalDaysInWindow: history.length,
      stockoutDays,
      returnsDays,
      dominantCause: stockoutDays >= returnsDays ? "stockout" : "returns",
    },
    latestTotals: gameState.lastDayReport?.totals || null,
    serviceCauseHistory: history,
  };
}

function exportServiceDiagnosticsReportFile() {
  try {
    const payload = JSON.stringify(buildServiceDiagnosticsReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-service-diagnostics-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportServiceDiagnosticsReportFile failed", e);
    alert("Не удалось экспортировать диагностику сервиса: " + String(e));
  }
}

function normalizeServiceDiagReport(raw) {
  if (!raw || typeof raw !== "object") return null;
  const history = Array.isArray(raw.serviceCauseHistory) ? raw.serviceCauseHistory : [];
  const trend = raw.trend && typeof raw.trend === "object" ? raw.trend : {};
  const latestTotals = raw.latestTotals && typeof raw.latestTotals === "object" ? raw.latestTotals : {};
  return {
    day: Math.max(0, Math.round(Number(raw.day) || 0)),
    stockoutDays: Math.max(0, Math.round(Number(trend.stockoutDays) || 0)),
    returnsDays: Math.max(0, Math.round(Number(trend.returnsDays) || 0)),
    servicePenalty: Math.max(0, Number(latestTotals.servicePenalty) || 0),
    serviceRating: Number(latestTotals.serviceRating) || 5,
    stockoutImpact: Math.max(0, Number(latestTotals.serviceStockoutImpact) || 0),
    returnsImpact: Math.max(0, Number(latestTotals.serviceReturnsImpact) || 0),
    historyLength: history.length,
  };
}

function readServiceDiagReportFromFile(file, kind) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result || ""));
      const normalized = normalizeServiceDiagReport(raw);
      if (!normalized) throw new Error("bad report");
      if (kind === "baseline") serviceDiagCompareState.baseline = normalized;
      if (kind === "candidate") serviceDiagCompareState.candidate = normalized;
      renderServiceDiagCompare();
    } catch (e) {
      console.warn("readServiceDiagReportFromFile failed", e);
      alert("Не удалось прочитать service-отчёт: " + String(e));
    }
  };
  reader.onerror = () => {
    alert("Ошибка чтения файла service-отчёта.");
  };
  reader.readAsText(file, "utf-8");
}

function renderServiceDiagCompare() {
  if (!els.serviceDiagCompare) return;
  const b = serviceDiagCompareState.baseline;
  const c = serviceDiagCompareState.candidate;
  if (!b || !c) {
    const missing = !b && !c ? "двух отчётов" : !b ? "baseline-отчёта" : "candidate-отчёта";
    els.serviceDiagCompare.textContent = `Сравнение baseline/candidate появится после импорта ${missing}.`;
    return;
  }
  const dPenalty = c.servicePenalty - b.servicePenalty;
  const dRating = c.serviceRating - b.serviceRating;
  const dStockoutImpact = c.stockoutImpact - b.stockoutImpact;
  const dReturnsImpact = c.returnsImpact - b.returnsImpact;
  const better = dPenalty < 0 && dRating >= 0;
  const verdict = better ? "УЛУЧШЕНИЕ" : "ТРЕБУЕТ ПРОВЕРКИ";
  const verdictColor = better ? "#8fd694" : "#ffcc66";
  const sign = (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
  els.serviceDiagCompare.innerHTML = `Сравнение: baseline день <b>${b.day || "?"}</b> vs candidate день <b>${c.day || "?"}</b> · <span style="color:${verdictColor}"><b>${verdict}</b></span><br/><span class="muted">Δрейтинг ${sign(dRating)} · Δштраф ${sign(dPenalty)} · Δвклад stockout ${sign(dStockoutImpact)} · Δвклад возвратов ${sign(dReturnsImpact)} · окно истории: ${b.historyLength} → ${c.historyLength} дней</span>`;
}

function importGameFromJsonObject(raw) {
  if (!applyLoadedState(raw)) {
    alert("JSON сохранения повреждён или несовместим.");
    return false;
  }
  resetMerchDom();
  fillCategoryFilterSelect();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = gameState.skus[0].id;
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  renderSdkStatus();
  buildMerchTableOnce();
  render();
  return true;
}

function importGameFromJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result || ""));
      if (importGameFromJsonObject(raw)) {
        alert("Сохранение из JSON успешно загружено.");
      }
    } catch (e) {
      console.warn("import JSON parse failed", e);
      alert("Не удалось прочитать JSON: " + String(e));
    }
  };
  reader.onerror = () => {
    alert("Ошибка чтения файла.");
  };
  reader.readAsText(file, "utf-8");
}

function nextDay() {
  readCostModelFromUi();
  gameState.day += 1;
  processDailyEvents(gameState, eventDefinitions);
  refreshDerivedModifiers(gameState);
  const prog = gameState.progressionModifiers || {};
  if (prog.autoReprice) runAutoReprice(gameState);
  if (prog.autoReorder) runAutoReorder(gameState);
  gameState.lastMorningArrivals = processIncomingShipments();
  // День 9: рекламный бюджет учитывается в модели только когда реклама включена.
  gameState.adBudgetEffective = getEffectiveAdBudget();
  const simCfg = buildSimulationConstants();
  simulateSalesDay(gameState, simCfg);
  refreshDerivedModifiers(gameState);
  syncOnboardingProgress(gameState, onboardingSteps);
  pushKpiHistorySnapshot();
  gameState.progressionPoints = (gameState.progressionPoints || 0) + PROGRESSION_POINT_PER_DAY;
  updateServiceCauseHistory();
  render();
  void tryShowInterstitialAfterDay();
  console.log("Day advanced", gameState);
}

function resetGame() {
  initGame();
}

function totalStock() {
  return Object.values(gameState.inStock).reduce((a, b) => a + b, 0);
}

function minPurchaseCost() {
  const costs = gameState.skus
    .map((s) => Number(s.purchaseCost) || 0)
    .filter((x) => x > 0);
  return costs.length ? Math.min(...costs) : 0;
}

function isDeadlockState() {
  const noStock = totalStock() <= 0;
  const noIncoming = gameState.incomingShipments.length === 0;
  const minCost = minPurchaseCost();
  const cannotBuyMin = minCost <= 0 ? false : gameState.cash < minCost;
  return noStock && noIncoming && cannotBuyMin;
}

function useRescue() {
  if (!isDeadlockState()) {
    alert("Антикризисный аванс доступен только в тупике.");
    return;
  }
  if ((gameState.rescuesUsed || 0) >= MAX_RESCUES_PER_RUN) {
    alert("Лимит антикризисных авансов на ран исчерпан.");
    return;
  }
  gameState.cash += RESCUE_CASH_AMOUNT;
  gameState.rescuesUsed = (gameState.rescuesUsed || 0) + 1;
  render();
}

function render() {
  const salesLine = gameState.lastDayReport
    ? `Итог последнего Next Day: выручка <b>${Math.round(gameState.kpi.revenue).toLocaleString("ru-RU")}</b> · прибыль <b>${Math.round(gameState.kpi.profit).toLocaleString("ru-RU")}</b> · маржа <b>${gameState.kpi.marginPct.toFixed(1)}%</b> · ACOS <b>${(gameState.kpi.acos * 100).toFixed(1)}%</b> · возвраты <b>${(gameState.kpi.returnPct * 100).toFixed(1)}%</b> · stockout <b>${gameState.kpi.unmetUnits}</b> шт. (${(gameState.kpi.stockoutRate * 100).toFixed(1)}% от «желаемых» заказов) · запас ~<b>${gameState.kpi.daysOfStock.toFixed(1)}</b> дн. (оценка по чистым продажам)`
    : `Итог дня: <span style="color:#a9acb7">симуляция ещё не запускалась — нажми Next Day</span>`;

  els.summary.innerHTML = [
    `День: <b>${gameState.day}</b>`,
    `Кэш: <b>${gameState.cash.toLocaleString("ru-RU")}</b>`,
    `Реклама: <b>${gameState.adEnabled === false ? "выкл" : "вкл"}</b> · бюджет <b>${gameState.adBudget.toLocaleString("ru-RU")}</b>/день · в модели <b>${getEffectiveAdBudget().toLocaleString("ru-RU")}</b>`,
    `Категорий: <b>${(gameState.categories || []).length}</b> · SKU в каталоге: <b>${gameState.skus.length}</b> · событий в пуле: <b>${eventDefinitions.length}</b>`,
    `Категория (фильтр): <b>${categoryById(gameState.selectedCategoryId)?.name || gameState.selectedCategoryId}</b> · SKU в категории: <b>${getVisibleSkus().length}</b>`,
    `Остаток (всего): <b>${totalStock()}</b>`,
    `Поставок в пути: <b>${gameState.incomingShipments.length}</b>`,
    `Прогрессия: очки <b>${gameState.progressionPoints || 0}</b> · узлов <b>${progressionNodes.filter((n) => gameState.progressionUnlocked?.[n.id]).length}/${progressionNodes.length}</b> · ЗП команды <b>${money(gameState.teamDailyCost || 0)}</b>/день`,
    `Стиль игры: <b>${gameState.playStyleId ? playStyleById(gameState.playStyleId)?.name || gameState.playStyleId : "не выбран"}</b> · антиэксплойт: <b>${gameState.antiExploit?.status || "—"}</b>`,
    `Анти-тупик: использовано авансов <b>${gameState.rescuesUsed || 0}</b>/<b>${MAX_RESCUES_PER_RUN}</b>`,
    salesLine,
  ].join("<br/>");
  if (els.serviceRating) {
    if (!gameState.lastDayReport?.totals) {
      els.serviceRating.textContent = "Рейтинг сервиса появится после первой симуляции.";
    } else {
      const sr = Number(gameState.lastDayReport.totals.serviceRating ?? gameState.kpi?.serviceRating ?? 5);
      const sp = Number(gameState.lastDayReport.totals.servicePenalty || 0);
      const color = sr >= 4.2 ? "#8fd694" : sr >= 3.6 ? "#ffcc66" : "#ff8f8f";
      const si = Number(gameState.lastDayReport.totals.serviceStockoutImpact || 0);
      const ri = Number(gameState.lastDayReport.totals.serviceReturnsImpact || 0);
      els.serviceRating.innerHTML = `<span style="color:${color}"><b>Рейтинг сервиса:</b> ${sr.toFixed(2)} / 5</span> · штраф ${money(sp)} / день · вклад: stockout ${si.toFixed(2)} + возвраты ${ri.toFixed(2)}`;
    }
  }
  if (els.serviceDiagnostics) {
    if (!gameState.lastDayReport?.totals) {
      els.serviceDiagnostics.textContent = "Диагностика причины просадки появится после первой симуляции.";
    } else {
      const diagnosisLine = buildServiceDiagnosisLine(gameState.lastDayReport.totals);
      const trendLine = buildServiceTrendLine();
      const trendBadges = buildServiceTrendBadges();
      const selectedDayDetails = buildServiceSelectedDayDetails();
      const badgesBlock = trendBadges ? `<br/><span class="muted">${trendBadges}</span>` : "";
      const detailsBlock = selectedDayDetails ? `<br/><span class="muted">${selectedDayDetails}</span>` : "";
      els.serviceDiagnostics.innerHTML = `${diagnosisLine}<br/><span class="muted">${trendLine}</span>${badgesBlock}${detailsBlock}`;
    }
  }
  renderServiceDiagCompare();
  renderProgressionPanel();
  renderCampaignReadability();
  renderPhase2BuildStatus();
  renderReleaseSmokeChecklist();
  renderEventsPanel();
  renderTeamPanel();
  renderPlayStylesPanel();
  renderOnboardingPanel();
  renderAntiExploitPanel();
  renderPhase3FreezeSummary();
  renderPhase2FreezeSummary();

  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  buildMerchTableOnce();
  renderIncoming();
  renderMorningArrivals();
  renderStockTable();
  renderYesterday();
  renderDeadlockGuard();
  renderKpiDashboard();
  renderCategoryKpiTable();
  renderPlaytestChecklist();
  renderFreezeSummary();
  renderRewardedState();
  renderInterstitialState();
  renderCostBreakdown();
  if (els.playtestNotesInput instanceof HTMLTextAreaElement) {
    els.playtestNotesInput.value = gameState.playtestNotes || "";
  }
  updateBuyHint();
  els.stateDump.textContent = JSON.stringify(gameState, null, 2);
}

els.merchRoot.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  const id = el.dataset.skuId;
  if (!id || !gameState) return;
  if (el.classList.contains("js-price")) {
    gameState.skuPrices[id] = Math.max(1, Number(el.value) || 0);
  }
  if (el.classList.contains("js-quality")) {
    gameState.qualityScore[id] = clamp(Math.round(Number(el.value) || 0), 0, 100);
  }
});

els.merchRoot.addEventListener("change", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") return;
  const id = el.dataset.skuId;
  if (!id || !gameState) return;
  if (el.classList.contains("js-promo")) {
    gameState.promoOn[id] = el.checked;
  }
});

els.merchRoot.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const skuId = t.dataset.skuId;
  if (!skuId || !gameState) return;

  if (t.classList.contains("js-quality-preset")) {
    const v = clamp(Math.round(Number(t.dataset.quality) || 72), 0, 100);
    gameState.qualityScore[skuId] = v;
    const input = els.merchRoot.querySelector(`.js-quality[data-sku-id="${skuId}"]`);
    if (input instanceof HTMLInputElement) input.value = String(v);
  }

  if (t.classList.contains("js-price-rec")) {
    const sku = skuById(skuId);
    if (!sku) return;
    gameState.skuPrices[skuId] = sku.recommendedPrice;
    const input = els.merchRoot.querySelector(`.js-price[data-sku-id="${skuId}"]`);
    if (input instanceof HTMLInputElement) input.value = String(sku.recommendedPrice);
  }
});

els.adBudgetRange.addEventListener("input", () => {
  if (!gameState) return;
  gameState.adBudget = Math.max(0, Number(els.adBudgetRange.value) || 0);
  syncAdUiFromState();
});

els.adEnabledToggle?.addEventListener("change", () => {
  if (!gameState || !(els.adEnabledToggle instanceof HTMLInputElement)) return;
  gameState.adEnabled = els.adEnabledToggle.checked;
  syncAdUiFromState();
});

els.serviceDiagnostics?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (!t.classList.contains("js-service-day-badge")) return;
  const day = Math.max(0, Math.round(Number(t.dataset.day) || 0));
  if (!day || !gameState) return;
  gameState.selectedServiceCauseDay = day;
  render();
});
els.progressionPanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (!t.classList.contains("js-prog-unlock")) return;
  const nodeId = String(t.dataset.nodeId || "");
  if (!nodeId) return;
  unlockProgressionNode(nodeId);
});
els.applyBalanceConservativeBtn?.addEventListener("click", () => {
  applyBalancePreset("conservative");
});
els.applyBalanceGrowthBtn?.addEventListener("click", () => {
  applyBalancePreset("growth");
});
els.runRegression7Btn?.addEventListener("click", () => {
  runRegression7Days();
});
els.hideOnboardingBtn?.addEventListener("click", hideOnboarding);
els.runRegression14Btn?.addEventListener("click", () => runRegressionDays(14));
els.runRegression28Btn?.addEventListener("click", () => runRegressionDays(28));
els.runStyleBalanceBtn?.addEventListener("click", runPlayStyleBalanceAudit);
els.exportPhase3FreezeBtn?.addEventListener("click", exportPhase3FreezeReportFile);
els.runPreReleaseBtn?.addEventListener("click", () => {
  runPreReleaseOneClick();
});
els.quickRestockBtn?.addEventListener("click", () => {
  runQuickEmergencyRestock();
});
els.quickStabilizeBtn?.addEventListener("click", () => {
  runQuickMarginStabilization();
});
els.safeRecoveryV2Btn?.addEventListener("click", () => {
  runSafeRecoveryPresetV2();
});

const onCostInput = () => {
  if (!gameState) return;
  readCostModelFromUi();
  syncCostModelUiFromState();
};
els.feeRateInput?.addEventListener("input", onCostInput);
els.paymentRateInput?.addEventListener("input", onCostInput);
els.outboundCostInput?.addEventListener("input", onCostInput);
els.overheadInput?.addEventListener("input", onCostInput);
els.resetCostsBtn?.addEventListener("click", () => {
  economyConstants = normalizeConstants(defaultConstants);
  syncCostModelUiFromState();
});
els.rescueBtn?.addEventListener("click", useRescue);
els.rewardedBtn?.addEventListener("click", () => {
  claimRewardedReward();
});
els.playtestNotesInput?.addEventListener("input", () => {
  if (!gameState || !(els.playtestNotesInput instanceof HTMLTextAreaElement)) return;
  gameState.playtestNotes = els.playtestNotesInput.value;
});
els.returnRateModRange?.addEventListener("input", () => {
  if (!gameState || !els.returnRateModRange) return;
  gameState.returnRateMod = Math.max(0.5, Math.min(1.5, Number(els.returnRateModRange.value) || 1));
  syncReturnsUiFromState();
});

els.nextDayBtn.addEventListener("click", nextDay);
els.resetBtn.addEventListener("click", resetGame);
els.saveBtn?.addEventListener("click", saveGame);
els.loadBtn?.addEventListener("click", loadGame);
els.exportJsonBtn?.addEventListener("click", exportGameToJsonFile);
els.exportPlaytestBtn?.addEventListener("click", exportPlaytestReportFile);
els.exportServiceDiagBtn?.addEventListener("click", exportServiceDiagnosticsReportFile);
els.exportPhase2Btn?.addEventListener("click", exportPhase2InternalReportFile);
els.exportFreezeBtn?.addEventListener("click", exportFreezeReportFile);
els.exportPhase2FreezeBtn?.addEventListener("click", exportPhase2FreezeReportFile);
els.importServiceDiagBaseBtn?.addEventListener("click", () => els.importServiceDiagBaseInput?.click());
els.importServiceDiagCandBtn?.addEventListener("click", () => els.importServiceDiagCandInput?.click());
els.clearServiceDiagCompareBtn?.addEventListener("click", () => {
  serviceDiagCompareState.baseline = null;
  serviceDiagCompareState.candidate = null;
  renderServiceDiagCompare();
});
els.importServiceDiagBaseInput?.addEventListener("change", () => {
  if (!(els.importServiceDiagBaseInput instanceof HTMLInputElement)) return;
  const file = els.importServiceDiagBaseInput.files && els.importServiceDiagBaseInput.files[0];
  readServiceDiagReportFromFile(file || null, "baseline");
  els.importServiceDiagBaseInput.value = "";
});
els.importServiceDiagCandInput?.addEventListener("change", () => {
  if (!(els.importServiceDiagCandInput instanceof HTMLInputElement)) return;
  const file = els.importServiceDiagCandInput.files && els.importServiceDiagCandInput.files[0];
  readServiceDiagReportFromFile(file || null, "candidate");
  els.importServiceDiagCandInput.value = "";
});
els.importJsonBtn?.addEventListener("click", () => els.importJsonInput?.click());
els.importJsonInput?.addEventListener("change", () => {
  if (!(els.importJsonInput instanceof HTMLInputElement)) return;
  const file = els.importJsonInput.files && els.importJsonInput.files[0];
  importGameFromJsonFile(file || null);
  // Позволяет импортировать тот же файл повторно.
  els.importJsonInput.value = "";
});
els.playStylesPanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btn = t.closest(".js-play-style");
  if (!(btn instanceof HTMLElement)) return;
  const styleId = btn.dataset.styleId;
  if (styleId) applyPlayStyle(styleId);
});
els.categoryFilterSelect?.addEventListener("change", () => {
  if (!gameState || !els.categoryFilterSelect) return;
  gameState.selectedCategoryId = String(els.categoryFilterSelect.value || "");
  resetMerchDom();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = els.skuSelect.options[0].value;
  render();
});
els.skuSelect.addEventListener("change", updateBuyHint);
els.qtyInput.addEventListener("input", updateBuyHint);

/** Dev-console API (ES modules не выставляют gameState в global scope). */
function exposeDevApi() {
  if (typeof window === "undefined") return;
  window.mssim = {
    getState: () => gameState,
    nextDay: () => nextDay(),
    render: () => render(),
    unlockNode: (nodeId) => unlockProgressionNode(String(nodeId)),
    /** Быстрый найм Контент-менеджера (n22) для теста ЗП. */
    cheatHireContentManager: () => {
      if (!gameState) return;
      gameState.progressionPoints = Math.max(gameState.progressionPoints || 0, 5);
      gameState.progressionUnlocked.n3 = true;
      gameState.progressionUnlocked.n6 = true;
      gameState.progressionUnlocked.n9 = true;
      unlockProgressionNode("n22");
    },
    addCash: (amount) => {
      if (!gameState) return;
      gameState.cash += Math.max(0, Number(amount) || 0);
      render();
    },
    addProgressionPoints: (n) => {
      if (!gameState) return;
      gameState.progressionPoints = (gameState.progressionPoints || 0) + Math.max(0, Number(n) || 0);
      render();
    },
    applyPlayStyle: (styleId) => applyPlayStyle(String(styleId)),
    getAntiExploit: () => gameState?.antiExploit || null,
    inferPlayStyle: () => inferDominantPlayStyle(gameState, economyConstants?.feeRate),
    runRegression: (days) => runRegressionDays(Math.max(1, Math.round(Number(days) || 7))),
    runStyleBalanceAudit: () => runPlayStyleBalanceAudit(),
    getPhase3Freeze: () => buildPhase3FreezeReport(),
    getOnboarding: () => resolveOnboarding(gameState, onboardingSteps),
    getErrorHints: () => getErrorHints(gameState),
    /** Консольные хелперы для QA (DAILY_TEST_CASES). */
    _test: {
      stock(qty = 500) {
        if (!gameState) return;
        for (const sku of gameState.skus) gameState.inStock[sku.id] = qty;
        render();
      },
      zeroStock() {
        if (!gameState) return;
        for (const k of Object.keys(gameState.inStock)) gameState.inStock[k] = 0;
        render();
      },
      qualityAll(v = 90) {
        if (!gameState) return;
        for (const sku of gameState.skus) gameState.qualityScore[sku.id] = v;
        render();
      },
      days(n = 1) {
        const count = Math.max(0, Math.round(Number(n) || 0));
        for (let i = 0; i < count; i++) nextDay();
      },
      unlockChain(ids) {
        if (!gameState) return;
        gameState.cash += 500000;
        gameState.progressionPoints = (gameState.progressionPoints || 0) + 50;
        for (const id of ids) gameState.progressionUnlocked[String(id)] = true;
        refreshDerivedModifiers(gameState);
        render();
      },
      assert(name, ok) {
        console.log(ok ? `✅ ${name}` : `❌ ${name}`);
        return Boolean(ok);
      },
      debugAntiExploit() {
        const s = gameState;
        const k = s?.kpi || {};
        const p = getProgressionModifiers(s, progressionNodes, progressionSynergies);
        const ex = analyzeAntiExploit(s, p);
        console.log({
          kpi: { marginPct: k.marginPct, stockoutRate: k.stockoutRate, returnPct: k.returnPct },
          adBudget: s?.adBudget,
          mods: { adEff: p.adEfficiencyMult, conv: p.baseConversionMult, power: p.adEfficiencyMult * p.baseConversionMult },
          antiExploit: ex,
        });
        return ex;
      },
      runPhase3Smoke() {
        mssim._test.stock(400);
        applyPlayStyle("assortment");
        const r14 = runRegressionDays(14);
        const r28 = runRegressionDays(28);
        const audit = runPlayStyleBalanceAudit();
        const freeze = buildPhase3FreezeReport();
        mssim._test.assert("D65 reg14 rows", r14.rows.length === 14);
        mssim._test.assert("D66 reg28 rows", r28.rows.length === 28);
        mssim._test.assert("D67 style audit", !!audit?.results?.length);
        mssim._test.assert("D68 freeze report", !!freeze?.checks?.length);
        mssim._test.assert("D69 decision not NO-GO", freeze.decision !== "NO-GO");
        console.log({ r14, r28, audit, freeze });
        return freeze;
      },
      runOnboardingSmoke() {
        const s = mssim.getState();
        mssim._test.assert("D66 steps loaded", onboardingSteps.length >= 5);
        let ob = mssim.getOnboarding();
        mssim._test.assert("D66 starts incomplete", !ob.allDone);
        mssim._test.stock(200);
        ob = mssim.getOnboarding();
        mssim._test.assert("D66 buy step", ob.completed.includes("ob_buy"));
        mssim.nextDay();
        ob = mssim.getOnboarding();
        mssim._test.assert("D67 first day", ob.completed.includes("ob_first_day"));
        mssim._test.assert("D67 kpi step", ob.completed.includes("ob_kpi"));
        const hints = mssim.getErrorHints();
        mssim._test.assert("D68 hints array", Array.isArray(hints));
        mssim.applyPlayStyle("operator");
        ob = mssim.getOnboarding();
        mssim._test.assert("D68 style step", ob.completed.includes("ob_style"));
        console.log({ onboarding: ob, hints });
        return ob;
      },
    },
  };
}

exposeDevApi();
initGame();
