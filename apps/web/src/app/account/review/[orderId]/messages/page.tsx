import { MESSAGING_OUT_OF_HOURS_WARNING, formatLondon } from '@mrd/domain';
import { Alert, Button, Card, FormField, Textarea } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { sendPatientMessageAction } from '@/app/account/review/[orderId]/messages/actions';
import { requireUser } from '@/lib/auth';
import { requireOwnOrder } from '@/lib/intake';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage({
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
  await supabase.rpc('mark_review_messages_read', { p_order_id: orderId });
  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6" data-testid="patient-messages">
      <h1 className="font-serif text-3xl">Messages</h1>
      <Alert tone="warning">
        <p data-testid="out-of-hours">{MESSAGING_OUT_OF_HOURS_WARNING}</p>
      </Alert>
      {query.notice === 'sent' ? (
        <Alert tone="success">
          <p>Message sent. The email does not include what you wrote.</p>
        </Alert>
      ) : null}
      {typeof query.error === 'string' ? (
        <Alert tone="danger">
          <p>{query.error}</p>
        </Alert>
      ) : null}
      <ul className="space-y-3">
        {(messages ?? []).length === 0 ? <li>No messages yet.</li> : null}
        {(messages ?? []).map((message) => (
          <li key={message.id}>
            <Card className="space-y-1">
              <p className="text-sm text-ink-600">
                {message.sender_id === user.id ? 'You' : 'Your pharmacist'} ·{' '}
                {formatLondon(new Date(message.created_at))}
              </p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </Card>
          </li>
        ))}
      </ul>
      <form action={sendPatientMessageAction} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <FormField id="patientMessage" label="Message">
          {(aria) => <Textarea {...aria} name="body" required />}
        </FormField>
        <Button type="submit">Send message</Button>
      </form>
      <p>
        <Link href={`/account/review/${orderId}`}>Back to your review</Link>
      </p>
    </div>
  );
}
