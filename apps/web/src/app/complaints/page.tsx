import type { Metadata } from 'next';
import {
  CompanyIdentity,
  ContactDetails,
  LegalNotice,
  PharmacistRegistration,
  Placeholder,
} from '@/components/legal';
import { FullEmergencyWarning } from '@/components/emergency-banner';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Complaints and Contact Information (placeholder)' };

export default function ComplaintsPage() {
  return (
    <ContentPage title="Complaints and Contact Information">
      <LegalNotice />
      <FullEmergencyWarning className="my-6" />

      <h2 id="contact">Contact us</h2>
      <p>Do not contact us about anything urgent. We do not monitor messages 24 hours a day.</p>
      <ContactDetails />
      <p className="mt-4">
        Once you have an account, use secure messages in your account for anything about your
        health. We never ask for health information by ordinary email.
      </p>

      <h2>Who we are</h2>
      <CompanyIdentity />
      <h2>Pharmacist registration</h2>
      <PharmacistRegistration />

      <h2>How to complain</h2>
      <p>
        <Placeholder>
          complaints contact route and acknowledgement timescale, needs owner approval
        </Placeholder>
      </p>
      <ol>
        <li>We acknowledge your complaint.</li>
        <li>A senior pharmacist investigates complaints about clinical care.</li>
        <li>We send you a written response explaining what we found and any actions taken.</li>
      </ol>
      <h2>If you are not satisfied</h2>
      <p>
        <Placeholder>independent bodies and escalation routes, needs regulatory review</Placeholder>
      </p>
    </ContentPage>
  );
}
