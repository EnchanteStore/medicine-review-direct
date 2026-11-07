import { Button } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <ContentPage
      title="How it works"
      lead="A medication review takes place in a few simple steps. You can stop at any point before you pay."
    >
      <ol>
        <li>
          <strong>Create your account.</strong> You will need an email address. We will send you a
          link to confirm it.
        </li>
        <li>
          <strong>Answer questions about your health and medicines.</strong> You can save your
          answers and come back later. If you are not sure about something, you can say so.
        </li>
        <li>
          <strong>Safety check.</strong> We ask a few questions to make sure this service is right
          for you. If you need urgent help, we will tell you where to get it.
        </li>
        <li>
          <strong>Pay and book.</strong> Choose a time for your consultation. All times are UK time.
        </li>
        <li>
          <strong>Your pharmacist prepares.</strong> They read your answers and any documents you
          have shared before they call you.
        </li>
        <li>
          <strong>Consultation.</strong> Your pharmacist speaks to you by telephone or secure video
          about your medicines and answer your questions.
        </li>
        <li>
          <strong>Your written report.</strong> Your pharmacist writes and checks your report. We
          will email you when it is ready to read in your account. The email will not include any
          health information.
        </li>
        <li>
          <strong>Optional GP letter.</strong> If you agree, your pharmacist can prepare a letter
          for your GP.
        </li>
      </ol>

      <h2>Who this service is for</h2>
      <ul>
        <li>Adults aged 18 or over who live in England</li>
        <li>People who take regular medicines and would like an independent review</li>
      </ul>

      <p className="mt-8">
        <Button asChild size="lg">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </p>
    </ContentPage>
  );
}
