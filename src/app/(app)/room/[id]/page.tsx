'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type UUID = string

type Profile = { id: UUID; full_name: string | null; email: string | null }
type GoalStatus = 'not_started'|'in_progress'|'blocked'|'done'
type Goal = {
  id: number; pair_id: number; owner_user_id: UUID;
  title: string; notes: string | null; status: GoalStatus; progress: number
}
type Comment = { id: number; user_id: UUID; body: string; created_at: string }

type PairMemberRPCRow = { user_id: UUID; full_name: string | null; email: string | null }

type GoalUpdateJoinRow = {
  id: number
  goal_id: number
  user_id: UUID
  progress: number | null
  body: string | null
  created_at: string
  goals: { id: number; title: string; pair_id: number } | null
}

type UpdateRow = {
  id: number; goal_id: number; user_id: UUID; progress: number | null;
  body: string | null; created_at: string; goal_title: string
}

const STATUS_OPTIONS: ReadonlyArray<{ value: GoalStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const toMessage = (err: unknown) =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong'

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

      const userRes = await supabase.auth.getUser()
      const user = userRes.data.user
      if (!user) return router.replace('/login')

      // me
      const meRes = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      if (!mounted) return
      if (meRes.error) setErr(toMessage(meRes.error))
      const meRow: Profile | null = meRes.data
        ? { id: meRes.data.id, full_name: meRes.data.full_name, email: meRes.data.email }
        : null
      setMe(meRow)

      // secure pair members
      const pmRes = await supabase.rpc('get_pair_members_secure', { p_pair_id: pairId, uid: user.id })
      if (!mounted) return
      if (pmRes.error) setErr(toMessage(pmRes.error))
      const pmData = (pmRes.data ?? []) as PairMemberRPCRow[]
      const pmList: Profile[] = pmData.map(r => ({ id: r.user_id, full_name: r.full_name, email: r.email }))
      setMembers(pmList)

      // goals
      const gRes = await supabase
        .from('goals')
        .select('id, pair_id, owner_user_id, title, notes, status, progress')
        .eq('pair_id', pairId)
        .order('id', { ascending: true })
      if (gRes.error) setErr(toMessage(gRes.error))
      const gList: Goal[] = (gRes.data ?? []) as Goal[]
      setGoals(gList)

      // comments
      const cRes = await supabase
        .from('comments')
        .select('id, user_id, body, created_at')
        .eq('pair_id', pairId)
        .order('created_at', { ascending: true })
      if (cRes.error) setErr(toMessage(cRes.error))
      const cList: Comment[] = (cRes.data ?? []) as Comment[]
      setComments(cList)

      // goal updates
      await loadUpdates(pairId)

      setLoading(false)
    }

    const loadUpdates = async (pid: number) => {
      const uRes = await supabase
        .from('goal_updates')
        .select('id, goal_id, user_id, progress, body, created_at, goals!inner(id, title, pair_id)')
        .eq('goals.pair_id', pid)
        .order('created_at', { ascending: false })
        .limit(20)
      if (uRes.error) setErr(toMessage(uRes.error))
      const rows = (uRes.data ?? []) as GoalUpdateJoinRow[]
      const mapped: UpdateRow[] = rows.map(r => ({
        id: r.id,
        goal_id: r.goal_id,
        user_id: r.user_id,
        progress: r.progress,
        body: r.body,
        created_at: r.created_at,
        goal_title: r.goals?.title ?? '(goal)'
      }))
      setUpdates(mapped)
    }

    run()
    return () => { mounted = false }
  }, [pairId, router])

  // helpers
  const partner = useMemo(
    () => members.find(m => m.id !== me?.id) || null,
    [members, me]
  )
  const myGoals = useMemo(
    () => goals.filter(g => g.owner_user_id === me?.id),
    [goals, me]
  )
  const partnerGoals = useMemo(
    () => goals.filter(g => g.owner_user_id !== me?.id),
    [goals, me]
  )
  const nameOf = (uid: UUID) => {
    const m = members.find(x => x.id === uid)
    return m?.full_name || m?.email || 'Member'
  }

  useEffect(() => {
    if (myGoals.length && selectedGoalId == null) {
      setSelectedGoalId(myGoals[0].id)
    }
  }, [myGoals, selectedGoalId])

  const reloadGoals = async () => {
    const gRes = await supabase
      .from('goals')
      .select('id, pair_id, owner_user_id, title, notes, status, progress')
      .eq('pair_id', pairId)
      .order('id', { ascending: true })
    if (gRes.error) setErr(toMessage(gRes.error))
    const gList: Goal[] = (gRes.data ?? []) as Goal[]
    setGoals(gList)
  }

  const reloadUpdates = async () => {
    const uRes = await supabase
      .from('goal_updates')
      .select('id, goal_id, user_id, progress, body, created_at, goals!inner(id, title, pair_id)')
      .eq('goals.pair_id', pairId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (uRes.error) setErr(toMessage(uRes.error))
    const rows = (uRes.data ?? []) as GoalUpdateJoinRow[]
    const mapped: UpdateRow[] = rows.map(r => ({
      id: r.id,
      goal_id: r.goal_id,
      user_id: r.user_id,
      progress: r.progress,
      body: r.body,
      created_at: r.created_at,
      goal_title: r.goals?.title ?? '(goal)'
    }))
    setUpdates(mapped)
  }

  // ----- actions -----
  const addGoal = async () => {
    if (!title.trim()) return
    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (!user) { setErr('Not signed in'); return }
    const ins = await supabase.from('goals').insert({
      pair_id: pairId,
      owner_user_id: user.id,
      title: title.trim(),
      notes: notes.trim() || null
    })
    if (ins.error) { setErr(toMessage(ins.error)); return }
    setTitle(''); setNotes('')
    await reloadGoals()
  }

  const updateGoal = async (goalId: number, patch: Partial<Goal>) => {
    const upd = await supabase.from('goals').update(patch).eq('id', goalId)
    if (upd.error) { setErr(toMessage(upd.error)); return }
    await reloadGoals()
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (!user) { setErr('Not signed in'); return }
    const ins = await supabase.from('comments').insert({
      pair_id: pairId,
      user_id: user.id,
      body: commentText.trim()
    })
    if (ins.error) { setErr(toMessage(ins.error)); return }
    setCommentText('')
    const cRes = await supabase
      .from('comments')
      .select('id, user_id, body, created_at')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: true })
    if (cRes.error) { setErr(toMessage(cRes.error)); return }
    const cList: Comment[] = (cRes.data ?? []) as Comment[]
    setComments(cList)
  }

  const submitGoalCheckin = async () => {
    if (!selectedGoalId) { setErr('Pick one of your goals first.'); return }
    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (!user) { setErr('Not signed in'); return }

    const ins1 = await supabase.from('goal_updates').insert({
      goal_id: selectedGoalId,
      user_id: user.id,
      progress: checkProgress,
      body: checkNote || null
    })
    if (ins1.error) { setErr(toMessage(ins1.error)); return }

    const upd = await supabase.from('goals').update({ progress: checkProgress }).eq('id', selectedGoalId)
    if (upd.error) { setErr(toMessage(upd.error)); return }

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
              className="w-full rounded-2xl border px-3 py-2"
            />
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-2xl border px-3 py-2"
            />
            <button onClick={addGoal} className="rounded-xl px-3 py-2 bg-gray-900 text-white">Add Goal</button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">Partner’s Goals</h2>
          <div className="space-y-2">
            {partnerGoals.map(g => (
              <GoalRow key={g.id} goal={g} canEdit={false} onChange={() => Promise.resolve()} />
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
                className="w-full rounded-2xl border px-3 py-2 bg-white"
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
                className="w-full rounded-2xl border px-3 py-2 mt-2"
              />

              <button onClick={submitGoalCheckin} className="mt-2 rounded-xl px-3 py-2 bg-gray-900 text-white">
                Submit Check-in
              </button>
            </>
          )}

          <ul className="mt-4 space-y-2">
            {updates.map(u => (
              <li key={u.id} className="rounded-2xl border px-3 py-2 text-sm">
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
              className="flex-1 rounded-2xl border px-3 py-2"
            />
            <button onClick={addComment} className="rounded-xl px-3 py-2 bg-gray-900 text-white">Send</button>
          </div>
          <ul className="mt-3 space-y-2">
            {comments.map(c => (
              <li key={c.id} className="rounded-2xl border px-3 py-2">
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
            onChange={(e) => canEdit ? onChange(goal.id, { progress: Number(e.target.value) }) : Promise.resolve()}
            className="w-full"
            disabled={!canEdit}
          />
        </div>
        <div className="w-12 text-right text-sm text-gray-700">{goal.progress}%</div>

        <select
          className="rounded-2xl border px-2 py-1 text-sm"
          value={goal.status}
          onChange={(e) => canEdit ? onChange(goal.id, { status: e.target.value as GoalStatus }) : Promise.resolve()}
          disabled={!canEdit}
        >
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: GoalStatus }) {
  const map: Record<GoalStatus, string> = {
    not_started: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-amber-100 text-amber-800',
    done: 'bg-emerald-100 text-emerald-800'
  }
  const label = { not_started: 'Not started', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' }[value]
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-lg ${map[value]}`}>{label}</span>
}
