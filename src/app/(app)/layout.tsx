'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import { supabase } from '@/lib/supabaseClient'

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#f7faf9]">
        <nav className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">PairTrack</div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="rounded-xl px-3 py-1.5 text-sm bg-gray-900 text-white hover:opacity-90 disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
      </div>
    </AuthGuard>
  )
}
