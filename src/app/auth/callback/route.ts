import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
      const { searchParams, origin } = new URL(request.url)
      const code = searchParams.get('code')
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as 'email' | 'recovery' | 'invite' | null
      const next = searchParams.get('next') ?? '/intake'

  let response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
                cookies: {
                            getAll() { return request.cookies.getAll() },
                            setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
                                          cookiesToSet.forEach(({ name, value, options }) =>
                                                          response.cookies.set(name, value, options)
                                                                         )
                            },
                },
      }
        )

  if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) return response
  }

  if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type })
          if (!error) return response
  }

  const errorDetail = code ? 'code_exchange_failed' : token_hash ? 'token_hash_failed' : 'no_code_or_token'
      return NextResponse.redirect(`${origin}/auth?error=${errorDetail}`)
}
