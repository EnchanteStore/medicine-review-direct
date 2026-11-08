import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { isAllowedOrigin } from '@/lib/origins';
import { safeNextPath } from '@/lib/safe-redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_TYPES: readonly EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change'];

/** Verifies email links (sign-up confirmation and password recovery) server-side. */
export async function GET(request: NextRequest) {
  const configured = new URL(publicEnv().NEXT_PUBLIC_SITE_URL).origin;
  const site = isAllowedOrigin(configured, process.env) ? configured : 'http://127.0.0.1:3000';
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const fallback = type === 'recovery' ? '/reset-password' : '/account?notice=verified';
    const next = safeNextPath(params.get('next'), fallback);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, site), { status: 303 });
    }
  }

  return NextResponse.redirect(new URL('/sign-in?notice=link-invalid', site), { status: 303 });
}
