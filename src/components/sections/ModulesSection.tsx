'use client';

import React from 'react';

export default function ModulesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b4b237] mb-3">
            Platform Overview
          </p>
          <h2 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight">
            Three Core Modules
          </h2>
        </div>

        <div className="space-y-32">

          {/* ═══════════════════════════════════════════════════════════════════
              MODULE 1: BOOKKEEPING
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-4">
                MODULE 01
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Bookkeeping
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Real-time bank sync via Plaid. Map every transaction to your Chart of Accounts. 
                Auto-generate trial balance, income statement, and balance sheet — CPA-ready.
              </p>
              <ul className="space-y-3">
                {['Multi-account Plaid integration', 'Double-entry ledger system', 'Income statement & balance sheet', 'General ledger with full audit trail', 'One-click CPA export'].map((item, i) => (
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
                  {/* Browser Chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="bg-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-400 max-w-xs">
                        templestuart.com/dashboard
                      </div>
                    </div>
                  </div>
                  {/* App Content */}
                  <div className="bg-gray-50 p-6">
                    {/* Mini Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#b4b237] rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">TS</span>
                        </div>
                        <span className="font-semibold text-gray-900">Financial Statements</span>
                      </div>
                      <span className="text-xs text-gray-400">2025</span>
                    </div>
                    {/* Income Statement Preview */}
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
                          <div className="flex justify-between"><span>4000 · Consulting</span><span>$98,000</span></div>
                          <div className="flex justify-between"><span>4100 · Product Sales</span><span>$44,500</span></div>
                        </div>
                        <div className="flex justify-between text-red-700 font-medium pt-2 border-t">
                          <span>Expenses</span>
                          <span>$67,340</span>
                        </div>
                        <div className="pl-4 space-y-1 text-gray-600 text-xs">
                          <div className="flex justify-between"><span>5000 · Software</span><span>$12,400</span></div>
                          <div className="flex justify-between"><span>5100 · Travel</span><span>$24,800</span></div>
                          <div className="flex justify-between"><span>5200 · Contractors</span><span>$30,140</span></div>
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

          {/* ═══════════════════════════════════════════════════════════════════
              MODULE 2: TRIP BUDGET
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Trip Budget Mockup */}
            <div>
              <div className="bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="bg-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-400 max-w-xs">
                        templestuart.com/budgets/trips
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-lg">Bali Surf Trip</h4>
                          <p className="text-sm text-gray-500">Canggu, Indonesia • Mar 2025</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Confirmed
                        </span>
                      </div>
                      {/* Participants */}
                      <div className="flex items-center gap-2 mb-5">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">A</div>
                          <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">M</div>
                          <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">J</div>
                          <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">S</div>
                        </div>
                        <span className="text-sm text-gray-500">4 travelers</span>
                      </div>
                      {/* Expense Summary */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Flights</span>
                          <span className="font-medium">$2,400</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Accommodation</span>
                          <span className="font-medium">$1,800</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Activities</span>
                          <span className="font-medium">$600</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-semibold">
                          <span>Total</span>
                          <span>$4,800</span>
                        </div>
                        <div className="flex justify-between text-sm text-[#b4b237]">
                          <span>Per person</span>
                          <span className="font-semibold">$1,200</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
                MODULE 02
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Trip Budget
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Plan solo adventures or coordinate group trips. Track shared expenses, 
                split costs automatically, and know exactly who owes what.
              </p>
              <ul className="space-y-3">
                {['Create trips with dates & destinations', 'Invite travelers with RSVP tracking', 'Log and categorize shared expenses', 'Automatic cost splitting', 'Settlement summary per person'].map((item, i) => (
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

          {/* ═══════════════════════════════════════════════════════════════════
              MODULE 3: ITINERARY BUILDER
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold mb-4">
                MODULE 03
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Itinerary Builder
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Set monthly budgets by category. Track spend vs. budget in real-time. 
                Plan your year with confidence knowing exactly where your money goes.
              </p>
              <ul className="space-y-3">
                {['Budget by Chart of Account category', 'YTD actuals vs. monthly targets', 'Visual progress tracking', 'Drilldown into transactions', 'Calendar integration (coming soon)'].map((item, i) => (
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

            {/* Itinerary Builder Mockup */}
            <div className="order-1 lg:order-2">
              <div className="bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-900">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="bg-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-400 max-w-xs">
                        templestuart.com/hub
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="space-y-3">
                      {/* Budget Card 1 */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🏠</span>
                            <span className="font-medium text-gray-900">Rent / Housing</span>
                          </div>
                          <span className="text-xs text-gray-400">$2,400/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">YTD: $28,800</span>
                          <span className="text-gray-900 font-medium">Budget: $28,800</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{width: '100%'}}></div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">100% on track</div>
                      </div>
                      {/* Budget Card 2 */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">✈️</span>
                            <span className="font-medium text-gray-900">Travel</span>
                          </div>
                          <span className="text-xs text-gray-400">$1,500/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">YTD: $14,200</span>
                          <span className="text-gray-900 font-medium">Budget: $18,000</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#b4b237] rounded-full" style={{width: '79%'}}></div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">79% used</div>
                      </div>
                      {/* Budget Card 3 */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🍽️</span>
                            <span className="font-medium text-gray-900">Food & Dining</span>
                          </div>
                          <span className="text-xs text-gray-400">$800/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">YTD: $8,940</span>
                          <span className="text-gray-900 font-medium">Budget: $9,600</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full" style={{width: '93%'}}></div>
                        </div>
                        <div className="text-xs text-yellow-600 mt-1">93% — watch spending</div>
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
