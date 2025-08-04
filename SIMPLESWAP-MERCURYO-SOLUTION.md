# SimpleSwap + Mercuryo Integration Solution

## The Working Solution

After extensive research and testing, here's how to properly use SimpleSwap with Mercuryo as the default provider for $15 USD to Polygon MATIC conversions.

## Key URLs and Parameters

### 1. Direct Mercuryo Widget (Most Reliable)
```
https://exchange.mercuryo.io/?widget_id=67f0e89b-c77f-4c67-ad7e-b2d2ea7a7e4e&type=buy&currency=MATIC&network=POLYGON&fiat_currency=USD&fiat_amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C
```

**Parameters:**
- `widget_id`: SimpleSwap's Mercuryo widget ID
- `type`: buy
- `currency`: MATIC
- `network`: POLYGON
- `fiat_currency`: USD
- `fiat_amount`: 15
- `address`: Your wallet address
- `fix_fiat`: true (optional)
- `theme`: light/dark (optional)

### 2. SimpleSwap Buy Crypto URL
```
https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C&provider=mercuryo
```

**Parameters:**
- `from`: usd (lowercase)
- `to`: matic-polygon (crypto-network format)
- `amount`: 15
- `address`: Destination wallet
- `provider`: mercuryo (attempts to pre-select)

## Implementation Files

### 1. `simpleswap-mercuryo.html`
- Dual-button approach
- Direct Mercuryo widget link (primary)
- SimpleSwap link (backup)
- Mobile-optimized design

### 2. Key Features
- **No iframe attempts** (blocked by CSP)
- **Direct redirects** to payment providers
- **localStorage tracking** for payment status
- **Mobile-friendly** responsive design

## The Reality Check

### What Works ✅
1. **Direct Mercuryo Widget**: Goes straight to Mercuryo's hosted checkout
2. **Customer KYC**: Customer handles their own verification
3. **No Merchant KYB**: You don't need business verification
4. **Instant Settlement**: MATIC sent directly to wallet

### What Doesn't Work ❌
1. **No API Control**: Can't track payments programmatically
2. **No Customization**: Can't change Mercuryo's UI
3. **No Commission**: Unless you have affiliate agreement
4. **URL Parameters**: SimpleSwap may ignore provider selection

## Mobile Considerations

### The Problem
- SimpleSwap's provider selection UI differs on mobile
- URL parameters don't guarantee Mercuryo selection
- Mobile browsers have stricter redirect policies

### The Solution
1. **Primary**: Direct Mercuryo widget link
2. **Fallback**: SimpleSwap with provider parameter
3. **User Education**: Clear instructions on page

## Production Deployment

### Step 1: Update Configuration
```javascript
// config.js
const PAYMENT_CONFIG = {
    amount: 15,
    currency: 'USD',
    crypto: 'MATIC',
    network: 'POLYGON',
    address: '0xE5173e7c3089bD89cd1341b637b8e1951745ED5C',
    mercuryoWidgetId: '67f0e89b-c77f-4c67-ad7e-b2d2ea7a7e4e'
};
```

### Step 2: Deploy Files
- `/simpleswap-mercuryo.html` - Main payment page
- `/payment-success.html` - Return URL page

### Step 3: Test Flow
1. Click "Buy with Mercuryo"
2. Complete KYC if required
3. Pay with card
4. MATIC sent to wallet
5. Return to success page

## Limitations & Honesty

### What This Is
- A redirect wrapper to payment providers
- Zero control over payment process
- Customer handles all compliance

### What This Isn't
- An integrated payment system
- A way to avoid regulations
- A commission-earning solution

### The Truth
This is essentially a branded link to Mercuryo/SimpleSwap. You have:
- No webhook notifications
- No payment tracking
- No customer data
- No revenue share

## Better Alternatives

### Option 1: MoonPay Whitelabel
```javascript
// Requires basic KYB (1 day)
const moonpayUrl = `https://buy.moonpay.com?apiKey=${API_KEY}&defaultCurrencyCode=MATIC_POLYGON`;
```

### Option 2: Direct Mercuryo Partnership
- Contact: partners@mercuryo.io
- Get official widget ID
- Earn commission on transactions
- Access to webhooks and API

### Option 3: Transak Widget
```javascript
// Also requires KYB but easier
const transakUrl = `https://global.transak.com?apiKey=${API_KEY}&cryptoCurrencyCode=MATIC`;
```

## Conclusion

The current solution "works" in that:
1. Customers can buy MATIC with fiat
2. You don't need KYB
3. It works on mobile

But it's not a real integration. For production use, consider:
1. Getting proper KYB (it's not that hard)
2. Using official partner APIs
3. Building actual value beyond redirects

## Live URLs

- **Payment Page**: https://lightning-payment-system-7xzy4.ondigitalocean.app/simpleswap-mercuryo.html
- **Direct Mercuryo**: Click "Buy with Mercuryo" button
- **SimpleSwap Route**: Click "Alternative: SimpleSwap" button

Remember: This is a workaround, not a solution. For real business, get proper integrations.