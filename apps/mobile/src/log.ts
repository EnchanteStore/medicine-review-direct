const EVENTS = new Set([
  'sign_in',
  'sign_in_failed',
  'sign_out',
  'sign_out_failed',
  'session.read_failed',
  'session.write_failed',
  'session.clear_failed',
  'review_read_failed',
  'messages_read_failed',
  'message_send_failed',
  'message_sent',
  'upload_failed',
  'register_document_failed',
  'document_uploaded',
]);

/**
 * Operational log. Unknown events are dropped so a message body, email or
 * medicine name cannot be written by accident.
 */
export function logSafe(event: string, code?: string): void {
  if (!EVENTS.has(event)) {
    console.warn('[mrd] ignored_log');
    return;
  }
  const safeCode = code && /^[a-z0-9._-]{1,40}$/i.test(code) ? code : undefined;
  if (safeCode) console.warn(`[mrd] ${event} ${safeCode}`);
  else console.warn(`[mrd] ${event}`);
}
