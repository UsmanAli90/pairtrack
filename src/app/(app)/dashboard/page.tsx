'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Profile = { id: string; email: string | null; full_name: string | null; role: 'admin' | 'member' }
type Week = { id: number; week_start_date: string; week_end_date: string }

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeWeek, setActiveWeek] = useState<Week | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkedPair, setCheckedPair] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.replace('/login')

        // Kick off all three in parallel
        const [meRes, weekRes, pairRes] = await Promise.all([
          supabase.from('profiles').select('id, email, full_name, role').eq('id', user.id).maybeSingle(),
          supabase.from('weekly_cycles').select('id, week_start_date, week_end_date').eq('status','active').maybeSingle(),
          supabase.rpc('get_active_pair_for_user', { uid: user.id })
        ])
        if (!mounted) return

        if (meRes.error) throw meRes.error
        if (weekRes.error) throw weekRes.error

        setProfile(meRes.data as any)
        setActiveWeek(weekRes.data as any)

        if (pairRes.data && pairRes.data.length > 0) {
          router.replace(`/room/${pairRes.data[0].pair_id}`)
          return
        }
        setCheckedPair(true) // explicitly mark that we checked and found nothing
      } catch (e: any) {
        if (mounted) setError(e.message ?? 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [router])

  const formatRange = (w: Week | null) => {
    if (!w) return '—'
    const a = new Date(w.week_start_date).toLocaleDateString()
    const b = new Date(w.week_end_date).toLocaleDateString()
    return `${a} → ${b}`
  }

  if (loading) return <div className="p-4 text-gray-500">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700">{error}</div>}

      <div className="rounded-2xl border bg-white p-4">
        {profile ? (
          <div className="text-gray-800">
            <p><span className="font-medium">User:</span> {profile.full_name || '(no name)'} — {profile.email}</p>
            <p><span className="font-medium">Role:</span> <span className="inline-block px-2 py-0.5 rounded-lg bg-gray-100">{profile.role}</span></p>
          </div>
        ) : <p className="text-gray-500">No profile</p>}
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <p className="text-gray-700"><span className="font-medium">Active week:</span> {formatRange(activeWeek)}</p>
        {!checkedPair
          ? <p className="text-gray-500 mt-2">Checking your pairing…</p>
          : <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2 mt-2">
              You’re not paired yet for this week. Check back after the admin pairs the group.
            </p>}
      </div>
    </div>
  )
}
