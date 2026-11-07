import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_RULESET,
  DEFAULT_TRADING_NAME,
  LAUNCH_GATES,
  ScreeningValidationError,
  emergencyText,
  evaluateScreening,
  fullEmergencyWarning,
  placeholderText,
  resolveBusinessConfig,
  shortEmergencyWarning,
  type ScreeningAnswer,
} from '../src';
import fixture from '../src/safety/screening-test-cases.json';

function answers(overrides: Record<string, string | null | undefined>) {
  const base: Record<string, ScreeningAnswer | null> = {};
  for (const q of ACTIVE_RULESET.questions) base[q.id] = 'no';
  return { ...base, ...overrides } as Record<string, ScreeningAnswer | null>;
}

describe('safety rule set', () => {
  it('is the DRAFT version the fixture documents', () => {
    expect(ACTIVE_RULESET.version).toBe(fixture.ruleset_version);
    expect(ACTIVE_RULESET.status_note).toMatch(/^DRAFT/);
  });

  it('covers every emergency topic in the owner decision', () => {
    const emergencyIds = ACTIVE_RULESET.questions.filter((q) => q.pathway === 'emergency').map((q) => q.id);
    expect(emergencyIds).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  });

  it('has positive, negative and ambiguous documented cases', () => {
    const kinds = new Set(fixture.cases.map((c) => c.kind));
    expect(kinds).toEqual(new Set(['positive', 'negative', 'ambiguous']));
  });

  it.each(fixture.cases)('$name', (c) => {
    const result = evaluateScreening(ACTIVE_RULESET, answers(c.answers));
    expect(result.outcome).toBe(c.outcome);
    expect(result.flags).toEqual(c.flags);
  });

  it.each(fixture.invalid)('$name is rejected', (c) => {
    expect(() => evaluateScreening(ACTIVE_RULESET, answers(c.answers))).toThrow(ScreeningValidationError);
  });

  it('the generated pgTAP case file is up to date with the fixture', async () => {
    const modPath = '../scripts/generate-screening-pgtap.mjs';
    const mod = (await import(modPath)) as {
      renderPgtap: (f: unknown) => string;
      outputPath: string;
    };
    expect(readFileSync(mod.outputPath, 'utf8')).toBe(mod.renderPgtap(fixture));
  });

  it('the migration embeds the same rule set definition', () => {
    const sql = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations/20261107000300_phase2_patient_intake.sql'),
      'utf8',
    );
    const match = /\$ruleset\$(.*)\$ruleset\$/s.exec(sql);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]!)).toEqual(ACTIVE_RULESET);
  });
});

describe('emergency wording', () => {
  it('full version is the owner-approved text with the brand substituted', () => {
    expect(emergencyText(fullEmergencyWarning('PharmReview'))).toBe(
      [
        'Important: Not an emergency service.',
        'PharmReview does not provide emergency or urgent medical care and is not monitored 24 hours a day.',
        'If you have a life-threatening emergency, including severe difficulty breathing, chest pain, signs of a stroke or a severe allergic reaction, call 999 immediately.',
        'For urgent medical advice that cannot wait, contact your GP or NHS 111. Do not wait for a medication review or a response from us.',
      ].join('\n\n'),
    );
  });

  it('uses the configured brand and never implies monitoring or calling 999 for the patient', () => {
    for (const copy of [fullEmergencyWarning('AcmeRx'), shortEmergencyWarning('AcmeRx')]) {
      const text = emergencyText(copy);
      expect(text).toContain('AcmeRx');
      expect(text).not.toContain('PharmReview');
      expect(text).not.toMatch(/we will call|we'll call|we monitor/i);
      expect(text).toContain('999');
    }
  });
});

describe('business configuration', () => {
  it('defaults to the provisional PharmReview brand with every fact missing', () => {
    const c = resolveBusinessConfig({});
    expect(c.tradingName).toBe(DEFAULT_TRADING_NAME);
    expect(c.tradingNameProvisional).toBe(true);
    expect(Object.values(c.facts).every((f) => f.value === null && !f.verified)).toBe(true);
    expect(c.vatTreatmentConfirmed).toBe(false);
  });

  it('marks supplied values as unverified unless explicitly verified', () => {
    const c = resolveBusinessConfig({
      BUSINESS_COMPANY_NUMBER: '  12345678 ',
      BUSINESS_ICO_REGISTRATION_NUMBER: 'ZA000000',
      BUSINESS_ICO_REGISTRATION_NUMBER_VERIFIED: 'true',
      BRAND_TRADING_NAME: 'Other Name',
    });
    expect(c.facts.companyNumber).toMatchObject({ value: '12345678', verified: false });
    expect(c.facts.icoRegistrationNumber.verified).toBe(true);
    expect(c.tradingName).toBe('Other Name');
  });

  it('a verified flag without a value is not verified', () => {
    const c = resolveBusinessConfig({ BUSINESS_VAT_NUMBER_VERIFIED: 'true' });
    expect(c.facts.vatNumber.verified).toBe(false);
  });

  it('placeholders say clearly that the value is missing', () => {
    const c = resolveBusinessConfig({});
    expect(placeholderText(c.facts.companyNumber)).toBe(
      '[Placeholder: Company registration number not yet supplied and verified]',
    );
  });

  it('lists all ten launch gates', () => {
    expect(Object.keys(LAUNCH_GATES)).toHaveLength(10);
  });
});
