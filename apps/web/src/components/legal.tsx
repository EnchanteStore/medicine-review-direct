import { placeholderText, type BusinessFieldKey } from '@mrd/domain';
import { Alert, Badge } from '@mrd/ui';
import { getBusinessConfig } from '@/lib/site';

/** A business fact from configuration, or a clearly marked placeholder. Never invented. */
export function Fact({ k }: { k: BusinessFieldKey }) {
  const fact = getBusinessConfig().facts[k];
  if (!fact.value) {
    return (
      <mark
        className="rounded bg-warning-50 px-1 font-semibold text-warning-800"
        data-testid="placeholder"
      >
        {placeholderText(fact)}
      </mark>
    );
  }
  return (
    <>
      {fact.value}
      {fact.verified ? null : (
        <Badge tone="warning" className="ml-2">
          Unverified
        </Badge>
      )}
    </>
  );
}

/** Wording that needs professional (legal, clinical or regulatory) input before launch. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark
      className="rounded bg-warning-50 px-1 font-semibold text-warning-800"
      data-testid="placeholder"
    >
      [Placeholder: {children}]
    </mark>
  );
}

export function LegalNotice({ reviewer = 'legal' }: { reviewer?: 'legal' | 'clinical' }) {
  return (
    <Alert tone="warning" className="my-6">
      <p>
        <Badge tone="draft" className="mr-2">
          Placeholder
        </Badge>
        {reviewer === 'clinical'
          ? 'This page has not been approved by the responsible pharmacist or reviewed by a regulatory adviser. It must not be relied on.'
          : 'This page has not been reviewed by a solicitor or approved. It does not form part of any agreement and must not be relied on.'}
      </p>
    </Alert>
  );
}

export function CompanyIdentity() {
  const config = getBusinessConfig();
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[16rem_1fr]">
      <dt className="font-semibold">Trading name</dt>
      <dd>
        {config.tradingName}
        {config.tradingNameProvisional ? (
          <Badge tone="warning" className="ml-2">
            Provisional, pending name and trade mark clearance
          </Badge>
        ) : null}
      </dd>
      <dt className="font-semibold">Company legal name</dt>
      <dd>
        <Fact k="companyLegalName" />
      </dd>
      <dt className="font-semibold">Company number</dt>
      <dd>
        <Fact k="companyNumber" />
      </dd>
      <dt className="font-semibold">Registered office</dt>
      <dd>
        <Fact k="registeredAddress" />
      </dd>
      <dt className="font-semibold">ICO registration</dt>
      <dd>
        <Fact k="icoRegistrationNumber" />
      </dd>
      <dt className="font-semibold">VAT number</dt>
      <dd>
        <Fact k="vatNumber" />
      </dd>
    </dl>
  );
}

export function PharmacistRegistration() {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[16rem_1fr]">
      <dt className="font-semibold">Responsible pharmacist</dt>
      <dd>
        <Fact k="superintendentPharmacistName" />
      </dd>
      <dt className="font-semibold">GPhC registration number</dt>
      <dd>
        <Fact k="superintendentPharmacistGphc" />
      </dd>
      <dt className="font-semibold">Professional indemnity</dt>
      <dd>
        <Fact k="indemnityProvider" />
      </dd>
    </dl>
  );
}

export function ContactDetails() {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[16rem_1fr]">
      <dt className="font-semibold">Email</dt>
      <dd>
        <Fact k="contactEmail" />
      </dd>
      <dt className="font-semibold">Telephone</dt>
      <dd>
        <Fact k="contactPhone" />
      </dd>
      <dt className="font-semibold">Post</dt>
      <dd>
        <Fact k="registeredAddress" />
      </dd>
    </dl>
  );
}
