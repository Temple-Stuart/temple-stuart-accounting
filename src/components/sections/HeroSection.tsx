'use client';

import React, { useState } from 'react';
import LoginBox from '../LoginBox';

export default function HeroSection() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <section className="relative bg-white py-12 sm:py-16 lg:py-24 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
            
            {/* Left Content - The Story */}
            <div className="space-y-6 lg:space-y-8">
              <div className="space-y-4 lg:space-y-6">
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#b4b237]">
                    A Personal Finance Operating System
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-gray-900 leading-tight">
                    Built for the digital nomad lifestyle
                  </h1>
                </div>
                
                <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                  I left my corporate job in August 2025, cashed out my 401k, and started building the financial OS I wish I had. One platform to manage personal finances, run a business, and plan a year of travel — all in one place.
                </p>
              </div>

              {/* The Vision */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Bookkeeping Engine</h3>
                    <p className="text-gray-600 text-xs sm:text-sm">Double-entry ledger synced with your bank accounts — always audit-ready</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Smart Budgeting Tools</h3>
                    <p className="text-gray-600 text-xs sm:text-sm">Travel planner, meal budgets, activity costs — each COA gets its own tool</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Plan Your Year</h3>
                    <p className="text-gray-600 text-xs sm:text-sm">Book flights, find housing, order groceries — all from one dashboard</p>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <button 
                  onClick={() => setShowLogin(true)}
                  className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-full hover:shadow-xl transition-all"
                >
                  Enter Temple Stuart OS
                </button>
                <a 
                  href="#the-journey" 
                  className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 border border-gray-300 text-gray-700 font-medium rounded-full hover:border-[#b4b237] hover:text-[#b4b237] transition-all"
                >
                  Read the Story
                </a>
              </div>
            </div>

            {/* Right Visual - The Lifestyle */}
            <div className="relative lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
                <div className="bg-gradient-to-br from-[#b4b237]/10 via-purple-50 to-white p-6 sm:p-8 lg:p-12">
                  <div className="space-y-4 sm:space-y-6">
                    
                    {/* Header */}
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#b4b237] to-[#9a9630] flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-[#b4b237] uppercase tracking-wide">The Mission</p>
                        <p className="text-lg sm:text-xl font-light text-gray-900">Explore & Build</p>
                      </div>
                    </div>

                    {/* Goals */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-gray-600">Mountains & Slopes</span>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">Snowboard</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-gray-600">Tropical Islands</span>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">Surf & Kite</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-gray-600">Open Water</span>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">Sail</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-gray-600">Digital Nomad Hubs</span>
                          <span className="text-xs sm:text-sm font-medium text-gray-900">Build & Connect</span>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-500">Status</span>
                        <span className="flex items-center text-green-600 font-medium">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                          Building in Public
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
