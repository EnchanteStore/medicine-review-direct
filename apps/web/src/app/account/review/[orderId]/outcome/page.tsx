import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { acknowledgeAdviceAction } from '@/app/account/review/actions';
import { FullEmergencyWarning } from '@/components/emergency-banner';
import { getLatestScreening, requireOwnOrder } from '@/lib/intake';
import { brandName } from '@/lib/site';

export const metadata: Metadata = { title: 'Safety check result' };

function Acknowledge({
  orderId,
  screeningId,
  done,
}: {
  orderId: string;
  screeningId: string;
  done: boolean;
}) {
  if (done)
    return (
      <p className="font-semibold">Thank you. You have confirmed you have read this advice.</p>
    );
  return (
    <form action={acknowledgeAdviceAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="screeningId" value={screeningId} />
      <Button type="submit" variant="secondary">
        I have read this advice
      </Button>
    </form>
  );
}

export default async function OutcomePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  const screening = await getLatestScreening(order.id);
  if (!screening) redirect(`/account/review/${order.id}/screening`);
  const brand = brandName();

  if (screening.outcome === 'emergency') {
    return (
      <div className="space-y-6" data-testid="outcome-emergency">
        <h1 className="font-serif text-3xl sm:text-4xl">Call 999 now if this is happening</h1>
        <FullEmergencyWarning />
        <Card className="space-y-3">
          <h2 className="text-xl">We have stopped this request</h2>
          <p>
            Your answers suggest you may need emergency help. A medication review is not the right
            service for this, so we cannot continue this request or take a booking or payment for
            it.
          </p>
          <p>
            {brand} will not contact emergency services for you and does not monitor this website.
            If you have a life-threatening emergency, call 999 yourself now.
          </p>
          <Acknowledge
            orderId={order.id}
            screeningId={screening.id}
            done={!!screening.acknowledged_at}
          />
        </Card>
      </div>
    );
  }

  if (screening.outcome === 'urgent' && order.status === 'safety_urgent_hold') {
    return (
      <div className="space-y-6" data-testid="outcome-urgent">
        <h1 className="font-serif text-3xl sm:text-4xl">Please get help today</h1>
        <FullEmergencyWarning />
        <Card className="space-y-3">
          <h2 className="text-xl">Contact your GP or NHS 111 today</h2>
          <p>
            Your answers suggest a problem that should be checked today. Do not wait for a
            medication review or a response from us.
          </p>
          <p>
            We have paused this request. You cannot book a routine review for this concern until a
            pharmacist has checked that it is suitable and recorded that decision.
          </p>
          <Acknowledge
            orderId={order.id}
            screeningId={screening.id}
            done={!!screening.acknowledged_at}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="outcome-routine">
      <h1 className="font-serif text-3xl sm:text-4xl">Thank you. You can continue</h1>
      <Alert tone="info">
        <p>
          Your answers do not stop you continuing. This does not mean your medicines are safe: a
          pharmacist will look at everything you tell us.
        </p>
      </Alert>
      <Button asChild size="lg">
        <Link href={`/account/review/${order.id}/consent`}>Continue</Link>
      </Button>
    </div>
  );
}
