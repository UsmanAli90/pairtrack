'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Profile = { id: string; full_name: string | null; email: string | null }
type Goal = { id: number; pair_id: number; owner_user_id: string; title: string; notes: string | null; status: 'not_started'|'in_progress'|'blocked'|'done'; progress: number }
type Comment = { id: number; user_id: string; body: string; created_at: string }
type UpdateRow = { id: number; goal_id: number; user_id: string; progress: number | null; body: string | null; created_at: string; goal_title: string }

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
] as const

export default function RoomPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const pairId = Number(params.id)

  const [me, setMe] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [updates, setUpdates] = useState<UpdateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // new goal state
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  // comment state
  const [commentText, setCommentText] = useState('')

  // goal-based check-in state
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)
  const [checkProgress, setCheckProgress] = useState<number>(50)
  const [checkNote, setCheckNote] = useState('')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setErr(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      // me
      const { data: meRow } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      if (!mounted) return
      setMe(meRow as any)

      // secure fetch of both members (bypasses RLS but checks membership inside RPC)
      const { data: mm } = await supabase
        .rpc('get_pair_members_secure', { p_pair_id: pairId, uid: user.id })
      if (!mounted) return
      setMembers((mm || []).map((r: any) => ({ id: r.user_id, full_name: r.full_name, email: r.email })))

      // goals (for both users, in this pair)
      const { data: gs } = await supabase
        .from('goals')
        .select('id, pair_id, owner_user_id, title, notes, status, progress')
        .eq('pair_id', pairId)
        .order('id', { ascending: true })
      if (!mounted) return
      setGoals((gs || []) as any)

      // comments
      const { data: cs } = await supabase
        .from('comments')
        .select('id, user_id, body, created_at')
        .eq('pair_id', pairId)
        .order('created_at', { ascending: true })
      if (!mounted) return
      setComments((cs || []) as any)

      // goal updates (our "check-ins")
      await loadUpdates(pairId)

      setLoading(false)
    }

    const loadUpdates = async (pid: number) => {
      const { data } = await supabase
        .from('goal_updates')
        .select('id, goal_id, user_id, progress, body, created_at, goals!inner(id, title, pair_id)')
        .eq('goals.pair_id', pid)
        .order('created_at', { ascending: false })
        .limit(20)
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        goal_id: r.goal_id,
        user_id: r.user_id,
        progress: r.progress,
        body: r.body,
        created_at: r.created_at,
        goal_title: r.goals?.title ?? '(goal)'
      })) as UpdateRow[]
      setUpdates(mapped)
    }

    run()
    return () => { mounted = false }
  }, [pairId, router])

  // helpers
  const partner = useMemo(() => members.find(m => m.id !== me?.id) || null, [members, me])
  const myGoals = useMemo(() => goals.filter(g => g.owner_user_id === me?.id), [goals, me])
  const partnerGoals = useMemo(() => goals.filter(g => g.owner_user_id !== me?.id), [goals, me])
  const nameOf = (uid: string) => members.find(m => m.id === uid)?.full_name || members.find(m => m.id === uid)?.email || 'Member'

  useEffect(() => {
    // choose default selected goal (first of my goals)
    if (myGoals.length && selectedGoalId == null) setSelectedGoalId(myGoals[0].id)
  }, [myGoals, selectedGoalId])

  const reloadGoals = async () => {
    const { data: gs } = await supabase
      .from('goals')
      .select('id, pair_id, owner_user_id, title, notes, status, progress')
      .eq('pair_id', pairId)
      .order('id', { ascending: true })
    setGoals((gs || []) as any)
  }

  const reloadUpdates = async () => {
    const { data } = await supabase
      .from('goal_updates')
      .select('id, goal_id, user_id, progress, body, created_at, goals!inner(id, title, pair_id)')
      .eq('goals.pair_id', pairId)
      .order('created_at', { ascending: false })
      .limit(20)
    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      goal_id: r.goal_id,
      user_id: r.user_id,
      progress: r.progress,
      body: r.body,
      created_at: r.created_at,
      goal_title: r.goals?.title ?? '(goal)'
    })) as UpdateRow[]
    setUpdates(mapped)
  }

  // ----- actions -----
  const addGoal = async () => {
    if (!title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('goals').insert({
      pair_id: pairId,
      owner_user_id: user!.id,
      title: title.trim(),
      notes: notes.trim() || null
    })
    if (error) { setErr(error.message); return }
    setTitle(''); setNotes('')
    await reloadGoals()
  }

  const updateGoal = async (goalId: number, patch: Partial<Goal>) => {
    const { error } = await supabase.from('goals').update(patch).eq('id', goalId)
    if (error) { setErr(error.message); return }
    await reloadGoals()
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('comments').insert({
      pair_id: pairId,
      user_id: user!.id,
      body: commentText.trim()
    })
    if (error) { setErr(error.message); return }
    setCommentText('')
    const { data: cs } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: true })
    setComments((cs || []) as any)
  }

  // New: goal-based check-in (writes to goal_updates and syncs the goal's progress)
  const submitGoalCheckin = async () => {
    if (!selectedGoalId) { setErr('Pick one of your goals first.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const gid = selectedGoalId

    // 1) create goal_update
    const { error: e1 } = await supabase.from('goal_updates').insert({
      goal_id: gid,
      user_id: user!.id,
      progress: checkProgress,
      body: checkNote || null
    })
    if (e1) { setErr(e1.message); return }

    // 2) also update the goal progress itself
    const { error: e2 } = await supabase.from('goals').update({ progress: checkProgress }).eq('id', gid)
    if (e2) { setErr(e2.message); return }

    setCheckNote('')
    await reloadGoals()
    await reloadUpdates()
  }

  if (loading) return <div className="p-4 text-gray-500">Loading…</div>

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700">{err}</div>}

      <div className="rounded-2xl border bg-white p-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Your Room</h1>
          <p className="text-gray-600">Partner: <span className="font-medium">{partner?.full_name || partner?.email || '—'}</span></p>
        </div>
      </div>

      {/* Goals */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">My Goals</h2>
          <div className="space-y-2">
            {myGoals.map(g => (
              <GoalRow key={g.id} goal={g} canEdit onChange={updateGoal} />
            ))}
            {myGoals.length === 0 && <p className="text-gray-500">No goals yet.</p>}
          </div>

          <div className="mt-4 border-t pt-4 space-y-2">
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="New goal title"
              className="w-full rounded-xl border px-3 py-2"
            />
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-xl border px-3 py-2"
            />
            <button onClick={addGoal} className="rounded-xl px-3 py-2 bg-gray-900 text-white">Add Goal</button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">Partner’s Goals</h2>
          <div className="space-y-2">
            {partnerGoals.map(g => (
              <GoalRow key={g.id} goal={g} canEdit={false} onChange={() => {}} />
            ))}
            {partnerGoals.length === 0 && <p className="text-gray-500">Partner has no goals yet.</p>}
          </div>
        </div>
      </div>

      {/* Goal-based Check-ins + Comments */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">Check-ins (by goal)</h2>

          {myGoals.length === 0 ? (
            <p className="text-gray-500">Add a goal first to check in.</p>
          ) : (
            <>
              <label className="block text-sm text-gray-600 mb-1">Select one of your goals</label>
              <select
                value={selectedGoalId ?? ''}
                onChange={e => setSelectedGoalId(Number(e.target.value))}
                className="w-full rounded-xl border px-3 py-2 bg-white"
              >
                {myGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>

              <label className="block text-sm text-gray-600 mt-3">Progress</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} value={checkProgress}
                       onChange={e => setCheckProgress(Number(e.target.value))}
                       className="flex-1" />
                <span className="w-12 text-right text-sm text-gray-700">{checkProgress}%</span>
              </div>

              <input
                value={checkNote} onChange={e => setCheckNote(e.target.value)}
                placeholder="Quick note (optional)"
                className="w-full rounded-xl border px-3 py-2 mt-2"
              />

              <button onClick={submitGoalCheckin} className="mt-2 rounded-xl px-3 py-2 bg-gray-900 text-white">
                Submit Check-in
              </button>
            </>
          )}

          <ul className="mt-4 space-y-2">
            {updates.map(u => (
              <li key={u.id} className="rounded-xl border px-3 py-2 text-sm">
                <div className="text-gray-600">
                  {nameOf(u.user_id)} • {u.goal_title} • {typeof u.progress === 'number' ? `${u.progress}%` : '—'} • {new Date(u.created_at).toLocaleString()}
                </div>
                <div className="text-gray-800">{u.body || '—'}</div>
              </li>
            ))}
            {updates.length === 0 && <p className="text-gray-500">No check-ins yet.</p>}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">Comments</h2>
          <div className="flex gap-2">
            <input
              value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Write an update or question…"
              className="flex-1 rounded-xl border px-3 py-2"
            />
            <button onClick={addComment} className="rounded-xl px-3 py-2 bg-gray-900 text-white">Send</button>
          </div>
          <ul className="mt-3 space-y-2">
            {comments.map(c => (
              <li key={c.id} className="rounded-xl border px-3 py-2">
                <div className="text-xs text-gray-500">{nameOf(c.user_id)} • {new Date(c.created_at).toLocaleString()}</div>
                <div className="text-gray-800">{c.body}</div>
              </li>
            ))}
            {comments.length === 0 && <p className="text-gray-500">No comments yet.</p>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function GoalRow({ goal, canEdit, onChange }: {
  goal: Goal, canEdit: boolean, onChange: (id: number, patch: Partial<Goal>) => Promise<void>
}) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{goal.title}</div>
        <StatusBadge value={goal.status} />
      </div>
      {goal.notes && <div className="text-sm text-gray-600 mt-1">{goal.notes}</div>}

      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1">
          <input
            type="range" min={0} max={100}
            value={goal.progress}
            onChange={(e) => canEdit && onChange(goal.id, { progress: Number(e.target.value) })}
            className="w-full"
            disabled={!canEdit}
          />
        </div>
        <div className="w-12 text-right text-sm text-gray-700">{goal.progress}%</div>

        <select
          className="rounded-xl border px-2 py-1 text-sm"
          value={goal.status}
          onChange={(e) => canEdit && onChange(goal.id, { status: e.target.value as Goal['status'] })}
          disabled={!canEdit}
        >
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: Goal['status'] }) {
  const map: Record<Goal['status'], string> = {
    not_started: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-amber-100 text-amber-800',
    done: 'bg-emerald-100 text-emerald-800'
  }
  const label = { not_started: 'Not started', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' }[value]
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-lg ${map[value]}`}>{label}</span>
}
