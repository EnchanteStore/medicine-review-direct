import { checkUpload } from '@mrd/validation';
import { logSafe } from './log';
import { supabase } from './api';

export async function uploadPatientDocument(input: {
  orderId: string;
  userId: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<string> {
  const head = input.bytes.slice(0, 16);
  const check = checkUpload({
    name: input.name,
    type: input.mimeType,
    size: input.bytes.byteLength,
    head,
  });
  if (!check.ok) return check.error;
  const path = `${input.userId}/${input.orderId}/${crypto.randomUUID()}-${check.safeName}`;
  const uploaded = await supabase()
    .storage.from('patient-documents')
    .upload(path, input.bytes, { contentType: check.mimeType, upsert: false });
  if (uploaded.error) {
    logSafe('upload_failed');
    return 'The file could not be uploaded. Please try again.';
  }
  const registered = await supabase().rpc('register_document', {
    p_order_id: input.orderId,
    p_storage_path: path,
    p_filename: check.safeName,
    p_mime: check.mimeType,
    p_size: input.bytes.byteLength,
  });
  if (registered.error) {
    logSafe('register_document_failed', registered.error.code);
    return 'The file was stored but could not be added to this review.';
  }
  logSafe('document_uploaded');
  return 'Your file has been uploaded. It is waiting for a security scan. No scanner is connected, so a pharmacist cannot see it yet.';
}
