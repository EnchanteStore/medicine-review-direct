import type { Metadata } from 'next';
import { DraftNotice } from '@/components/draft-notice';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Refunds and cancellations (draft)' };

export default function RefundsPage() {
  return (
    <ContentPage title="Refunds and cancellations">
      <DraftNotice />
      <h2>Cancelling before your consultation</h2>
      <p>
        You will be able to ask to cancel from your account. The notice period and how much is
        refunded will be confirmed before launch.
      </p>
      <h2>Rescheduling</h2>
      <p>You will be able to ask to move your appointment. Rescheduling rules are to be confirmed.</p>
      <h2>If we cannot provide the service</h2>
      <p>
        If our pharmacist decides the service is not suitable for you, for example because you
        need urgent care, we will explain why and arrange a refund.
      </p>
      <h2>How refunds are paid</h2>
      <p>Refunds are paid back to the card you used. Timescales depend on your card provider.</p>
    </ContentPage>
  );
}
