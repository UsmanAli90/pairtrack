'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type WeeklyCycle = {
  id: number
  week_start_date: string
  week_end_date: string
  status: 'planned'|'active'|'archived'
}
type Profile = { id: string; full_name: string | null; email: string | null; role: 'admin'|'member' }
type Pair = { id: number }

function formatRange(wc: WeeklyCycle | null) {
  if (!wc) return '—'
  const a = new Date(wc.week_start_date).toLocaleDateString()
  const b = new Date(wc.week_end_date).toLocaleDateString()
  return `${a} → ${b} (${wc.status})`
}

export default function AdminPairs() {
  const [week, setWeek] = useState<WeeklyCycle | null>(null)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [pairMembers, setPairMembers] = useState<Record<number, Profile[]>>({})

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [selA, setSelA] = useState<string>('')  // manual pairing
  const [selB, setSelB] = useState<string>('')

  const load = async () => {
    setLoading(true); setErr(null); setMsg(null)
    // active week
    const { data: w, error: we } = await supabase
      .from('weekly_cycles').select('*').eq('status','active').maybeSingle()
    if (we) setErr(we.message)
    setWeek(w as any)

    // current pairs
    if (w) {
      const { data: ps, error: pe } = await supabase
        .from('pairs').select('id').eq('weekly_cycle_id', (w as any).id).order('id')
      if (pe) setErr(pe.message)
      setPairs(ps || [])
    } else {
      setPairs([])
    }

    // all members (non-admin)
    const { data: ms, error: me } = await supabase
      .from('profiles').select('id, full_name, email, role').eq('role','member').order('created_at')
    if (me) setErr(me.message)
    setMembers(ms || [])

    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // fetch pair members for display
  useEffect(() => {
    const run = async () => {
      if (!pairs.length) { setPairMembers({}); return }
      const result: Record<number, Profile[]> = {}
      for (const p of pairs) {
        const { data: rows, error } = await supabase
          .from('pair_members').select('user_id').eq('pair_id', p.id)
        if (error) { setErr(error.message); continue }
        const ids = (rows||[]).map(r => r.user_id)
        if (ids.length) {
          const { data: profs, error: pe } = await supabase
            .from('profiles').select('id, full_name, email, role').in('id', ids)
          if (pe) { setErr(pe.message); continue }
          result[p.id] = profs || []
        } else result[p.id] = []
      }
      setPairMembers(result)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.length])

  // who is still unpaired?
  const unpaired = useMemo(() => {
    const pairedIds = new Set<string>()
    Object.values(pairMembers).forEach(list => list.forEach(p => pairedIds.add(p.id)))
    return members.filter(m => !pairedIds.has(m.id))
  }, [pairMembers, members])

  const unpairedCount = unpaired.length

  // ---------- actions ----------
  const autoPair = async () => {
    if (!week) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      // Clear existing pairs for this week
      const { error: delErr } = await supabase.from('pairs').delete().eq('weekly_cycle_id', week.id)
      if (delErr) throw delErr

      const pool = [...members.map(m => m.id)]
      // shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      // create
      for (let i = 0; i + 1 < pool.length; i += 2) {
        const { data: pair, error: pe } = await supabase
          .from('pairs').insert({ weekly_cycle_id: week.id }).select('id').single()
        if (pe) throw pe
        const a = pool[i], b = pool[i+1]
        const { error: pm1 } = await supabase.from('pair_members').insert({ pair_id: (pair as any).id, user_id: a })
        if (pm1) throw pm1
        const { error: pm2 } = await supabase.from('pair_members').insert({ pair_id: (pair as any).id, user_id: b })
        if (pm2) throw pm2
      }
      setMsg('Auto-pairing complete.')
      await load()
    } catch (e: any) { setErr(e.message ?? 'Auto-pairing failed') }
    finally { setBusy(false) }
  }

  const manualPair = async () => {
    if (!week) return
    if (!selA || !selB || selA === selB) {
      setErr('Pick two different unpaired members.'); return
    }
    setBusy(true); setErr(null); setMsg(null)
    try {
      const { data: pair, error } = await supabase
        .from('pairs').insert({ weekly_cycle_id: week.id }).select('id').single()
      if (error) throw error
      const id = (pair as any).id as number
      const { error: e1 } = await supabase.from('pair_members').insert({ pair_id: id, user_id: selA })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('pair_members').insert({ pair_id: id, user_id: selB })
      if (e2) throw e2
      setSelA(''); setSelB('')
      setMsg('Manual pair created.')
      await load()
    } catch (e: any) { setErr(e.message ?? 'Manual pair failed') }
    finally { setBusy(false) }
  }

  const removePair = async (pairId: number) => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const { error } = await supabase.from('pairs').delete().eq('id', pairId)
      if (error) throw error
      setMsg(`Removed pair #${pairId}.`)
      await load()
    } catch (e: any) { setErr(e.message ?? 'Failed to remove pair') }
    finally { setBusy(false) }
  }

  // Reset THIS week to current Mon..Sun and clear pairs
  const resetWeekToCurrent = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      // compute current Mon..Sun
      const now = new Date()
      const day = now.getDay() // 0 Sun..6 Sat
      const daysSinceMon = (day + 6) % 7
      const mon = new Date(now); mon.setDate(now.getDate() - daysSinceMon)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const toISO = (d: Date) => d.toISOString().slice(0,10)

      if (week) {
        // update current active week to current Mon..Sun
        const { error: upErr } = await supabase
          .from('weekly_cycles')
          .update({ week_start_date: toISO(mon), week_end_date: toISO(sun), status: 'active' })
          .eq('id', week.id)
        if (upErr) throw upErr

        // clear existing pairs for this week
        const { error: delErr } = await supabase.from('pairs').delete().eq('weekly_cycle_id', week.id)
        if (delErr) throw delErr
      } else {
        // if no active week, create one
        const { data: newWeek, error: insErr } = await supabase
          .from('weekly_cycles')
          .insert({ week_start_date: toISO(mon), week_end_date: toISO(sun), status: 'active' })
          .select('*').single()
        if (insErr) throw insErr
        setWeek(newWeek as any)
      }

      setPairs([]); setPairMembers({})
      setMsg('Week reset to current Mon–Sun. Now you can pair members.')
    } catch (e: any) { setErr(e.message ?? 'Week reset failed') }
    finally { setBusy(false) }
  }

  const startNewWeek = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (week) {
        const { error: upErr } = await supabase.from('weekly_cycles')
          .update({ status: 'archived' }).eq('id', week.id)
        if (upErr) throw upErr
      }
      // next Mon..Sun
      const now = new Date()
      const day = now.getDay()
      const daysSinceMon = (day + 6) % 7
      const nextMon = new Date(now); nextMon.setDate(now.getDate() - daysSinceMon + 7)
      const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate() + 6)
      const toISO = (d: Date) => d.toISOString().slice(0,10)

      const { data: newWeek, error: insErr } = await supabase
        .from('weekly_cycles')
        .insert({ week_start_date: toISO(nextMon), week_end_date: toISO(nextSun), status: 'active' })
        .select('*').single()
      if (insErr) throw insErr

      setWeek(newWeek as any)
      setPairs([]); setPairMembers({})
      setMsg('Started new week. Now click Auto-Pair or use Manual Pair.')
    } catch (e: any) { setErr(e.message ?? 'Failed to start new week') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="p-4 text-gray-500">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pairs & Weekly Cycle</h1>

      {(msg || err) && (
        <div className={`rounded-xl p-3 border ${err ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {err || msg}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="text-gray-700">
          <span className="font-medium">Active week:</span> {formatRange(week)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={autoPair} disabled={!week || busy}
                  className="rounded-xl px-3 py-2 bg-gray-900 text-white disabled:opacity-50">
            {busy ? 'Working…' : 'Auto-Pair Members'}
          </button>
          <button onClick={startNewWeek} disabled={busy}
                  className="rounded-xl px-3 py-2 bg-white border">
            {busy ? 'Working…' : 'Start New Week (archive current)'}
          </button>
          <button onClick={resetWeekToCurrent} disabled={busy}
                  className="rounded-xl px-3 py-2 bg-white border">
            {busy ? 'Working…' : 'Reset to Current Week (clear pairs)'}
          </button>
        </div>
        {unpairedCount > 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2">
            Heads up: {unpairedCount} member(s) not paired this week.
          </p>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-medium">Manual Pair</h2>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Member A (unpaired)</label>
            <select value={selA} onChange={e => setSelA(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 bg-white">
              <option value="">— pick —</option>
              {unpaired.map(m => <option value={m.id} key={m.id}>{m.full_name || m.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Member B (unpaired)</label>
            <select value={selB} onChange={e => setSelB(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 bg-white">
              <option value="">— pick —</option>
              {unpaired.map(m => <option value={m.id} key={m.id}>{m.full_name || m.email}</option>)}
            </select>
          </div>
          <div className="md:pt-6">
            <button onClick={manualPair} disabled={!week || busy || !selA || !selB || selA===selB}
                    className="rounded-xl px-3 py-2 bg-gray-900 text-white disabled:opacity-50 w-full">
              Create Pair
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">Only unpaired members show here. Remove a pair below to free them up.</p>
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-2">Current Pairs</h2>
        {pairs.length === 0 && <p className="text-gray-500">No pairs yet for this week.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {pairs.map(p => (
            <div key={p.id} className="rounded-xl border p-3 bg-white flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">Pair #{p.id}</div>
                <ul className="mt-1">
                  {(pairMembers[p.id] || []).map(m => (
                    <li key={m.id} className="text-gray-800">{m.full_name || m.email}</li>
                  ))}
                  {(pairMembers[p.id] || []).length === 0 && (
                    <li className="text-gray-500">No members yet</li>
                  )}
                </ul>
              </div>
              <button onClick={() => removePair(p.id)}
                      className="rounded-lg px-2.5 py-1.5 text-sm border hover:bg-gray-50">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
