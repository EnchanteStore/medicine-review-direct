import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export const SEED_PASSWORD = 'Synthetic-Local-Only-1';
export const SEED = {
  patient: 'patient.demo@example.test',
  pharmacistVerified: 'pharmacist.verified@example.test',
  pharmacistPending: 'pharmacist.pending@example.test',
  clinicalAdmin: 'clinical.admin@example.test',
  opsAdmin: 'ops.admin@example.test',
} as const;

export function uniqueEmail(label: string): string {
  return `e2e.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

interface MailpitSummary {
  ID: string;
  Subject: string;
  Created: string;
}

/** Polls the local Mailpit inbox for the newest email to `to` with `subject`, and returns its /auth/confirm link. */
export async function waitForAuthLink(to: string, subject: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=5`);
    if (res.ok) {
      const body = (await res.json()) as { messages: MailpitSummary[] };
      const newest = body.messages[0];
      if (newest) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`)).json()) as {
          HTML: string;
        };
        const match = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(msg.HTML);
        if (match) return match[1]!.replaceAll('&amp;', '&');
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to} within ${timeoutMs}ms`);
}

export async function countEmails(to: string): Promise<number> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const body = (await res.json()) as { messages_count?: number; total?: number; messages: unknown[] };
  return body.messages.length;
}

export async function expectNoA11yViolations(page: Page) {
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
