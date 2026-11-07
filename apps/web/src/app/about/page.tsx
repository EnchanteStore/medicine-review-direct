import type { Metadata } from 'next';
import { PharmacistRegistration } from '@/components/legal';
import { ContentPage } from '@/components/page-header';
import { brandName } from '@/lib/site';

export const metadata: Metadata = { title: 'About us' };

export default function AboutPage() {
  return (
    <ContentPage
      title="About us"
      lead={`${brandName()} is a private pharmacist-led medication review service for adults in England.`}
    >
      <p>
        Many people take several medicines prescribed at different times, sometimes by different
        clinicians. It is easy to lose track of why each one was started, or to wonder whether they
        still suit you. GP appointments are often short, and there is not always time to go through
        everything.
      </p>
      <p>
        We offer an unhurried, independent review with a pharmacist, an expert in medicines. We
        listen, explain and suggest things you may want to discuss with your GP or prescriber. Every
        recommendation is made and checked by a registered pharmacist. We do not use automated or AI
        systems to make clinical decisions.
      </p>

      <h2>Who provides the service</h2>
      <p>
        {brandName()} is a trading name of PHARMA247 LTD. It is a private service, not an NHS
        service. Every pharmacist who sees patient information must be verified before they are
        given access. The lead pharmacist named for the service is below. Their live GPhC register
        entry has not yet been independently confirmed.
      </p>
      <PharmacistRegistration />

      <h2>Independent and private</h2>
      <p>
        We are a private service. We are not part of, or endorsed by, the NHS, and we cannot see
        your NHS records. You decide what information to share with us.
      </p>
    </ContentPage>
  );
}
