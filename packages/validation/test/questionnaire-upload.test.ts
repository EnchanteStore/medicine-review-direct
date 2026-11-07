import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  concernsStepSchema,
  isEmptyMedication,
  medicationSchema,
  questionnaireSubmissionSchema,
  safeFilename,
  toFieldErrors,
} from '../src';

const med = { name: 'Synthetic medicine A' };

describe('questionnaire schemas', () => {
  it('accepts a minimal valid submission', () => {
    const r = questionnaireSubmissionSchema.parse({
      answers: { mainConcern: 'Too many tablets', consultationMethod: 'secure_video' },
      medications: [med],
    });
    expect(r.medications[0]?.dontKnow).toEqual([]);
    expect(r.answers.conditions).toBe('');
  });

  it('requires at least one medicine and a main concern', () => {
    const r = questionnaireSubmissionSchema.safeParse({
      answers: { mainConcern: '  ', consultationMethod: 'telephone' },
      medications: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = toFieldErrors(r.error);
      expect(e.medications?.[0]).toBe('Add at least one medicine');
      expect(e['answers.mainConcern']).toBeDefined();
    }
  });

  it('caps the number of medicines', () => {
    const r = questionnaireSubmissionSchema.safeParse({
      answers: { mainConcern: 'x', consultationMethod: 'telephone' },
      medications: Array.from({ length: 51 }, () => med),
    });
    expect(r.success).toBe(false);
  });

  it('offers telephone or secure video consultations', () => {
    expect(
      concernsStepSchema.safeParse({ mainConcern: 'x', consultationMethod: 'secure_video' })
        .success,
    ).toBe(true);
    expect(
      concernsStepSchema.safeParse({ mainConcern: 'x', consultationMethod: 'in_person' }).success,
    ).toBe(false);
  });

  it('records "don\'t know" per medicine field', () => {
    const r = medicationSchema.parse({ name: 'X', dontKnow: ['dose', 'indication'] });
    expect(r.dontKnow).toEqual(['dose', 'indication']);
    expect(medicationSchema.safeParse({ name: 'X', dontKnow: ['name'] }).success).toBe(false);
  });

  it('detects empty draft rows', () => {
    expect(isEmptyMedication({ name: ' ' })).toBe(true);
    expect(isEmptyMedication({ name: '', dose: '1 daily' })).toBe(false);
    expect(isEmptyMedication({ name: '', dontKnow: ['dose'] })).toBe(false);
  });
});

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('upload checks', () => {
  it('accepts a real PDF and PNG', () => {
    expect(
      checkUpload({ name: 'list.pdf', type: 'application/pdf', size: 100, head: PDF }).ok,
    ).toBe(true);
    expect(checkUpload({ name: 'photo.png', type: 'image/png', size: 100, head: PNG }).ok).toBe(
      true,
    );
  });

  it('rejects disguised, oversized, empty and unsupported files', () => {
    expect(
      checkUpload({ name: 'evil.pdf', type: 'application/pdf', size: 100, head: PNG }).ok,
    ).toBe(false);
    expect(
      checkUpload({
        name: 'big.pdf',
        type: 'application/pdf',
        size: MAX_UPLOAD_BYTES + 1,
        head: PDF,
      }).ok,
    ).toBe(false);
    expect(checkUpload({ name: 'empty.pdf', type: 'application/pdf', size: 0, head: PDF }).ok).toBe(
      false,
    );
    expect(
      checkUpload({ name: 'a.exe', type: 'application/x-msdownload', size: 100, head: PDF }).ok,
    ).toBe(false);
  });

  it('sanitises filenames', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\me\\My List (2).pdf')).toBe('My List 2.pdf');
    expect(safeFilename('<script>.pdf')).toBe('script.pdf');
    expect(safeFilename('...')).toBe('document');
  });
});
