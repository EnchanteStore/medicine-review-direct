import { Alert } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <ContentPage title="Contact us">
      <Alert tone="danger" title="If you need medical help now" role="note">
        <p>
          Do not contact us for urgent or emergency help. If you are seriously unwell, call 999.
          For urgent medical advice, call NHS 111.
        </p>
      </Alert>

      <h2>Before launch</h2>
      <p>
        Our contact email address, telephone number, opening hours and registered business
        details will be published here before the service opens.
      </p>

      <h2>Once you have an account</h2>
      <p>
        You will be able to send secure messages about your review from your account. We will
        never ask for health information by ordinary email.
      </p>

      <h2>Complaints</h2>
      <p>
        See our <Link href="/complaints">complaints procedure</Link>.
      </p>
    </ContentPage>
  );
}
