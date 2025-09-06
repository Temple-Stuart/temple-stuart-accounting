'use client';

import React from 'react';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-0">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-8">

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                <span className="block bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
                  Bookkeeping + Automation
                </span>
              </h1>
              <p className="text-xl text-purple-600 font-medium uppercase tracking-widest">
                Financial Data Solutions
              </p>
              <p className="text-lg text-gray-600 max-w-xl">
                Building tools that merge traditional accounting with automation. Transforming complex data into strategic insights through AI and data integrations.
              </p>
            </div>

            {/* Service Badges with Descriptions */}
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-100 to-amber-100 p-6 rounded-lg border border-purple-200">
                <h3 className="font-semibold text-purple-700 text-sm uppercase tracking-wide mb-2">Bookkeeping Dashboard</h3>
                <p className="text-gray-600 text-sm">Connect all your accounts in one place. See everything and use the tools I build related to all your accounts. Let's you play with your data.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-purple-100 to-amber-100 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-700 text-sm uppercase tracking-wide mb-2">Data Integrations</h3>
                  <p className="text-gray-600 text-xs">I help clients get their pipelines set up.</p>
                </div>
                <div className="bg-gradient-to-r from-purple-100 to-amber-100 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-700 text-sm uppercase tracking-wide mb-2">Data Automation</h3>
                  <p className="text-gray-600 text-xs">I get their data all linked up and running on its own.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual - Orbiting Cube */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-80 h-80">
              
              {/* Central Cube */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 perspective-1000">
                <div className="w-24 h-24 transform-style-preserve-3d animate-spin-slow">
                  
                  {/* Cube Faces */}
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">π</span>
                  </div>
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'rotateY(180deg) translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">∑</span>
                  </div>
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'rotateY(-90deg) translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">$</span>
                  </div>
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'rotateY(90deg) translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">%</span>
                  </div>
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'rotateX(90deg) translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">∆</span>
                  </div>
                  <div className="absolute w-24 h-24 border-2 border-purple-400 bg-gradient-to-br from-purple-100 to-amber-100 flex items-center justify-center" style={{transform: 'rotateX(-90deg) translateZ(12px)'}}>
                    <span className="text-2xl text-purple-600">♔</span>
                  </div>
                </div>
              </div>

              {/* Orbiting Accounting Elements */}
              <div className="absolute inset-0 animate-spin-reverse">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-400 to-amber-400 rounded-full flex items-center justify-center text-white text-lg">
                  🧮
                </div>
              </div>
              
              <div className="absolute inset-0 animate-spin-reverse animation-delay-1000">
                <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-400 to-amber-400 rounded-full flex items-center justify-center text-white text-lg">
                  📊
                </div>
              </div>
              
              <div className="absolute inset-0 animate-spin-reverse animation-delay-2000">
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-400 to-amber-400 rounded-full flex items-center justify-center text-white text-lg">
                  📋
                </div>
              </div>
              
              <div className="absolute inset-0 animate-spin-reverse animation-delay-3000">
                <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-400 to-amber-400 rounded-full flex items-center justify-center text-white text-lg">
                  🧾
                </div>
              </div>

              {/* Floating particles */}
              <div className="absolute top-16 right-16 w-3 h-3 bg-purple-400 rounded-full opacity-60 animate-float"></div>
              <div className="absolute bottom-16 left-16 w-2 h-2 bg-amber-400 rounded-full opacity-60 animate-float animation-delay-1000"></div>
              <div className="absolute top-32 left-32 w-2 h-2 bg-purple-300 rounded-full opacity-60 animate-float animation-delay-2000"></div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes spin-slow {
          from { transform: rotateX(25deg) rotateY(0deg); }
          to { transform: rotateX(25deg) rotateY(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-reverse { animation: spin-reverse 15s linear infinite; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animation-delay-1000 { animation-delay: 1s; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-3000 { animation-delay: 3s; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </section>
  );
}
