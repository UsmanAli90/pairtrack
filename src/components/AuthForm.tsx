'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const schema = z.object({
  mode: z.enum(['login','signup']),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
  fullName: z.string().optional()
})
type FormValues = z.infer<typeof schema>

// 👇 add prop defaultMode
export default function AuthForm({ defaultMode = 'login' }: { defaultMode?: 'login' | 'signup' }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: defaultMode }   // 👈 use the prop here
  })

  const mode = watch('mode')

  const switchMode = (next: 'login' | 'signup') => {
    setInfo(null)
    setValue('mode', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setInfo(null)
    try {
      if (values.mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.fullName || '' } }
        })
        if (error) throw error
        if (data.session) {
          router.push('/dashboard')
        } else {
          setInfo('Account created. Check your email to confirm, then log in.')
          switchMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password
        })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (e: any) {
      alert(e.message ?? 'Auth failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm border border-gray-100">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 text-center">Welcome to PairTrack</h1>

      {/* Segmented control */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          aria-pressed={mode === 'login'}
          onClick={() => switchMode('login')}
          className={`flex-1 py-2 rounded-xl border transition
            ${mode === 'login' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Login
        </button>
        <button
          type="button"
          aria-pressed={mode === 'signup'}
          onClick={() => switchMode('signup')}
          className={`flex-1 py-2 rounded-xl border transition
            ${mode === 'signup' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Sign up
        </button>
      </div>

      {/* Hidden input so RHF keeps the value */}
      <input type="hidden" {...register('mode')} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm mb-1 text-gray-700">Full name</label>
            <input
              {...register('fullName')}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="e.g., Usman Ali"
            />
          </div>
        )}

        <div>
          <label className="block text-sm mb-1 text-gray-700">Email</label>
          <input
            {...register('email')}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Password</label>
          <input
            type="password"
            {...register('password')}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-2 mt-2 bg-gray-900 text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>

        {info && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2 mt-2">{info}</p>}

        {/* tiny links to alternate page */}
        <p className="text-xs text-gray-500 text-center mt-2">
          {mode === 'signup' ? (
            <>Already have an account? <Link href="/login" className="underline">Log in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="underline">Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  )
}
