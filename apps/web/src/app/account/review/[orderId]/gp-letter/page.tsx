import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { recordGpConsentAction } from '@/app/account/review/[orderId]/gp-letter/actions';
import { requireUser } from '@/lib/auth';
import { requireOwnOrder } from '@/lib/intake';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Letter for your GP' };
export const dynamic = 'force-dynamic';

export default async function GpLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/account');
  const { orderId } = await params;
  const query = await searchParams;
  await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const [{ data: letter }, { data: consent }] = await Promise.all([
    supabase
      .from('gp_letters')
      .select(
        'status, concern, findings, discussion_points, recipient_name, recipient_practice, dispatch_evidence',
      )
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('consents')
      .select('granted, recorded_at')
      .eq('user_id', user.id)
      .eq('order_id', orderId)
      .eq('consent_type', 'gp_letter_sharing')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6" data-testid="patient-gp-letter">
      <h1 className="font-serif text-3xl">Letter for your GP</h1>
      <p className="text-ink-700">
        This is separate from your medication review. A draft is not shown. Nothing is emailed, and
        we are not connected to NHS systems. The wording is DRAFT pending clinical approval.
      </p>
      {query.notice === 'granted' ? (
        <Alert tone="success">
          <p>Your agreement is recorded for this review.</p>
        </Alert>
      ) : null}
      {query.notice === 'refused' ? (
        <Alert tone="info">
          <p>You have not agreed to a GP letter for this review.</p>
        </Alert>
      ) : null}
      {typeof query.error === 'string' ? (
        <Alert tone="danger">
          <p>{query.error}</p>
        </Alert>
      ) : null}
      <Card className="space-y-3">
        <h2 className="text-xl">Your agreement</h2>
        <p>
          {consent?.granted
            ? 'You have agreed that a letter about this review may be kept for your GP.'
            : 'You have not agreed to a letter for your GP for this review.'}
        </p>
        <form action={recordGpConsentAction} className="flex flex-wrap gap-3">
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" name="consent" value="yes">
            I agree to a letter for my GP for this review
          </Button>
          <Button type="submit" name="consent" value="no" variant="secondary">
            I do not agree
          </Button>
        </form>
      </Card>
      {letter ? (
        <Card className="space-y-2">
          <h2 className="text-xl">Letter on file</h2>
          <p>Status: {letter.status}</p>
          <p>
            For: {letter.recipient_name}, {letter.recipient_practice}
          </p>
          <p className="whitespace-pre-wrap">{letter.concern}</p>
          <p className="whitespace-pre-wrap">{letter.findings}</p>
          <p className="whitespace-pre-wrap">{letter.discussion_points}</p>
          {letter.dispatch_evidence ? <p>{letter.dispatch_evidence}</p> : null}
        </Card>
      ) : (
        <Alert tone="info">
          <p>There is no approved letter for you to read yet.</p>
        </Alert>
      )}
      <p>
        <Link href={`/account/review/${orderId}`}>Back to your review</Link>
      </p>
    </div>
  );
}
