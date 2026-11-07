import 'server-only';
import { createSupabaseServerClient } from './supabase/server';

export interface Profile {
  givenName: string | null;
  familyName: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
}

export async function getOwnProfile(userId: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('given_name, family_name, date_of_birth, phone_number, phone_verified_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    givenName: data.given_name,
    familyName: data.family_name,
    dateOfBirth: data.date_of_birth,
    phoneNumber: data.phone_number,
    phoneVerified: data.phone_verified_at !== null,
  };
}

export function isProfileComplete(p: Profile | null): boolean {
  return !!p && !!p.givenName && !!p.familyName && !!p.dateOfBirth;
}
