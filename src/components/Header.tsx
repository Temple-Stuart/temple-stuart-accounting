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
        <div className="flex justify-between items-center py-4 sm:py-6">
          {/* Logo - MUCH LARGER */}
          <Link href="/" className="flex items-center">
            <Image
              src="/temple-stuart-logo.png"
              alt="Temple Stuart Accounting"
              width={400}
              height={120}
              className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto"
              priority
            />
          </Link>

          {/* Two Buttons - Login and Email */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <a 
              href="#portal" 
              onClick={(e) => scrollToSection(e, 'portal')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors text-sm sm:text-base"
            >
              Login
            </a>
            <a 
              href="mailto:astuart@templestuart.com?subject=Bookkeeping%20Inquiry"
              className="px-4 sm:px-6 py-2 sm:py-3 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] font-medium transition-colors text-sm sm:text-base"
            >
              Email
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
