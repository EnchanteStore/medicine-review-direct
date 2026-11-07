import 'server-only';
import type { ServiceProduct } from '@mrd/domain';
import { createSupabaseAnonClient } from './supabase/server';

export type ProductsResult = { ok: true; products: ServiceProduct[] } | { ok: false };

/**
 * Active products and prices from the database. There is deliberately no
 * hard-coded fallback: prices are server-controlled, so if they cannot be
 * loaded the page says so rather than showing a possibly stale price.
 */
export async function getActiveProducts(): Promise<ProductsResult> {
  try {
    const supabase = createSupabaseAnonClient();
    const { data, error } = await supabase
      .from('products')
      .select('code, name, description, price_pence, standard_price_pence, currency, is_active')
      .eq('is_active', true)
      .order('display_order');
    if (error || !data) return { ok: false };
    return {
      ok: true,
      products: data.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        pricePence: p.price_pence,
        standardPricePence: p.standard_price_pence,
        currency: 'GBP',
        isActive: p.is_active,
      })),
    };
  } catch {
    return { ok: false };
  }
}
