import { Card } from '@mrd/ui';
import type { Metadata } from 'next';
import { ProfileForm } from '@/components/forms/profile-form';
import { requireUser } from '@/lib/auth';
import { splitIsoDate } from '@/lib/date-fields';
import { getOwnProfile } from '@/lib/profile';

export const metadata: Metadata = { title: 'Your details' };

function nationalFormat(e164: string | null): string {
  if (!e164) return '';
  return e164.startsWith('+44') ? `0${e164.slice(3)}` : e164;
}

export default async function ProfilePage() {
  const user = await requireUser('/account/profile');
  const profile = await getOwnProfile(user.id);
  const dob = splitIsoDate(profile?.dateOfBirth ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">Your details</h1>
        <p className="mt-2 text-ink-700">
          Your pharmacist uses these details to identify you. Your email address is{' '}
          <strong>{user.email}</strong>.
        </p>
      </div>
      <Card>
        <ProfileForm
          initial={{
            givenName: profile?.givenName ?? '',
            familyName: profile?.familyName ?? '',
            dobDay: dob.day,
            dobMonth: dob.month,
            dobYear: dob.year,
            phoneNumber: nationalFormat(profile?.phoneNumber ?? null),
          }}
        />
      </Card>
    </div>
  );
}
