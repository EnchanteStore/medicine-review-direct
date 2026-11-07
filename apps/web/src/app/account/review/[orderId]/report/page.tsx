import { reportSections } from '@mrd/domain';
import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requireOwnOrder } from '@/lib/intake';
import { loadReportDocument } from '@/lib/report-document';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your report' };
export const dynamic = 'force-dynamic';

export default async function PatientReportPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireUser('/account');
  const { orderId } = await params;
  await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('status')
    .eq('order_id', orderId)
    .eq('status', 'released')
    .maybeSingle();

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl">Your report</h1>
        <Alert tone="info">
          <p>
            Your pharmacist has not released a report for this review. Drafts are not shown here.
          </p>
        </Alert>
        <Link href={`/account/review/${orderId}`}>Back to your review</Link>
      </div>
    );
  }

  const model = await loadReportDocument(orderId);
  const sections = reportSections(model);

  return (
    <div className="space-y-6" data-testid="patient-report">
      <h1 className="font-serif text-3xl">Your medication review</h1>
      <Alert tone="info">
        <p>
          This is the version your pharmacist released. Clinical wording in the template is{' '}
          <strong>DRAFT pending clinical approval</strong>. It is for discussion with your
          prescriber. It does not tell you to start, stop or change a medicine on your own.
        </p>
      </Alert>
      <p>
        <Button asChild variant="secondary">
          <Link href={`/account/review/${orderId}/report/file`}>Download PDF</Link>
        </Button>
      </p>
      {sections.map((section) => (
        <Card key={section.title} className="space-y-2">
          <h2 className="text-xl">{section.title}</h2>
          <p className="whitespace-pre-wrap">{section.body}</p>
        </Card>
      ))}
      <p>
        <Link href={`/account/review/${orderId}/messages`}>Messages</Link>
        {' · '}
        <Link href={`/account/review/${orderId}/gp-letter`}>Letter for your GP</Link>
      </p>
    </div>
  );
}
