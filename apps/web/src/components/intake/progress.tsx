import { QUESTIONNAIRE_STEPS } from '@mrd/validation';
import { cn } from '@mrd/ui';

export function QuestionnaireProgress({ current }: { current: number }) {
  return (
    <nav aria-label="Questionnaire progress" className="mb-6">
      <p className="font-semibold text-ink-700">
        Step {current} of {QUESTIONNAIRE_STEPS.length}
      </p>
      <ol className="mt-2 grid grid-cols-4 gap-2">
        {QUESTIONNAIRE_STEPS.map((s) => (
          <li key={s.step}>
            <span
              aria-current={s.step === current ? 'step' : undefined}
              className={cn(
                'block border-t-4 pt-1 text-sm',
                s.step < current && 'border-teal-700 text-ink-700',
                s.step === current && 'border-teal-700 font-semibold text-ink-900',
                s.step > current && 'border-sand-300 text-ink-600',
              )}
            >
              {s.title}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
