import 'server-only';
import { accountUpdateEmail, type Notification } from './notification-templates';
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
 * Picks a transport. Only Mailpit exists. Production email (AWS SES London)
 * is not implemented, so nothing is ever sent outside development.
 */
async function transport(): Promise<NotificationTransport | null> {
  const status = await getServiceStatus();
  const mailpit = process.env.MAILPIT_URL;
  if (
    status.environment === 'development' &&
    mailpit &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(mailpit)
  ) {
    return mailpitTransport(mailpit);
  }
  return null;
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
