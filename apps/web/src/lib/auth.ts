import 'server-only';
import type { StaffRoleGrant } from '@mrd/domain';
import type { User } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createSupabaseServerClient } from './supabase/server';

/** Current user, verified against Supabase Auth (not just the cookie). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function requireUser(nextPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Staff grants for the current user, read through RLS (users only see their own). */
export const getStaffGrants = cache(async (): Promise<StaffRoleGrant[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('staff_roles')
    .select('role, verification_status')
    .eq('user_id', user.id);
  if (error || !data) return [];
  return data.map((r) => ({ role: r.role, verificationStatus: r.verification_status }));
});

/** Best-effort client IP for rate limiting. Never logged or stored. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}
