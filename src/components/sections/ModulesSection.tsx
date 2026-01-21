'use client';

import React from 'react';

export default function ModulesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* INTRO */}
        <div className="mb-20">
          <h2 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight mb-8">
            What is Temple Stuart?
          </h2>
          <div className="text-lg text-gray-600 space-y-4 leading-relaxed">
            <p>
              Temple Stuart is a personal back office.
            </p>
            <p>
              It's for people who have money moving in a lot of directions — running a business, personal life, investing, trading, travel — and they're tired of juggling five apps and a bunch of spreadsheets.
            </p>
            <p>
              Connect your accounts, and Temple Stuart turns your raw transactions into clean structure, useful dashboards, and a real plan.
            </p>
          </div>
        </div>

        {/* THE HUB */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-4">
            THE HUB
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Your command center
          </h3>
          <p className="text-lg text-gray-600 leading-relaxed">
            When you log in, you land on the Hub. Everything you do in the app feeds into it. Expenses by month, budget vs actual, net worth over time, calendar with committed expenses — all in one place.
          </p>
        </div>

        {/* MODULE 1: BOOKKEEPING */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold mb-4">
            MODULE 1
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Bookkeeping — clean the mess
          </h3>
          <div className="text-lg text-gray-600 space-y-4 leading-relaxed">
            <p>
              First step: connect accounts with Plaid. All transactions come in, and we split them into two queues.
            </p>
            <p>
              <strong>Spending queue:</strong> normal spending, income deposits, transfers. You commit transactions into a Chart of Accounts (assets, liabilities, equity, income, expenses). Once that's done, the app generates real financial statements — income statement and balance sheet, with an audit trail.
            </p>
            <p>
              <strong>Investing queue:</strong> stocks, crypto, options, everything trade-related. The goal is to take messy trade lines and turn them into real positions by matching opens and closes together. We built logic for FIFO vs LIFO comparisons (so you can see tax outcomes) and stock splits, because splits break trade matching unless you handle them properly.
            </p>
          </div>
        </div>

        {/* MODULE 2: INCOME */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold mb-4">
            MODULE 2
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Income — know what you actually make
          </h3>
          <p className="text-lg text-gray-600 leading-relaxed">
            Income gets tracked by source and by month/year. You can click into the exact transactions to confirm what's real. Quick stats like YTD, all-time, and averages.
          </p>
        </div>

        {/* MODULE 3: TRADING */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold mb-4">
            MODULE 3
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Trading — performance dashboard
          </h3>
          <p className="text-lg text-gray-600 leading-relaxed mb-4">
            This is where you see: number of trades, win rate, total P/L, average win vs average loss, P/L by strategy, P/L by ticker. Plus a full list of every trade in order.
          </p>
        </div>

        {/* MODULE 4: BUDGETING */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-4">
            MODULE 4
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Budgeting — turn history into a plan
          </h3>
          <div className="text-lg text-gray-600 space-y-4 leading-relaxed">
            <p>
              This is where you move into "future mode."
            </p>
            <p>
              Temple Stuart builds a budget template off your real spending patterns. It's broken into modules: Home, Auto, Shopping, Personal, Health, Growth.
            </p>
            <p>
              Shopping also has an AI assistant that can build a weekly grocery plan and cart based on your goals and preferences.
            </p>
          </div>
        </div>

        {/* MODULE 5: TRIPS */}
        <div className="mb-20 pb-20 border-b border-gray-200">
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
            MODULE 5
          </div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            Trips — the big differentiator
          </h3>
          <div className="text-lg text-gray-600 space-y-4 leading-relaxed">
            <p>
              This is where it gets different from "just another finance app."
            </p>
            <p>
              You create a trip, invite people, and everyone can collaborate on: itinerary, group availability / date finder, shared expenses, who owes who.
            </p>
            <p>
              The AI trip assistant helps pick places to stay, eat, work, and do activities based on your preferences and budget — using real vendor data from Google Places, and flight quotes from Duffel.
            </p>
            <p>
              When you commit the trip costs, they flow into your budget and calendar automatically.
            </p>
          </div>
        </div>

        {/* THE POINT */}
        <div>
          <h3 className="text-3xl font-light text-gray-900 mb-4">
            The point
          </h3>
          <div className="text-lg text-gray-600 space-y-4 leading-relaxed">
            <p>
              Temple Stuart combines bookkeeping + trading + budgeting + trip planning so one system runs your money and your life plans.
            </p>
            <p>
              The goal is to have AI built into each module to help you make quicker, more informed decisions — with less research, less clutter, and more clarity.
            </p>
            <p className="font-medium text-gray-900">
              Less admin. Fewer apps. Way more clarity.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
