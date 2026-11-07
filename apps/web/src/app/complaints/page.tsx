import type { Metadata } from 'next';
import { DraftNotice } from '@/components/draft-notice';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Complaints (draft)' };

export default function ComplaintsPage() {
  return (
    <ContentPage title="Complaints">
      <DraftNotice />
      <p>
        We want to hear if something has gone wrong. Complaints help us improve and keep the
        service safe.
      </p>
      <h2>How to complain</h2>
      <p>
        Contact details for complaints will be published before launch. You will also be able
        to raise a complaint from your account.
      </p>
      <h2>What happens next</h2>
      <ol>
        <li>We acknowledge your complaint. Timescales are to be confirmed.</li>
        <li>A senior pharmacist investigates if your complaint is about clinical care.</li>
        <li>We send you a written response explaining what we found and any actions taken.</li>
      </ol>
      <h2>If you are not satisfied</h2>
      <p>
        Details of independent bodies you can contact, such as the General Pharmaceutical
        Council, will be confirmed here after review.
      </p>
    </ContentPage>
  );
}
