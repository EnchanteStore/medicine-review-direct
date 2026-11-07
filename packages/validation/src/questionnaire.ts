import { z } from 'zod';

/** Stored in place of an answer when the patient says they do not know. */
export const DONT_KNOW = 'dont_know';

export const QUESTIONNAIRE_STEPS = [
  { step: 1, slug: 'health', title: 'Your health' },
  { step: 2, slug: 'medicines', title: 'Your medicines' },
  { step: 3, slug: 'concerns', title: 'Your questions and concerns' },
  { step: 4, slug: 'review', title: 'Check and send' },
] as const;

export const MEDICATION_DONT_KNOW_FIELDS = ['strength', 'dose', 'frequency', 'indication'] as const;
export type MedicationDontKnowField = (typeof MEDICATION_DONT_KNOW_FIELDS)[number];

export const MAX_MEDICATIONS = 50;

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` });

export const medicationSchema = z.object({
  name: text(200, 'Medicine name').min(1, { error: 'Enter the name of the medicine' }),
  strength: text(100, 'Strength').default(''),
  formulation: text(100, 'Form').default(''),
  dose: text(200, 'Dose').default(''),
  frequency: text(200, 'How often').default(''),
  route: text(100, 'How you take it').default(''),
  indication: text(300, 'What it is for').default(''),
  notes: text(1000, 'Notes').default(''),
  dontKnow: z.array(z.enum(MEDICATION_DONT_KNOW_FIELDS)).default([]),
});
export type Medication = z.output<typeof medicationSchema>;

/** Drafts may contain half-completed rows; fully empty rows are dropped. */
export const medicationDraftSchema = medicationSchema.extend({
  name: text(200, 'Medicine name').default(''),
});

export function isEmptyMedication(m: z.input<typeof medicationDraftSchema>): boolean {
  return (
    !m.name?.trim() &&
    !m.strength?.trim() &&
    !m.dose?.trim() &&
    !m.frequency?.trim() &&
    !m.indication?.trim() &&
    !m.notes?.trim() &&
    !(m.dontKnow && m.dontKnow.length > 0)
  );
}

export const CONSULTATION_METHODS = ['telephone', 'secure_video', 'no_preference'] as const;

export const healthStepSchema = z.object({
  conditions: text(2000, 'Health conditions').default(''),
  allergies: text(1000, 'Allergies').default(''),
});

export const concernsStepSchema = z.object({
  mainConcern: text(2000, 'Your main question or concern').min(1, {
    error: 'Tell us your main question or concern about your medicines',
  }),
  goals: text(2000, 'What you hope to get from the review').default(''),
  consultationMethod: z.enum(CONSULTATION_METHODS, { error: 'Choose how you would like to speak to the pharmacist' }),
});

export const questionnaireSubmissionSchema = z.object({
  answers: healthStepSchema.extend(concernsStepSchema.shape),
  medications: z
    .array(medicationSchema)
    .min(1, { error: 'Add at least one medicine' })
    .max(MAX_MEDICATIONS, { error: `You can add up to ${MAX_MEDICATIONS} medicines` }),
});
export type QuestionnaireSubmission = z.output<typeof questionnaireSubmissionSchema>;
