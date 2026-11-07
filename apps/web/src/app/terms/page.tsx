import type { Metadata } from 'next';
import { DraftNotice } from '@/components/draft-notice';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Terms of service (draft)' };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of service">
      <DraftNotice />
      <h2>The service</h2>
      <p>
        A private medication review by a UK-registered pharmacist, consisting of a telephone
        consultation and a written report. The service is for adults aged 18 or over living in
        England.
      </p>
      <h2>What the service is not</h2>
      <p>
        The service does not diagnose, prescribe, dispense or provide emergency care, and does not
        replace your GP. You should not stop or change any medicine without speaking to your
        prescriber.
      </p>
      <h2>Your account</h2>
      <p>
        You must give accurate information and keep your sign-in details secure. You can ask to
        close your account at any time, subject to our record-keeping obligations.
      </p>
      <h2>Payment</h2>
      <p>
        Prices are shown in pounds sterling. Payment is taken through our payment provider before
        your consultation is booked.
      </p>
      <h2>Liability, governing law and company details</h2>
      <p>To be completed after legal review.</p>
    </ContentPage>
  );
}
