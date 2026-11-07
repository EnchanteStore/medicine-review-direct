import { Container } from '@mrd/ui';
import { getServiceStatus } from '@/lib/service-status';

/** Says plainly when this is a development preview or the live service is not yet approved. */
export async function ServiceNotice() {
  const status = await getServiceStatus();
  if (status.live_service_enabled) return null;
  return (
    <div className="border-b border-warning-800/30 bg-warning-50" data-testid="service-notice">
      <Container className="py-2 text-sm text-ink-900">
        {status.environment === 'development' ? (
          <p>
            <strong>Development preview.</strong> Synthetic data only. Checkout here is a labelled
            test. No live card payment is taken.
          </p>
        ) : (
          <p>
            <strong>Not yet open.</strong> We are not accepting patients or payments until all
            clinical, legal and regulatory approvals are in place.
          </p>
        )}
      </Container>
    </div>
  );
}
