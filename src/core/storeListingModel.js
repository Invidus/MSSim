const LIMITS = {
  titleMax: 48,
  shortDescriptionMax: 255,
  longDescriptionMax: 4000,
  howToPlayMax: 1500,
  keywordsMin: 3,
  keywordsMax: 12,
  screenshotsMin: 3,
};

/**
 * @param {object} [raw]
 */
export function normalizeStoreListing(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const assets = b.assets && typeof b.assets === "object" ? b.assets : {};
  const screenshots = Array.isArray(assets.screenshots) ? assets.screenshots : [];
  return {
    platform: String(b.platform || "yandex-games"),
    locale: String(b.locale || "ru"),
    title: String(b.title || ""),
    titleEn: String(b.titleEn || ""),
    shortDescription: String(b.shortDescription || ""),
    longDescription: String(b.longDescription || ""),
    howToPlay: String(b.howToPlay || ""),
    keywords: Array.isArray(b.keywords) ? b.keywords.map(String) : [],
    ageRating: String(b.ageRating || "6+"),
    category: String(b.category || ""),
    assets: {
      icon: assets.icon && typeof assets.icon === "object" ? assets.icon : null,
      cover: assets.cover && typeof assets.cover === "object" ? assets.cover : null,
      heroCover: assets.heroCover && typeof assets.heroCover === "object" ? assets.heroCover : null,
      screenshots: screenshots.filter((s) => s && s.id),
    },
    moderationChecklist: Array.isArray(b.moderationChecklist) ? b.moderationChecklist.map(String) : [],
  };
}

/**
 * @param {object} listing
 */
export function validateStoreListing(listing) {
  const l = normalizeStoreListing(listing);
  const checks = [
    {
      id: "title",
      label: `Название 3–${LIMITS.titleMax} символов`,
      pass: l.title.length >= 3 && l.title.length <= LIMITS.titleMax,
      value: l.title.length,
    },
    {
      id: "short-description",
      label: `Краткое описание 20–${LIMITS.shortDescriptionMax} символов`,
      pass: l.shortDescription.length >= 20 && l.shortDescription.length <= LIMITS.shortDescriptionMax,
      value: l.shortDescription.length,
    },
    {
      id: "long-description",
      label: `Полное описание >= 100 символов`,
      pass: l.longDescription.length >= 100 && l.longDescription.length <= LIMITS.longDescriptionMax,
      value: l.longDescription.length,
    },
    {
      id: "how-to-play",
      label: "Блок «Как играть» заполнен",
      pass: l.howToPlay.length >= 30,
      value: l.howToPlay.length,
    },
    {
      id: "keywords",
      label: `Ключевые слова ${LIMITS.keywordsMin}–${LIMITS.keywordsMax}`,
      pass: l.keywords.length >= LIMITS.keywordsMin && l.keywords.length <= LIMITS.keywordsMax,
      value: l.keywords.length,
    },
    {
      id: "icon-asset",
      label: "Спека иконки 512×512",
      pass: l.assets.icon?.width === 512 && l.assets.icon?.height === 512,
      value: l.assets.icon?.path || "",
    },
    {
      id: "cover-asset",
      label: "Обложка 800×470",
      pass: l.assets.cover?.width === 800 && l.assets.cover?.height === 470,
      value: l.assets.cover?.path || "",
    },
    {
      id: "screenshots",
      label: `Скриншоты >= ${LIMITS.screenshotsMin}`,
      pass: l.assets.screenshots.length >= LIMITS.screenshotsMin,
      value: l.assets.screenshots.length,
    },
    {
      id: "moderation-list",
      label: "Чеклист модерации >= 4 пунктов",
      pass: l.moderationChecklist.length >= 4,
      value: l.moderationChecklist.length,
    },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const ratio = checks.length ? passCount / checks.length : 0;
  const decision = ratio >= 0.9 ? "READY" : ratio >= 0.7 ? "READY WITH RISKS" : "NOT READY";
  return { checks, passCount, totalChecks: checks.length, decision, limits: LIMITS };
}

/**
 * @param {object} listing
 * @param {object} [validation]
 */
export function buildStoreListingPackage(listing, validation) {
  const l = normalizeStoreListing(listing);
  const v = validation || validateStoreListing(l);
  return {
    exportedAt: new Date().toISOString(),
    block: "83-84",
    phase: 5,
    platform: l.platform,
    locale: l.locale,
    decision: v.decision,
    passCount: v.passCount,
    totalChecks: v.totalChecks,
    validation: v,
    listing: l,
    copyPaste: {
      title: l.title,
      shortDescription: l.shortDescription,
      longDescription: l.longDescription,
      howToPlay: l.howToPlay,
      keywords: l.keywords.join(", "),
    },
    assetPaths: {
      icon: l.assets.icon?.path || null,
      cover: l.assets.cover?.path || null,
      heroCover: l.assets.heroCover?.path || null,
      screenshots: l.assets.screenshots.map((s) => s.path),
    },
  };
}

export { LIMITS };
