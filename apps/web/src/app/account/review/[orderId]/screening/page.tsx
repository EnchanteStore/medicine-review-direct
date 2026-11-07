import { ACTIVE_RULESET } from '@mrd/domain';
import { Badge } from '@mrd/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FullEmergencyWarning } from '@/components/emergency-banner';
import { ScreeningForm } from '@/components/intake/forms';
import { requireOwnOrder } from '@/lib/intake';

export const metadata: Metadata = { title: 'Safety questions' };

export default async function ScreeningPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  if (order.status !== 'draft') redirect(`/account/review/${order.id}/outcome`);

  const by = (p: string) => ACTIVE_RULESET.questions.filter((q) => q.pathway === p);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Safety questions</h1>
      <FullEmergencyWarning />
      <p className="text-lg text-ink-700">
        Before you tell us about your medicines, we need to check this service is right for you
        today. Answer every question. If you are not sure, choose &quot;Not sure&quot;.
      </p>
      <p className="text-sm text-ink-600">
        Question set {ACTIVE_RULESET.version}{' '}
        <Badge tone="draft">Draft: awaiting clinical approval</Badge>
      </p>
      <ScreeningForm
        orderId={order.id}
        groups={[
          {
            title: 'Right now',
            intro: 'These questions are about how you are at this moment.',
            questions: by('emergency'),
          },
          {
            title: 'In the last few days',
            intro: 'These questions are about problems that may need help today.',
            questions: by('urgent'),
          },
          {
            title: 'About your medicines',
            intro: 'These answers help your pharmacist. They do not stop you using the service.',
            questions: by('routine'),
          },
        ]}
      />
    </div>
  );
}
