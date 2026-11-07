import 'server-only';
import type { OrderStatus } from '@mrd/domain';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';

export interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  requires_prior_exclusion_review: boolean;
  exclusion_label: string | null;
}

export async function getLatestOrder(userId: string): Promise<OrderRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('review_orders')
    .select('id, status, created_at, requires_prior_exclusion_review, exclusion_label')
    .eq('patient_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** The order if it belongs to the current user (RLS), otherwise 404. */
export async function requireOwnOrder(orderId: string): Promise<OrderRow> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('review_orders')
    .select('id, status, created_at, requires_prior_exclusion_review, exclusion_label')
    .eq('id', orderId)
    .maybeSingle();
  if (!data) notFound();
  return data;
}

export async function getLatestScreening(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('safety_screenings')
    .select('id, outcome, ruleset_version, acknowledged_at, created_at, answers, matched_rule_ids')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export interface QuestionnaireRow {
  id: string;
  status: 'draft' | 'submitted' | 'superseded';
  version_no: number | null;
  current_step: number;
  answers: Record<string, string>;
  medications: Record<string, unknown>[];
  submitted_at: string | null;
}

export async function getQuestionnaires(orderId: string): Promise<QuestionnaireRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('questionnaire_submissions')
    .select('id, status, version_no, current_step, answers, medications, submitted_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as QuestionnaireRow[];
}

export async function getDraft(orderId: string): Promise<QuestionnaireRow | null> {
  return (await getQuestionnaires(orderId)).find((q) => q.status === 'draft') ?? null;
}

export async function hasIntakeConsents(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('consents')
    .select('consent_type, granted, recorded_at')
    .eq('user_id', userId)
    .in('consent_type', ['health_data_processing', 'remote_consultation'])
    .order('recorded_at', { ascending: false });
  const latest = new Map<string, boolean>();
  for (const row of data ?? [])
    if (!latest.has(row.consent_type)) latest.set(row.consent_type, row.granted);
  return (
    latest.get('health_data_processing') === true && latest.get('remote_consultation') === true
  );
}

export async function getDocuments(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('documents')
    .select('id, original_filename, mime_type, size_bytes, scan_status, uploaded_at')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false });
  return data ?? [];
}
