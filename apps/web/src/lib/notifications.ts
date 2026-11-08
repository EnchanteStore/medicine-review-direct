import 'server-only';
import { emailWillSend, selectEmailTransport } from './email-transport';
import {
  accountUpdateEmail,
  appointmentUpdateEmail,
  type Notification,
} from './notification-templates';
import { getServiceStatus } from './service-status';
import { brandName } from './site';

export interface NotificationTransport {
  name: string;
  send(to: string, n: Notification): Promise<void>;
}

/** Development transport: delivers to the local Mailpit inbox only. */
function mailpitTransport(baseUrl: string): NotificationTransport {
  return {
    name: 'mailpit',
    async send(to, n) {
      const res = await fetch(`${baseUrl}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: 'no-reply@example.test', Name: n.fromName },
          To: [{ Email: to }],
          Subject: n.subject,
          Text: n.text,
        }),
      });
      if (!res.ok) throw new Error(`mailpit ${res.status}`);
    },
  };
}

/**
 * Mailpit is the only transport that sends. SES London is selected by config
 * but is not called: without credentials, or without SES_SEND_ENABLED, nothing
 * leaves the machine.
 */
async function transport(): Promise<NotificationTransport | null> {
  const status = await getServiceStatus();
  const selected = selectEmailTransport({
    MAILPIT_URL: process.env.MAILPIT_URL,
    ENVIRONMENT: status.environment,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
    SES_SEND_ENABLED: process.env.SES_SEND_ENABLED,
  });
  if (selected.kind === 'mailpit') return mailpitTransport(selected.url);
  if (selected.kind === 'ses' && emailWillSend(selected)) {
    console.error('[notify] SES London is not called from this preparation');
  }
  return null;
}

export async function notifyAppointmentUpdate(to: string): Promise<void> {
  try {
    const t = await transport();
    if (!t) return;
    await t.send(to, appointmentUpdateEmail(brandName()));
  } catch {
    console.error('[notify] appointment update failed');
  }
}

export async function notifyAccountUpdate(to: string): Promise<void> {
  try {
    const t = await transport();
    if (!t) return;
    await t.send(to, accountUpdateEmail(brandName()));
  } catch {
    console.error('[notify] account update failed');
  }
}
