'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl border border-stone-200 px-8 py-10">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-lg font-medium text-stone-800 mb-2">Check your email</h1>
            <p className="text-sm text-stone-500 leading-relaxed mb-1">
              We sent a secure link to
            </p>
            <p className="text-sm font-medium text-stone-700 mb-4">{email}</p>
            <p className="text-sm text-stone-400 leading-relaxed">
              Click the link in the email to continue. It's valid for 24 hours — you only need to do this once per device.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-xs text-stone-400 hover:text-stone-500 underline underline-offset-2"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-stone-200 px-8 py-10">

          <div className="mb-8">
            <p className="text-xs font-medium text-stone-400 tracking-widest uppercase mb-1">
              Tough Love Anonymous
            </p>
            <h1 className="text-xl font-medium text-stone-800 leading-snug">
              Your story deserves<br />a permanent home.
            </h1>
          </div>

          <p className="text-sm text-stone-500 leading-relaxed mb-7">
            Enter your email and we'll send you a secure link — no password needed. Your account is private and used only to preserve your testimony across sessions.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-stone-400 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading ? 'Sending…' : 'Send my secure link'}
            </button>
          </form>

          <p className="text-xs text-stone-300 text-center mt-6 leading-relaxed">
            We will never sell your data or contact you for anything other than account access.
          </p>
        </div>
      </div>
    </div>
  )
}
