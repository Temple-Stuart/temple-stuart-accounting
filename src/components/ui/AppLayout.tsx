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
  { name: 'Hub', href: '/hub' },
  { name: 'Books', href: '/dashboard' },
  { name: 'Business', href: '/business' },
  { name: 'Trading', href: '/trading' },
  { name: 'Home', href: '/home' },
  { name: 'Auto', href: '/auto' },
  { name: 'Shopping', href: '/shopping' },
  { name: 'Personal', href: '/personal' },
  { name: 'Health', href: '/health' },
  { name: 'Growth', href: '/growth' },
  { name: 'Trips', href: '/budgets/trips' },
  { name: 'Income', href: '/income' },
  { name: 'Budget', href: '/hub/itinerary' },
];


export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cookieUser, setCookieUser] = useState<CookieUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  // Cookie is now HMAC-signed server-side (login/register/nextauth).
  // Client-side writes removed to prevent overwriting signed cookies.

  const isAuthenticated = session?.user || cookieUser;
  const currentUser = session?.user || cookieUser;

  useEffect(() => {
    if (!checkingAuth && status !== 'loading' && !isAuthenticated) {
      router.push('/');
    }
  }, [checkingAuth, status, isAuthenticated, router]);

  if (status === 'loading' || checkingAuth) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 font-mono text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    document.cookie = 'userEmail=; path=/; max-age=0';
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Wall Street Style Header */}
      <header className="bg-[#2d1b4e] text-white sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-between h-12 px-4 lg:px-6">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-2 group">
              <div className="w-7 h-7 bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-xs font-mono">TS</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-white text-sm tracking-tight">Temple Stuart</div>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden lg:flex items-center">
              {navigation.map((item, idx) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/hub' && item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href}
                    className={`px-3 py-1.5 text-xs font-medium transition-all border-b-2 ${
                      isActive 
                        ? 'text-white border-white bg-white/10' 
                        : 'text-gray-300 border-transparent hover:text-white hover:bg-white/5'
                    }`}>
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium text-white">{currentUser?.name || currentUser?.email?.split('@')[0]}</div>
                <div className="text-[10px] text-gray-400 font-mono">{currentUser?.email}</div>
              </div>
              <button onClick={handleSignOut} className="px-3 py-1 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                Sign out
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-1.5 hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen 
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> 
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 bg-[#1a0f2e] px-4 py-2">
              <div className="grid grid-cols-3 gap-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/hub' && item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2 text-xs font-medium text-center transition-all ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}>
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-[1800px] mx-auto">{children}</main>
    </div>
  );
}
