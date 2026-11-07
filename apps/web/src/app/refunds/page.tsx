import type { Metadata } from 'next';
import { LegalNotice, Placeholder } from '@/components/legal';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Cancellation and Refund Policy (placeholder)' };

export default function RefundsPage() {
  return (
    <ContentPage title="Cancellation and Refund Policy">
      <LegalNotice />
      <h2>Your cancellation rights</h2>
      <p>
        <Placeholder>
          statutory cancellation rights and how they apply to this service, needs legal review
        </Placeholder>
      </p>
      <h2>Cancelling or moving your consultation</h2>
      <p>
        <Placeholder>
          notice periods, rescheduling rules and any charges, needs owner and legal approval
        </Placeholder>
      </p>
      <h2>If the service is not suitable for you</h2>
      <p>
        If a pharmacist decides the service is not suitable, for example because you need urgent
        care, we will explain why and where to get help.{' '}
        <Placeholder>refund amount in this case, needs owner approval</Placeholder>
      </p>
      <h2>How refunds are paid</h2>
      <p>
        Refunds go back to the card you paid with.{' '}
        <Placeholder>timescales, needs confirmation</Placeholder>
      </p>
    </ContentPage>
  );
}
