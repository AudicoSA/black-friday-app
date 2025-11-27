'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

interface Product {
  id: string;
  product_name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  cost_price: number | null;
  selling_price: number | null;
  deal_price: number | null;
  total_stock: number;
  markup_percentage: number;
  in_stock: boolean;
}

interface Deal {
  token: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    sku: string | null;
  };
  cost_price: number;
  offer_price: number;
  markup_percentage: number;
  quantity: number;
  expiry: string;
  stock_available: number;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Shipping threshold
  const FREE_SHIPPING_THRESHOLD = 1000;
  const SHIPPING_FEE = 150;

  // SA Provinces
  const provinces = [
    'Gauteng',
    'Western Cape',
    'KwaZulu-Natal',
    'Eastern Cape',
    'Free State',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
  ];

  // Search for products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProducts([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setProducts(data.products || []);
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, searchProducts]);

  // Countdown timer
  useEffect(() => {
    if (!deal) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(deal.expiry).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setDeal(null);
        setError('Your deal has expired. Please search again.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deal]);

  // Create a deal
  const createDeal = async (product: Product) => {
    setIsCreatingDeal(true);
    setError(null);

    try {
      const response = await fetch('/api/deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerEmail,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setDeal(data.deal);
        setSelectedProduct(product);
        setProducts([]);
        setSearchQuery('');
        setQuantity(1); // Reset quantity for new deal
      }
    } catch {
      setError('Failed to create deal. Please try again.');
    } finally {
      setIsCreatingDeal(false);
    }
  };

  // Validate form
  const isFormValid = () => {
    return (
      customerName.trim() &&
      customerEmail.trim() &&
      customerPhone.trim() &&
      address1.trim() &&
      city.trim() &&
      province &&
      postalCode.trim()
    );
  };

  // Process payment
  const processPayment = async () => {
    if (!deal) return;

    if (!isFormValid()) {
      setError('Please fill in all required fields including delivery address.');
      return;
    }

    setIsProcessingPayment(true);
    setError(null);

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: deal.token,
          customerEmail,
          customerPhone,
          customerName,
          quantity,
          shipping: getShipping(),
          address: {
            address1,
            address2,
            city,
            province,
            postalCode,
          },
        }),
      });

      if (response.headers.get('content-type')?.includes('text/html')) {
        // PayFast redirect form - inject and submit
        const html = await response.text();
        document.open();
        document.write(html);
        document.close();
      } else {
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        }
      }
    } catch {
      setError('Payment initiation failed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  // Calculate order totals
  const getSubtotal = () => deal ? deal.offer_price * quantity : 0;
  const getShipping = () => getSubtotal() >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const getTotal = () => getSubtotal() + getShipping();

  return (
    <div className="min-h-screen relative">
      {/* Background Image with Overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/nyn-bg.png)' }}
      />
      <div className="fixed inset-0 bg-slate-900/85" />

      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-cyan-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Audico"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </div>
          <div className="text-right">
            <p className="text-cyan-400 font-semibold text-sm">BLACK FRIDAY</p>
            <p className="text-slate-400 text-xs">TODAY ONLY</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!deal && (
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Name Your <span className="text-cyan-400">Need</span>
            </h2>
            <p className="text-slate-400 text-lg mb-2">
              AI calculates your best price
            </p>
          </div>
        )}

        {/* Search Section */}
        {!deal && (
          <div className="relative mb-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for any audio/visual product..."
                className="w-full px-6 py-4 text-lg bg-slate-800/80 border-2 border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Search Results */}
            {products.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => createDeal(product)}
                    disabled={isCreatingDeal}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors text-left border-b border-slate-700 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{product.product_name}</p>
                      <p className="text-slate-400 text-sm">
                        {product.brand} {product.model && `| ${product.model}`}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      {product.deal_price ? (
                        <>
                          <p className="text-cyan-400 font-bold text-lg">
                            {formatCurrency(product.deal_price)}
                          </p>
                          {product.selling_price && product.selling_price > product.deal_price && (
                            <p className="text-slate-500 text-sm line-through">
                              {formatCurrency(product.selling_price)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-slate-500">Price on request</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Deal Card */}
        {deal && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
            {/* Countdown Banner */}
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 flex items-center justify-between">
              <p className="text-white font-semibold">Deal Expires In:</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white font-mono">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-white/80 text-sm">left</span>
              </div>
            </div>

            {/* Product Info */}
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-1">{deal.product.brand}</p>
                <h3 className="text-2xl font-bold text-white">{deal.product.name}</h3>
                {deal.product.model && (
                  <p className="text-slate-500 text-sm">Model: {deal.product.model}</p>
                )}
              </div>

              {/* Pricing with Quantity Selector */}
              <div className="bg-black/30 rounded-2xl p-6 mb-6">
                <div className="text-center mb-4">
                  <p className="text-slate-400 text-sm mb-2">Your Black Friday Price</p>
                  <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                    {formatCurrency(deal.offer_price)}
                  </p>
                  <p className="text-slate-500 text-sm">per unit</p>
                </div>

                {/* Quantity Selector */}
                <div className="flex items-center justify-center gap-4 mb-4 py-3 border-t border-b border-slate-700">
                  <label className="text-slate-400 text-sm">Quantity:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={deal.stock_available}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(deal.stock_available, parseInt(e.target.value) || 1)))}
                      className="w-16 h-10 text-center bg-slate-800 border border-slate-600 rounded-lg text-white font-bold focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(deal.stock_available, quantity + 1))}
                      className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal ({quantity} × {formatCurrency(deal.offer_price)})</span>
                    <span>{formatCurrency(getSubtotal())}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping</span>
                    {getShipping() === 0 ? (
                      <span className="text-green-400">FREE</span>
                    ) : (
                      <span>{formatCurrency(SHIPPING_FEE)}</span>
                    )}
                  </div>
                  {getSubtotal() < FREE_SHIPPING_THRESHOLD && (
                    <p className="text-xs text-amber-400 text-center pt-1">
                      Add {formatCurrency(FREE_SHIPPING_THRESHOLD - getSubtotal())} more for free shipping!
                    </p>
                  )}
                  <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-slate-700">
                    <span>Total</span>
                    <span className="text-cyan-400">{formatCurrency(getTotal())}</span>
                  </div>
                </div>

                <p className="text-green-400 text-sm mt-4 text-center">
                  {deal.stock_available > 0 ? `${deal.stock_available} in stock` : 'Limited availability'}
                </p>
              </div>

              {/* Customer Info Form */}
              <div className="space-y-4 mb-6">
                <h4 className="text-white font-semibold border-b border-slate-700 pb-2">Your Details</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="082 123 4567"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <h4 className="text-white font-semibold border-b border-slate-700 pb-2 pt-4">Delivery Address</h4>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Street Address *</label>
                  <input
                    type="text"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Apartment, Suite, etc. (optional)</label>
                  <input
                    type="text"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder="Unit 5, Block A"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Johannesburg"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Province *</label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">Select Province</option>
                      {provinces.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="md:w-1/2">
                  <label className="block text-slate-400 text-sm mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="2000"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <p className="text-slate-500 text-xs">* Required fields</p>
              </div>

              {/* Pay Button */}
              <button
                onClick={processPayment}
                disabled={isProcessingPayment || timeLeft === 0 || !isFormValid()}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/25"
              >
                {isProcessingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Pay ${formatCurrency(getTotal())} Now`
                )}
              </button>

              {/* Cancel Link */}
              <button
                onClick={() => {
                  setDeal(null);
                  setSelectedProduct(null);
                }}
                className="w-full mt-3 py-2 text-slate-500 hover:text-slate-400 text-sm transition-colors"
              >
                Cancel and search again
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 py-6 mt-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Audico Black Friday 2025 |
            <a href="https://www.audicoonline.co.za" className="text-cyan-400 hover:text-cyan-300 ml-1">
              www.audicoonline.co.za
            </a>
          </p>
          <p className="text-slate-600 text-xs mt-2">
            Deals valid while stocks last. Free delivery on orders over R1,000.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
