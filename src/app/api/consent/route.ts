import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const {
      consent_version,
      consent_text,
      consent_public = false,
      consent_attorney = false,
      consent_researcher = false,
      consent_survivor_network = false,
    } = body

    // Hash the IP for audit purposes (we don't store raw IPs)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = await hashString(ip)

    // Upsert the survivor record
    const { error: survivorError } = await supabase
      .from('survivors')
      .upsert({
        id: user.id,
        email: user.email,
        consent_public,
        consent_attorney,
        consent_researcher,
        consent_survivor_network,
        consent_timestamp: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (survivorError) {
      console.error('Survivor upsert error:', survivorError)
      return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })
    }

    // Write immutable consent record
    const { error: consentError } = await supabase
      .from('consent_records')
      .insert({
        survivor_id: user.id,
        consent_version,
        full_consent_text_snapshot: consent_text,
        ip_hash: ipHash,
      })

    if (consentError) {
      console.error('Consent record error:', consentError)
      return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
    }

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
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
