import type { Metadata } from 'next';
import { FullEmergencyWarning } from '@/components/emergency-banner';
import { LegalNotice, PharmacistRegistration, Placeholder } from '@/components/legal';
import { ContentPage } from '@/components/page-header';
import { brandName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Clinical Service and Safety Information (placeholder)',
};

export default function ClinicalSafetyPage() {
  const brand = brandName();
  return (
    <ContentPage
      title="Clinical Service and Safety Information"
      lead="What our service does, what it does not do, and how we keep it safe."
    >
      <LegalNotice reviewer="clinical" />
      <FullEmergencyWarning className="my-6" />

      <h2>What we do</h2>
      <ul>
        <li>Private medication reviews for adults aged 18 or over in England</li>
        <li>A consultation with a GPhC-registered pharmacist by telephone or secure video</li>
        <li>A personalised report prepared, checked and signed by that pharmacist</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>Emergency or same-day urgent care</li>
        <li>Diagnose conditions, prescribe, or change your medicines</li>
        <li>Claim any NHS affiliation, or access your NHS records</li>
        <li>Use automated or AI systems to make clinical decisions</li>
      </ul>
      <h2>Safety questions</h2>
      <p>
        Before you continue, we ask a short set of safety questions. If your answers suggest an
        emergency, we stop and tell you to call 999 immediately. If they suggest you need help
        today, we pause your request and advise you to contact your GP or NHS 111; a pharmacist must
        then check it is suitable before you can book. {brand} will not contact emergency services
        for you.
      </p>
      <p>
        Taking a higher-risk medicine does not stop you using the service; it means a pharmacist
        will look at it carefully. Our questions never declare your medicines safe.
      </p>
      <h2>Your pharmacist</h2>
      <PharmacistRegistration />
      <h2>Regulatory status</h2>
      <p>
        <Placeholder>
          MHRA medical-device classification and CQC scope assessments, needed before launch
        </Placeholder>
      </p>
    </ContentPage>
  );
}
