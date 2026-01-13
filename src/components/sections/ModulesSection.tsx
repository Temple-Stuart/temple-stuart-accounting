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
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Everything you need to track money, plan trips, and stop guessing where it all went.
          </p>
        </div>

        <div className="space-y-32">

          {/* BOOKKEEPING, INCOME & TRADING - PAID */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 sm:p-12">
            <div className="text-center mb-10">
              <span className="inline-flex items-center px-3 py-1 bg-[#b4b237] text-gray-900 rounded-full text-xs font-semibold mb-4">
                PREMIUM
              </span>
              <h3 className="text-3xl sm:text-4xl font-light text-white mb-4">
                Bookkeeping, Income & Trading
              </h3>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                The serious stuff. Bank sync via Plaid, real financial statements, and proper entity separation. These cost money because Plaid charges per connection.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <div className="text-3xl mb-4">📚</div>
                <h4 className="text-xl font-medium text-white mb-3">Bookkeeping</h4>
                <p className="text-gray-400 mb-4">
                  Real double-entry accounting. Separate entities for Personal, Business, and Trading — keeps the IRS happy and your CPA sane.
                </p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Personal / Business / Trading entities</li>
                  <li>• Bank sync via Plaid</li>
                  <li>• Income statement & balance sheet</li>
                  <li>• CPA-ready exports</li>
                </ul>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <div className="text-3xl mb-4">💰</div>
                <h4 className="text-xl font-medium text-white mb-3">Income</h4>
                <p className="text-gray-400 mb-4">
                  Track money coming in. See revenue by source, trends over time, and stats that tell you something useful.
                </p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Revenue by category</li>
                  <li>• Monthly income trends</li>
                  <li>• Client/source breakdown</li>
                  <li>• Year-over-year comparison</li>
                </ul>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <div className="text-3xl mb-4">📈</div>
                <h4 className="text-xl font-medium text-white mb-3">Trading</h4>
                <p className="text-gray-400 mb-4">
                  Stocks, options, crypto. Realized gains, losses, wash sales handled correctly. No tax surprises.
                </p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• P&L by position</li>
                  <li>• Wash sale detection</li>
                  <li>• Short-term vs long-term</li>
                  <li>• Schedule D ready</li>
                </ul>
              </div>
            </div>
          </div>

          {/* THE HUB */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-4">
                THE HUB
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Your command center
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                See everything in one place — expenses by month, budget vs actual, net worth over time. All your committed expenses show up on the calendar.
              </p>
              <ul className="space-y-3">
                {[
                  'Every expense mapped to a category',
                  'Budget targets vs what you actually spent',
                  'Calendar view of committed expenses',
                  'Net worth tracking across all accounts',
                  'Monthly expense lists'
                ].map((item, i) => (
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
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold text-gray-900">January 2026</span>
                          <span className="text-xs text-gray-400">Budget Overview</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">🏠 Home</span>
                            <span className="font-medium">$2,400 / $2,500</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">🚗 Auto</span>
                            <span className="font-medium">$380 / $450</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">🛒 Shopping</span>
                            <span className="font-medium">$520 / $600</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">✈️ Trips</span>
                            <span className="font-medium">$1,200 / $2,000</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BUDGETING */}
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
                        <div className="text-xs text-gray-500">rent, utilities</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">🚗</div>
                        <div className="text-xs font-medium text-gray-900">Auto</div>
                        <div className="text-xs text-gray-500">gas, insurance</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">🛒</div>
                        <div className="text-xs font-medium text-gray-900">Shopping</div>
                        <div className="text-xs text-gray-500">groceries, supplies</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">👤</div>
                        <div className="text-xs font-medium text-gray-900">Personal</div>
                        <div className="text-xs text-gray-500">haircut, clothes</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">💪</div>
                        <div className="text-xs font-medium text-gray-900">Health</div>
                        <div className="text-xs text-gray-500">gym, activities</div>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="text-2xl mb-2">📚</div>
                        <div className="text-xs font-medium text-gray-900">Growth</div>
                        <div className="text-xs text-gray-500">school, business</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-4">
                BUDGETING
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Know what you'll spend before you spend it
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Commit to expenses you know are coming. Rent, car payment, gym membership — put it in once, it shows up every month. No more wondering where your money went.
              </p>
              <ul className="space-y-3">
                {[
                  'Home — rent, mortgage, utilities, internet',
                  'Auto — gas, registration, insurance, maintenance',
                  'Shopping — groceries, cleaning supplies, toiletries',
                  'Personal — haircuts, clothes, subscriptions',
                  'Health — gym, doctor visits, wellness stuff',
                  'Growth — classes, certifications, side hustle costs'
                ].map((item, i) => (
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

          {/* TRIP PLANNING */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
                TRIPS
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Plan trips. Split costs. Skip the spreadsheet.
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Going somewhere with friends? Compare destinations, pick dates everyone can make, and figure out what it'll actually cost you. AI pulls in lodging, restaurants, and activities that fit your budget. Mark expenses as personal or split — your share gets calculated automatically.
              </p>
              <ul className="space-y-3">
                {[
                  'Compare destinations side by side',
                  'Group RSVP — see who can make which dates',
                  'AI finds places that match your budget and style',
                  'Split expenses with the group — your share calculated',
                  'Request Venmo/Zelle for stuff you covered'
                ].map((item, i) => (
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
                          <h4 className="font-semibold text-gray-900 text-lg">Bali Trip</h4>
                          <p className="text-sm text-gray-500">Surfing • March 2026</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          4 going
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">✈️ Flights</span>
                          <span className="font-medium">$1,200</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">🏨 Villa (split)</span>
                          <span className="font-medium text-purple-600">$400</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">🏄 Surf lessons</span>
                          <span className="font-medium">$180</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-semibold">
                          <span>Your share</span>
                          <span className="text-[#b4b237]">$1,780</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 bg-purple-50 rounded-lg p-3">
                        👥 Villa split 4 ways — total was $1,600
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* NOMAD VS HOME CALCULATOR */}
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
                      <div className="text-center mb-4">
                        <span className="text-sm font-medium text-gray-700">Monthly Cost Comparison</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl mb-2">🏠</div>
                          <div className="text-sm font-medium text-gray-900">Stay Home</div>
                          <div className="text-xl font-bold text-gray-700">$4,200/mo</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                          <div className="text-2xl mb-2">🌴</div>
                          <div className="text-sm font-medium text-gray-900">Go Nomad</div>
                          <div className="text-xl font-bold text-green-600">$3,100/mo</div>
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-100 rounded-lg">
                        <span className="text-green-700 font-semibold">Save $1,100/month traveling</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-4">
                CALCULATOR
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4">
                Nomad life vs staying put — do the math
              </h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Everyone thinks traveling is expensive. Sometimes it's cheaper than your apartment. The calculator shows you exactly what you'd spend living at home versus bouncing around. Real numbers, not vibes.
              </p>
              <ul className="space-y-3">
                {[
                  'Side-by-side monthly breakdown',
                  'Factor in rent you\'d save (or pay)',
                  'Account for flights, lodging, food',
                  'See the actual savings or extra cost',
                  'Plan trips that fit your budget'
                ].map((item, i) => (
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

        </div>
      </div>
    </section>
  );
}
