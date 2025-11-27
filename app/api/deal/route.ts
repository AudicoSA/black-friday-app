import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { getDeal, setDeal, updateDeal, getDealsCount, getDealsKeys, type DealData } from '@/lib/deals-store';

// Force cache bust: 2024-11-27

// POST - Create a new deal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, customerEmail, customerPhone, quantity = 1 } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Fetch the product (without stock filter to help debug)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    console.log('Fetching product:', productId);
    console.log('Product result:', product ? `Found: ${product.product_name}` : 'Not found');
    console.log('Product error:', productError?.message || 'none');

    if (productError) {
      console.error('Product fetch error:', productError);
      return NextResponse.json(
        { error: `Product fetch failed: ${productError.message}` },
        { status: 404 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (!product.active) {
      return NextResponse.json(
        { error: 'Product is not active' },
        { status: 400 }
      );
    }

    if (product.total_stock <= 0) {
      return NextResponse.json(
        { error: 'Product is out of stock' },
        { status: 400 }
      );
    }

    console.log('Product cost_price:', product.cost_price, 'selling_price:', product.selling_price);

    // Use cost_price if available, otherwise use selling_price with estimated margin
    let costPrice = product.cost_price;
    if (!costPrice || costPrice <= 0) {
      // Fallback: estimate cost as 60% of selling price (40% margin assumption)
      if (product.selling_price && product.selling_price > 0) {
        costPrice = Math.round(product.selling_price * 0.6);
        console.log('Using estimated cost_price from selling_price:', costPrice);
      } else {
        return NextResponse.json(
          { error: 'Product pricing not available' },
          { status: 400 }
        );
      }
    }

    // Calculate deal price
    const markupPercentage = parseFloat(process.env.MARKUP_PERCENTAGE || '15');
    const offerPrice = Math.round(costPrice * (1 + markupPercentage / 100));

    // Calculate expiry time (20 minutes from now by default)
    const expiryMinutes = parseInt(process.env.DEAL_EXPIRY_MINUTES || '20', 10);
    const expiryTime = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Generate unique token for this deal
    const token = uuidv4();

    // Try to create in Supabase first
    const { error: dealError } = await supabase
      .from('dynamic_deals')
      .insert({
        token,
        product_id: productId,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        quantity,
        cost_price: costPrice,
        markup_percentage: markupPercentage,
        offer_price: offerPrice,
        expiry: expiryTime.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (dealError) {
      // Table doesn't exist - use in-memory store
      console.warn('Supabase dynamic_deals table not found, using in-memory store:', dealError.message);
    }

    // Store in file-based store (persists across workers)
    const dealData: DealData = {
      token,
      product_id: productId,
      product: {
        id: product.id,
        product_name: product.product_name,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
        total_stock: product.total_stock,
      },
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      quantity,
      cost_price: costPrice,
      markup_percentage: markupPercentage,
      offer_price: offerPrice,
      expiry: expiryTime.toISOString(),
      status: 'pending',
    };

    setDeal(token, dealData);

    console.log('Deal created successfully:', token);
    console.log('Total deals in store:', getDealsCount());

    return NextResponse.json({
      deal: {
        token,
        product: {
          id: product.id,
          name: product.product_name,
          brand: product.brand,
          model: product.model,
          sku: product.sku,
        },
        cost_price: costPrice,
        offer_price: offerPrice,
        markup_percentage: markupPercentage,
        quantity,
        expiry: expiryTime.toISOString(),
        stock_available: product.total_stock,
      },
    });
  } catch (error) {
    console.error('Deal creation error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}

// GET - Fetch an existing deal by token
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    // Check file-based store
    const deal = getDeal(token);

    if (deal) {
      // Check if deal has expired
      const now = new Date();
      const expiry = new Date(deal.expiry);

      if (now > expiry && deal.status === 'pending') {
        updateDeal(token, { status: 'expired' });
        return NextResponse.json({ error: 'Deal has expired' }, { status: 410 });
      }

      return NextResponse.json({
        deal: {
          token: deal.token,
          product: {
            id: deal.product.id,
            product_name: deal.product.product_name,
            brand: deal.product.brand,
            model: deal.product.model,
            sku: deal.product.sku,
            total_stock: deal.product.total_stock,
          },
          cost_price: deal.cost_price,
          offer_price: deal.offer_price,
          markup_percentage: deal.markup_percentage,
          quantity: deal.quantity,
          expiry: deal.expiry,
          status: deal.status,
          customer_email: deal.customer_email,
          stock_available: deal.product.total_stock,
        },
      });
    }

    // Fallback to Supabase
    const supabase = createServerSupabase();

    const { data: supabaseDeal, error: dealError } = await supabase
      .from('dynamic_deals')
      .select(`
        *,
        products:product_id (
          id,
          product_name,
          brand,
          model,
          sku,
          total_stock
        )
      `)
      .eq('token', token)
      .single();

    if (dealError || !supabaseDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Check if deal has expired
    const now = new Date();
    const expiry = new Date(supabaseDeal.expiry);

    if (now > expiry && supabaseDeal.status === 'pending') {
      await supabase
        .from('dynamic_deals')
        .update({ status: 'expired' })
        .eq('token', token);

      return NextResponse.json({ error: 'Deal has expired' }, { status: 410 });
    }

    return NextResponse.json({
      deal: {
        token: supabaseDeal.token,
        product: supabaseDeal.products,
        cost_price: supabaseDeal.cost_price,
        offer_price: supabaseDeal.offer_price,
        markup_percentage: supabaseDeal.markup_percentage,
        quantity: supabaseDeal.quantity,
        expiry: supabaseDeal.expiry,
        status: supabaseDeal.status,
        stock_available: supabaseDeal.products?.total_stock || 0,
      },
    });
  } catch (error) {
    console.error('Deal fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 });
  }
}
