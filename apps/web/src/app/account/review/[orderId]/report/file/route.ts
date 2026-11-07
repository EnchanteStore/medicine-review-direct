import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Streams the PDF after the database has allowed this person to see the report. */
export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Sign in required', { status: 401 });
  const { orderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('status, pdf_storage_path')
    .eq('order_id', orderId)
    .maybeSingle();
  if (
    !report?.pdf_storage_path ||
    (report.status !== 'released' && report.status !== 'ready_for_release')
  ) {
    return new NextResponse('Not found', { status: 404 });
  }
  const downloaded = await createSupabaseServiceClient()
    .storage.from('clinical-reports')
    .download(report.pdf_storage_path);
  if (downloaded.error || !downloaded.data) return new NextResponse('Not found', { status: 404 });
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="medication-review.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
