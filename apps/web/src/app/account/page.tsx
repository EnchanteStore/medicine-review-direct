import { Alert, Badge, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StartReviewForm } from '@/components/intake/forms';
import { requireUser } from '@/lib/auth';
import { getDraft, getLatestOrder, hasIntakeConsents } from '@/lib/intake';
import { describeOrder } from '@/lib/order-status';
import { getOwnProfile, isProfileComplete } from '@/lib/profile';
import { getServiceStatus } from '@/lib/service-status';

export const metadata: Metadata = { title: 'Your account' };

const NOTICES: Record<string, string> = {
  verified: 'Thank you. Your email address is confirmed.',
  'password-updated': 'Your password has been changed.',
};

// Sections shown honestly as not yet available; each is delivered in a later phase.
const SECTIONS = [
  { title: 'Consultations', body: 'Book and manage your telephone or video consultation.' },
  { title: 'Medicines', body: 'The medicines you have told us about.' },
  { title: 'Messages', body: 'Secure messages with your pharmacist.' },
  { title: 'Reports', body: 'Reports your pharmacist has released to you.' },
  { title: 'Payments and receipts', body: 'Your payments, receipts and refunds.' },
];

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
          Coming later
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.title}>
              <Card className="h-full p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg">{s.title}</h3>
                  <Badge className="shrink-0 whitespace-nowrap">Not yet available</Badge>
                </div>
                <p className="mt-2 text-ink-700">{s.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
