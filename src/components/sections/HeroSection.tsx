'use client';

import React from 'react';

export default function HeroSection() {
  return (
    <section className="relative bg-white py-12 sm:py-16 lg:py-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          
          {/* Left Content */}
          <div className="space-y-6 lg:space-y-8">
            <div className="space-y-4 lg:space-y-6">
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#b4b237]">
                  Data & Finance Systems
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-gray-900 leading-tight">
                  I build automated systems for growing businesses
                </h1>
              </div>
              
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                Dashboards, pipelines, bookkeeping automation, API integrations — custom-built to eliminate manual work and unlock scale.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Custom Dashboards</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Real-time visibility into your data, built exactly how you need it</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">API Integrations</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Connect your tools, sync your data, automate your workflows</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#b4b237] mt-2 flex-shrink-0"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Finance Automation</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">Bookkeeping, reporting, and reconciliation—hands-free</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <a href="#contact" className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-full hover:shadow-xl transition-all">
                Start a Project
              </a>
              <a href="#work" className="w-full sm:w-auto text-center px-6 sm:px-8 py-3 border border-gray-300 text-gray-700 font-medium rounded-full hover:border-purple-400 hover:text-purple-700 transition-all">
                See My Work
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-gray-100">
              <div>
                <p className="text-lg sm:text-2xl font-light text-gray-900">Custom</p>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Built for You</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-light text-gray-900">Automated</p>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Zero Manual Work</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-light text-gray-900">Scalable</p>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Grows With You</p>
              </div>
            </div>
          </div>

          {/* Right Visual - Purple Cube */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-[400px] xl:w-[450px] h-[400px] xl:h-[450px]">
              
              {/* Glass Cube */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 perspective-1000">
                <div className="w-44 h-44 transform-style-preserve-3d animate-rotate-cube">
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-400/20 via-purple-500/15 to-purple-600/20 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                       style={{transform: 'translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-lg"></div>
                  </div>
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-500/20 via-purple-600/15 to-[#b4b237]/10 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                       style={{transform: 'rotateY(180deg) translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-tl from-white/10 to-transparent rounded-lg"></div>
                  </div>
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-[#b4b237]/20 via-[#9a9630]/15 to-purple-500/20 backdrop-blur-md border border-[#b4b237]/30 shadow-2xl rounded-lg" 
                       style={{transform: 'rotateY(90deg) translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-lg"></div>
                  </div>
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-400/20 via-purple-500/15 to-[#b4b237]/20 backdrop-blur-md border border-purple-300/30 shadow-2xl rounded-lg" 
                       style={{transform: 'rotateY(-90deg) translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-l from-white/10 to-transparent rounded-lg"></div>
                  </div>
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-300/25 to-purple-500/20 backdrop-blur-md border border-purple-200/30 shadow-2xl rounded-lg" 
                       style={{transform: 'rotateX(90deg) translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-lg"></div>
                  </div>
                  
                  <div className="absolute w-44 h-44 bg-gradient-to-br from-purple-600/25 to-[#b4b237]/15 backdrop-blur-md border border-purple-400/30 shadow-2xl rounded-lg" 
                       style={{transform: 'rotateX(-90deg) translateZ(88px)'}}>
                    <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent rounded-lg"></div>
                  </div>
                </div>
              </div>

              {/* Orbital rings */}
              <div className="absolute inset-0">
                <div className="absolute inset-8 border border-purple-200/10 rounded-full"></div>
                <div className="absolute inset-16 border border-[#b4b237]/10 rounded-full"></div>
                <div className="absolute inset-24 border border-purple-200/5 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes rotate-cube {
          from { transform: rotateX(-20deg) rotateY(0deg); }
          to { transform: rotateX(-20deg) rotateY(360deg); }
        }
        .animate-rotate-cube { animation: rotate-cube 30s linear infinite; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </section>
  );
}
