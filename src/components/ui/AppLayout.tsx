'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface CookieUser {
  email: string;
  name: string;
}

const navigation = [
  { name: 'Hub', href: '/hub', icon: '⬡' },
  { name: 'Bookkeeping', href: '/dashboard', icon: '📒' },
  { name: 'Trips', href: '/budgets/trips', icon: '✈️' },
  { name: 'Budget', href: '/hub/itinerary', icon: '📊' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cookieUser, setCookieUser] = useState<CookieUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check for cookie-based auth (email/password login)
  useEffect(() => {
    const checkCookieAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCookieUser(data.user);
          }
        }
      } catch (e) {
        // No cookie auth
      } finally {
        setCheckingAuth(false);
      }
    };
    checkCookieAuth();
  }, []);

  // Sync NextAuth session to cookie for API routes
  useEffect(() => {
    if (session?.user?.email) {
      document.cookie = `userEmail=${session.user.email}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, [session]);

  // Determine if user is authenticated via either method
  const isAuthenticated = session?.user || cookieUser;
  const currentUser = session?.user || cookieUser;

  // Redirect if not authenticated (after both checks complete)
  useEffect(() => {
    if (!checkingAuth && status !== 'loading' && !isAuthenticated) {
      router.push('/');
    }
  }, [checkingAuth, status, isAuthenticated, router]);

  // Show loading while checking auth
  if (status === 'loading' || checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 font-medium">Loading Temple Stuart...</span>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    // Clear cookie
    document.cookie = 'userEmail=; path=/; max-age=0';
    // Sign out of NextAuth if applicable
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      // Just redirect for cookie-based auth
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <Link href="/hub" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-[#b4b237] to-[#8f8c2a] rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">TS</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-gray-900 text-lg tracking-tight">Temple Stuart</div>
                <div className="text-xs text-gray-400 font-medium -mt-0.5">Financial OS</div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/hub' && pathname?.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                    <span className="mr-2">{item.icon}</span>{item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">{currentUser?.name || currentUser?.email?.split('@')[0]}</div>
                <div className="text-xs text-gray-500">{currentUser?.email}</div>
              </div>
              <button onClick={handleSignOut} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                Sign out
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/hub' && pathname?.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <span>{item.icon}</span>{item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-[1800px] mx-auto">{children}</main>
    </div>
  );
}
