import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { buildPaymentData, generatePaymentForm, PAYFAST_CONFIG } from '@/lib/payfast';
import { getDeal, updateDeal, getDealsCount, getDealsKeys, type DealData } from '@/lib/deals-store';

export async function POST(request: NextRequest) {
  // Debug: Log environment variables
  console.log('=== PayFast Debug ===');
  console.log('Config merchantId:', PAYFAST_CONFIG.merchantId);
  console.log('Config sandbox:', PAYFAST_CONFIG.sandbox);
  console.log('====================');

  try {
    const body = await request.json();
    const { token, customerEmail, customerPhone, customerName, address } = body;

    console.log('Pay request received for token:', token);
    console.log('DealsStore has', getDealsCount(), 'deals');
    console.log('DealsStore keys:', getDealsKeys());

    if (!token) {
      return NextResponse.json({ error: 'Deal token is required' }, { status: 400 });
    }

    // Check file-based store
    let deal = getDeal(token);
    console.log('Deal found in store:', deal ? 'YES' : 'NO');
    if (deal) {
      console.log('Deal status:', deal.status);
    }
    let productName = '';
    let productStock = 0;

    if (deal) {
      // Use file-based deal
      productName = deal.product.product_name;
      productStock = deal.product.total_stock;

      // Check if deal has expired
      const now = new Date();
      const expiry = new Date(deal.expiry);

      if (now > expiry && (deal.status === 'pending' || deal.status === 'accepted')) {
        updateDeal(token, { status: 'expired' });
        return NextResponse.json({ error: 'Deal has expired' }, { status: 410 });
      }

      // Allow pending or accepted deals (accepted = payment started but not completed)
      if (deal.status !== 'pending' && deal.status !== 'accepted') {
        return NextResponse.json(
          { error: 'Deal not found or already processed' },
          { status: 404 }
        );
      }

      // Check stock
      if (productStock < deal.quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }

      // Update deal with customer info and address (file store)
      deal = updateDeal(token, {
        customer_email: customerEmail || deal.customer_email,
        customer_phone: customerPhone || deal.customer_phone,
        customer_name: customerName,
        address: address,
        status: 'accepted',
      }) as DealData;

      // Also update Supabase so ITN can read it (file store doesn't persist on Vercel)
      const supabase = createServerSupabase();
      await supabase
        .from('dynamic_deals')
        .update({
          customer_email: customerEmail || deal.customer_email,
          customer_phone: customerPhone || deal.customer_phone,
          customer_name: customerName,
          address: address,
          status: 'accepted',
        })
        .eq('token', token);
    } else {
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
        .in('status', ['pending', 'accepted'])
        .single();

      if (dealError || !supabaseDeal) {
        return NextResponse.json(
          { error: 'Deal not found or already processed' },
          { status: 404 }
        );
      }

      // Check if deal has expired
      const now = new Date();
      const expiry = new Date(supabaseDeal.expiry);

      if (now > expiry) {
        await supabase
          .from('dynamic_deals')
          .update({ status: 'expired' })
          .eq('token', token);

        return NextResponse.json({ error: 'Deal has expired' }, { status: 410 });
      }

      // Check stock
      if (supabaseDeal.products.total_stock < supabaseDeal.quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }

      // Update deal with customer info and mark as accepted
      await supabase
        .from('dynamic_deals')
        .update({
          customer_email: customerEmail || supabaseDeal.customer_email,
          customer_phone: customerPhone || supabaseDeal.customer_phone,
          customer_name: customerName,
          address: address,
          status: 'accepted',
        })
        .eq('token', token);

      productName = supabaseDeal.products.product_name;
      deal = {
        token: supabaseDeal.token,
        product_id: supabaseDeal.product_id,
        product: supabaseDeal.products,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        quantity: supabaseDeal.quantity,
        cost_price: supabaseDeal.cost_price,
        markup_percentage: supabaseDeal.markup_percentage,
        offer_price: supabaseDeal.offer_price,
        expiry: supabaseDeal.expiry,
        status: 'accepted',
      };
    }

    // Build PayFast payment data
    // Use APP_URL (server-side) or NEXT_PUBLIC_APP_URL or fallback
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('Using app URL:', appUrl);
    const itemName = `Black Friday Deal - ${productName}`.substring(0, 100);

    const paymentData = buildPaymentData({
      token: deal.token,
      amount: deal.offer_price * deal.quantity,
      itemName,
      productId: deal.product_id,
      customerEmail,
      customerPhone,
      customerName,
      returnUrl: `${appUrl}/success?token=${token}`,
      cancelUrl: `${appUrl}/cancel?token=${token}`,
      notifyUrl: `${appUrl}/api/notify`,
    });

    // Generate the redirect form HTML
    const formHtml = generatePaymentForm(paymentData);

    return new NextResponse(formHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
