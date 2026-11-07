import { Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DeletionRequestForm } from '@/components/intake/forms';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  in_review: 'Being reviewed',
  completed: 'Completed',
  rejected: 'Not possible',
};

export default async function SettingsPage() {
  const user = await requireUser('/account/settings');
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from('deletion_requests')
    .select('id, status, requested_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false });
  const open = (requests ?? []).find((r) => r.status === 'received' || r.status === 'in_review');

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Settings</h1>
      <Card className="space-y-4">
        <h2 className="text-xl">Close your account and delete your information</h2>
        <p>
          You can ask us to close your account. We will delete information we do not need to keep.
          We must keep clinical records, such as questionnaires you have sent and any review
          records, for a set period after your last contact with us, even if you close your account.
          See our <Link href="/privacy">Privacy Notice</Link>.
        </p>
        {open ? (
          <p data-testid="deletion-request-status">
            Your request from{' '}
            {new Date(open.requested_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}{' '}
            is: <strong>{STATUS_LABELS[open.status]}</strong>
          </p>
        ) : (
          <DeletionRequestForm />
        )}
      </Card>
    </div>
  );
}
