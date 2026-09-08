'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ANSWERS_HOME } from '@/lib/answers';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/registration';

/**
 * SELL-03 — THE sign-in / sign-up box: the deck's modal (GuestLanding), the
 * cockpit's modal (HomeClient) and the /login page all mount this one
 * component. Every completion lands on ONE front door, ANSWERS_HOME
 * (/answers): the email routes answer `landing` and the box navigates there
 * with a full page load (so the fresh cookie is honored); OAuth's callbackUrl
 * is the same door. A caller that must do something first (the purchase
 * resume — checkout for a pending module key) passes onSuccess and owns the
 * navigation; nothing else redirects anywhere else.
 *
 * The password hint is PASSWORD_MIN_LENGTH — the number the server enforces
 * (src/lib/auth/registration.ts) — so client and server cannot disagree. A
 * refusal renders the server's own words; after sign-up the box shows the
 * server's message ("You're signed in") while the front door opens.
 */

export interface AuthResult {
  mode: 'login' | 'register';
  /** The server's own line — "You're signed in" after sign-up. */
  message: string;
  /** The one front door, from the server when it names it, else ANSWERS_HOME. */
  landing: string;
}

interface LoginBoxProps {
  onClose?: () => void;
  /** Own the completion (the purchase resume); when absent the box opens `result.landing`. */
  onSuccess?: (result: AuthResult) => void;
  initialMode?: 'login' | 'register';
}

export default function LoginBox({ onClose, onSuccess, initialMode = 'login' }: LoginBoxProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const body = mode === 'login'
      ? { email, password }
      : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const result: AuthResult = {
          mode,
          message: typeof data?.message === 'string' ? data.message : 'Signed in',
          landing: typeof data?.landing === 'string' && data.landing.startsWith('/') ? data.landing : ANSWERS_HOME,
        };
        setNotice(result.message);
        if (onSuccess) {
          onSuccess(result);
        } else {
          // A full navigation, not a client transition: the cookie the server
          // just set must be on the request that renders the front door.
          window.location.href = result.landing;
        }
        onClose?.();
      } else {
        setError(typeof data?.error === 'string' ? data.error : `${mode === 'login' ? 'Login' : 'Registration'} failed (HTTP ${res.status})`);
        setLoading(false);
      }
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl: ANSWERS_HOME });
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setNotice('');
  };

  return (
    <div className="bg-white shadow-sm p-8 w-full max-w-md mx-4 border border-border" data-login-box={mode}>
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-8 h-8 bg-brand-purple flex items-center justify-center">
            <span className="text-white text-xs font-bold">TS</span>
          </div>
          <span className="text-sm font-medium text-text-primary">Temple Stuart</span>
        </div>
        <h2 className="text-sm font-light text-text-primary mb-1">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-text-muted text-xs">
          {mode === 'login' ? 'Sign in to continue' : 'Start tracking your finances'}
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2 mb-5">
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-border hover:bg-bg-row hover:border-border transition-all text-sm font-medium text-text-secondary"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => handleOAuthLogin('github')}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-brand-purple text-white hover:bg-brand-purple-hover transition-all text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </button>
      </div>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-white text-text-faint">or</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full px-4 py-2.5 border border-border text-sm text-text-primary placeholder-text-faint focus:outline-none focus:border-brand-purple"
            required
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full px-4 py-2.5 border border-border text-sm text-text-primary placeholder-text-faint focus:outline-none focus:border-brand-purple"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? `Password (min ${PASSWORD_MIN_LENGTH} characters)` : 'Password'}
          className="w-full px-4 py-2.5 border border-border text-sm text-text-primary placeholder-text-faint focus:outline-none focus:border-brand-purple"
          required
          minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined}
        />
        {error && <p className="text-brand-red text-xs" role="alert" data-auth-error>{error}</p>}
        {notice && <p className="text-emerald-700 text-xs" role="status" data-auth-notice>{notice} — opening your answers…</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-hover transition-all disabled:opacity-50"
        >
          {loading
            ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
            : (mode === 'login' ? 'Continue with Email' : 'Create Account')
          }
        </button>
      </form>

      {/* Mode Switcher — the register link on every mount, /login included */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={switchMode}
          className="text-xs text-text-muted hover:text-brand-purple transition-colors"
          data-auth-switch={mode === 'login' ? 'register' : 'login'}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up free"
            : 'Already have an account? Sign in'
          }
        </button>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-text-faint hover:text-text-secondary"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
