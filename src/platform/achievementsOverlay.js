import { getAchievementCatalog } from "../core/achievementModel.js";
import { closeGameMenu } from "./gameMenu.js";

let open = false;

/**
 * @param {object} state
 */
export function renderAchievementsOverlay(state) {
  const listEl = document.getElementById("achievementsList");
  const metaEl = document.getElementById("achievementsMeta");
  if (!(listEl instanceof HTMLElement)) return;

  const catalog = getAchievementCatalog();
  const unlocked = new Set(state?.unlockedAchievements || []);
  const total = catalog.length;
  const done = catalog.filter((a) => unlocked.has(a.id)).length;

  if (metaEl instanceof HTMLElement) {
    metaEl.textContent = total ? `Открыто ${done} из ${total}` : "Загрузка…";
  }

  if (!catalog.length) {
    listEl.innerHTML = `<p class="muted">Список достижений пуст.</p>`;
    return;
  }

  const tierOrder = { easy: 0, medium: 1, hard: 2 };
  const sorted = [...catalog].sort((a, b) => {
    const ta = tierOrder[a.tier] ?? 9;
    const tb = tierOrder[b.tier] ?? 9;
    if (ta !== tb) return ta - tb;
    return String(a.title).localeCompare(String(b.title), "ru");
  });

  listEl.innerHTML = sorted
    .map((a) => {
      const ok = unlocked.has(a.id);
      const tierLabel = a.tier === "hard" ? "сложное" : a.tier === "medium" ? "среднее" : "простое";
      return `<div class="achievement-row ${ok ? "achievement-row--unlocked" : "achievement-row--locked"}">
        <div class="achievement-row-icon" aria-hidden="true">${a.icon || "🏆"}</div>
        <div class="achievement-row-body">
          <div class="achievement-row-title">${a.title}${ok ? ' <span class="achievement-row-badge">✓</span>' : ""}</div>
          <div class="achievement-row-desc muted">${a.desc}</div>
          <div class="achievement-row-tier muted">${tierLabel}</div>
        </div>
      </div>`;
    })
    .join("");
}

export function openAchievementsOverlay(state) {
  const root = document.getElementById("achievementsOverlay");
  const modal = root?.querySelector(".achievements-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  renderAchievementsOverlay(state);
  root.hidden = false;
  document.body.classList.add("achievements-open");
  open = true;
  requestAnimationFrame(() => modal.classList.add("feedback-modal-visible"));
}

export function closeAchievementsOverlay() {
  const root = document.getElementById("achievementsOverlay");
  const modal = root?.querySelector(".achievements-modal");
  if (!(root instanceof HTMLElement)) return;
  modal?.classList.remove("feedback-modal-visible");
  document.body.classList.remove("achievements-open");
  open = false;
  window.setTimeout(() => {
    if (!open) root.hidden = true;
  }, 220);
}

export function isAchievementsOverlayOpen() {
  return open;
}

/**
 * @param {{ getState: () => object | null }} opts
 */
export function initAchievementsOverlay(opts = {}) {
  const root = document.getElementById("achievementsOverlay");
  const closeBtn = document.getElementById("achievementsCloseBtn");
  const backdrop = root?.querySelector(".achievements-backdrop");
  const menuBtn = document.getElementById("gameMenuAchievementsBtn");

  if (closeBtn instanceof HTMLElement) closeBtn.addEventListener("click", closeAchievementsOverlay);
  if (backdrop instanceof HTMLElement) backdrop.addEventListener("click", closeAchievementsOverlay);

  if (menuBtn instanceof HTMLElement) {
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeGameMenu();
      window.setTimeout(() => {
        const state = opts.getState?.();
        openAchievementsOverlay(state || {});
      }, 230);
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeAchievementsOverlay();
  });
}