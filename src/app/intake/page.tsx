'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// A curated list of the most commonly documented TTI programs.
// Survivors can also type a custom name if theirs isn't listed.
const KNOWN_PROGRAMS = [
  'Academy at Ivy Ridge',
  'Academy at Swift River',
  'Aspen Ranch',
  'Benchmark Transitions',
  'Boys Town',
  'Carlbrook School',
  'Casa by the Sea',
  'Cross Creek Manor / Cross Creek Programs',
  'Elan School',
  'Escuela Camelot',
  'Family Foundation School',
  'Focal Point',
  'Gateway Academy',
  'Glacier Mountain Academy',
  'Innercept',
  'Island View Residential Treatment Center',
  'Kids Helping Kids',
  'KIDS of New Jersey / KIDS of Bergen County',
  'Legacy Outdoor Adventures',
  'Liahona Academy',
  'Magdala Foundation',
  'Mel Wasserman / CEDU Family of Schools',
  'Monarch School',
  'Montana Academy',
  'Mount Bachelor Academy',
  'New Beginnings Adolescent Academy',
  'New Life Ranch',
  'North Star Expeditions',
  'Oak Creek Ranch',
  'Oasis Behavioral Health',
  'Odyssey Harbor',
  'OPI (Outdoor Pursuits Institute)',
  'Pacific Quest',
  'Paradise Cove',
  'Peninsula Village',
  'Pathway Family Center',
  'Provo Canyon School',
  'RedCliff Ascent',
  'Roloff Enterprises / Roloff Farms',
  'Sequel Youth Services (multiple campuses)',
  'SunHawk Academy',
  'Sunrise RTC',
  'Suws of the Carolinas',
  'Teen Challenge',
  'The CEDU Schools',
  'The Family (TV Show related)',
  'The Seed',
  'The Troubled Teen Industry (General / Unknown Program)',
  'Three Springs',
  'Turn About Ranch',
  'Utah Boys Ranch',
  'Vanguard School',
  'Voyage Academy',
  'West Ridge Academy',
  'Wilderness Treatment Center',
  'Wood Creek Academy',
  'Youth Care Treatment Centers',
  'Other (type below)',
]

export default function IntakePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [programSelection, setProgramSelection] = useState('')
  const [customProgram, setCustomProgram] = useState('')
  const [entryYear, setEntryYear] = useState('')
  const [exitYear, setExitYear] = useState('')
  const [ageAtEntry, setAgeAtEntry] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.push('/auth'); return }

      const { data: consent } = await supabase
        .from('consent_records').select('id').eq('survivor_id', user.id).limit(1)
      if (!consent || consent.length === 0) { router.push('/consent'); return }

      // If they've already done intake, skip to companion
      const { data: survivor } = await supabase
        .from('survivors').select('program_id, entry_year').eq('id', user.id).single()
      if (survivor?.entry_year) { router.push('/companion'); return }

      setLoading(false)
    }
    check()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const programName = programSelection === 'Other (type below)' ? customProgram.trim() : programSelection
    if (!programName) { setError('Please tell us which program you attended.'); return }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_name: programName,
        entry_year: entryYear ? parseInt(entryYear) : null,
        exit_year: exitYear ? parseInt(exitYear) : null,
        age_at_entry: ageAtEntry ? parseInt(ageAtEntry) : null,
        display_name_choice: displayName.trim() || null,
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
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-stone-300 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-xl mx-auto">

        <div className="mb-8">
          <p className="text-xs font-medium text-stone-400 tracking-widest uppercase mb-2">
            Tough Love Anonymous
          </p>
          <h1 className="text-2xl font-medium text-stone-800 mb-2">A few things before we begin</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            This helps us connect your testimony to the right program record. Everything here is private by default.
            You can skip anything you're not ready to answer — you can always fill it in later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Program */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Which program were you in?
            </label>
            <p className="text-xs text-stone-400 mb-3">
              If yours isn't listed, choose "Other" and type it below.
            </p>
            <select
              value={programSelection}
              onChange={e => setProgramSelection(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:border-stone-400 bg-white"
            >
              <option value="">Select a program…</option>
              {KNOWN_PROGRAMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {programSelection === 'Other (type below)' && (
              <input
                type="text"
                value={customProgram}
                onChange={e => setCustomProgram(e.target.value)}
                placeholder="Program name"
                className="mt-3 w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              />
            )}
          </div>

          {/* Years + age */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <p className="text-sm font-medium text-stone-700 mb-4">When were you there?</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1.5">Entry year</label>
                <input
                  type="number"
                  value={entryYear}
                  onChange={e => setEntryYear(e.target.value)}
                  placeholder="e.g. 2003"
                  min="1960" max={new Date().getFullYear()}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1.5">Exit year</label>
                <input
                  type="number"
                  value={exitYear}
                  onChange={e => setExitYear(e.target.value)}
                  placeholder="e.g. 2005"
                  min="1960" max={new Date().getFullYear()}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1.5">Age at entry</label>
                <input
                  type="number"
                  value={ageAtEntry}
                  onChange={e => setAgeAtEntry(e.target.value)}
                  placeholder="e.g. 15"
                  min="5" max="25"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
                />
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              How would you like to be referred to? <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-stone-400 mb-3">
              This is only used if you later choose to share your testimony with attorney or researcher tiers. It's never your real name unless you choose that.
            </p>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Survivor #1, Anonymous, a first name, anything you choose"
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
            />
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/companion')}
              className="flex-1 border border-stone-200 text-stone-500 hover:border-stone-300 text-sm font-medium py-3 rounded-xl transition-colors"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-2 flex-grow bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium py-3 px-6 rounded-xl transition-colors"
            >
              {submitting ? 'Saving…' : 'Continue to companion →'}
            </button>
          </div>
        </form>

        <p className="text-xs text-stone-300 text-center mt-5 leading-relaxed">
          You can update any of this from your dashboard at any time.
        </p>
      </div>
    </div>
  )
}
