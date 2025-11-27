/**
 * OpenCart REST Admin API Client
 * For creating orders after PayFast payment success
 */

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

export interface OpenCartCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  adminUsername: string;
  adminPassword: string;
}

export interface OrderProduct {
  product_id: number;
  quantity: number;
  option?: Record<string, string>;
}

export interface OrderCustomer {
  customer_id?: number;
  firstname: string;
  lastname: string;
  email: string;
  telephone: string;
}

export interface OrderAddress {
  firstname: string;
  lastname: string;
  address_1: string;
  address_2?: string;
  city: string;
  postcode: string;
  country_id: number;
  zone_id: number;
  country?: string;
  zone?: string;
}

export interface PaymentMethod {
  title: string;
  code: string;
}

export interface ShippingMethod {
  title: string;
  code: string;
}

export interface CreateOrderPayload {
  products: OrderProduct[];
  customer: OrderCustomer;
  payment_address: OrderAddress;
  shipping_address: OrderAddress;
  payment_method: PaymentMethod;
  shipping_method: ShippingMethod;
  comment?: string;
  voucher?: string;
  coupon?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
}

class OpenCartClient {
  private config: OpenCartCredentials;
  private bearer: string = '';
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      baseUrl: process.env.OPENCART_BASE_URL || 'https://www.audicoonline.co.za',
      clientId: process.env.OPENCART_CLIENT_ID || 'demo_oauth_client',
      clientSecret: process.env.OPENCART_CLIENT_SECRET || 'demo_oauth_secret',
      adminUsername: process.env.OPENCART_ADMIN_USERNAME || 'admin',
      adminPassword: process.env.OPENCART_ADMIN_PASSWORD || '',
    };
  }

  private ocRoute(route: string): string {
    const sep = this.config.baseUrl.endsWith('/') ? '' : '/';
    return `${this.config.baseUrl}${sep}index.php?route=${route}`;
  }

  private async jsonFetch(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: any }> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });

      const json = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        json,
      };
    } catch (error: any) {
      console.error(`HTTP request failed to ${url}:`, error.message);
      throw error;
    }
  }

  private async getBearerToken(): Promise<string> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const url = this.ocRoute('rest/admin_security/gettoken&grant_type=client_credentials');

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    });

    if (!ok) {
      throw new Error(`Token failed (${status}): ${JSON.stringify(json)}`);
    }

    const token = json?.data?.access_token || json?.access_token;
    if (!token) {
      throw new Error('Missing access_token in response');
    }

    return token;
  }

  private async adminLogin(bearer: string): Promise<void> {
    const url = this.ocRoute('rest/admin_security/login');

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        username: this.config.adminUsername,
        password: this.config.adminPassword,
      }),
    });

    if (!ok || !json?.success) {
      throw new Error(`Admin login failed (${status}): ${JSON.stringify(json)}`);
    }
  }

  async authenticate(): Promise<void> {
    // Check if token is still valid (with 5 minute buffer)
    if (this.bearer && Date.now() < this.tokenExpiry - 300000) {
      return;
    }

    this.bearer = await this.getBearerToken();
    await this.adminLogin(this.bearer);

    // Token typically expires in 1 hour
    this.tokenExpiry = Date.now() + 3600000;
  }

  /**
   * Search for a product by SKU to get the OpenCart product_id
   */
  async findProductBySku(sku: string): Promise<{ product_id: number } | null> {
    await this.authenticate();

    const url = `${this.config.baseUrl}/api/rest_admin/products/search/${encodeURIComponent(sku)}`;

    const { ok, json } = await this.jsonFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.bearer}` },
    });

    if (!ok || !json?.success || !json?.data?.length) {
      return null;
    }

    // Find exact SKU match
    const exactMatch = json.data.find(
      (p: any) => p.sku?.toLowerCase() === sku.toLowerCase()
    );

    if (exactMatch) {
      return { product_id: parseInt(exactMatch.product_id, 10) };
    }

    return null;
  }

  /**
   * Create an order in OpenCart
   */
  async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
    await this.authenticate();

    const url = this.ocRoute('rest/order_admin/orderadmin');

    console.log('Creating OpenCart order with payload:', JSON.stringify(payload, null, 2));

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.bearer}` },
      body: JSON.stringify(payload),
    });

    console.log('OpenCart order response:', JSON.stringify(json, null, 2));

    if (!ok || !json?.success) {
      return {
        success: false,
        error: json?.error || json?.message || `Order creation failed (${status})`,
      };
    }

    return {
      success: true,
      order_id: json?.data?.order_id || json?.order_id,
    };
  }

  /**
   * Get zone ID from province name
   */
  getZoneId(province: string): number {
    const normalized = province.toLowerCase().trim();
    return SA_ZONES[normalized] || SA_ZONES['gauteng']; // Default to Gauteng
  }

  /**
   * Get zone name from zone ID
   */
  getZoneName(zoneId: number): string {
    const entry = Object.entries(SA_ZONES).find(([, id]) => id === zoneId);
    if (entry) {
      return entry[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return 'Gauteng';
  }
}

// Singleton instance
let opencartClient: OpenCartClient | null = null;

export function getOpenCartClient(): OpenCartClient {
  if (!opencartClient) {
    opencartClient = new OpenCartClient();
  }
  return opencartClient;
}

/**
 * Helper function to build order payload from deal data
 */
export function buildOrderPayload(options: {
  productId: number;
  quantity: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  address: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
  };
  comment?: string;
}): CreateOrderPayload {
  const client = getOpenCartClient();
  const zoneId = client.getZoneId(options.address.province);
  const zoneName = client.getZoneName(zoneId);

  const address: OrderAddress = {
    firstname: options.customer.firstName,
    lastname: options.customer.lastName,
    address_1: options.address.address1,
    address_2: options.address.address2 || '',
    city: options.address.city,
    postcode: options.address.postalCode,
    country_id: SA_COUNTRY_ID,
    zone_id: zoneId,
    country: 'South Africa',
    zone: zoneName,
  };

  return {
    products: [
      {
        product_id: options.productId,
        quantity: options.quantity,
        option: {},
      },
    ],
    customer: {
      customer_id: 0, // Guest checkout
      firstname: options.customer.firstName,
      lastname: options.customer.lastName,
      email: options.customer.email,
      telephone: options.customer.phone,
    },
    payment_address: address,
    shipping_address: address,
    payment_method: {
      title: 'PayFast',
      code: 'payfast',
    },
    shipping_method: {
      title: 'Store Pickup - Black Friday Deal',
      code: 'pickup.pickup',
    },
    comment: options.comment || 'Black Friday Deal - Paid via PayFast',
  };
}

export default OpenCartClient;
