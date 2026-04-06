/**
 * Конверсия трафика в заказы с потолком по складу (M1 / день 5 roadmap).
 *
 * @param {{ traffic: number; conversion: number; inStock: number }} p
 * @returns {{
 *   ordersRaw: number;
 *   ordersWanted: number;
 *   orders: number;
 *   unmetUnits: number;
 * }}
 */
export function computeCappedOrders(p) {
  const traffic = Math.max(0, Number(p.traffic) || 0);
  const conversion = Math.min(1, Math.max(0, Number(p.conversion) || 0));
  const inStock = Math.max(0, Math.floor(Number(p.inStock) || 0));

  const ordersRaw = traffic * conversion;
  const ordersWanted = Math.floor(ordersRaw);
  const orders = Math.min(ordersWanted, inStock);
  const unmetUnits = Math.max(0, ordersWanted - orders);

  return { ordersRaw, ordersWanted, orders, unmetUnits };
}
