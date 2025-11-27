'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function CancelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-700 to-gray-600 p-8 text-center">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Cancelled</h1>
            <p className="text-white/80">Your deal was not completed</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-6">
              <h3 className="text-yellow-400 font-semibold mb-2">Don&apos;t worry!</h3>
              <p className="text-gray-400 text-sm">
                Your deal may still be available. If you changed your mind or experienced an issue,
                you can try again before the timer expires.
              </p>
            </div>

            {token && (
              <p className="text-gray-500 text-sm text-center mb-4">
                Reference: {token.slice(0, 8)}...
              </p>
            )}

            <Link
              href="/"
              className="block w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-center rounded-xl hover:from-red-500 hover:to-orange-500 transition-all"
            >
              Search for a New Deal
            </Link>

            <p className="text-gray-500 text-xs text-center mt-4">
              Need help? Contact us at info@audicoonline.co.za
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CancelContent />
    </Suspense>
  );
}
