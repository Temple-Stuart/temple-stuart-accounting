'use client';

import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  headerActions?: React.ReactNode;
}

export default function AppLayout({ 
  children, 
  title, 
  subtitle,
  showBack = true,
  backHref = '/hub',
  headerActions
}: AppLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      document.cookie = `userEmail=${session.user.email}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 font-light">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-6">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#b4b237] rounded-xl flex items-center justify-center shadow-lg shadow-[#b4b237]/20">
                <span className="text-white font-bold text-lg">TS</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-gray-900">Temple Stuart</div><div className="text-xs text-gray-500">Personal Back Office</div>
                <div className="text-xs text-gray-400 font-light">OS</div>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-[#b4b237] transition-colors">
                Bookkeeping
              </Link>
              <Link href="/budgets/trips" className="text-sm text-gray-500 hover:text-[#b4b237] transition-colors">
                Agenda & Budget
              </Link>
              <Link href="/hub/itinerary" className="text-sm text-gray-500 hover:text-[#b4b237] transition-colors">
                Budget Review
              </Link>
            </nav>

            {/* User */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:block">
                {session?.user?.name || session?.user?.email?.split('@')[0]}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:border-[#b4b237] hover:text-[#b4b237] transition-all"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page Title Section */}
      {title && (
        <section className="bg-gradient-to-b from-white to-gray-50 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                {showBack && (
                  <button
                    onClick={() => router.push(backHref)}
                    className="text-sm text-gray-400 hover:text-gray-900 transition-colors mb-4 flex items-center gap-1 group"
                  >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                )}
                <h1 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-lg text-gray-500 font-light mt-2">{subtitle}</p>
                )}
              </div>
              {headerActions && (
                <div className="flex items-center gap-3">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 font-light">
            Temple Stuart • Personal Back Office
          </p>
        </div>
      </footer>
    </div>
  );
}
