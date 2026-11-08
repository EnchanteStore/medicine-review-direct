import { describe, expect, it } from 'vitest';
import {
  emailWillSend,
  selectEmailTransport,
  SES_ADDRESSES,
  SES_REGION,
} from '@/lib/email-transport';
import {
  authCallbackAllowlist,
  authCallbackUrl,
  DEVELOPMENT_ORIGINS,
  PRODUCTION_ORIGIN,
  STAGING_ORIGIN,
} from '@/lib/origins';
import { safeNextPath } from '@/lib/safe-redirect';
import {
  buildStripeTestCheckoutBody,
  classifyStripeSecret,
  mayCallStripeTestApi,
  stripeTestIdempotencyKey,
  stripeTestMetadataKeys,
  STRIPE_TEST_METADATA_KEYS,
} from '@/lib/stripe-mode';

const HEALTH = /paracetamol|blood pressure|symptom|questionnaire|diagnosis|date of birth|patient@/i;

describe('origins and auth callbacks', () => {
  it('keeps production, development and an explicit staging origin separate', () => {
    expect(PRODUCTION_ORIGIN).toBe('https://medsinfocus.co.uk');
    expect(DEVELOPMENT_ORIGINS).toContain('http://127.0.0.1:3000');
    expect(STAGING_ORIGIN).toBe('https://staging.medsinfocus.co.uk');
    expect(authCallbackAllowlist({})).not.toContain(STAGING_ORIGIN);
    expect(authCallbackAllowlist({ STAGING_SITE_URL: STAGING_ORIGIN })).toContain(STAGING_ORIGIN);
    expect(authCallbackAllowlist({ STAGING_SITE_URL: 'https://evil.example' })).not.toContain(
      'https://evil.example',
    );
  });

  it('builds an auth callback with no query string', () => {
    const url = authCallbackUrl('http://127.0.0.1:3000');
    expect(url).toBe('http://127.0.0.1:3000/auth/confirm');
    expect(new URL(url).search).toBe('');
    expect(authCallbackUrl('https://evil.example')).toBe('http://127.0.0.1:3000/auth/confirm');
    expect(authCallbackUrl('https://medsinfocus.co.uk')).toBe(
      'https://medsinfocus.co.uk/auth/confirm',
    );
    expect(authCallbackUrl('https://medsinfocus.co.uk/account?email=patient@example.test')).toBe(
      'http://127.0.0.1:3000/auth/confirm',
    );
  });

  it('drops query strings from the post-login path', () => {
    expect(
      safeNextPath('/account/review/abc?medicine=Paracetamol&email=patient@example.test'),
    ).toBe('/account/review/abc');
  });
});

describe('Stripe test mode', () => {
  it('refuses a live secret and does not call Stripe without a test key', () => {
    expect(classifyStripeSecret(undefined)).toBe('absent');
    expect(classifyStripeSecret('')).toBe('absent');
    expect(classifyStripeSecret('sk_live_51example')).toBe('live_refused');
    expect(classifyStripeSecret(' sk_live_51example ')).toBe('live_refused');
    expect(classifyStripeSecret('sk_test_51example')).toBe('test');
    expect(mayCallStripeTestApi(undefined)).toBe(false);
    expect(mayCallStripeTestApi('sk_live_51example')).toBe(false);
    expect(mayCallStripeTestApi('sk_test_51example')).toBe(true);
    expect(stripeTestIdempotencyKey('22222222-2222-4222-8222-222222222222')).toBe(
      'checkout_22222222-2222-4222-8222-222222222222',
    );
  });

  it('puts only the mode and order id in metadata and does not add VAT', () => {
    const body = buildStripeTestCheckoutBody({
      orderId: '22222222-2222-4222-8222-222222222222',
      amountPence: 5900,
      successOrigin: 'http://127.0.0.1:3000',
    });
    expect(stripeTestMetadataKeys(body)).toEqual([...STRIPE_TEST_METADATA_KEYS].sort());
    expect(body['metadata[checkout_mode]']).toBe('stripe_test');
    expect(body['line_items[0][price_data][unit_amount]']).toBe('5900');
    expect(body['line_items[0][price_data][currency]']).toBe('gbp');
    expect(JSON.stringify(body)).not.toMatch(HEALTH);
    expect(body.success_url).toBe(
      'http://127.0.0.1:3000/account/review/22222222-2222-4222-8222-222222222222',
    );
    expect(new URL(String(body.success_url)).search).toBe('');
  });
});

describe('email transport', () => {
  it('uses Mailpit locally and does not send when SES credentials are absent', () => {
    const local = selectEmailTransport({
      ENVIRONMENT: 'development',
      MAILPIT_URL: 'http://127.0.0.1:54324',
    });
    expect(local.kind).toBe('mailpit');
    expect(emailWillSend(local)).toBe(true);

    const absent = selectEmailTransport({ ENVIRONMENT: 'production' });
    expect(absent).toEqual({ kind: 'none', reason: 'credentials_absent' });
    expect(emailWillSend(absent)).toBe(false);
  });

  it('accepts SES only in London and only from the named addresses, and still does not send', () => {
    const wrongRegion = selectEmailTransport({
      AWS_ACCESS_KEY_ID: 'present',
      AWS_SECRET_ACCESS_KEY: 'present',
      AWS_SES_REGION: 'us-east-1',
      SES_FROM_EMAIL: SES_ADDRESSES.noreply,
    });
    expect(wrongRegion).toEqual({ kind: 'none', reason: 'region_not_london' });

    const ready = selectEmailTransport({
      AWS_ACCESS_KEY_ID: 'present',
      AWS_SECRET_ACCESS_KEY: 'present',
      AWS_SES_REGION: SES_REGION,
      SES_FROM_EMAIL: SES_ADDRESSES.hello,
    });
    expect(ready).toMatchObject({
      kind: 'ses',
      region: 'eu-west-2',
      from: SES_ADDRESSES.hello,
      send: false,
    });
    expect(emailWillSend(ready)).toBe(false);
    expect(Object.values(SES_ADDRESSES)).toEqual([
      'hello@medsinfocus.co.uk',
      'support@medsinfocus.co.uk',
      'noreply@medsinfocus.co.uk',
    ]);
  });
});
