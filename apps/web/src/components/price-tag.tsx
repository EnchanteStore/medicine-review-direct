import { formatGBP, isDiscounted, type ServiceProduct } from '@mrd/domain';

export function PriceTag({ product }: { product: ServiceProduct }) {
  const discounted = isDiscounted(product);
  return (
    <p className="flex flex-wrap items-baseline gap-x-3" data-testid={`price-${product.code}`}>
      <span className="font-serif text-5xl font-bold text-teal-900">
        {formatGBP(product.pricePence)}
      </span>
      {discounted ? (
        <span className="text-lg text-ink-700">
          <span className="sr-only">Launch price. Normal price </span>
          <span aria-hidden="true">Launch price, normally </span>
          <s>{formatGBP(product.standardPricePence as number)}</s>
        </span>
      ) : null}
    </p>
  );
}
