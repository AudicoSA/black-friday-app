# PayFast Integration Documentation

## WORKING CONFIGURATION (Confirmed 2024-11-27)

### Sandbox Credentials
```
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=jt7NOE43FZPn
PAYFAST_SANDBOX=true
```

### Sandbox URL
```
https://sandbox.payfast.co.za/eng/process
```

### Production URL (when ready)
```
https://www.payfast.co.za/eng/process
```

---

## SIGNATURE GENERATION (Strategy 5 - CONFIRMED WORKING)

### The Critical Function
```typescript
function phpUrlEncode(str: string): string {
  return encodeURIComponent(str).replace(/%20/g, '+');
}
```

### How It Works
1. Use JavaScript's `encodeURIComponent()` which produces **uppercase hex** (`%3A` not `%3a`)
2. Replace `%20` with `+` to match PHP's `urlencode()` behavior
3. Apply this encoding to ALL field values including passphrase

### Signature Generation Steps
1. Loop through fields in **exact order** defined by `PAYFAST_FIELD_ORDER`
2. Skip empty/null/undefined values
3. URL encode each value using `phpUrlEncode()`
4. Build string: `field1=encodedValue1&field2=encodedValue2&...`
5. Add passphrase at the END: `...&passphrase=encodedPassphrase`
6. Remove trailing `&`
7. Generate MD5 hash of the string

### Example Signature String
```
merchant_id=10000100&merchant_key=46f0cd694581a&return_url=http%3A%2F%2Flocalhost%3A3000%2Fsuccess&cancel_url=http%3A%2F%2Flocalhost%3A3000%2Fcancel&notify_url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fnotify&name_first=Test&name_last=User&email_address=test%40test.com&m_payment_id=test-123&amount=100.00&item_name=Test+Item&passphrase=jt7NOE43FZPn
```

### Key Points
- URLs ARE encoded: `http://` becomes `http%3A%2F%2F`
- Spaces become `+`: `Test Item` becomes `Test+Item`
- `@` is encoded: `test@test.com` becomes `test%40test.com`
- Passphrase IS included and IS URL encoded

---

## FIELD ORDER (CRITICAL)

PayFast requires fields in this exact order for signature generation:

```typescript
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
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'email_confirmation',
  'confirmation_address',
  'currency',
  'payment_method',
  'subscription_type',
  'passphrase',  // Always last!
  'billing_date',
  'recurring_amount',
  'frequency',
  'cycles',
  'subscription_notify_email',
  'subscription_notify_webhook',
  'subscription_notify_buyer'
];
```

---

## WHAT DIDN'T WORK (For Reference)

### Failed Strategies
1. **Raw values (no encoding)** - Signature mismatch
2. **encodeURIComponent only** - Signature mismatch (spaces as %20)
3. **Lowercase hex** - Signature mismatch
4. **Without passphrase** - Signature mismatch
5. **Double encoding passphrase** - Signature mismatch
6. **Custom encoding (only &, =, space)** - Signature mismatch

### What DOES Work
- `encodeURIComponent()` with `%20` replaced by `+`
- Passphrase included and encoded the same way
- Uppercase hex encoding (default from encodeURIComponent)

---

## FILE LOCATIONS

### Main PayFast Logic
```
lib/payfast.ts
```

### API Endpoints
```
app/api/pay/route.ts      - Initiates payment, builds form data
app/api/notify/route.ts   - ITN callback from PayFast
```

### Environment Variables
```
.env.local
```

---

## TESTING

### Test HTML File
Open `test-strategy-5.html` in browser - this is the confirmed working test.

### Test Script
```bash
node test-payfast.js
```

### Manual Test
1. Go to http://localhost:3000
2. Search for a product (e.g., "audio")
3. Select product, enter customer details
4. Click "Proceed to Payment"
5. Should redirect to PayFast sandbox
6. Use test card: 5200000000000015, any future expiry, CVV 123

---

## COMMON ISSUES

### "Signature mismatch"
- Check encoding function is using `encodeURIComponent().replace(/%20/g, '+')`
- Verify passphrase is included
- Verify field order matches `PAYFAST_FIELD_ORDER`

### "Deal not found"
- Deals are stored in `.deals-store.json` file
- Check if file exists and has the deal token
- Server restart clears in-memory cache, but file persists

### Server 500 errors
- Delete `.next` folder and restart: `rmdir /s /q .next && npm run dev`
- Kill all Node processes first

---

## PRODUCTION CHECKLIST

1. Change credentials in `.env.local`:
   ```
   PAYFAST_MERCHANT_ID=10009768
   PAYFAST_MERCHANT_KEY=4b860b7614849
   PAYFAST_PASSPHRASE=Payfast2025GEM
   PAYFAST_SANDBOX=false
   ```

2. Update URLs to production domain:
   ```
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

3. Ensure notify_url is publicly accessible (PayFast needs to reach it)

4. Test with a small real payment first

---

## LAST UPDATED
2024-11-27 - Signature generation confirmed working with Strategy 5
