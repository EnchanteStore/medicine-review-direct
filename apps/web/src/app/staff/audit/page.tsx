import { auditDetails, canReadAuditLog, formatLondon } from '@mrd/domain';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaffGrants } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditLogPage() {
  const grants = await getStaffGrants();
  if (!canReadAuditLog(grants)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('audit_log')
    .select('id, occurred_at, actor_id, action, entity_type, entity_id, metadata')
    .order('occurred_at', { ascending: false })
    .limit(100);

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Audit log</h1>
      <p className="text-lg text-ink-700">
        Recent account, payment and clinical actions. The log stores identifiers and field names. It
        does not store a questionnaire, a message or a report.
      </p>
      {rows.length === 0 ? (
        <p>No audit events are recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-lg">
            <caption className="sr-only">Recent audit events</caption>
            <thead>
              <tr className="border-b border-sand-200">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  When
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Action
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Record
                </th>
                <th scope="col" className="py-3 font-semibold">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-sand-200 align-top">
                  <td className="py-3 pr-4">{formatLondon(new Date(row.occurred_at))}</td>
                  <td className="py-3 pr-4">{row.action}</td>
                  <td className="py-3 pr-4">
                    {row.entity_type}
                    {row.entity_id ? ` ${row.entity_id}` : ''}
                  </td>
                  <td className="py-3">{auditDetails(row.metadata) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
