'use client';

import React from 'react';

export default function ModulesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-extralight text-text-primary tracking-tight">
            What's Inside
          </h2>
          <p className="mt-4 text-terminal-lg text-text-muted max-w-2xl mx-auto">
            Temple Stuart is a personal back office. It's for people with money moving in a lot of directions — business, personal, investing, trading, travel — who are tired of juggling five apps and spreadsheets.
          </p>
        </div>

        <div className="space-y-32">

          {/* THE HUB */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-4">
                THE HUB
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-text-primary mb-4">
                Your command center
              </h3>
              <p className="text-terminal-lg text-text-muted mb-8 leading-relaxed">
                When you log in, you land here. Everything you do in the app feeds into the Hub. Budget vs actual, net worth over time, calendar with committed expenses — all in one place.
              </p>
              <ul className="space-y-3">
                {[
                  'Budget targets vs what you actually spent',
                  'Net worth tracking across all accounts',
                  'Calendar view of committed expenses',
                  'Monthly expense breakdown by category',
                  'Committed trips in order of when they happen'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-text-secondary">
                    <div className="w-5 h-5 rounded-full bg-brand-accent/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="order-1 lg:order-2">
              <div className="bg-brand-purple rounded p-2 shadow-sm">
                <div className="bg-brand-purple-deep rounded overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-brand-purple">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-bg-row p-6">
                    <div className="space-y-3">
                      <div className="bg-white rounded border border-border p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold text-text-primary">January 2026</span>
                          <span className="text-xs text-text-faint">Budget Overview</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">🏠 Home</span>
                            <span className="font-medium">$2,400 / $2,500</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">🚗 Auto</span>
                            <span className="font-medium">$380 / $450</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">🛒 Shopping</span>
                            <span className="font-medium">$520 / $600</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">✈️ Trips</span>
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

          {/* BOOKKEEPING, INCOME & TRADING */}
          <div className="bg-gradient-to-br from-brand-purple to-brand-purple-deep rounded p-8 sm:p-12">
            <div className="text-center mb-10">
              <h3 className="text-3xl sm:text-4xl font-light text-white mb-4">
                Bookkeeping, Income & Trading
              </h3>
              <p className="text-terminal-lg text-text-faint max-w-2xl mx-auto">
                Connect your accounts via Plaid. Transactions get split into a spending queue and an investing queue. From there, you commit them into real structure.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur rounded p-6 border border-white/10">
                <div className="text-3xl mb-4">📚</div>
                <h4 className="text-sm font-medium text-white mb-3">Bookkeeping</h4>
                <p className="text-text-faint mb-4">
                  Plaid-synced transactions flow into a spending queue. Map to your Chart of Accounts, commit to the ledger. Full financial statements with monthly breakdowns and prior-year carry-forward.
                </p>
                <ul className="space-y-2 text-sm text-text-faint">
                  <li>• Plaid bank sync</li>
                  <li>• Double-entry with audit trail</li>
                  <li>• Balance sheet + income statement</li>
                  <li>• Schedule D, Form 8949 + CSV export</li>
                </ul>
              </div>

              <div className="bg-white/5 backdrop-blur rounded p-6 border border-white/10">
                <div className="text-3xl mb-4">💰</div>
                <h4 className="text-sm font-medium text-white mb-3">Income</h4>
                <p className="text-text-faint mb-4">
                  See income by source and by month. Click into the actual transactions to verify where the money came from.
                </p>
                <ul className="space-y-2 text-sm text-text-faint">
                  <li>• Income by source</li>
                  <li>• Monthly and yearly view</li>
                  <li>• YTD, all-time, averages</li>
                  <li>• Transaction-level detail</li>
                </ul>
              </div>

              <div className="bg-white/5 backdrop-blur rounded p-6 border border-white/10">
                <div className="text-3xl mb-4">📈</div>
                <h4 className="text-sm font-medium text-white mb-3">Trading</h4>
                <p className="text-text-faint mb-4">
                  AI volatility scanner filters 475 stocks to your best setups. Queue trade cards, link them to real positions, and grade your thesis against actual results. Full P&L tracking with trade journal.
                </p>
                <ul className="space-y-2 text-sm text-text-faint">
                  <li>• AI scanner + strategy cards with Greeks</li>
                  <li>• Trade Lab: queue, link, and grade trades</li>
                  <li>• P&L by strategy and ticker</li>
                  <li>• Wash sale detection + tax compliance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* BUDGETING */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="bg-brand-purple rounded p-2 shadow-sm">
                <div className="bg-brand-purple-deep rounded overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-brand-purple">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-bg-row p-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">🏠</div>
                        <div className="text-xs font-medium text-text-primary">Home</div>
                        <div className="text-xs text-text-muted">rent, utilities</div>
                      </div>
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">🚗</div>
                        <div className="text-xs font-medium text-text-primary">Auto</div>
                        <div className="text-xs text-text-muted">gas, insurance</div>
                      </div>
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">🛒</div>
                        <div className="text-xs font-medium text-text-primary">Shopping</div>
                        <div className="text-xs text-text-muted">groceries, supplies</div>
                      </div>
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">👤</div>
                        <div className="text-xs font-medium text-text-primary">Personal</div>
                        <div className="text-xs text-text-muted">haircut, clothes</div>
                      </div>
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">💪</div>
                        <div className="text-xs font-medium text-text-primary">Health</div>
                        <div className="text-xs text-text-muted">gym, activities</div>
                      </div>
                      <div className="bg-white rounded border border-border p-4 text-center">
                        <div className="text-sm mb-2">📚</div>
                        <div className="text-xs font-medium text-text-primary">Growth</div>
                        <div className="text-xs text-text-muted">school, business</div>
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
              <h3 className="text-3xl sm:text-4xl font-light text-text-primary mb-4">
                Turn history into a plan
              </h3>
              <p className="text-terminal-lg text-text-muted mb-8 leading-relaxed">
                Budget template built from your real spending. Six modules: Home, Auto, Shopping, Personal, Health, Growth. Shopping already has an AI assistant that builds a grocery cart and meal plan based on your goals. Other modules getting the same treatment.
              </p>
              <ul className="space-y-3">
                {[
                  'Home — rent, mortgage, utilities, internet',
                  'Auto — gas, insurance, registration, maintenance',
                  'Shopping — groceries + AI meal planner',
                  'Personal — subscriptions, dining, entertainment',
                  'Health — gym, medical, supplements',
                  'Growth — courses, business expenses, books'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-text-secondary">
                    <div className="w-5 h-5 rounded-full bg-brand-accent/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="inline-flex items-center px-3 py-1 bg-brand-purple-wash text-brand-purple rounded-full text-xs font-semibold mb-4">
                TRIPS
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-text-primary mb-4">
                Plan trips. Split costs. Skip the spreadsheet.
              </h3>
              <p className="text-terminal-lg text-text-muted mb-8 leading-relaxed">
                Create a trip, invite people, build the itinerary together. Date finder shows when everyone's free. AI assistant pulls real vendor data from Google Places and flight quotes from Duffel — picks places to stay, eat, and do stuff based on your budget and preferences. Commit the costs, they flow into your budget and calendar.
              </p>
              <ul className="space-y-3">
                {[
                  'Invite travelers, find dates that work',
                  'AI recommends lodging, food, activities',
                  'Live flight quotes from Duffel',
                  'Split expenses — see who owes who',
                  'Commit costs → budget + calendar'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-text-secondary">
                    <div className="w-5 h-5 rounded-full bg-brand-accent/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="order-1 lg:order-2">
              <div className="bg-brand-purple rounded p-2 shadow-sm">
                <div className="bg-brand-purple-deep rounded overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-brand-purple">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-bg-row p-6">
                    <div className="bg-white rounded border border-border p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-text-primary text-terminal-lg">Bali Trip</h4>
                          <p className="text-sm text-text-muted">Surfing • March 2026</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-brand-green text-xs font-medium rounded-full">
                          4 going
                        </span>
                      </div>
                      <div className="bg-bg-row rounded p-4 space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">✈️ Flights</span>
                          <span className="font-medium">$1,200</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">🏨 Villa (split)</span>
                          <span className="font-medium text-purple-600">$400</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">🏄 Surf lessons</span>
                          <span className="font-medium">$180</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-border font-semibold">
                          <span>Your share</span>
                          <span className="text-brand-accent">$1,780</span>
                        </div>
                      </div>
                      <div className="text-xs text-text-muted bg-purple-50 rounded p-3">
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
              <div className="bg-brand-purple rounded p-2 shadow-sm">
                <div className="bg-brand-purple-deep rounded overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-brand-purple">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="bg-bg-row p-6">
                    <div className="bg-white rounded border border-border p-5">
                      <div className="text-center mb-4">
                        <span className="text-sm font-medium text-text-secondary">Monthly Cost Comparison</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-bg-row rounded">
                          <div className="text-sm mb-2">🏠</div>
                          <div className="text-sm font-medium text-text-primary">Stay Home</div>
                          <div className="text-sm font-bold text-text-secondary">$4,200/mo</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded border-2 border-green-200">
                          <div className="text-sm mb-2">🌴</div>
                          <div className="text-sm font-medium text-text-primary">Go Nomad</div>
                          <div className="text-sm font-bold text-brand-green">$3,100/mo</div>
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-100 rounded">
                        <span className="text-brand-green font-semibold">Save $1,100/month traveling</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-brand-green rounded-full text-xs font-semibold mb-4">
                CALCULATOR
              </div>
              <h3 className="text-3xl sm:text-4xl font-light text-text-primary mb-4">
                Nomad vs staying put — do the math
              </h3>
              <p className="text-terminal-lg text-text-muted mb-8 leading-relaxed">
                Everyone assumes traveling costs more. Sometimes it's cheaper than your apartment. This shows you exactly what you'd spend living at home versus moving around. Real numbers, not guesses.
              </p>
              <ul className="space-y-3">
                {[
                  'Side-by-side monthly breakdown',
                  'Factor in rent you\'d save (or keep paying)',
                  'Account for flights, lodging, food',
                  'See the actual delta',
                  'Plan trips that fit your budget'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-text-secondary">
                    <div className="w-5 h-5 rounded-full bg-brand-accent/10 flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
