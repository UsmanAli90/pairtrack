import AuthForm from '@/components/AuthForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col gap-6 items-center justify-center bg-gradient-to-br from-[#f5f7fb] to-[#eef7f3] p-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">PairTrack</h2>
        <p className="text-gray-600 mt-1">Weekly accountability. Calm, focused, effective.</p>
      </div>
      <AuthForm />
    </main>
  )
}
