class SimpleSwapPayment {
  constructor(config = {}) {
    this.config = {
      referralId: config.referralId || 'lightning-payment',
      defaultProvider: 'mercuryo',
      baseUrl: 'https://simpleswap.io',
      ...config
    };
  }

  /**
   * Generate payment URL for SimpleSwap with Mercuryo
   * @param {Object} options - Payment options
   * @param {number} options.amount - Amount in USD
   * @param {string} options.fromCurrency - Source currency (default: USD)
   * @param {string} options.toCurrency - Target crypto (default: MATIC)
   * @param {string} options.toNetwork - Target network (default: polygon)
   * @param {string} options.destinationAddress - Crypto destination address
   * @param {string} options.email - Optional customer email
   * @returns {Object} Payment URL and tracking data
   */
  generatePaymentUrl(options) {
    const {
      amount,
      fromCurrency = 'USD',
      toCurrency = 'MATIC',
      toNetwork = 'polygon',
      destinationAddress,
      email = '',
      customRef = ''
    } = options;

    // Validate inputs
    if (!amount || amount < 10 || amount > 1000) {
      throw new Error('Amount must be between $10 and $1000');
    }

    if (!destinationAddress) {
      throw new Error('Destination address is required');
    }

    // Build SimpleSwap URL parameters
    const params = new URLSearchParams({
      from: fromCurrency.toLowerCase(),
      to: `${toCurrency.toLowerCase()}-${toNetwork.toLowerCase()}`,
      amount: amount.toString(),
      address: destinationAddress,
      provider: this.config.defaultProvider,
      ref: customRef || this.config.referralId,
      source: 'api-integration',
      utm_source: 'crypto-checkout',
      utm_medium: 'payment_link',
      utm_campaign: 'fiat_to_crypto'
    });

    // Add optional email for notifications
    if (email) {
      params.append('email', email);
    }

    // Add tracking parameters
    params.append('t', Date.now());
    params.append('session_id', this.generateSessionId());

    const paymentUrl = `${this.config.baseUrl}/buy-crypto?${params.toString()}`;

    return {
      paymentUrl,
      paymentId: this.generatePaymentId(),
      trackingData: {
        amount,
        fromCurrency,
        toCurrency,
        toNetwork,
        destinationAddress,
        provider: this.config.defaultProvider,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate alternative URLs for different providers
   */
  generateAlternativeUrls(baseOptions) {
    const providers = ['mercuryo', 'moonpay', 'transak'];
    const alternatives = {};

    providers.forEach(provider => {
      const params = new URLSearchParams({
        from: baseOptions.fromCurrency.toLowerCase(),
        to: `${baseOptions.toCurrency.toLowerCase()}-${baseOptions.toNetwork.toLowerCase()}`,
        amount: baseOptions.amount.toString(),
        address: baseOptions.destinationAddress,
        provider: provider,
        ref: this.config.referralId
      });

      alternatives[provider] = `${this.config.baseUrl}/buy-crypto?${params.toString()}`;
    });

    return alternatives;
  }

  /**
   * Generate unique payment ID
   */
  generatePaymentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `PAY-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Generate session ID for tracking
   */
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate Polygon address
   */
  validatePolygonAddress(address) {
    const polygonAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return polygonAddressRegex.test(address);
  }

  /**
   * Calculate estimated MATIC amount based on USD
   * Note: This is an estimate - actual rate determined by SimpleSwap
   */
  estimateMaticAmount(usdAmount, maticPrice = 0.75) {
    return (usdAmount / maticPrice).toFixed(2);
  }

  /**
   * Format payment data for storage/tracking
   */
  formatPaymentData(paymentUrl, options) {
    return {
      id: this.generatePaymentId(),
      url: paymentUrl,
      shortUrl: this.generateShortUrl(paymentUrl),
      amount: options.amount,
      fromCurrency: options.fromCurrency,
      toCurrency: options.toCurrency,
      toNetwork: options.toNetwork,
      destinationAddress: options.destinationAddress,
      provider: this.config.defaultProvider,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      metadata: {
        userAgent: options.userAgent || '',
        ipAddress: options.ipAddress || '',
        referrer: options.referrer || ''
      }
    };
  }

  /**
   * Generate shortened URL (placeholder - implement URL shortener)
   */
  generateShortUrl(longUrl) {
    // In production, integrate with URL shortener service
    const id = Math.random().toString(36).substr(2, 8);
    return `https://pay.link/${id}`;
  }
}

module.exports = SimpleSwapPayment;