'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LoginBox from './LoginBox';

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <header className="w-full bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-6">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/temple-stuart-logo.png"
                alt="Temple Stuart, LLC"
                width={400}
                height={120}
                className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto"
                priority
              />
            </Link>

            {/* Two Buttons */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button 
                onClick={() => setShowLogin(true)}
                className="group inline-flex items-center px-6 sm:px-8 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-[#b4b237] transition-all text-sm sm:text-base shadow-lg hover:shadow-[#b4b237]/25"
              >
                Enter OS
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <a 
                href="mailto:astuart@templestuart.com?subject=Project%20Inquiry"
                className="inline-flex items-center px-6 sm:px-8 py-3 bg-white border-2 border-gray-900 text-gray-900 font-medium rounded-full hover:border-[#b4b237] hover:text-[#b4b237] transition-all text-sm sm:text-base"
              >
                Email
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLogin(false)}
          />
          <div className="relative z-10">
            <LoginBox onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </>
  );
}
