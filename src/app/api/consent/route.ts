import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = makeSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { consent_version, consent_text, consent_public = false, consent_attorney = false, consent_researcher = false, consent_survivor_network = false } = body

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = await hashString(ip)

    const { error: survivorError } = await supabase.from('survivors').upsert({
      id: user.id, email: user.email,
      consent_public, consent_attorney, consent_researcher, consent_survivor_network,
      consent_timestamp: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (survivorError) return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })

    const { error: consentError } = await supabase.from('consent_records').insert({
      survivor_id: user.id, consent_version,
      full_consent_text_snapshot: consent_text, ip_hash: ipHash,
    })
    if (consentError) return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Consent API error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
