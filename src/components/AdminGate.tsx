'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (error || !data || data.role !== 'admin') {
        router.replace('/dashboard')
      } else {
        setOk(true)
      }
      setChecking(false)
    }
    check()
  }, [router])

  if (checking) {
    return <div className="p-6 text-gray-500">Checking admin access…</div>
  }
  return ok ? <>{children}</> : null
}
