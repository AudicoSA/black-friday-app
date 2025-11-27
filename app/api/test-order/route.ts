import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getOpenCartClient, buildOrderPayload } from '@/lib/opencart';

// TEST ENDPOINT - Remove in production
// Manually triggers order creation for a deal token
export async function POST(request: NextRequest) {
  try {
    const { token, pfPaymentId } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Get deal from Supabase
    const { data: deal, error: dealError } = await supabase
      .from('dynamic_deals')
      .select('*')
      .eq('token', token)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found', details: dealError }, { status: 404 });
    }

    console.log('Manual order creation for deal:', token);

    // Get product info
    const { data: product } = await supabase
      .from('products')
      .select('id, total_stock, sku, product_name')
      .eq('id', deal.product_id)
      .single();

    // Update deal as paid
    await supabase
      .from('dynamic_deals')
      .update({
        status: 'paid',
        pf_payment_id: pfPaymentId || 'MANUAL-TEST',
      })
      .eq('token', token);

    // Reduce stock
    if (product) {
      const newStock = Math.max(0, product.total_stock - deal.quantity);
      await supabase
        .from('products')
        .update({ total_stock: newStock })
        .eq('id', deal.product_id);
      console.log(`Stock reduced: ${product.total_stock} -> ${newStock}`);
    }

    // Create OpenCart order
    try {
      const opencart = getOpenCartClient();
      let opencartProductId = 0;

      if (product?.sku) {
        const foundProduct = await opencart.findProductBySku(product.sku);
        if (foundProduct) {
          opencartProductId = foundProduct.product_id;
          console.log(`Found OpenCart product_id ${opencartProductId} for SKU ${product.sku}`);
        }
      }

      const orderPayload = buildOrderPayload({
        productId: opencartProductId,
        quantity: deal.quantity,
        customer: {
          firstName: deal.customer_name?.split(' ')[0] || 'Customer',
          lastName: deal.customer_name?.split(' ').slice(1).join(' ') || 'BlackFriday',
          email: deal.customer_email || 'blackfriday@audicoonline.co.za',
          phone: deal.customer_phone || '',
        },
        address: {
          address1: 'Test Address',
          address2: '',
          city: 'Johannesburg',
          province: 'Gauteng',
          postalCode: '2000',
        },
        comment: `Black Friday Deal - Manual Test - Product: ${product?.product_name || 'Unknown'} - Price: R${deal.offer_price}`,
      });

      console.log('Creating OpenCart order:', JSON.stringify(orderPayload, null, 2));

      const orderResult = await opencart.createOrder(orderPayload);

      if (orderResult.success) {
        console.log(`OpenCart order created: ${orderResult.order_id}`);

        await supabase
          .from('dynamic_deals')
          .update({ opencart_order_id: orderResult.order_id })
          .eq('token', token);

        return NextResponse.json({
          success: true,
          message: 'Order created successfully',
          opencart_order_id: orderResult.order_id,
          deal_status: 'paid',
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'OpenCart order failed',
          error: orderResult.error,
          deal_status: 'paid',
        });
      }
    } catch (opencartError: any) {
      console.error('OpenCart error:', opencartError);
      return NextResponse.json({
        success: false,
        message: 'OpenCart error',
        error: opencartError.message,
        deal_status: 'paid',
      });
    }
  } catch (error: any) {
    console.error('Test order error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
