import { describe, expect, it } from 'vitest';
import {
  BRAND_SEO_TITLE,
  BRAND_TAGLINE,
  COMPANY_FOOTER,
  DEFAULT_TRADING_NAME,
  HANDOVER_REASONS,
  PRESCRIBING_ENABLED,
  PUBLIC_PHARMACISTS,
  scanMayMarkClean,
} from '../src';

describe('MedsInFocus brand', () => {
  it('uses the owner spelling and does not invent a prescribing claim', () => {
    expect(DEFAULT_TRADING_NAME).toBe('MedsInFocus');
    expect(BRAND_TAGLINE).toBe('Your medicines. A clearer picture.');
    expect(BRAND_SEO_TITLE).toBe('MedsInFocus | Private Pharmacist Medication Reviews UK');
    expect(COMPANY_FOOTER).toContain('PHARMA247 LTD');
    expect(COMPANY_FOOTER).toContain('17365383');
    expect(PUBLIC_PHARMACISTS.map((p) => p.name)).toEqual(['Cheuk Kin Sung', 'Ka Po Ng']);
    expect(PUBLIC_PHARMACISTS.map((p) => p.gphc)).toEqual(['2234388', '2235658']);
    expect(JSON.stringify(PUBLIC_PHARMACISTS)).not.toMatch(/independent prescriber/i);
    expect(PRESCRIBING_ENABLED).toBe(false);
    expect(HANDOVER_REASONS).toEqual(['patient_request', 'availability', 'clinical_cover']);
  });

  it('marks a file clean only when ClamAV accepts it', () => {
    expect(scanMayMarkClean('clamav', 'clean')).toBe(true);
    expect(scanMayMarkClean('clamav', 'rejected')).toBe(false);
    expect(scanMayMarkClean('not_run', 'skipped')).toBe(false);
    expect(scanMayMarkClean('stub-not-scanned', 'clean')).toBe(false);
    expect(scanMayMarkClean('clamav', 'clean ')).toBe(false);
  });
});
