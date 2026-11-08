import { LAUNCH_GATES, type LaunchGate } from '@mrd/domain';
import { Badge, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Launch readiness' };

const EVIDENCE: Record<LaunchGate, string> = {
  clinical_screening_content_and_sop:
    'Clinical sign-off of the screening questions, exclusion rules, medicine flags and escalation procedure.',
  operational_response_arrangements:
    'Named people and hours for urgent-hold review. The service is not monitored 24 hours a day.',
  mhra_device_classification:
    'Documented MHRA medical-device qualification and classification, including the symptom questions.',
  cqc_scope_assessment:
    'Documented CQC scope assessment. Do not claim registration or an exemption.',
  professional_indemnity:
    'Confirmed cover for private remote consultations, medicines advice and written reports.',
  legal_terms_and_privacy_notice: 'Solicitor-approved terms, privacy notice and consumer wording.',
  retention_policy_and_dpia: 'Approved retention schedule and a completed DPIA. Not completed yet.',
  company_ico_gphc_details:
    'ICO fee position, a live GPhC register check for 2234388, and confirmed indemnity.',
  vat_and_brand_checks:
    'Accountant confirmation of VAT treatment, and brand clearance for MedsInFocus.',
  processor_agreements_and_security_review:
    'Processor register, Article 28 agreements, London-region checks, security test and recovery sign-off.',
};

export default async function LaunchReadinessPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('launch_readiness');
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Launch readiness</h1>
      <p className="text-lg text-ink-700">
        These gates block public clinical intake and patient payments. None is marked complete
        unless a sign-off with evidence is stored. Product-owner decisions are not clinical, legal
        or regulatory approval.
      </p>
      <ol className="space-y-4">
        {rows.map((row) => (
          <li key={row.gate}>
            <Card className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl">{LAUNCH_GATES[row.gate]}</h2>
                <Badge tone={row.decision === 'approved' ? 'teal' : 'warning'}>
                  {row.decision === 'approved' ? 'Signed off' : 'Not signed off'}
                </Badge>
              </div>
              <p>{EVIDENCE[row.gate]}</p>
              {row.evidence_reference ? (
                <p className="text-sm text-ink-600">Evidence reference: {row.evidence_reference}</p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
      {rows.length === 0 ? (
        <p>
          The checklist is only available to a verified administrator signed in with an
          authenticator.
        </p>
      ) : null}
    </div>
  );
}
