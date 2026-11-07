import rulesetJson from './ruleset-2026-11-draft-1.json';

export type ScreeningAnswer = 'yes' | 'no' | 'unsure';
export type ScreeningPathway = 'emergency' | 'urgent' | 'routine';
export type ScreeningOutcome = 'emergency' | 'urgent' | 'routine';

export interface ScreeningQuestion {
  id: string;
  pathway: ScreeningPathway;
  text: string;
  flag?: string;
}

export interface SafetyRuleset {
  version: string;
  status_note: string;
  answer_options: ScreeningAnswer[];
  unsure_policy: { emergency: 'escalate'; urgent: 'escalate'; routine: 'flag_incomplete' };
  questions: ScreeningQuestion[];
}

export interface ScreeningResult {
  outcome: ScreeningOutcome;
  matchedRuleIds: string[];
  flags: string[];
}

export class ScreeningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningValidationError';
  }
}

/** The active rule set. DRAFT until approved by the responsible pharmacist. */
export const ACTIVE_RULESET = rulesetJson as SafetyRuleset;

/**
 * Deterministic evaluation that mirrors `app.evaluate_screening` in the
 * database (which is authoritative). Used to render outcomes and in tests.
 * Precedence: emergency > urgent > routine. "Unsure" escalates for emergency
 * and urgent questions; for routine questions it flags incomplete information.
 * A routine outcome never means the patient's medicines are safe.
 */
export function evaluateScreening(
  ruleset: SafetyRuleset,
  answers: Record<string, ScreeningAnswer | null | undefined>,
): ScreeningResult {
  const ids = new Set(ruleset.questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!ids.has(key)) throw new ScreeningValidationError(`Unknown screening question: ${key}`);
  }
  const matched: string[] = [];
  const flags: string[] = [];
  let emergency = false;
  let urgent = false;
  for (const q of ruleset.questions) {
    const a = answers[q.id];
    if (a !== 'yes' && a !== 'no' && a !== 'unsure') {
      throw new ScreeningValidationError(`Question ${q.id} must be answered yes, no or unsure`);
    }
    if (q.pathway === 'routine') {
      if (a === 'yes') {
        matched.push(q.id);
        if (q.flag && !flags.includes(q.flag)) flags.push(q.flag);
      } else if (a === 'unsure' && !flags.includes('incomplete_information')) {
        flags.push('incomplete_information');
      }
    } else if (a === 'yes' || (a === 'unsure' && ruleset.unsure_policy[q.pathway] === 'escalate')) {
      matched.push(q.id);
      if (q.pathway === 'emergency') emergency = true;
      else urgent = true;
    }
  }
  return {
    outcome: emergency ? 'emergency' : urgent ? 'urgent' : 'routine',
    matchedRuleIds: matched,
    flags,
  };
}

export const PATHWAY_LABELS: Record<ScreeningPathway, string> = {
  emergency: 'Emergency symptoms happening now',
  urgent: 'Problems that need help today',
  routine: 'About your medicines',
};
