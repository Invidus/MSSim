/** @typedef {{ id: string; name?: string; categoryId?: string; tier?: string }} SkuThumbInput */

/** @type {Record<string, { caption: string; emoji: string; bg1: string; bg2: string }>} */
const SKU_VISUAL_PRESETS = {
  beauty_lip_01: { caption: "Губы", emoji: "💄", bg1: "#4a1838", bg2: "#a8326a" },
  beauty_mask_02: { caption: "Маска", emoji: "🧖", bg1: "#2a3850", bg2: "#4a78a8" },
  beauty_brush_03: { caption: "Кисти", emoji: "🖌️", bg1: "#3d3020", bg2: "#8b6840" },
  beauty_cream_04: { caption: "Крем", emoji: "", bg1: "#1a3848", bg2: "#3a88a8", custom: "faceCream" },
  beauty_shampoo_05: { caption: "Шампунь", emoji: "🧴", bg1: "#1a3550", bg2: "#2d6a9a" },
  beauty_perfume_06: { caption: "Парфюм", emoji: "✨", bg1: "#3d2858", bg2: "#7a4cff" },
  beauty_serum_07: { caption: "Сыворотка", emoji: "💧", bg1: "#142838", bg2: "#2a88c8" },
  beauty_kit_08: { caption: "Набор", emoji: "🎁", bg1: "#3a2848", bg2: "#8b5090" },
  beauty_wipes_09: { caption: "Салфетки", emoji: "🧻", bg1: "#2a3a48", bg2: "#5a8098" },
  beauty_tonic_10: { caption: "Тоник", emoji: "🍶", bg1: "#1e4048", bg2: "#3a98a0" },
  beauty_oil_11: { caption: "Масло тела", emoji: "", bg1: "#3a3018", bg2: "#b89028", custom: "bodyOil" },
  beauty_spf_12: { caption: "SPF", emoji: "☀️", bg1: "#4a3818", bg2: "#c89030" },

  home_container_01: { caption: "Контейнер", emoji: "📦", bg1: "#283838", bg2: "#4a7878" },
  home_towel_02: { caption: "Полотенца", emoji: "🛁", bg1: "#2a4050", bg2: "#5a90a8" },
  home_box_03: { caption: "Ланч-бокс", emoji: "🍱", bg1: "#3a3028", bg2: "#8a6850" },
  home_knife_04: { caption: "Ножи", emoji: "🔪", bg1: "#383838", bg2: "#707880" },
  home_glass_05: { caption: "Стаканы", emoji: "🥛", bg1: "#2a3858", bg2: "#6a88b8" },
  home_pan_06: { caption: "Сковорода", emoji: "🍳", bg1: "#3a2818", bg2: "#8a5830" },
  home_lamp_07: { caption: "Лампа", emoji: "💡", bg1: "#3a3818", bg2: "#a8a030" },
  home_mat_08: { caption: "Коврик", emoji: "🧶", bg1: "#3a2840", bg2: "#8a5088" },
  home_scale_09: { caption: "Весы", emoji: "⚖️", bg1: "#2a3038", bg2: "#687888" },
  home_organizer_10: { caption: "Органайзер", emoji: "🗄️", bg1: "#283040", bg2: "#587098" },
  home_mixer_11: { caption: "Миксер", emoji: "🌀", bg1: "#2a2848", bg2: "#5a58a8" },
  home_vacuum_12: { caption: "Пылесос", emoji: "🧹", bg1: "#302838", bg2: "#785878" },

  electronics_cable_01: { caption: "Кабель", emoji: "🔌", bg1: "#1a2840", bg2: "#3a5890" },
  electronics_charger_02: { caption: "Зарядка", emoji: "⚡", bg1: "#2a3018", bg2: "#6a8830" },
  electronics_hub_03: { caption: "USB-хаб", emoji: "🔗", bg1: "#1e2848", bg2: "#4858a0" },
  electronics_earbuds_04: { caption: "Наушники", emoji: "🎧", bg1: "#181e38", bg2: "#404890" },
  electronics_powerbank_05: { caption: "Powerbank", emoji: "🔋", bg1: "#1a3828", bg2: "#3a8860" },
  electronics_speaker_06: { caption: "Колонка", emoji: "🔊", bg1: "#281838", bg2: "#683888" },
  electronics_watch_07: { caption: "Браслет", emoji: "⌚", bg1: "#1a2838", bg2: "#3a5878" },
  electronics_mouse_08: { caption: "Мышь", emoji: "🖱️", bg1: "#242428", bg2: "#585860" },
  electronics_keyboard_09: { caption: "Клавиатура", emoji: "⌨️", bg1: "#1e1e28", bg2: "#484858" },
  electronics_tablet_10: { caption: "Подставка", emoji: "📱", bg1: "#1a3048", bg2: "#3a6898" },
  electronics_headset_11: { caption: "Гарнитура", emoji: "🎮", bg1: "#281838", bg2: "#683878" },
  electronics_monitor_12: { caption: "Монитор", emoji: "🖥️", bg1: "#181c30", bg2: "#384878" },

  kids_blocks_01: { caption: "Конструктор", emoji: "🧱", bg1: "#4a2818", bg2: "#c06030" },
  kids_puzzle_02: { caption: "Пазл", emoji: "🧩", bg1: "#2a3848", bg2: "#5888b0" },
  kids_crayons_03: { caption: "Мелки", emoji: "🖍️", bg1: "#4a3020", bg2: "#b07040" },
  kids_book_04: { caption: "Книга", emoji: "📚", bg1: "#3a2848", bg2: "#7858a0" },
  kids_plush_05: { caption: "Игрушка", emoji: "🧸", bg1: "#4a3028", bg2: "#a87058" },
  kids_paint_06: { caption: "Краски", emoji: "🎨", bg1: "#3a2840", bg2: "#8858a0" },
  kids_scooter_07: { caption: "Самокат", emoji: "🛴", bg1: "#2a4038", bg2: "#58a078" },
  kids_craft_08: { caption: "Творчество", emoji: "✂️", bg1: "#483028", bg2: "#a07050" },
  kids_robot_09: { caption: "Робот", emoji: "🤖", bg1: "#283040", bg2: "#5878a0" },
  kids_drone_10: { caption: "Дрон", emoji: "🚁", bg1: "#1e3040", bg2: "#4890b0" },
  kids_tablet_11: { caption: "Планшет", emoji: "📱", bg1: "#2a2848", bg2: "#6868b0" },
  kids_camp_12: { caption: "Поход", emoji: "⛺", bg1: "#2a3820", bg2: "#688838" },

  apparel_sock_01: { caption: "Носки", emoji: "🧦", bg1: "#382838", bg2: "#886878" },
  apparel_tee_02: { caption: "Футболка", emoji: "👕", bg1: "#283848", bg2: "#5878a0" },
  apparel_belt_03: { caption: "Ремень", emoji: "👔", bg1: "#382818", bg2: "#886838" },
  apparel_cap_04: { caption: "Кепка", emoji: "🧢", bg1: "#283040", bg2: "#587090" },
  apparel_jeans_05: { caption: "Джинсы", emoji: "👖", bg1: "#1a2840", bg2: "#3a5888" },
  apparel_dress_06: { caption: "Платье", emoji: "👗", bg1: "#4a1838", bg2: "#a04878" },
  apparel_jacket_07: { caption: "Куртка", emoji: "🧥", bg1: "#283028", bg2: "#587060" },
  apparel_sneakers_08: { caption: "Кроссовки", emoji: "👟", bg1: "#302818", bg2: "#786040" },
  apparel_hoodie_09: { caption: "Худи", emoji: "🧶", bg1: "#382848", bg2: "#8868a0" },
  apparel_coat_10: { caption: "Пальто", emoji: "🧥", bg1: "#303028", bg2: "#707060" },
  apparel_boots_11: { caption: "Ботинки", emoji: "👢", bg1: "#382818", bg2: "#886040" },
  apparel_suit_12: { caption: "Костюм", emoji: "🤵", bg1: "#282830", bg2: "#585868" },

  pet_bowl_01: { caption: "Миска", emoji: "🍽️", bg1: "#3a3020", bg2: "#8a7840" },
  pet_toy_02: { caption: "Игрушка", emoji: "🦴", bg1: "#403028", bg2: "#987850" },
  pet_collar_03: { caption: "Ошейник", emoji: "🐕", bg1: "#382818", bg2: "#886838" },
  pet_food_04: { caption: "Корм", emoji: "🥫", bg1: "#3a2818", bg2: "#906030" },
  pet_leash_05: { caption: "Поводок", emoji: "🦮", bg1: "#303820", bg2: "#788848" },
  pet_shampoo_06: { caption: "Шампунь", emoji: "🐾", bg1: "#2a3848", bg2: "#5a88a8" },
  pet_carrier_07: { caption: "Переноска", emoji: "🧳", bg1: "#383028", bg2: "#887858" },
  pet_treats_08: { caption: "Лакомства", emoji: "🦴", bg1: "#4a3018", bg2: "#a87838" },
  pet_bed_09: { caption: "Лежанка", emoji: "🛏️", bg1: "#382838", bg2: "#886878" },
  pet_aquarium_10: { caption: "Аквариум", emoji: "🐠", bg1: "#143848", bg2: "#2890a8" },
  pet_scratcher_11: { caption: "Когтеточка", emoji: "🐱", bg1: "#3a2830", bg2: "#8a6878" },
  pet_autofeed_12: { caption: "Кормушка", emoji: "🤖", bg1: "#283038", bg2: "#607888" },
};

const CATEGORY_FALLBACK = {
  beauty: { emoji: "💄", bg1: "#3d2848", bg2: "#8b4078" },
  home: { emoji: "🏠", bg1: "#243838", bg2: "#4a8880" },
  electronics: { emoji: "📱", bg1: "#1e2a3d", bg2: "#3a5898" },
  kids: { emoji: "🧸", bg1: "#3d3428", bg2: "#a88848" },
  apparel: { emoji: "👕", bg1: "#282f3d", bg2: "#5a6898" },
  pet: { emoji: "🐾", bg1: "#3a3028", bg2: "#8a7858" },
  sports: { emoji: "⚽", bg1: "#1e3d2a", bg2: "#3a9868" },
};

/**
 * @param {string} name
 */
function captionFromName(name) {
  const n = String(name || "").trim();
  if (!n) return "Товар";
  const word = n.split(/\s+/)[0];
  return word.length > 10 ? `${word.slice(0, 9)}…` : word;
}

/**
 * @param {SkuThumbInput} sku
 */
function resolveVisual(sku) {
  const preset = SKU_VISUAL_PRESETS[String(sku.id)];
  if (preset) return preset;

  const cat = String(sku.categoryId || sku.id.split("_")[0] || "beauty");
  const fb = CATEGORY_FALLBACK[cat] || CATEGORY_FALLBACK.beauty;
  return {
    caption: captionFromName(sku.name),
    emoji: fb.emoji,
    bg1: fb.bg1,
    bg2: fb.bg2,
  };
}

/** @type {Record<string, () => string>} */
const CUSTOM_THUMB_ART = {
  faceCream: () => `
    <ellipse cx="36" cy="17" rx="15" ry="4.5" fill="#eceef2"/>
    <rect x="21" y="13" width="30" height="7" rx="3" fill="#d4d8e0"/>
    <ellipse cx="36" cy="13" rx="12" ry="2.5" fill="#f4f6fa"/>
    <path d="M20 21 L20 45 Q36 50 52 45 L52 21 Z" fill="#fafafc" stroke="#b8c8d8" stroke-width="1.2"/>
    <ellipse cx="36" cy="22" rx="13" ry="4" fill="#fffef6"/>
    <ellipse cx="36" cy="26" rx="11" ry="3" fill="#f5f0e6"/>
    <path d="M28 30 Q36 34 44 30" stroke="#e8e0d0" stroke-width="2" fill="none" opacity="0.7"/>
    <rect x="24" y="36" width="24" height="9" rx="2" fill="#68b8d8" opacity="0.55"/>
    <rect x="26" y="38" width="10" height="2" rx="1" fill="#fff" opacity="0.45"/>
  `,
  bodyOil: () => `
    <rect x="32" y="11" width="8" height="11" rx="2.5" fill="#ece4dc"/>
    <rect x="30" y="9" width="12" height="4" rx="2" fill="#d8d0c8"/>
    <path d="M34 22 L34 24 L38 24 L38 22 Q36 19 34 22 Z" fill="#c8c0b8"/>
    <rect x="25" y="24" width="22" height="28" rx="6" fill="#faf0d8" stroke="#e8d8a8" stroke-width="1"/>
    <rect x="28" y="28" width="16" height="20" rx="4" fill="#e8b838"/>
    <ellipse cx="36" cy="36" rx="5" ry="8" fill="#fff" opacity="0.22"/>
    <path d="M49 28 C53 34 53 38 49 44 C45 38 45 34 49 28 Z" fill="#f5c830" stroke="#e8a820" stroke-width="0.8"/>
    <ellipse cx="49" cy="30" rx="2" ry="2.5" fill="#fff" opacity="0.35"/>
  `,
};

/**
 * @param {SkuThumbInput} sku
 * @param {number} [size]
 */
export function buildSkuThumbSvg(sku, size = 72) {
  const visual = resolveVisual(sku);
  const id = String(sku.id || "sku").replace(/[^a-z0-9_-]/gi, "");
  const gradId = `g-${id}`;
  const shineId = `s-${id}`;
  const caption = visual.caption.replace(/[<>&"']/g, "");
  const emoji = visual.emoji;
  const customKey = /** @type {{ custom?: string }} */ (visual).custom;
  const customArt = customKey && CUSTOM_THUMB_ART[customKey] ? CUSTOM_THUMB_ART[customKey]() : "";
  const iconLayer = customArt
    ? `<g>${customArt}</g>`
    : `<text x="36" y="40" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" font-size="30">${emoji}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 72 72" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${visual.bg1}"/>
        <stop offset="100%" stop-color="${visual.bg2}"/>
      </linearGradient>
      <radialGradient id="${shineId}" cx="35%" cy="18%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="72" height="72" rx="12" fill="url(#${gradId})"/>
    <rect width="72" height="72" rx="12" fill="url(#${shineId})"/>
    <rect x="0" y="50" width="72" height="22" rx="0" fill="#000000" opacity="0.38"/>
    ${iconLayer}
    <text x="36" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" font-weight="700" fill="#ffffff">${caption}</text>
  </svg>`;
}

/**
 * @param {SkuThumbInput} sku
 * @param {number} [size]
 */
export function getSkuThumbDataUrl(sku, size = 72) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSkuThumbSvg(sku, size))}`;
}

/**
 * @param {number} level
 */
export function qualityRingColor(level) {
  if (level >= 6) return "#c9b8ff";
  if (level >= 5) return "#8fd694";
  if (level >= 4) return "#7a4cff";
  if (level >= 3) return "#6eb5ff";
  if (level >= 2) return "#ffcc66";
  return "#a9acb7";
}

/**
 * @param {SkuThumbInput} sku
 * @param {{ size?: number; qualityLevel?: number; className?: string }} [opts]
 */
export function renderSkuThumbHtml(sku, opts = {}) {
  const size = opts.size ?? 56;
  const level = Math.max(1, Math.min(6, Math.round(Number(opts.qualityLevel) || 1)));
  const ring = qualityRingColor(level);
  const url = getSkuThumbDataUrl(sku, 72);
  const cls = ["sku-thumb-wrap", opts.className].filter(Boolean).join(" ");
  const alt = String(sku.name || sku.id).replace(/"/g, "&quot;");
  return `<div class="${cls}" data-sku-id="${sku.id}" style="--sku-thumb-ring:${ring}" title="${alt}">
    <img class="sku-thumb" src="${url}" width="${size}" height="${size}" alt="${alt}" loading="lazy" decoding="async"/>
  </div>`;
}
