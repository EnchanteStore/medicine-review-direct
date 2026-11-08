import { describe, expect, it } from 'vitest';
import { auditDetails, canReadAuditLog } from '../src';

describe('audit log access', () => {
  it('lets a verified administrator read the log and keeps a pharmacist out', () => {
    expect(canReadAuditLog([{ role: 'ops_admin', verificationStatus: 'verified' }])).toBe(true);
    expect(canReadAuditLog([{ role: 'clinical_admin', verificationStatus: 'verified' }])).toBe(
      true,
    );
    expect(canReadAuditLog([{ role: 'pharmacist', verificationStatus: 'verified' }])).toBe(false);
    expect(canReadAuditLog([{ role: 'ops_admin', verificationStatus: 'pending' }])).toBe(false);
  });
});

describe('audit details', () => {
  it('keeps identifiers and drops free text, including a medicine name', () => {
    const line = auditDetails({
      order_id: '00000000-0000-4000-b000-000000000099',
      from: 'paid',
      to: 'consultation_booked',
      reference: 'Paracetamol 500mg stop taking',
      reason: 'amount_mismatch',
      note: 'Patient should stop taking Paracetamol',
    });
    expect(line).toContain('order_id 00000000-0000-4000-b000-000000000099');
    expect(line).toContain('from paid');
    expect(line).toContain('to consultation_booked');
    expect(line).toContain('reason amount_mismatch');
    expect(line).not.toContain('Paracetamol');
    expect(line).not.toContain('stop taking');
    expect(line).not.toContain('reference');
  });

  it('drops a sentence even when the key is otherwise allowed', () => {
    expect(auditDetails({ reason: 'Please stop taking this medicine' })).toBe('');
    expect(auditDetails({ fields: ['given_name', 'Stop taking'] })).toBe('');
  });

  it('shows a price change as numbers only', () => {
    expect(auditDetails({ price_pence: { from: 7900, to: 5900 } })).toBe(
      'price_pence 7900 to 5900',
    );
  });
});
