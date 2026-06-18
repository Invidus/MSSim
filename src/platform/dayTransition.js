/** @type {HTMLElement | null} */
let root = null;
let playing = false;

const DAY_TRANSITION_HOLD_MS = 2200;
const DAY_TRANSITION_EXIT_MS = 300;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureRoot() {
  if (root instanceof HTMLElement) return root;
  root = document.createElement("div");
  root.id = "dayTransitionRoot";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="day-transition-backdrop" aria-hidden="true"></div>
    <div class="day-transition-sweep" aria-hidden="true"></div>
    <div class="day-transition-card" role="presentation">
      <div class="day-transition-kicker">Новый день</div>
      <div class="day-transition-day"></div>
      <div class="day-transition-meta"></div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

export function isDayTransitionPlaying() {
  return playing;
}

/**
 * @param {{ day?: number; profit?: number|null; silent?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export function playDayTransition(opts = {}) {
  if (opts.silent || prefersReducedMotion()) return Promise.resolve();
  if (playing) return Promise.resolve();

  const el = ensureRoot();
  const dayEl = el.querySelector(".day-transition-day");
  const metaEl = el.querySelector(".day-transition-meta");
  if (!(dayEl instanceof HTMLElement) || !(metaEl instanceof HTMLElement)) return Promise.resolve();

  const day = Math.max(1, Math.round(Number(opts.day) || 1));
  dayEl.textContent = `День ${day}`;

  const profit = opts.profit;
  metaEl.className = "day-transition-meta";
  if (profit != null && Number.isFinite(Number(profit))) {
    const p = Math.round(Number(profit));
    const sign = p > 0 ? "+" : "";
    metaEl.innerHTML = `Прибыль за день: <b>${sign}${p.toLocaleString("ru-RU")} ₽</b>`;
    metaEl.classList.add(p >= 0 ? "day-transition-profit-pos" : "day-transition-profit-neg");
    metaEl.hidden = false;
  } else {
    metaEl.textContent = "";
    metaEl.hidden = true;
  }

  playing = true;
  document.body.classList.add("day-transition-active");
  el.hidden = false;
  el.classList.remove("day-transition-exit");
  el.classList.remove("day-transition-visible");

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      el.classList.add("day-transition-visible");
    });

    window.setTimeout(() => {
      el.classList.remove("day-transition-visible");
      el.classList.add("day-transition-exit");
      window.setTimeout(() => {
        el.hidden = true;
        el.classList.remove("day-transition-exit");
        document.body.classList.remove("day-transition-active");
        playing = false;
        resolve();
      }, DAY_TRANSITION_EXIT_MS);
    }, DAY_TRANSITION_HOLD_MS);
  });
}
