import { Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConsentForm } from '@/components/intake/forms';
import { requireUser } from '@/lib/auth';
import { hasIntakeConsents, requireOwnOrder } from '@/lib/intake';
import { brandName } from '@/lib/site';

export const metadata: Metadata = { title: 'Your consent' };

export default async function ConsentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser('/account');
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  if (order.status !== 'intake') redirect(`/account/review/${order.id}`);
  if (await hasIntakeConsents(user.id)) redirect(`/account/review/${order.id}/questionnaire/1`);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">How we use your health information</h1>
      <Card className="space-y-4">
        <p>
          To review your medicines, your pharmacist needs to know about your health. Only the
          pharmacists and clinical staff involved in your review can see it. We never put health
          details in emails or text messages.
        </p>
        <p>
          You can read more in our <Link href="/privacy">Privacy Notice</Link> (placeholder awaiting
          legal review).
        </p>
        <ConsentForm orderId={order.id} brand={brandName()} />
      </Card>
    </div>
  );
}
