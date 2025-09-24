'use client';

import React from 'react';

export default function HeroSection() {
  return (
    <>
      <section className="relative bg-white py-24 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            
            {/* Left Content - Simple, Clear */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237]">
                    Bookkeeping Pipeline
                  </p>
                  <h1 className="text-5xl lg:text-6xl font-light text-gray-900 leading-tight">
                    Take control of your finances
                  </h1>
                </div>
                
                <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                  See all your accounts in one place. Personal and business together. 
                  Make better decisions with real data. Built for people who want to get organized.
                </p>
              </div>

              {/* Simple Benefits */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Everything Connected</h3>
                    <p className="text-gray-600 text-sm">Banks, credit cards, payment processors - all in one dashboard</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Real-Time Updates</h3>
                    <p className="text-gray-600 text-sm">Data imports automatically, books stay current without the work</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2"></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Organized Dashboard</h3>
                    <p className="text-gray-600 text-sm">See where your money goes, make better decisions</p>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex items-center space-x-4">
                <a href="#pricing" className="px-8 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-full hover:shadow-xl transition-all">
                  See Pricing
                </a>
                <a href="#pipeline" className="px-8 py-3 border border-gray-300 text-gray-700 font-medium rounded-full hover:border-purple-400 hover:text-purple-700 transition-all">
                  How It Works
                </a>
              </div>

              {/* Real Trust Indicators */}
              <div className="flex items-center space-x-8 pt-8 border-t border-gray-100">
                <div>
                  <p className="text-2xl font-light text-gray-900">Bank-Grade</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Security</p>
                </div>
                <div>
                  <p className="text-2xl font-light text-gray-900">Real-Time</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Data Import</p>
                </div>
                <div>
                  <p className="text-2xl font-light text-gray-900">One</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Dashboard</p>
                </div>
              </div>
            </div>

            {/* Right Visual - Premium Purple Glass Cube */}
            <div className="relative flex items-center justify-center lg:block">
              <div className="relative w-[450px] h-[450px]">
                
                {/* Glass Cube with Purple Tint */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 perspective-1000">
                  <div className="w-44 h-44 transform-style-preserve-3d animate-rotate-cube">
                    
                    {/* Front face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-400/20 via-purple-500/15 to-purple-600/20 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                         style={{transform: 'translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-lg"></div>
                    </div>
                    
                    {/* Back face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-500/20 via-purple-600/15 to-[#b4b237]/10 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                         style={{transform: 'rotateY(180deg) translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-tl from-white/10 to-transparent rounded-lg"></div>
                    </div>
                    
                    {/* Right face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-[#b4b237]/20 via-[#9a9630]/15 to-purple-500/20 backdrop-blur-md border border-[#b4b237]/30 shadow-2xl rounded-lg" 
                         style={{transform: 'rotateY(90deg) translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-lg"></div>
                    </div>
                    
                    {/* Left face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-400/20 via-purple-500/15 to-[#b4b237]/20 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                         style={{transform: 'rotateY(-90deg) translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-l from-white/10 to-transparent rounded-lg"></div>
                    </div>
                    
                    {/* Top face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-300/25 to-purple-500/20 backdrop-blur-md border border-purple-200/30 shadow-2xl rounded-lg" 
                         style={{transform: 'rotateX(90deg) translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-lg"></div>
                    </div>
                    
                    {/* Bottom face */}
                    <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-600/25 to-[#b4b237]/15 backdrop-blur-md border border-purple-400/30 shadow-2xl rounded-lg" 
                         style={{transform: 'rotateX(-90deg) translateZ(88px)'}}>
                      <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent rounded-lg"></div>
                    </div>
                  </div>
                </div>

                {/* Subtle orbital rings */}
                <div className="absolute inset-0">
                  <div className="absolute inset-8 border border-purple-200/10 rounded-full"></div>
                  <div className="absolute inset-16 border border-[#b4b237]/10 rounded-full"></div>
                  <div className="absolute inset-24 border border-purple-200/5 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          @keyframes rotate-cube {
            from { transform: rotateX(-20deg) rotateY(0deg); }
            to { transform: rotateX(-20deg) rotateY(360deg); }
          }
          .animate-rotate-cube { animation: rotate-cube 30s linear infinite; }
          .transform-style-preserve-3d { transform-style: preserve-3d; }
          .perspective-1000 { perspective: 1000px; }
        `}</style>
      </section>

      {/* Pipeline Section - Clear and Simple */}
      <section id="pipeline" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-4">
              The Complete System
            </p>
            <h2 className="text-4xl font-light text-gray-900 mb-4">
              Double-Entry Bookkeeping Pipeline
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Every transaction gets recorded twice - once as a debit, once as a credit. 
              This catches errors and keeps your books balanced. It's the gold standard of accounting, 
              made simple for regular people.
            </p>
          </div>

          {/* Pipeline Flow */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-12">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { num: "1", title: "Onboard", desc: "Connect accounts" },
                { num: "2", title: "Import", desc: "Gather data" },
                { num: "3", title: "Structure", desc: "Chart of accounts" },
                { num: "4", title: "Record", desc: "Journal entries" },
                { num: "5", title: "Post", desc: "Update ledger" },
                { num: "6", title: "Reconcile", desc: "Match & verify" },
                { num: "7", title: "Adjust", desc: "Fix discrepancies" },
                { num: "8", title: "Report", desc: "Financial statements" },
                { num: "9", title: "Analyze", desc: "3-statement model" },
                { num: "10", title: "Close", desc: "Lock the period" }
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto w-12 h-12 bg-gradient-to-r from-[#b4b237] to-[#9a9630] rounded-full flex items-center justify-center text-white font-bold mb-2">
                    {step.num}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What This Means */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">For Regular People</h3>
              <p className="text-gray-600 text-sm mb-4">
                No accounting degree needed. I handle the technical stuff. 
                You just connect your accounts and get clean reports.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  See all accounts together
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Understand where money goes
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Get organized for taxes
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">For Small Business</h3>
              <p className="text-gray-600 text-sm mb-4">
                Professional books without the accounting firm prices. 
                Perfect for contractors, consultants, online businesses.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Separate business & personal
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Track profit by project
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Financial statements ready
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">What You Get</h3>
              <p className="text-gray-600 text-sm mb-4">
                Three key reports every period that show exactly where you stand financially.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Balance Sheet (what you own/owe)
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Income Statement (profit/loss)
                </li>
                <li className="flex items-start">
                  <span className="text-[#b4b237] mr-2">✓</span>
                  Cash Flow (money in/out)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
