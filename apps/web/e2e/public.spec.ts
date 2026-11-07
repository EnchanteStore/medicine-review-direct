import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const PAGES = [
  { path: '/', h1: 'A private review of your medicines with a UK pharmacist' },
  { path: '/how-it-works', h1: 'How it works' },
  { path: '/pricing', h1: 'Pricing' },
  { path: '/about', h1: 'About us' },
  { path: '/faq', h1: 'Frequently asked questions' },
  {
    path: '/clinical-safety',
    h1: 'Clinical Service and Safety Information',
    legal: true,
    full: true,
  },
  { path: '/privacy', h1: 'Privacy Notice', legal: true },
  { path: '/terms', h1: 'Terms of Service', legal: true },
  { path: '/refunds', h1: 'Cancellation and Refund Policy', legal: true },
  { path: '/complaints', h1: 'Complaints and Contact Information', legal: true, full: true },
  { path: '/sign-up', h1: 'Create an account' },
  { path: '/sign-in', h1: 'Sign in' },
  { path: '/forgot-password', h1: 'Reset your password' },
];

for (const p of PAGES) {
  test(`${p.path} renders, shows emergency advice and has no axe violations`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    const banner = page.getByTestId('emergency-banner-short');
    await expect(banner).toContainText('Important: Not an emergency service.');
    await expect(banner).toContainText('PharmReview');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    if (p.legal) {
      await expect(page.getByText('Placeholder', { exact: true })).toBeVisible();
      await expect(page.getByTestId('placeholder').first()).toBeVisible();
    }
    if (p.full) {
      await expect(page.getByTestId('emergency-warning-full')).toContainText(
        'PharmReview does not provide emergency or urgent medical care and is not monitored 24 hours a day.',
      );
    }
    await expectNoA11yViolations(page);
  });
}

test('pricing shows the server-controlled launch price', async ({ page }) => {
  await page.goto('/pricing');
  const price = page.getByTestId('price-standard_review');
  await expect(price).toContainText('£59');
  await expect(price).toContainText('£79');
  await expect(page.getByTestId('payments-disabled')).toBeVisible();
  await expect(page.getByText('We do not add VAT to this price.')).toBeVisible();
});

test('unknown pages return a helpful 404', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('skip link moves focus to main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('security headers are set', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-powered-by']).toBeUndefined();
});

test('navigation works on all viewports', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.locator('summary', { hasText: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Main (mobile)' })
      .getByRole('link', { name: 'Pricing' })
      .click();
  } else {
    await page
      .getByRole('navigation', { name: 'Main', exact: true })
      .getByRole('link', { name: 'Pricing' })
      .click();
  }
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pricing');
});

test('the old contact page redirects to complaints and contact information', async ({ page }) => {
  await page.goto('/contact');
  await expect(page).toHaveURL(/\/complaints#contact$/);
});

test('legal pages never invent company, ICO, GPhC or VAT details', async ({ page }) => {
  await page.goto('/terms');
  for (const label of [
    'Company legal name',
    'Company registration number',
    'Registered office address',
    'ICO registration number',
    'VAT registration number',
    'Responsible pharmacist GPhC registration number',
    'Professional indemnity insurer',
  ]) {
    await expect(
      page.getByText(`[Placeholder: ${label} not yet supplied and verified]`).first(),
    ).toBeVisible();
  }
  await expect(page.getByText('Provisional, pending name and trade mark clearance')).toBeVisible();
});

test('a development preview notice is shown while the live service is not approved', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('service-notice')).toContainText('Development preview');
});
