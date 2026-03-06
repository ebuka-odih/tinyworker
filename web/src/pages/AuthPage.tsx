import React from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { API_BASE, readErrorMessage } from '../services/apiBase';

function sanitizeNextPath(input: string | null): string {
  const next = String(input || '').trim();
  if (!next.startsWith('/')) return '/new-search';
  if (next.startsWith('//')) return '/new-search';
  if (next.startsWith('/auth')) return '/new-search';
  return next;
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authBusy, authUser, storeAccessToken } = useAuth();

  const nextPath = React.useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams]);
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (authUser) {
    return <Navigate to={nextPath} replace />;
  }

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      const endpoint = mode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
      const payload: { email: string; password: string; displayName?: string } = {
        email: email.trim(),
        password,
      };

      if (mode === 'register' && displayName.trim()) {
        payload.displayName = displayName.trim();
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Authentication failed'));
      }

      const body = (await response.json()) as { accessToken?: string };
      const token = String(body.accessToken || '').trim();
      if (!token) {
        throw new Error('Authentication succeeded without an access token');
      }

      storeAccessToken(token);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 md:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-stretch">
        <section className="rounded-[28px] border border-neutral-200 bg-white p-8 md:p-10 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-600">
            <ShieldCheck size={14} />
            Account Required Before Search
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-neutral-950">
            Sign in before you run a search.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
            TinyFinder now requires an account so each search run, live stream, and saved session stays tied to the right user.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[
              'Restore active search sessions after refresh',
              'Protect live run streams with your account token',
              'Keep profile and saved search state scoped to you',
              'Use the same account for future saved opportunities',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm font-medium text-neutral-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 text-sm text-neutral-500">
            Want to browse first? Return to the <Link className="font-semibold text-neutral-900 hover:underline" to="/">landing page</Link>.
          </div>
        </section>

        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-500">Access TinyFinder</p>
              <h2 className="mt-1 text-2xl font-bold text-neutral-950">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white">
              <LockKeyhole size={20} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${mode === 'login' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${mode === 'register' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-700">Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition-all focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition-all focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-neutral-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !busy && !authBusy) {
                    void submit();
                  }
                }}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition-all focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!email.trim() || !password || busy || authBusy}
            className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy || authBusy ? 'Working...' : mode === 'login' ? 'Sign in and continue' : 'Create account and continue'}
            {!busy && !authBusy && <ArrowRight size={16} />}
          </button>

          <p className="mt-4 text-xs leading-5 text-neutral-500">
            {mode === 'login' ? 'Use the account tied to your existing search sessions.' : 'Registration signs you in immediately and returns you to the search flow.'}
          </p>
        </section>
      </div>
    </div>
  );
}
