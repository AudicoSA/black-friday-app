/**
 * OpenCart Direct Database Integration
 * Creates orders directly in OpenCart MySQL database
 */

import mysql from 'mysql2/promise';

const config = {
  host: process.env.OPENCART_DB_HOST || 'localhost',
  port: parseInt(process.env.OPENCART_DB_PORT || '3306'),
  user: process.env.OPENCART_DB_USER || '',
  password: process.env.OPENCART_DB_PASSWORD || '',
  database: process.env.OPENCART_DB_NAME || '',
};

const TABLE_PREFIX = process.env.OPENCART_TABLE_PREFIX || 'oc_';

// South Africa zone IDs for OpenCart
export const SA_ZONES: Record<string, number> = {
  'eastern cape': 3099,
  'free state': 3100,
  'gauteng': 3101,
  'kwazulu-natal': 3102,
  'kzn': 3102,
  'limpopo': 3103,
  'mpumalanga': 3104,
  'north west': 3105,
  'northern cape': 3106,
  'western cape': 3107,
};

export const SA_COUNTRY_ID = 198;

interface OrderData {
  customer: {
    firstname: string;
    lastname: string;
    email: string;
    telephone: string;
  };
  address: {
    address1: string;
    address2?: string;
    city: string;
    postcode: string;
    zone_id: number;
    zone: string;
  };
  product: {
    product_id: number;
    name: string;
    model: string;
    sku: string;
    quantity: number;
    price: number;
    total: number;
  };
  payment: {
    method: string;
    code: string;
  };
  shipping: {
    method: string;
    code: string;
  };
  comment: string;
  total: number;
}

async function getConnection() {
  return mysql.createConnection(config);
}

/**
 * Find OpenCart product_id by SKU
 */
export async function findProductBySku(sku: string): Promise<{ product_id: number; name: string; model: string; price: number } | null> {
  const conn = await getConnection();

  try {
    // Try exact match first
    let [rows] = await conn.execute(
      `SELECT p.product_id, pd.name, p.model, p.price
       FROM ${TABLE_PREFIX}product p
       LEFT JOIN ${TABLE_PREFIX}product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1
       WHERE p.sku = ? LIMIT 1`,
      [sku]
    ) as any;

    if (rows.length > 0) {
      return rows[0];
    }

    // Try without suffix (e.g., 5758_en-gb-ZAR -> 5758)
    const baseSku = sku.split('_')[0];
    if (baseSku !== sku) {
      [rows] = await conn.execute(
        `SELECT p.product_id, pd.name, p.model, p.price
         FROM ${TABLE_PREFIX}product p
         LEFT JOIN ${TABLE_PREFIX}product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1
         WHERE p.sku = ? OR p.sku LIKE ? LIMIT 1`,
        [baseSku, `${baseSku}%`]
      ) as any;

      if (rows.length > 0) {
        return rows[0];
      }
    }

    // Try searching by product_id if SKU is numeric
    if (/^\d+$/.test(baseSku)) {
      [rows] = await conn.execute(
        `SELECT p.product_id, pd.name, p.model, p.price
         FROM ${TABLE_PREFIX}product p
         LEFT JOIN ${TABLE_PREFIX}product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1
         WHERE p.product_id = ? LIMIT 1`,
        [parseInt(baseSku)]
      ) as any;

      if (rows.length > 0) {
        return rows[0];
      }
    }

    return null;
  } finally {
    await conn.end();
  }
}

/**
 * Create order in OpenCart database
 */
export async function createOrder(data: OrderData): Promise<{ success: boolean; order_id?: number; error?: string }> {
  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Get store info
    const [storeRows] = await conn.execute(
      `SELECT * FROM ${TABLE_PREFIX}store WHERE store_id = 0`
    ) as any;
    const store = storeRows[0] || { name: 'Audico Online', url: 'https://www.audicoonline.co.za' };

    // Get currency
    const [currencyRows] = await conn.execute(
      `SELECT * FROM ${TABLE_PREFIX}currency WHERE code = 'ZAR' OR status = 1 ORDER BY code = 'ZAR' DESC LIMIT 1`
    ) as any;
    const currency = currencyRows[0] || { code: 'ZAR', value: 1 };

    // Insert order
    const [orderResult] = await conn.execute(
      `INSERT INTO ${TABLE_PREFIX}order SET
        invoice_prefix = 'BF-',
        store_id = 0,
        store_name = ?,
        store_url = ?,
        customer_id = 0,
        customer_group_id = 1,
        firstname = ?,
        lastname = ?,
        email = ?,
        telephone = ?,
        payment_firstname = ?,
        payment_lastname = ?,
        payment_address_1 = ?,
        payment_address_2 = ?,
        payment_city = ?,
        payment_postcode = ?,
        payment_country = 'South Africa',
        payment_country_id = ?,
        payment_zone = ?,
        payment_zone_id = ?,
        payment_method = ?,
        payment_code = ?,
        shipping_firstname = ?,
        shipping_lastname = ?,
        shipping_address_1 = ?,
        shipping_address_2 = ?,
        shipping_city = ?,
        shipping_postcode = ?,
        shipping_country = 'South Africa',
        shipping_country_id = ?,
        shipping_zone = ?,
        shipping_zone_id = ?,
        shipping_method = ?,
        shipping_code = ?,
        comment = ?,
        total = ?,
        order_status_id = 15,
        currency_id = ?,
        currency_code = ?,
        currency_value = ?,
        ip = '0.0.0.0',
        user_agent = 'Black Friday App',
        date_added = ?,
        date_modified = ?`,
      [
        store.name,
        store.url,
        data.customer.firstname,
        data.customer.lastname,
        data.customer.email,
        data.customer.telephone,
        data.customer.firstname,
        data.customer.lastname,
        data.address.address1,
        data.address.address2 || '',
        data.address.city,
        data.address.postcode,
        SA_COUNTRY_ID,
        data.address.zone,
        data.address.zone_id,
        data.payment.method,
        data.payment.code,
        data.customer.firstname,
        data.customer.lastname,
        data.address.address1,
        data.address.address2 || '',
        data.address.city,
        data.address.postcode,
        SA_COUNTRY_ID,
        data.address.zone,
        data.address.zone_id,
        data.shipping.method,
        data.shipping.code,
        data.comment,
        data.total,
        currency.currency_id || 1,
        currency.code,
        currency.value,
        now,
        now
      ]
    ) as any;

    const orderId = orderResult.insertId;

    // Insert order product
    await conn.execute(
      `INSERT INTO ${TABLE_PREFIX}order_product SET
        order_id = ?,
        product_id = ?,
        name = ?,
        model = ?,
        quantity = ?,
        price = ?,
        total = ?,
        tax = 0,
        reward = 0`,
      [
        orderId,
        data.product.product_id,
        data.product.name,
        data.product.model,
        data.product.quantity,
        data.product.price,
        data.product.total
      ]
    );

    // Insert order totals
    const totals = [
      { code: 'sub_total', title: 'Sub-Total', value: data.total, sort_order: 1 },
      { code: 'total', title: 'Total', value: data.total, sort_order: 9 },
    ];

    for (const t of totals) {
      await conn.execute(
        `INSERT INTO ${TABLE_PREFIX}order_total SET
          order_id = ?,
          code = ?,
          title = ?,
          value = ?,
          sort_order = ?`,
        [orderId, t.code, t.title, t.value, t.sort_order]
      );
    }

    // Insert order history
    await conn.execute(
      `INSERT INTO ${TABLE_PREFIX}order_history SET
        order_id = ?,
        order_status_id = 15,
        notify = 1,
        comment = ?,
        date_added = ?`,
      [orderId, 'Order created via Black Friday App - Payment confirmed via PayFast', now]
    );

    // Update product quantity (reduce stock)
    await conn.execute(
      `UPDATE ${TABLE_PREFIX}product SET quantity = quantity - ? WHERE product_id = ?`,
      [data.product.quantity, data.product.product_id]
    );

    await conn.commit();

    console.log(`OpenCart order created successfully: Order ID ${orderId}`);
    return { success: true, order_id: orderId };

  } catch (error: any) {
    await conn.rollback();
    console.error('OpenCart DB error:', error);
    return { success: false, error: error.message };
  } finally {
    await conn.end();
  }
}

/**
 * Get zone info from province name
 */
export function getZoneInfo(province: string): { zone_id: number; zone: string } {
  const normalized = province.toLowerCase().trim();
  const zone_id = SA_ZONES[normalized] || SA_ZONES['gauteng'];

  // Get zone name
  const entry = Object.entries(SA_ZONES).find(([, id]) => id === zone_id);
  const zone = entry ? entry[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Gauteng';

  return { zone_id, zone };
}
