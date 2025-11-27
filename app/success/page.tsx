'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

interface DealDetails {
  token: string;
  product: {
    id: string;
    product_name: string;
    brand: string | null;
    model: string | null;
  };
  offer_price: number;
  quantity: number;
  customer_email: string | null;
  status: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [deal, setDeal] = useState<DealDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No deal reference found');
      setLoading(false);
      return;
    }

    const fetchDeal = async () => {
      try {
        const response = await fetch(`/api/deal?token=${token}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setDeal(data.deal);
        }
      } catch {
        setError('Failed to load deal details');
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [token]);

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {loading ? (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading order details...</p>
          </div>
        ) : error ? (
          <div className="bg-gray-800 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-xl hover:from-red-500 hover:to-orange-500 transition-all"
            >
              Try Again
            </Link>
          </div>
        ) : deal ? (
          <div className="bg-gray-800 rounded-3xl overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
              <p className="text-white/80">Your Black Friday deal is confirmed</p>
            </div>

            {/* Order Details */}
            <div className="p-6">
              <div className="bg-black/30 rounded-2xl p-4 mb-4">
                <p className="text-gray-400 text-sm mb-1">{deal.product.brand}</p>
                <p className="text-white font-semibold text-lg">{deal.product.product_name}</p>
                {deal.product.model && (
                  <p className="text-gray-500 text-sm">Model: {deal.product.model}</p>
                )}
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Amount Paid</span>
                <span className="text-2xl font-bold text-green-400">
                  {formatCurrency(deal.offer_price * deal.quantity)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Reference</span>
                <span className="text-white font-mono text-sm">{token?.slice(0, 8)}...</span>
              </div>

              {deal.customer_email && (
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Confirmation sent to</span>
                  <span className="text-white text-sm">{deal.customer_email}</span>
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <h3 className="text-blue-400 font-semibold mb-2">What&apos;s Next?</h3>
                <ul className="text-gray-400 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">1.</span>
                    You&apos;ll receive an email confirmation shortly
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">2.</span>
                    Our team will contact you to arrange collection or delivery
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400">3.</span>
                    Questions? Call us at 011 xxx xxxx
                  </li>
                </ul>
              </div>

              <Link
                href="/"
                className="block w-full mt-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-center rounded-xl hover:from-red-500 hover:to-orange-500 transition-all"
              >
                Find Another Deal
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
