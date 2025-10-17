'use client';

import React from 'react';

export default function AsSeenInSection() {
  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-2">
            As Seen In
          </p>
          <h2 className="text-2xl font-light text-gray-900">
            Featured in Leading Publications
          </h2>
        </div>

        {/* Publications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* New York Times */}
          <a
            href="https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-[#b4b237] hover:shadow-xl transition-all"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-4xl font-serif font-bold text-gray-900 group-hover:text-[#b4b237] transition-colors">
                The New York Times
              </div>
              <p className="text-sm text-gray-600 italic">
                "ChatGPT for Financial Advice"
              </p>
              <span className="text-xs text-[#b4b237] font-medium uppercase tracking-wider group-hover:underline">
                Read Article
              </span>
            </div>
          </a>

          {/* The Straits Times */}
          <a
            href="https://www.straitstimes.com/business/they-had-money-problems-they-turned-to-chatgpt-for-solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-8 hover:border-purple-600 hover:shadow-xl transition-all"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-4xl font-serif font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                The Straits Times
              </div>
              <p className="text-sm text-gray-600 italic">
                "They Had Money Problems. They Turned to ChatGPT for Solutions"
              </p>
              <span className="text-xs text-purple-600 font-medium uppercase tracking-wider group-hover:underline">
                Read Article
              </span>
            </div>
          </a>

        </div>
      </div>
    </section>
  );
}
