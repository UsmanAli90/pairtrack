'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let isMounted = true

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) return
      if (!session) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    }

    check()

    // react to auth changes (sign-in/sign-out)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })
    return () => { isMounted = false; sub.subscription.unsubscribe() }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Checking session…</div>
      </div>
    )
  }

  return <>{children}</>
}
