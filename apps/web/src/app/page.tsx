import {
  BRAND_HERO_SUPPORT,
  BRAND_LONGER,
  BRAND_TAGLINE,
  HOW_IT_WORKS,
  PUBLIC_PHARMACISTS,
  formatGBP,
} from '@mrd/domain';
import { Button, Card, Container } from '@mrd/ui';
import Link from 'next/link';
import { getActiveProducts } from '@/lib/products';

const benefits = [
  'Adults aged 18 or over who live in England',
  'People taking more than one medicine who want to understand what each one is for',
  'Anyone preparing questions for their GP or existing prescriber',
];

const included = [
  'A conversation with your pharmacist by telephone or secure video',
  'A personalised written report, prepared and approved by your pharmacist',
  'Points you can discuss with your existing prescriber',
  'No change to an NHS prescription from this service',
];

const faqs = [
  {
    q: 'Will the pharmacist change my medicines?',
    a: 'No. We do not prescribe, stop or change medicines. Discuss any change with your existing prescriber.',
  },
  {
    q: 'Is this an NHS service?',
    a: 'No. MedsInFocus is a private service and is not connected to or endorsed by the NHS.',
  },
  {
    q: 'What if I feel unwell?',
    a: 'This is not an emergency service. Call 999 in a life-threatening emergency, or contact your GP or NHS 111 for urgent advice.',
  },
];

export default async function HomePage() {
  const result = await getActiveProducts();
  const main = result.ok ? result.products[0] : undefined;

  return (
    <>
      <section className="bg-teal-50">
        <Container className="py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">MedsInFocus</p>
          <h1 className="mt-3 max-w-3xl font-sans text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
            {BRAND_TAGLINE}
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-ink-900">{BRAND_HERO_SUPPORT}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in?next=/account">Book a Medication Review</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/how-it-works">How It Works</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-14">
        <section>
          <h2 className="font-sans text-3xl font-bold">What a review is</h2>
          <p className="mt-4 max-w-3xl text-lg text-ink-900">{BRAND_LONGER}</p>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">Who may benefit</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-lg text-ink-900">
            {benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step}>
                <Card className="h-full">
                  <p className="text-sm font-semibold text-teal-800">Step {index + 1}</p>
                  <p className="mt-2 text-lg text-ink-900">{step}</p>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-ink-900">
            This does not change an NHS prescription. Any change to a medicine is for your existing
            prescriber to decide.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">What it includes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-lg text-ink-900">
            {included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">Meet Our Pharmacists</h2>
          <p className="mt-3 max-w-3xl text-ink-900">
            Both pharmacists are shown with the details the owner has recorded. A live GPhC register
            check has not been completed.
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {PUBLIC_PHARMACISTS.map((pharmacist) => (
              <li key={pharmacist.gphc}>
                <Card className="h-full space-y-2" data-testid={`pharmacist-${pharmacist.gphc}`}>
                  <h3 className="text-2xl font-bold">{pharmacist.name}</h3>
                  <p className="font-semibold text-teal-800">{pharmacist.role}</p>
                  <p>GPhC {pharmacist.gphc}</p>
                  <p className="text-ink-900">{pharmacist.detail}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">Pricing</h2>
          {main ? (
            <p className="mt-4 text-lg text-ink-900" data-testid="home-price">
              A medication review is {formatGBP(main.pricePence)}
              {main.standardPricePence && main.standardPricePence > main.pricePence
                ? `, launch price, normally ${formatGBP(main.standardPricePence)}`
                : ''}
              . No VAT is added. Payments are not open to the public.
            </p>
          ) : (
            <p className="mt-4 text-lg">See the pricing page for the current price.</p>
          )}
          <p className="mt-3">
            <Link href="/pricing">View pricing</Link>
          </p>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">FAQ</h2>
          <dl className="mt-4 space-y-4">
            {faqs.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-1 text-ink-900">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            <Link href="/faq">Read more questions</Link>
          </p>
        </section>

        <section>
          <h2 className="font-sans text-3xl font-bold">Clinical safety</h2>
          <p className="mt-4 max-w-3xl text-lg text-ink-900">
            MedsInFocus does not provide urgent or emergency care, does not diagnose, and does not
            tell you to start, stop or change a medicine on your own.
          </p>
          <p className="mt-3">
            <Link href="/clinical-safety">Read the clinical safety information</Link>
          </p>
        </section>
      </Container>
    </>
  );
}
