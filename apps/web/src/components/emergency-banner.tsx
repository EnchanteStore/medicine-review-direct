import { fullEmergencyWarning, shortEmergencyWarning } from '@mrd/domain';
import { Container } from '@mrd/ui';
import { brandName } from '@/lib/site';

/** Persistent shortened warning shown on every page, including throughout intake. */
export function EmergencyBanner() {
  const copy = shortEmergencyWarning(brandName());
  return (
    <aside
      aria-label="Emergency information"
      className="bg-ink-900 text-white"
      data-testid="emergency-banner-short"
    >
      <Container className="py-2.5 text-sm sm:text-base">
        <p>
          <strong>{copy.heading}</strong> {copy.paragraphs.join(' ')}
        </p>
      </Container>
    </aside>
  );
}

/** Full owner-approved warning, shown at safety checkpoints. */
export function FullEmergencyWarning({ className }: { className?: string }) {
  const copy = fullEmergencyWarning(brandName());
  return (
    <section
      aria-labelledby="full-emergency-heading"
      className={`rounded-md border-4 border-danger-700 bg-danger-50 p-5 sm:p-6 ${className ?? ''}`}
      data-testid="emergency-warning-full"
    >
      <h2 id="full-emergency-heading" className="text-xl font-bold text-ink-900">
        {copy.heading}
      </h2>
      {copy.paragraphs.map((p) => (
        <p key={p} className="mt-3 text-ink-900">
          {p}
        </p>
      ))}
    </section>
  );
}
