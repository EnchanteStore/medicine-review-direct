import { isStaff } from '@mrd/domain';
import { Badge, Container } from '@mrd/ui';
import { notFound } from 'next/navigation';
import { getStaffGrants, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Staff area. Requires at least one verified staff role, checked server-side
 * on every request. Non-staff get a 404 so the area is not advertised.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/staff');
  const grants = await getStaffGrants();
  if (!isStaff(grants)) notFound();

  return (
    <div className="bg-white">
      <div className="border-b border-sand-200 bg-ink-900 text-white">
        <Container className="flex items-center gap-3 py-3">
          <span className="font-semibold">Staff area</span>
          <Badge tone="neutral">Internal</Badge>
        </Container>
      </div>
      <Container className="py-10">{children}</Container>
    </div>
  );
}
