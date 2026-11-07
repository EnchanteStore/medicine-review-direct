import { Card } from '@mrd/ui';
import { QUESTIONNAIRE_STEPS } from '@mrd/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FullEmergencyWarning } from '@/components/emergency-banner';
import {
  ConcernsStepForm,
  HealthStepForm,
  MedicinesStepForm,
  SubmitQuestionnaireForm,
} from '@/components/intake/forms';
import { QuestionnaireProgress } from '@/components/intake/progress';
import { requireUser } from '@/lib/auth';
import { getDraft, hasIntakeConsents, requireOwnOrder } from '@/lib/intake';

export const metadata: Metadata = { title: 'Medication questionnaire' };

const METHOD_LABELS: Record<string, string> = {
  telephone: 'Telephone',
  secure_video: 'Secure video call',
  no_preference: 'No preference',
};

function show(v: string | undefined) {
  if (v === 'dont_know') return "I don't know";
  return v?.trim() ? v : 'Not answered';
}

export default async function QuestionnaireStepPage({
  params,
}: {
  params: Promise<{ orderId: string; step: string }>;
}) {
  const user = await requireUser('/account');
  const { orderId, step: stepParam } = await params;
  const step = Number(stepParam);
  if (!QUESTIONNAIRE_STEPS.some((s) => s.step === step)) notFound();
  const order = await requireOwnOrder(orderId);
  if (order.status !== 'intake') redirect(`/account/review/${order.id}`);
  if (!(await hasIntakeConsents(user.id))) redirect(`/account/review/${order.id}/consent`);

  const draft = await getDraft(order.id);
  const answers = (draft?.answers ?? {}) as Record<string, string>;
  const medications = (draft?.medications ?? []) as Record<string, string>[];
  const title = QUESTIONNAIRE_STEPS[step - 1]!.title;
  const base = `/account/review/${order.id}/questionnaire`;

  return (
    <div className="space-y-4">
      <QuestionnaireProgress current={step} />
      <h1 className="font-serif text-3xl sm:text-4xl">{title}</h1>
      <details className="rounded-md border border-sand-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold">Why we ask for this information</summary>
        <p className="mt-2 text-ink-700">
          Your pharmacist uses your answers to prepare for your consultation and to look for
          problems such as side effects, interactions or medicines you may no longer need. Only
          people involved in your care can see your answers. Your answers are saved as you go.
        </p>
      </details>

      <Card>
        {step === 1 ? <HealthStepForm orderId={order.id} answers={answers} /> : null}
        {step === 2 ? <MedicinesStepForm orderId={order.id} medications={medications} /> : null}
        {step === 3 ? <ConcernsStepForm orderId={order.id} answers={answers} /> : null}
        {step === 4 ? (
          <div className="space-y-6">
            <FullEmergencyWarning />
            <section className="space-y-2">
              <h2 className="text-xl">Your health</h2>
              <p>
                <strong>Conditions:</strong> {show(answers.conditions)}
              </p>
              <p>
                <strong>Allergies:</strong> {show(answers.allergies)}
              </p>
              <Link href={`${base}/1`}>Change your health answers</Link>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl">Your medicines</h2>
              {medications.length === 0 ? (
                <p>No medicines added yet.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {medications.map((m, i) => (
                    <li key={i}>
                      {[m.name, m.strength, m.dose, m.frequency].filter(Boolean).join(', ') ||
                        'Unnamed medicine'}
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`${base}/2`}>Change your medicines</Link>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl">Your questions and concerns</h2>
              <p>
                <strong>Main concern:</strong> {show(answers.mainConcern)}
              </p>
              <p>
                <strong>Consultation:</strong>{' '}
                {METHOD_LABELS[answers.consultationMethod ?? ''] ?? 'Not answered'}
              </p>
              <Link href={`${base}/3`}>Change your concerns</Link>
            </section>
            <p className="text-ink-700">
              When you send your answers, you cannot change them without starting a new version.
              Earlier versions are kept.
            </p>
            <SubmitQuestionnaireForm orderId={order.id} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
