'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) alert(error.message)
    else alert('Проверяй почту для подтверждения!')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10">
        <h1 className="text-3xl font-bold mb-6">Регистрация</h1>

        <form className="flex flex-col gap-4" onSubmit={handleRegister}>
          <input
            placeholder="Имя"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            placeholder="Email"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button className="mt-4 px-4 py-3 rounded-xl bg-white text-black font-medium">
            Создать аккаунт
          </button>
        </form>
      </div>
    </main>
  )
}
