import fs from 'fs';
import path from 'path';

// File-based store for deals - persists across workers and hot reloads
const DEALS_FILE = path.join(process.cwd(), '.deals-store.json');

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
}

function readDeals(): Map<string, DealData> {
  try {
    if (fs.existsSync(DEALS_FILE)) {
      const data = fs.readFileSync(DEALS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Error reading deals store:', error);
  }
  return new Map();
}

function writeDeals(deals: Map<string, DealData>): void {
  try {
    const data = Object.fromEntries(deals);
    fs.writeFileSync(DEALS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing deals store:', error);
  }
}

export function getDeal(token: string): DealData | undefined {
  const deals = readDeals();
  return deals.get(token);
}

export function setDeal(token: string, deal: DealData): void {
  const deals = readDeals();
  deals.set(token, deal);
  writeDeals(deals);
}

export function updateDeal(token: string, updates: Partial<DealData>): DealData | undefined {
  const deals = readDeals();
  const existing = deals.get(token);
  if (existing) {
    const updated = { ...existing, ...updates };
    deals.set(token, updated);
    writeDeals(deals);
    return updated;
  }
  return undefined;
}

export function deleteDeal(token: string): boolean {
  const deals = readDeals();
  const deleted = deals.delete(token);
  if (deleted) {
    writeDeals(deals);
  }
  return deleted;
}

export function getAllDeals(): Map<string, DealData> {
  return readDeals();
}

export function getDealsCount(): number {
  return readDeals().size;
}

export function getDealsKeys(): string[] {
  return Array.from(readDeals().keys());
}
