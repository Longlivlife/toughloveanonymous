'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// Consent version — bump this string whenever consent text changes materially
const CONSENT_VERSION = '1.0.0'

const CONSENT_TEXT = `TOUGH LOVE ANONYMOUS — INFORMED CONSENT
Version ${CONSENT_VERSION} | Effective March 2026

WHAT THIS PLATFORM IS

Tough Love Anonymous (TLA) is a survivor-led documentation archive for people who experienced institutional programs in the Troubled Teen Industry (TTI) — therapeutic boarding schools, wilderness programs, behavior modification facilities, boot camps, and similar programs.

This platform exists to create a historical record, support survivor healing, and make pattern-based evidence available for legal proceedings, journalism, and legislation.

This is not a therapy service. This is not legal advice. This is a documentation archive.

THE AI COMPANION

When you begin a session, you will be speaking with an AI — a language model provided by Anthropic and customized by Tough Love Anonymous. It is not a human. It is not a therapist. It is not a lawyer.

The companion is designed to listen without judgment, follow your thread wherever it goes, and help you put words to your experience at your own pace. It will never lead you, suggest what happened, or challenge your framing of your experience.

If you appear to be in crisis during a session, the companion will provide crisis resources (988 Suicide and Crisis Lifeline) and encourage you to seek support.

YOUR TESTIMONY

Everything you share in the companion is saved to your private account. Your testimony has three states:

Open — Your testimony is active. You can add to it, change it, or continue the conversation at any time. This is the default state and you can return to it as many times as you need.

In Review — You can review your compiled testimony, request changes, and return to Open as many times as you like before deciding to submit.

Submitted — A deliberate, final choice. Your submitted testimony is preserved exactly as you submitted it. You can always open a new chapter after submission.

YOUR CONTROL

You decide, for each consent category below, whether to allow your testimony to be used for that purpose. You can change these choices at any time from your account settings.

Nothing from your testimony is ever shared in a way that identifies you as an individual without your explicit written permission.

DATA SECURITY

Your testimony is stored in a secured database (Supabase). Access is controlled by row-level security policies that prevent any user from seeing another user's private data. Staff access to raw testimony data is logged.

Your email address is used only for account access. We do not sell, rent, or share your email.

WITHDRAWAL

You can delete your account and all associated data at any time. Submitted testimonies will be removed from all access tiers. If your testimony has already been used in an anonymized aggregate report, those reports may not be retroactively updated, but your individual record will be deleted.

NOT A SUBSTITUTE

This platform is not a substitute for therapy, legal counsel, or crisis support. If you need immediate help, please contact the 988 Suicide and Crisis Lifeline by calling or texting 988.

CHANGES TO THIS CONSENT

If we materially change this consent agreement, you will be asked to review and re-consent before your next session.`

type ConsentChoices = {
  consent_public: boolean
  consent_attorney: boolean
  consent_researcher: boolean
  consent_survivor_network: boolean
}

export default function ConsentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [choices, setChoices] = useState<ConsentChoices>({
    consent_public: false,
    consent_attorney: false,
    consent_researcher: false,
    consent_survivor_network: false,
  })

  useEffect(() => {
    async function checkConsent() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      // Check if they've already consented
      const { data: existing } = await supabase
        .from('consent_records')
        .select('id')
        .eq('survivor_id', user.id)
        .limit(1)

      if (existing && existing.length > 0) {
        // Already consented — go to companion
        router.push('/companion')
        return
      }

      setLoading(false)
    }
    checkConsent()
  }, [router])

  function toggle(key: keyof ConsentChoices) {
    setChoices(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleConsent() {
    if (!understood || submitting) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_version: CONSENT_VERSION,
        consent_text: CONSENT_TEXT,
        ...choices,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/companion')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-stone-300 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <p className="text-xs font-medium text-stone-400 tracking-widest uppercase mb-2">
            Tough Love Anonymous
          </p>
          <h1 className="text-2xl font-medium text-stone-800 mb-2">Before we begin</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Please read this carefully. There's no rush. You can take as long as you need.
          </p>
        </div>

        {/* Consent text */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <pre className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap font-sans">
            {CONSENT_TEXT}
          </pre>
        </div>

        {/* Consent choices */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-stone-700 mb-1">Your sharing choices</h2>
          <p className="text-xs text-stone-400 mb-5 leading-relaxed">
            These are optional. You can change any of these from your account at any time.
          </p>

          <div className="space-y-4">
            <ConsentToggle
              checked={choices.consent_public}
              onChange={() => toggle('consent_public')}
              label="Anonymized public visibility"
              description="Allows your program-level data to appear in public-facing statistics (e.g. '47 documented accounts from this program'). Your name and identifying details are never included."
            />
            <ConsentToggle
              checked={choices.consent_attorney}
              onChange={() => toggle('consent_attorney')}
              label="Attorney research access"
              description="Allows licensed attorneys to search for testimonies by program, harm type, date range, and named individuals. Your identity remains protected — attorneys see aggregated patterns, not identifying information, unless you choose otherwise."
            />
            <ConsentToggle
              checked={choices.consent_researcher}
              onChange={() => toggle('consent_researcher')}
              label="Academic researcher access"
              description="Allows approved academic researchers to access testimony data for study and publication. All researcher access is reviewed and logged."
            />
            <ConsentToggle
              checked={choices.consent_survivor_network}
              onChange={() => toggle('consent_survivor_network')}
              label="Survivor community connection"
              description="Allows TLA to notify you if other survivors from your program have shared testimonies, and allows them to know you have as well. Your contact information is never shared — only the fact of your documentation."
            />
          </div>
        </div>

        {/* Final acknowledgment */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <label className="flex gap-3 items-start cursor-pointer group">
            <div
              onClick={() => setUnderstood(!understood)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
                understood
                  ? 'bg-emerald-700 border-emerald-700'
                  : 'border-stone-300 group-hover:border-stone-400'
              }`}
            >
              {understood && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <span className="text-sm text-stone-700 leading-relaxed select-none" onClick={() => setUnderstood(!understood)}>
              I have read and understood the above. I consent to the use of the TLA companion AI to help document my experiences. I understand this is not therapy and not legal advice. I understand I own my testimony and control how it is shared.
            </span>
          </label>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleConsent}
          disabled={!understood || submitting}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-colors"
        >
          {submitting ? 'Saving your consent…' : 'I consent — begin my testimony'}
        </button>

        <p className="text-xs text-stone-300 text-center mt-4 leading-relaxed">
          Your consent record is saved with a timestamp. You can review or update your choices at any time.
        </p>
      </div>
    </div>
  )
}

function ConsentToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
}) {
  return (
    <label className="flex gap-3 items-start cursor-pointer group">
      <div
        onClick={onChange}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
          checked
            ? 'bg-emerald-700 border-emerald-700'
            : 'border-stone-300 group-hover:border-stone-400'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <div onClick={onChange}>
        <p className="text-sm font-medium text-stone-700 select-none">{label}</p>
        <p className="text-xs text-stone-400 leading-relaxed mt-0.5 select-none">{description}</p>
      </div>
    </label>
  )
}
