// Standalone PayFast signature test - MATCHING PHP SDK EXACTLY
// Run with: node test-payfast.js

const crypto = require('crypto');

// Sandbox credentials
const MERCHANT_ID = '10000100';
const MERCHANT_KEY = '46f0cd694581a';
const PASSPHRASE = 'jt7NOE43FZPn';

// PayFast field order from PHP SDK
const PAYFAST_FIELD_ORDER = [
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
  'notify_method', 'name_first', 'name_last', 'email_address', 'cell_number',
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'email_confirmation', 'confirmation_address', 'currency', 'payment_method',
  'subscription_type', 'passphrase', 'billing_date', 'recurring_amount',
  'frequency', 'cycles', 'subscription_notify_email', 'subscription_notify_webhook',
  'subscription_notify_buyer'
];

/**
 * Generate PayFast signature EXACTLY like PHP SDK does:
 * 1. Filter data to include only fields in PAYFAST_FIELD_ORDER
 * 2. Add passphrase (already URL encoded!) to the sortAttributes
 * 3. URL encode all values in the loop
 * 4. MD5 hash
 *
 * KEY INSIGHT: passphrase gets DOUBLE encoded because:
 *   - Line 104: $sortAttributes['passphrase'] = urlencode(trim($passPhrase));
 *   - Line 116: $pfOutput .= $attribute . '=' . urlencode(trim($value)) . '&';
 */
function generateSignature(data, passphrase) {
  // Create sorted attributes - only fields in the order list
  const sortAttributes = {};
  for (const field of PAYFAST_FIELD_ORDER) {
    if (field === 'passphrase') continue;
    if (data[field] !== undefined && data[field] !== '' && data[field] !== null) {
      sortAttributes[field] = String(data[field]);
    }
  }

  // Add passphrase - ALREADY URL ENCODED (this is what PHP SDK does on line 104)
  if (passphrase && passphrase.trim() !== '') {
    sortAttributes['passphrase'] = encodeURIComponent(passphrase.trim());
  }

  // Create parameter string - URL encode all values AGAIN (this is line 116)
  let pfOutput = '';
  for (const [key, value] of Object.entries(sortAttributes)) {
    if (value) {
      pfOutput += `${key}=${encodeURIComponent(String(value).trim())}&`;
    }
  }

  // Remove last ampersand
  const getString = pfOutput.slice(0, -1);

  console.log('\nSignature string:\n', getString);

  return crypto.createHash('md5').update(getString).digest('hex');
}

// Test data (order matters for JS objects in newer Node)
const testData = {
  merchant_id: MERCHANT_ID,
  merchant_key: MERCHANT_KEY,
  return_url: 'http://localhost:3000/success',
  cancel_url: 'http://localhost:3000/cancel',
  notify_url: 'http://localhost:3000/api/notify',
  name_first: 'Test',
  name_last: 'User',
  email_address: 'test@test.com',
  m_payment_id: 'test-123',
  amount: '100.00',
  item_name: 'Test Item',
};

console.log('=== PayFast Signature Test (PHP SDK Match) ===\n');
console.log('Credentials:');
console.log('  Merchant ID:', MERCHANT_ID);
console.log('  Merchant Key:', MERCHANT_KEY);
console.log('  Passphrase:', PASSPHRASE);

const signature = generateSignature(testData, PASSPHRASE);
console.log('\nGenerated signature:', signature);

// Build form HTML
const formData = { ...testData, signature };
const formFields = Object.entries(formData)
  .filter(([_, v]) => v !== undefined && v !== '')
  .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
  .join('\n    ');

const html = `<!DOCTYPE html>
<html>
<head><title>PayFast Test</title></head>
<body>
  <h1>PayFast Sandbox Test (PHP SDK Match)</h1>
  <p>Click the button to test payment:</p>
  <form action="https://sandbox.payfast.co.za/eng/process" method="post">
    ${formFields}
    <button type="submit" style="padding: 20px 40px; font-size: 18px; cursor: pointer;">
      Pay R100.00
    </button>
  </form>
</body>
</html>`;

const fs = require('fs');
fs.writeFileSync('test-payfast.html', html);
console.log('\n✓ Created test-payfast.html');
console.log('\nOpen this file in your browser to test the PayFast payment flow.');
