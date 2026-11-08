import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from './config';
import { logSafe } from './log';
import { sessionStorageAdapter } from './secure-session';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const config = publicConfig();
  if (!config.configured) throw new Error('supabase is not configured');
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: sessionStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) {
    logSafe('sign_in_failed', error.code);
    return 'The email address or password is incorrect.';
  }
  logSafe('sign_in');
  return null;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  if (error) logSafe('sign_out_failed', error.code);
  else logSafe('sign_out');
}

export interface ReviewSnapshot {
  orderId: string | null;
  status: string | null;
  appointment: { startsAt: string | null; method: string | null; status: string | null };
}

export async function loadReview(): Promise<ReviewSnapshot> {
  const db = supabase();
  const { data: order, error } = await db
    .from('review_orders')
    .select('id, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logSafe('review_read_failed', error.code);
  if (!order) {
    return {
      orderId: null,
      status: null,
      appointment: { startsAt: null, method: null, status: null },
    };
  }
  const { data: appointment } = await db
    .from('appointments')
    .select('starts_at, method, status')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    orderId: order.id,
    status: order.status,
    appointment: {
      startsAt: appointment?.starts_at ?? null,
      method: appointment?.method ?? null,
      status: appointment?.status ?? null,
    },
  };
}

export async function loadReport(orderId: string) {
  const db = supabase();
  const { data: userData } = await db.auth.getUser();
  const userId = userData.user?.id;
  const [
    { data: report },
    { data: profile },
    { data: consultation },
    { data: questionnaire },
    { data: documents },
  ] = await Promise.all([
    db
      .from('reports')
      .select('status, content, approver_display_name, approver_gphc_number')
      .eq('order_id', orderId)
      .eq('status', 'released')
      .maybeSingle(),
    userId
      ? db
          .from('profiles')
          .select('given_name, family_name, date_of_birth')
          .eq('id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('consultations')
      .select('method, occurred_at, clinical_notes')
      .eq('order_id', orderId)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('questionnaire_submissions')
      .select('answers, medications')
      .eq('order_id', orderId)
      .eq('status', 'submitted')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('documents').select('original_filename, scan_status').eq('order_id', orderId),
  ]);
  return { report, profile, consultation, questionnaire, documents: documents ?? [] };
}

export interface MessageRow {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export async function loadMessages(orderId: string): Promise<MessageRow[]> {
  const db = supabase();
  const { data: userData } = await db.auth.getUser();
  const me = userData.user?.id;
  await db.rpc('mark_review_messages_read', { p_order_id: orderId });
  const { data, error } = await db
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) {
    logSafe('messages_read_failed', error.code);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    mine: row.sender_id === me,
  }));
}

export async function sendMessage(orderId: string, body: string): Promise<string | null> {
  const { error } = await supabase().rpc('send_review_message', {
    p_order_id: orderId,
    p_body: body,
  });
  if (error) {
    logSafe('message_send_failed', error.code);
    return 'The message could not be sent.';
  }
  logSafe('message_sent');
  return null;
}
