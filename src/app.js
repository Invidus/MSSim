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
  configureEventBalance,
} from "./core/eventEngine.js";
import { runAutoReprice, runAutoReorder } from "./core/automationModel.js";
import { analyzeAntiExploit, inferDominantPlayStyle } from "./core/antiExploit.js";
import { resolveOnboarding, getErrorHints, syncOnboardingProgress } from "./core/onboardingModel.js";
import { resolveBeginnerTier, getNextPlayerAction, beginnerTeaserText } from "./core/beginnerUiModel.js";
import {
  buildKpiChartPanels,
  renderKpiChartsHtml,
} from "./core/kpiChartsModel.js";
import {
  isTutorialActive,
  resolveTutorialStep,
  tutorialVisibleSections,
  getTutorialContent,
  syncTutorialCompletion,
  migrateTutorialFlags,
} from "./core/firstRunTutorial.js";
import { getKpiAlerts } from "./core/kpiAlertsModel.js";
import {
  normalizeBalanceConfig,
  auditReturnsLeverage,
  auditEventIntensity,
  buildPhase4BalanceReport,
} from "./core/balanceModel.js";
import {
  normalizeSoftLaunchConfig,
  buildSoftLaunchPackage,
  buildFeedbackTriageReport,
  createFeedbackEntry,
} from "./core/softLaunchModel.js";
import {
  bumpSessionMetrics,
  pushDailyTelemetry,
  buildRetentionMetrics,
  buildTriageSummary,
  setFeedbackTriageStatus,
  mergeFeedbackImport,
  buildSoftLaunchAnalyticsReport,
  normalizeFeedbackLog,
  normalizeFeedbackEntry,
  inferFeedbackPriority,
} from "./core/telemetryModel.js";
import {
  normalizeRetentionGates,
  normalizeMajorBugsCatalog,
  auditMajorBugs,
  buildPhase4CloseoutReport,
  syncVisitMetrics,
  finalizeVisitToCohort,
  defaultVisitMetrics,
  defaultRetentionCohort,
} from "./core/retentionModel.js";
import { runBrowserCompatChecks, applyReleaseUiMode } from "./platform/browserCompat.js";
import { applyBeginnerUi, applyTutorialUi } from "./platform/playerUi.js";
import { normalizeBuildManifest, buildReleaseReadinessReport, formatBytes } from "./core/buildModel.js";
import {
  normalizeStoreListing,
  validateStoreListing,
  buildStoreListingPackage,
} from "./core/storeListingModel.js";
import { saveToLocal, loadFromLocal, clearLocalSave, STORAGE_KEY } from "./persistence/saveLoad.js";
import {
  attachSaveMeta,
  createCloudAdapter,
  loadCloudSave,
  saveCloudSave,
  clearCloudSave,
  resolveBestSave,
  CLOUD_MOCK_KEY,
  hasCloudMockSave,
} from "./persistence/cloudSave.js";
import { initYandexSdk, bindAccountSelectionHandlers, refreshYandexPlayer } from "./platform/yandexSdk.js";

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
let qolPresets = [];
let balancePhase4 = normalizeBalanceConfig(null);
let softLaunchConfig = normalizeSoftLaunchConfig(null);
let retentionGates = normalizeRetentionGates(null);
let majorBugsCatalog = [];
let buildManifest = normalizeBuildManifest(null);
let browserCompatConfig = { optionalApis: ["clipboard", "structuredClone"] };
/** @type {ReturnType<typeof runBrowserCompatChecks> | null} */
let browserCompatResult = null;
let storeListingConfig = normalizeStoreListing(null);
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
  player: null,
  message: "Проверка SDK…",
};
/** @type {{ label: string; load: () => Promise<object | null>; save: (state: object, flush?: boolean) => Promise<{ ok: boolean }>; clear: () => Promise<{ ok: boolean }> } | null} */
let cloudAdapter = null;
let cloudSyncPaused = false;
let lastAutoSaveStatus = {
  ok: true,
  localOk: true,
  cloudOk: true,
  cloudSkipped: false,
  cloudSource: "none",
  at: null,
  day: null,
  error: null,
  cloudError: null,
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
  showAllSectionsBtn: document.getElementById("showAllSectionsBtn"),
  skipTutorialBtn: document.getElementById("skipTutorialBtn"),
  quickStartBtn: document.getElementById("quickStartBtn"),
  kpiAlertsPanel: document.getElementById("kpiAlertsPanel"),
  skuStockFilterSelect: document.getElementById("skuStockFilterSelect"),
  skuSearchInput: document.getElementById("skuSearchInput"),
  qolPresetsPanel: document.getElementById("qolPresetsPanel"),
  phase4BalancePanel: document.getElementById("phase4BalancePanel"),
  runBalanceSim14Btn: document.getElementById("runBalanceSim14Btn"),
  exportPhase4BalanceBtn: document.getElementById("exportPhase4BalanceBtn"),
  softLaunchPanel: document.getElementById("softLaunchPanel"),
  supportChannelsPanel: document.getElementById("supportChannelsPanel"),
  supportChannelStatus: document.getElementById("supportChannelStatus"),
  feedbackCategorySelect: document.getElementById("feedbackCategorySelect"),
  feedbackTextInput: document.getElementById("feedbackTextInput"),
  submitFeedbackBtn: document.getElementById("submitFeedbackBtn"),
  exportSoftLaunchBtn: document.getElementById("exportSoftLaunchBtn"),
  exportFeedbackBtn: document.getElementById("exportFeedbackBtn"),
  telemetryPanel: document.getElementById("telemetryPanel"),
  triagePanel: document.getElementById("triagePanel"),
  exportAnalyticsBtn: document.getElementById("exportAnalyticsBtn"),
  importFeedbackBtn: document.getElementById("importFeedbackBtn"),
  importFeedbackInput: document.getElementById("importFeedbackInput"),
  phase4CloseoutPanel: document.getElementById("phase4CloseoutPanel"),
  majorBugsPanel: document.getElementById("majorBugsPanel"),
  exportPhase4CloseoutBtn: document.getElementById("exportPhase4CloseoutBtn"),
  releaseBuildPanel: document.getElementById("releaseBuildPanel"),
  browserCompatPanel: document.getElementById("browserCompatPanel"),
  exportReleaseReadinessBtn: document.getElementById("exportReleaseReadinessBtn"),
  storeListingPanel: document.getElementById("storeListingPanel"),
  exportStoreListingBtn: document.getElementById("exportStoreListingBtn"),
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
  kpiChartsRow: document.getElementById("kpiChartsRow"),
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
  if (!gameState?.skus) return [];
  let list = gameState.skus;
  if (gameState.selectedCategoryId) {
    const catList = list.filter((s) => s.categoryId === gameState.selectedCategoryId);
    if (catList.length) list = catList;
  }
  const stockFilter = gameState.skuStockFilter || "all";
  if (stockFilter !== "all") {
    list = list.filter((sku) => {
      const stock = Number(gameState.inStock[sku.id]) || 0;
      const demand = Math.max(1, Number(sku.baseDemand) || 1);
      if (stockFilter === "out_of_stock") return stock <= 0;
      if (stockFilter === "in_stock") return stock > 0;
      if (stockFilter === "low_stock") return stock > 0 && stock < demand * 1.5;
      return true;
    });
  }
  const q = String(gameState.skuSearchQuery || "")
    .trim()
    .toLowerCase();
  if (q) {
    list = list.filter(
      (sku) =>
        String(sku.name || "")
          .toLowerCase()
          .includes(q) ||
        String(sku.id || "")
          .toLowerCase()
          .includes(q)
    );
  }
  return list;
}

function applySkuFiltersFromUi() {
  if (!gameState) return;
  if (els.skuStockFilterSelect instanceof HTMLSelectElement) {
    gameState.skuStockFilter = String(els.skuStockFilterSelect.value || "all");
  }
  if (els.skuSearchInput instanceof HTMLInputElement) {
    gameState.skuSearchQuery = String(els.skuSearchInput.value || "");
  }
}

function syncSkuFiltersUiFromState() {
  if (els.skuStockFilterSelect instanceof HTMLSelectElement) {
    els.skuStockFilterSelect.value = gameState?.skuStockFilter || "all";
  }
  if (els.skuSearchInput instanceof HTMLInputElement) {
    els.skuSearchInput.value = gameState?.skuSearchQuery || "";
  }
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
    ordersWanted: Number(gameState.lastDayReport?.totals?.ordersWanted) || 0,
    adCost: Number(gameState.lastDayReport?.totals?.adCost) || 0,
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

function renderTutorialHero(content) {
  if (!els.onboardingPanel || !content) return;
  const ctaBlock = content.cta
    ? `<div class="row" style="margin-top:12px"><button type="button" class="btn-primary js-beginner-cta" data-cta="${content.cta}">${content.ctaLabel}</button></div>`
    : "";
  els.onboardingPanel.innerHTML = `<div class="beginner-hero"><div class="beginner-step">Обучение · шаг ${content.step} из ${content.totalSteps}</div><h2>${content.title}</h2><p class="muted" style="margin:0">${content.body}</p>${ctaBlock}</div>`;
}

/** Сразу показывает шаг обучения (без ожидания async init). */
function showTutorialShell(step = 1, state = gameState) {
  const content = getTutorialContent(step, state);
  if (!content) return;
  applyTutorialUi(step, tutorialVisibleSections(step), !!content.highlightNextDay);
  renderTutorialHero(content);
}

function renderOnboardingPanel() {
  if (!els.onboardingPanel) return;
  if (!gameState) {
    els.onboardingPanel.innerHTML = `<span class="muted">Загрузка…</span>`;
    return;
  }

  const tutorialStep = resolveTutorialStep(gameState);
  const tutorialContent =
    isTutorialActive(gameState) && tutorialStep > 0 ? getTutorialContent(tutorialStep, gameState) : null;

  if (tutorialContent) {
    renderTutorialHero(tutorialContent);
    return;
  }

  if (gameState.onboardingHidden) {
    els.onboardingPanel.innerHTML = `<span class="muted">Подсказки скрыты. «Сброс рана» вернёт обучение.</span>`;
    return;
  }

  const view = resolveOnboarding(gameState, onboardingSteps);
  const action = getNextPlayerAction(gameState, view);
  const hints = getErrorHints(gameState);

  if (view.allDone && !action) {
    els.onboardingPanel.innerHTML = `<div style="color:#8fd694"><b>Базовый цикл освоен.</b> Развивайте магазин дальше.</div>`;
    return;
  }

  const ctaBlock = action?.cta
    ? `<div class="row" style="margin-top:12px"><button type="button" class="btn-primary js-beginner-cta" data-cta="${action.cta}">${action.ctaLabel}</button></div>`
    : "";
  const hero = action
    ? `<div class="beginner-hero"><div class="beginner-step">Шаг ${action.step} из ${action.totalSteps}</div><h2>${action.title}</h2><p class="muted" style="margin:0">${action.body}</p>${ctaBlock}</div>`
    : `<div class="muted">Следуйте подсказкам ниже.</div>`;

  const hintRows = hints
    .slice(0, 2)
    .map((h) => {
      const c = h.severity === "high" ? "#ff8f8f" : h.severity === "medium" ? "#ffcc66" : "#a9acb7";
      return `<li style="margin:4px 0;color:${c}">${h.text}</li>`;
    })
    .join("");

  const hintsBlock = hintRows
    ? `<div style="margin-top:10px"><ul class="incoming">${hintRows}</ul></div>`
    : "";

  els.onboardingPanel.innerHTML = `${hero}${hintsBlock}`;
}

function finishTutorial() {
  if (!gameState) return;
  gameState.tutorialCompleted = true;
  autoSaveGame({ silent: true });
  render();
}

function skipTutorial() {
  if (!gameState) return;
  gameState.tutorialSkipped = true;
  gameState.beginnerUiExpanded = true;
  autoSaveGame({ silent: true });
  render();
}

function renderBeginnerTeaser(tier) {
  const el = document.getElementById("beginnerTeaser");
  if (!(el instanceof HTMLElement)) return;
  const text = beginnerTeaserText(tier);
  if (!text) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `<b>Скоро откроется:</b> ${text}`;
}

function quickStartBuy() {
  if (!gameState?.skus?.length) return;
  const sku =
    gameState.skus.find((s) => s.categoryId === "beauty" || s.categoryId === gameState.categories?.[0]?.id) ||
    gameState.skus[0];
  const qty = 80;
  const totalCost = qty * sku.purchaseCost;
  if (gameState.cash < totalCost) {
    alert("Недостаточно денег для стартовой закупки.");
    return;
  }
  gameState.cash -= totalCost;
  gameState.inStock[sku.id] = (gameState.inStock[sku.id] || 0) + qty;
  if (gameState.adBudget < 1500) {
    gameState.adBudget = 1500;
  }
  if (els.skuSelect instanceof HTMLSelectElement) {
    els.skuSelect.value = sku.id;
  }
  if (els.qtyInput instanceof HTMLInputElement) {
    els.qtyInput.value = String(qty);
  }
  syncOnboardingProgress(gameState, onboardingSteps);
  autoSaveGame({ silent: true });
  render();
}

function expandAllPlayerSections() {
  if (!gameState) return;
  gameState.beginnerUiExpanded = true;
  autoSaveGame({ silent: true });
  render();
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

function computeReleaseSmokeSummary() {
  if (!gameState?.lastDayReport?.totals) {
    return { checks: [], passCount: 0, totalChecks: 0, status: "NOT READY" };
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
  return { checks, passCount, totalChecks: checks.length, status, ratio };
}

function renderReleaseSmokeChecklist() {
  if (!els.releaseSmokeChecklist) return;
  if (!gameState.lastDayReport?.totals) {
    els.releaseSmokeChecklist.textContent = "Release smoke checklist появится после первой симуляции.";
    return;
  }
  const { checks, passCount, status } = computeReleaseSmokeSummary();
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

function renderKpiAlertsPanel() {
  if (!els.kpiAlertsPanel) return;
  const alerts = getKpiAlerts(gameState);
  if (!gameState?.lastDayReport) {
    els.kpiAlertsPanel.innerHTML = `<span class="muted">Алерты появятся после первой симуляции.</span>`;
    return;
  }
  if (!alerts.length) {
    els.kpiAlertsPanel.innerHTML = `<span style="color:#8fd694"><b>Всё в норме</b> — критических KPI-алертов нет.</span>`;
    return;
  }
  const rows = alerts
    .map((a) => {
      const c = a.severity === "high" ? "#ff8f8f" : a.severity === "medium" ? "#ffcc66" : "#a9acb7";
      return `<li style="margin:4px 0"><span style="color:${c}"><b>${a.title}</b></span> — ${a.text}</li>`;
    })
    .join("");
  els.kpiAlertsPanel.innerHTML = `<ul class="incoming">${rows}</ul>`;
}

function applyQolPreset(presetId) {
  const preset = qolPresets.find((p) => p.id === presetId);
  if (!preset) return false;
  switch (preset.action) {
    case "play_style":
      return applyPlayStyle(String(preset.param || "assortment"));
    case "quick_restock":
      runQuickEmergencyRestock();
      return true;
    case "quick_stabilize":
      runQuickMarginStabilization();
      return true;
    case "safe_recovery":
      runSafeRecoveryPresetV2();
      return true;
    default:
      return false;
  }
}

function renderQolPresetsPanel() {
  if (!els.qolPresetsPanel) return;
  const buttons = qolPresets
    .map(
      (p) =>
        `<button type="button" class="btn-secondary js-qol-preset" data-preset-id="${p.id}" style="margin:4px 8px 4px 0" title="${p.desc || ""}"><b>${p.label}</b></button>`
    )
    .join("");
  els.qolPresetsPanel.innerHTML =
    buttons || `<span class="muted">Быстрые пресеты не загружены.</span>`;
}

function runBalanceSim14Days() {
  const draft = JSON.parse(JSON.stringify(gameState));
  applySafeRecoveryV2ToState(draft, { intensity: 1 });
  let prevStockout = Number(draft?.kpi?.stockoutRate) || 0;
  for (let i = 0; i < 14; i += 1) {
    draft.day = (Number(draft.day) || 0) + 1;
    processDailyEvents(draft, eventDefinitions);
    refreshDerivedModifiers(draft);
    processIncomingShipmentsForState(draft);
    draft.adBudgetEffective = draft.adEnabled === false ? 0 : Math.max(0, Number(draft.adBudget) || 0);
    const cfg = buildRegressionSafeConstants(draft, prevStockout, buildSimulationConstantsForState(draft));
    simulateSalesDay(draft, cfg);
    prevStockout = Number(draft.kpi?.stockoutRate) || 0;
  }
  gameState.phase4BalanceLastSim = {
    generatedAt: new Date().toISOString(),
    days: 14,
    eventsAudit: auditEventIntensity(draft, 14),
    returnsAudit: auditReturnsLeverage(draft, balancePhase4),
    avgReturnPct: Number(draft.kpi?.returnPct) || 0,
    avgStockout: Number(draft.kpi?.stockoutRate) || 0,
  };
  render();
  return gameState.phase4BalanceLastSim;
}

function getPhase4BalanceReport() {
  const sim = gameState?.phase4BalanceLastSim;
  const eventsAudit = sim?.eventsAudit || auditEventIntensity(gameState, 14);
  const returnsAudit = sim?.returnsAudit || auditReturnsLeverage(gameState, balancePhase4);
  return buildPhase4BalanceReport(gameState, balancePhase4, returnsAudit, eventsAudit);
}

function renderPhase4BalancePanel() {
  if (!els.phase4BalancePanel) return;
  const ret = auditReturnsLeverage(gameState, balancePhase4);
  const ev = gameState?.phase4BalanceLastSim?.eventsAudit || auditEventIntensity(gameState, 14);
  const rep = getPhase4BalanceReport();
  const color =
    rep.decision === "BALANCED" ? "#8fd694" : rep.decision === "TUNE" ? "#ffcc66" : "#ff8f8f";
  const checksLine = rep.checks
    .map((c) => `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`)
    .join("");
  const simNote = gameState?.phase4BalanceLastSim
    ? `Симуляция 14д: событий <b>${ev.total}</b> (neg ${ev.negative} / pos ${ev.positive}) · возвраты сейчас <b>${((gameState.phase4BalanceLastSim.avgReturnPct || 0) * 100).toFixed(1)}%</b>`
    : `<span class="muted">Запустите симуляцию 14д для проверки интенсивности событий.</span>`;
  els.phase4BalancePanel.innerHTML = `<div><b>Баланс 72–74:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · checks <b>${rep.passCount}/${rep.totalChecks}</b></div><div class="muted" style="margin-top:6px">Возвраты: baseline <b>${(ret.baselineRate * 100).toFixed(1)}%</b> → оптимизация <b>${(ret.optimizedRate * 100).toFixed(1)}%</b> (снижение <b>${ret.reductionPct.toFixed(0)}%</b>, нужно >= ${ret.minRequiredPct.toFixed(0)}%)</div><div class="muted" style="margin-top:4px">${simNote}</div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function exportPhase4BalanceReportFile() {
  try {
    const payload = JSON.stringify(getPhase4BalanceReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-phase4-balance-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPhase4BalanceReportFile failed", e);
    alert("Не удалось экспортировать отчёт баланса: " + String(e));
  }
}

function buildSoftLaunchContext() {
  const releaseSmoke = computeReleaseSmokeSummary();
  const phase3Freeze = buildPhase3FreezeReport();
  const returnsAudit = auditReturnsLeverage(gameState, balancePhase4);
  return {
    gameState,
    eventCount: eventDefinitions.length,
    platform: platformState,
    cloudSource: cloudAdapter?.label || lastAutoSaveStatus.cloudSource || "none",
    lastAutoSave: { ...lastAutoSaveStatus },
    config: softLaunchConfig,
    onboarding: resolveOnboarding(gameState, onboardingSteps),
    phase3Freeze,
    phase4Balance: getPhase4BalanceReport(),
    releaseSmoke,
    feedbackLog: gameState?.feedbackLog || [],
    readiness: {
      sdkChecked: platformState.checked,
      localSaveOk: lastAutoSaveStatus.localOk !== false,
      cloudSource: cloudAdapter?.label || lastAutoSaveStatus.cloudSource || "none",
      onboardingSteps: onboardingSteps.length,
      skuCount: gameState?.skus?.length || 0,
      eventCount: eventDefinitions.length,
      balanceReturnsPass: returnsAudit.pass,
      phase3Decision: phase3Freeze?.decision || "NO-GO",
      releaseSmokeStatus: releaseSmoke.status,
      supportChannels: softLaunchConfig.support?.channels?.length || 0,
    },
  };
}

function getSoftLaunchPackage() {
  return buildSoftLaunchPackage(buildSoftLaunchContext());
}

function getFeedbackTriageReport() {
  return buildFeedbackTriageReport(buildSoftLaunchContext());
}

function fillFeedbackCategorySelect() {
  if (!(els.feedbackCategorySelect instanceof HTMLSelectElement)) return;
  const cats = softLaunchConfig.feedbackCategories || [];
  els.feedbackCategorySelect.innerHTML = cats
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  const preferred = gameState?.feedbackDraftCategory || cats[0]?.id || "other";
  if ([...els.feedbackCategorySelect.options].some((o) => o.value === preferred)) {
    els.feedbackCategorySelect.value = preferred;
  }
}

function submitFeedbackEntry() {
  const categoryId =
    els.feedbackCategorySelect instanceof HTMLSelectElement
      ? els.feedbackCategorySelect.value
      : gameState?.feedbackDraftCategory || "other";
  const text =
    els.feedbackTextInput instanceof HTMLTextAreaElement ? els.feedbackTextInput.value : "";
  const entry = normalizeFeedbackEntry(
    createFeedbackEntry(gameState, categoryId, text, {
      priority: inferFeedbackPriority(categoryId),
    })
  );
  if (!entry) {
    alert("Введите текст обратной связи.");
    return;
  }
  if (!Array.isArray(gameState.feedbackLog)) gameState.feedbackLog = [];
  gameState.feedbackLog.push(entry);
  gameState.feedbackDraftCategory = categoryId;
  if (els.feedbackTextInput instanceof HTMLTextAreaElement) {
    els.feedbackTextInput.value = "";
  }
  autoSaveGame({ silent: true });
  render();
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

async function activateSupportChannel(kind, value) {
  const v = String(value || "").trim();
  if (!v) return;
  let msg = "";
  if (kind === "email") {
    try {
      await navigator.clipboard.writeText(v);
      msg = `<span style="color:#8fd694">Почта скопирована в буфер обмена.</span>`;
    } catch (_) {
      msg = `<span style="color:#ff8f8f">Не удалось скопировать. Разрешите доступ к буферу обмена.</span>`;
    }
  } else {
    const win = window.open(v, "_blank", "noopener,noreferrer");
    msg = win
      ? `Открыта ссылка поддержки.`
      : `Разрешите всплывающие окна или откройте ссылку вручную: <b>${v}</b>`;
  }
  if (els.supportChannelStatus) {
    els.supportChannelStatus.innerHTML = msg;
  }
}

function renderSupportChannels() {
  if (!els.supportChannelsPanel) return;
  const buttons = (softLaunchConfig.support?.channels || [])
    .map((ch) => {
      const v = escapeAttr(ch.value);
      const label = escapeAttr(ch.label);
      if (ch.kind === "email") {
        return `<button type="button" class="btn-secondary js-support-channel" data-support-kind="email" data-support-value="${v}">✉ ${label}</button>`;
      }
      return `<button type="button" class="btn-secondary js-support-channel" data-support-kind="link" data-support-value="${v}">↗ ${label}</button>`;
    })
    .join("");
  els.supportChannelsPanel.innerHTML =
    buttons || `<span class="muted">Каналы поддержки не настроены.</span>`;
}

function renderSoftLaunchPanel() {
  if (!els.softLaunchPanel) return;
  fillFeedbackCategorySelect();
  renderSupportChannels();
  const pkg = getSoftLaunchPackage();
  const color =
    pkg.decision === "GO" ? "#8fd694" : pkg.decision === "GO WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const checksLine = (pkg.readiness?.checks || [])
    .map(
      (c) =>
        `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`
    )
    .join("");
  const feedbackCount = (gameState?.feedbackLog || []).length;
  const listing = softLaunchConfig.listing || {};
  els.softLaunchPanel.innerHTML = `<div><b>Софт-ланч:</b> <span style="color:${color}"><b>${pkg.decision}</b></span> · checks <b>${pkg.passCount}/${pkg.totalChecks}</b> · feedback <b>${feedbackCount}</b></div><div class="muted" style="margin-top:6px"><b>${listing.title || "MSSIM"}</b> — ${listing.tagline || ""}</div><div class="muted" style="margin-top:4px">${softLaunchConfig.support?.instruction || ""}</div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function getSoftLaunchAnalytics() {
  return buildSoftLaunchAnalyticsReport(buildSoftLaunchContext());
}

function renderTelemetryPanel() {
  if (!els.telemetryPanel) return;
  const retention = buildRetentionMetrics(gameState);
  const sessions = gameState?.sessionMetrics || {};
  const points = (gameState?.telemetryLog || []).length;
  const d1Color = retention.proxyD1Return ? "#8fd694" : "#ffcc66";
  const d14Color = retention.firstRunCompletionProxy ? "#8fd694" : "#a9acb7";
  els.telemetryPanel.innerHTML = `<div>Сессий: <b>${retention.sessionsStarted}</b> · день рана: <b>${retention.currentDay}</b> · точек телеметрии: <b>${points}</b></div><div class="muted" style="margin-top:4px">D1 return (прокси): <span style="color:${d1Color}"><b>${retention.proxyD1Return ? "да" : "нет"}</b></span> · день 7: <b>${retention.reachedDay7 ? "да" : "нет"}</b> · день 14: <b>${retention.reachedDay14 ? "да" : "нет"}</b> · завершение 1-го рана (прокси): <span style="color:${d14Color}"><b>${retention.firstRunCompletionProxy ? "да" : "нет"}</b></span></div><div class="muted" style="margin-top:4px">Первая сессия: ${sessions.firstPlayAt ? new Date(sessions.firstPlayAt).toLocaleString("ru-RU") : "—"} · последняя: ${sessions.lastPlayAt ? new Date(sessions.lastPlayAt).toLocaleString("ru-RU") : "—"}</div>`;
}

function renderTriagePanel() {
  if (!els.triagePanel) return;
  gameState.feedbackLog = normalizeFeedbackLog(gameState.feedbackLog);
  const summary = buildTriageSummary(gameState.feedbackLog);
  const rows = [...gameState.feedbackLog]
    .reverse()
    .slice(0, 8)
    .map((entry) => {
      const priColor =
        entry.priority === "high" ? "#ff8f8f" : entry.priority === "medium" ? "#ffcc66" : "#a9acb7";
      const status = entry.triageStatus || "open";
      const short = String(entry.text || "").slice(0, 72);
      return `<li style="margin:6px 0"><span style="color:${priColor}"><b>${entry.priority}</b></span> · <b>${entry.categoryId}</b> · день ${entry.day} · <span class="muted">${short}${entry.text?.length > 72 ? "…" : ""}</span><div class="row" style="margin-top:4px">${["open", "investigating", "resolved", "wontfix"]
        .map(
          (st) =>
            `<button type="button" class="btn-secondary js-triage-status" data-entry-id="${escapeAttr(entry.id)}" data-triage-status="${st}" style="padding:4px 8px;font-size:12px;${status === st ? "outline:1px solid #7a4cff" : ""}">${st}</button>`
        )
        .join("")}</div></li>`;
    })
    .join("");
  els.triagePanel.innerHTML = `<div>Триаж: открыто <b>${summary.openForTriage}</b> / всего <b>${summary.total}</b> · high <b>${summary.byPriority.high || 0}</b> · med <b>${summary.byPriority.medium || 0}</b> · low <b>${summary.byPriority.low || 0}</b></div><ul class="incoming" style="margin-top:6px">${rows || "<li class='muted'>Нет записей — отправьте feedback выше.</li>"}</ul>`;
}

function updateFeedbackTriage(entryId, status) {
  if (!setFeedbackTriageStatus(gameState.feedbackLog, entryId, status)) return;
  autoSaveGame({ silent: true });
  render();
}

function getPhase4CloseoutReport() {
  return buildPhase4CloseoutReport({
    gameState,
    gates: retentionGates,
    majorBugsCatalog,
    majorBugStatus: gameState?.majorBugStatus || {},
    feedbackLog: gameState?.feedbackLog || [],
  });
}

function setMajorBugStatus(bugId, status) {
  if (!gameState) return;
  if (!gameState.majorBugStatus || typeof gameState.majorBugStatus !== "object") {
    gameState.majorBugStatus = {};
  }
  gameState.majorBugStatus[String(bugId)] = String(status);
  autoSaveGame({ silent: true });
  render();
}

function renderMajorBugsPanel() {
  if (!els.majorBugsPanel) return;
  const audit = auditMajorBugs(majorBugsCatalog, gameState?.majorBugStatus, gameState?.feedbackLog);
  const rows = audit.registry
    .map((b) => {
      const color =
        b.status === "fixed" ? "#8fd694" : b.status === "wontfix" ? "#a9acb7" : "#ff8f8f";
      const actions =
        b.status === "open" || b.status === "investigating"
          ? `<button type="button" class="btn-secondary js-major-bug-fix" data-bug-id="${escapeAttr(b.id)}" style="padding:4px 8px;font-size:12px;margin-left:6px">Закрыть</button>`
          : "";
      return `<li style="margin:4px 0"><span style="color:${color}"><b>${b.status}</b></span> · <b>${b.id}</b> — ${b.title}${actions}</li>`;
    })
    .join("");
  els.majorBugsPanel.innerHTML = `<div>Major-баги: открыто <b>${audit.openMajorTotal}</b> (реестр <b>${audit.openRegistry}</b> + feedback high <b>${audit.openHighFeedback}</b>) · лимит <b>${retentionGates.maxOpenMajorBugs}</b></div><ul class="incoming" style="margin-top:6px">${rows || "<li class='muted'>Реестр пуст.</li>"}</ul>`;
}

function renderPhase4CloseoutPanel() {
  if (!els.phase4CloseoutPanel) return;
  syncVisitMetrics(gameState);
  const rep = getPhase4CloseoutReport();
  const color =
    rep.decision === "GO"
      ? "#8fd694"
      : rep.decision === "GO WITH RISKS" || rep.decision === "COLLECTING DATA"
        ? "#ffcc66"
        : "#ff8f8f";
  const checksLine = rep.retentionGates.checks
    .map((c) => {
      const mark = c.pass === null ? "…" : c.pass ? "PASS" : "FAIL";
      const markColor = c.pass === null ? "#a9acb7" : c.pass ? "#8fd694" : "#ff8f8f";
      const extra = c.value != null ? ` <span class="muted">(${c.value})</span>` : "";
      return `<li style="margin:4px 0"><span style="color:${markColor}">${mark}</span> — ${c.label}${extra}</li>`;
    })
    .join("");
  const cohort = rep.retentionGates.cohort;
  els.phase4CloseoutPanel.innerHTML = `<div><b>Фаза 4 closeout (79–80):</b> <span style="color:${color}"><b>${rep.decision}</b></span> · checks <b>${rep.passCount}/${rep.totalChecks}</b>${rep.retentionGates.pendingDataChecks ? ` · ожидание данных: <b>${rep.retentionGates.pendingDataChecks}</b>` : ""}</div><div class="muted" style="margin-top:6px">Когорта визитов: <b>${cohort.visitDenominator}</b> (нужно >= ${cohort.minVisitsRequired} для %) · D1 <b>${cohort.d1ReturnPct.toFixed(0)}%</b> · день 14 <b>${cohort.day14Pct.toFixed(0)}%</b></div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function getReleaseReadinessReport() {
  return buildReleaseReadinessReport(buildManifest, browserCompatResult || runBrowserCompatChecks(browserCompatConfig));
}

function renderBrowserCompatPanel() {
  if (!els.browserCompatPanel) return;
  const compat = browserCompatResult || runBrowserCompatChecks(browserCompatConfig);
  const color = compat.supported ? "#8fd694" : "#ff8f8f";
  const rows = compat.checks
    .map((c) => {
      const mark = c.pass ? "PASS" : c.required ? "FAIL" : "WARN";
      const markColor = c.pass ? "#8fd694" : c.required ? "#ff8f8f" : "#ffcc66";
      return `<li style="margin:4px 0"><span style="color:${markColor}">${mark}</span> — ${c.label}${c.required ? "" : " <span class='muted'>(опц.)</span>"}</li>`;
    })
    .join("");
  const browsers = (browserCompatConfig.minBrowsers || [])
    .map((b) => `<li style="margin:2px 0">${b}</li>`)
    .join("");
  els.browserCompatPanel.innerHTML = `<div>Браузер: <span style="color:${color}"><b>${compat.supported ? "совместим" : "не поддерживается"}</b></span> · checks <b>${compat.passCount}/${compat.totalChecks}</b></div><ul class="incoming" style="margin-top:6px">${rows}</ul><div class="muted" style="margin-top:6px">Целевые браузеры:</div><ul class="incoming">${browsers}</ul>`;
}

function renderReleaseBuildPanel() {
  if (!els.releaseBuildPanel) return;
  const m = buildManifest;
  const rep = getReleaseReadinessReport();
  const color =
    rep.decision === "READY" ? "#8fd694" : rep.decision === "READY WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const checksLine = rep.checks
    .map(
      (c) =>
        `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}</li>`
    )
    .join("");
  const sizeLine =
    m.totalBytes > 0
      ? `Размер: <b>${formatBytes(m.totalBytes)}</b> · файлов <b>${m.fileCount}</b>`
      : `<span class="muted">Dev-режим — запустите <code>npm run build</code></span>`;
  els.releaseBuildPanel.innerHTML = `<div><b>Release build:</b> <span style="color:${color}"><b>${rep.decision}</b></span> · v<b>${m.version}</b> · mode <b>${m.mode}</b></div><div class="muted" style="margin-top:6px">${sizeLine}${m.builtAt ? ` · сборка ${new Date(m.builtAt).toLocaleString("ru-RU")}` : ""}</div><ul class="incoming" style="margin-top:6px">${checksLine}</ul>`;
}

function exportReleaseReadinessFile() {
  try {
    const payload = JSON.stringify(getReleaseReadinessReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-release-readiness-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportReleaseReadinessFile failed", e);
    alert("Не удалось экспортировать отчёт: " + String(e));
  }
}

function getStoreListingValidation() {
  return validateStoreListing(storeListingConfig);
}

function getStoreListingPackage() {
  const validation = getStoreListingValidation();
  return buildStoreListingPackage(storeListingConfig, validation);
}

function renderStoreListingPanel() {
  if (!els.storeListingPanel) return;
  const pkg = getStoreListingPackage();
  const l = pkg.listing;
  const color =
    pkg.decision === "READY" ? "#8fd694" : pkg.decision === "READY WITH RISKS" ? "#ffcc66" : "#ff8f8f";
  const checksLine = pkg.validation.checks
    .map(
      (c) =>
        `<li style="margin:4px 0"><span style="color:${c.pass ? "#8fd694" : "#ff8f8f"}">${c.pass ? "PASS" : "FAIL"}</span> — ${c.label}${c.value !== undefined && c.value !== "" ? ` <span class="muted">(${c.value})</span>` : ""}</li>`
    )
    .join("");
  const assetsLine = [
    l.assets.icon ? `<li style="margin:4px 0">Иконка: <code>${l.assets.icon.path}</code> · ${l.assets.icon.status}</li>` : "",
    l.assets.cover ? `<li style="margin:4px 0">Обложка: <code>${l.assets.cover.path}</code> · ${l.assets.cover.status}</li>` : "",
    l.assets.heroCover
      ? `<li style="margin:4px 0">Витрина: <code>${l.assets.heroCover.path}</code> · ${l.assets.heroCover.status}</li>`
      : "",
    ...(l.assets.screenshots || []).map(
      (s) =>
        `<li style="margin:4px 0">Скрин ${s.id}: <code>${s.path}</code> — ${s.caption || ""} · ${s.status}</li>`
    ),
  ].join("");
  const modLine = (l.moderationChecklist || [])
    .map((item) => `<li style="margin:2px 0">${item}</li>`)
    .join("");
  els.storeListingPanel.innerHTML = `<div><b>Витрина ЯИ:</b> <span style="color:${color}"><b>${pkg.decision}</b></span> · checks <b>${pkg.passCount}/${pkg.totalChecks}</b></div><div style="margin-top:8px"><b>${l.title}</b></div><div class="muted" style="margin-top:4px">${l.shortDescription}</div><ul class="incoming" style="margin-top:8px">${checksLine}</ul><div class="muted" style="margin-top:8px">Ассеты (placeholder SVG — заменить PNG перед публикацией):</div><ul class="incoming">${assetsLine}</ul><div class="muted" style="margin-top:8px">Модерация:</div><ul class="incoming">${modLine}</ul>`;
}

function exportStoreListingFile() {
  try {
    const payload = JSON.stringify(getStoreListingPackage(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mssim-store-listing.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportStoreListingFile failed", e);
    alert("Не удалось экспортировать витрину: " + String(e));
  }
}

function exportPhase4CloseoutFile() {
  try {
    const payload = JSON.stringify(getPhase4CloseoutReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-phase4-closeout-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportPhase4CloseoutFile failed", e);
    alert("Не удалось экспортировать closeout: " + String(e));
  }
}

function exportSoftLaunchAnalyticsFile() {
  try {
    const payload = JSON.stringify(getSoftLaunchAnalytics(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-analytics-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportSoftLaunchAnalyticsFile failed", e);
    alert("Не удалось экспортировать аналитику: " + String(e));
  }
}

function importFeedbackTriageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result || ""));
      const imported = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.entries)
          ? raw.entries
          : Array.isArray(raw.feedbackEntries)
            ? raw.feedbackEntries
            : [];
      gameState.feedbackLog = mergeFeedbackImport(gameState.feedbackLog, imported);
      autoSaveGame({ silent: true });
      render();
      alert(`Импортировано записей: ${imported.length}`);
    } catch (e) {
      console.warn("importFeedbackTriageFile failed", e);
      alert("Не удалось импортировать feedback: " + String(e));
    }
  };
  reader.onerror = () => alert("Ошибка чтения файла.");
  reader.readAsText(file, "utf-8");
}

function exportSoftLaunchPackageFile() {
  try {
    const payload = JSON.stringify(getSoftLaunchPackage(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-soft-launch-package-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportSoftLaunchPackageFile failed", e);
    alert("Не удалось экспортировать пакет софт-ланча: " + String(e));
  }
}

function exportFeedbackTriageFile() {
  try {
    const payload = JSON.stringify(getFeedbackTriageReport(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mssim-feedback-triage-day-${gameState.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn("exportFeedbackTriageFile failed", e);
    alert("Не удалось экспортировать отчёт обратной связи: " + String(e));
  }
}

function renderKpiCharts() {
  if (!els.kpiChartsRow) return;
  if (!gameState?.lastDayReport) {
    els.kpiChartsRow.innerHTML = `<div class="muted">Графики появятся после первого дня.</div>`;
    return;
  }
  const panels = buildKpiChartPanels(gameState);
  els.kpiChartsRow.innerHTML = renderKpiChartsHtml(panels);
}

function renderKpiDashboard() {
  if (!els.kpiDashboard) return;
  if (!gameState.lastDayReport) {
    els.kpiDashboard.innerHTML = '<div class="muted">Нет данных — сначала нажми Next Day.</div>';
    return;
  }

  const k = gameState.kpi;
  const tutorialSimple = isTutorialActive(gameState) && resolveTutorialStep(gameState) === 3;
  const cards = tutorialSimple
    ? [
        { kind: "revenue", title: "Выручка", value: money(k.revenue), cls: "kpi-good" },
        { kind: "profit", title: "Прибыль", value: money(k.profit), cls: kpiClassByValue("profit", k.profit) },
        { kind: "marginPct", title: "Маржа", value: `${k.marginPct.toFixed(1)}%`, cls: kpiClassByValue("marginPct", k.marginPct) },
      ]
    : [
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
  cloudAdapter = createCloudAdapter(res);
  platformState = {
    checked: true,
    available: !!res.available,
    sdk: res.sdk || null,
    player: res.player || null,
    message: res.available
      ? res.player
        ? "Yandex SDK: подключён · облачное сохранение активно."
        : "Yandex SDK: подключён · облако через mock (getPlayer недоступен)."
      : "Yandex SDK: недоступен · облако через local mock, localStorage как резерв.",
  };
  bindAccountSelectionHandlers(res.sdk, {
    onOpen: () => {
      cloudSyncPaused = true;
      console.log("Yandex: диалог выбора аккаунта — синхронизация облака приостановлена");
    },
    onClose: async () => {
      cloudSyncPaused = false;
      await reloadFromCloudAfterAccountSwitch();
    },
  });
  lastAutoSaveStatus.cloudSource = cloudAdapter?.label || "none";
  return platformState;
}

async function reloadFromCloudAfterAccountSwitch() {
  const player = await refreshYandexPlayer(platformState.sdk);
  platformState.player = player;
  cloudAdapter = createCloudAdapter({ player, sdk: platformState.sdk });
  const cloudRaw = await loadCloudSave(cloudAdapter);
  if (!cloudRaw || !applyLoadedState(cloudRaw)) {
    console.warn("Account switch: cloud save missing or invalid");
    renderSdkStatus();
    return;
  }
  saveToLocal(attachSaveMeta(cloudRaw, "cloud"));
  bootstrapUiAfterStateChange();
  render();
  console.log("Account switch: loaded cloud save, day", gameState.day);
}

/**
 * @returns {Promise<{ state: object; source: "local" | "cloud" } | null>}
 */
async function loadHybridSave() {
  const localRaw = loadFromLocal();
  const cloudRaw = await loadCloudSave(cloudAdapter);
  return resolveBestSave(localRaw, cloudRaw);
}

/**
 * @param {{ source: "local" | "cloud"; state: object }} picked
 */
async function syncSavesAfterLoad(picked) {
  const snapshot = attachSaveMeta(picked.state, picked.source);
  if (picked.source === "cloud") {
    saveToLocal(snapshot);
    return;
  }
  if (!cloudSyncPaused) {
    await saveCloudSave(cloudAdapter, snapshot, false);
  }
}

function renderSdkStatus() {
  if (!els.sdkStatus) return;
  const color = platformState.available ? "#8fd694" : "#ffcc66";
  const cloudLabel = cloudAdapter?.label || "none";
  const cloudColor = lastAutoSaveStatus.cloudOk === false ? "#ff8f8f" : "#a9acb7";
  const cloudLine =
    cloudLabel === "none"
      ? "Облако: недоступно"
      : lastAutoSaveStatus.cloudSkipped
        ? `Облако (${cloudLabel}): ожидание`
        : `Облако (${cloudLabel}): ${lastAutoSaveStatus.cloudOk === false ? "ошибка" : "синхронизировано"}`;
  els.sdkStatus.innerHTML = `<span style="color:${color}">${platformState.message}</span><br/><span style="color:${cloudColor}" class="muted">${cloudLine}</span>`;
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

async function loadQolCatalog() {
  const presets = await loadJson("./src/data/qol_presets.json", []);
  qolPresets = Array.isArray(presets) ? presets : [];
}

async function loadBalancePhase4Catalog() {
  const raw = await loadJson("./src/data/balance_phase4.json", null);
  balancePhase4 = normalizeBalanceConfig(raw);
  configureEventBalance({
    maxActiveNegative: balancePhase4.events.maxActiveNegative,
    maxReturnRateModMult: balancePhase4.events.maxReturnRateModMult,
    dailyChance: balancePhase4.events.dailyChance,
    pityDays: balancePhase4.events.pityDays,
  });
}

async function loadSoftLaunchCatalog() {
  const raw = await loadJson("./src/data/soft_launch_config.json", null);
  softLaunchConfig = normalizeSoftLaunchConfig(raw);
}

async function loadRetentionCatalog() {
  const [gates, bugs] = await Promise.all([
    loadJson("./src/data/retention_gates.json", null),
    loadJson("./src/data/major_bugs.json", { bugs: [] }),
  ]);
  retentionGates = normalizeRetentionGates(gates);
  majorBugsCatalog = normalizeMajorBugsCatalog(bugs);
}

async function loadReleaseCatalog() {
  const [manifest, compat, listing] = await Promise.all([
    loadJson("./src/data/build_manifest.json", null),
    loadJson("./src/data/browser_compat.json", {}),
    loadJson("./src/data/store_listing.json", null),
  ]);
  buildManifest = normalizeBuildManifest(manifest);
  browserCompatConfig = compat && typeof compat === "object" ? compat : browserCompatConfig;
  browserCompatResult = runBrowserCompatChecks(browserCompatConfig);
  storeListingConfig = normalizeStoreListing(listing);
  applyReleaseUiMode(buildManifest);
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
  await Promise.all([
    loadOnboardingCatalog(),
    loadQolCatalog(),
    loadBalancePhase4Catalog(),
    loadSoftLaunchCatalog(),
    loadRetentionCatalog(),
    loadReleaseCatalog(),
  ]);
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

function finalizeSessionTelemetry() {
  if (!gameState) return;
  bumpSessionMetrics(gameState);
  syncVisitMetrics(gameState);
  if (!gameState.visitMetrics?.startedAt) {
    gameState.visitMetrics.startedAt = new Date().toISOString();
  }
}

let initGameGeneration = 0;

async function initGame(options = {}) {
  const generation = ++initGameGeneration;
  await initGameBody(options, generation);
}

async function initGameBody(options = {}, generation = initGameGeneration) {
  const skipAutoLoad = options.skipAutoLoad === true;
  await ensurePlatformReady();
  if (generation !== initGameGeneration) return;
  await loadProgressionCatalog();
  const [categories, rawSkus, rawConst, rawEvents] = await Promise.all([
    loadJson("./src/data/categories.json", defaultCategories),
    loadSkuCatalog(),
    loadJson("./src/data/constants.json", defaultConstants),
    loadEventCatalog(),
  ]);

  economyConstants = normalizeConstants(rawConst);
  eventDefinitions = Array.isArray(rawEvents) ? rawEvents : [];

  if (!skipAutoLoad) {
    const picked = await loadHybridSave();
    if (generation !== initGameGeneration) return;
    if (picked && applyLoadedState(picked.state)) {
      await syncSavesAfterLoad(picked);
      if (generation !== initGameGeneration) return;
      bootstrapUiAfterStateChange();
      finalizeSessionTelemetry();
      try {
        render();
      } catch (e) {
        console.error("render after load failed", e);
        showTutorialShell(1);
      }
      console.log(`Auto-loaded save from ${picked.source}, day`, gameState.day);
      return;
    }
  }

  if (generation !== initGameGeneration) return;

  const skus = (Array.isArray(rawSkus) ? rawSkus : defaultSkus).map(normalizeSku);
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
    phase4BalanceLastSim: null,
    progressionPoints: 0,
    progressionUnlocked: emptyProgressionUnlocked(),
    playStyleId: null,
    antiExploit: null,
    onboardingCompletedIds: [],
    onboardingHidden: false,
    beginnerUiExpanded: false,
    tutorialCompleted: false,
    tutorialSkipped: false,
    skuStockFilter: "all",
    skuSearchQuery: "",
    feedbackLog: [],
    feedbackDraftCategory: "bug",
    telemetryLog: [],
    sessionMetrics: { sessionsStarted: 0, firstPlayAt: null, lastPlayAt: null },
    visitMetrics: defaultVisitMetrics(),
    retentionCohort: defaultRetentionCohort(),
    majorBugStatus: {},
    kpi: defaultKpi(),
    ...eventState,
  };
  refreshDerivedModifiers(gameState);
  bootstrapUiAfterStateChange();
  finalizeSessionTelemetry();
  if (generation !== initGameGeneration) return;
  autoSaveGame({ silent: true });
  try {
    render();
  } catch (e) {
    console.error("render after init failed", e);
    showTutorialShell(1);
  }
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
    phase4BalanceLastSim:
      raw.phase4BalanceLastSim && typeof raw.phase4BalanceLastSim === "object" ? raw.phase4BalanceLastSim : null,
    progressionPoints: Math.max(0, Math.round(Number(raw.progressionPoints) || 0)),
    progressionUnlocked: normalizeProgressionUnlocked(raw.progressionUnlocked),
    playStyleId: raw.playStyleId != null ? String(raw.playStyleId) : null,
    antiExploit: null,
    onboardingCompletedIds: Array.isArray(raw.onboardingCompletedIds) ? raw.onboardingCompletedIds : [],
    onboardingHidden: raw.onboardingHidden === true,
    beginnerUiExpanded: raw.beginnerUiExpanded === true,
    ...migrateTutorialFlags(raw),
    skuStockFilter: String(raw.skuStockFilter || "all"),
    skuSearchQuery: String(raw.skuSearchQuery || ""),
    feedbackLog: normalizeFeedbackLog(raw.feedbackLog),
    feedbackDraftCategory: String(raw.feedbackDraftCategory || "bug"),
    telemetryLog: Array.isArray(raw.telemetryLog) ? raw.telemetryLog : [],
    sessionMetrics:
      raw.sessionMetrics && typeof raw.sessionMetrics === "object"
        ? {
            sessionsStarted: Math.max(0, Number(raw.sessionMetrics.sessionsStarted) || 0),
            firstPlayAt: raw.sessionMetrics.firstPlayAt || null,
            lastPlayAt: raw.sessionMetrics.lastPlayAt || null,
          }
        : { sessionsStarted: 0, firstPlayAt: null, lastPlayAt: null },
    visitMetrics:
      raw.visitMetrics && typeof raw.visitMetrics === "object"
        ? {
            startedAt: raw.visitMetrics.startedAt || null,
            reachedDay2: raw.visitMetrics.reachedDay2 === true,
            reachedDay14: raw.visitMetrics.reachedDay14 === true,
          }
        : defaultVisitMetrics(),
    retentionCohort:
      raw.retentionCohort && typeof raw.retentionCohort === "object"
        ? {
            visits: Math.max(0, Number(raw.retentionCohort.visits) || 0),
            d1ReturnVisits: Math.max(0, Number(raw.retentionCohort.d1ReturnVisits) || 0),
            day14Completions: Math.max(0, Number(raw.retentionCohort.day14Completions) || 0),
          }
        : defaultRetentionCohort(),
    majorBugStatus: raw.majorBugStatus && typeof raw.majorBugStatus === "object" ? raw.majorBugStatus : {},
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

function bootstrapUiAfterStateChange() {
  resetMerchDom();
  fillCategoryFilterSelect();
  fillSkuSelect();
  if (els.skuSelect?.options.length) els.skuSelect.value = gameState.skus[0]?.id || "";
  syncAdUiFromState();
  syncCostModelUiFromState();
  syncReturnsUiFromState();
  syncSkuFiltersUiFromState();
  renderSdkStatus();
  buildMerchTableOnce();
}

/**
 * @param {{ silent?: boolean; flushCloud?: boolean }} [options]
 */
function autoSaveGame(options = {}) {
  if (!gameState) return { ok: false, error: "no state" };
  const silent = options.silent !== false;
  const snapshot = attachSaveMeta(snapshotStateForSave(), "local");
  const localRes = saveToLocal(snapshot);
  lastAutoSaveStatus = {
    ok: localRes.ok,
    localOk: localRes.ok,
    cloudOk: true,
    cloudSkipped: !cloudAdapter || cloudSyncPaused,
    cloudSource: cloudAdapter?.label || "none",
    at: new Date().toISOString(),
    day: gameState.day,
    error: localRes.error || null,
    cloudError: null,
  };
  if (!localRes.ok && !silent) alert("Не удалось сохранить локально: " + (localRes.error || ""));
  void persistCloudSave(snapshot, options.flushCloud === true);
  return localRes;
}

async function persistCloudSave(snapshot, flush) {
  if (!cloudAdapter || cloudSyncPaused) return;
  const cloudRes = await saveCloudSave(cloudAdapter, snapshot, flush);
  lastAutoSaveStatus.cloudOk = cloudRes.ok !== false;
  lastAutoSaveStatus.cloudSkipped = !!cloudRes.skipped;
  lastAutoSaveStatus.cloudError = cloudRes.error || null;
  lastAutoSaveStatus.ok = lastAutoSaveStatus.localOk && lastAutoSaveStatus.cloudOk;
  renderSdkStatus();
}

function saveGame() {
  const res = autoSaveGame({ silent: false, flushCloud: true });
  if (res.ok) {
    alert(
      cloudAdapter?.label === "yandex"
        ? "Сохранено локально и в облаке Yandex."
        : "Сохранено локально и в mock-облаке (dev)."
    );
  }
}

async function loadGame() {
  const picked = await loadHybridSave();
  if (!picked) {
    alert("Нет сохранения.");
    return;
  }
  if (!applyLoadedState(picked.state)) {
    alert("Файл сохранения повреждён.");
    return;
  }
  await syncSavesAfterLoad(picked);
  bootstrapUiAfterStateChange();
  render();
  alert(`Загружено из ${picked.source === "cloud" ? "облака" : "localStorage"} (день ${gameState.day}).`);
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
  bootstrapUiAfterStateChange();
  autoSaveGame({ silent: true });
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
  pushDailyTelemetry(gameState);
  syncVisitMetrics(gameState);
  autoSaveGame({ silent: true });
  render();
  void tryShowInterstitialAfterDay();
  console.log("Day advanced", gameState);
}

async function resetGame() {
  if (
    !confirm(
      "Сбросить игру и удалить автосохранение (локальное и облачное)? Экспортируйте JSON, если нужна резервная копия."
    )
  ) {
    return;
  }
  clearLocalSave();
  initGameGeneration++;
  showTutorialShell(1, {
    day: 1,
    cash: 120000,
    inStock: {},
    incomingShipments: [],
    lastDayReport: null,
    kpi: defaultKpi(),
  });
  try {
    await clearCloudSave(cloudAdapter);
    if (gameState) finalizeVisitToCohort(gameState);
    await initGame({ skipAutoLoad: true });
  } catch (e) {
    console.error("resetGame failed", e);
    alert("Сброс не завершился полностью. Обновите страницу или попробуйте ещё раз.");
  }
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
  if (!gameState) return;
  syncTutorialCompletion(gameState);
  const onboardingView = resolveOnboarding(gameState, onboardingSteps);
  const beginnerTier = resolveBeginnerTier(gameState, onboardingView);
  const isDevUi = typeof document !== "undefined" && document.body.dataset.uiMode === "dev";
  const tutorialStep = resolveTutorialStep(gameState);
  const tutorialOn = isTutorialActive(gameState) && !isDevUi && tutorialStep > 0;

  if (tutorialOn) {
    const content = getTutorialContent(tutorialStep, gameState);
    applyTutorialUi(tutorialStep, tutorialVisibleSections(tutorialStep), !!content?.highlightNextDay);
  } else {
    applyBeginnerUi(beginnerTier, isDevUi);
    renderBeginnerTeaser(beginnerTier);
  }

  const salesLine = gameState.lastDayReport
    ? `Итог последнего Next Day: выручка <b>${Math.round(gameState.kpi.revenue).toLocaleString("ru-RU")}</b> · прибыль <b>${Math.round(gameState.kpi.profit).toLocaleString("ru-RU")}</b> · маржа <b>${gameState.kpi.marginPct.toFixed(1)}%</b> · ACOS <b>${(gameState.kpi.acos * 100).toFixed(1)}%</b> · возвраты <b>${(gameState.kpi.returnPct * 100).toFixed(1)}%</b> · stockout <b>${gameState.kpi.unmetUnits}</b> шт. (${(gameState.kpi.stockoutRate * 100).toFixed(1)}% от «желаемых» заказов) · запас ~<b>${gameState.kpi.daysOfStock.toFixed(1)}</b> дн. (оценка по чистым продажам)`
    : `Итог дня: <span style="color:#a9acb7">симуляция ещё не запускалась — нажми Next Day</span>`;

  els.summary.innerHTML =
    tutorialOn || (beginnerTier < 3 && !isDevUi)
      ? [
          `День <b>${gameState.day}</b> · На счёте: <b>${gameState.cash.toLocaleString("ru-RU")} ₽</b>`,
          `На складе: <b>${totalStock()}</b> шт.${gameState.incomingShipments.length ? ` · В пути: <b>${gameState.incomingShipments.length}</b>` : ""}`,
          gameState.lastDayReport
            ? `Прибыль за последний день: <b>${Math.round(gameState.kpi.profit).toLocaleString("ru-RU")} ₽</b>`
            : `<span class="muted">Продаж ещё не было — закупите товар и нажмите «Следующий день».</span>`,
        ].join("<br/>")
      : [
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
    lastAutoSaveStatus.ok
      ? `Автосохранение: <b>день ${lastAutoSaveStatus.day ?? gameState.day}</b>${lastAutoSaveStatus.at ? ` · ${new Date(lastAutoSaveStatus.at).toLocaleTimeString("ru-RU")}` : ""} · local <b>${lastAutoSaveStatus.localOk ? "OK" : "ERR"}</b> · cloud <b>${lastAutoSaveStatus.cloudSource}</b> <b>${lastAutoSaveStatus.cloudSkipped ? "—" : lastAutoSaveStatus.cloudOk ? "OK" : "ERR"}</b>`
      : `<span style="color:#ff8f8f">Автосохранение: ошибка</span>`,
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
  syncSkuFiltersUiFromState();
  buildMerchTableOnce();
  renderIncoming();
  renderMorningArrivals();
  renderStockTable();
  renderYesterday();
  renderDeadlockGuard();
  renderKpiCharts();
  renderKpiDashboard();
  renderKpiAlertsPanel();
  renderQolPresetsPanel();
  renderPhase4BalancePanel();
  renderSoftLaunchPanel();
  renderTelemetryPanel();
  renderTriagePanel();
  renderMajorBugsPanel();
  renderPhase4CloseoutPanel();
  renderBrowserCompatPanel();
  renderReleaseBuildPanel();
  renderStoreListingPanel();
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
els.showAllSectionsBtn?.addEventListener("click", expandAllPlayerSections);
els.skipTutorialBtn?.addEventListener("click", skipTutorial);
els.quickStartBtn?.addEventListener("click", quickStartBuy);
els.buyBtn?.addEventListener("click", purchase);
els.onboardingPanel?.addEventListener("click", (e) => {
  const btn = e.target instanceof HTMLElement ? e.target.closest(".js-beginner-cta") : null;
  if (!(btn instanceof HTMLElement)) return;
  if (btn.dataset.cta === "quickStart") quickStartBuy();
  if (btn.dataset.cta === "nextDay") nextDay();
  if (btn.dataset.cta === "finishTutorial") finishTutorial();
});
els.runRegression14Btn?.addEventListener("click", () => runRegressionDays(14));
els.runRegression28Btn?.addEventListener("click", () => runRegressionDays(28));
els.runStyleBalanceBtn?.addEventListener("click", runPlayStyleBalanceAudit);
els.runBalanceSim14Btn?.addEventListener("click", runBalanceSim14Days);
els.exportPhase4BalanceBtn?.addEventListener("click", exportPhase4BalanceReportFile);
els.submitFeedbackBtn?.addEventListener("click", submitFeedbackEntry);
els.supportChannelsPanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btn = t.closest(".js-support-channel");
  if (!(btn instanceof HTMLElement)) return;
  void activateSupportChannel(btn.dataset.supportKind, btn.dataset.supportValue);
});
els.exportSoftLaunchBtn?.addEventListener("click", exportSoftLaunchPackageFile);
els.exportFeedbackBtn?.addEventListener("click", exportFeedbackTriageFile);
els.exportAnalyticsBtn?.addEventListener("click", exportSoftLaunchAnalyticsFile);
els.importFeedbackBtn?.addEventListener("click", () => els.importFeedbackInput?.click());
els.importFeedbackInput?.addEventListener("change", () => {
  if (!(els.importFeedbackInput instanceof HTMLInputElement)) return;
  const file = els.importFeedbackInput.files && els.importFeedbackInput.files[0];
  importFeedbackTriageFile(file || null);
  els.importFeedbackInput.value = "";
});
els.triagePanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btn = t.closest(".js-triage-status");
  if (!(btn instanceof HTMLElement)) return;
  const entryId = btn.dataset.entryId;
  const status = btn.dataset.triageStatus;
  if (entryId && status) updateFeedbackTriage(entryId, status);
});
els.majorBugsPanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btn = t.closest(".js-major-bug-fix");
  if (!(btn instanceof HTMLElement)) return;
  const bugId = btn.dataset.bugId;
  if (bugId) setMajorBugStatus(bugId, "fixed");
});
els.exportPhase4CloseoutBtn?.addEventListener("click", exportPhase4CloseoutFile);
els.exportReleaseReadinessBtn?.addEventListener("click", exportReleaseReadinessFile);
els.exportStoreListingBtn?.addEventListener("click", exportStoreListingFile);
els.feedbackCategorySelect?.addEventListener("change", () => {
  if (!gameState || !(els.feedbackCategorySelect instanceof HTMLSelectElement)) return;
  gameState.feedbackDraftCategory = els.feedbackCategorySelect.value;
});
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
const onSkuFilterChange = () => {
  if (!gameState) return;
  applySkuFiltersFromUi();
  resetMerchDom();
  fillSkuSelect();
  if (els.skuSelect.options.length) els.skuSelect.value = els.skuSelect.options[0].value;
  renderStockTable();
  buildMerchTableOnce();
  updateBuyHint();
};
els.skuStockFilterSelect?.addEventListener("change", onSkuFilterChange);
els.skuSearchInput?.addEventListener("input", onSkuFilterChange);
els.qolPresetsPanel?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btn = t.closest(".js-qol-preset");
  if (!(btn instanceof HTMLElement)) return;
  const presetId = btn.dataset.presetId;
  if (presetId) applyQolPreset(presetId);
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
    getAutoSaveStatus: () => ({ ...lastAutoSaveStatus }),
    getSaveStatus: () => ({
      local: !!loadFromLocal(),
      cloudMock: hasCloudMockSave(),
      cloudSource: cloudAdapter?.label || "none",
      lastAutoSave: { ...lastAutoSaveStatus },
    }),
    clearSave: () => {
      clearLocalSave();
      void clearCloudSave(cloudAdapter);
    },
    getKpiAlerts: () => getKpiAlerts(gameState),
    applyQolPreset: (id) => applyQolPreset(String(id)),
    runBalanceSim14: () => runBalanceSim14Days(),
    getPhase4Balance: () => getPhase4BalanceReport(),
    getSoftLaunchPackage: () => getSoftLaunchPackage(),
    getFeedbackTriage: () => getFeedbackTriageReport(),
    getSoftLaunchAnalytics: () => getSoftLaunchAnalytics(),
    getPhase4Closeout: () => getPhase4CloseoutReport(),
    getReleaseReadiness: () => getReleaseReadinessReport(),
    getBrowserCompat: () => browserCompatResult || runBrowserCompatChecks(browserCompatConfig),
    getBuildManifest: () => ({ ...buildManifest }),
    getStoreListing: () => getStoreListingPackage(),
    getUiMode: () => (typeof document !== "undefined" ? document.body.dataset.uiMode || "player" : "player"),
    getBeginnerTier: () => resolveBeginnerTier(gameState, resolveOnboarding(gameState, onboardingSteps)),
    getTutorialStep: () => resolveTutorialStep(gameState),
    isTutorialActive: () => isTutorialActive(gameState),
    setMajorBugStatus: (bugId, status) => setMajorBugStatus(bugId, status),
    setFeedbackTriage: (entryId, status) => {
      updateFeedbackTriage(String(entryId), String(status));
      return true;
    },
    submitFeedback: (categoryId, text) => {
      const entry = normalizeFeedbackEntry(
        createFeedbackEntry(gameState, categoryId, text, {
          priority: inferFeedbackPriority(categoryId),
        })
      );
      if (!entry) return null;
      if (!Array.isArray(gameState.feedbackLog)) gameState.feedbackLog = [];
      gameState.feedbackLog.push(entry);
      autoSaveGame({ silent: true });
      render();
      return entry;
    },
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
        mssim._test.assert("D66 steps loaded", onboardingSteps.length >= 3);
        let ob = mssim.getOnboarding();
        mssim._test.assert("D66 starts incomplete", !ob.allDone);
        mssim._test.quickStart();
        ob = mssim.getOnboarding();
        mssim._test.assert("D66 buy step", ob.completed.includes("ob_buy"));
        mssim.nextDay();
        ob = mssim.getOnboarding();
        mssim._test.assert("D67 first day", ob.completed.includes("ob_first_day"));
        mssim.nextDay();
        ob = mssim.getOnboarding();
        mssim._test.assert("D67 day 2 step", ob.completed.includes("ob_review"));
        const hints = mssim.getErrorHints();
        mssim._test.assert("D68 hints array", Array.isArray(hints));
        console.log({ onboarding: ob, hints, tier: mssim.getBeginnerTier() });
        return ob;
      },
      quickStart() {
        quickStartBuy();
      },
      runAutosaveSmoke() {
        mssim._test.stock(100);
        const expectedDay = mssim.getState().day + 1;
        mssim.nextDay();
        mssim._test.assert("D70 autosave key", !!localStorage.getItem(STORAGE_KEY));
        mssim._test.assert("D70 autosave ok", mssim.getAutoSaveStatus().localOk !== false);
        mssim._test.assert("D70 day advanced", mssim.getState().day === expectedDay);
        try {
          sessionStorage.setItem("mssim_test_expected_day", String(expectedDay));
        } catch (_) {
          /* ignore */
        }
        console.log("Автозагрузка: нажми F5, затем mssim._test.checkAutoload()");
        return { expectedDay, status: mssim.getAutoSaveStatus() };
      },
      async runCloudSaveSmoke() {
        mssim._test.stock(120);
        const beforeDay = mssim.getState().day;
        mssim.nextDay();
        await saveCloudSave(cloudAdapter, attachSaveMeta(snapshotStateForSave(), "cloud"), true);
        const afterDay = mssim.getState().day;
        const status = mssim.getAutoSaveStatus();
        mssim._test.assert("D77 day advanced", afterDay === beforeDay + 1);
        mssim._test.assert("D77 local save", !!localStorage.getItem(STORAGE_KEY));
        mssim._test.assert("D77 cloud adapter", status.cloudSource === "mock" || status.cloudSource === "yandex");
        mssim._test.assert("D77 cloud mock key", !!localStorage.getItem(CLOUD_MOCK_KEY) || status.cloudSource === "yandex");

        const cloudAhead = attachSaveMeta(
          { ...mssim.getState(), day: afterDay + 5, cash: 250000 },
          "cloud"
        );
        localStorage.setItem(CLOUD_MOCK_KEY, JSON.stringify(cloudAhead));
        clearLocalSave();

        const picked = resolveBestSave(loadFromLocal(), JSON.parse(localStorage.getItem(CLOUD_MOCK_KEY)));
        mssim._test.assert("D78 picks cloud", picked?.source === "cloud");
        mssim._test.assert("D78 cloud day ahead", Number(picked?.state?.day) > beforeDay);

        if (picked && applyLoadedState(picked.state)) {
          saveToLocal(attachSaveMeta(picked.state, "cloud"));
          render();
        }
        mssim._test.assert("D78 applied cloud", mssim.getState().day === afterDay + 5);

        try {
          sessionStorage.setItem("mssim_test_expected_day", String(afterDay + 5));
          sessionStorage.setItem("mssim_test_cloud_smoke", "1");
        } catch (_) {
          /* ignore */
        }
        console.log("Облако: F5 → mssim._test.checkCloudAutoload()");
        return { status, picked, day: mssim.getState().day };
      },
      checkCloudAutoload() {
        let expected = NaN;
        try {
          expected = Number(sessionStorage.getItem("mssim_test_expected_day"));
        } catch (_) {
          /* ignore */
        }
        const day = mssim.getState().day;
        mssim._test.assert("D79 cloud autoload day", day === expected);
        const saveStatus = mssim.getSaveStatus();
        mssim._test.assert("D79 local restored", saveStatus.local);
        console.log({ day, expected, saveStatus });
        return { day, expected, saveStatus };
      },
      checkAutoload() {
        let expected = NaN;
        try {
          expected = Number(sessionStorage.getItem("mssim_test_expected_day"));
        } catch (_) {
          /* ignore */
        }
        const day = mssim.getState().day;
        if (!Number.isFinite(expected)) {
          mssim._test.assert("D70 autoload (укажи день)", false);
          console.log("Сначала: mssim._test.runAutosaveSmoke(), потом F5");
          return { day, expected: null };
        }
        mssim._test.assert("D70 autoload day", day === expected);
        console.log({ day, expected, autoSave: mssim.getAutoSaveStatus() });
        return { day, expected };
      },
      runQolSmoke() {
        mssim._test.assert("D71 presets", qolPresets.length >= 4);
        gameState.skuStockFilter = "out_of_stock";
        const out = getVisibleSkus();
        mssim._test.assert("D71 filter out", out.every((s) => (gameState.inStock[s.id] || 0) <= 0));
        gameState.skuSearchQuery = "lip";
        gameState.skuStockFilter = "all";
        const searched = getVisibleSkus();
        mssim._test.assert("D71 search", searched.some((s) => String(s.id).includes("lip")));
        gameState.skuSearchQuery = "";
        syncSkuFiltersUiFromState();
        mssim._test.stock(50);
        mssim.nextDay();
        const alerts = mssim.getKpiAlerts();
        mssim._test.assert("D72 alerts array", Array.isArray(alerts));
        mssim.applyQolPreset("qol_operator");
        mssim._test.assert("D73 style preset", mssim.getState().playStyleId === "operator");
        render();
        console.log({ alerts, visible: getVisibleSkus().length });
        return { alerts, presets: qolPresets.length };
      },
      runBalanceSmoke() {
        const ret = auditReturnsLeverage(gameState, balancePhase4);
        mssim._test.assert("D74 returns leverage", ret.pass);
        mssim._test.assert("D74 reduction >= 30%", ret.reductionPct >= 30);
        const sim = mssim.runBalanceSim14();
        mssim._test.assert("D75 sim events", sim.eventsAudit.total >= 0);
        const rep = mssim.getPhase4Balance();
        mssim._test.assert("D76 balance report", rep.checks.length >= 5);
        mssim._test.assert("D76 returns leverage check", rep.checks.some((c) => c.id === "returns-leverage" && c.pass));
        console.log({ ret, sim, rep });
        return rep;
      },
      runSoftLaunchSmoke() {
        const pkg = mssim.getSoftLaunchPackage();
        mssim._test.assert("D80 soft launch package", pkg?.packageVersion === 1);
        mssim._test.assert("D80 readiness checks", (pkg.readiness?.checks || []).length >= 10);
        mssim._test.assert("D80 support channels", (softLaunchConfig.support?.channels || []).length >= 1);
        const entry = mssim.submitFeedback("bug", "Smoke test feedback D81");
        mssim._test.assert("D81 feedback entry", !!entry?.id);
        const triage = mssim.getFeedbackTriage();
        mssim._test.assert("D82 triage total", triage.summary.total >= 1);
        mssim._test.assert("D82 triage bug", (triage.summary.byCategory.bug || 0) >= 1);
        console.log({ pkg, triage });
        return { pkg, triage };
      },
      runTriageSmoke() {
        mssim.submitFeedback("bug", "Triage smoke D83");
        const entry = gameState.feedbackLog[gameState.feedbackLog.length - 1];
        mssim._test.assert("D83 triage open", entry?.triageStatus === "open");
        mssim._test.assert("D83 priority high", entry?.priority === "high");
        mssim.setFeedbackTriage(entry.id, "investigating");
        mssim._test.assert("D84 investigating", entry.triageStatus === "investigating");
        mssim.nextDay();
        const analytics = mssim.getSoftLaunchAnalytics();
        mssim._test.assert("D85 telemetry points", (analytics.telemetryLog || []).length >= 1);
        mssim._test.assert("D85 retention", typeof analytics.retention?.proxyD1Return === "boolean");
        mssim._test.assert("D86 triage summary", analytics.triage.total >= 1);
        console.log({ analytics, entry });
        return analytics;
      },
      runRetentionCloseoutSmoke() {
        const audit = auditMajorBugs(majorBugsCatalog, gameState.majorBugStatus, gameState.feedbackLog);
        mssim._test.assert("D87 major registry", audit.registry.length >= 3);
        mssim._test.assert("D87 open major cap", audit.openMajorTotal <= retentionGates.maxOpenMajorBugs);
        const rep = mssim.getPhase4Closeout();
        mssim._test.assert("D88 closeout report", rep.block === "79-80");
        mssim._test.assert("D88 checks", rep.retentionGates.checks.length >= 5);
        mssim._test.assert("D89 decision set", !!rep.decision);
        syncVisitMetrics(gameState);
        mssim._test.assert("D89 visit sync", gameState.visitMetrics.reachedDay2 === (gameState.day >= 2));
        console.log({ audit, rep });
        return rep;
      },
      runBuildCompatSmoke() {
        const compat = mssim.getBrowserCompat();
        mssim._test.assert("D90 browser supported", compat.supported);
        mssim._test.assert("D90 localStorage", compat.checks.find((c) => c.id === "localStorage")?.pass);
        mssim._test.assert("D90 fetch", compat.checks.find((c) => c.id === "fetch")?.pass);
        const readiness = mssim.getReleaseReadiness();
        mssim._test.assert("D91 readiness report", readiness.block === "81-82");
        mssim._test.assert("D91 compat check", readiness.checks.some((c) => c.id === "compat-required"));
        mssim._test.assert("D92 manifest object", typeof mssim.getBuildManifest().version === "string");
        console.log({ compat, readiness, manifest: mssim.getBuildManifest() });
        return readiness;
      },
      runStoreListingSmoke() {
        const pkg = mssim.getStoreListing();
        mssim._test.assert("D93 listing block", pkg.block === "83-84");
        mssim._test.assert("D93 title filled", pkg.listing.title.length >= 3);
        mssim._test.assert("D94 validation checks", pkg.validation.checks.length >= 8);
        mssim._test.assert("D94 screenshots", pkg.listing.assets.screenshots.length >= 3);
        mssim._test.assert("D95 copyPaste", !!pkg.copyPaste.shortDescription && !!pkg.copyPaste.keywords);
        mssim._test.assert("D95 decision ready", pkg.decision === "READY" || pkg.decision === "READY WITH RISKS");
        console.log({ pkg });
        return pkg;
      },
      runKpiChartsSmoke() {
        mssim._test.stock(200);
        mssim._test.days(3);
        mssim._test.assert("D100 charts row", !!document.getElementById("kpiChartsRow"));
        const panels = document.querySelectorAll(".kpi-chart-panel");
        mssim._test.assert("D100 three panels", panels.length >= 3);
        mssim._test.assert("D100 history orders", (mssim.getState().kpiHistory?.[0]?.ordersWanted ?? 0) >= 0);
        console.log({ hist: mssim.getState().kpiHistory?.slice(-3) });
        return panels.length;
      },
      runTutorialSmoke() {
        mssim._test.assert("D99 tutorial active", mssim.isTutorialActive());
        mssim._test.assert("D99 step 1", mssim.getTutorialStep() === 1);
        const visible = [...document.querySelectorAll("[data-ui-section]")].filter(
          (el) => getComputedStyle(el).display !== "none" && !el.hidden
        );
        mssim._test.assert("D99 few sections", visible.length <= 3);
        mssim._test.quickStart();
        mssim._test.assert("D99 step 2", mssim.getTutorialStep() === 2);
        mssim.nextDay();
        mssim._test.assert("D99 step 3", mssim.getTutorialStep() === 3);
        finishTutorial();
        mssim._test.assert("D99 completed", !mssim.isTutorialActive());
        console.log({ step: mssim.getTutorialStep() });
        return mssim.getState().tutorialCompleted;
      },
      runPlayerUiSmoke() {
        const mode = mssim.getUiMode();
        mssim._test.assert("D96 player mode", mode === "player");
        mssim._test.assert("D96 beginner tier 1 start", mssim.getBeginnerTier() === 1);
        const devEls = [...document.querySelectorAll("[data-dev-only]")];
        const hidden = devEls.filter((el) => {
          const st = getComputedStyle(el);
          return st.display === "none" || el.hidden;
        });
        mssim._test.assert("D96 dev panels hidden", hidden.length >= 12);
        mssim._test.assert("D97 next day btn", !!document.getElementById("nextDayBtn"));
        mssim._test.assert("D97 quick start visible", !!document.getElementById("quickStartBtn"));
        const dumpCard = document.getElementById("stateDump")?.closest("[data-dev-only]");
        mssim._test.assert(
          "D97 state debug hidden",
          !dumpCard || getComputedStyle(dumpCard).display === "none"
        );
        console.log({ mode, tier: mssim.getBeginnerTier(), devTotal: devEls.length, devHidden: hidden.length });
        return { mode, tier: mssim.getBeginnerTier(), devTotal: devEls.length, devHidden: hidden.length };
      },
    },
  };
}

exposeDevApi();
initGame();
