/**
 * Auto-reprice: мягко подтягивает цены к recommendedPrice (±8%).
 * @param {object} state
 */
export function runAutoReprice(state) {
  if (!state?.skus) return;
  for (const sku of state.skus) {
    const id = sku.id;
    const rec = Math.max(1, Number(sku.recommendedPrice) || 1);
    const current = Math.max(1, Number(state.skuPrices?.[id]) || rec);
    const low = rec * 0.92;
    const high = rec * 1.08;
    if (current < low) state.skuPrices[id] = Math.round(low);
    else if (current > high) state.skuPrices[id] = Math.round(high);
  }
}

/**
 * Auto-reorder: докупает до целевого запаса ~2.2× baseDemand при достаточном кэше.
 * @param {object} state
 * @returns {{ orders: number; spent: number }}
 */
export function runAutoReorder(state) {
  if (!state?.skus) return { orders: 0, spent: 0 };
  let orders = 0;
  let spent = 0;
  let cash = Math.max(0, Number(state.cash) || 0);
  const budgetCap = cash * 0.35;

  const sorted = [...state.skus].sort((a, b) => (Number(b.baseDemand) || 0) - (Number(a.baseDemand) || 0));
  for (const sku of sorted) {
    const id = sku.id;
    const stock = Number(state.inStock?.[id]) || 0;
    const demand = Number(sku.baseDemand) || 0;
    const target = Math.max(80, Math.round(demand * 2.2));
    const need = Math.max(0, target - stock);
    if (!need) continue;
    const unitCost = Math.max(1, Number(sku.purchaseCost) || 1);
    const affordable = Math.floor((budgetCap - spent) / unitCost);
    if (affordable <= 0) break;
    const qty = Math.min(need, affordable, 120);
    if (!qty) continue;

    const lead = Math.max(0, Math.round(Number(sku.leadTimeDays) || 0));
    const extra =
      Number(state.eventModifiers?.purchaseLeadTimeExtraByCategory?.[String(sku.categoryId || "beauty")]) || 0;
    state.incomingShipments = state.incomingShipments || [];
    state.incomingShipments.push({
      id: `auto_${Date.now()}_${id}_${Math.random().toString(36).slice(2, 6)}`,
      skuId: String(id),
      qty,
      orderDay: state.day,
      arrivalDay: (Number(state.day) || 0) + lead + extra,
      auto: true,
    });
    const cost = qty * unitCost;
    spent += cost;
    orders += 1;
  }

  state.cash = Math.max(0, cash - spent);
  return { orders, spent };
}
