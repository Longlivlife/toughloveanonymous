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
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { action, testimony_id } = await request.json()

    if (!testimony_id) {
      return NextResponse.json({ error: 'testimony_id required' }, { status: 400 })
    }

    // Verify ownership
    const { data: testimony } = await supabase
      .from('testimonies')
      .select('id, survivor_id, survivor_approved')
      .eq('id', testimony_id)
      .eq('survivor_id', user.id)
      .single()

    if (!testimony) {
      return NextResponse.json({ error: 'Testimony not found' }, { status: 404 })
    }

    if (action === 'submit') {
      if (testimony.survivor_approved) {
        return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
      }
      const { error } = await supabase
        .from('testimonies')
        .update({
          survivor_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', testimony_id)

      if (error) {
        return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, status: 'submitted' })
    }

    if (action === 'reopen') {
      // Allow survivor to reopen a submitted testimony to add a new chapter
      // We create a NEW open testimony record rather than modifying the submitted one
      const { data, error } = await supabase
        .from('testimonies')
        .insert({
          survivor_id: user.id,
          raw_transcript: '',
          survivor_approved: false,
          visibility_tier: 'private',
          corroboration_flag: false,
        })
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: 'Failed to open new chapter' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, status: 'new_chapter', testimony_id: data.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Testimony API error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
