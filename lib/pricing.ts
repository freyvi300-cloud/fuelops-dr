/**
 * FuelOps-DR — Customer Pricing Resolution
 *
 * Single source of truth for computing a customer's final price per gallon.
 * Used by: supply form (auto-fill), supply server action (final price saved
 * on Supply/Invoice at the moment of the transaction).
 *
 * Two pricing modes per customer:
 *   FIXED        → uses customer.fuelPricePerGallon directly
 *   DISCOUNT_PCT → finalPrice = baseFuelPrice * (1 - customer.priceDiscount / 100)
 *
 * Important: the resolved price is always snapshotted onto the Supply/Invoice
 * at creation time. If baseFuelPrice changes later, past invoices do NOT change —
 * only future supplies are affected.
 */

export type CustomerPriceType = "FIXED" | "DISCOUNT_PCT"

export interface CustomerPricingInput {
  priceType:          CustomerPriceType
  fuelPricePerGallon: number   // used when priceType = FIXED
  priceDiscount:      number   // % used when priceType = DISCOUNT_PCT
}

export function resolveCustomerPrice(
  customer:      CustomerPricingInput,
  baseFuelPrice: number,
): number {
  if (customer.priceType === "DISCOUNT_PCT") {
    const final = baseFuelPrice * (1 - customer.priceDiscount / 100)
    return Math.round(Math.max(0, final) * 10000) / 10000   // 4 decimals, matches Decimal(10,4)
  }
  return customer.fuelPricePerGallon
}
