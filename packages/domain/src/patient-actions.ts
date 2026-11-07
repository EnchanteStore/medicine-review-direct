import type { OrderStatus } from './order-lifecycle';

/**
 * Mirrors `public.register_document`: a patient can add a file only during
 * intake or while the questionnaire is submitted and not yet paid. The
 * database is authoritative. This is not a malware scan.
 */
export const PATIENT_DOCUMENT_UPLOAD_STATUSES = ['intake', 'questionnaire_submitted'] as const;

export function canPatientUploadDocument(status: OrderStatus): boolean {
  return (PATIENT_DOCUMENT_UPLOAD_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * Mirrors `public.send_review_message`. Emergency-excluded reviews stay closed
 * so the app is not used instead of calling 999.
 */
const MESSAGE_CLOSED: readonly OrderStatus[] = [
  'draft',
  'safety_emergency_excluded',
  'cancelled',
  'refunded',
];

export function canPatientMessage(status: OrderStatus): boolean {
  return !MESSAGE_CLOSED.includes(status);
}
