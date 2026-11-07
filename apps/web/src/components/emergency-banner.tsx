import { Container } from '@mrd/ui';

// Emergency wording is pending pharmacist approval (docs/CLINICAL_SAFETY.md, item CS-01).
export function EmergencyBanner() {
  return (
    <div className="bg-ink-900 text-white">
      <Container className="py-2.5 text-sm sm:text-base">
        <p>
          <strong>Not for emergencies.</strong> If you are seriously unwell, call{' '}
          <strong>999</strong>. For urgent medical advice, call <strong>NHS 111</strong>. This
          service is not monitored for emergencies.
        </p>
      </Container>
    </div>
  );
}
