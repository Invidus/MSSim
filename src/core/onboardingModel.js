export function totalStockForOnboarding(state) {
  return Object.values(state?.inStock || {}).reduce((acc, x) => acc + (Number(x) || 0), 0);
}

/**
 * @param {object} state
 * @param {string} check
 */
export function checkOnboardingCondition(state, check) {
  const k = state?.kpi || {};
  const hist = Array.isArray(state?.kpiHistory) ? state.kpiHistory : [];
  switch (check) {
    case "purchase_or_stock":
      return totalStockForOnboarding(state) > 0 || (state?.incomingShipments?.length || 0) > 0;
    case "simulated":
      return !!state?.lastDayReport;
    case "kpi_seen":
      return !!state?.lastDayReport && Number(state?.day) >= 1;
    case "play_style":
      return !!state?.playStyleId;
    case "day_7_profit": {
      if (Number(state?.day) < 7) return false;
      const recent = hist.slice(-3);
      if (recent.some((h) => Number(h.profit) > 0)) return true;
      return Number(k.profit) > 0;
    }
    default:
      return false;
  }
}

/**
 * @param {object} state
 * @param {Array<{ id: string; title: string; body: string; check: string }>} steps
 */
export function syncOnboardingProgress(state, steps) {
  if (!state || state.onboardingHidden) return state.onboardingCompletedIds || [];
  const done = Array.isArray(state.onboardingCompletedIds) ? [...state.onboardingCompletedIds] : [];
  for (const step of steps || []) {
    if (done.includes(step.id)) continue;
    if (checkOnboardingCondition(state, step.check)) done.push(step.id);
  }
  state.onboardingCompletedIds = done;
  return done;
}

/**
 * @param {object} state
 * @param {Array<{ id: string; title: string; body: string; check: string }>} steps
 */
export function resolveOnboarding(state, steps) {
  const completed = syncOnboardingProgress(state, steps);
  const doneSet = new Set(completed);
  let currentStep = null;
  for (const step of steps || []) {
    if (!doneSet.has(step.id)) {
      currentStep = step;
      break;
    }
  }
  const total = (steps || []).length;
  const progress = total > 0 ? completed.length / total : 1;
  return {
    completed,
    currentStep,
    allDone: !currentStep,
    progress,
    totalSteps: total,
    hidden: !!state?.onboardingHidden,
  };
}

/**
 * Подсказки по текущим ошибкам / рискам KPI.
 * @param {object} state
 */
export function getErrorHints(state) {
  if (!state || state.onboardingHidden) return [];
  const hints = [];
  const k = state?.kpi || {};
  const stock = totalStockForOnboarding(state);
  const incoming = state?.incomingShipments?.length || 0;

  if (!state.lastDayReport) {
    hints.push({
      id: "hint_simulate",
      severity: "info",
      text: "Симуляция ещё не запускалась — нажмите Next Day после закупки.",
    });
  }
  if (stock <= 0 && incoming <= 0 && Number(state.day) <= 5) {
    hints.push({
      id: "hint_buy",
      severity: "high",
      text: "Нет остатков и поставок — закупите SKU, иначе продаж не будет.",
    });
  }
  if (state.lastDayReport && Number(k.stockoutRate) > 0.2) {
    hints.push({
      id: "hint_stockout",
      severity: "high",
      text: `Высокий stockout (${(Number(k.stockoutRate) * 100).toFixed(0)}%) — увеличьте закупку или снизьте рекламу.`,
    });
  }
  if (state.lastDayReport && Number(k.profit) < 0) {
    hints.push({
      id: "hint_profit",
      severity: "medium",
      text: "Отрицательная прибыль — поднимите цены, снизьте рекламу или выберите стиль «Оператор».",
    });
  }
  if (state.lastDayReport && Number(k.returnPct) > 0.14) {
    hints.push({
      id: "hint_returns",
      severity: "medium",
      text: "Высокие возвраты — улучшите качество карточки и не завышайте цену.",
    });
  }
  if (state.lastDayReport && Number(k.daysOfStock) < 1 && stock > 0) {
    hints.push({
      id: "hint_days_stock",
      severity: "medium",
      text: "Запас меньше 1 дня продаж — планируйте дозаказ заранее.",
    });
  }
  if (!state.playStyleId && !!state.lastDayReport) {
    hints.push({
      id: "hint_style",
      severity: "low",
      text: "Выберите стиль игры — так проще держать баланс расходов.",
    });
  }
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  hints.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return hints;
}
