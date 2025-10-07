'use client'
import AdminGate from '@/components/AdminGate'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>
}
