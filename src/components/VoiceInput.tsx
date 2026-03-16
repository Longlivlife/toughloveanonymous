'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type VoiceInputProps = {
  onTranscript: (text: string) => void
  disabled?: boolean
}

// TTI-specific terms the speech engine commonly mangles
const TTI_CORRECTIONS: Record<string, string> = {
  'synonymon': 'Synanon',
  'synonym': 'Synanon',
  'sin anon': 'Synanon',
  'nat sap': 'NATSAP',
  'carf': 'CARF',
  'nat cap': 'NATSAP',
  'the seed': 'The Seed',
  'provo': 'Provo Canyon',
  'turn about': 'Turnabout Ranch',
  'turn a bout': 'Turnabout Ranch',
  'elon': 'Elan',
  'the elon school': 'the Elan School',
  'cascade': 'Cascade',
  'cedu': 'CEDU',
  'say doo': 'CEDU',
  'see doo': 'CEDU',
  'raptor': 'raptor', // keep — sometimes used literally
  'mt bachelor': 'Mt. Bachelor Academy',
  'mount bachelor': 'Mt. Bachelor Academy',
}

function applyLocalCorrections(text: string): string {
  let result = text
  for (const [wrong, right] of Object.entries(TTI_CORRECTIONS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi')
    result = result.replace(regex, right)
  }
  return result
}

export default function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [liveText, setLiveText] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [correctedText, setCorrectedText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (final) {
        finalTranscriptRef.current += ' ' + final
      }
      setLiveText((finalTranscriptRef.current + ' ' + interim).trim())
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error)
        setListening(false)
      }
    }

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (recognitionRef.current?._shouldListen) {
        try { recognition.start() } catch {}
      }
    }

    recognitionRef.current = recognition
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || disabled) return
    finalTranscriptRef.current = ''
    setLiveText('')
    setCorrectedText('')
    setShowPreview(false)
    recognitionRef.current._shouldListen = true
    try {
      recognitionRef.current.start()
      setListening(true)
    } catch (e) {
      console.error('Could not start recognition:', e)
    }
  }, [disabled])

  const stopListening = useCallback(async () => {
    if (!recognitionRef.current) return
    recognitionRef.current._shouldListen = false
    recognitionRef.current.stop()
    setListening(false)

    const raw = liveText.trim()
    if (!raw) return

    // Apply local TTI corrections first (fast, no API call)
    const localCorrected = applyLocalCorrections(raw)

    // If it's short and clean, skip the AI correction pass
    if (localCorrected.length < 80) {
      setCorrectedText(localCorrected)
      setShowPreview(true)
      return
    }

    // AI correction pass for longer transcripts
    setCorrecting(true)
    setShowPreview(true)

    try {
      const res = await fetch('/api/voice-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: localCorrected }),
      })
      const data = await res.json()
      setCorrectedText(data.corrected || localCorrected)
    } catch {
      setCorrectedText(localCorrected)
    }
    setCorrecting(false)
  }, [liveText])

  function acceptTranscript() {
    onTranscript(correctedText || liveText)
    setShowPreview(false)
    setLiveText('')
    setCorrectedText('')
    finalTranscriptRef.current = ''
  }

  function discardTranscript() {
    setShowPreview(false)
    setLiveText('')
    setCorrectedText('')
    finalTranscriptRef.current = ''
  }

  if (!supported) return null

  return (
    <div className="relative">
      {/* Mic button */}
      <button
        type="button"
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        onClick={listening ? stopListening : startListening}
        disabled={disabled || correcting}
        title={listening ? 'Release to stop' : 'Hold to speak'}
        className={`flex items-center justify-center w-[42px] h-[42px] rounded-xl border transition-all ${
          listening
            ? 'bg-red-50 border-red-300 text-red-500 animate-pulse'
            : correcting
            ? 'bg-stone-100 border-stone-200 text-stone-300 cursor-wait'
            : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600'
        }`}
      >
        {correcting ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : listening ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Live transcript bubble */}
      {listening && liveText && (
        <div className="absolute bottom-full mb-2 left-0 right-0 w-72 bg-white border border-stone-200 rounded-xl px-3 py-2.5 shadow-lg z-10">
          <p className="text-xs text-stone-400 mb-1">Listening…</p>
          <p className="text-sm text-stone-700 leading-relaxed">{liveText}</p>
        </div>
      )}

      {/* Preview + correction panel */}
      {showPreview && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-stone-100">
            <p className="text-xs font-medium text-stone-500">
              {correcting ? 'Cleaning up…' : 'Does this look right?'}
            </p>
          </div>
          <div className="px-4 py-3">
            {correcting ? (
              <div className="flex gap-1.5 items-center py-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-800 leading-relaxed">{correctedText || liveText}</p>
            )}
          </div>
          {!correcting && (
            <div className="px-4 pb-3 flex gap-2">
              <button
                onClick={discardTranscript}
                className="flex-1 text-xs border border-stone-200 text-stone-500 rounded-lg py-1.5 hover:bg-stone-50"
              >
                Discard
              </button>
              <button
                onClick={acceptTranscript}
                className="flex-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg py-1.5 font-medium"
              >
                Use this
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
