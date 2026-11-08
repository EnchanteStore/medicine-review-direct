import {
  ACTIVE_RULESET,
  MESSAGING_OUT_OF_HOURS_WARNING,
  REPORT_LIMITATIONS_DRAFT,
  formatLondon,
  parseReportContent,
  type ReportContent,
} from '@mrd/domain';
import { Alert, Button, Card, CheckboxField, FormField, Input, Textarea } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  approveGpLetterAction,
  approveReportAction,
  confirmReportAction,
  createReportAction,
  dispatchGpLetterAction,
  generateReportAction,
  recordConsultationAction,
  recordSafetyNoticeAction,
  releaseReportAction,
  saveGpLetterAction,
  startCorrectionAction,
  saveReportAction,
  sendStaffMessageAction,
  verifyGpRecipientAction,
} from '@/app/staff/reviews/actions';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Review' };
export const dynamic = 'force-dynamic';

const ANSWER_LABEL: Record<string, string> = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
function methodLabel(method: string): string {
  if (method === 'telephone') return 'Telephone';
  if (method === 'secure_video') return 'Secure video';
  return method;
}
const SAFETY_ONLY = new Set(['declined', 'safety_emergency_excluded', 'safety_urgent_hold']);

function savedContent(value: unknown): ReportContent | null {
  try {
    return parseReportContent(value);
  } catch {
    return null;
  }
}

export default async function ReviewWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/staff/reviews');
  const { orderId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from('review_orders')
    .select('id, status, patient_id, assigned_pharmacist_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) notFound();

  const [
    profileResult,
    screeningResult,
    questionnaireResult,
    documentsResult,
    paymentsResult,
    appointmentsResult,
    consultationsResult,
    reportResult,
    messagesResult,
    letterResult,
    noticesResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('given_name, family_name, date_of_birth')
      .eq('id', order.patient_id)
      .maybeSingle(),
    supabase
      .from('safety_screenings')
      .select('outcome, answers, ruleset_version')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('questionnaire_submissions')
      .select('answers, medications, status, version_no')
      .eq('order_id', order.id)
      .eq('status', 'submitted')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('id, original_filename, scan_status')
      .eq('order_id', order.id),
    supabase
      .from('payments')
      .select('status, amount_pence, receipt_number')
      .eq('order_id', order.id)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('status, method, starts_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('consultations')
      .select('id, method, occurred_at, two_way_completed, clinical_notes')
      .eq('order_id', order.id)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('reports')
      .select(
        'id, status, content, approver_display_name, approver_gphc_number, pdf_storage_path, version_no, correction_reason',
      )
      .eq('order_id', order.id)
      .neq('status', 'superseded')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('gp_letters')
      .select(
        'status, concern, findings, discussion_points, recipient_name, recipient_practice, verification_note, dispatch_evidence',
      )
      .eq('order_id', order.id)
      .maybeSingle(),
    supabase
      .from('safety_notices')
      .select('kind, body, created_at')
      .eq('order_id', order.id)
      .order('created_at'),
  ]);

  const profile = profileResult.data;
  const screening = screeningResult.data;
  const questionnaire = questionnaireResult.data;
  const documents = documentsResult.data ?? [];
  const payment = paymentsResult.data;
  const appointment =
    (appointmentsResult.data ?? []).find((row) => row.status === 'booked') ??
    appointmentsResult.data?.[0];
  const consultations = consultationsResult.data ?? [];
  const report = reportResult.data;
  const messages = messagesResult.data ?? [];
  const letter = letterResult.data;
  const notices = noticesResult.data ?? [];
  const assigned = order.assigned_pharmacist_id === user.id;
  const content = report ? savedContent(report.content) : null;
  const answers =
    screening?.answers && typeof screening.answers === 'object' && !Array.isArray(screening.answers)
      ? (screening.answers as Record<string, unknown>)
      : {};
  const meds = Array.isArray(questionnaire?.medications) ? questionnaire.medications : [];
  const concern =
    questionnaire?.answers &&
    typeof questionnaire.answers === 'object' &&
    !Array.isArray(questionnaire.answers)
      ? (questionnaire.answers as Record<string, unknown>).mainConcern
      : '';
  const patientName =
    [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || 'Patient';
  const error = typeof query.error === 'string' ? query.error : undefined;
  const notice = typeof query.notice === 'string' ? query.notice : undefined;
  const safetyOnly = SAFETY_ONLY.has(order.status);
  const paymentLabel =
    payment?.status === 'succeeded'
      ? `Paid (£${(payment.amount_pence / 100).toFixed(2)}, receipt ${payment.receipt_number})`
      : payment?.status === 'refund_recorded'
        ? 'Refund recorded'
        : 'Not paid';

  return (
    <div className="space-y-8" data-testid="pharmacist-review">
      <p>
        <Link href="/staff/reviews">All assigned reviews</Link>
      </p>
      <div>
        <h1 className="font-serif text-3xl">{patientName}</h1>
        <p className="mt-2 text-ink-700">
          Date of birth: {profile?.date_of_birth ?? 'Not recorded'}
        </p>
        <p className="text-ink-700">Review status: {order.status}</p>
        <p className="text-ink-700" data-testid="payment-status">
          Payment: {paymentLabel}
        </p>
        <p className="text-ink-700">
          Appointment:{' '}
          {appointment?.starts_at
            ? `${methodLabel(appointment.method)}, ${formatLondon(new Date(appointment.starts_at))} (${appointment.status})`
            : 'No appointment booked'}
        </p>
      </div>
      {notice ? (
        <Alert tone="success">
          <p>{notice}</p>
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}
      {assigned ? null : (
        <Alert tone="info">
          <p>
            You can read this review. Only the assigned pharmacist, signed in with an authenticator,
            can record the consultation, approve the report or release it.
          </p>
        </Alert>
      )}

      <Card className="space-y-3">
        <h2 className="text-xl">Safety answers</h2>
        <p>
          Outcome: <strong>{screening?.outcome ?? 'No screening'}</strong>
          {screening?.outcome === 'routine' ? '. A routine result is not a safety clearance.' : ''}
        </p>
        <ul className="space-y-2">
          {ACTIVE_RULESET.questions.map((question) => (
            <li key={question.id}>
              <p>{question.text}</p>
              <p className="font-semibold">
                {ANSWER_LABEL[String(answers[question.id] ?? '')] ?? 'Not answered'}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl">Medicines and concerns</h2>
        {typeof concern === 'string' && concern ? (
          <p>Main concern: {concern}</p>
        ) : (
          <p>No submitted concern.</p>
        )}
        <ul className="list-disc space-y-1 pl-5">
          {meds.map((item, index) => {
            const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            return <li key={index}>{typeof row.name === 'string' ? row.name : 'Medicine'}</li>;
          })}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl">Documents</h2>
        <p className="text-ink-700">
          Files that have not been scanned stay hidden. The scanner is not running yet. A link below
          opens a clean file for 60 seconds.
        </p>
        {documents.length === 0 ? (
          <p>No scanned documents.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                {doc.original_filename}{' '}
                <a href={`/api/documents/${doc.id}/open`}>Open for 60 seconds</a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl">Consultation</h2>
        <p className="text-ink-700">
          Audio is not required. A completed two-way conversation needs a note.
        </p>
        {consultations.length === 0 ? <p>No consultation recorded.</p> : null}
        <ul className="space-y-2">
          {consultations.map((row) => (
            <li key={row.id}>
              {methodLabel(row.method)} on {formatLondon(new Date(row.occurred_at))}.{' '}
              {row.two_way_completed
                ? 'Two-way conversation completed.'
                : 'Not a completed two-way conversation.'}
              <span className="block whitespace-pre-wrap">{row.clinical_notes}</span>
            </li>
          ))}
        </ul>
        {assigned && !safetyOnly ? (
          <form
            action={recordConsultationAction}
            className="space-y-4"
            data-testid="consultation-form"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <FormField id="occurredOn" label="Date">
              {(aria) => <Input {...aria} name="occurredOn" type="date" required />}
            </FormField>
            <FormField id="occurredAt" label="Time (UK)">
              {(aria) => <Input {...aria} name="occurredAt" type="time" required />}
            </FormField>
            <FormField id="method" label="Method">
              {(aria) => (
                <select
                  {...aria}
                  name="method"
                  className="block min-h-12 w-full rounded-md border-2 border-ink-600 bg-white px-3"
                  required
                >
                  <option value="telephone">Telephone</option>
                  <option value="secure_video">Secure video</option>
                </select>
              )}
            </FormField>
            <FormField
              id="notes"
              label="Clinical notes"
              hint="What you discussed. Do not tell the patient to change a medicine on their own."
            >
              {(aria) => <Textarea {...aria} name="notes" required />}
            </FormField>
            <CheckboxField
              id="twoWay"
              name="twoWay"
              value="yes"
              label="This was a completed two-way conversation"
            />
            <Button type="submit">Save consultation</Button>
          </form>
        ) : null}
      </Card>

      {safetyOnly ? (
        <Card className="space-y-3">
          <h2 className="text-xl">Safety note or referral</h2>
          <Alert tone="warning">
            <p>
              This is not a medication review report. A declined or excluded review cannot have one.
            </p>
          </Alert>
          <ul className="space-y-2">
            {notices.map((note) => (
              <li key={note.created_at}>
                <strong>{note.kind === 'referral' ? 'Referral' : 'Safety notification'}</strong>
                <span className="block whitespace-pre-wrap">{note.body}</span>
              </li>
            ))}
          </ul>
          {assigned ? (
            <form action={recordSafetyNoticeAction} className="space-y-4">
              <input type="hidden" name="orderId" value={order.id} />
              <FormField id="kind" label="Type">
                {(aria) => (
                  <select
                    {...aria}
                    name="kind"
                    className="block min-h-12 w-full rounded-md border-2 border-ink-600 bg-white px-3"
                  >
                    <option value="safety_notification">Safety notification</option>
                    <option value="referral">Referral</option>
                  </select>
                )}
              </FormField>
              <FormField
                id="safetyBody"
                label="Note"
                hint="Say what the patient should do next. Do not tell them to start, stop or change a medicine on their own."
              >
                {(aria) => <Textarea {...aria} name="body" required />}
              </FormField>
              <Button type="submit">Record safety note</Button>
            </form>
          ) : null}
        </Card>
      ) : (
        <Card className="space-y-4" data-testid="report-panel">
          <h2 className="text-xl">Medication review report</h2>
          <Alert tone="info">
            <p>
              Clinical wording is <strong>DRAFT pending clinical approval</strong>. Recommendations
              are for discussion with the prescriber. They are not instructions to start, stop or
              change a medicine.
            </p>
          </Alert>
          <p>
            Status: <strong data-testid="report-status">{report?.status ?? 'Not started'}</strong>
            {report?.approver_display_name
              ? `. Approved by ${report.approver_display_name}, GPhC ${report.approver_gphc_number}. Live register check pending.`
              : ''}
            {report?.version_no && report.version_no > 1 ? ` Version ${report.version_no}.` : ''}
          </p>
          {assigned && report?.status === 'released' ? (
            <form
              action={startCorrectionAction}
              className="space-y-3"
              data-testid="correction-form"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <FormField
                id="correctionReason"
                label="Reason for a new version"
                hint="The released report is kept. The patient sees the new version only after you approve and release it."
              >
                {(aria) => <Textarea {...aria} name="reason" required minLength={10} />}
              </FormField>
              <Button type="submit">Start a corrected version</Button>
            </form>
          ) : null}
          {assigned && !report ? (
            <form action={createReportAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit">Start the report</Button>
            </form>
          ) : null}
          {assigned && report?.status === 'draft' ? (
            <>
              <form action={saveReportAction} className="space-y-4" data-testid="report-form">
                <input type="hidden" name="orderId" value={order.id} />
                <FormField id="findings" label="Key findings">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="findings"
                      defaultValue={content?.findings ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="medicine1" label="Medicine">
                  {(aria) => (
                    <Input
                      {...aria}
                      name="medicine1"
                      defaultValue={content?.medicationIssues[0]?.medicine ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="issue1"
                  label="Medication-related issue"
                  hint="Describe the issue. Do not tell the patient to change the medicine."
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="issue1"
                      defaultValue={content?.medicationIssues[0]?.issue ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="recommendations"
                  label="Recommendations"
                  hint="One point on each line. For discussion with the GP."
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="recommendations"
                      defaultValue={content?.recommendations.join('\n') ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="monitoring" label="Monitoring needs" hint="One point on each line.">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="monitoring"
                      defaultValue={content?.monitoring.join('\n') ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="gpPoints"
                  label="Points to discuss with the GP"
                  hint="One point on each line."
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="gpPoints"
                      defaultValue={content?.gpDiscussionPoints.join('\n') ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="safetyAdvice" label="Safety advice">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="safetyAdvice"
                      defaultValue={content?.safetyAdvice ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="limitations" label="Limitations and disclaimer">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="limitations"
                      defaultValue={content?.limitations ?? REPORT_LIMITATIONS_DRAFT}
                      required
                    />
                  )}
                </FormField>
                <Button type="submit">Save report</Button>
              </form>
              <form action={confirmReportAction} className="space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <CheckboxField
                  id="information"
                  name="information"
                  value="yes"
                  label="The clinical information is sufficient"
                />
                <CheckboxField
                  id="adequate"
                  name="adequate"
                  value="yes"
                  label="This assessment is clinically adequate"
                />
                <Button type="submit" variant="secondary">
                  Record checks
                </Button>
              </form>
              <form action={approveReportAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" data-testid="approve-report">
                  Approve report
                </Button>
              </form>
            </>
          ) : null}
          {assigned &&
          report &&
          ['clinically_approved', 'generation_failed', 'generating'].includes(report.status) ? (
            <form action={generateReportAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" data-testid="generate-report">
                {report.status === 'generation_failed' || report.status === 'generating'
                  ? 'Try creating the PDF again'
                  : 'Create PDF'}
              </Button>
            </form>
          ) : null}
          {report &&
          (report.status === 'ready_for_release' || report.status === 'released') &&
          report.pdf_storage_path ? (
            <p>
              <Link href={`/account/review/${order.id}/report/file`}>Open the PDF</Link>
            </p>
          ) : null}
          {assigned && report?.status === 'ready_for_release' ? (
            <form action={releaseReportAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" data-testid="release-report">
                Release report to the patient
              </Button>
            </form>
          ) : null}
          {report?.status === 'released' ? (
            <Alert tone="success">
              <p>This version has been released. It can no longer be edited.</p>
            </Alert>
          ) : null}
        </Card>
      )}

      <Card className="space-y-3" data-testid="message-thread">
        <h2 className="text-xl">Messages</h2>
        <Alert tone="warning">
          <p data-testid="out-of-hours">{MESSAGING_OUT_OF_HOURS_WARNING}</p>
        </Alert>
        {messages.length === 0 ? <p>No messages.</p> : null}
        <ul className="space-y-3">
          {messages.map((message) => (
            <li key={message.id}>
              <p className="text-sm text-ink-600">
                {message.sender_id === user.id ? 'You' : 'Patient'} ·{' '}
                {formatLondon(new Date(message.created_at))}
                {message.sender_id !== user.id && !message.read_at ? ' · Unread' : ''}
              </p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </li>
          ))}
        </ul>
        {assigned &&
        !['draft', 'safety_emergency_excluded', 'cancelled', 'refunded'].includes(order.status) ? (
          <form action={sendStaffMessageAction} className="space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            <FormField id="staffMessage" label="Message">
              {(aria) => <Textarea {...aria} name="body" required />}
            </FormField>
            <Button type="submit">Send message</Button>
          </form>
        ) : null}
      </Card>

      {order.status === 'safety_emergency_excluded' ? null : (
        <Card className="space-y-4" data-testid="gp-letter">
          <h2 className="text-xl">GP letter</h2>
          <p className="text-ink-700">
            Draft wording is hidden from the patient. Record the practice you checked with the
            patient. Do not enter an email address. The letter is not sent, and there is no NHS
            connection. Clinical wording is DRAFT pending clinical approval.
          </p>
          {letter ? (
            <div className="space-y-1">
              <p>Status: {letter.status}</p>
              {letter.recipient_practice ? (
                <p>
                  {letter.recipient_name}, {letter.recipient_practice}. {letter.verification_note}
                </p>
              ) : (
                <p>No practice recorded yet.</p>
              )}
              {letter.dispatch_evidence ? <p>{letter.dispatch_evidence}</p> : null}
            </div>
          ) : null}
          {assigned && (!letter || letter.status === 'draft') ? (
            <>
              <form action={saveGpLetterAction} className="space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <FormField id="gpConcern" label="Patient concern">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="concern"
                      defaultValue={letter?.concern ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="gpFindings" label="Findings">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="findings"
                      defaultValue={letter?.findings ?? ''}
                      required
                    />
                  )}
                </FormField>
                <FormField id="gpDiscussion" label="Points for the GP to consider">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      name="discussion"
                      defaultValue={letter?.discussion_points ?? ''}
                      required
                    />
                  )}
                </FormField>
                <Button type="submit" variant="secondary">
                  Save GP letter
                </Button>
              </form>
              {letter ? (
                <form action={verifyGpRecipientAction} className="space-y-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <FormField id="recipientName" label="GP name">
                    {(aria) => (
                      <Input
                        {...aria}
                        name="recipientName"
                        defaultValue={letter.recipient_name ?? ''}
                        required
                      />
                    )}
                  </FormField>
                  <FormField
                    id="practice"
                    label="Practice name"
                    hint="The name you checked with the patient. Not an email address."
                  >
                    {(aria) => (
                      <Input
                        {...aria}
                        name="practice"
                        defaultValue={letter.recipient_practice ?? ''}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="verificationNote" label="How you checked it">
                    {(aria) => (
                      <Textarea
                        {...aria}
                        name="verificationNote"
                        defaultValue={letter.verification_note ?? ''}
                        required
                      />
                    )}
                  </FormField>
                  <Button type="submit" variant="secondary">
                    Record checked practice
                  </Button>
                </form>
              ) : null}
              {letter?.recipient_practice ? (
                <form action={approveGpLetterAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button type="submit">Approve GP letter</Button>
                </form>
              ) : null}
            </>
          ) : null}
          {assigned && letter?.status === 'approved' ? (
            <form action={dispatchGpLetterAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit">Record that the letter is on file</Button>
            </form>
          ) : null}
        </Card>
      )}
    </div>
  );
}
