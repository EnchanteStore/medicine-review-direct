import type { OrderStatus } from '@mrd/domain';

export interface OrderView {
  label: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  message: string;
  next: { href: string; label: string } | null;
}

export interface OrderContext {
  id: string;
  status: OrderStatus;
  hasConsents: boolean;
  draftStep: number | null;
  paymentsOpen: boolean;
}

/** Patient-facing description of where a review is and what to do next. */
export function describeOrder(o: OrderContext): OrderView {
  const base = `/account/review/${o.id}`;
  switch (o.status) {
    case 'draft':
      return {
        label: 'Safety questions needed',
        tone: 'info',
        message: 'Answer a few safety questions before you tell us about your medicines.',
        next: { href: `${base}/screening`, label: 'Answer safety questions' },
      };
    case 'safety_emergency_excluded':
      return {
        label: 'Stopped: emergency symptoms',
        tone: 'danger',
        message:
          'This request is closed (EMERGENCY_EXCLUDED). If you have a life-threatening emergency, call 999 immediately. You can start a new request afterwards. The exclusion stays on record, and a pharmacist must review it before any routine booking.',
        next: { href: `${base}/outcome`, label: 'See what to do' },
      };
    case 'safety_urgent_hold':
      return {
        label: 'Paused: urgent exclusion',
        tone: 'warning',
        message:
          'Your answers suggested you need help today. Contact your GP or NHS 111 now. A pharmacist must check this request is suitable before it can continue.',
        next: { href: `${base}/outcome`, label: 'See what to do' },
      };
    case 'intake':
      if (!o.hasConsents) {
        return {
          label: 'Consent needed',
          tone: 'info',
          message: 'Tell us you agree to how we use your health information.',
          next: { href: `${base}/consent`, label: 'Continue' },
        };
      }
      return {
        label: 'Questionnaire in progress',
        tone: 'info',
        message: 'Your answers are saved as you go. You can come back at any time.',
        next: {
          href: `${base}/questionnaire/${o.draftStep ?? 1}`,
          label: 'Continue questionnaire',
        },
      };
    case 'questionnaire_submitted':
      return {
        label: 'Questionnaire sent',
        tone: 'success',
        message: o.paymentsOpen
          ? 'Thank you. The next step is a test checkout. This is not a live card payment.'
          : 'Thank you. Payment and booking are switched off until the service is approved to open, so no further action is possible yet.',
        next: o.paymentsOpen
          ? { href: `${base}/pay`, label: 'Continue to checkout' }
          : { href: base, label: 'View your review' },
      };
    case 'awaiting_payment':
      return {
        label: 'Waiting for payment',
        tone: 'info',
        message:
          'Checkout has started. Payment is confirmed only after the signed payment notice is received.',
        next: { href: `${base}/pay`, label: 'Return to checkout' },
      };
    case 'paid':
      return {
        label: 'Paid, appointment not booked',
        tone: 'success',
        message:
          'Your test payment is confirmed. Choose a time for your telephone or video consultation.',
        next: { href: `${base}/book`, label: 'Choose a time' },
      };
    case 'consultation_booked':
      return {
        label: 'Appointment booked',
        tone: 'success',
        message: 'Your consultation time is booked. The details are in your account.',
        next: { href: `${base}/appointment`, label: 'View your appointment' },
      };
    case 'declined':
      return {
        label: 'Not suitable for this service',
        tone: 'warning',
        message:
          'A pharmacist decided this service is not suitable for this request. Please speak to your GP.',
        next: null,
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'info',
        message: 'This request was cancelled.',
        next: null,
      };
    default:
      return {
        label: 'In progress',
        tone: 'info',
        message: 'Your review is in progress.',
        next: { href: base, label: 'View' },
      };
  }
}

/** Maps known database errors to plain English; anything else becomes a generic message. */
export function friendlyDbError(message: string | undefined): string {
  const m = message ?? '';
  const known: [RegExp, string][] = [
    [/intake is closed/, 'We are not accepting new reviews at the moment.'],
    [/complete your profile/, 'Please add your name and date of birth before starting a review.'],
    [/already been screened/, 'You have already answered the safety questions for this review.'],
    [
      /consent to process health information/,
      'Please give consent before filling in the questionnaire.',
    ],
    [
      /consent to a telephone or video consultation/,
      'Please confirm you agree to a telephone or video consultation.',
    ],
    [
      /earlier concern has been assessed/,
      'Confirm that the earlier concern has been assessed, or that it is no longer present.',
    ],
    [
      /questionnaire is incomplete/,
      'Some required answers are missing. Please check each section.',
    ],
    [
      /cannot be (edited|submitted) at this stage/,
      'This questionnaire cannot be changed at this stage.',
    ],
    [/documents cannot be added/, 'You cannot add documents at this stage.'],
    [/checkout is not available/, 'Checkout is not available for this review.'],
    [/payments are disabled/, 'Payments are switched off until the service is approved to open.'],
    [/that time is not available/, 'That time is not open. Please choose another.'],
    [/already been moved twice/, 'This appointment has already been moved twice.'],
    [/more than 24 hours/, 'An appointment can only be moved more than 24 hours before it starts.'],
    [/after your payment/, 'Choose a time after your payment is confirmed.'],
  ];
  for (const [re, text] of known) if (re.test(m)) return text;
  return 'Something went wrong. Please try again.';
}
