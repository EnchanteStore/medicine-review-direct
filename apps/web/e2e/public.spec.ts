import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const PAGES = [
  { path: '/', h1: 'A private review of your medicines with a UK pharmacist' },
  { path: '/how-it-works', h1: 'How it works' },
  { path: '/pricing', h1: 'Pricing' },
  { path: '/about', h1: 'About us' },
  { path: '/faq', h1: 'Frequently asked questions' },
  { path: '/contact', h1: 'Contact us' },
  { path: '/clinical-safety', h1: 'Clinical safety', draft: true },
  { path: '/privacy', h1: 'Privacy notice', draft: true },
  { path: '/terms', h1: 'Terms of service', draft: true },
  { path: '/refunds', h1: 'Refunds and cancellations', draft: true },
  { path: '/complaints', h1: 'Complaints', draft: true },
  { path: '/sign-up', h1: 'Create an account' },
  { path: '/sign-in', h1: 'Sign in' },
  { path: '/forgot-password', h1: 'Reset your password' },
];

for (const p of PAGES) {
  test(`${p.path} renders, shows emergency advice and has no axe violations`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    await expect(page.getByText('Not for emergencies.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    if (p.draft) {
      await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    }
    await expectNoA11yViolations(page);
  });
}

test('pricing shows the server-controlled launch price', async ({ page }) => {
  await page.goto('/pricing');
  const price = page.getByTestId('price-standard_review');
  await expect(price).toContainText('£59');
  await expect(price).toContainText('£79');
  await expect(page.getByText('Online booking is not open yet')).toBeVisible();
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
