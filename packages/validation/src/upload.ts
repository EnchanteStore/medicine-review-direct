export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = {
  'application/pdf': { label: 'PDF', magic: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { label: 'JPEG', magic: [[0xff, 0xd8, 0xff]] },
  'image/png': { label: 'PNG', magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
} as const;

export type AllowedUploadType = keyof typeof ALLOWED_UPLOAD_TYPES;

export type UploadCheck =
  { ok: true; mimeType: AllowedUploadType; safeName: string } | { ok: false; error: string };

/** Strips paths and unusual characters; keeps the extension. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-120);
  return cleaned.replace(/^\.+/, '') || 'document';
}

/**
 * Checks size, declared type and the file's leading bytes (so a renamed file
 * cannot pretend to be a PDF or image). This is not malware scanning.
 */
export function checkUpload(file: {
  name: string;
  type: string;
  size: number;
  head: Uint8Array;
}): UploadCheck {
  if (file.size === 0) return { ok: false, error: 'The selected file is empty' };
  if (file.size > MAX_UPLOAD_BYTES)
    return { ok: false, error: 'The selected file must be smaller than 10MB' };
  const def = ALLOWED_UPLOAD_TYPES[file.type as AllowedUploadType];
  if (!def) return { ok: false, error: 'The selected file must be a PDF, JPG or PNG' };
  const matches = def.magic.some((sig) => sig.every((b, i) => file.head[i] === b));
  if (!matches) return { ok: false, error: 'The selected file must be a PDF, JPG or PNG' };
  return { ok: true, mimeType: file.type as AllowedUploadType, safeName: safeFilename(file.name) };
}
