import { expect, test, type Page } from '@playwright/test';
import {
  countEmails,
  expectNoA11yViolations,
  signIn,
  signOut,
  uniqueEmail,
  waitForAuthLink,
} from './helpers';

const PASSWORD = 'synthetic pass 2026';
const NEW_PASSWORD = 'another synthetic 2027';

async function signUp(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-up');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Create a password').fill(password);
  await page.getByLabel('Confirm your password').fill(password);
  await page.getByLabel('I confirm I am 18 or over and live in England').check();
  await page.getByLabel(/I have read the terms of service/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
}

test.describe.configure({ mode: 'serial' });

test('sign-up validation shows accessible, linked errors', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Create a password').fill('short');
  await page.getByLabel('Confirm your password').fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();

  const summary = page.getByRole('alert').filter({ hasText: 'There is a problem' });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link', { name: /correct format/ })).toHaveAttribute(
    'href',
    '#email',
  );
  await expect(summary.getByRole('link', { name: /at least 12 characters/ })).toBeVisible();
  await expect(
    summary.getByRole('link', { name: 'You must confirm you are 18 or over' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Email address')).toHaveValue('not-an-email');
  await expect(page.getByLabel('Create a password')).toHaveValue('');
  await expectNoA11yViolations(page);
});

test('register, verify email, complete profile, sign out and sign back in', async ({ page }) => {
  const email = uniqueEmail('register');
  await signUp(page, email);
  await expect(page).toHaveURL(/\/sign-up\/check-email$/);
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // Unverified accounts cannot sign in.
  await signIn(page, email, PASSWORD);
  await expect(page.getByText('You need to confirm your email address')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Send a new confirmation link' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);

  // Verify via the link captured by local Mailpit.
  const link = await waitForAuthLink(email, 'Confirm your email address');
  expect(link).toContain('type=signup');
  await page.goto(link);
  await expect(page).toHaveURL(/\/account\?notice=verified$/);
  await expect(page.getByText('Your email address is confirmed.')).toBeVisible();
  await expect(page.getByText('Email confirmed')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add your details' })).toBeVisible();
  await expectNoA11yViolations(page);

  // Links are single use.
  await page.goto(link);
  await expect(page).toHaveURL(/\/sign-in\?notice=link-invalid|\/account/);

  // Profile validation (server-side Zod) then a successful save.
  await page.goto('/account/profile');
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  const under18 = new Date();
  await page.getByLabel('Day').fill(String(under18.getDate()));
  await page.getByLabel('Month').fill(String(under18.getMonth() + 1));
  await page.getByLabel('Year').fill(String(under18.getFullYear() - 17));
  await page.getByLabel('UK phone number (optional)').fill('12345');
  await page.getByRole('button', { name: 'Save details' }).click();
  const summary = page.getByRole('alert').filter({ hasText: 'There is a problem' });
  await expect(
    summary.getByRole('link', { name: /only for adults aged 18 or over/ }),
  ).toHaveAttribute('href', '#dobDay');
  await expect(summary.getByRole('link', { name: /Enter a UK phone number/ })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel('Day').fill('10');
  await page.getByLabel('Month').fill('12');
  await page.getByLabel('Year').fill('1950');
  await page.getByLabel('UK phone number (optional)').fill('07700 900123');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Your details have been saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Year')).toHaveValue('1950');
  await expect(page.getByLabel('UK phone number (optional)')).toHaveValue('07700900123');

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Hello, Ada' })).toBeVisible();
  await expect(page.getByText('You have nothing to do right now.')).toBeVisible();

  await signOut(page);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Hello, Ada' })).toBeVisible();
});

test('password reset via emailed link', async ({ page }) => {
  const email = uniqueEmail('reset');
  await signUp(page, email);
  await page.goto(await waitForAuthLink(email, 'Confirm your email address'));
  await expect(page).toHaveURL(/\/account/);
  await signOut(page);

  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('If an account exists for that email address')).toBeVisible();

  const link = await waitForAuthLink(email, 'Reset your password');
  expect(link).toContain('type=recovery');
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/account\?notice=password-updated$/);
  await expect(page.getByText('Your password has been changed.')).toBeVisible();
  await signOut(page);

  await signIn(page, email, PASSWORD);
  await expect(page.getByText('Your email address or password is incorrect.')).toBeVisible();

  await signIn(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
});

test('password reset for an unknown email gives the same response and sends nothing', async ({
  page,
}) => {
  const email = uniqueEmail('nobody');
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('If an account exists for that email address')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await countEmails(email)).toBe(0);
});

test('signing up with an existing email does not reveal that the account exists', async ({
  page,
}) => {
  const email = uniqueEmail('dupe');
  await signUp(page, email);
  await expect(page).toHaveURL(/\/sign-up\/check-email$/);
  await signUp(page, email);
  await expect(page).toHaveURL(/\/sign-up\/check-email$/);
});

test('protected pages redirect to sign-in and return afterwards', async ({ page }) => {
  const email = uniqueEmail('next');
  await signUp(page, email);
  const link = await waitForAuthLink(email, 'Confirm your email address');
  await page.context().clearCookies();
  await page.goto(link);
  await signOut(page);

  await page.goto('/account/profile');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Fprofile$/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
});

test('sign-in ignores off-site redirect targets', async ({ page }) => {
  const email = uniqueEmail('redirect');
  await signUp(page, email);
  await page.goto(await waitForAuthLink(email, 'Confirm your email address'));
  await signOut(page);

  await signIn(page, email, PASSWORD, '//evil.example/steal');
  await expect(page).toHaveURL(/127\.0\.0\.1:3000\/account$/);
});

test('invalid or tampered verification links are rejected', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=forged&type=signup');
  await expect(page).toHaveURL(/\/sign-in\?notice=link-invalid$/);
  await expect(page.getByText('That link has expired or has already been used.')).toBeVisible();
  await page.goto('/auth/confirm?token_hash=forged&type=magiclink');
  await expect(page).toHaveURL(/\/sign-in\?notice=link-invalid$/);
});

test('repeated failed sign-ins for one email are rate limited', async ({ page }) => {
  const email = uniqueEmail('ratelimit');
  for (let i = 0; i < 10; i++) {
    await signIn(page, email, `wrong password ${i}`);
    await expect(page.getByText('Your email address or password is incorrect.')).toBeVisible();
  }
  await signIn(page, email, 'wrong password again');
  await expect(
    page.getByText('Too many attempts. Please wait 15 minutes and try again.'),
  ).toBeVisible();
});
