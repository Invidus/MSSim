let menuOpen = false;
let feedbackOpen = false;
let confirmOpen = false;
/** @type {(() => void) | null} */
let onReset = null;
/** @type {(() => void) | null} */
let onRestartTutorial = null;
/** @type {(() => void) | null} */
let onFeedbackOpen = null;

/**
 * @param {{
 *   onReset?: () => void;
 *   onRestartTutorial?: () => void;
 *   onFeedbackOpen?: () => void;
 * }} [opts]
 */
export function initGameMenu(opts = {}) {
  onReset = opts.onReset || null;
  onRestartTutorial = opts.onRestartTutorial || null;
  onFeedbackOpen = opts.onFeedbackOpen || null;

  const menuBtn = document.getElementById("gameMenuBtn");
  const menuRoot = document.getElementById("gameMenuOverlay");
  const menuClose = document.getElementById("gameMenuCloseBtn");
  const menuBackdrop = menuRoot?.querySelector(".game-menu-backdrop");
  const tutorialBtn = document.getElementById("gameMenuTutorialBtn");
  const feedbackBtn = document.getElementById("gameMenuFeedbackBtn");
  const resetBtn = document.getElementById("gameMenuResetBtn");

  const feedbackRoot = document.getElementById("feedbackOverlay");
  const feedbackClose = document.getElementById("feedbackOverlayClose");
  const feedbackBackdrop = feedbackRoot?.querySelector(".feedback-backdrop");

  const confirmRoot = document.getElementById("gameConfirmOverlay");
  const confirmBackdrop = confirmRoot?.querySelector(".game-confirm-backdrop");
  const confirmCancel = document.getElementById("gameConfirmCancelBtn");
  const confirmOk = document.getElementById("gameConfirmOkBtn");

  if (menuBtn instanceof HTMLElement) {
    menuBtn.addEventListener("click", () => {
      if (menuOpen) closeGameMenu();
      else openGameMenu();
    });
  }
  if (menuClose instanceof HTMLElement) menuClose.addEventListener("click", closeGameMenu);
  if (menuBackdrop instanceof HTMLElement) menuBackdrop.addEventListener("click", closeGameMenu);

  if (tutorialBtn instanceof HTMLElement) {
    tutorialBtn.addEventListener("click", () => {
      showGameConfirm({
        title: "Обучение заново",
        message:
          "Запустить обучение с первого шага? Деньги, склад, день игры и улучшения сохранятся — сбросится только прохождение подсказок.",
        confirmLabel: "Запустить обучение",
        cancelLabel: "Отмена",
        onConfirm: () => {
          closeGameMenu();
          onRestartTutorial?.();
        },
      });
    });
  }

  if (feedbackBtn instanceof HTMLElement) {
    feedbackBtn.addEventListener("click", () => {
      closeGameMenu();
      openFeedbackOverlay();
      onFeedbackOpen?.();
    });
  }

  if (resetBtn instanceof HTMLElement) {
    resetBtn.addEventListener("click", () => {
      closeGameMenu();
      onReset?.();
    });
  }

  if (feedbackClose instanceof HTMLElement) feedbackClose.addEventListener("click", closeFeedbackOverlay);
  if (feedbackBackdrop instanceof HTMLElement) feedbackBackdrop.addEventListener("click", closeFeedbackOverlay);

  if (confirmCancel instanceof HTMLElement) confirmCancel.addEventListener("click", closeGameConfirm);
  if (confirmOk instanceof HTMLElement) {
    confirmOk.addEventListener("click", () => {
      const cb = pendingConfirm;
      pendingConfirm = null;
      closeGameConfirm();
      cb?.();
    });
  }
  if (confirmBackdrop instanceof HTMLElement) confirmBackdrop.addEventListener("click", closeGameConfirm);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isGameConfirmOpen()) closeGameConfirm();
    else if (feedbackOpen) closeFeedbackOverlay();
    else if (menuOpen) closeGameMenu();
  });
}

/** @type {(() => void) | null} */
let pendingConfirm = null;

/**
 * @param {{ title: string; message: string; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void }} opts
 */
export function showGameConfirm(opts) {
  const root = document.getElementById("gameConfirmOverlay");
  const titleEl = document.getElementById("gameConfirmTitle");
  const messageEl = document.getElementById("gameConfirmMessage");
  const okBtn = document.getElementById("gameConfirmOkBtn");
  const cancelBtn = document.getElementById("gameConfirmCancelBtn");
  if (!(root instanceof HTMLElement)) return;

  pendingConfirm = opts.onConfirm || null;
  confirmOpen = true;
  if (titleEl) titleEl.textContent = opts.title || "Подтверждение";
  if (messageEl) messageEl.textContent = opts.message || "";
  if (okBtn instanceof HTMLElement) {
    okBtn.textContent = opts.confirmLabel || "Да";
    okBtn.dataset.confirmAction = "1";
  }
  if (cancelBtn instanceof HTMLElement) {
    cancelBtn.textContent = opts.cancelLabel || "Отмена";
  }

  root.hidden = false;
  document.body.classList.add("game-confirm-open");
  requestAnimationFrame(() => {
    root.querySelector(".game-confirm-modal")?.classList.add("game-confirm-modal-visible");
  });
}

export function closeGameConfirm() {
  const root = document.getElementById("gameConfirmOverlay");
  const modal = root?.querySelector(".game-confirm-modal");
  if (!(root instanceof HTMLElement)) return;
  pendingConfirm = null;
  confirmOpen = false;
  modal?.classList.remove("game-confirm-modal-visible");
  document.body.classList.remove("game-confirm-open");
  window.setTimeout(() => {
    if (!confirmOpen) root.hidden = true;
  }, 200);
}

export function isGameConfirmOpen() {
  return confirmOpen;
}

export function openGameMenu() {
  const root = document.getElementById("gameMenuOverlay");
  const panel = root?.querySelector(".game-menu-panel");
  if (!(root instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
  menuOpen = true;
  root.hidden = false;
  document.body.classList.add("game-menu-open");
  requestAnimationFrame(() => panel.classList.add("game-menu-panel-visible"));
}

export function closeGameMenu() {
  const root = document.getElementById("gameMenuOverlay");
  const panel = root?.querySelector(".game-menu-panel");
  if (!(root instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
  menuOpen = false;
  panel.classList.remove("game-menu-panel-visible");
  document.body.classList.remove("game-menu-open");
  window.setTimeout(() => {
    if (!menuOpen) root.hidden = true;
  }, 220);
}

export function openFeedbackOverlay() {
  const root = document.getElementById("feedbackOverlay");
  const modal = root?.querySelector(".feedback-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  feedbackOpen = true;
  root.hidden = false;
  document.body.classList.add("feedback-open");
  requestAnimationFrame(() => modal.classList.add("feedback-modal-visible"));
}

export function closeFeedbackOverlay() {
  const root = document.getElementById("feedbackOverlay");
  const modal = root?.querySelector(".feedback-modal");
  if (!(root instanceof HTMLElement) || !(modal instanceof HTMLElement)) return;
  feedbackOpen = false;
  modal.classList.remove("feedback-modal-visible");
  document.body.classList.remove("feedback-open");
  window.setTimeout(() => {
    if (!feedbackOpen) root.hidden = true;
  }, 220);
}

export function isFeedbackOverlayOpen() {
  return feedbackOpen;
}
