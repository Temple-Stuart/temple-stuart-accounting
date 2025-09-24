'use client';

import React from 'react';

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <div className="flex items-center h-full py-3 sm:py-4">
            <img
              src="/temple-stuart-logo.png"
              alt="Temple Stuart"
              className="h-full w-auto object-contain"
              style={{ maxHeight: '60px' }}
            />
          </div>
          
          {/* Right side - responsive */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Social Icons - hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2">
              <a href="https://github.com/Temple-Stuart" target="_blank" rel="noopener noreferrer" className="p-1.5 hover:opacity-70 transition-opacity">
                <svg className="w-5 h-5" fill="#b4b237" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href="https://x.com/Alex_Stuart_APS" target="_blank" rel="noopener noreferrer" className="p-1.5 hover:opacity-70 transition-opacity">
                <svg className="w-5 h-5" fill="#b4b237" viewBox="0 0 24 24">
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/alexander-stuart-phi/" target="_blank" rel="noopener noreferrer" className="p-1.5 hover:opacity-70 transition-opacity">
                <svg className="w-5 h-5" fill="#b4b237" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            {/* CTA Buttons - responsive sizing */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <a href="#pricing" className="px-3 sm:px-5 py-2 sm:py-2.5 bg-purple-600 text-white font-medium text-xs sm:text-sm rounded-full hover:bg-purple-700 transition-colors whitespace-nowrap">
                Get Quote
              </a>
              <a href="#portal" className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium text-xs sm:text-sm rounded-full hover:shadow-lg transition-all whitespace-nowrap">
                Client Access
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
