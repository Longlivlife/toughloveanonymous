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

    const { program_name, entry_year, exit_year, age_at_entry, display_name_choice } = await request.json()

    // Look up or create the program record
    let programId: string | null = null
    if (program_name) {
      const { data: existingProgram } = await supabase
        .from('programs')
        .select('id')
        .ilike('name', program_name.trim())
        .limit(1)
        .single()

      if (existingProgram) {
        programId = existingProgram.id
      } else {
        // Create a stub program record — can be enriched later
        const { data: newProgram } = await supabase
          .from('programs')
          .insert({ name: program_name.trim() })
          .select('id')
          .single()
        if (newProgram) programId = newProgram.id
      }
    }

    // Update survivor record
    const updatePayload: Record<string, any> = {}
    if (programId) updatePayload.program_id = programId
    if (entry_year) updatePayload.entry_year = entry_year
    if (exit_year) updatePayload.exit_year = exit_year
    if (age_at_entry) updatePayload.age_at_entry = age_at_entry
    if (display_name_choice) updatePayload.display_name_choice = display_name_choice

    const { error: updateError } = await supabase
      .from('survivors')
      .update(updatePayload)
      .eq('id', user.id)

    if (updateError) {
      console.error('Intake update error:', updateError)
      return NextResponse.json({ error: 'Failed to save intake data' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, program_id: programId })
  } catch (err) {
    console.error('Intake API error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
