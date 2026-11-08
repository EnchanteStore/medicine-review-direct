/**
 * Patient-facing MedsInFocus copy from the 8 Nov 2026 owner spec.
 * This is a product-design approval, not clinical, legal or regulatory sign-off.
 * Trade mark clearance is still pending.
 */
export const BRAND_TAGLINE = 'Your medicines. A clearer picture.';

export const BRAND_SUPPORTING = 'Personalised medication reviews with UK-registered pharmacists.';

export const BRAND_LONGER =
  'MedsInFocus provides private, pharmacist-led medication reviews to help you better understand your medicines, identify potential medication-related concerns and make informed decisions about your treatment.';

export const BRAND_HERO_SUPPORT =
  'Get personalised advice from a UK-registered pharmacist through a comprehensive medication review designed around your needs.';

export const BRAND_SEO_TITLE = 'MedsInFocus | Private Pharmacist Medication Reviews UK';

export const BRAND_SEO_DESCRIPTION =
  'Understand your medicines with a personalised medication review from a UK-registered pharmacist. Private consultations and clear, practical advice.';

export const CANONICAL_ORIGIN = 'https://medsinfocus.co.uk';

export const COMPANY_FOOTER =
  'MedsInFocus is a trading name of PHARMA247 LTD, registered in England and Wales. Company number 17365383.';

export const HOW_IT_WORKS = [
  'Tell us about your medicines.',
  'Speak with your pharmacist (telephone or secure video).',
  'Receive your personalised report, prepared and approved by your pharmacist.',
  'Understand your next steps and discuss changes with your existing prescriber.',
] as const;

export interface PublicPharmacist {
  name: string;
  role: string;
  gphc: string;
  detail: string;
}

/** No biographies are invented. Prescribing credentials are not shown. */
export const PUBLIC_PHARMACISTS: readonly PublicPharmacist[] = [
  {
    name: 'Cheuk Kin Sung',
    role: 'Lead Pharmacist',
    gphc: '2234388',
    detail: 'Director of PHARMA247 LTD. Initial clinical lead. Live GPhC register check pending.',
  },
  {
    name: 'Ka Po Ng',
    role: 'Pharmacist',
    gphc: '2235658',
    detail: 'Live GPhC register check pending.',
  },
];

export const HANDOVER_REASONS = ['patient_request', 'availability', 'clinical_cover'] as const;
export type HandoverReason = (typeof HANDOVER_REASONS)[number];

/** Prescribing stays off. The database rejects any attempt to turn the flag on. */
export const PRESCRIBING_ENABLED = false;

/** A file is clean only when ClamAV itself accepts it. Anything else stays unsafe. */
export function scanMayMarkClean(engine: string, verdict: string): boolean {
  return engine === 'clamav' && verdict === 'clean';
}
