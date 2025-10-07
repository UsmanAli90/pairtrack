'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Profile = { id: string; email: string | null; full_name: string | null; role: 'admin' | 'member' }

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error(error)
      } else {
        setProfile(data)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded-2xl border bg-white p-4">
        {profile ? (
          <div className="text-gray-800">
            <p><span className="font-medium">User:</span> {profile.full_name || '(no name)'} — {profile.email}</p>
            <p><span className="font-medium">Role:</span> <span className="inline-block px-2 py-0.5 rounded-lg bg-gray-100">{profile.role}</span></p>
          </div>
        ) : (
          <p className="text-gray-500">Loading profile…</p>
        )}
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p>✅ Auth is working. Next we’ll add pair rooms and admin pages.</p>
      </div>
    </div>
  )
}
