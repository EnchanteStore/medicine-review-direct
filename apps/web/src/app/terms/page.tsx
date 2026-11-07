import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CompanyIdentity,
  LegalNotice,
  PharmacistRegistration,
  Placeholder,
} from '@/components/legal';
import { ContentPage } from '@/components/page-header';
import { brandName } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of Service (placeholder)' };

export default function TermsPage() {
  const brand = brandName();
  return (
    <ContentPage title="Terms of Service">
      <LegalNotice />
      <h2>Who we are</h2>
      <CompanyIdentity />

      <h2>The service</h2>
      <p>
        {brand} provides private pharmacist-led medication reviews for adults aged 18 or over in
        England. A review includes a structured questionnaire, optional secure document upload, a
        consultation with a GPhC-registered pharmacist by telephone or secure video, and a
        personalised report prepared, checked and signed by that pharmacist.
      </p>
      <h2>What the service does not do</h2>
      <p>
        We do not provide emergency or same-day urgent care, diagnose conditions, prescribe, supply
        or change medicines, replace your GP, or access NHS records. We are not affiliated with the
        NHS. See <Link href="/clinical-safety">Clinical Service and Safety Information</Link>.
      </p>
      <h2>Suitability</h2>
      <p>
        A pharmacist may decide the service is not suitable for you, for example if you need urgent
        care or your situation needs a different kind of assessment. If so, we will tell you why and
        where to get help. A declined service does not produce a review report.
      </p>
      <h2>Pharmacist registration</h2>
      <PharmacistRegistration />
      <h2>Price and payment</h2>
      <p>
        Prices are in pounds sterling. We do not add VAT; VAT treatment is awaiting accountant
        confirmation. <Placeholder>payment terms, needs legal review</Placeholder>
      </p>
      <h2>Cancellation</h2>
      <p>
        See our <Link href="/refunds">Cancellation and Refund Policy</Link>.
      </p>
      <h2>Liability, governing law and disputes</h2>
      <p>
        <Placeholder>liability, governing law and dispute terms, needs legal review</Placeholder>
      </p>
    </ContentPage>
  );
}
