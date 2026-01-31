'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function CreateTaplinkPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')


  const createPage = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) return

    const { data, error } = await supabase
      .from('pages1')
      .insert([
        {
          user_id: user.id,
          title,
          slug,
          blocks: []
        }
      ])
      .select()
      .single()

    if (error) alert(error.message)
    else router.push(`/dashboard/editor/${data.id}`)
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Создание Taplink</h1>

      <input
        placeholder="Название страницы"
        className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none mb-6"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
  placeholder="Короткая ссылка (например: alex)"
  className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none mb-6"
  value={slug}
  onChange={e => setSlug(e.target.value)}
/>


      <button
        onClick={createPage}
        className="px-6 py-3 rounded-xl bg-white text-black font-medium"
      >
        Создать
      </button>
    </main>
  )
}
