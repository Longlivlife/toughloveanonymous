'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

    useEffect(() => {
        const supabase = createClient()

            supabase.auth.getSession().then(({ data: { session } }) => {
                  if (session) {
                          router.replace('/intake')
                                } else {
                                        const { data: { subscription } } = supabase.auth.onAuthStateChange(
                                                  (event, session) => {
                                                              if (event === 'SIGNED_IN' && session) {
                                                                            subscription.unsubscribe()
                                                                                          router.replace('/intake')
                                                                                                      }
                                                                                                                }
                                                                                                                        )
                                                                                                                        
                                                                                                                                setTimeout(() => {
                                                                                                                                          supabase.auth.getSession().then(({ data: { session } }) => {
                                                                                                                                                      if (session) {
                                                                                                                                                                    router.replace('/intake')
                                                                                                                                                                                } else {
                                                                                                                                                                                              router.replace('/auth?error=session_not_established')
                                                                                                                                                                                                          }
                                                                                                                                                                                                                    })
                                                                                                                                                                                                                            }, 3000)
                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                      })
                                                                                                                                                                                                                                        }, [router])
                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                          return (
                                                                                                                                                                                                                                              <div className="min-h-screen bg-stone-50 flex items-center justify-center">
                                                                                                                                                                                                                                                    <p className="text-sm text-stone-400">Signing you in...</p>
                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                          )
                                                                                                                                                                                                                                                          }
