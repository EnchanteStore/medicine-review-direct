import { MESSAGING_OUT_OF_HOURS_WARNING, isVisibleToPatient } from '@mrd/domain';
import { describe, expect, it } from 'vitest';
import { createChunkedStorage, memoryStore } from '../src/chunked-storage';
import { APP_ID, APP_NAME, publicConfig } from '../src/config';
import { logSafe } from '../src/log';
import { homeActions, reportView, websiteReviewUrl } from '../src/model';
import { previewHiddenReport, previewReleasedReport } from '../src/preview-data';

const releasedContent = {
  findings: 'Discuss the indication with the GP.',
  medicationIssues: [{ medicine: 'Paracetamol', issue: 'Unsure why it was started.' }],
  recommendations: ['Ask the GP whether it is still needed.'],
  monitoring: ['Review pain at the next appointment.'],
  gpDiscussionPoints: ['Indication for long-term use.'],
  safetyAdvice: 'Call 999 in an emergency.',
  limitations:
    'DRAFT pending clinical approval. This review is for discussion with the prescriber.',
};

const baseReport = {
  content: releasedContent,
  patientName: 'Synthetic Patient',
  dateOfBirth: '1 June 1952',
  reviewDate: '7 November 2026',
  consultationMethod: 'Telephone',
  consultationWhen: '6 November 2026',
  consultationNotes: 'Notes',
  pharmacistName: 'Asha Synthetic',
  gphcNumber: '0000099',
  medicines: ['Paracetamol'],
  concerns: 'Why am I on this medicine?',
  documentsReviewed: [],
};

describe('mobile review model', () => {
  it('hides every status that is not an explicit release', () => {
    for (const status of [
      'draft',
      'clinically_approved',
      'generating',
      'generation_failed',
      'ready_for_release',
    ] as const) {
      expect(isVisibleToPatient(status)).toBe(false);
      expect(reportView({ ...baseReport, status }).visible).toBe(false);
    }
    const released = reportView({ ...baseReport, status: 'released' });
    expect(released.visible).toBe(true);
    if (released.visible) {
      expect(released.sections.map((section) => section.title)).toContain('Key findings');
      expect(released.sections.map((section) => section.title)).toContain(
        'Limitations and disclaimer',
      );
    }
  });

  it('does not render draft content even when the draft is complete', () => {
    const hidden = previewHiddenReport();
    expect(hidden.visible).toBe(false);
    if (!hidden.visible) expect(hidden.message).toMatch(/Drafts are not shown/);
    expect(JSON.stringify(hidden)).not.toContain('Paracetamol');
  });

  it('shows a released preview through the same section builder as the website', () => {
    const view = previewReleasedReport();
    expect(view.visible).toBe(true);
    if (view.visible)
      expect(
        view.sections.some((section) => section.body.includes('DRAFT pending clinical approval')),
      ).toBe(true);
  });

  it('sends payment and booking to the website and does not invent a card form', () => {
    const view = homeActions({
      siteUrl: 'http://127.0.0.1:3000/',
      orderId: '00000000-0000-4000-b000-000000000099',
      status: 'awaiting_payment',
      hasAppointment: false,
    });
    expect(view.links.map((link) => link.url)).toEqual([
      'http://127.0.0.1:3000/account/review/00000000-0000-4000-b000-000000000099/pay',
    ]);
    expect(view.summary).toMatch(/does not take a card payment/);
    expect(websiteReviewUrl('http://127.0.0.1:3000', 'abc', '/book')).toBe(
      'http://127.0.0.1:3000/account/review/abc/book',
    );
  });

  it('offers documents only during intake and keeps the out-of-hours warning text from the domain', () => {
    const intake = homeActions({
      siteUrl: 'http://127.0.0.1:3000',
      orderId: 'abc',
      status: 'intake',
      hasAppointment: false,
    });
    expect(intake.actions.some((action) => action.id === 'documents')).toBe(true);
    const reviewing = homeActions({
      siteUrl: 'http://127.0.0.1:3000',
      orderId: 'abc',
      status: 'in_review',
      hasAppointment: false,
    });
    expect(reviewing.actions.some((action) => action.id === 'documents')).toBe(false);
    expect(MESSAGING_OUT_OF_HOURS_WARNING).toMatch(/not an emergency service/i);
  });
});

describe('session storage and logs', () => {
  it('round-trips a session larger than one secure-store item and then deletes it', async () => {
    const storage = createChunkedStorage(memoryStore(), 50);
    const token = `header.${'a'.repeat(180)}.signature`;
    await storage.setItem('sb-auth', token);
    expect(await storage.getItem('sb-auth')).toBe(token);
    await storage.removeItem('sb-auth');
    expect(await storage.getItem('sb-auth')).toBeNull();
  });

  it('logs an event code and drops an email or a medicine name', () => {
    const lines: string[] = [];
    const original = console.warn;
    console.warn = (line?: unknown) => {
      if (typeof line === 'string') lines.push(line);
    };
    logSafe('sign_in_failed', 'invalid_credentials');
    logSafe('patient@example.test Paracetamol', 'stop taking');
    console.warn = original;
    expect(lines).toEqual(['[mrd] sign_in_failed invalid_credentials', '[mrd] ignored_log']);
    expect(lines.join(' ')).not.toContain('Paracetamol');
    expect(lines.join(' ')).not.toContain('@');
  });

  it('uses the local dev application id and a provisional name', () => {
    expect(APP_ID).toBe('uk.pharma247.pharmreview.dev');
    expect(APP_NAME).toContain('provisional');
    expect(publicConfig({ EXPO_PUBLIC_PREVIEW: '1' }).preview).toBe(true);
    expect(publicConfig({}).configured).toBe(false);
  });
});
