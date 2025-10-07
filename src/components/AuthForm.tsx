'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const schema = z.object({
  mode: z.enum(['login','signup']),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
  fullName: z.string().optional()
})

type FormValues = z.infer<typeof schema>

export default function AuthForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'login' as const }
  })

  const mode = watch('mode')

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      if (values.mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.fullName || '' }
          }
        })
        if (error) throw error
        // If email confirmations are enabled in Supabase, user may need to confirm.
        // Otherwise session is ready.
        router.push('/dashboard')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
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

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => (document.querySelector<HTMLInputElement>('#mode-login')!.checked = true)}
          className={`flex-1 py-2 rounded-xl border ${mode === 'login' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
          onMouseDown={() => {}}
        >Login</button>
        <button
          type="button"
          onClick={() => (document.querySelector<HTMLInputElement>('#mode-signup')!.checked = true)}
          className={`flex-1 py-2 rounded-xl border ${mode === 'signup' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
          onMouseDown={() => {}}
        >Sign up</button>
      </div>

      {/* hidden radios to drive zod mode value */}
      <input id="mode-login" type="radio" value="login" {...register('mode')} className="hidden" defaultChecked />
      <input id="mode-signup" type="radio" value="signup" {...register('mode')} className="hidden" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm mb-1 text-gray-700">Full name</label>
            <input {...register('fullName')}
                   className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"/>
          </div>
        )}

        <div>
          <label className="block text-sm mb-1 text-gray-700">Email</label>
          <input {...register('email')}
                 className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"/>
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Password</label>
          <input type="password" {...register('password')}
                 className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"/>
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
        </div>

        <button disabled={submitting}
                className="w-full rounded-xl py-2 mt-2 bg-gray-900 text-white hover:opacity-90 disabled:opacity-60">
          {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          By continuing you agree to our terms.
        </p>
      </form>
    </div>
  )
}
