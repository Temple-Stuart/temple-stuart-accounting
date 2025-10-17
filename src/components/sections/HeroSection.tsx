'use client';

import React from 'react';

export default function HeroSection() {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative bg-white py-12 sm:py-16 lg:py-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          
          {/* Left Content */}
          <div className="space-y-6 lg:space-y-8">
            <div className="space-y-4 lg:space-y-6">
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#b4b237]">
                  Data & Finance Systems
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-gray-900 leading-tight">
                  I build automated systems for growing businesses
                </h1>
              </div>
              
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                Dashboards, pipelines, bookkeeping automation, API integrations — custom-built to eliminate manual work and unlock scale.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Custom Dashboards</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Real-time visibility into your data, built exactly how you need it</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">API Integrations</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Connect your tools, sync your data, automate your workflows</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Finance Automation</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Bookkeeping, reporting, and reconciliation—hands-free</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <a 
                href="#pricing" 
                onClick={(e) => scrollToSection(e, 'pricing')}
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-full hover:shadow-xl transition-all"
              >
                Start a Project
              </a>
              <a 
                href="#case-studies" 
                onClick={(e) => scrollToSection(e, 'case-studies')}
                className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 border border-gray-300 text-gray-700 font-medium rounded-full hover:border-purple-400 hover:text-purple-700 transition-all"
              >
                See My Work
              </a>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
              <div className="bg-gradient-to-br from-[#b4b237]/10 via-purple-50 to-white p-6 sm:p-8 lg:p-12">
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#b4b237] to-[#9a9630] flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#b4b237] uppercase tracking-wide">Live Data</p>
                      <p className="text-lg sm:text-xl font-light text-gray-900">Real-Time Sync</p>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-600">Monthly Revenue</span>
                        <span className="text-base sm:text-lg font-semibold text-gray-900">$142,500</span>
                      </div>
                      <div className="mt-2 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#b4b237] to-[#9a9630]" style={{width: '75%'}}></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-600">Transactions Synced</span>
                        <span className="text-base sm:text-lg font-semibold text-gray-900">2,847</span>
                      </div>
                      <div className="mt-2 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-600 to-purple-700" style={{width: '92%'}}></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-600">Automation Status</span>
                        <span className="text-xs sm:text-sm font-semibold text-green-600">Active</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-1.5 sm:space-x-2">
                        <div className="h-1.5 sm:h-2 flex-1 bg-green-500 rounded-full animate-pulse"></div>
                        <div className="h-1.5 sm:h-2 flex-1 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="h-1.5 sm:h-2 flex-1 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
