/**
 * Trading name and business identity as configuration. Values are unverified
 * until supplied and checked, and the software never invents them: a missing
 * value renders as a clearly marked placeholder.
 */
export const DEFAULT_TRADING_NAME = 'PharmReview';

export const BUSINESS_FIELDS = {
  companyLegalName: { label: 'Company legal name', env: 'BUSINESS_COMPANY_LEGAL_NAME' },
  companyNumber: { label: 'Company registration number', env: 'BUSINESS_COMPANY_NUMBER' },
  registeredAddress: { label: 'Registered office address', env: 'BUSINESS_REGISTERED_ADDRESS' },
  contactEmail: { label: 'Contact email address', env: 'BUSINESS_CONTACT_EMAIL' },
  contactPhone: { label: 'Contact telephone number', env: 'BUSINESS_CONTACT_PHONE' },
  icoRegistrationNumber: {
    label: 'ICO registration number',
    env: 'BUSINESS_ICO_REGISTRATION_NUMBER',
  },
  superintendentPharmacistName: {
    label: 'Responsible pharmacist name',
    env: 'BUSINESS_RESPONSIBLE_PHARMACIST_NAME',
  },
  superintendentPharmacistGphc: {
    label: 'Responsible pharmacist GPhC registration number',
    env: 'BUSINESS_RESPONSIBLE_PHARMACIST_GPHC',
  },
  vatNumber: { label: 'VAT registration number', env: 'BUSINESS_VAT_NUMBER' },
  indemnityProvider: {
    label: 'Professional indemnity insurer',
    env: 'BUSINESS_INDEMNITY_PROVIDER',
  },
} as const;

export type BusinessFieldKey = keyof typeof BUSINESS_FIELDS;

export interface BusinessFact {
  key: BusinessFieldKey;
  label: string;
  value: string | null;
  verified: boolean;
}

export interface BusinessConfig {
  tradingName: string;
  tradingNameProvisional: boolean;
  facts: Record<BusinessFieldKey, BusinessFact>;
  /** Accountant confirmation of VAT exemption; until then no VAT is added. */
  vatTreatmentConfirmed: boolean;
}

type Env = Record<string, string | undefined>;

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function resolveBusinessConfig(env: Env): BusinessConfig {
  const facts = {} as Record<BusinessFieldKey, BusinessFact>;
  for (const key of Object.keys(BUSINESS_FIELDS) as BusinessFieldKey[]) {
    const def = BUSINESS_FIELDS[key];
    const value = clean(env[def.env]);
    facts[key] = {
      key,
      label: def.label,
      value,
      verified: value !== null && env[`${def.env}_VERIFIED`] === 'true',
    };
  }
  return {
    tradingName: clean(env.BRAND_TRADING_NAME) ?? DEFAULT_TRADING_NAME,
    tradingNameProvisional: env.BRAND_TRADING_NAME_CLEARED !== 'true',
    facts,
    vatTreatmentConfirmed: env.BUSINESS_VAT_TREATMENT_CONFIRMED === 'true',
  };
}

export function placeholderText(fact: BusinessFact): string {
  return `[Placeholder: ${fact.label} not yet supplied and verified]`;
}
