'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center w-full">
          <p className="text-gray-600 text-sm">
            Copyright © 2026 Temple Stuart. All rights reserved.
          </p>
          <Link
            href="/developer"
            className="text-[#b4b237] hover:text-[#9a9630] text-sm font-medium mt-2 sm:mt-0"
          >
            Developer Dashboard →
          </Link>
        </div>
      </div>
    </footer>
  );
}
