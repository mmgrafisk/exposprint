import { customerUnitPrice, convertDkkMinor, deliveryEstimate } from "./pricing";
import type { QuoteLineInput, StoreBootstrap, StoreQuote } from "./types";

export function buildQuote(bootstrap: StoreBootstrap, inputs: QuoteLineInput[]): StoreQuote {
  const zone = bootstrap.shippingZones.find((item) => item.code === bootstrap.market.shippingZone);
  if (!zone) throw new Error("SHIPPING_ZONE_UNAVAILABLE");
  const lines = inputs.map((input) => {
    const product = bootstrap.products.find((item) => item.id === input.productId && item.status === "published");
    const hasCustomerPrice = product?.customerPriceMinor != null;
    if (!product || (!hasCustomerPrice && product.supplierCostMinor == null) || product.productionDaysMin == null) {
      throw new Error("PRODUCT_UNAVAILABLE");
    }
    const quantity = Math.max(1, Math.min(100, Math.trunc(input.quantity)));
    for (const option of product.options.filter((item) => item.required)) {
      const selected = input.configuration?.[option.code];
      if (selected == null || selected === "" || (Array.isArray(selected) && selected.length === 0)) throw new Error("CONFIGURATION_REQUIRED");
      const values = Array.isArray(selected) ? selected : [selected];
      if (option.values.length && values.some((value) => !option.values.includes(value))) throw new Error("CONFIGURATION_INVALID");
    }
    const unit = customerUnitPrice(product, bootstrap.market, bootstrap.currency, bootstrap.settings.grossMarginPercent);
    return {
      productId: product.id, sku: product.sku, title: product.title, quantity, unitPrice: unit.gross,
      lineTotal: { amountMinor: unit.gross.amountMinor * quantity, currency: bootstrap.currency.code },
      taxMinor: unit.taxMinor * quantity, configuration: input.configuration ?? {}, delivery: deliveryEstimate(product, zone),
    };
  });
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0);
  const shippingMinor = convertDkkMinor(zone.priceMinorDkk, bootstrap.currency);
  const taxMinor = lines.reduce((sum, line) => sum + line.taxMinor, 0);
  const maxProductionMin = Math.max(...lines.map((line) => line.delivery.productionDaysMin), 0);
  const maxProductionMax = Math.max(...lines.map((line) => line.delivery.productionDaysMax), 0);
  const now = Date.now();
  const legalVersions = Object.fromEntries(bootstrap.legalDocuments
    .filter((item) => item.locale === bootstrap.locale.code && item.status === "published" && (!item.effectiveAt || new Date(item.effectiveAt).getTime() <= now))
    .sort((a, b) => b.version - a.version)
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.documentType === item.documentType) === index)
    .map((item) => [item.documentType, item.version]));
  return {
    locale: bootstrap.locale.code, market: bootstrap.market.countryCode, currency: bootstrap.currency.code, lines,
    subtotal: { amountMinor: subtotalMinor, currency: bootstrap.currency.code },
    shipping: {
      zoneCode: zone.code, amount: { amountMinor: shippingMinor, currency: bootstrap.currency.code }, isFree: shippingMinor === 0,
      delivery: {
        productionDaysMin: maxProductionMin, productionDaysMax: maxProductionMax,
        transitDaysMin: zone.transitDaysMin, transitDaysMax: zone.transitDaysMax,
        totalDaysMin: maxProductionMin + zone.transitDaysMin, totalDaysMax: maxProductionMax + zone.transitDaysMax,
      },
    },
    taxMinor, total: { amountMinor: subtotalMinor + shippingMinor, currency: bootstrap.currency.code }, legalVersions,
  };
}
