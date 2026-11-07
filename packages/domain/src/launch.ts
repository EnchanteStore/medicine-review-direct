/** Launch sign-off gates (owner decision section 9). Mirrors `public.launch_gate`. */
export const LAUNCH_GATES = {
  clinical_screening_content_and_sop: 'Clinical screening content and escalation SOP',
  operational_response_arrangements: 'Operational response arrangements',
  mhra_device_classification: 'MHRA medical-device classification assessment',
  cqc_scope_assessment: 'CQC scope assessment',
  professional_indemnity: 'Professional indemnity',
  legal_terms_and_privacy_notice: 'Legal terms and privacy notice',
  retention_policy_and_dpia: 'Retention policy and DPIA',
  company_ico_gphc_details: 'Company, ICO and GPhC details',
  vat_and_brand_checks: 'VAT and brand checks',
  processor_agreements_and_security_review:
    'Data residency, processor agreements and security review',
} as const;

export type LaunchGate = keyof typeof LAUNCH_GATES;

export type PaymentsMode = 'closed' | 'test' | 'live';

export interface ServiceStatus {
  environment: 'development' | 'production';
  intake_open: boolean;
  payments_open: boolean;
  /** Live card payments. Never true in development, and never true before every launch sign-off. */
  live_payments_open: boolean;
  /** closed: no checkout. test: labelled local or Stripe test checkout. live: not used until launch. */
  payments_mode: PaymentsMode;
  live_service_enabled: boolean;
  active_ruleset_version: string | null;
  active_ruleset_status: 'draft' | 'approved' | 'retired' | null;
  outstanding_gate_count: number;
}

export const RETENTION_CATEGORIES = {
  clinical_record: 'Completed clinical records',
  safety_escalation: 'Clinical safety escalations (part of a care record)',
  abandoned_intake: 'Abandoned intakes with no clinical care',
  accounting: 'Accounting records',
  security_log: 'Routine security logs',
  temporary_backup: 'Temporary backups',
} as const;
