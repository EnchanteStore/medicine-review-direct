import AxeBuilder from '@axe-core/playwright';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const SEED_PASSWORD = 'Synthetic-Local-Only-1';
export const SEED = {
  patient: 'patient.demo@example.test',
  pharmacistVerified: 'pharmacist.verified@example.test',
  pharmacistPending: 'pharmacist.pending@example.test',
  clinicalAdmin: 'clinical.admin@example.test',
  opsAdmin: 'ops.admin@example.test',
} as const;
export const SEED_CLINICAL_ADMIN_ID = '00000000-0000-4000-a000-000000000021';

export function uniqueEmail(label: string): string {
  return `e2e.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Local-only service client, used solely to create synthetic test users. */
export function serviceClient(): SupabaseClient {
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      'E2E_SUPABASE_SERVICE_ROLE_KEY missing: run `pnpm --filter @mrd/web env:local`',
    );
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const TEST_PASSWORD = 'synthetic pass 2026';

/** Creates a confirmed synthetic patient with a completed profile. */
export async function createPatient(label: string): Promise<{ email: string; id: string }> {
  const email = uniqueEmail(label);
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { terms_version: 'draft-2026-11', adult_declaration: 'true' },
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const { error: pErr } = await admin
    .from('profiles')
    .update({ given_name: 'Synthetic', family_name: 'Patient', date_of_birth: '1952-06-01' })
    .eq('id', data.user.id);
  if (pErr) throw pErr;
  return { email, id: data.user.id };
}

export async function createStaff(
  label: string,
  role: 'ops_admin' | 'pharmacist' | 'clinical_admin',
): Promise<{ email: string; id: string }> {
  const { email, id } = await createPatient(label);
  const { error } = await serviceClient()
    .from('staff_roles')
    .insert({
      user_id: id,
      role,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: SEED_CLINICAL_ADMIN_ID,
      gphc_registration_number: role === 'pharmacist' ? '0000099' : null,
    });
  if (error) throw error;
  return { email, id };
}

/** RFC 6238 TOTP (SHA-1, 30s, 6 digits) for driving MFA enrolment in tests. */
export function totp(base32Secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32Secret.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac('sha1', bytes).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

interface MailpitSummary {
  ID: string;
  Subject: string;
  Created: string;
}

async function searchMail(query: string): Promise<MailpitSummary[]> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}&limit=5`,
  );
  if (!res.ok) return [];
  return ((await res.json()) as { messages: MailpitSummary[] }).messages;
}

export async function getMessage(
  id: string,
): Promise<{ HTML: string; Text: string; Subject: string }> {
  return (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
    HTML: string;
    Text: string;
    Subject: string;
  };
}

export async function waitForEmail(to: string, subject: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const newest = (await searchMail(`to:"${to}" subject:"${subject}"`))[0];
    if (newest) return getMessage(newest.ID);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to} within ${timeoutMs}ms`);
}

/** Polls the local Mailpit inbox for the newest email to `to` with `subject`, and returns its /auth/confirm link. */
export async function waitForAuthLink(
  to: string,
  subject: string,
  timeoutMs = 20_000,
): Promise<string> {
  const msg = await waitForEmail(to, subject, timeoutMs);
  const match = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(msg.HTML);
  if (!match) throw new Error('No confirmation link in email');
  return match[1]!.replaceAll('&amp;', '&');
}

export async function countEmails(to: string): Promise<number> {
  return (await searchMail(`to:"${to}"`)).length;
}

export async function expectNoA11yViolations(page: Page) {
  await expect(page).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary, 'axe accessibility violations').toEqual([]);
}

export async function signIn(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page.getByText('You have signed out.')).toBeVisible();
}
