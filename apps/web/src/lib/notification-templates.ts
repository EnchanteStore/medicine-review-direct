export interface Notification {
  fromName: string;
  subject: string;
  text: string;
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
