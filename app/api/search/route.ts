import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const supabase = createServerSupabase();

    // Search products using full-text search and ILIKE for fuzzy matching
    const { data: products, error } = await supabase
      .from('products')
      .select('id, product_name, brand, model, sku, cost_price, selling_price, total_stock')
      .gt('total_stock', 0)
      .or(`product_name.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`)
      .order('product_name')
      .limit(10);

    console.log('Search results for', query, ':', products?.length, 'products found');

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Calculate deal price for each product (cost + 15%)
    const markupPercentage = parseFloat(process.env.MARKUP_PERCENTAGE || '15');

    const productsWithDealPrice = products.map((product) => ({
      ...product,
      deal_price: product.cost_price
        ? Math.round(product.cost_price * (1 + markupPercentage / 100))
        : null,
      markup_percentage: markupPercentage,
      in_stock: product.total_stock > 0,
    }));

    return NextResponse.json({ products: productsWithDealPrice });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
