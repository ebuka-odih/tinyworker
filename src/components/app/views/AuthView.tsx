import React, { useState } from 'react'
import { Button, Card } from '../AppPrimitives'

export function AuthView({
  authError,
  onAuthErrorClear,
  onAuthSuccess,
}: {
  authError: string | null
  onAuthErrorClear: () => void
  onAuthSuccess: (token: string) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body: any = { email: email.trim(), password }
      if (mode === 'register' && displayName.trim()) {
        body.displayName = displayName.trim()
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Authentication failed')
      }

      const payload = await res.json()
      const token = String(payload?.accessToken || '')
      if (!token) throw new Error('Missing access token')

      onAuthErrorClear()
      onAuthSuccess(token)
    } catch (e: any) {
      setError(e?.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <Card className="w-full max-w-md bg-white">
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Sign in to TinyWorker</h2>
            <p className="text-sm text-slate-500 mt-1">Use your account to access CV and profile tools.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === 'login' ? 'primary' : 'outline'}
              className="w-full"
              onClick={() => setMode('login')}
            >
              Login
            </Button>
            <Button
              variant={mode === 'register' ? 'primary' : 'outline'}
              className="w-full"
              onClick={() => setMode('register')}
            >
              Register
            </Button>
          </div>

          <div className="space-y-3">
            {mode === 'register' ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                placeholder="Display name (optional)"
              />
            ) : null}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="Email"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="Password"
            />
          </div>

          {authError || error ? (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error || authError}
            </div>
          ) : null}

          <Button className="w-full" onClick={submit} disabled={!email.trim() || !password || busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Login' : 'Create account'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
