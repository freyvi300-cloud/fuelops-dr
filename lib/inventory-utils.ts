// Shared inventory balance computation.
// Used by both inventory.ts and supplies.ts server actions.

export type BalanceRow = { type: string; gallons: { toNumber(): number } }

/**
 * Computes current inventory balance from a list of movements.
 *   IN         → adds gallons
 *   OUT        → subtracts gallons (stored as positive, sign applied here)
 *   ADJUSTMENT → adds gallons (can be negative for downward corrections)
 */
export function computeInventoryBalance(rows: BalanceRow[]): number {
  return rows.reduce((sum, m) => {
    const g = m.gallons.toNumber()
    if (m.type === "IN")         return sum + g
    if (m.type === "OUT")        return sum - g
    if (m.type === "ADJUSTMENT") return sum + g
    return sum
  }, 0)
}
