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

export interface ReleaseContext {
  orderPaid: boolean;
  consultationRecorded: boolean;
  /** Must be the pharmacist performing the release, distinct from automated processes. */
  releasedByVerifiedPharmacist: boolean;
}

export class ReportReleaseBlockedError extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(`Report release blocked: ${reasons.join('; ')}`);
    this.name = 'ReportReleaseBlockedError';
  }
}

export function releaseBlockers(ctx: ReleaseContext): string[] {
  const reasons: string[] = [];
  if (!ctx.orderPaid) reasons.push('order is not paid');
  if (!ctx.consultationRecorded) reasons.push('consultation has not been recorded');
  if (!ctx.releasedByVerifiedPharmacist) reasons.push('release must be performed by a verified pharmacist');
  return reasons;
}

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return canTransition(REPORT_TRANSITIONS, from, to);
}

/**
 * Validates a report transition. Release additionally requires a paid order,
 * a recorded consultation and an explicit pharmacist action; reports are never
 * made visible to patients automatically.
 */
export function assertReportTransition(
  from: ReportStatus,
  to: ReportStatus,
  ctx?: ReleaseContext,
): void {
  if (!canTransitionReport(from, to)) {
    throw new InvalidTransitionError('report', from, to);
  }
  if (to === 'released') {
    if (!ctx) throw new ReportReleaseBlockedError(['release context missing']);
    const reasons = releaseBlockers(ctx);
    if (reasons.length > 0) throw new ReportReleaseBlockedError(reasons);
  }
}

export function isVisibleToPatient(status: ReportStatus): boolean {
  return status === 'released';
}
