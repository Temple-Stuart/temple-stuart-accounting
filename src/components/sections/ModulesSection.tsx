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

          {/* MODULE 2: LIFE EXPENSES */}
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
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">🏠</div>
                        <div className="text-xs font-medium text-gray-900">Home</div>
                        <div className="text-xs text-gray-500">$2,880/mo</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">🚗</div>
                        <div className="text-xs font-medium text-gray-900">Auto</div>
                        <div className="text-xs text-gray-500">$450/mo</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">🛒</div>
                        <div className="text-xs font-medium text-gray-900">Shopping</div>
                        <div className="text-xs text-gray-500">$600/mo</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">👤</div>
                        <div className="text-xs font-medium text-gray-900">Personal</div>
                        <div className="text-xs text-gray-500">$350/mo</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">💪</div>
                        <div className="text-xs font-medium text-gray-900">Health</div>
                        <div className="text-xs text-gray-500">$200/mo</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">📚</div>
                        <div className="text-xs font-medium text-gray-900">Growth</div>
                        <div className="text-xs text-gray-500">$150/mo</div>
                      </div>
                    </div>
                    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Monthly</span>
                        <span className="text-lg font-bold text-[#b4b237]">$4,630</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-4">
                02
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Life Expenses
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Six dedicated modules for the things that actually cost you money. Schedule once, weekly, monthly, quarterly, or annually. Commit to budget and calendar in one click.
              </p>
              <ul className="space-y-3">
                {['Home — rent, utilities, internet', 'Auto — gas, maintenance, insurance', 'Shopping — groceries, hygiene, supplies', 'Personal — dining, entertainment, subscriptions', 'Health — medical, fitness, wellness', 'Growth — education, biz dev, community'].map((item, i) => (
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

          {/* MODULE 3: TRIP PLANNING */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
                03
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Trip Planning
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Plan trips around activities you actually care about. Compare destinations by what matters — waves, trails, nomad scene. Coordinate with your crew and split costs.
              </p>
              <ul className="space-y-3">
                {['Activity-based destination search', 'Compare by stats that matter', 'Group RSVP & availability', 'Budget by flight, hotel, car, activities', 'Your share calculated automatically'].map((item, i) => (
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
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-lg">Jackson Hole</h4>
                          <p className="text-sm text-gray-500">Skiing • March 2026</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Committed
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-5">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">A</div>
                          <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">M</div>
                          <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">J</div>
                          <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium">K</div>
                        </div>
                        <span className="text-sm text-gray-500">4 people</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">✈️ Flights</span>
                          <span className="font-medium">$850</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">🏨 Lodging</span>
                          <span className="font-medium">$625</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">🚗 Rental Car</span>
                          <span className="font-medium">$150</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">🎿 Activities</span>
                          <span className="font-medium">$1,050</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-semibold">
                          <span>Your share</span>
                          <span className="text-[#b4b237]">$2,675</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MODULE 4: TRADING */}
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
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-gray-900">Trading P&L</span>
                        <span className="text-xs text-gray-400">YTD 2025</span>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Realized Gains</span>
                          <span className="font-medium text-green-600">+$12,450</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Realized Losses</span>
                          <span className="font-medium text-red-600">-$3,200</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Commissions</span>
                          <span className="font-medium text-gray-600">-$890</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t-2 border-gray-900">
                          <span className="font-bold">Net P&L</span>
                          <span className="font-bold text-green-600">+$8,360</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold mb-4">
                04
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Trading
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Track your options and stock trades. See your real P&L with wash sales handled correctly. IRS-compliant reporting for Schedule D.
              </p>
              <ul className="space-y-3">
                {['Options & stock position tracking', 'Realized gains & losses', 'Wash sale detection', 'Short-term vs long-term gains', 'Tax-ready export'].map((item, i) => (
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

          {/* MODULE 5: HUB & BUDGET */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-4">
                05
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Hub & Budget
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Your central command center. See everything on the calendar. Budget review shows targets vs actuals. No surprises at tax time.
              </p>
              <ul className="space-y-3">
                {['Calendar view of all committed expenses', 'Monthly targets by category', 'YTD actuals vs budget', 'Drill into any transaction', 'Net worth tracking'].map((item, i) => (
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
                          <span className="font-medium text-gray-900">🏠 Home</span>
                          <span className="text-xs text-gray-400">$2,880/mo</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">$28,800 spent</span>
                          <span className="text-gray-900">$34,560 budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#b4b237] rounded-full" style={{width: '83%'}}></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">✈️ Trips</span>
                          <span className="text-xs text-gray-400">varies</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">$8,200 spent</span>
                          <span className="text-gray-900">$12,000 budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{width: '68%'}}></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">📊 Trading</span>
                          <span className="text-xs text-gray-400">P&L</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Net realized</span>
                          <span className="text-green-600 font-medium">+$8,360</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{width: '100%'}}></div>
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
