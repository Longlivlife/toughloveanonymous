import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
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

    // Delete in order: junctions first, then core records
    // testimony_people, testimony_harms
    const { data: testimonies } = await supabase
      .from('testimonies').select('id').eq('survivor_id', user.id)
    const testimonyIds = (testimonies || []).map(t => t.id)

    if (testimonyIds.length > 0) {
      await supabase.from('testimony_people').delete().in('testimony_id', testimonyIds)
      await supabase.from('testimony_harms').delete().in('testimony_id', testimonyIds)
      await supabase.from('evidence_files').delete().eq('uploader_survivor_id', user.id)
      await supabase.from('testimonies').delete().eq('survivor_id', user.id)
    }

    await supabase.from('consent_records').delete().eq('survivor_id', user.id)
    await supabase.from('survivors').delete().eq('id', user.id)

    // Delete the auth user — requires service role, so we do a soft delete
    // The auth user will remain but all data is purged
    // Full auth deletion requires service role key (Phase 2 admin panel)
    await supabase.auth.signOut()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Account delete error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
