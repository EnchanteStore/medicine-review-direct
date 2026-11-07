import { screeningGuidance, type ScreeningAnswer } from '@mrd/domain';
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
  const answers = (screening.answers ?? {}) as Record<string, ScreeningAnswer>;
  const guidance = screeningGuidance(answers, {
    outcome: screening.outcome as 'emergency' | 'urgent' | 'routine',
    matchedRuleIds: screening.matched_rule_ids ?? [],
  });

  if (guidance === 'call_999' || guidance === 'call_999_or_111') {
    return (
      <div className="space-y-6" data-testid="outcome-emergency">
        <h1 className="font-serif text-3xl sm:text-4xl">
          {guidance === 'call_999'
            ? 'Call 999 now if this is happening'
            : 'This may be an emergency'}
        </h1>
        <FullEmergencyWarning />
        <Card className="space-y-3">
          <h2 className="text-xl">We have stopped this request</h2>
          <p>
            {guidance === 'call_999'
              ? 'Call 999 immediately. A medication review is not the right service, so this request is closed and cannot be paid for or booked.'
              : 'If an emergency may be happening, call 999. Otherwise contact NHS 111 now for an assessment. This request is closed and cannot be paid for or booked.'}
          </p>
          <p>
            {brand} has not assessed you, will not contact emergency services for you, and is not
            monitoring this page. This request is marked EMERGENCY_EXCLUDED.
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

  if (guidance === 'nhs_111_or_999_if_life_threatening' || guidance === 'gp_or_111') {
    return (
      <div className="space-y-6" data-testid="outcome-urgent">
        <h1 className="font-serif text-3xl sm:text-4xl">Please get help today</h1>
        <Card className="space-y-3">
          <h2 className="text-xl">Contact your GP or NHS 111 today</h2>
          <p>
            {guidance === 'nhs_111_or_999_if_life_threatening'
              ? 'Contact NHS 111 now about this medicine problem. If you have life-threatening symptoms, call 999. Do not wait for a medication review.'
              : 'Contact your GP or NHS 111 today. Do not wait for a medication review or a response from us.'}
          </p>
          <p>
            We have paused this request (URGENT_EXCLUDED). You cannot book a routine review for this
            concern until a pharmacist has checked that it is suitable and recorded that decision.
            {brand} is not monitoring this page.
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
          Your answers do not stop you continuing. This is not a check that you, or your medicines,
          are safe. A pharmacist will look at what you tell us.
        </p>
      </Alert>
      <Button asChild size="lg">
        <Link href={`/account/review/${order.id}/consent`}>Continue</Link>
      </Button>
    </div>
  );
}
