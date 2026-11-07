export const STAFF_ROLES = ['pharmacist', 'clinical_admin', 'ops_admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type AppRole = 'patient' | StaffRole;

export const VERIFICATION_STATUSES = ['pending', 'verified', 'suspended', 'revoked'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface StaffRoleGrant {
  role: StaffRole;
  verificationStatus: VerificationStatus;
}

const CLINICAL_ROLES: readonly StaffRole[] = ['pharmacist', 'clinical_admin'];

/**
 * Mirrors the database helper `app.is_verified_clinician()`. The database is the
 * source of truth; this exists so UI and server code can make the same decision
 * without a round trip. Ops admins never gain clinical access through this path.
 */
export function hasClinicalAccess(grants: readonly StaffRoleGrant[]): boolean {
  return grants.some((g) => CLINICAL_ROLES.includes(g.role) && g.verificationStatus === 'verified');
}

export function hasVerifiedRole(grants: readonly StaffRoleGrant[], role: StaffRole): boolean {
  return grants.some((g) => g.role === role && g.verificationStatus === 'verified');
}

export function isStaff(grants: readonly StaffRoleGrant[]): boolean {
  return grants.some((g) => g.verificationStatus === 'verified');
}
