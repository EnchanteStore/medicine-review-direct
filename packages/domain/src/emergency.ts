/**
 * Emergency wording from the product-owner decision of 7 Nov 2026 (P-02).
 * Approved for development. Pending clinical approval. The configured trading
 * name is substituted; with the default brand the text is the approved wording.
 */
export interface EmergencyCopy {
  heading: string;
  paragraphs: string[];
}

export function fullEmergencyWarning(brand: string): EmergencyCopy {
  return {
    heading: `Important: ${brand} is not an emergency or urgent medical service.`,
    paragraphs: [
      'If you are experiencing a life-threatening emergency, including severe difficulty breathing, chest pain, signs of a stroke or a severe allergic reaction, call 999 immediately.',
      'For urgent medical advice that cannot wait, contact your GP or NHS 111.',
      `Do not wait for a medication review, appointment or response from ${brand}.`,
    ],
  };
}

export function shortEmergencyWarning(brand: string): EmergencyCopy {
  return {
    heading: 'Not an emergency service',
    paragraphs: [
      `${brand} does not provide urgent or emergency care and is not monitored 24/7. For a life-threatening emergency, call 999. For urgent medical advice, contact your GP or NHS 111. Do not wait for our response.`,
    ],
  };
}

export function emergencyText(copy: EmergencyCopy): string {
  return [copy.heading, ...copy.paragraphs].join('\n\n');
}
