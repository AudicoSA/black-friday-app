// Test ALL possible signature encoding strategies
const crypto = require('crypto');
const fs = require('fs');

const MERCHANT_ID = '10000100';
const MERCHANT_KEY = '46f0cd694581a';
const PASSPHRASE = 'jt7NOE43FZPn';

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

// Strategy 1: JavaScript encodeURIComponent (spaces as %20, uppercase hex)
function jsEncode(str) {
  return encodeURIComponent(str);
}

// Strategy 2: PHP urlencode style (spaces as +, lowercase hex)
function phpEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/%([0-9A-F]{2})/g, (_, hex) => '%' + hex.toLowerCase());
}

// Strategy 3: PHP urlencode style (spaces as +, UPPERCASE hex)
function phpEncodeUpper(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

// Strategy 4: JavaScript encode (spaces as %20, lowercase hex)
function jsEncodeLower(str) {
  return encodeURIComponent(str)
    .replace(/%([0-9A-F]{2})/g, (_, hex) => '%' + hex.toLowerCase());
}

function buildString(encoder, includePassphrase) {
  let pfOutput = '';
  for (const [key, value] of Object.entries(testData)) {
    pfOutput += key + '=' + encoder(String(value).trim()) + '&';
  }
  if (includePassphrase) {
    pfOutput += 'passphrase=' + encoder(PASSPHRASE.trim());
  } else {
    pfOutput = pfOutput.slice(0, -1);
  }
  return pfOutput;
}

console.log('=== Testing ALL PayFast Signature Strategies ===\n');

const strategies = [
  { name: 'JS %20 upper + passphrase', encoder: jsEncode, passphrase: true },
  { name: 'JS %20 upper NO passphrase', encoder: jsEncode, passphrase: false },
  { name: 'PHP + lower + passphrase', encoder: phpEncode, passphrase: true },
  { name: 'PHP + lower NO passphrase', encoder: phpEncode, passphrase: false },
  { name: 'PHP + UPPER + passphrase', encoder: phpEncodeUpper, passphrase: true },
  { name: 'PHP + UPPER NO passphrase', encoder: phpEncodeUpper, passphrase: false },
  { name: 'JS %20 lower + passphrase', encoder: jsEncodeLower, passphrase: true },
  { name: 'JS %20 lower NO passphrase', encoder: jsEncodeLower, passphrase: false },
];

const results = [];

for (const strat of strategies) {
  const str = buildString(strat.encoder, strat.passphrase);
  const sig = crypto.createHash('md5').update(str).digest('hex');
  console.log(`${strat.name}:`);
  console.log(`  String: ${str.substring(0, 80)}...`);
  console.log(`  Signature: ${sig}\n`);
  results.push({ ...strat, string: str, signature: sig });
}

// Create individual HTML files for each strategy
let index = 1;
for (const r of results) {
  const formData = { ...testData, signature: r.signature };
  const formFields = Object.entries(formData)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
    .join('\n    ');

  const html = `<!DOCTYPE html>
<html>
<head><title>PayFast Test ${index}</title></head>
<body>
  <h1>Strategy ${index}: ${r.name}</h1>
  <p>Signature: <code>${r.signature}</code></p>
  <p>String sample: <code>${r.string.substring(0, 100)}...</code></p>
  <form action="https://sandbox.payfast.co.za/eng/process" method="post">
    ${formFields}
    <button type="submit" style="padding: 20px 40px; font-size: 18px; background: #0066cc; color: white; border: none; cursor: pointer;">
      Pay R100.00
    </button>
  </form>
  <p><a href="test-strategy-${index + 1}.html">Try next strategy</a></p>
</body>
</html>`;

  fs.writeFileSync(`test-strategy-${index}.html`, html);
  console.log(`Created test-strategy-${index}.html`);
  index++;
}

// Create index page
const indexHtml = `<!DOCTYPE html>
<html>
<head><title>PayFast Signature Strategy Tests</title></head>
<body>
  <h1>PayFast Signature Strategy Tests</h1>
  <p>Click each to test different encoding strategies:</p>
  <ol>
    ${results.map((r, i) => `<li><a href="test-strategy-${i + 1}.html">${r.name}</a> - ${r.signature}</li>`).join('\n    ')}
  </ol>
</body>
</html>`;

fs.writeFileSync('test-index.html', indexHtml);
console.log('\nCreated test-index.html - open this to try all strategies');
