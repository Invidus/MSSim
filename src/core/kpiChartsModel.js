/**
 * Мини-графики KPI (SVG) для дашборда — без внешних библиотек.
 */

/**
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 * @param {number} [pad]
 */
export function sparklinePath(values, width, height, pad = 4) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + innerH * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${pts.join(" L ")}`;
}

/**
 * @param {number[]} values
 */
export function barChartSvg(values, width = 200, height = 56, color = "#8fd694") {
  const pad = 6;
  const n = Math.max(1, values.length);
  const max = Math.max(...values, 1);
  const gap = 3;
  const barW = (width - pad * 2 - gap * (n - 1)) / n;
  const bars = values
    .map((v, i) => {
      const h = ((Number(v) || 0) / max) * (height - pad * 2);
      const x = pad + i * (barW + gap);
      const y = height - pad - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}" opacity="0.92"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" class="kpi-chart-svg" aria-hidden="true">${bars}</svg>`;
}

/**
 * @param {{ value: number; color: string; label?: string }[]} parts
 */
export function donutChartSvg(parts, size = 56, stroke = 10) {
  const total = parts.reduce((s, p) => s + Math.max(0, Number(p.value) || 0), 0);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  if (total <= 0) {
    return `<svg viewBox="0 0 ${size} ${size}" class="kpi-chart-svg kpi-chart-donut" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2b2e3a" stroke-width="${stroke}"/></svg>`;
  }
  let angle = -90;
  const segs = parts
    .filter((p) => (Number(p.value) || 0) > 0)
    .map((p) => {
      const v = Number(p.value) || 0;
      const sweep = (v / total) * 360;
      const start = polar(cx, cy, r, angle);
      const end = polar(cx, cy, r, angle + sweep);
      const large = sweep > 180 ? 1 : 0;
      angle += sweep;
      return `<path d="M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}" fill="none" stroke="${p.color}" stroke-width="${stroke}" stroke-linecap="butt"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" class="kpi-chart-svg kpi-chart-donut" aria-hidden="true">${segs}</svg>`;
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * @param {number[]} series
 */
export function pctChangeVsPrev(series) {
  if (!series || series.length < 2) return null;
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null;
  if (Math.abs(prev) < 0.0001) return curr > 0 ? 100 : curr < 0 ? -100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * @param {number|null} pct
 * @param {{ invert?: boolean }} [opts]
 */
export function formatChartPct(pct, opts = {}) {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

/**
 * @param {number|null} pct
 * @param {{ invert?: boolean }} [opts]
 */
export function pctClass(pct, opts = {}) {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.5) return "kpi-warn";
  const good = opts.invert ? pct < 0 : pct > 0;
  const bad = opts.invert ? pct > 0 : pct < 0;
  if (good) return "kpi-good";
  if (bad) return "kpi-bad";
  return "kpi-warn";
}

const CHART_WINDOW = 7;

/**
 * @param {object} state
 */
export function buildKpiChartPanels(state) {
  const hist = Array.isArray(state?.kpiHistory) ? state.kpiHistory : [];
  const slice = hist.slice(-CHART_WINDOW);
  const profitSeries = slice.map((h) => Number(h.profit) || 0);
  const ordersSeries = slice.map((h) => Number(h.ordersWanted) || 0);
  const adSeries = slice.map((h) => Number(h.adCost) || 0);

  const profitPct = pctChangeVsPrev(profitSeries);
  const ordersPct = pctChangeVsPrev(ordersSeries);
  const adPct = pctChangeVsPrev(adSeries);

  const profitPath = sparklinePath(profitSeries.length ? profitSeries : [0], 200, 56);
  const ordersBars = barChartSvg(ordersSeries.length ? ordersSeries : [0]);
  const t = state?.lastDayReport?.totals || {};
  const adCost = Math.max(0, Number(t.adCost) || 0);
  const profit = Number(t.operatingProfit) || 0;
  const net = Math.max(0, Number(t.netRevenue) || 0);
  const other = Math.max(0, net - adCost - Math.max(0, profit));

  const donut = donutChartSvg([
    { value: Math.max(0, profit), color: "#8fd694", label: "Прибыль" },
    { value: adCost, color: "#7a4cff", label: "Реклама" },
    { value: other, color: "#3a3f52", label: "Прочее" },
  ]);

  return [
    {
      id: "profit",
      title: "Прибыль",
      icon: "↗",
      pct: profitPct,
      pctClass: pctClass(profitPct),
      chart:
        profitSeries.length > 0
          ? `<svg viewBox="0 0 200 56" class="kpi-chart-svg" aria-hidden="true"><defs><linearGradient id="kpiLineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#5ecf70"/><stop offset="100%" stop-color="#8fd694"/></linearGradient></defs><path d="${profitPath}" fill="none" stroke="url(#kpiLineG)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<div class="kpi-chart-empty muted">Нет истории</div>`,
      caption: slice.length < 2 ? "после 2-го дня — динамика" : "к прошлому дню",
    },
    {
      id: "orders",
      title: "Заказы",
      icon: "🛒",
      pct: ordersPct,
      pctClass: pctClass(ordersPct),
      chart: ordersBars,
      caption: slice.length < 2 ? "желание покупателей" : "к прошлому дню",
    },
    {
      id: "ads",
      title: "Реклама",
      icon: "◎",
      pct: adPct,
      pctClass: pctClass(adPct, { invert: true }),
      chart: `<div class="kpi-chart-donut-wrap">${donut}</div>`,
      caption: adCost > 0 ? `бюджет ${Math.round(adCost).toLocaleString("ru-RU")} ₽/день` : "без расходов на рекламу",
    },
  ];
}

/**
 * @param {object[]} panels
 */
export function renderKpiChartsHtml(panels) {
  if (!panels?.length) {
    return `<div class="muted">Графики появятся после первого дня.</div>`;
  }
  return panels
    .map(
      (p) => `<div class="kpi-chart-panel" data-chart-id="${p.id}">
  <div class="kpi-chart-head">
    <span class="kpi-chart-icon">${p.icon}</span>
    <span class="kpi-chart-label">${p.title}</span>
    <span class="kpi-chart-pct ${p.pctClass}">${formatChartPct(p.pct)}</span>
  </div>
  ${p.chart}
  <div class="kpi-chart-caption muted">${p.caption}</div>
</div>`
    )
    .join("");
}
