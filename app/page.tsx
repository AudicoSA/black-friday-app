'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-red-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center font-bold text-white">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AudicoOnline</h1>
              <p className="text-xs text-red-400">BLACK FRIDAY 2024</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-red-500 font-semibold text-sm animate-pulse">LIVE DEALS</p>
            <p className="text-gray-400 text-xs">Cost + 15% Only!</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!deal && (
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Name Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Need</span>
            </h2>
            <p className="text-gray-400 text-lg mb-2">
              Tell us what you&apos;re looking for and get an instant Black Friday deal
            </p>
            <p className="text-red-400 font-semibold">
              Our Cost + 15% = Your Price
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
                className="w-full px-6 py-4 text-lg bg-gray-800/80 border-2 border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results */}
            {products.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => createDeal(product)}
                    disabled={isCreatingDeal}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors text-left border-b border-gray-700 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{product.product_name}</p>
                      <p className="text-gray-400 text-sm">
                        {product.brand} {product.model && `| ${product.model}`}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      {product.deal_price ? (
                        <>
                          <p className="text-red-400 font-bold text-lg">
                            {formatCurrency(product.deal_price)}
                          </p>
                          {product.selling_price && product.selling_price > product.deal_price && (
                            <p className="text-gray-500 text-sm line-through">
                              {formatCurrency(product.selling_price)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-gray-500">Price on request</p>
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
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-700">
            {/* Countdown Banner */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-3 flex items-center justify-between">
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
                <p className="text-gray-400 text-sm mb-1">{deal.product.brand}</p>
                <h3 className="text-2xl font-bold text-white">{deal.product.name}</h3>
                {deal.product.model && (
                  <p className="text-gray-500 text-sm">Model: {deal.product.model}</p>
                )}
              </div>

              {/* Pricing */}
              <div className="bg-black/30 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Our Cost</p>
                    <p className="text-white font-semibold text-lg">
                      {formatCurrency(deal.cost_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Markup</p>
                    <p className="text-orange-400 font-semibold text-lg">
                      +{deal.markup_percentage}%
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-sm mb-1">Your Black Friday Price</p>
                  <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                    {formatCurrency(deal.offer_price)}
                  </p>
                </div>
                <p className="text-green-400 text-sm mt-2">
                  {deal.stock_available > 0 ? `${deal.stock_available} in stock` : 'Limited availability'}
                </p>
              </div>

              {/* Customer Info Form */}
              <div className="space-y-4 mb-6">
                <h4 className="text-white font-semibold border-b border-gray-700 pb-2">Your Details</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="082 123 4567"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <h4 className="text-white font-semibold border-b border-gray-700 pb-2 pt-4">Delivery Address</h4>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Street Address *</label>
                  <input
                    type="text"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Apartment, Suite, etc. (optional)</label>
                  <input
                    type="text"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder="Unit 5, Block A"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Johannesburg"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Province *</label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-red-500"
                    >
                      <option value="">Select Province</option>
                      {provinces.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="md:w-1/2">
                  <label className="block text-gray-400 text-sm mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="2000"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <p className="text-gray-500 text-xs">* Required fields. Delivery fees will be quoted after order confirmation.</p>
              </div>

              {/* Pay Button */}
              <button
                onClick={processPayment}
                disabled={isProcessingPayment || timeLeft === 0 || !isFormValid()}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/25"
              >
                {isProcessingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Pay ${formatCurrency(deal.offer_price)} Now`
                )}
              </button>

              {/* Cancel Link */}
              <button
                onClick={() => {
                  setDeal(null);
                  setSelectedProduct(null);
                }}
                className="w-full mt-3 py-2 text-gray-500 hover:text-gray-400 text-sm transition-colors"
              >
                Cancel and search again
              </button>
            </div>
          </div>
        )}

        {/* How It Works */}
        {!deal && (
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-white text-center mb-8">How It Works</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">1</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Search</h4>
                <p className="text-gray-400 text-sm">
                  Type the product you&apos;re looking for - any audio or visual equipment
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">2</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Get Your Price</h4>
                <p className="text-gray-400 text-sm">
                  See our actual cost and pay just 15% more - complete transparency
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">3</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Pay & Collect</h4>
                <p className="text-gray-400 text-sm">
                  Secure payment via PayFast - collect from our store or arrange delivery
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black/50 border-t border-gray-800 py-6 mt-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            AudicoOnline Black Friday 2024 |
            <a href="https://www.audicoonline.co.za" className="text-red-400 hover:text-red-300 ml-1">
              www.audicoonline.co.za
            </a>
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Deals valid while stocks last. Prices exclude delivery.
          </p>
        </div>
      </footer>
    </div>
  );
}
