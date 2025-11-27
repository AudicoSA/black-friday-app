import crypto from 'crypto';

// =============================================================================
// PayFast Configuration - Uses environment variables
// Set PAYFAST_SANDBOX=true for sandbox mode, false or omit for production
// Production passphrase can be empty if your account doesn't use one
// =============================================================================

const USE_SANDBOX = process.env.PAYFAST_SANDBOX === 'true';

export const PAYFAST_CONFIG = {
  merchantId: process.env.PAYFAST_MERCHANT_ID || '',
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || '',
  passphrase: process.env.PAYFAST_PASSPHRASE || '', // Can be empty for production
  sandbox: USE_SANDBOX,
};

// Log config on startup (without sensitive data)
console.log('PayFast Config:', {
  merchantId: PAYFAST_CONFIG.merchantId,
  sandbox: PAYFAST_CONFIG.sandbox,
  hasPassphrase: !!PAYFAST_CONFIG.passphrase,
});

// PayFast URLs - use getter to evaluate at runtime
export const PAYFAST_URLS = {
  get process() {
    return PAYFAST_CONFIG.sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  },
  get validate() {
    return PAYFAST_CONFIG.sandbox
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate';
  },
};

// PayFast valid IP addresses for ITN verification
export const PAYFAST_IPS = [
  '197.97.145.144',
  '197.97.145.145',
  '197.97.145.146',
  '197.97.145.147',
  '41.74.179.192',
  '41.74.179.193',
  '41.74.179.194',
  '41.74.179.195',
  // Sandbox IPs
  '197.97.145.35',
  '197.97.145.36',
];

export interface PayFastPaymentData {
  [key: string]: string | number | undefined;
  // Merchant details
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  // Buyer details
  name_first?: string;
  name_last?: string;
  email_address?: string;
  cell_number?: string;
  // Transaction details
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
  custom_str1?: string; // Product ID
  custom_str2?: string; // Customer identifier
  custom_str3?: string;
  custom_str4?: string;
  custom_str5?: string;
  custom_int1?: number;
  custom_int2?: number;
  custom_int3?: number;
  custom_int4?: number;
  custom_int5?: number;
  // Security
  signature?: string;
}

// PayFast field order (from official PHP SDK)
const PAYFAST_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'notify_method',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'email_confirmation',
  'confirmation_address',
  'currency',
  'payment_method',
  'subscription_type',
  'passphrase',
  'billing_date',
  'recurring_amount',
  'frequency',
  'cycles',
  'subscription_notify_email',
  'subscription_notify_webhook',
  'subscription_notify_buyer',
];

/**
 * PHP-style URL encoding with spaces as +
 */
function phpUrlEncode(str: string): string {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

/**
 * Generate PayFast signature - Strategy 5 (CONFIRMED WORKING)
 * PHP-style encoding with uppercase hex and passphrase
 */
export function generateSignature(
  data: Record<string, string | number | undefined>,
  passphrase: string
): string {
  // Build parameter string in correct field order
  let pfOutput = '';

  for (const field of PAYFAST_FIELD_ORDER) {
    if (field === 'passphrase') continue;

    const value = data[field];
    if (value !== undefined && value !== '' && value !== null) {
      pfOutput += `${field}=${phpUrlEncode(String(value).trim())}&`;
    }
  }

  // Add passphrase
  if (passphrase && passphrase.trim() !== '') {
    pfOutput += `passphrase=${phpUrlEncode(passphrase.trim())}&`;
  }

  // Remove last ampersand
  const getString = pfOutput.slice(0, -1);

  console.log('PayFast signature string:', getString);

  return crypto.createHash('md5').update(getString).digest('hex');
}

/**
 * Build PayFast payment form data
 * IMPORTANT: Fields must be in the exact order specified by PayFast documentation
 * for signature generation to work correctly.
 */
export function buildPaymentData(options: {
  token: string;
  amount: number;
  itemName: string;
  productId: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): PayFastPaymentData {
  // PayFast requires fields in a SPECIFIC ORDER for signature generation
  // Order: merchant_id, merchant_key, return_url, cancel_url, notify_url,
  //        name_first, name_last, email_address, cell_number,
  //        m_payment_id, amount, item_name, item_description,
  //        custom fields...

  const orderedData: Record<string, string | number | undefined> = {};

  // 1. Merchant details (required, in order)
  orderedData.merchant_id = PAYFAST_CONFIG.merchantId;
  orderedData.merchant_key = PAYFAST_CONFIG.merchantKey;

  // 2. URLs (in order)
  orderedData.return_url = options.returnUrl;
  orderedData.cancel_url = options.cancelUrl;
  orderedData.notify_url = options.notifyUrl;

  // 3. Buyer details (optional, but must be in this position if present)
  if (options.customerName) {
    const names = options.customerName.split(' ');
    orderedData.name_first = names[0];
    orderedData.name_last = names.slice(1).join(' ') || names[0];
  }
  if (options.customerEmail) {
    orderedData.email_address = options.customerEmail;
  }
  if (options.customerPhone) {
    orderedData.cell_number = options.customerPhone;
  }

  // 4. Transaction details (required, in order)
  orderedData.m_payment_id = options.token;
  orderedData.amount = options.amount.toFixed(2);
  orderedData.item_name = options.itemName.substring(0, 100); // Max 100 chars

  // 5. Custom fields (optional)
  orderedData.custom_str1 = options.productId;

  // Generate signature with ordered data
  const signature = generateSignature(orderedData, PAYFAST_CONFIG.passphrase);

  // Return as PayFastPaymentData with signature
  return {
    ...orderedData,
    signature,
  } as PayFastPaymentData;
}

/**
 * Verify PayFast ITN (Instant Transaction Notification)
 */
export async function verifyITN(
  postData: Record<string, string>,
  sourceIP: string,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string }> {
  // 1. Check source IP (skip in sandbox mode for local testing)
  if (!PAYFAST_CONFIG.sandbox && !PAYFAST_IPS.includes(sourceIP)) {
    return { valid: false, error: `Invalid source IP: ${sourceIP}` };
  }

  // 2. Verify signature
  const receivedSignature = postData.signature;
  delete postData.signature;

  const calculatedSignature = generateSignature(postData, PAYFAST_CONFIG.passphrase);

  if (receivedSignature !== calculatedSignature) {
    return { valid: false, error: 'Signature mismatch' };
  }

  // 3. Verify amount
  const receivedAmount = parseFloat(postData.amount_gross || '0');
  if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
    return {
      valid: false,
      error: `Amount mismatch: expected ${expectedAmount}, got ${receivedAmount}`
    };
  }

  // 4. Server confirmation (POST back to PayFast)
  try {
    const validateUrl = PAYFAST_URLS.validate;
    const paramString = Object.entries(postData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const response = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paramString,
    });

    const result = await response.text();

    if (result !== 'VALID') {
      return { valid: false, error: `PayFast validation failed: ${result}` };
    }
  } catch (error) {
    return {
      valid: false,
      error: `PayFast validation request failed: ${error}`
    };
  }

  return { valid: true };
}

/**
 * Generate HTML form for PayFast redirect
 */
export function generatePaymentForm(data: PayFastPaymentData): string {
  const formFields = Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${String(value).replace(/"/g, '&quot;')}">`
    )
    .join('\n');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to PayFast...</title>
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          font-family: system-ui, -apple-system, sans-serif;
          color: white;
        }
        .loader {
          text-align: center;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #ff6b35;
          animation: spin 1s ease-in-out infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="loader">
        <div class="spinner"></div>
        <p>Redirecting to PayFast for secure payment...</p>
      </div>
      <form id="pfForm" action="${PAYFAST_URLS.process}" method="post">
        ${formFields}
      </form>
      <script>document.getElementById('pfForm').submit();</script>
    </body>
    </html>
  `;
}
