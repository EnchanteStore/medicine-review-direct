import { ACTIVE_RULESET } from '@mrd/domain';
import { Badge } from '@mrd/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ScreeningForm } from '@/components/intake/forms';
import { requireOwnOrder } from '@/lib/intake';

export const metadata: Metadata = { title: 'Safety questions' };

export default async function ScreeningPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  if (order.status !== 'draft') redirect(`/account/review/${order.id}/outcome`);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Safety questions</h1>
      <p className="text-lg text-ink-700">
        These questions check whether a routine medication review is the right service today. They
        are not a diagnosis, and nobody is reading your answers as you give them. Choose &quot;Not
        sure&quot; if you are unsure. Not sure is not the same as no.
      </p>
      <p className="text-sm text-ink-600">
        Question set {ACTIVE_RULESET.version} <Badge tone="draft">Pending clinical approval</Badge>
      </p>
      <ScreeningForm
        orderId={order.id}
        priorExclusion={order.requires_prior_exclusion_review}
        groups={[
          {
            title: 'Before we continue',
            intro:
              'Answer every question. A routine review cannot take the place of emergency or urgent care.',
            questions: ACTIVE_RULESET.questions,
          },
        ]}
      />
    </div>
  );
}
