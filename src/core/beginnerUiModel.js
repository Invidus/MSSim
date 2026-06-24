import { totalStockForOnboarding } from "./onboardingModel.js";

/**
 * @param {object} state
 * @param {{ allDone?: boolean } | null} [onboardingView]
 * @returns {1|2|3|4}
 */
export function resolveBeginnerTier(state, onboardingView) {
  if (!state) return 1;
  if (state.beginnerUiExpanded) return 4;
  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  const hasGoods = stock > 0 || incoming > 0;
  const simulated = !!state.lastDayReport;
  const day = Number(state.day) || 1;

  if (!hasGoods) return 1;
  if (!simulated) return 2;
  if (day < 3 && !onboardingView?.allDone) return 3;
  return 4;
}

/**
 * @param {object} state
 * @param {{ allDone?: boolean; currentStep?: { id: string } | null } | null} onboardingView
 */
export function getNextPlayerAction(state, onboardingView) {
  if (!state || state.onboardingHidden) return null;
  const stock = totalStockForOnboarding(state);
  const incoming = state.incomingShipments?.length || 0;
  const hasGoods = stock > 0 || incoming > 0;

  if (!hasGoods) {
    return {
      step: 1,
      totalSteps: 3,
      title: "Закупите первый товар",
      body: "Без товара на складе продаж не будет. Выберите товар в блоке «Закупка» и нажмите «Закупить».",
      cta: null,
      ctaLabel: null,
    };
  }
  if (!state.lastDayReport) {
    return {
      step: 2,
      totalSteps: 3,
      title: "Запустите первый день продаж",
      body: "Товар есть — нажмите «Следующий день» в правом нижнем углу. Игра посчитает заказы, выручку и прибыль.",
      cta: "nextDay",
      ctaLabel: "Следующий день",
    };
  }
  if (!onboardingView?.allDone) {
    const profit = Number(state.kpi?.profit) || 0;
    const profitHint =
      profit >= 0
        ? `Прибыль за день: ${Math.round(profit).toLocaleString("ru-RU")} ₽ — неплохо!`
        : "Прибыль отрицательная — попробуйте снизить рекламу или поднять цены.";
    return {
      step: 3,
      totalSteps: 3,
      title: "Разберите результат",
      body: `${profitHint} Если товар заканчивается — закупите ещё. На 3-й день откроются стили игры и прогрессия.`,
      cta: null,
      ctaLabel: null,
    };
  }
  return null;
}

/**
 * @param {1|2|3|4} tier
 * @param {number} [day] — игровой день; с 3-го тизер скрывается целиком
 */
export function beginnerTeaserText(tier, day = 1) {
  const d = Math.max(1, Math.round(Number(day) || 1));
  if (tier >= 4 || d >= 3) return "";
  const lines = [];
  if (tier < 2) lines.push("После закупки откроются реклама и статус поставок.");
  if (tier < 3) lines.push("После первого дня откроются KPI и настройка цен с остатками.");
  if (tier < 4 && d < 3) lines.push("На 3-й день — стили игры, события и прогрессия.");
  return lines.join(" ");
}
