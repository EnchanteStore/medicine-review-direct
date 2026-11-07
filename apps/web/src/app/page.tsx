import { formatGBP } from '@mrd/domain';
import { Button, Card, Container } from '@mrd/ui';
import Link from 'next/link';
import { getActiveProducts } from '@/lib/products';

const steps = [
  {
    title: 'Tell us about your medicines',
    body: 'Create a secure account and complete a short online questionnaire about the medicines you take and any concerns you have.',
  },
  {
    title: 'Speak to a pharmacist',
    body: 'A UK-registered pharmacist reviews your information, then calls you at a time you book for an unhurried telephone consultation.',
  },
  {
    title: 'Get a written report',
    body: 'Your pharmacist writes up their findings and suggestions in a clear report you can read in your account and share with your GP.',
  },
];

export default async function HomePage() {
  const result = await getActiveProducts();
  const main = result.ok ? result.products[0] : undefined;

  return (
    <>
      <section className="bg-teal-50">
        <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
              A private review of your medicines with a UK pharmacist
            </h1>
            <p className="mt-6 max-w-xl text-xl text-ink-700">
              Taking several medicines and unsure if they are all still right for you? Talk it
              through with an experienced pharmacist by telephone and get a clear written report.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
          <Card className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
              One review, one clear price
            </p>
            {main ? (
              <p className="font-serif text-4xl font-bold text-teal-900">
                {formatGBP(main.pricePence)}
                {main.standardPricePence && main.standardPricePence > main.pricePence ? (
                  <span className="ml-3 align-middle font-sans text-base font-normal text-ink-700">
                    launch price, normally <s>{formatGBP(main.standardPricePence)}</s>
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-ink-700">See our pricing page for current prices.</p>
            )}
            <ul className="list-disc space-y-1 pl-5 text-ink-700">
              <li>Telephone consultation with a pharmacist</li>
              <li>Personalised written report</li>
              <li>Optional letter for your GP</li>
            </ul>
          </Card>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="font-serif text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <p
                  className="flex size-10 items-center justify-center rounded-full bg-teal-700 text-lg font-bold text-white"
                  aria-hidden="true"
                >
                  {i + 1}
                </p>
                <h3 className="mt-4 text-xl">{step.title}</h3>
                <p className="mt-2 text-ink-700">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Container>

      <section className="border-y border-sand-200 bg-white">
        <Container className="grid gap-10 py-14 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl">What a review can help with</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-700">
              <li>Understanding what each of your medicines is for</li>
              <li>Spotting possible side effects or interactions to discuss with your GP</li>
              <li>Questions about how and when to take your medicines</li>
              <li>Preparing for a conversation with your GP or prescriber</li>
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-2xl">What we do not do</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-700">
              <li>We do not diagnose conditions or prescribe medicines</li>
              <li>We will never tell you to stop or change a medicine on your own</li>
              <li>We do not replace your GP or provide emergency care</li>
            </ul>
            <p className="mt-4">
              <Link href="/clinical-safety">Read about clinical safety</Link>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
