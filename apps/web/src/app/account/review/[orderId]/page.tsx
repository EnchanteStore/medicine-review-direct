import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { amendQuestionnaireAction } from '@/app/account/review/actions';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getDocuments,
  getDraft,
  getQuestionnaires,
  hasIntakeConsents,
  requireOwnOrder,
} from '@/lib/intake';
import { describeOrder } from '@/lib/order-status';
import { getServiceStatus } from '@/lib/service-status';

export const metadata: Metadata = { title: 'Your medication review' };

export default async function ReviewOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/account');
  const { orderId } = await params;
  const { notice } = await searchParams;
  const order = await requireOwnOrder(orderId);
  const [draft, questionnaires, consents, docs, status] = await Promise.all([
    getDraft(order.id),
    getQuestionnaires(order.id),
    hasIntakeConsents(user.id),
    getDocuments(order.id),
    getServiceStatus(),
  ]);
  const view = describeOrder({
    id: order.id,
    status: order.status,
    hasConsents: consents,
    draftStep: draft?.current_step ?? null,
    paymentsOpen: status.payments_open,
  });
  const submitted = questionnaires.filter((q) => q.status !== 'draft');
  const supabase = await createSupabaseServerClient();
  const { data: notices } = await supabase
    .from('safety_notices')
    .select('id, kind, body, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Your medication review</h1>
      {notice === 'submitted' ? (
        <Alert tone="success">
          <p>
            Your questionnaire has been sent. We have emailed you a notification with no health
            details.
          </p>
        </Alert>
      ) : null}
      {notice === 'paid' ? (
        <Alert tone="success">
          <p>Your test payment is confirmed. You can choose a consultation time.</p>
        </Alert>
      ) : null}
      <Card className="space-y-3" data-testid="order-status">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Status</p>
        <h2 className="text-2xl">{view.label}</h2>
        <p className="text-ink-700">{view.message}</p>
        {view.next && view.next.href !== `/account/review/${order.id}` ? (
          <Button asChild>
            <Link href={view.next.href}>{view.next.label}</Link>
          </Button>
        ) : null}
      </Card>

      {submitted.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-xl">Questionnaire versions</h2>
          <ul className="space-y-1">
            {submitted.map((q) => (
              <li key={q.id}>
                Version {q.version_no}:{' '}
                {q.status === 'submitted' ? 'current' : 'replaced by a later version'}
                {q.submitted_at
                  ? `, sent ${new Date(q.submitted_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}`
                  : ''}
              </li>
            ))}
          </ul>
          {order.status === 'questionnaire_submitted' ? (
            <form action={amendQuestionnaireAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="secondary">
                Change my answers
              </Button>
            </form>
          ) : null}
        </Card>
      ) : null}

      {(notices ?? []).length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-xl">Safety note</h2>
          <Alert tone="warning">
            <p>This is not a medication review report.</p>
          </Alert>
          <ul className="space-y-2">
            {(notices ?? []).map((note) => (
              <li key={note.id} className="whitespace-pre-wrap">
                {note.body}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h2 className="text-xl">Report and messages</h2>
        <p className="text-ink-700">
          A report appears only after your pharmacist releases it. Drafts stay hidden.
        </p>
        <p>
          <Link href={`/account/review/${order.id}/report`}>Your report</Link>
          {' · '}
          <Link href={`/account/review/${order.id}/messages`}>Messages</Link>
          {' · '}
          <Link href={`/account/review/${order.id}/gp-letter`}>Letter for your GP</Link>
        </p>
      </Card>

      {['intake', 'questionnaire_submitted'].includes(order.status) ? (
        <Card className="space-y-3">
          <h2 className="text-xl">Documents (optional)</h2>
          <p className="text-ink-700">
            {docs.length === 0
              ? 'You have not uploaded any documents.'
              : `You have uploaded ${docs.length} document(s).`}
          </p>
          <Link href={`/account/review/${order.id}/documents`}>Upload or view documents</Link>
        </Card>
      ) : null}
    </div>
  );
}
