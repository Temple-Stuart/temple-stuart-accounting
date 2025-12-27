'use client';

import React, { useState } from 'react';
import LoginBox from '../LoginBox';

export default function HeroSection() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <section className="relative bg-gradient-to-b from-white to-gray-50 py-20 sm:py-28 lg:py-36">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-[#b4b237]/10 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            <span className="text-sm font-medium text-[#b4b237]">Now Live</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extralight text-gray-900 leading-tight mb-6 tracking-tight">
            Temple Stuart
            <span className="block text-[#b4b237]">OS</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-500 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Financial infrastructure for independent professionals.
            Bookkeeping. Budgeting. Travel planning. One system.
          </p>
          <button 
            onClick={() => setShowLogin(true)}
            className="group inline-flex items-center px-10 py-5 bg-gray-900 text-white font-medium rounded-full hover:bg-[#b4b237] transition-all text-lg shadow-2xl hover:shadow-[#b4b237]/25"
          >
            Enter the OS
            <svg className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="mt-6 text-sm text-gray-400">
            Scroll to explore what's inside ↓
          </p>
        </div>
      </section>

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
