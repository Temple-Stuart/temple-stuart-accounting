'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LoginBox from '@/components/LoginBox';

const MODULES = [
  { name: 'Hub', desc: 'Command center', href: '/hub' },
  { name: 'Books', desc: 'Double-entry accounting', href: '/dashboard' },
  { name: 'Business', desc: 'Business expenses', href: '/business' },
  { name: 'Trading', desc: 'P&L analytics', href: '/trading' },
  { name: 'Home', desc: 'Rent, utilities', href: '/home' },
  { name: 'Auto', desc: 'Gas, insurance', href: '/auto' },
  { name: 'Shopping', desc: 'Groceries, supplies', href: '/shopping' },
  { name: 'Personal', desc: 'Subscriptions, dining', href: '/personal' },
  { name: 'Health', desc: 'Gym, medical', href: '/health' },
  { name: 'Growth', desc: 'Education, courses', href: '/growth' },
  { name: 'Trips', desc: 'Trip planning', href: '/budgets/trips' },
  { name: 'Income', desc: 'Income tracking', href: '/income' },
];

const FEATURES = [
  { title: 'Plaid Integration', desc: 'Bank sync for all accounts' },
  { title: 'Double-Entry', desc: 'CPA-grade bookkeeping' },
  { title: 'Trading Analytics', desc: 'P&L, win rate, wash sales' },
  { title: 'Trip Planning', desc: 'AI-powered itineraries' },
  { title: 'Cost Splitting', desc: 'Group expense tracking' },
  { title: 'Tax Ready', desc: 'IRS-compliant reporting' },
];

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

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
              Plan your trips.<br />
              <span className="text-gray-400">Find your people.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-xl">
              Personal back office for founder-traders. Bookkeeping, trading analytics, 
              trip planning, and budgeting — unified in one system.
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
            {MODULES.map((mod, idx) => (
              <div key={mod.name} className="bg-white border border-gray-200 p-4 hover:border-[#2d1b4e] transition-colors cursor-pointer group"
                onClick={() => setShowLogin(true)}>
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
                  commit to the ledger. Get income statements and balance sheets.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Double-entry with audit trail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Bank reconciliation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">CPA export ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading */}
            <div className="border border-gray-200">
              <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                Trading
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Investment transactions match opens to closes. Track P&L by strategy, ticker, 
                  and time period. Trade journal for analysis.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Options & stock tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Win rate, profit factor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Wash sale awareness</span>
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
                  Create trips, invite travelers, find dates that work. AI recommends lodging, 
                  activities, restaurants. Split costs, commit to budget.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Group availability finder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Real flight quotes (Duffel)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">Settlement matrix</span>
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
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white border border-gray-200 p-4">
                <div className="text-xs font-medium text-gray-900 mb-1">{f.title}</div>
                <div className="text-[10px] text-gray-500">{f.desc}</div>
              </div>
            ))}
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
              <a href="https://instagram.com/templestuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@templestuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a href="https://youtube.com/@templestuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://x.com/templestuart" target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative z-10">
            <LoginBox onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
