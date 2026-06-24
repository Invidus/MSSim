/**
 * @typedef {{ id?: string; skuId: string; qty: number; orderDay: number; arrivalDay: number; totalCost?: number; auto?: boolean }} IncomingShipment
 */

/**
 * @param {IncomingShipment} sh
 */
export function incomingShipmentKey(sh) {
  return `${String(sh.skuId)}@${Math.round(Number(sh.arrivalDay) || 0)}`;
}

/**
 * @param {object} state
 * @param {IncomingShipment} shipment
 * @returns {IncomingShipment}
 */
export function addIncomingShipment(state, shipment) {
  if (!state) return shipment;
  state.incomingShipments = state.incomingShipments || [];

  const skuId = String(shipment.skuId);
  const arrivalDay = Math.round(Number(shipment.arrivalDay) || 0);
  const qty = Math.max(0, Math.round(Number(shipment.qty) || 0));
  const orderDay = Math.round(Number(shipment.orderDay) || 0);
  const addCost = Math.max(0, Number(shipment.totalCost) || 0);

  const existing = state.incomingShipments.find(
    (s) => String(s.skuId) === skuId && Math.round(Number(s.arrivalDay) || 0) === arrivalDay
  );

  if (existing) {
    existing.qty = Math.max(0, Math.round(Number(existing.qty) || 0)) + qty;
    if (addCost > 0) {
      existing.totalCost = Math.max(0, Number(existing.totalCost) || 0) + addCost;
    }
    const prevOrder = Math.round(Number(existing.orderDay) || orderDay);
    existing.orderDay = Math.min(prevOrder, orderDay);
    return existing;
  }

  /** @type {IncomingShipment} */
  const row = {
    id: shipment.id || `sh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    skuId,
    qty,
    orderDay,
    arrivalDay,
  };
  if (addCost > 0) row.totalCost = addCost;
  if (shipment.auto) row.auto = true;
  state.incomingShipments.push(row);
  return row;
}

/**
 * Схлопывает дубликаты (один товар + один день прибытия) — для старых сохранений.
 * @param {object} state
 */
export function consolidateIncomingShipments(state) {
  if (!Array.isArray(state?.incomingShipments) || !state.incomingShipments.length) return;
  /** @type {Map<string, IncomingShipment>} */
  const byKey = new Map();

  for (const sh of state.incomingShipments) {
    const skuId = String(sh.skuId);
    const arrivalDay = Math.round(Number(sh.arrivalDay) || 0);
    const qty = Math.max(0, Math.round(Number(sh.qty) || 0));
    const key = `${skuId}@${arrivalDay}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...sh,
        skuId,
        arrivalDay,
        qty,
        orderDay: Math.round(Number(sh.orderDay) || 0),
        totalCost: Math.max(0, Number(sh.totalCost) || 0) || undefined,
      });
      continue;
    }

    existing.qty = Math.max(0, Math.round(Number(existing.qty) || 0)) + qty;
    const cost = Math.max(0, Number(sh.totalCost) || 0);
    if (cost > 0) {
      existing.totalCost = Math.max(0, Number(existing.totalCost) || 0) + cost;
    }
    existing.orderDay = Math.min(
      Math.round(Number(existing.orderDay) || 0),
      Math.round(Number(sh.orderDay) || 0)
    );
    if (sh.auto) existing.auto = true;
  }

  state.incomingShipments = [...byKey.values()];
}
