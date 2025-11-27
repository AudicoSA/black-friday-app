// In-memory store for deals - used as a cache, Supabase is the source of truth
// Note: On Vercel, file system is read-only, so we can only use in-memory cache

export interface DealData {
  token: string;
  product_id: string;
  product: {
    id: string;
    product_name: string;
    brand: string | null;
    model: string | null;
    sku: string | null;
    total_stock: number;
  };
  customer_email: string | null;
  customer_phone: string | null;
  customer_name?: string;
  address?: any;
  quantity: number;
  cost_price: number;
  markup_percentage: number;
  offer_price: number;
  expiry: string;
  status: string;
  opencart_order_id?: number;
}

// In-memory cache (will be lost on cold starts, but Supabase is the source of truth)
const dealsCache = new Map<string, DealData>();

export function getDeal(token: string): DealData | undefined {
  return dealsCache.get(token);
}

export function setDeal(token: string, deal: DealData): void {
  dealsCache.set(token, deal);
}

export function updateDeal(token: string, updates: Partial<DealData>): DealData | undefined {
  const existing = dealsCache.get(token);
  if (existing) {
    const updated = { ...existing, ...updates };
    dealsCache.set(token, updated);
    return updated;
  }
  return undefined;
}

export function deleteDeal(token: string): boolean {
  return dealsCache.delete(token);
}

export function getAllDeals(): Map<string, DealData> {
  return dealsCache;
}

export function getDealsCount(): number {
  return dealsCache.size;
}

export function getDealsKeys(): string[] {
  return Array.from(dealsCache.keys());
}
