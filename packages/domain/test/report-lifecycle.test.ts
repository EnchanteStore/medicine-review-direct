import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  REPORT_STATUSES,
  ReportReleaseBlockedError,
  assertReportTransition,
  canTransitionReport,
  isVisibleToPatient,
  releaseBlockers,
} from '../src';

const okCtx = { orderPaid: true, consultationRecorded: true, releasedByVerifiedPharmacist: true };

describe('report lifecycle', () => {
  it('follows draft -> approved -> generating -> ready -> released', () => {
    expect(() => assertReportTransition('draft', 'clinically_approved')).not.toThrow();
    expect(() => assertReportTransition('clinically_approved', 'generating')).not.toThrow();
    expect(() => assertReportTransition('generating', 'ready_for_release')).not.toThrow();
    expect(() => assertReportTransition('ready_for_release', 'released', okCtx)).not.toThrow();
  });

  it('cannot skip clinical approval', () => {
    expect(canTransitionReport('draft', 'generating')).toBe(false);
    expect(canTransitionReport('draft', 'ready_for_release')).toBe(false);
    expect(() => assertReportTransition('draft', 'released', okCtx)).toThrow(
      InvalidTransitionError,
    );
  });

  it('cannot release directly from generation (no automatic release)', () => {
    expect(canTransitionReport('generating', 'released')).toBe(false);
  });

  it('allows recovery from a failed generation', () => {
    expect(canTransitionReport('generating', 'generation_failed')).toBe(true);
    expect(canTransitionReport('generation_failed', 'generating')).toBe(true);
  });

  it('treats released as terminal; corrections require a new version', () => {
    for (const s of REPORT_STATUSES) expect(canTransitionReport('released', s)).toBe(false);
  });

  it('blocks release of an unpaid review', () => {
    expect(() =>
      assertReportTransition('ready_for_release', 'released', { ...okCtx, orderPaid: false }),
    ).toThrow(ReportReleaseBlockedError);
  });

  it('blocks release without a recorded consultation', () => {
    expect(releaseBlockers({ ...okCtx, consultationRecorded: false })).toContain(
      'consultation has not been recorded',
    );
  });

  it('blocks release without a verified pharmacist and without context', () => {
    expect(releaseBlockers({ ...okCtx, releasedByVerifiedPharmacist: false })).toHaveLength(1);
    expect(() => assertReportTransition('ready_for_release', 'released')).toThrow(
      ReportReleaseBlockedError,
    );
  });

  it('only released reports are patient-visible', () => {
    const visible = REPORT_STATUSES.filter(isVisibleToPatient);
    expect(visible).toEqual(['released']);
  });
});
