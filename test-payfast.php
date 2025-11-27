<?php
// Test PayFast signature generation using their exact PHP logic

$passPhrase = 'jt7NOE43FZPn';

// Test data matching what we send from JS
$data = [
    'merchant_id' => '10000100',
    'merchant_key' => '46f0cd694581a',
    'return_url' => 'http://localhost:3000/success',
    'cancel_url' => 'http://localhost:3000/cancel',
    'notify_url' => 'http://localhost:3000/api/notify',
    'name_first' => 'Test',
    'name_last' => 'User',
    'email_address' => 'test@test.com',
    'm_payment_id' => 'test-123',
    'amount' => '100.00',
    'item_name' => 'Test Item',
];

// PayFast field order from SDK
$fields = [
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

// Filter and sort data according to field order
$sortAttributes = array_filter($data, function ($key) use ($fields) {
    return in_array($key, $fields);
}, ARRAY_FILTER_USE_KEY);

// Add passphrase (URL encoded!)
if ($passPhrase !== null && $passPhrase !== '') {
    $sortAttributes['passphrase'] = urlencode(trim($passPhrase));
}

// Create parameter string
$pfOutput = '';
foreach ($sortAttributes as $attribute => $value) {
    if (!empty($value)) {
        $pfOutput .= $attribute . '=' . urlencode(trim($value)) . '&';
    }
}

// Remove last ampersand
$getString = substr($pfOutput, 0, -1);

echo "=== PayFast PHP Signature Test ===\n\n";
echo "Signature string:\n$getString\n\n";

$signature = md5($getString);
echo "Generated signature: $signature\n";
?>
