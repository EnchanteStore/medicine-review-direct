export interface Notification {
  fromName: string;
  subject: string;
  text: string;
}

/** Appointment notice: time is not included, so the email stays free of account detail. */
export function appointmentUpdateEmail(brand: string): Notification {
  return {
    fromName: brand,
    subject: 'Your appointment has been updated',
    text: [
      'There is an update to an appointment in your account.',
      '',
      'Please sign in to see the time. This email does not include health information.',
      '',
      'This inbox is not monitored. If you have a life-threatening emergency, call 999. For urgent medical advice, contact your GP or NHS 111.',
    ].join('\n'),
  };
}

/** Generic notification: no health details in the subject or body. */
export function accountUpdateEmail(brand: string): Notification {
  return {
    fromName: brand,
    subject: 'There is an update in your account',
    text: [
      'There is an update in your account.',
      '',
      'Please sign in to see it. For your privacy, we do not include any details in emails.',
      '',
      'This inbox is not monitored. If you have a life-threatening emergency, call 999. For urgent medical advice, contact your GP or NHS 111.',
    ].join('\n'),
  };
}
