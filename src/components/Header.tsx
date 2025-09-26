'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="w-full bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo - Made Larger */}
          <Link href="/" className="flex items-center">
            <Image
              src="/temple-stuart-logo.png"
              alt="Temple Stuart Accounting"
              width={200}  // Increased from ~100
              height={60}  // Increased proportionally
              className="h-12 sm:h-14 lg:h-16 w-auto"  // Responsive heights
              priority
            />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-gray-700 hover:text-[#b4b237] font-medium">
              Dashboard
            </Link>
            <Link href="/login" className="text-gray-700 hover:text-[#b4b237] font-medium">
              Login
            </Link>
            <Link href="/contact" className="px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630]">
              Get Started
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
