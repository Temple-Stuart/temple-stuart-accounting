'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LoginBox from '@/components/LoginBox';

const MODULES = [
  { name: 'Hub', desc: 'Command center', href: '/hub' },
  { name: 'Books', desc: 'Double-entry accounting', href: '/dashboard' },
  { name: 'Business', desc: 'Business expenses', href: '/business' },
  { name: 'Trading', desc: 'AI scanner + strategy builder', href: '/trading', featured: true },
  { name: 'Home', desc: 'Rent, utilities', href: '/home' },
  { name: 'Auto', desc: 'Gas, insurance', href: '/auto' },
  { name: 'Shopping', desc: 'AI shopping planner', href: '/shopping' },
  { name: 'Personal', desc: 'Subscriptions, dining', href: '/personal' },
  { name: 'Health', desc: 'Gym, medical', href: '/health' },
  { name: 'Growth', desc: 'Education, courses', href: '/growth' },
  { name: 'Trips', desc: 'AI trips & flights', href: '/budgets/trips' },
  { name: 'Income', desc: 'Income tracking', href: '/income' },
];

const FEATURES = [
  { title: 'Plaid Integration', desc: 'Bank sync for all accounts' },
  { title: 'Double-Entry', desc: 'CPA-grade bookkeeping' },
  { title: 'AI Vol Scanner', desc: '475 stocks scored and filtered' },
  { title: 'Strategy Builder', desc: 'Auto-generated option spreads' },
  { title: 'AI Market Brief', desc: 'Regime, risk clusters, top picks' },
  { title: 'Finnhub Data', desc: 'News headlines + analyst ratings' },
  { title: 'Trip Planning', desc: 'AI itineraries & flights' },
  { title: 'Tax Engine', desc: 'Schedule D, Form 8949, wash sales' },
  { title: 'Trade Lab', desc: 'Queue cards, link positions, grade results' },
];

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [loginRedirect, setLoginRedirect] = useState('/hub');

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-[#2d1b4e] text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-[#2d1b4e] font-bold text-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="text-[10px] text-gray-400">Personal Back Office</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="#pricing" className="text-xs text-gray-300 hover:text-white hidden sm:block">
                Pricing
              </a>
              <a href="mailto:astuart@templestuart.com" className="text-xs text-gray-300 hover:text-white hidden sm:block">
                Contact
              </a>
              <button onClick={() => setShowLogin(true)}
                className="px-4 py-2 text-xs bg-white text-[#2d1b4e] font-medium hover:bg-gray-100">
                Enter →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#2d1b4e] text-white pb-12 pt-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-4">
              Track your money.<br />
              Trade smarter.<br />
              <span className="text-gray-400">Plan your life.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-xl">
              Bookkeeping, AI-powered options analytics, trip planning, and budgeting &mdash; one platform.
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowLogin(true)}
                className="px-6 py-3 bg-white text-[#2d1b4e] font-medium hover:bg-gray-100 text-sm">
                Get Started
              </button>
              <div className="text-xs text-gray-500">
                Featured in <span className="text-gray-400 italic">The New York Times</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e]">12</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Modules</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e]">Plaid</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Bank Sync</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e]">IRS</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Compliant</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e]">AI</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Powered</div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="mb-8">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Platform</div>
            <h2 className="text-2xl font-light text-gray-900">Modules</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {MODULES.map((mod) => (
              <div key={mod.name}
                className={`bg-white p-4 hover:border-[#2d1b4e] transition-colors cursor-pointer group ${
                  (mod as any).featured ? 'border-2 border-[#b4b237] relative' : 'border border-gray-200'
                }`}
                onClick={() => setShowLogin(true)}>
                {(mod as any).featured && (
                  <div className="absolute -top-2 right-2 bg-[#b4b237] text-white text-[8px] px-1.5 py-0.5 uppercase tracking-wider font-semibold">New</div>
                )}
                <div className="text-xs font-medium text-gray-900 group-hover:text-[#2d1b4e] mb-1">{mod.name}</div>
                <div className="text-[10px] text-gray-500">{mod.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="bg-white border-y border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Bookkeeping */}
            <div className="border border-gray-200">
              <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                Bookkeeping
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Plaid-synced transactions flow into a spending queue. Map to your Chart of Accounts,
                  commit to the ledger. Full financial statements with monthly breakdowns and prior-year carry-forward.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Double-entry with audit trail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Balance sheet + income statement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Schedule D, Form 8949 + CSV export</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading */}
            <div className="border-2 border-[#b4b237]">
              <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                Trading
                <span className="bg-[#b4b237] text-white text-[8px] px-1.5 py-0.5 uppercase tracking-wider font-semibold">New</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  AI volatility scanner filters 475 stocks to your best setups.
                  Queue trade cards, link them to real positions, and grade your
                  thesis against actual results. Full P&L tracking with trade journal.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">AI scanner + strategy cards with Greeks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Trade Lab: queue, link, and grade trades</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Wash sale detection + tax compliance</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trips */}
            <div className="border border-gray-200">
              <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                Trip Planning
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Two-tab workflow: Overview (crew, day-by-day itinerary, settlement matrix) and
                  Budget (destinations map, AI recommendations per category, real flight search).
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">AI itinerary per category</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Real flight quotes (Duffel)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Crew splits & settlement matrix</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="mb-8">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Capabilities</div>
            <h2 className="text-2xl font-light text-gray-900">Built for Complexity</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white border border-gray-200 p-4">
                <div className="text-xs font-medium text-gray-900 mb-1">{f.title}</div>
                <div className="text-[10px] text-gray-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* AI Trading Pipeline Highlight */}
      <section className="bg-[#2d1b4e] text-white py-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="mb-6">
            <div className="text-[10px] text-[#b4b237] uppercase tracking-wider mb-1">What&apos;s Inside</div>
            <h2 className="text-xl font-light">The trading pipeline, zero clicks</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-gray-700 p-4">
              <div className="text-xs font-medium text-gray-300 mb-1">Scan</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">475 stocks through institutional-grade filters. IV rank, IV-HV spread, liquidity, term structure, lendability.</div>
            </div>
            <div className="border border-gray-700 p-4">
              <div className="text-xs font-medium text-gray-300 mb-1">Brief</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">AI market brief identifies regime, risk clusters, sector concentration, and top picks. Fires once per scan.</div>
            </div>
            <div className="border border-gray-700 p-4">
              <div className="text-xs font-medium text-gray-300 mb-1">Strategies</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">Auto-generated strategy cards with P&L charts, Greeks, breakevens, and PoP. Delta-scanned for best risk/reward.</div>
            </div>
            <div className="border border-gray-700 p-4">
              <div className="text-xs font-medium text-gray-300 mb-1">Context</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">Finnhub news headlines and analyst ratings. Per-strategy AI analysis referencing specific numbers.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white border-y border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="mb-8">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Plans</div>
            <h2 className="text-2xl font-light text-gray-900">Start free. Upgrade when you need more.</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Free */}
            <div className="border border-gray-200 p-6">
              <div className="text-xs font-medium text-gray-900 mb-1">Free</div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e] mb-1">$0</div>
              <div className="text-[10px] text-gray-500 mb-4">Forever</div>
              <div className="space-y-2 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Personal bookkeeping</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Expense tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Budget tools</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Double-entry bookkeeping</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Hub command center</span>
                </div>
              </div>
              <button onClick={() => setShowLogin(true)}
                className="mt-6 w-full px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                Get Started Free
              </button>
            </div>

            {/* Pro */}
            <div className="border-2 border-[#2d1b4e] p-6 relative">
              <div className="absolute -top-2.5 left-4 bg-[#2d1b4e] text-white text-[9px] px-2 py-0.5 uppercase tracking-wider">Popular</div>
              <div className="text-xs font-medium text-gray-900 mb-1">Pro</div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e] mb-1">$20<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <div className="text-[10px] text-gray-500 mb-4">Everything in Free, plus</div>
              <div className="space-y-2 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Trip planning & AI itineraries</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Business accounting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Trading P&L analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Plaid bank sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Wash sale tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Schedule D + Form 8949 export</span>
                </div>
              </div>
              <button onClick={() => { setLoginRedirect('/pricing'); setShowLogin(true); }}
                className="mt-6 w-full px-4 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">
                Subscribe
              </button>
            </div>

            {/* Trader Pro */}
            <div className="border border-gray-200 p-6">
              <div className="text-xs font-medium text-gray-900 mb-1">Trader Pro</div>
              <div className="text-2xl font-bold font-mono text-[#2d1b4e] mb-1">$40<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <div className="text-[10px] text-gray-500 mb-4">Everything in Pro, plus</div>
              <div className="space-y-2 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>AI volatility scanner (475 stocks)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>AI Market Brief + Top Picks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Auto strategy cards with Greeks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Finnhub news + analyst ratings</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Trade Lab + position grading</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                  <span>Tastytrade live connection</span>
                </div>
              </div>
              <button onClick={() => { setLoginRedirect('/pricing'); setShowLogin(true); }}
                className="mt-6 w-full px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Press */}
      <section className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Featured in</span>
            <div className="flex items-center gap-6">
              <a href="https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html"
                target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <span className="font-serif text-sm italic">The New York Times</span>
              </a>
              <span className="text-gray-300">·</span>
              <a href="https://www.straitstimes.com/business/they-had-money-problems-they-turned-to-chatgpt-for-solutions"
                target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <span className="font-serif text-sm italic">The Straits Times</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social */}
      <section className="bg-[#2d1b4e] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-[#2d1b4e] font-bold text-sm">TS</span>
              </div>
              <div className="text-xs text-gray-400">© 2026 Temple Stuart, LLC</div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/temple_stuart_accounting/" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@temple_stuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@Temple-Stuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://x.com/Alex_Stuart_APS" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/alexander-stuart-phi/" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <a href="/terms" className="text-xs text-gray-500 hover:text-gray-300">Terms of Service</a>
              <a href="/privacy" className="text-xs text-gray-500 hover:text-gray-300">Privacy Policy</a>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative z-10">
            <LoginBox onClose={() => setShowLogin(false)} redirectTo={loginRedirect} />
          </div>
        </div>
      )}
    </div>
  );
}
