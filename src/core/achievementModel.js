import { totalStockForOnboarding } from "./onboardingModel.js";
import { hasCustomShopName } from "./storeIdentityModel.js";
import { isQuestCompleted } from "./questModel.js";
import { CRYPTO_EXCHANGE_NODE_ID, getProgressionModifiers } from "./progressionModel.js";
import {
  boughtAnyFullExchangeStack,
  boughtAllExchangeStacks,
} from "./cryptoExchangeModel.js";
import {
  ownsLuxuryItem,
  getLuxurySpendTotal,
  countLuxuryOwned,
  ownsAnyLuxuryIsland,
} from "./luxuryAssetsModel.js";

/** @typedef {{ id: string; title: string; desc: string; icon: string; tier: string }} AchievementDef */

const STORY_EVENT_ACHIEVEMENTS = [
  { id: "ach_story_theft", eventId: "evt_story_warehouse_theft" },
  { id: "ach_story_robbery", eventId: "evt_story_night_robbery" },
  { id: "ach_hot_sale", eventId: "evt_story_hot_batch" },
  { id: "ach_story_gift", eventId: "evt_story_platform_gift" },
  { id: "ach_story_viral", eventId: "evt_story_viral_review" },
  { id: "ach_story_flood", eventId: "evt_story_flood_damage" },
];

const TEAM_MEMBER_NODES = {
  ach_team_content: "n22",
  ach_team_analyst: "n23",
  ach_team_buyer: "n24",
  ach_team_marketer: "n25",
  ach_team_leads: "n29",
};

const ANY_TEAM_NODES = ["n22", "n23", "n24", "n25", "n26", "n27", "n28", "n29"];

const SYNERGY_ACHIEVEMENTS = [
  { id: "ach_syn_growth", synergyId: "syn_growth_flywheel" },
  { id: "ach_syn_ops", synergyId: "syn_ops_quality" },
  { id: "ach_syn_full_stack", synergyId: "syn_full_stack" },
  { id: "ach_syn_commerce", synergyId: "syn_commerce_brand" },
  { id: "ach_syn_team", synergyId: "syn_team_engine" },
  { id: "ach_syn_automation", synergyId: "syn_automation_loop" },
  { id: "ach_syn_control", synergyId: "syn_control_room" },
];

/** Топовые позиции каталога «Имущество». */
const LUXURY_ITEM_ACHIEVEMENTS = [
  { id: "ach_lux_lambo", itemId: "car_lambo" },
  { id: "ach_lux_villa", itemId: "home_villa" },
  { id: "ach_lux_g650", itemId: "plane_g650" },
  { id: "ach_lux_bbj", itemId: "plane_bbj" },
  { id: "ach_lux_superyacht", itemId: "yacht_super" },
  { id: "ach_lux_auction", itemId: "art_auction" },
  { id: "ach_lux_diamond", itemId: "watch_diamond" },
  { id: "ach_lux_atoll", itemId: "island_atoll" },
  { id: "ach_lux_sovereign", itemId: "island_sovereign" },
];

const LUXURY_GRAIL_ITEM_IDS = LUXURY_ITEM_ACHIEVEMENTS.map((row) => row.itemId);

/** @type {AchievementDef[]} */
let achievementCatalog = [];

/**
 * @param {AchievementDef[]} list
 */
export function setAchievementCatalog(list) {
  achievementCatalog = Array.isArray(list) ? list : [];
}

export function getAchievementCatalog() {
  return achievementCatalog;
}

/**
 * @param {string} id
 */
export function getAchievementById(id) {
  return achievementCatalog.find((a) => a.id === id) || null;
}

/**
 * @param {object} state
 * @param {string} eventId
 */
function eventHappened(state, eventId) {
  const log = state?.eventLog || [];
  return log.some((e) => e.eventId === eventId);
}

/**
 * @param {object} state
 * @param {string} nodeId
 */
function isNodeUnlocked(state, nodeId) {
  return state?.progressionUnlocked?.[nodeId] === true;
}

/**
 * @param {object} state
 */
function simulatedServiceRating(state) {
  if (!state?.lastDayReport) return 0;
  return Number(state.lastDayReport.totals?.serviceRating ?? state.kpi?.serviceRating ?? 0);
}

/**
 * @param {object} state
 */
function hasCryptoTrade(state) {
  const c = state?.crypto;
  if (!c) return false;
  return (Number(c.totalBoughtRub) || 0) > 0 || (Number(c.totalSoldRub) || 0) > 0;
}

/**
 * @param {object} state
 * @param {{ lastEventId?: string; cryptoAssets?: import("./cryptoExchangeModel.js").CryptoAssetDef[]; progressionNodes?: import("./progressionModel.js").ProgressionNode[]; progressionSynergies?: Array<{ id: string }> }} [ctx]
 * @returns {AchievementDef[]}
 */
export function evaluateAchievements(state, ctx = {}) {
  if (!state || !achievementCatalog.length) return [];
  const unlocked = new Set(state.unlockedAchievements || []);
  const newly = [];
  const cryptoAssets = ctx.cryptoAssets || [];

  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  const hasGoods = stock > 0 || incoming > 0;
  const profit = Number(state.kpi?.profit) || 0;
  const service = simulatedServiceRating(state);
  const upgrades = Object.values(state.progressionUnlocked || {}).filter((v) => v === true).length;
  const cash = Number(state.cash) || 0;
  const cryptoPnl = Number(state.crypto?.realizedPnl) || 0;
  const progMods = getProgressionModifiers(
    state,
    ctx.progressionNodes || [],
    ctx.progressionSynergies || []
  );
  const activeSynergyIds = new Set((progMods.activeSynergies || []).map((s) => s.id));
  const luxurySpend = getLuxurySpendTotal(state);
  const luxuryOwned = countLuxuryOwned(state);

  const storyChecks = STORY_EVENT_ACHIEVEMENTS.map((row) => ({
    id: row.id,
    pass:
      ctx.lastEventId === row.eventId ||
      eventHappened(state, row.eventId),
  }));

  const checks = [
    { id: "ach_tutorial_done", pass: state.tutorialCompleted === true },
    { id: "ach_shop_named", pass: hasCustomShopName(state) },
    { id: "ach_first_buy", pass: hasGoods },
    { id: "ach_first_day", pass: !!state.lastDayReport },
    { id: "ach_first_profit", pass: !!state.lastDayReport && profit > 0 },
    { id: "ach_cash_1m", pass: cash >= 1_000_000 },
    { id: "ach_cash_1b", pass: cash >= 1_000_000_000 },
    { id: "ach_day_7", pass: Number(state.day) >= 7 },
    { id: "ach_day_14", pass: Number(state.day) >= 14 },
    { id: "ach_upgrade", pass: upgrades > 0 },
    { id: "ach_crypto_open", pass: isNodeUnlocked(state, CRYPTO_EXCHANGE_NODE_ID) },
    { id: "ach_crypto_trade", pass: hasCryptoTrade(state) },
    { id: "ach_crypto_profit", pass: cryptoPnl > 0 },
    { id: "ach_crypto_stack_one", pass: boughtAnyFullExchangeStack(state, cryptoAssets) },
    { id: "ach_crypto_stack_all", pass: boughtAllExchangeStacks(state, cryptoAssets) },
    { id: "ach_team_first", pass: ANY_TEAM_NODES.some((id) => isNodeUnlocked(state, id)) },
    ...Object.entries(TEAM_MEMBER_NODES).map(([achId, nodeId]) => ({
      id: achId,
      pass: isNodeUnlocked(state, nodeId),
    })),
    ...storyChecks,
    ...SYNERGY_ACHIEVEMENTS.map((row) => ({
      id: row.id,
      pass: activeSynergyIds.has(row.synergyId),
    })),
    { id: "ach_luxury_first", pass: luxuryOwned >= 1 },
    { id: "ach_luxury_collector", pass: luxuryOwned >= 5 },
    { id: "ach_luxury_elite", pass: luxurySpend >= 10_000_000 },
    { id: "ach_luxury_magnate", pass: luxurySpend >= 50_000_000 },
    { id: "ach_luxury_legend", pass: luxurySpend >= 200_000_000 },
    { id: "ach_luxury_titan", pass: luxurySpend >= 500_000_000 },
    { id: "ach_luxury_oligarch", pass: luxurySpend >= 1_000_000_000 },
    { id: "ach_luxury_overlord", pass: luxurySpend >= 5_000_000_000 },
    { id: "ach_lux_island", pass: ownsAnyLuxuryIsland(state) },
    {
      id: "ach_lux_grail",
      pass: LUXURY_GRAIL_ITEM_IDS.every((itemId) => ownsLuxuryItem(state, itemId)),
    },
    ...LUXURY_ITEM_ACHIEVEMENTS.map((row) => ({
      id: row.id,
      pass: ownsLuxuryItem(state, row.itemId),
    })),
    { id: "ach_service_45", pass: !!state.lastDayReport && service >= 4.5 },
    { id: "ach_quest_done", pass: isQuestCompleted(state) },
  ];

  for (const row of checks) {
    if (!row.pass || unlocked.has(row.id)) continue;
    const def = getAchievementById(row.id);
    if (!def) continue;
    unlocked.add(row.id);
    newly.push(def);
  }

  state.unlockedAchievements = [...unlocked];
  return newly;
}

/**
 * @param {object} state
 */
export function countUnlockedAchievements(state) {
  return (state?.unlockedAchievements || []).length;
}
