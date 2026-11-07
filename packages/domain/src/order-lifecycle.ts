import { assertTransition, canTransition, type TransitionMap } from './state-machine';

/**
 * Review order lifecycle. Designed in Phase 1, persisted from Phase 2/3.
 * `safety_escalated` means the safety screening matched an approved emergency
 * rule: routine checkout is blocked and clinical staff are alerted.
 */
export const ORDER_STATUSES = [
  'draft',
  'questionnaire_submitted',
  'safety_escalated',
  'awaiting_payment',
  'paid',
  'consultation_booked',
  'in_review',
  'report_released',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: TransitionMap<OrderStatus> = {
  draft: ['questionnaire_submitted', 'cancelled'],
  questionnaire_submitted: ['awaiting_payment', 'safety_escalated', 'draft', 'cancelled'],
  safety_escalated: ['cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['consultation_booked', 'refunded'],
  consultation_booked: ['in_review', 'paid', 'refunded'],
  in_review: ['report_released', 'refunded'],
  report_released: ['completed'],
  completed: [],
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

export function canStartCheckout(status: OrderStatus): boolean {
  return status === 'awaiting_payment';
}
