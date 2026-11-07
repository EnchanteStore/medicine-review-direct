import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Frequently asked questions' };

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What is a medication review?',
    a: 'A pharmacist looks at all the medicines you take, talks to you about how you are getting on with them, and suggests anything you may want to discuss with your GP or prescriber.',
  },
  {
    q: 'Will the pharmacist change my medicines?',
    a: 'No. We do not prescribe, stop or change medicines. Please do not stop or change any medicine because of our report without first speaking to your GP or prescriber.',
  },
  {
    q: 'Who can use this service?',
    a: 'Adults aged 18 or over who live in England.',
  },
  {
    q: 'How long is the telephone consultation?',
    a: 'Your pharmacist will take the time needed to go through your medicines and questions. We will confirm the expected length when you book.',
  },
  {
    q: 'Can I share my GP records or repeat prescription list?',
    a: 'Yes. You will be able to upload documents securely, such as a repeat prescription list. This is optional.',
  },
  {
    q: 'Do you share my information with my GP?',
    a: 'Only if you give separate permission for a specific letter, and only to a GP practice you confirm.',
  },
  {
    q: 'What if I feel unwell?',
    a: (
      <>
        This service is not for emergencies and is not monitored for them. If you are seriously
        unwell, call 999. For urgent medical advice, call NHS 111. See{' '}
        <Link href="/clinical-safety">clinical safety</Link>.
      </>
    ),
  },
  {
    q: 'How much does it cost?',
    a: (
      <>
        See our <Link href="/pricing">pricing page</Link> for the current price.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <ContentPage title="Frequently asked questions">
      <div className="space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-md border border-sand-200 bg-white p-4">
            <summary className="cursor-pointer text-lg font-semibold">{f.q}</summary>
            <p className="mt-3 text-ink-700">{f.a}</p>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
