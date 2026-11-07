import { Alert } from '@mrd/ui';
import type { Metadata } from 'next';
import { DraftNotice } from '@/components/draft-notice';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Clinical safety' };

export default function ClinicalSafetyPage() {
  return (
    <ContentPage
      title="Clinical safety"
      lead="How we keep our service safe, and what it can and cannot do."
    >
      <DraftNotice kind="clinical" />

      <Alert tone="danger" title="This service is not for emergencies" role="note">
        <p>
          We are not monitored for emergencies. If you are seriously unwell, call 999. For
          urgent medical advice, call NHS 111.
        </p>
      </Alert>

      <h2>What we do</h2>
      <ul>
        <li>Review the medicines you tell us about, with your permission</li>
        <li>Talk with you by telephone about how you are getting on with them</li>
        <li>Write a report with findings and suggestions to discuss with your GP or prescriber</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>Diagnose medical conditions</li>
        <li>Prescribe, supply or dispense medicines</li>
        <li>Tell you to stop or change a medicine without involving your prescriber</li>
        <li>Replace your GP, or provide urgent or emergency care</li>
        <li>Access your NHS records</li>
        <li>Use automated or AI systems to make clinical decisions</li>
      </ul>

      <h2>Safety questions</h2>
      <p>
        Before you pay, we ask some safety questions. If your answers suggest you may need
        urgent help, we will show you where to get it and will not take a booking at that time.
        A member of our clinical team is also alerted.
      </p>

      <h2>Your pharmacist is responsible</h2>
      <p>
        Every finding and recommendation in your report is written and checked by a
        UK-registered pharmacist. Your report is only released after the pharmacist has
        approved it.
      </p>
    </ContentPage>
  );
}
