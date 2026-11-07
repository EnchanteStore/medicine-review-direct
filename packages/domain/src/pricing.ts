export interface ServiceProduct {
  code: string;
  name: string;
  description: string;
  /** Price currently charged, in pence. */
  pricePence: number;
  /** Normal price shown for comparison, in pence. Null when no comparison is shown. */
  standardPricePence: number | null;
  currency: 'GBP';
  isActive: boolean;
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatGBP(pence: number): string {
  if (!Number.isInteger(pence) || pence < 0) {
    throw new RangeError('Price must be a non-negative integer number of pence');
  }
  const pounds = pence / 100;
  return Number.isInteger(pounds)
    ? gbp.format(pounds)
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pounds);
}

export function isDiscounted(
  product: Pick<ServiceProduct, 'pricePence' | 'standardPricePence'>,
): boolean {
  return product.standardPricePence !== null && product.standardPricePence > product.pricePence;
}

export function savingPence(
  product: Pick<ServiceProduct, 'pricePence' | 'standardPricePence'>,
): number {
  return isDiscounted(product) ? (product.standardPricePence as number) - product.pricePence : 0;
}
