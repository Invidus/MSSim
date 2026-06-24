import { totalStockForOnboarding } from "./onboardingModel.js";

/** @typedef {{ id: string; title: string; body: string; cta?: string | null; ctaLabel?: string | null; rewardRub?: number }} QuestStepDef */

/** @type {QuestStepDef[]} */
const QUEST_STEPS = [
  {
    id: "buy",
    title: "Шаг 1 · Первая закупка",
    body: "Выберите товар, укажите количество и нажмите «Закупить». Партия поедет в путь.",
    rewardRub: 2000,
    cta: null,
    ctaLabel: null,
  },
  {
    id: "wait_goods",
    title: "Шаг 2 · Ждём поставку",
    body: "Товар в пути или уже на складе. Когда будете готовы — переходите к первому дню продаж.",
    rewardRub: 1500,
    cta: "advanceQuest",
    ctaLabel: "Готов к продажам",
  },
  {
    id: "first_day",
    title: "Шаг 3 · Первый день",
    body: "Нажмите «Следующий день» в углу экрана. Игра посчитает заказы и прибыль.",
    rewardRub: 3000,
    cta: null,
    ctaLabel: null,
  },
  {
    id: "read_result",
    title: "Шаг 4 · Итог дня",
    body: "Смотрите прибыль и остаток в сводке. Зелёная прибыль — хорошо, красная — попробуйте снизить рекламу.",
    rewardRub: 1500,
    cta: "advanceQuest",
    ctaLabel: "Понятно",
  },
  {
    id: "tune",
    title: "Шаг 5 · Одна настройка",
    body: "Подкрутите рекламный бюджет или цену одного товара — и запомните, что изменили.",
    rewardRub: 2000,
    cta: "advanceQuest",
    ctaLabel: "Настроил(а)",
    requiresTuneChange: true,
  },
  {
    id: "second_day",
    title: "Шаг 6 · Второй день",
    body: "Снова нажмите «Следующий день» и сравните прибыль с прошлым днём.",
    rewardRub: 2500,
    cta: null,
    ctaLabel: null,
  },
  {
    id: "goal",
    title: "Шаг 7 · Мини-цель",
    body: "Держите на счёте больше 80 000 ₽ и не оставайтесь без товара. Дальше откроются все разделы.",
    rewardRub: 5000,
    cta: "finishQuest",
    ctaLabel: "Завершить обучение",
  },
];

export function getQuestStepCount() {
  return QUEST_STEPS.length;
}

/**
 * @param {object} state
 */
export function isSimpleQuestActive(state) {
  if (!state || state.simpleQuestCompleted) return false;
  if (state.simpleQuestDisabled) return false;
  return true;
}

/**
 * @param {object} state
 */
export function isQuestCompleted(state) {
  return state?.simpleQuestCompleted === true;
}

/**
 * @param {object} state
 */
function questAdBaseline(state) {
  return state?.questAdBaseline || { enabled: false, budget: 0 };
}

/**
 * @param {object} state
 */
export function hasQuestTuneChange(state) {
  if (!state) return false;
  const base = questAdBaseline(state);
  const adEnabled = state.adEnabled !== false;
  const baseEnabled = base.enabled !== false;
  const adBudget = Math.max(0, Math.round(Number(state.adBudget) || 0));
  const baseBudget = Math.max(0, Math.round(Number(base.budget) || 0));
  if (adEnabled !== baseEnabled || adBudget !== baseBudget) return true;

  const priceBase = state.questPriceBaseline || {};
  const prices = state.skuPrices || {};
  const ids = new Set([...Object.keys(priceBase), ...Object.keys(prices)]);
  for (const id of ids) {
    const cur = Math.max(0, Math.round(Number(prices[id]) || 0));
    const orig = Math.max(0, Math.round(Number(priceBase[id]) || 0));
    if (cur !== orig) return true;
  }
  return false;
}

/**
 * Сбрасывает рекламу к стартовым значениям шага 5 и фиксирует базу для сравнения.
 * @param {object} state
 */
export function primeQuestTuneStep(state) {
  if (!state) return;
  state.questAdBaseline = { enabled: false, budget: 0 };
  state.questPriceBaseline = { ...(state.skuPrices || {}) };
  state.adEnabled = false;
  state.adBudget = 0;
  state.questTunePrimed = true;
}

/**
 * @param {object} state
 */
export function ensureQuestTuneBaseline(state) {
  if (!isSimpleQuestActive(state)) return;
  const step = Math.max(1, Math.round(Number(state.simpleQuestStep) || 1));
  if (step !== 5 || state.questTunePrimed === true) return;
  primeQuestTuneStep(state);
}

/**
 * @param {object} state
 */
export function resolveQuestStepIndex(state) {
  if (!isSimpleQuestActive(state)) return 0;
  const manual = Math.max(1, Math.round(Number(state.simpleQuestStep) || 1));
  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  const hasGoods = stock > 0 || incoming > 0;
  let step = manual;

  if (!hasGoods) step = 1;
  else if (step === 1) step = 2;
  else if (step === 3 && state.lastDayReport) step = 4;
  else if (step === 6 && Number(state.day) >= 2 && state.lastDayReport) step = 7;

  state.simpleQuestStep = Math.min(step, QUEST_STEPS.length);
  return state.simpleQuestStep;
}

/**
 * @param {object} state
 */
export function getQuestStepContent(state) {
  const idx = resolveQuestStepIndex(state);
  if (!idx) return null;
  const def = QUEST_STEPS[idx - 1];
  if (!def) return null;
  const claimed = new Set(state?.simpleQuestRewardsClaimed || []);
  const rewardRub = Math.max(0, Number(def.rewardRub) || 0);
  const rewardClaimed = claimed.has(idx);
  const tuneReady = def.requiresTuneChange === true ? hasQuestTuneChange(state) : true;
  return {
    ...def,
    step: idx,
    totalSteps: QUEST_STEPS.length,
    rewardRub,
    rewardClaimed,
    rewardPending: rewardRub > 0 && !rewardClaimed,
    cta: def.cta && tuneReady ? def.cta : null,
    ctaLabel: def.cta && tuneReady ? def.ctaLabel : null,
    waitHint:
      def.requiresTuneChange === true && !tuneReady
        ? "Измените рекламный бюджет или цену товара — кнопка появится после настройки."
        : null,
  };
}

/**
 * @param {object} state
 * @returns {Array<{ step: number; amount: number }>}
 */
export function syncQuestRewards(state) {
  if (!state) return [];
  const payouts = [];
  const claimed = new Set(state.simpleQuestRewardsClaimed || []);
  const idx = isSimpleQuestActive(state) ? resolveQuestStepIndex(state) : QUEST_STEPS.length + 1;
  const maxStep = state.simpleQuestCompleted ? QUEST_STEPS.length : Math.max(0, idx - 1);

  for (let s = 1; s <= maxStep; s++) {
    if (claimed.has(s)) continue;
    const def = QUEST_STEPS[s - 1];
    const amount = Math.max(0, Number(def?.rewardRub) || 0);
    if (!amount) continue;
    state.cash = (Number(state.cash) || 0) + amount;
    claimed.add(s);
    payouts.push({ step: s, amount });
  }

  state.simpleQuestRewardsClaimed = [...claimed];
  return payouts;
}

/**
 * @param {object} state
 */
export function advanceQuestStep(state) {
  if (!isSimpleQuestActive(state)) return false;
  const idx = resolveQuestStepIndex(state);
  if (idx >= QUEST_STEPS.length) return false;
  if (idx === 4) primeQuestTuneStep(state);
  state.simpleQuestStep = idx + 1;
  resolveQuestStepIndex(state);
  return true;
}

/**
 * @param {object} state
 */
export function completeSimpleQuest(state) {
  if (!state) return;
  state.simpleQuestStep = QUEST_STEPS.length;
  state.simpleQuestCompleted = true;
}

/**
 * @param {object} state
 * @returns {1|2|3|4}
 */
export function questBeginnerTierCap(state) {
  if (!isSimpleQuestActive(state)) return 4;
  const step = resolveQuestStepIndex(state);
  if (step <= 2) return 1;
  if (step <= 4) return 2;
  if (step <= 6) return 3;
  return 3;
}

/**
 * @param {object} state
 */
export function shouldUseSimpleKpi(state) {
  return isSimpleQuestActive(state) && resolveQuestStepIndex(state) < QUEST_STEPS.length;
}
