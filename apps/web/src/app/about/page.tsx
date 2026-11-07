import type { Metadata } from 'next';
import { ContentPage } from '@/components/page-header';
import { brandName } from '@/lib/site';

export const metadata: Metadata = { title: 'About us' };

export default function AboutPage() {
  return (
    <ContentPage
      title="About us"
      lead={`${brandName()} is a private service led by GPhC-registered pharmacists.`}
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

      <h2>Our pharmacists</h2>
      <p>
        All our pharmacists are registered with the General Pharmaceutical Council (GPhC). We check
        each pharmacist&apos;s registration before they can see any patient information. Pharmacist
        names and registration numbers will be shown here and on every report before launch.
      </p>

      <h2>Independent and private</h2>
      <p>
        We are a private service. We are not part of, or endorsed by, the NHS, and we cannot see
        your NHS records. You decide what information to share with us.
      </p>
    </ContentPage>
  );
}
