import { DEFAULT_TRADING_NAME } from '@mrd/domain';

/** Local development identifier. Not registered with Apple or Google. */
export const APP_ID = 'uk.pharma247.pharmreview.dev';

/** Brand clearance is still blocked, so the dev app always says provisional. */
export const APP_NAME = `${DEFAULT_TRADING_NAME} (provisional)`;

export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  configured: boolean;
  preview: boolean;
}

export function publicConfig(env: Record<string, string | undefined> = process.env): PublicConfig {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  const siteUrl = (env.EXPO_PUBLIC_SITE_URL?.trim() || 'http://127.0.0.1:3000').replace(/\/$/, '');
  return {
    supabaseUrl,
    supabaseAnonKey,
    siteUrl,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    preview: env.EXPO_PUBLIC_PREVIEW === '1',
  };
}
