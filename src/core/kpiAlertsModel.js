import { STOCKOUT_NOUN } from "./playerLabels.js";

/**
 * Активные KPI-алерты для панели QoL (фаза 4).
 * @param {object} state
 */
export function getKpiAlerts(state) {
  if (!state?.lastDayReport) return [];
  const k = state.kpi || {};
  const alerts = [];

  if (Number(k.profit) < 0) {
    alerts.push({
      id: "alert_profit",
      severity: "high",
      title: "Убыток",
      text: `Прибыль ${Math.round(k.profit).toLocaleString("ru-RU")} ₽ — проверьте цены, рекламу и возвраты.`,
    });
  }
  if (Number(k.stockoutRate) > 0.2) {
    alerts.push({
      id: "alert_stockout",
      severity: "high",
      title: `Высокий ${STOCKOUT_NOUN}`,
      text: `${(Number(k.stockoutRate) * 100).toFixed(0)}% спроса не закрыто — пополните остатки.`,
    });
  } else if (Number(k.stockoutRate) > 0.08) {
    alerts.push({
      id: "alert_stockout_watch",
      severity: "medium",
      title: "Растёт дефицит на складе",
      text: `${(Number(k.stockoutRate) * 100).toFixed(0)}% — планируйте дозаказ.`,
    });
  }
  if (Number(k.returnPct) > 0.14) {
    alerts.push({
      id: "alert_returns",
      severity: "medium",
      title: "Высокие возвраты",
      text: `${(Number(k.returnPct) * 100).toFixed(0)}% — улучшите качество карточки.`,
    });
  }
  if (Number(k.acos) > 0.35 && Number(k.profit) < Number(k.revenue) * 0.1) {
    alerts.push({
      id: "alert_acos",
      severity: "medium",
      title: "Высокий ACOS",
      text: `ACOS ${(Number(k.acos) * 100).toFixed(0)}% при слабой марже — снизьте бюджет или поднимите конверсию.`,
    });
  }
  if (Number(k.daysOfStock) < 1 && Number(k.daysOfStock) >= 0) {
    alerts.push({
      id: "alert_days_stock",
      severity: "medium",
      title: "Мало дней запаса",
      text: `Запас ~${Number(k.daysOfStock).toFixed(1)} дн. — риск дефицита на следующий день.`,
    });
  }
  const sr = Number(k.serviceRating ?? state.lastDayReport?.totals?.serviceRating ?? 5);
  if (sr < 3.6) {
    alerts.push({
      id: "alert_service",
      severity: "high",
      title: "Просадка сервиса",
      text: `Рейтинг ${sr.toFixed(2)} — снизьте дефицит на складе и возвраты.`,
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return alerts;
}
