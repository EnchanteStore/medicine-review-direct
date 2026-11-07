import { Alert, Card, Container } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PriceTag } from '@/components/price-tag';
import { getActiveProducts } from '@/lib/products';

export const metadata: Metadata = { title: 'Pricing' };
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const result = await getActiveProducts();

  return (
    <>
      <PageHeader
        title="Pricing"
        lead="One clear price, with no subscription. You will see the final price before you pay."
      />
      <Container className="py-10">
        {!result.ok ? (
          <Alert tone="warning" title="Prices are unavailable right now">
            <p>We could not load our current prices. Please try again in a few minutes.</p>
          </Alert>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {result.products.map((product) => (
              <Card key={product.code} className="space-y-4">
                <h2 className="text-2xl">{product.name}</h2>
                <PriceTag product={product} />
                <p className="text-ink-700">{product.description}</p>
                <h3 className="text-lg">Included</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Review of your questionnaire and any documents you share</li>
                  <li>One telephone consultation with a UK-registered pharmacist</li>
                  <li>A written report you can read and download in your account</li>
                  <li>An optional letter for your GP, if you agree</li>
                </ul>
                <Alert tone="info">
                  <p>
                    Online booking is not open yet. We will open bookings once the service has
                    launched.
                  </p>
                </Alert>
              </Card>
            ))}
            <div className="space-y-4">
              <h2 className="text-2xl">Good to know</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Prices are in pounds sterling (GBP).</li>
                <li>You only pay after you have completed the safety questions.</li>
                <li>
                  You can read about cancelling and refunds in our{' '}
                  <Link href="/refunds">refund and cancellation policy</Link>.
                </li>
                <li>We do not prescribe, so there are no medicine costs.</li>
              </ul>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
