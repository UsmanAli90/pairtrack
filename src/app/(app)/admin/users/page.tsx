'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Profile = { id: string; email: string | null; full_name: string | null; role: 'admin'|'member' }

export default function AdminUsers() {
  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateRole = async (id: string, role: 'admin'|'member') => {
    setSavingId(id); setError(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setError(error.message)
    await load()
    setSavingId(null)
  }

  if (loading) return <div className="p-4 text-gray-500">Loading users…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700">{error}</div>}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.full_name || '—'}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded-lg bg-gray-100">{u.role}</span>
                </td>
                <td className="p-3">
                  {u.role === 'admin' ? (
                    <button
                      onClick={() => updateRole(u.id, 'member')}
                      className="rounded-xl px-3 py-1.5 bg-gray-900 text-white text-xs"
                      disabled={savingId === u.id}
                    >Make member</button>
                  ) : (
                    <button
                      onClick={() => updateRole(u.id, 'admin')}
                      className="rounded-xl px-3 py-1.5 bg-gray-900 text-white text-xs"
                      disabled={savingId === u.id}
                    >Make admin</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-gray-500">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
