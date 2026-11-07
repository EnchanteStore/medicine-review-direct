import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  REPORT_STATUSES,
  ReportReleaseBlockedError,
  approvalBlockers,
  assertReportTransition,
  canTransitionReport,
  isVisibleToPatient,
  releaseBlockers,
  type ReleaseContext,
} from '../src';

const ok: ReleaseContext = {
  screeningCleared: true,
  eligibilityConfirmed: true,
  questionnaireSubmitted: true,
  informationSufficientConfirmed: true,
  consultation: { twoWayCompleted: true, method: 'secure_video', hasNotes: true },
  clinicalAdequacyConfirmed: true,
  contentComplete: true,
  approvedWithProfessionalId: true,
  serviceDeclinedOrExcluded: false,
  orderInReview: true,
  orderPaid: true,
  actorIsAssignedVerifiedPharmacist: true,
};

describe('report lifecycle transitions', () => {
  it('follows draft -> approved -> generating -> ready -> released', () => {
    expect(() => assertReportTransition('draft', 'clinically_approved', ok)).not.toThrow();
    expect(() => assertReportTransition('clinically_approved', 'generating')).not.toThrow();
    expect(() => assertReportTransition('generating', 'ready_for_release')).not.toThrow();
    expect(() => assertReportTransition('ready_for_release', 'released', ok)).not.toThrow();
  });

  it('cannot skip approval or release straight from generation', () => {
    expect(canTransitionReport('draft', 'generating')).toBe(false);
    expect(canTransitionReport('generating', 'released')).toBe(false);
    expect(() => assertReportTransition('draft', 'released', ok)).toThrow(InvalidTransitionError);
  });

  it('released is terminal', () => {
    for (const s of REPORT_STATUSES) expect(canTransitionReport('released', s)).toBe(false);
  });

  it('only released reports are patient-visible', () => {
    expect(REPORT_STATUSES.filter(isVisibleToPatient)).toEqual(['released']);
  });
});

describe('section 8 release gate', () => {
  it('passes when every condition is met', () => {
    expect(releaseBlockers(ok)).toEqual([]);
  });

  it.each([
    ['screeningCleared', false, 'safety_screening_not_cleared'],
    ['eligibilityConfirmed', false, 'eligibility_profile_incomplete'],
    ['questionnaireSubmitted', false, 'no_submitted_questionnaire'],
    ['informationSufficientConfirmed', false, 'clinical_information_not_confirmed_sufficient'],
    ['consultation', null, 'no_consultation_recorded'],
    ['clinicalAdequacyConfirmed', false, 'clinical_adequacy_not_confirmed'],
    ['contentComplete', false, 'report_content_incomplete'],
    ['serviceDeclinedOrExcluded', true, 'service_declined_or_excluded'],
    ['actorIsAssignedVerifiedPharmacist', false, 'actor_not_assigned_verified_pharmacist'],
    ['approvedWithProfessionalId', false, 'report_not_approved_with_professional_identification'],
    ['orderInReview', false, 'order_not_in_review'],
    ['orderPaid', false, 'order_not_paid'],
  ] as const)('blocks release when %s is %s', (key, value, reason) => {
    expect(releaseBlockers({ ...ok, [key]: value })).toContain(reason);
  });

  it('requires a completed two-way consultation with notes', () => {
    expect(
      approvalBlockers({
        ...ok,
        consultation: { twoWayCompleted: false, method: 'telephone', hasNotes: true },
      }),
    ).toContain('consultation_not_two_way_completed');
    expect(
      approvalBlockers({
        ...ok,
        consultation: { twoWayCompleted: true, method: 'telephone', hasNotes: false },
      }),
    ).toContain('consultation_notes_missing');
  });

  it('an unpaid review is not blocked at approval, and cannot be released', () => {
    const unpaid = { ...ok, orderPaid: false };
    expect(approvalBlockers(unpaid)).not.toContain('order_not_paid');
    expect(releaseBlockers(unpaid)).toContain('order_not_paid');
  });

  it('a failed generation can be retried and is not a release', () => {
    expect(canTransitionReport('generation_failed', 'generating')).toBe(true);
    expect(canTransitionReport('generation_failed', 'released')).toBe(false);
    expect(isVisibleToPatient('generation_failed')).toBe(false);
  });

  it('payment, a booking or a questionnaire alone never authorise release', () => {
    const onlyPaidAndBooked: ReleaseContext = {
      ...ok,
      informationSufficientConfirmed: false,
      consultation: null,
      clinicalAdequacyConfirmed: false,
      approvedWithProfessionalId: false,
    };
    expect(() =>
      assertReportTransition('ready_for_release', 'released', onlyPaidAndBooked),
    ).toThrow(ReportReleaseBlockedError);
  });

  it('requires context for approval and release', () => {
    expect(() => assertReportTransition('ready_for_release', 'released')).toThrow(
      ReportReleaseBlockedError,
    );
    expect(() => assertReportTransition('draft', 'clinically_approved')).toThrow(
      ReportReleaseBlockedError,
    );
  });
});
