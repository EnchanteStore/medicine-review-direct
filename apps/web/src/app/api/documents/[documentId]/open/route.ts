import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { publicEnv } from '@/lib/env';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MINUTES = 60;

/** Short-lived access to a clean document. Unscanned files stay hidden by RLS. */
export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Sign in required', { status: 401 });
  const { documentId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: document } = await supabase
    .from('documents')
    .select('storage_path, scan_status')
    .eq('id', documentId)
    .eq('scan_status', 'clean')
    .maybeSingle();
  if (!document) return new NextResponse('Not found', { status: 404 });
  const signed = await createSupabaseServiceClient()
    .storage.from('patient-documents')
    .createSignedUrl(document.storage_path, MINUTES);
  const url = signed.data?.signedUrl;
  const supabaseUrl = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
  if (!url || signed.error || !url.startsWith(supabaseUrl)) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.redirect(url);
}
