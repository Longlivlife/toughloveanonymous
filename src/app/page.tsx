'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.push('/auth'); return }

      const { data: consent } = await supabase
        .from('consent_records').select('id').eq('survivor_id', user.id).limit(1)
      if (!consent || consent.length === 0) { router.push('/consent'); return }

      const { data: survivor } = await supabase
        .from('survivors').select('entry_year').eq('id', user.id).single()
      if (!survivor?.entry_year) { router.push('/intake'); return }

      router.push('/companion')
    }
    redirect()
  }, [router])

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
