'use client';

import React from 'react';

export default function ModulesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight">
            What's Inside
          </h2>
        </div>

        <div className="space-y-32">

          {/* MODULE 1: BOOKKEEPING */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-4">
                01
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Bookkeeping
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Connect your banks. Categorize transactions. Generate real financial statements your CPA can actually use.
              </p>
              <ul className="space-y-3">
                {['Bank sync via Plaid', 'Double-entry ledger', 'Income statement & balance sheet', 'Full audit trail', 'CPA-ready exports'].map((item, i) => (
                  <li key={i} className="flex items-center text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-[#b4b237]/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-[#b4b237]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Bookkeeping Mockup */}
            <div className="order-1 lg:order-2">
              <div className="bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-100 border-b">
                        <span className="text-sm font-semibold text-gray-700">Income Statement</span>
                      </div>
                      <div className="p-4 space-y-3 text-sm">
                        <div className="flex justify-between text-green-700 font-medium">
                          <span>Revenue</span>
                          <span>$142,500</span>
                        </div>
                        <div className="pl-4 space-y-1 text-gray-600 text-xs">
                          <div className="flex justify-between"><span>Consulting</span><span>$98,000</span></div>
                          <div className="flex justify-between"><span>Product Sales</span><span>$44,500</span></div>
                        </div>
                        <div className="flex justify-between text-red-700 font-medium pt-2 border-t">
                          <span>Expenses</span>
                          <span>$67,340</span>
                        </div>
                        <div className="flex justify-between text-gray-900 font-bold pt-3 border-t-2 border-gray-900">
                          <span>Net Income</span>
                          <span className="text-green-600">$75,160</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MODULE 2: AGENDA & BUDGET */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-lg">Bali Surf Trip</h4>
                          <p className="text-sm text-gray-500">Canggu • March 2025</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Confirmed
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-5">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">A</div>
                          <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">M</div>
                          <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">J</div>
                        </div>
                        <span className="text-sm text-gray-500">3 people</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Flights</span>
                          <span className="font-medium">$1,800</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Accommodation</span>
                          <span className="font-medium">$1,200</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-semibold">
                          <span>Per person</span>
                          <span className="text-[#b4b237]">$1,000</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
                02
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Agenda & Budget
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Plan trips around activities you actually care about. Compare destinations by what matters — waves, trails, nomad scene. Coordinate with your crew and split costs.
              </p>
              <ul className="space-y-3">
                {['Activity-based destination search', 'Compare by stats that matter', 'Group RSVP & availability', 'Shared expense tracking', 'Who owes who, sorted'].map((item, i) => (
                  <li key={i} className="flex items-center text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-[#b4b237]/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-[#b4b237]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* MODULE 3: BUDGET REVIEW */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold mb-4">
                03
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Budget Review
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Set targets. See where you actually land. No surprises at tax time.
              </p>
              <ul className="space-y-3">
                {['Monthly targets by category', 'YTD actuals vs budget', 'Visual progress bars', 'Drill into transactions'].map((item, i) => (
                  <li key={i} className="flex items-center text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-[#b4b237]/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-[#b4b237]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="order-1 lg:order-2">
              <div className="bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="space-y-3">
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">Travel</span>
                          <span className="text-xs text-gray-400">$1,500/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">$14,200 spent</span>
                          <span className="text-gray-900">$18,000 budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#b4b237] rounded-full" style={{width: '79%'}}></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">Software</span>
                          <span className="text-xs text-gray-400">$400/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">$3,800 spent</span>
                          <span className="text-gray-900">$4,800 budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{width: '79%'}}></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">Food</span>
                          <span className="text-xs text-gray-400">$800/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">$8,940 spent</span>
                          <span className="text-gray-900">$9,600 budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full" style={{width: '93%'}}></div>
                        </div>
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
