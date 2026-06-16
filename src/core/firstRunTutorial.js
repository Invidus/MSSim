import { totalStockForOnboarding } from "./onboardingModel.js";

/** @typedef {1|2|3|0} TutorialStep */

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
 * @returns {TutorialStep}
 */
export function resolveTutorialStep(state) {
  if (!isTutorialActive(state)) return 0;
  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  const hasGoods = stock > 0 || incoming > 0;
  if (!hasGoods) return 1;
  if (!state.lastDayReport) return 2;
  if (Number(state.day) < 2) return 3;
  return 0;
}

/**
 * @param {TutorialStep} step
 */
export function tutorialVisibleSections(step) {
  switch (step) {
    case 1:
      return ["tutorial", "buy"];
    case 2:
      return ["tutorial", "summary"];
    case 3:
      return ["tutorial", "yesterday", "kpi"];
    default:
      return [];
  }
}

/**
 * @param {TutorialStep} step
 * @param {object} [state]
 */
export function getTutorialContent(step, state) {
  switch (step) {
    case 1:
      return {
        step: 1,
        totalSteps: 3,
        title: "Добро пожаловать в симулятор маркетплейса",
        body: "Вы управляете магазином: закупаете товар и смотрите прибыль каждый день. Сейчас пройдём первый цикл за пару минут — остальные разделы спрячем.",
        cta: "quickStart",
        ctaLabel: "Стартовая закупка",
      };
    case 2: {
      const cash = Math.round(Number(state?.cash) || 0).toLocaleString("ru-RU");
      const stock = totalStockForOnboarding(state);
      return {
        step: 2,
        totalSteps: 3,
        title: "Запустите первый день продаж",
        body: `На складе ${stock} шт. · на счёте ${cash} ₽. Нажмите фиолетовую кнопку «Следующий день» вверху — игра посчитает заказы и прибыль.`,
        cta: "nextDay",
        ctaLabel: "Следующий день",
        highlightNextDay: true,
      };
    }
    case 3: {
      const profit = Math.round(Number(state?.kpi?.profit) || 0).toLocaleString("ru-RU");
      const revenue = Math.round(Number(state?.kpi?.revenue) || 0).toLocaleString("ru-RU");
      return {
        step: 3,
        totalSteps: 3,
        title: "Ваш первый результат",
        body: `Выручка ${revenue} ₽ · прибыль ${profit} ₽. Ниже — краткие показатели. На следующем дне откроется больше настроек магазина.`,
        cta: "finishTutorial",
        ctaLabel: "Понятно, продолжить",
      };
    }
    default:
      return null;
  }
}

/**
 * @param {object} state
 */
export function syncTutorialCompletion(state) {
  if (!state || !isTutorialActive(state)) return false;
  if (resolveTutorialStep(state) !== 0) return false;
  state.tutorialCompleted = true;
  return true;
}

/**
 * @param {object} raw
 */
export function migrateTutorialFlags(raw) {
  if (!raw || typeof raw !== "object") {
    return { tutorialCompleted: false, tutorialSkipped: false };
  }
  if (raw.tutorialCompleted === true || raw.tutorialSkipped === true) {
    return {
      tutorialCompleted: raw.tutorialCompleted === true,
      tutorialSkipped: raw.tutorialSkipped === true,
    };
  }
  const day = Number(raw.day) || 1;
  const veteran = day >= 4 && !!raw.lastDayReport;
  return {
    tutorialCompleted: veteran,
    tutorialSkipped: false,
  };
}
