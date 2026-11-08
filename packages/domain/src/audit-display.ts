const ALLOWED_KEYS = new Set([
  'user_id',
  'patient_id',
  'order_id',
  'pharmacist_id',
  'payment_id',
  'approved_by',
  'type',
  'role',
  'status',
  'from',
  'to',
  'outcome',
  'kind',
  'method',
  'provider',
  'source',
  'reason',
  'gate',
  'decision',
  'category',
  'period',
  'ruleset_version',
  'mime_type',
  'version_no',
  'amends',
  'amount_pence',
  'size_bytes',
  'drafts_deleted',
  'documents_pending_storage_purge',
  'routine_screenings_retained',
  'two_way_completed',
  'released',
  'transmitted',
  'sent_to_provider',
  'fields',
  'price_pence',
  'standard_price_pence',
  'is_active',
]);

/** Identifiers, flags and short codes. A sentence or a medicine name does not match. */
function safeToken(value: string): string | null {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  if (/^\d+ (day|days|month|months|year|years)$/.test(value)) return value;
  if (/^[a-z0-9_./:-]{1,80}$/.test(value)) return value;
  return null;
}

function renderValue(value: unknown): string | null {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return safeToken(value);
  if (Array.isArray(value)) {
    const items = value.flatMap((item) =>
      typeof item === 'string' && /^[a-z0-9_]+$/.test(item) ? [item] : [],
    );
    return items.length === value.length && items.length > 0 ? items.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const from = renderValue(record.from);
    const to = renderValue(record.to);
    if (from && to && Object.keys(record).every((key) => key === 'from' || key === 'to')) {
      return `${from} to ${to}`;
    }
  }
  return null;
}

/**
 * Turns audit metadata into a short staff-facing line. Unknown keys are
 * dropped, including a payment reference or any free text, so a later mistake
 * cannot show a medicine name or a message on this screen.
 */
export function auditDetails(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    const rendered = renderValue(value);
    if (rendered) parts.push(`${key} ${rendered}`);
  }
  return parts.join('; ');
}
