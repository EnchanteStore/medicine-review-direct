import { Alert, Badge, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StartReviewForm } from '@/components/intake/forms';
import { requireUser } from '@/lib/auth';
import { getDraft, getLatestOrder, hasIntakeConsents } from '@/lib/intake';
import { describeOrder } from '@/lib/order-status';
import { getOwnProfile, isProfileComplete } from '@/lib/profile';
import { getServiceStatus } from '@/lib/service-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your account' };

const NOTICES: Record<string, string> = {
  verified: 'Thank you. Your email address is confirmed.',
  'password-updated': 'Your password has been changed.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/account');
  const profile = await getOwnProfile(user.id);
  const params = await searchParams;
  const notice = typeof params.notice === 'string' ? NOTICES[params.notice] : undefined;
  const complete = isProfileComplete(profile);
  const [order, status, consents] = await Promise.all([
    getLatestOrder(user.id),
    getServiceStatus(),
    hasIntakeConsents(user.id),
  ]);
  const draft = order ? await getDraft(order.id) : null;
  const view = order
    ? describeOrder({
        id: order.id,
        status: order.status,
        hasConsents: consents,
        draftStep: draft?.current_step ?? null,
        paymentsOpen: status.payments_open,
      })
    : null;
  const supabase = await createSupabaseServerClient();
  const [{ count: unread }, { data: released }] = order
    ? await Promise.all([
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', order.id)
          .is('read_at', null)
          .neq('sender_id', user.id),
        supabase.from('reports').select('id').eq('order_id', order.id).eq('status', 'released'),
      ])
    : [{ count: 0 }, { data: [] }];
  const canStartNew =
    complete &&
    status.intake_open &&
    (!order ||
      ['cancelled', 'safety_emergency_excluded', 'declined', 'completed'].includes(order.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">
          {profile?.givenName ? `Hello, ${profile.givenName}` : 'Your account'}
        </h1>
        <p className="mt-2 text-ink-700">
          Signed in as <strong>{user.email}</strong>
          {user.email_confirmed_at ? (
            <Badge tone="teal" className="ml-2">
              Email confirmed
            </Badge>
          ) : null}
        </p>
      </div>

      {notice ? (
        <Alert tone="success">
          <p>{notice}</p>
        </Alert>
      ) : null}

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-2xl">
          Things to do
        </h2>
        {complete ? (
          <p className="mt-3 text-ink-700">You have nothing to do right now.</p>
        ) : (
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg">Add your details</h3>
              <p className="text-ink-700">
                We need your name and date of birth before your review.
              </p>
            </div>
            <Button asChild>
              <Link href="/account/profile">Add your details</Link>
            </Button>
          </Card>
        )}
      </section>

      <section aria-labelledby="review-heading" className="space-y-4">
        <h2 id="review-heading" className="text-2xl">
          Your medication review
        </h2>
        {view ? (
          <Card className="space-y-3" data-testid="dashboard-review-status">
            <Badge tone={view.tone === 'danger' || view.tone === 'warning' ? 'warning' : 'teal'}>
              {view.label}
            </Badge>
            <p className="text-ink-700">{view.message}</p>
            {view.next ? (
              <Button asChild>
                <Link href={view.next.href}>{view.next.label}</Link>
              </Button>
            ) : null}
          </Card>
        ) : null}
        {canStartNew ? (
          <Card className="space-y-3">
            <p>
              {order
                ? 'You can start a new request.'
                : 'Start by answering a few safety questions, then tell us about your medicines.'}
            </p>
            <StartReviewForm />
          </Card>
        ) : !order && !complete ? (
          <p className="text-ink-700">Add your details before you start a review.</p>
        ) : !order && !status.intake_open ? (
          <Alert tone="info">
            <p>We are not accepting new reviews yet.</p>
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="text-2xl">
          Reports and messages
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          <li>
            <Card className="h-full space-y-2 p-5 sm:p-6">
              <h3 className="text-lg">Report</h3>
              {released && released.length > 0 && order ? (
                <>
                  <p className="text-ink-700">Your pharmacist has released a report.</p>
                  <Link href={`/account/review/${order.id}/report`}>Read your report</Link>
                </>
              ) : (
                <p className="text-ink-700">No report has been released. Drafts are not shown.</p>
              )}
            </Card>
          </li>
          <li>
            <Card className="h-full space-y-2 p-5 sm:p-6" data-testid="dashboard-messages">
              <h3 className="text-lg">Messages</h3>
              {order ? (
                <>
                  <p className="text-ink-700">
                    {unread ? `${unread} unread.` : 'No unread messages.'} This is not an emergency
                    service.
                  </p>
                  <Link href={`/account/review/${order.id}/messages`}>Open messages</Link>
                </>
              ) : (
                <p className="text-ink-700">Messages appear here once you have a review.</p>
              )}
            </Card>
          </li>
        </ul>
      </section>
    </div>
  );
}
