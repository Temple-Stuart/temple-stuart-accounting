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
              alt="Temple Stuart, LLC"
              width={400}
              height={120}
              className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto"
              priority
            />
          </Link>

          {/* Two Buttons - Start Project and Email */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <a 
              href="#pricing" 
              onClick={(e) => scrollToSection(e, 'pricing')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white rounded-lg hover:shadow-xl font-medium transition-all text-sm sm:text-base"
            >
              Start a Project
            </a>
            <a 
              href="mailto:astuart@templestuart.com?subject=Project%20Inquiry"
              className="px-4 sm:px-6 py-2 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-[#b4b237] hover:text-[#b4b237] font-medium transition-all text-sm sm:text-base"
            >
              Email
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
