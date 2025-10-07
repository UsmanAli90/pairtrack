import Link from 'next/link'

export default function AdminHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="rounded-2xl border bg-white p-4 space-y-2">
        <p className="text-gray-700">Manage the group and weekly pairings.</p>
        <ul className="list-disc ml-5 text-gray-800">
          <li><Link className="underline" href="/admin/users">Users</Link></li>
          <li><Link className="underline" href="/admin/pairs">Pairs & Weekly Cycle</Link></li>
        </ul>
      </div>
    </div>
  )
}
