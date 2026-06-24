/** @typedef {{ id: string; category: string; name: string; desc: string; price: number; tier: number; visual: string; accent?: string; image?: string; maxSpeedKmh?: number; maxSpeedKnots?: number; area?: string }} LuxuryItemDef */

export const LUXURY_RESALE_RATE = 0.65;

export const LUXURY_CATEGORIES = [
  { id: "auto", label: "Авто" },
  { id: "realty", label: "Недвижимость" },
  { id: "aviation", label: "Авиация" },
  { id: "yacht", label: "Яхты" },
  { id: "art", label: "Искусство" },
  { id: "watches", label: "Часы" },
  { id: "islands", label: "Острова" },
  { id: "owned", label: "Моя коллекция" },
];

const STATUS_LEVELS = [
  { minSpend: 0, title: "Предприниматель", tagline: "Всё в бизнес — пока." },
  { minSpend: 500_000, title: "Комфорт", tagline: "Первые личные покупки." },
  { minSpend: 2_000_000, title: "Премиум", tagline: "Жизнь за пределами Excel." },
  { minSpend: 10_000_000, title: "Элита", tagline: "Окружение начинает замечать." },
  { minSpend: 50_000_000, title: "Магнат", tagline: "Капитал говорит сам за себя." },
  { minSpend: 200_000_000, title: "Легенда", tagline: "Ваш статус — часть истории." },
  { minSpend: 500_000_000, title: "Титан", tagline: "Деньги уже не считаются — их взвешивают." },
  { minSpend: 1_000_000_000, title: "Олигарх", tagline: "География подстраивается под вас." },
  { minSpend: 5_000_000_000, title: "Властитель", tagline: "Собственная точка на карте мира." },
];

/**
 * @param {unknown} raw
 * @returns {LuxuryItemDef[]}
 */
export function normalizeLuxuryCatalog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && x.id)
    .map((x) => ({
      id: String(x.id),
      category: String(x.category || "auto"),
      name: String(x.name || x.id),
      desc: String(x.desc || ""),
      price: Math.max(1, Math.round(Number(x.price) || 1)),
      tier: Math.max(1, Math.min(6, Math.round(Number(x.tier) || 1))),
      visual: String(x.visual || x.category || "auto"),
      accent: String(x.accent || "#7a4cff"),
      ...(x.image ? { image: String(x.image) } : {}),
      ...(Number(x.maxSpeedKmh) > 0 ? { maxSpeedKmh: Math.round(Number(x.maxSpeedKmh)) } : {}),
      ...(Number(x.maxSpeedKnots) > 0 ? { maxSpeedKnots: Math.round(Number(x.maxSpeedKnots)) } : {}),
      ...(x.area ? { area: String(x.area) } : {}),
    }));
}

/**
 * @returns {{ owned: Record<string, { day: number; price: number }>; spendTotal: number; selectedCategory: string }}
 */
export function createEmptyLuxuryState() {
  return { owned: {}, spendTotal: 0, selectedCategory: "auto" };
}

/**
 * @param {unknown} raw
 * @returns {{ owned: Record<string, { day: number; price: number }>; spendTotal: number; selectedCategory: string }}
 */
export function normalizeLuxuryState(raw) {
  const base = createEmptyLuxuryState();
  if (!raw || typeof raw !== "object") return base;

  const owned = {};
  if (raw.owned && typeof raw.owned === "object" && !Array.isArray(raw.owned)) {
    for (const [id, v] of Object.entries(raw.owned)) {
      if (v && typeof v === "object") {
        owned[String(id)] = {
          day: Math.max(1, Math.round(Number(v.day) || 1)),
          price: Math.max(0, Math.round(Number(v.price) || 0)),
        };
      } else if (v === true) {
        owned[String(id)] = { day: 1, price: 0 };
      }
    }
  } else if (Array.isArray(raw.ownedIds)) {
    for (const id of raw.ownedIds) {
      owned[String(id)] = { day: 1, price: 0 };
    }
  }

  const spendFromOwned = Object.values(owned).reduce((s, o) => s + (Number(o.price) || 0), 0);
  const spendTotal = Math.max(
    spendFromOwned,
    Math.max(0, Math.round(Number(raw.spendTotal) || 0))
  );

  const cat = String(raw.selectedCategory || "auto");
  const validCat = LUXURY_CATEGORIES.some((c) => c.id === cat) ? cat : "auto";

  return { owned, spendTotal, selectedCategory: validCat };
}

/**
 * @param {object} state
 */
export function isLuxuryShopUnlocked(state) {
  if (!state) return false;
  if (!state.lastDayReport) return false;
  return (Number(state.day) || 1) >= 3;
}

/**
 * @param {number} spendTotal
 */
export function getLuxuryStatus(spendTotal) {
  const spend = Math.max(0, Number(spendTotal) || 0);
  let level = STATUS_LEVELS[0];
  for (const row of STATUS_LEVELS) {
    if (spend >= row.minSpend) level = row;
  }
  const idx = STATUS_LEVELS.indexOf(level);
  const next = STATUS_LEVELS[idx + 1] || null;
  return {
    title: level.title,
    tagline: level.tagline,
    spendTotal: spend,
    nextTitle: next?.title || null,
    nextAt: next?.minSpend || null,
    progressPct: next ? Math.min(100, ((spend - level.minSpend) / (next.minSpend - level.minSpend)) * 100) : 100,
  };
}

/**
 * @param {object} state
 * @param {LuxuryItemDef[]} catalog
 */
export function getLuxuryPortfolioSummary(state, catalog) {
  const luxury = normalizeLuxuryState(state?.luxury);
  const ownedIds = Object.keys(luxury.owned);
  const byId = new Map(catalog.map((x) => [x.id, x]));
  let collectionValue = 0;
  const ownedItems = [];

  for (const id of ownedIds) {
    const meta = luxury.owned[id];
    const def = byId.get(id);
    const price = meta?.price > 0 ? meta.price : def?.price || 0;
    collectionValue += price;
    if (def) ownedItems.push({ ...def, purchaseDay: meta?.day || 1, paidPrice: price });
  }

  ownedItems.sort((a, b) => b.paidPrice - a.paidPrice);

  return {
    ownedCount: ownedIds.length,
    collectionValue,
    spendTotal: luxury.spendTotal,
    status: getLuxuryStatus(luxury.spendTotal),
    ownedItems,
  };
}

/**
 * @param {object} state
 * @param {LuxuryItemDef[]} catalog
 * @param {string} itemId
 */
export function buyLuxuryItem(state, catalog, itemId) {
  if (!state) return { ok: false, error: "no_state" };
  if (!isLuxuryShopUnlocked(state)) return { ok: false, error: "locked" };

  const item = catalog.find((x) => x.id === itemId);
  if (!item) return { ok: false, error: "unknown_item" };

  state.luxury = normalizeLuxuryState(state.luxury);
  if (state.luxury.owned[itemId]) return { ok: false, error: "already_owned" };

  const cash = Math.max(0, Number(state.cash) || 0);
  if (cash < item.price) return { ok: false, error: "insufficient_cash", need: item.price, have: cash };

  state.cash = cash - item.price;
  state.luxury.owned[itemId] = { day: Math.max(1, Math.round(Number(state.day) || 1)), price: item.price };
  state.luxury.spendTotal = Math.max(0, Number(state.luxury.spendTotal) || 0) + item.price;

  return { ok: true, item, status: getLuxuryStatus(state.luxury.spendTotal) };
}

/**
 * @param {number} paidPrice
 */
export function getLuxuryResalePrice(paidPrice) {
  return Math.max(1, Math.round(Math.max(0, Number(paidPrice) || 0) * LUXURY_RESALE_RATE));
}

/**
 * @param {object} state
 * @param {LuxuryItemDef[]} catalog
 * @param {string} itemId
 */
export function sellLuxuryItem(state, catalog, itemId) {
  if (!state) return { ok: false, error: "no_state" };

  const item = catalog.find((x) => x.id === itemId);
  if (!item) return { ok: false, error: "unknown_item" };

  state.luxury = normalizeLuxuryState(state.luxury);
  const meta = state.luxury.owned[itemId];
  if (!meta) return { ok: false, error: "not_owned" };

  const paid = meta.price > 0 ? meta.price : item.price;
  const resale = getLuxuryResalePrice(paid);

  delete state.luxury.owned[itemId];
  state.luxury.spendTotal = Math.max(0, Number(state.luxury.spendTotal) || 0) - paid;
  state.cash = Math.max(0, Number(state.cash) || 0) + resale;

  return { ok: true, item, paid, resale, status: getLuxuryStatus(state.luxury.spendTotal) };
}

/**
 * @param {object} state
 * @param {string} itemId
 */
export function ownsLuxuryItem(state, itemId) {
  const luxury = normalizeLuxuryState(state?.luxury);
  return !!luxury.owned[String(itemId)];
}

/**
 * @param {object} state
 */
export function getLuxurySpendTotal(state) {
  return normalizeLuxuryState(state?.luxury).spendTotal;
}

/**
 * @param {object} state
 */
export function countLuxuryOwned(state) {
  return Object.keys(normalizeLuxuryState(state?.luxury).owned).length;
}

/** @type {string[]} */
export const LUXURY_ISLAND_ITEM_IDS = [
  "island_rocky",
  "island_tropical",
  "island_archipelago",
  "island_atoll",
  "island_sovereign",
];

/**
 * @param {object} state
 */
export function ownsAnyLuxuryIsland(state) {
  return LUXURY_ISLAND_ITEM_IDS.some((id) => ownsLuxuryItem(state, id));
}

/**
 * Краткая характеристика для карточки витрины.
 * @param {LuxuryItemDef} item
 * @returns {string | null}
 */
export function getLuxuryItemHighlight(item) {
  if (Number(item.maxSpeedKmh) > 0) {
    return `до ${item.maxSpeedKmh.toLocaleString("ru-RU")} км/ч`;
  }
  if (Number(item.maxSpeedKnots) > 0) {
    return `до ${item.maxSpeedKnots.toLocaleString("ru-RU")} узлов`;
  }
  if (item.area) return item.area;
  return null;
}

/**
 * @param {LuxuryItemDef} item
 * @returns {{ label: string; value: string }[]}
 */
export function getLuxuryItemSpecs(item) {
  const t = Math.max(1, Math.min(6, Number(item.tier) || 1));
  const tierStars = "★".repeat(t) + "☆".repeat(6 - t);
  const catLabels = {
    auto: "Автомобиль",
    realty: "Недвижимость",
    aviation: "Авиация",
    yacht: "Яхта",
    art: "Искусство",
    watches: "Часы",
    islands: "Остров",
  };
  const specs = [
    { label: "Категория", value: catLabels[item.category] || item.category },
    { label: "Класс", value: `${tierStars} (${t}/6)` },
  ];

  switch (item.category) {
    case "auto":
      if (Number(item.maxSpeedKmh) > 0) {
        specs.push({ label: "Макс. скорость", value: `до ${item.maxSpeedKmh.toLocaleString("ru-RU")} км/ч` });
      }
      specs.push(
        { label: "Комфорт", value: ["Базовый", "Эконом", "Бизнес", "Премиум", "Спорт", "Суперкар"][t - 1] },
        { label: "Статус", value: ["Старт", "Городской", "Деловой", "Представительский", "Коллекционный", "Легенда"][t - 1] }
      );
      break;
    case "realty":
      specs.push(
        { label: "Площадь", value: ["12 м²", "28 м²", "54 м²", "120 м²", "280 м²", "450 м²"][t - 1] },
        { label: "Локация", value: ["Общежитие", "Спальный район", "У метро", "Подмосковье", "Центр города", "Побережье"][t - 1] }
      );
      break;
    case "aviation":
      if (Number(item.maxSpeedKmh) > 0) {
        specs.push({ label: "Макс. скорость", value: `до ${item.maxSpeedKmh.toLocaleString("ru-RU")} км/ч` });
      }
      specs.push(
        { label: "Дальность", value: ["800 км", "2 500 км", "12 000 км", "11 500 км"][t - 1] },
        { label: "Пассажиры", value: ["2", "8", "19", "19"][t - 1] }
      );
      break;
    case "yacht":
      if (Number(item.maxSpeedKnots) > 0) {
        specs.push({ label: "Макс. скорость", value: `до ${item.maxSpeedKnots.toLocaleString("ru-RU")} узлов` });
      }
      specs.push(
        { label: "Длина", value: ["8 м", "25 м", "80 м"][t - 1] },
        { label: "Экипаж", value: ["Без экипажа", "3 чел.", "30 чел."][t - 1] }
      );
      break;
    case "art":
      specs.push(
        { label: "Редкость", value: ["Массовая", "Ограниченная", "Коллекционная", "Галерейная", "Музейная"][t - 1] },
        { label: "Инвестиции", value: ["Декор", "Растущие", "Стабильные", "Премиальные", "Аукционные"][t - 1] }
      );
      break;
    case "watches":
      specs.push(
        { label: "Механизм", value: ["Электроника", "Механика", "Автоподзавод", "Компликации", "Ювелирные"][t - 1] },
        { label: "Престиж", value: ["Повседневные", "Классика", "Икона", "Наследие", "Уникальные"][t - 1] }
      );
      break;
    case "islands": {
      const area =
        item.area ||
        ["0,5 га", "2 га", "12 га", "45 га", "120 га"][t - 1];
      specs.push(
        { label: "Площадь", value: area },
        { label: "Инфраструктура", value: ["Скалы", "Бунгало", "Доки", "ВПП + марина", "Резиденция + флаг"][t - 1] }
      );
      break;
    }
    default:
      break;
  }

  return specs;
}

/**
 * @param {string} error
 * @param {{ need?: number; have?: number }} [detail]
 */
export function luxuryBuyErrorMessage(error, detail = {}) {
  const map = {
    no_state: "Игра не инициализирована.",
    locked: "Имущество откроется после 3-го дня симуляции.",
    unknown_item: "Позиция не найдена.",
    already_owned: "У вас уже есть этот актив.",
    insufficient_cash: `Недостаточно средств. Нужно ${Math.round(detail.need || 0).toLocaleString("ru-RU")} ₽, на счёте ${Math.round(detail.have || 0).toLocaleString("ru-RU")} ₽.`,
  };
  return map[String(error)] || "Покупка не выполнена.";
}

/**
 * @param {string} error
 */
export function luxurySellErrorMessage(error) {
  const map = {
    no_state: "Игра не инициализирована.",
    unknown_item: "Позиция не найдена.",
    not_owned: "Этого актива нет в коллекции.",
  };
  return map[String(error)] || "Продажа не выполнена.";
}
