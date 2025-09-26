'use client';

import Link from 'next/link';
import { Twitter, Linkedin, Github, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">Temple Stuart Accounting</h3>
            <p className="text-gray-400 mb-4">
              Professional bookkeeping and automation for small businesses. 
              Simple, accurate, and built for entrepreneurs.
            </p>
            
            {/* Social Icons - Moved from Header */}
            <div className="flex space-x-4 mt-6">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#b4b237] transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-6 w-6" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#b4b237] transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-6 w-6" />
              </a>
              <a
                href="https://github.com/Temple-Stuart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#b4b237] transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-6 w-6" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#b4b237] transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-6 w-6" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-[#b4b237]">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-[#b4b237]">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/features" className="text-gray-400 hover:text-[#b4b237]">
                  Features
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-[#b4b237]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-gray-400 hover:text-[#b4b237]">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-[#b4b237]">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2025 Temple Stuart Accounting. All rights reserved.
            </p>
            <p className="text-gray-400 text-sm mt-2 md:mt-0">
              Built with ❤️ in Los Angeles
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
