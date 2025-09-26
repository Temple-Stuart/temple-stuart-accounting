'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          {/* Logo - Large */}
          <Link href="/" className="flex items-center">
            <Image
              src="/temple-stuart-logo.png"
              alt="Temple Stuart Accounting"
              width={300}
              height={80}
              className="h-16 sm:h-20 lg:h-24 w-auto"
              priority
            />
          </Link>

          {/* Two Buttons - Login and Email */}
          <div className="flex items-center space-x-4">
            <a 
              href="#portal" 
              onClick={(e) => scrollToSection(e, 'portal')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              Login
            </a>
            <a 
              href="mailto:astuart@templestuart.com?subject=Bookkeeping%20Inquiry"
              className="px-6 py-3 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] font-medium transition-colors"
            >
              Email
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button className="sm:hidden p-2">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
