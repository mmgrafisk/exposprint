import type {
  CurrencyDefinition,
  DeliveryEstimate,
  Market,
  Money,
  ShippingZone,
  StoreProduct,
} from "./types";

const clampMargin = (margin: number) => Math.min(95, Math.max(0, margin));

export function netSalePriceDkkMinor(product: StoreProduct, grossMarginPercent: number) {
  if (product.netPriceMinorDkk != null) return product.netPriceMinorDkk;
  if (product.priceOverrideMinor != null) return product.priceOverrideMinor;
  if (product.supplierCostMinor == null) return 0;
  const divisor = 1 - clampMargin(grossMarginPercent) / 100;
  return Math.round(product.supplierCostMinor / divisor);
}

export function convertDkkMinor(amountMinor: number, currency: CurrencyDefinition) {
  const rawMajor = (amountMinor / 100) * currency.rateFromDkk;
  const increment = Math.max(0.01, currency.roundingIncrement || 0.01);
  const roundedMajor = Math.ceil(rawMajor / increment) * increment;
  return Math.round(roundedMajor * 10 ** currency.decimals);
}

export function customerUnitPrice(
  product: StoreProduct,
  market: Market,
  currency: CurrencyDefinition,
  grossMarginPercent: number,
): { gross: Money; taxMinor: number } {
  if (product.netPriceMinorDkk == null && product.customerPriceMinor != null) {
    const grossMinor = product.customerPriceMinor;
    const netMinor = Math.round(grossMinor / (1 + market.vatRate / 100));
    return {
      gross: { amountMinor: grossMinor, currency: currency.code },
      taxMinor: Math.max(0, grossMinor - netMinor),
    };
  }
  const netDkkMinor = netSalePriceDkkMinor(product, grossMarginPercent);
  const grossDkkMinor = Math.round(netDkkMinor * (1 + market.vatRate / 100));
  const netConverted = convertDkkMinor(netDkkMinor, currency);
  const grossConverted = convertDkkMinor(grossDkkMinor, currency);
  return {
    gross: { amountMinor: grossConverted, currency: currency.code },
    taxMinor: Math.max(0, grossConverted - netConverted),
  };
}

export function deliveryEstimate(product: StoreProduct, zone: ShippingZone): DeliveryEstimate {
  const productionMin = product.productionDaysMin ?? 0;
  const productionMax = product.productionDaysMax ?? product.productionDaysMin ?? 0;
  return {
    productionDaysMin: productionMin,
    productionDaysMax: productionMax,
    transitDaysMin: zone.transitDaysMin,
    transitDaysMax: zone.transitDaysMax,
    totalDaysMin: productionMin + zone.transitDaysMin,
    totalDaysMax: productionMax + zone.transitDaysMax,
  };
}

export function formatMoney(money: Money, intlLocale: string, decimals = 2) {
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(money.amountMinor / 10 ** decimals);
}

export function addBusinessDays(start: Date, days: number, closedDates: string[]) {
  const date = new Date(start);
  const closed = new Set(closedDates);
  let remaining = Math.max(0, days);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    const iso = date.toISOString().slice(0, 10);
    if (weekday !== 0 && weekday !== 6 && !closed.has(iso)) remaining -= 1;
  }
  return date;
}
