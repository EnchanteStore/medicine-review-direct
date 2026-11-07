import { Alert, Badge, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { UploadForm } from '@/components/intake/forms';
import { getDocuments, requireOwnOrder } from '@/lib/intake';

export const metadata: Metadata = { title: 'Your documents' };

export default async function DocumentsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  const docs = await getDocuments(order.id);
  const canUpload = ['intake', 'questionnaire_submitted'].includes(order.status);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Your documents</h1>
      <p className="text-lg text-ink-700">
        You can share documents such as your repeat prescription list or a hospital discharge
        letter. This is optional. Files are stored privately.
      </p>
      <Alert tone="warning">
        <p>
          Security scanning of uploaded files is not yet switched on in this preview. Files stay
          hidden from pharmacists until they have been scanned.
        </p>
      </Alert>
      {canUpload ? (
        <Card>
          <UploadForm orderId={order.id} />
        </Card>
      ) : null}
      <section>
        <h2 className="text-xl">Uploaded files</h2>
        {docs.length === 0 ? (
          <p className="mt-2 text-ink-700">No files uploaded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-sand-200 bg-white p-3"
              >
                <span className="font-semibold">{d.original_filename}</span>
                <span className="text-sm text-ink-600">{Math.ceil(d.size_bytes / 1024)} KB</span>
                <Badge tone={d.scan_status === 'clean' ? 'teal' : 'warning'}>
                  {d.scan_status === 'pending_scan'
                    ? 'Waiting for security scan'
                    : d.scan_status === 'clean'
                      ? 'Scanned'
                      : 'Rejected'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href={`/account/review/${order.id}`}>Back to your review</Link>
    </div>
  );
}
