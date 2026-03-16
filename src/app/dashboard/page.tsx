'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Testimony = {
  id: string
  raw_transcript: string | null
  structured_summary: string | null
  survivor_approved: boolean
  visibility_tier: string
  corroboration_flag: boolean
  created_at: string
}

type Survivor = {
  id: string
  email: string
  display_name_choice: string | null
  entry_year: number | null
  exit_year: number | null
  age_at_entry: number | null
  consent_public: boolean
  consent_attorney: boolean
  consent_researcher: boolean
  consent_survivor_network: boolean
}

type EvidenceFile = {
  id: string
  file_url: string
  file_type: string
  document_type: string
  description: string | null
  approximate_date: string | null
  created_at: string
}

type ActiveTab = 'testimony' | 'evidence' | 'consent' | 'account'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [survivor, setSurvivor] = useState<Survivor | null>(null)
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('testimony')
  const [programName, setProgramName] = useState<string>('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: s } = await supabase
      .from('survivors')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!s) { router.push('/consent'); return }
    setSurvivor(s)

    // Fetch program name if set
    if (s.program_id) {
      const { data: prog } = await supabase
        .from('programs').select('name').eq('id', s.program_id).single()
      if (prog) setProgramName(prog.name)
    }

    const { data: t } = await supabase
      .from('testimonies')
      .select('*')
      .eq('survivor_id', user.id)
      .order('created_at', { ascending: false })
    setTestimonies(t || [])

    const { data: ef } = await supabase
      .from('evidence_files')
      .select('*')
      .eq('uploader_survivor_id', user.id)
      .order('created_at', { ascending: false })
    setEvidenceFiles(ef || [])

    setLoading(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return <LoadingSpinner />

  const activeTestimony = testimonies.find(t => !t.survivor_approved) || testimonies[0] || null
  const submittedTestimonies = testimonies.filter(t => t.survivor_approved)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-stone-400 tracking-widest uppercase">
          Tough Love Anonymous
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/companion')}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
          >
            ← Continue testimony
          </button>
          <button
            onClick={signOut}
            className="text-xs text-stone-400 hover:text-stone-500"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-medium text-stone-800">
            {survivor?.display_name_choice ? `Welcome back, ${survivor.display_name_choice}` : 'Your testimony space'}
          </h1>
          {programName && (
            <p className="text-sm text-stone-400 mt-0.5">
              {programName}
              {survivor?.entry_year && ` · ${survivor.entry_year}`}
              {survivor?.exit_year && `–${survivor.exit_year}`}
              {survivor?.age_at_entry && ` · Entered age ${survivor.age_at_entry}`}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-stone-100 rounded-xl p-1">
          {(['testimony', 'evidence', 'consent', 'account'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'testimony' && (
          <TestimonyTab
            active={activeTestimony}
            submitted={submittedTestimonies}
            onRefresh={loadDashboard}
          />
        )}
        {activeTab === 'evidence' && (
          <EvidenceTab files={evidenceFiles} onRefresh={loadDashboard} survivor={survivor} />
        )}
        {activeTab === 'consent' && (
          <ConsentTab survivor={survivor} onRefresh={loadDashboard} />
        )}
        {activeTab === 'account' && (
          <AccountTab survivor={survivor} programName={programName} onRefresh={loadDashboard} />
        )}
      </div>
    </div>
  )
}

// ─── Testimony Tab ───────────────────────────────────────────────────────────

function TestimonyTab({
  active,
  submitted,
  onRefresh,
}: {
  active: Testimony | null
  submitted: Testimony[]
  onRefresh: () => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  async function submitTestimony(id: string) {
    setSubmitting(true)
    const res = await fetch('/api/testimony', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', testimony_id: id }),
    })
    if (res.ok) {
      setConfirmSubmit(false)
      setReviewing(false)
      onRefresh()
    }
    setSubmitting(false)
  }

  if (!active && submitted.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <p className="text-sm text-stone-400 mb-4">
          You haven't started your testimony yet.
        </p>
        <a
          href="/companion"
          className="text-sm text-emerald-700 font-medium hover:text-emerald-800"
        >
          Begin with the companion →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active testimony */}
      {active && !active.survivor_approved && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-stone-600">Open</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Started {new Date(active.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setReviewing(!reviewing)}
                className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5"
              >
                {reviewing ? 'Hide' : 'Review'}
              </button>
              <button
                onClick={() => { setReviewing(true); setConfirmSubmit(true) }}
                className="text-xs text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded-lg px-3 py-1.5"
              >
                Submit
              </button>
            </div>
          </div>

          {reviewing && (
            <div className="px-5 py-4">
              <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                This is your raw transcript exactly as captured. Review it carefully. You can continue adding to it through the companion at any time before submitting.
              </p>
              <div className="bg-stone-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap font-sans">
                  {active.raw_transcript || 'No transcript yet.'}
                </pre>
              </div>

              {confirmSubmit && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">Are you ready to submit?</p>
                  <p className="text-xs text-amber-700 leading-relaxed mb-4">
                    Submitting preserves this version of your testimony permanently. You can always open a new chapter after submission — your story is never finished unless you say so.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmSubmit(false)}
                      className="flex-1 text-xs border border-stone-200 text-stone-500 rounded-lg py-2"
                    >
                      Not yet
                    </button>
                    <button
                      onClick={() => submitTestimony(active.id)}
                      disabled={submitting}
                      className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-lg py-2 font-medium"
                    >
                      {submitting ? 'Submitting…' : 'Yes — submit this chapter'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submitted testimonies */}
      {submitted.map((t) => (
        <SubmittedTestimony key={t.id} testimony={t} />
      ))}

      <div className="text-center pt-2">
        <a href="/companion" className="text-xs text-emerald-700 hover:text-emerald-800 font-medium">
          + Continue adding to your testimony
        </a>
      </div>
    </div>
  )
}

function SubmittedTestimony({ testimony }: { testimony: Testimony }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-stone-400" />
            <span className="text-xs font-medium text-stone-600">Submitted</span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Preserved {new Date(testimony.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          {expanded ? 'Collapse' : 'View'}
        </button>
      </div>
      {expanded && (
        <div className="px-5 py-4">
          <div className="bg-stone-50 rounded-xl p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap font-sans">
              {testimony.raw_transcript}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Evidence Tab ────────────────────────────────────────────────────────────

function EvidenceTab({
  files,
  onRefresh,
  survivor,
}: {
  files: EvidenceFile[]
  onRefresh: () => void
  survivor: Survivor | null
}) {
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [docType, setDocType] = useState('other')
  const [approxDate, setApproxDate] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const DOC_TYPES = [
    { value: 'writing_assignment', label: 'Writing assignment from program' },
    { value: 'program_script', label: 'Program script or materials' },
    { value: 'staff_photo', label: 'Staff photo' },
    { value: 'facility_photo', label: 'Facility photo' },
    { value: 'medical_record', label: 'Medical record' },
    { value: 'correspondence', label: 'Correspondence (letters, emails)' },
    { value: 'legal_record', label: 'Legal record' },
    { value: 'other', label: 'Other document' },
  ]

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setUploadError('Please select a file.'); return }
    if (file.size > 20 * 1024 * 1024) { setUploadError('File must be under 20MB.'); return }

    setUploading(true)
    setUploadError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('evidence')
      .upload(path, file)

    if (uploadErr) {
      setUploadError('Upload failed. Please try again.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(path)

    const fileType = file.type.startsWith('image') ? 'photo'
      : file.type.startsWith('audio') ? 'audio'
      : file.type.startsWith('video') ? 'video'
      : 'document'

    await supabase.from('evidence_files').insert({
      uploader_survivor_id: user.id,
      file_url: publicUrl,
      file_type: fileType,
      document_type: docType,
      description: description.trim() || null,
      approximate_date: approxDate || null,
      visibility_tier: 'private',
    })

    if (fileRef.current) fileRef.current.value = ''
    setDescription('')
    setApproxDate('')
    setDocType('other')
    setUploading(false)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-1">Upload evidence</h2>
        <p className="text-xs text-stone-400 mb-5 leading-relaxed">
          Documents, photos, letters, writing assignments, program materials — anything that helps tell the story. All uploads are private by default. Max 20MB per file.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-stone-400 mb-1.5">Document type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 focus:outline-none focus:border-stone-400 bg-white"
            >
              {DOC_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-stone-400 mb-1.5">Description <span className="text-stone-300">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this? What does it show?"
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-400 mb-1.5">Approximate date <span className="text-stone-300">(optional)</span></label>
            <input
              type="text"
              value={approxDate}
              onChange={e => setApproxDate(e.target.value)}
              placeholder="e.g. 2003, Summer 2004, unknown"
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-400 mb-1.5">File</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.txt,.mp3,.mp4,.mov,.m4a"
              className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-stone-200 file:text-xs file:text-stone-500 file:bg-white hover:file:bg-stone-50"
            />
          </div>

          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        </div>
      </div>

      {/* Existing files */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-medium text-stone-700">{files.length} file{files.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <div className="divide-y divide-stone-100">
            {files.map(f => (
              <div key={f.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">
                    {f.file_type === 'photo' ? '🖼️' : f.file_type === 'audio' ? '🎵' : f.file_type === 'video' ? '🎬' : '📄'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 truncate">{f.description || f.document_type}</p>
                  <p className="text-xs text-stone-400">{f.approximate_date || 'Date unknown'} · Private</p>
                </div>
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 hover:text-emerald-800 flex-shrink-0"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Consent Tab ─────────────────────────────────────────────────────────────

function ConsentTab({ survivor, onRefresh }: { survivor: Survivor | null; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [choices, setChoices] = useState({
    consent_public: survivor?.consent_public ?? false,
    consent_attorney: survivor?.consent_attorney ?? false,
    consent_researcher: survivor?.consent_researcher ?? false,
    consent_survivor_network: survivor?.consent_survivor_network ?? false,
  })

  function toggle(key: keyof typeof choices) {
    setChoices(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  async function saveChoices() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('survivors').update(choices).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    onRefresh()
  }

  const CONSENT_OPTIONS = [
    {
      key: 'consent_public' as const,
      label: 'Anonymized public statistics',
      description: "Allow your program to appear in public-facing counts (e.g. '47 documented accounts'). Your identity is never included.",
    },
    {
      key: 'consent_attorney' as const,
      label: 'Attorney research access',
      description: 'Allow licensed attorneys to find your program in pattern searches. Your identity stays protected.',
    },
    {
      key: 'consent_researcher' as const,
      label: 'Academic researcher access',
      description: 'Allow approved researchers to access testimony data. All access is reviewed and logged.',
    },
    {
      key: 'consent_survivor_network' as const,
      label: 'Survivor community connection',
      description: 'Allow TLA to notify you when other survivors from your program document. Your contact info is never shared.',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6">
      <h2 className="text-sm font-medium text-stone-700 mb-1">Your sharing choices</h2>
      <p className="text-xs text-stone-400 mb-5 leading-relaxed">
        Change these at any time. Updates take effect immediately.
      </p>

      <div className="space-y-5 mb-6">
        {CONSENT_OPTIONS.map(opt => (
          <label key={opt.key} className="flex gap-3 items-start cursor-pointer group">
            <div
              onClick={() => toggle(opt.key)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
                choices[opt.key]
                  ? 'bg-emerald-700 border-emerald-700'
                  : 'border-stone-300 group-hover:border-stone-400'
              }`}
            >
              {choices[opt.key] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <div onClick={() => toggle(opt.key)}>
              <p className="text-sm font-medium text-stone-700 select-none">{opt.label}</p>
              <p className="text-xs text-stone-400 leading-relaxed mt-0.5 select-none">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={saveChoices}
        disabled={saving}
        className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab({
  survivor,
  programName,
  onRefresh,
}: {
  survivor: Survivor | null
  programName: string
  onRefresh: () => void
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(survivor?.display_name_choice || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function saveDisplayName() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('survivors').update({ display_name_choice: displayName.trim() || null }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    onRefresh()
  }

  async function deleteAccount() {
    setDeleting(true)
    const res = await fetch('/api/account', { method: 'DELETE' })
    if (res.ok) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth')
    } else {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-4">Your information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-stone-400 mb-1.5">Email</label>
            <p className="text-sm text-stone-600">{survivor?.email}</p>
          </div>

          {programName && (
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">Program</label>
              <p className="text-sm text-stone-600">
                {programName}
                {survivor?.entry_year && ` · ${survivor.entry_year}`}
                {survivor?.exit_year && `–${survivor.exit_year}`}
              </p>
              <button
                onClick={() => router.push('/intake')}
                className="text-xs text-emerald-700 hover:text-emerald-800 mt-1"
              >
                Update program info →
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs text-stone-400 mb-1.5">Display name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
                placeholder="How you'd like to be referred to"
                className="flex-1 border border-stone-200 rounded-xl px-3.5 py-2 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              />
              <button
                onClick={saveDisplayName}
                disabled={saving}
                className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl px-3 py-2 transition-colors"
              >
                {saving ? '…' : saved ? '✓' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete account */}
      <div className="bg-white rounded-2xl border border-red-100 p-6">
        <h2 className="text-sm font-medium text-red-700 mb-1">Delete my account</h2>
        <p className="text-xs text-stone-400 leading-relaxed mb-4">
          This permanently deletes your account and all testimony data. This cannot be undone.
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded-xl px-4 py-2 transition-colors"
          >
            Delete my account and all data
          </button>
        ) : (
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-sm font-medium text-red-800 mb-3">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 text-xs border border-stone-200 text-stone-500 rounded-lg py-2"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 font-medium"
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function LoadingSpinner() {
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
