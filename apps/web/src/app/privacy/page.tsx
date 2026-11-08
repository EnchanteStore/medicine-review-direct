import type { Metadata } from 'next';
import { CompanyIdentity, ContactDetails, LegalNotice, Placeholder } from '@/components/legal';
import { ContentPage } from '@/components/page-header';

export const metadata: Metadata = { title: 'Privacy Notice (placeholder)' };

const PROCESSORS = [
  [
    'Supabase',
    'Database, sign-in and private file storage',
    'Central EU (Frankfurt). The project has no patient records. A transfer assessment is not complete',
  ],
  [
    'Amazon Web Services (SES)',
    'Transactional email, with no health details in emails',
    'London planned. No email is sent yet',
  ],
  [
    'Stripe',
    'Card payments, with no health details in payment records',
    'Test mode only. Live payments are off',
  ],
  [
    'Cloudflare',
    'Preferred host for this website',
    'Not deployed. The clinical service is not running there',
  ],
] as const;

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Notice"
      lead="How we will collect, use and protect your information."
    >
      <LegalNotice />
      <h2>Data controller</h2>
      <CompanyIdentity />

      <h2>Information we collect</h2>
      <ul>
        <li>Account details: email address, name, date of birth and telephone number</li>
        <li>Your answers to our safety questions and medication questionnaire</li>
        <li>Documents you choose to upload, such as a repeat prescription list</li>
        <li>Consultation notes and the report your pharmacist writes</li>
        <li>Records of your consents, payments and messages</li>
      </ul>
      <h2>Why we use it and our lawful basis</h2>
      <p>
        To provide your medication review and keep the clinical records we must keep.{' '}
        <Placeholder>
          lawful basis and Article 9 condition for health data, needs legal and DPIA review
        </Placeholder>
      </p>
      <h2>Who processes your information for us</h2>
      <p>
        Each provider will be subject to a data processing agreement and a transfer assessment
        before real patient data is used.
      </p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-sand-300">
            <th scope="col" className="py-2 pr-4">
              Provider
            </th>
            <th scope="col" className="py-2 pr-4">
              Purpose
            </th>
            <th scope="col" className="py-2">
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          {PROCESSORS.map(([name, purpose, where]) => (
            <tr key={name} className="border-b border-sand-200">
              <td className="py-2 pr-4">{name}</td>
              <td className="py-2 pr-4">{purpose}</td>
              <td className="py-2">{where}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>We will not send identifiable records to AI providers without approved safeguards.</p>

      <h2>How long we keep it</h2>
      <p>
        A formal data protection impact assessment has not been completed. These periods are a
        provisional schedule for development, not a claim that they are legally sufficient:
      </p>
      <ul>
        <li>Completed clinical records: 8 years after your last clinical contact with us</li>
        <li>Safety escalations that form part of a care record: as clinical records</li>
        <li>Started but abandoned requests with no clinical care: 90 days</li>
        <li>Accounting records: generally 6 years</li>
        <li>Routine security logs: 12 months</li>
        <li>Temporary backups: 30 to 90 days</li>
      </ul>
      <p>
        Closing your account does not automatically delete clinical records, which we must keep for
        the period above. Records under a legal hold are kept until the hold ends.
      </p>
      <h2>Your rights</h2>
      <p>
        You have rights under UK data protection law, including to access, correct, restrict and in
        some cases erase your information, and to complain to the Information Commissioner's
        Office.{' '}
        <Placeholder>full rights wording and how to exercise them, needs legal review</Placeholder>
      </p>
      <h2>Contact</h2>
      <ContactDetails />
    </ContentPage>
  );
}
