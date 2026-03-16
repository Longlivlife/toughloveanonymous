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

    const { transcript, testimony_id } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    // If an existing testimony_id is passed, append to it
    if (testimony_id) {
      const { data: existing } = await supabase
        .from('testimonies')
        .select('raw_transcript')
        .eq('id', testimony_id)
        .eq('survivor_id', user.id)
        .single()

      if (existing) {
        const appended = (existing.raw_transcript || '') + '\n\n---\n\n' + transcript
        const { error } = await supabase
          .from('testimonies')
          .update({ raw_transcript: appended })
          .eq('id', testimony_id)

        if (error) {
          return NextResponse.json({ error: 'Failed to update testimony' }, { status: 500 })
        }
        return NextResponse.json({ ok: true, testimony_id })
      }
    }

    // Otherwise create a new testimony record
    const { data, error } = await supabase
      .from('testimonies')
      .insert({
        survivor_id: user.id,
        raw_transcript: transcript,
        survivor_approved: false,
        visibility_tier: 'private',
        corroboration_flag: false,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Testimony insert error:', error)
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, testimony_id: data.id })
  } catch (err) {
    console.error('Session API error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
