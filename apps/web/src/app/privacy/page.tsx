import type { Metadata } from 'next';
import { DraftNotice } from '@/components/draft-notice';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Privacy notice (draft)' };

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy notice"
      lead="How we will collect, use and protect your information."
    >
      <DraftNotice />
      <h2>Who we are</h2>
      <p>
        The data controller&apos;s legal name, address and Information Commissioner&apos;s Office
        registration number will be confirmed here before launch.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account details: email address, name, date of birth and telephone number</li>
        <li>Health information you give us: medicines, conditions, concerns and documents</li>
        <li>Records of your consultation and the report your pharmacist writes</li>
        <li>Payment records (card details are handled by our payment provider, not by us)</li>
      </ul>
      <h2>Why we use it</h2>
      <p>
        To provide your medication review, keep clinical records as required, take payment and keep
        the service secure. The lawful bases, including the condition for processing health data,
        will be confirmed after legal review.
      </p>
      <h2>Who we share it with</h2>
      <p>
        Only service providers who help us run the service (such as hosting and payment providers),
        and your GP if you give separate permission for a specific letter.
      </p>
      <h2>How long we keep it</h2>
      <p>Retention periods for clinical and financial records will be confirmed before launch.</p>
      <h2>Your rights</h2>
      <p>
        You have rights under UK data protection law, including to access, correct and in some cases
        delete your information. Some clinical records must be kept for a minimum period.
      </p>
    </ContentPage>
  );
}
