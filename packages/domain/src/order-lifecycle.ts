import { assertTransition, canTransition, type TransitionMap } from './state-machine';

/**
 * Review order lifecycle. Mirrors `app.order_transition_allowed` and the
 * guards in `app.enforce_order_rules` (the database is authoritative).
 */
export const ORDER_STATUSES = [
  'draft',
  'safety_emergency_excluded',
  'safety_urgent_hold',
  'intake',
  'questionnaire_submitted',
  'awaiting_payment',
  'paid',
  'consultation_booked',
  'in_review',
  'report_released',
  'completed',
  'declined',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: TransitionMap<OrderStatus> = {
  draft: ['safety_emergency_excluded', 'safety_urgent_hold', 'intake', 'cancelled'],
  // Emergency exclusion is terminal for the order; ordinary booking cannot override it.
  safety_emergency_excluded: [],
  // Leaves only through a documented pharmacist reassessment.
  safety_urgent_hold: ['intake', 'declined', 'cancelled'],
  intake: ['questionnaire_submitted', 'cancelled'],
  questionnaire_submitted: ['intake', 'awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['consultation_booked', 'refunded', 'declined'],
  consultation_booked: ['in_review', 'paid', 'refunded', 'declined'],
  in_review: ['report_released', 'refunded', 'declined'],
  report_released: ['completed'],
  completed: [],
  // A declined service may lead to a safety or referral communication, never a review report.
  declined: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return canTransition(ORDER_TRANSITIONS, from, to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  assertTransition('order', ORDER_TRANSITIONS, from, to);
}

const PAID_STATUSES: readonly OrderStatus[] = [
  'paid',
  'consultation_booked',
  'in_review',
  'report_released',
  'completed',
];

export function isOrderPaid(status: OrderStatus): boolean {
  return PAID_STATUSES.includes(status);
}

export interface CheckoutContext {
  status: OrderStatus;
  paymentsOpen: boolean;
  patientHasUrgentHold: boolean;
  screeningCleared: boolean;
}

/**
 * Checkout needs a submitted questionnaire, an open payment mode and a cleared
 * screening. An urgent hold or an emergency exclusion cannot pay. Opening
 * payments does not bypass those gates.
 */
export function canStartCheckout(ctx: CheckoutContext): boolean {
  return (
    ctx.status === 'questionnaire_submitted' &&
    ctx.paymentsOpen &&
    ctx.screeningCleared &&
    !ctx.patientHasUrgentHold
  );
}

export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  'draft',
  'safety_urgent_hold',
  'intake',
  'questionnaire_submitted',
];
