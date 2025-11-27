import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client (uses anon key - safe for browser)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_URL!.includes('supabase.co')
    ? process.env.SUPABASE_SERVICE_KEY! // For server-side we need service key
    : process.env.NEXT_PUBLIC_SUPABASE_URL! // Fallback
);

// Server-side Supabase client (uses service key - server only)
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Product type from Supabase
export interface Product {
  id: string;
  product_name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  description: string | null;
  cost_price: number | null;
  selling_price: number | null;
  total_stock: number;
  active: boolean;
  created_at: string;
}

// Deal type for the dynamic deals table
export interface Deal {
  id: string;
  token: string;
  product_id: string;
  customer_email: string | null;
  customer_phone: string | null;
  quantity: number;
  cost_price: number;
  markup_percentage: number;
  offer_price: number;
  expiry: string;
  status: 'pending' | 'accepted' | 'paid' | 'expired' | 'cancelled';
  order_id: string | null;
  pf_payment_id: string | null;
  created_at: string;
}
