import { totalStockForOnboarding } from "./onboardingModel.js";

/** @typedef {import('./firstRunTutorial.js').TutorialStepDef} TutorialStepDef */

/** @type {TutorialStepDef[]} */
const DEFAULT_TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Добро пожаловать",
    body: "Симулятор продавца маркетплейса.",
    tips: [],
    visibleSections: ["tutorial"],
    spotlight: ".app-header",
    placement: "bottom",
    highlights: [],
    advance: "manual",
    cta: "advanceTutorial",
    ctaLabel: "Начнём",
  },
];

/** @type {TutorialStepDef[]} */
let tutorialSteps = [...DEFAULT_TUTORIAL_STEPS];

/**
 * @param {TutorialStepDef[]} steps
 */
export function setTutorialSteps(steps) {
  tutorialSteps = Array.isArray(steps) && steps.length ? steps : [...DEFAULT_TUTORIAL_STEPS];
}

export function getTutorialSteps() {
  return tutorialSteps;
}

export function getTutorialStepCount() {
  return tutorialSteps.length;
}

/**
 * @param {object} state
 */
export function isTutorialActive(state) {
  if (!state) return false;
  if (state.tutorialCompleted || state.tutorialSkipped) return false;
  if (state.onboardingHidden) return false;
  return true;
}

/**
 * @param {object} state
 */
function hasGoods(state) {
  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  return stock > 0 || incoming > 0;
}

/**
 * @param {object} state
 */
export function syncTutorialBeat(state) {
  if (!isTutorialActive(state)) return;
  if (state.tutorialBeatLocked) {
    const max = tutorialSteps.length;
    state.tutorialBeat = Math.max(1, Math.min(Math.round(Number(state.tutorialBeat) || 1), max));
    return;
  }
  let beat = Math.max(1, Math.round(Number(state.tutorialBeat) || 1));
  const max = tutorialSteps.length;

  if (!hasGoods(state) && beat > 3) beat = 3;
  if (!state.lastDayReport && beat > 5) beat = 5;

  if (beat === 3 && hasGoods(state)) beat = 4;
  if (beat === 5 && state.lastDayReport) beat = 6;

  state.tutorialBeat = Math.min(beat, max);
}

/**
 * @param {object} state
 * @returns {number}
 */
export function resolveTutorialStep(state) {
  if (!isTutorialActive(state)) return 0;
  syncTutorialBeat(state);
  return Math.max(1, Math.round(Number(state.tutorialBeat) || 1));
}

/**
 * @param {number} step
 */
export function tutorialVisibleSections(step) {
  const def = tutorialSteps[step - 1];
  return def?.visibleSections?.length ? [...def.visibleSections] : ["tutorial"];
}

/**
 * @param {number} step
 * @param {object} [state]
 */
export function getTutorialContent(step, state) {
  const def = tutorialSteps[step - 1];
  if (!def) return null;

  const totalSteps = tutorialSteps.length;
  let body = def.body;

  if (def.id === "buy_action" && state) {
    const cash = Math.round(Number(state.cash) || 0).toLocaleString("ru-RU");
    body = `${def.body} На счёте ${cash} ₽.`;
  }
  if (def.id === "cash" && state) {
    const stock = totalStockForOnboarding(state);
    const cash = Math.round(Number(state.cash) || 0).toLocaleString("ru-RU");
    body = `${def.body} Сейчас: ${stock} шт. на складе · ${cash} ₽.`;
  }
  if (def.id === "results" && state?.lastDayReport) {
    const profit = Math.round(Number(state.kpi?.profit) || 0).toLocaleString("ru-RU");
    const revenue = Math.round(Number(state.kpi?.revenue) || 0).toLocaleString("ru-RU");
    body = `${def.body} Ваш первый день: выручка ${revenue} ₽, прибыль ${profit} ₽.`;
  }

  const interactive = def.advance === "has_goods" || def.advance === "simulated";

  return {
    step,
    totalSteps,
    id: def.id,
    title: def.title,
    body,
    tips: Array.isArray(def.tips) ? def.tips : [],
    cta: interactive ? null : def.cta || null,
    ctaLabel: interactive ? null : def.ctaLabel || null,
    interactive,
    waitHint: def.waitHint || null,
    spotlight: def.spotlight || null,
    placement: def.placement || "bottom",
    highlights: Array.isArray(def.highlights) ? def.highlights : [],
    highlightNextDay: def.highlightNextDay === true,
    showBuyManual: def.showBuyManual === true,
    advance: def.advance || "manual",
  };
}

/**
 * @param {object} state
 * @returns {boolean}
 */
export function canAdvanceDayDuringTutorial(state) {
  if (!isTutorialActive(state)) return true;
  const step = resolveTutorialStep(state);
  const def = tutorialSteps[step - 1];
  return def?.highlightNextDay === true;
}

/**
 * Перезапуск обучения без сброса прогресса игры.
 * @param {object} state
 */
export function prepareTutorialRestart(state) {
  if (!state) return;
  state.tutorialCompleted = false;
  state.tutorialSkipped = false;
  state.tutorialBeat = 1;
  state.onboardingHidden = false;
  state.tutorialBeatLocked = true;
}

export function advanceTutorialBeat(state) {
  if (!isTutorialActive(state)) return false;
  state.tutorialBeatLocked = false;
  const beat = Math.max(1, Math.round(Number(state.tutorialBeat) || 1));
  const def = tutorialSteps[beat - 1];
  if (def?.advance === "finish") return false;
  state.tutorialBeat = Math.min(beat + 1, tutorialSteps.length);
  syncTutorialBeat(state);
  return true;
}

/**
 * @param {object} state
 */
export function syncTutorialCompletion(state) {
  void state;
  return false;
}

/**
 * @param {object} raw
 */
export function migrateTutorialFlags(raw) {
  if (!raw || typeof raw !== "object") {
    return { tutorialCompleted: false, tutorialSkipped: false, tutorialBeat: 1 };
  }
  if (raw.tutorialCompleted === true || raw.tutorialSkipped === true) {
    return {
      tutorialCompleted: raw.tutorialCompleted === true,
      tutorialSkipped: raw.tutorialSkipped === true,
      tutorialBeat: Math.max(1, Math.round(Number(raw.tutorialBeat) || 1)),
    };
  }
  const day = Number(raw.day) || 1;
  const veteran = day >= 4 && !!raw.lastDayReport;
  return {
    tutorialCompleted: veteran,
    tutorialSkipped: false,
    tutorialBeat: veteran ? tutorialSteps.length : Math.max(1, Math.round(Number(raw.tutorialBeat) || 1)),
  };
}
