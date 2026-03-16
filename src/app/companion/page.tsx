'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import VoiceInput from '@/components/VoiceInput'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type SessionContext = {
  isReturning: boolean
  priorContext: string | null
  testimonyId: string | null
  priorTranscript: string | null
}

export default function CompanionPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [sessionCtx, setSessionCtx] = useState<SessionContext>({
    isReturning: false,
    priorContext: null,
    testimonyId: null,
    priorTranscript: null,
  })
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testimonyId, setTestimonyId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    initSession()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, busy])

  useEffect(() => {
    if (history.length < 2) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveSession(), 5000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [history])

  async function initSession() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: consent } = await supabase
      .from('consent_records').select('id').eq('survivor_id', user.id).limit(1)
    if (!consent || consent.length === 0) { router.push('/consent'); return }

    setAuthChecked(true)

    // Load prior testimony — most recent open (unsubmitted) testimony
    const { data: testimonies } = await supabase
      .from('testimonies')
      .select('id, raw_transcript, created_at')
      .eq('survivor_id', user.id)
      .eq('survivor_approved', false)
      .order('created_at', { ascending: false })
      .limit(1)

    const existing = testimonies?.[0]

    if (existing?.raw_transcript && existing.raw_transcript.trim().length > 50) {
      // Returning survivor — generate context summary
      setTestimonyId(existing.id)

      try {
        const res = await fetch('/api/session-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: existing.raw_transcript }),
        })
        const data = await res.json()

        const ctx: SessionContext = {
          isReturning: true,
          priorContext: data.summary || null,
          testimonyId: existing.id,
          priorTranscript: existing.raw_transcript,
        }
        setSessionCtx(ctx)
        setLoading(false)
        openingMessage(ctx)
      } catch {
        // Fallback — still mark as returning even if summary fails
        const ctx: SessionContext = {
          isReturning: true,
          priorContext: null,
          testimonyId: existing.id,
          priorTranscript: existing.raw_transcript,
        }
        setSessionCtx(ctx)
        setLoading(false)
        openingMessage(ctx)
      }
    } else {
      // First-time survivor
      const ctx: SessionContext = {
        isReturning: false,
        priorContext: null,
        testimonyId: existing?.id || null,
        priorTranscript: null,
      }
      setSessionCtx(ctx)
      setLoading(false)
      openingMessage(ctx)
    }
  }

  async function openingMessage(ctx: SessionContext) {
    setBusy(true)

    const openingPrompt = ctx.isReturning
      ? 'This is a returning survivor. Give a warm, brief returning greeting. Do not repeat what they shared before unless they bring it up. Ask gently where they would like to begin today — continuing where they left off, or something new. One soft question. Keep it brief.'
      : 'Please give your opening greeting to a survivor arriving for the first time. Warm, brief, end with one gentle open question.'

    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: openingPrompt }],
          prior_context: ctx.priorContext,
          is_returning: ctx.isReturning,
        }),
      })
      const data = await res.json()
      if (data.text) setHistory([{ role: 'assistant', content: data.text }])
    } catch {
      const fallback = ctx.isReturning
        ? "Welcome back. I'm glad you're here again. There's no pressure to pick up right where we left off — we can go wherever feels right today. Where would you like to start?"
        : "Hi. I'm really glad you're here. This is your space — no pressure, no timeline, no wrong way to do this. Whenever you're ready, what brought you here today?"
      setHistory([{ role: 'assistant', content: fallback }])
    }
    setBusy(false)
  }

  async function saveSession() {
    if (history.length < 2) return
    setSaveStatus('saving')

    // Build full transcript — combine prior + current session
    const currentSession = history
      .map(m => `[${m.role === 'assistant' ? 'Companion' : 'Survivor'}]\n${m.content}`)
      .join('\n\n')

    // Append to prior transcript rather than replace it
    const sessionDivider = `\n\n--- Session ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ---\n\n`
    const fullTranscript = sessionCtx.priorTranscript
      ? sessionCtx.priorTranscript + sessionDivider + currentSession
      : currentSession

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: fullTranscript,
          testimony_id: testimonyId || sessionCtx.testimonyId,
        }),
      })
      const data = await res.json()
      if (data.testimony_id && !testimonyId) setTestimonyId(data.testimony_id)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('idle')
    }
  }

  async function send(text?: string) {
    const txt = (text ?? input).trim()
    if (!txt || busy) return
    if (!text) setInput('')
    setError('')
    if (taRef.current && !text) taRef.current.style.height = 'auto'

    const newHistory: Message[] = [...history, { role: 'user', content: txt }]
    setHistory(newHistory)
    setBusy(true)

    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          prior_context: sessionCtx.priorContext,
          is_returning: sessionCtx.isReturning,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHistory([...newHistory, { role: 'assistant', content: data.text }])
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
      setHistory(newHistory)
    }
    setBusy(false)
  }

  function handleVoiceTranscript(text: string) {
    setInput(prev => prev.trim() ? prev.trim() + ' ' + text : text)
    setTimeout(() => taRef.current?.focus(), 100)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    setInput(e.target.value)
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-stone-300 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          {authChecked && (
            <p className="text-xs text-stone-300">
              {sessionCtx.isReturning ? 'Picking up where you left off…' : 'Preparing your space…'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-stone-200 flex flex-col" style={{ height: '680px' }}>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-400 tracking-widest uppercase">Tough Love Anonymous</p>
            <p className="text-xs text-stone-300 mt-0.5">
              {sessionCtx.isReturning ? 'Welcome back · Your testimony continues' : 'Confidential · Your testimony · No rush'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  saveStatus === 'saving' ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400'
                }`} />
                <span className="text-xs text-stone-300">{saveStatus === 'saving' ? 'Saving…' : 'Saved'}</span>
              </div>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {history.map((m, i) => (
            <div key={i} className={`flex flex-col max-w-[84%] ${m.role === 'assistant' ? 'self-start' : 'self-end'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'assistant'
                  ? 'bg-stone-100 text-stone-800 rounded-bl-sm'
                  : 'bg-emerald-50 text-emerald-900 rounded-br-sm'
              }`}>
                {m.content}
              </div>
              <div className={`text-xs text-stone-300 mt-1 px-1 ${m.role === 'user' ? 'text-right' : ''}`}>
                {m.role === 'assistant' ? 'companion' : 'you'}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex flex-col max-w-[84%] self-start">
              <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-xs text-red-400 text-center px-4 pb-1">{error}</p>}

        {history.length <= 1 && !sessionCtx.isReturning && (
          <p className="text-xs text-stone-300 text-center px-4 pb-1">
            You can speak or type — tap the mic to use your voice
          </p>
        )}

        <p className="text-xs text-stone-300 text-center px-4 pb-1">
          Your story belongs to you. Nothing leaves this space without your consent.
        </p>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-stone-100 flex gap-2 items-end">
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={busy} />
          <textarea
            ref={taRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKey}
            placeholder="Speak or type your story here…"
            rows={1}
            className="flex-1 resize-none border border-stone-200 rounded-xl px-3 py-2.5 text-sm leading-relaxed text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 min-h-[42px] max-h-[120px] bg-white"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl h-[42px] whitespace-nowrap transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
