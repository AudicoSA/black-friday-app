import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { verifyITN } from '@/lib/payfast';
import { findProductBySku, createOrder, getZoneInfo } from '@/lib/opencart-db';
import { getDeal, updateDeal } from '@/lib/deals-store';

export async function POST(request: NextRequest) {
  console.log('PayFast ITN received');

  try {
    // Get the raw form data
    const formData = await request.formData();
    const postData: Record<string, string> = {};

    formData.forEach((value, key) => {
      postData[key] = value.toString();
    });

    console.log('ITN Data:', JSON.stringify(postData, null, 2));

    // Extract key fields
    const token = postData.m_payment_id;
    const paymentStatus = postData.payment_status;
    const pfPaymentId = postData.pf_payment_id;
    const amountGross = parseFloat(postData.amount_gross || '0');

    if (!token) {
      console.error('No payment ID in ITN');
      return new NextResponse('Invalid ITN: No payment ID', { status: 400 });
    }

    // First check file-based store
    let deal = getDeal(token) as any;
    const supabase = createServerSupabase();

    if (!deal) {
      // Fallback to Supabase
      const { data: supabaseDeal, error: dealError } = await supabase
        .from('dynamic_deals')
        .select('*')
        .eq('token', token)
        .single();

      if (dealError || !supabaseDeal) {
        console.error('Deal not found:', token);
        return new NextResponse('Deal not found', { status: 404 });
      }
      deal = supabaseDeal;
    }

    // Debug: Log deal data to see what we're working with
    console.log('Deal data from store:', JSON.stringify({
      token: deal.token,
      offer_price: deal.offer_price,
      quantity: deal.quantity,
      shipping: deal.shipping,
      status: deal.status,
    }, null, 2));

    // Skip if already processed
    if (deal.status === 'paid') {
      console.log('Deal already paid:', token);
      return new NextResponse('OK', { status: 200 });
    }

    // Get source IP for verification
    const sourceIP =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Calculate expected amount (including shipping)
    // Default quantity to 1 if not set, shipping to 0
    const qty = deal.quantity || 1;
    const ship = deal.shipping || 0;
    const expectedAmount = (deal.offer_price * qty) + ship;
    console.log(`Expected amount calculation: ${deal.offer_price} x ${qty} + ${ship} shipping = ${expectedAmount}`);

    // Verify the ITN
    const verification = await verifyITN(postData, sourceIP, expectedAmount);

    if (!verification.valid) {
      console.error('ITN verification failed:', verification.error);

      // Update deal with error status
      await supabase
        .from('dynamic_deals')
        .update({
          status: 'pending', // Keep as pending so they can retry
          pf_payment_id: pfPaymentId,
        })
        .eq('token', token);

      // Still return 200 to stop retries, but log the issue
      return new NextResponse('OK', { status: 200 });
    }

    // Payment verified - update deal status
    if (paymentStatus === 'COMPLETE') {
      console.log('Payment COMPLETE for deal:', token);

      // Update deal as paid
      const { error: updateError } = await supabase
        .from('dynamic_deals')
        .update({
          status: 'paid',
          pf_payment_id: pfPaymentId,
        })
        .eq('token', token);

      if (updateError) {
        console.error('Failed to update deal:', updateError);
      }

      // Reduce stock in products table
      const { data: product } = await supabase
        .from('products')
        .select('id, total_stock, sku, product_name')
        .eq('id', deal.product_id)
        .single();

      if (product) {
        const newStock = Math.max(0, product.total_stock - deal.quantity);
        await supabase
          .from('products')
          .update({ total_stock: newStock })
          .eq('id', deal.product_id);

        console.log(`Stock reduced for product ${deal.product_id}: ${product.total_stock} -> ${newStock}`);
      }

      // Create order in OpenCart via direct database
      try {
        // Get customer details from deal
        const customerName = deal.customer_name || 'Black Friday Customer';
        const nameParts = customerName.split(' ');
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || firstName;

        // Get address from deal (stored during payment initiation)
        const address = deal.address || {
          address1: 'Address provided via phone',
          address2: '',
          city: 'Johannesburg',
          province: 'Gauteng',
          postalCode: '2000',
        };

        // Find OpenCart product by SKU using direct DB
        let opencartProduct = null;
        if (product?.sku) {
          opencartProduct = await findProductBySku(product.sku);
          if (opencartProduct) {
            console.log(`Found OpenCart product_id ${opencartProduct.product_id} for SKU ${product.sku}`);
          }
        }

        if (!opencartProduct) {
          console.warn(`Could not find OpenCart product for SKU ${product?.sku}. Order will be created with product_id 0.`);
        }

        // Get zone info from province
        const zoneInfo = getZoneInfo(address.province || 'Gauteng');

        // Create order directly in OpenCart database
        const orderResult = await createOrder({
          customer: {
            firstname: firstName,
            lastname: lastName,
            email: deal.customer_email || 'blackfriday@audicoonline.co.za',
            telephone: deal.customer_phone || '',
          },
          address: {
            address1: address.address1,
            address2: address.address2 || '',
            city: address.city,
            postcode: address.postalCode,
            zone_id: zoneInfo.zone_id,
            zone: zoneInfo.zone,
          },
          product: {
            product_id: opencartProduct?.product_id || 0,
            name: opencartProduct?.name || product?.product_name || 'Black Friday Deal',
            model: opencartProduct?.model || '',
            sku: product?.sku || '',
            quantity: deal.quantity,
            price: deal.offer_price,
            total: deal.offer_price * deal.quantity,
          },
          payment: {
            method: 'PayFast',
            code: 'payfast',
          },
          shipping: {
            method: 'Store Pickup - Black Friday Deal',
            code: 'pickup.pickup',
          },
          comment: `Black Friday Deal - PayFast ID: ${pfPaymentId} - Product: ${product?.product_name || 'Unknown'} - Price: R${deal.offer_price}`,
          total: deal.offer_price * deal.quantity,
        });

        if (orderResult.success) {
          console.log(`OpenCart order created successfully via DB: Order ID ${orderResult.order_id}`);

          // Store the OpenCart order ID
          updateDeal(token, { opencart_order_id: orderResult.order_id } as any);

          // Also update Supabase
          await supabase
            .from('dynamic_deals')
            .update({ opencart_order_id: orderResult.order_id })
            .eq('token', token);
        } else {
          console.error(`Failed to create OpenCart order: ${orderResult.error}`);
        }
      } catch (opencartError) {
        console.error('OpenCart order creation error:', opencartError);
        // Don't fail the ITN - payment was successful, just log the error
      }

      // TODO: Send confirmation email (future enhancement)

      console.log('Deal marked as paid:', token);
    } else {
      console.log(`Payment status: ${paymentStatus} for deal: ${token}`);

      // Handle other statuses (CANCELLED, FAILED, etc.)
      if (paymentStatus === 'CANCELLED') {
        await supabase
          .from('dynamic_deals')
          .update({ status: 'cancelled' })
          .eq('token', token);
      }
    }

    // Always return 200 to acknowledge receipt
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('ITN processing error:', error);
    // Return 200 anyway to prevent PayFast retries for server errors
    return new NextResponse('OK', { status: 200 });
  }
}
