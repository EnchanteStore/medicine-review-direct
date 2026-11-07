/**
 * Emergency banner wording. The full version is the owner's exact approved
 * text (decision 7 Nov 2026, section 3) with the brand name substituted.
 * The shortened version is DRAFT: its wording needs owner approval.
 */
export interface EmergencyCopy {
  heading: string;
  paragraphs: string[];
}

export function fullEmergencyWarning(brand: string): EmergencyCopy {
  return {
    heading: 'Important: Not an emergency service.',
    paragraphs: [
      `${brand} does not provide emergency or urgent medical care and is not monitored 24 hours a day.`,
      'If you have a life-threatening emergency, including severe difficulty breathing, chest pain, signs of a stroke or a severe allergic reaction, call 999 immediately.',
      'For urgent medical advice that cannot wait, contact your GP or NHS 111. Do not wait for a medication review or a response from us.',
    ],
  };
}

export function shortEmergencyWarning(brand: string): EmergencyCopy {
  return {
    heading: 'Important: Not an emergency service.',
    paragraphs: [
      `${brand} is not monitored 24 hours a day. In a life-threatening emergency, call 999 immediately. For urgent advice, contact your GP or NHS 111.`,
    ],
  };
}

export function emergencyText(copy: EmergencyCopy): string {
  return [copy.heading, ...copy.paragraphs].join('\n\n');
}
