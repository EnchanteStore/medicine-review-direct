import { InvalidTransitionError, canTransition, type TransitionMap } from './state-machine';

export const REPORT_STATUSES = [
  'draft',
  'clinically_approved',
  'generating',
  'generation_failed',
  'ready_for_release',
  'released',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_TRANSITIONS: TransitionMap<ReportStatus> = {
  draft: ['clinically_approved'],
  // Returning to draft voids the approval; a new approval is required.
  clinically_approved: ['generating', 'draft'],
  generating: ['ready_for_release', 'generation_failed'],
  generation_failed: ['generating', 'draft'],
  ready_for_release: ['released', 'draft'],
  // Corrections after release create a new report version rather than editing this one.
  released: [],
};

/**
 * Section 8 release gate (owner decision, 7 Nov 2026). Mirrors
 * `app.report_gate_blockers` in the database, which is authoritative.
 * A questionnaire, AI draft, payment or booked appointment never
 * independently authorises release.
 */
export interface ReleaseContext {
  screeningCleared: boolean;
  eligibilityConfirmed: boolean;
  questionnaireSubmitted: boolean;
  informationSufficientConfirmed: boolean;
  consultation: null | { twoWayCompleted: boolean; method: 'telephone' | 'secure_video'; hasNotes: boolean };
  clinicalAdequacyConfirmed: boolean;
  approvedWithProfessionalId: boolean;
  serviceDeclinedOrExcluded: boolean;
  orderInReview: boolean;
  /** The assigned, verified pharmacist acting in an MFA session. */
  actorIsAssignedVerifiedPharmacist: boolean;
}

export class ReportReleaseBlockedError extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(`Report release blocked: ${reasons.join('; ')}`);
    this.name = 'ReportReleaseBlockedError';
  }
}

export function approvalBlockers(ctx: ReleaseContext): string[] {
  const r: string[] = [];
  if (!ctx.screeningCleared) r.push('safety_screening_not_cleared');
  if (!ctx.eligibilityConfirmed) r.push('eligibility_profile_incomplete');
  if (!ctx.questionnaireSubmitted) r.push('no_submitted_questionnaire');
  if (!ctx.informationSufficientConfirmed) r.push('clinical_information_not_confirmed_sufficient');
  if (!ctx.consultation) r.push('no_consultation_recorded');
  else if (!ctx.consultation.twoWayCompleted) r.push('consultation_not_two_way_completed');
  else if (!ctx.consultation.hasNotes) r.push('consultation_notes_missing');
  if (!ctx.clinicalAdequacyConfirmed) r.push('clinical_adequacy_not_confirmed');
  if (ctx.serviceDeclinedOrExcluded) r.push('service_declined_or_excluded');
  if (!ctx.actorIsAssignedVerifiedPharmacist) r.push('actor_not_assigned_verified_pharmacist');
  return r;
}

export function releaseBlockers(ctx: ReleaseContext): string[] {
  const r = approvalBlockers(ctx);
  if (!ctx.approvedWithProfessionalId) r.push('report_not_approved_with_professional_identification');
  if (!ctx.orderInReview) r.push('order_not_in_review');
  return r;
}

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return canTransition(REPORT_TRANSITIONS, from, to);
}

export function assertReportTransition(from: ReportStatus, to: ReportStatus, ctx?: ReleaseContext): void {
  if (!canTransitionReport(from, to)) {
    throw new InvalidTransitionError('report', from, to);
  }
  if (to === 'clinically_approved' || to === 'released') {
    if (!ctx) throw new ReportReleaseBlockedError(['gate context missing']);
    const reasons = to === 'released' ? releaseBlockers(ctx) : approvalBlockers(ctx);
    if (reasons.length > 0) throw new ReportReleaseBlockedError(reasons);
  }
}

export function isVisibleToPatient(status: ReportStatus): boolean {
  return status === 'released';
}
