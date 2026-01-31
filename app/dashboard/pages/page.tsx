'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type PageRow = {
  id: string
  title: string | null
  slug: string | null
  blocks: any[] | null
  created_at: string
}

function makeSlugSuffix(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function baseSlug(s: string) {
  // убираем хвост "-xxxxxx" если он похож на наш автосуффикс
  return s.replace(/-[a-z0-9]{6}$/i, '')
}

export default function PagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState<PageRow[]>([])

  const load = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('pages1')
      .select('id,title,slug,blocks,created_at')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (error) alert(error.message)

    setPages((data || []) as PageRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    alert('Скопировано')
  }

  const duplicate = async (p: PageRow) => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      router.push('/login')
      return
    }

    const base = baseSlug((p.slug || 'page').toLowerCase())
    const newSlug = `${base}-${makeSlugSuffix(6)}`

    const { data, error } = await supabase
      .from('pages1')
      .insert([
        {
          user_id: user.id,
          title: `${p.title || 'Таплинк'} (копия)`,
          slug: newSlug,
          blocks: p.blocks || [],
        },
      ])
      .select('id')
      .single()

    if (error) {
      alert(error.message)
      return
    }

    alert('Создана копия. Открою редактор.')
    router.push(`/dashboard/editor/${data.id}`)
  }

  const deletePage = async (id: string) => {
    if (!confirm('Удалить таплинк?')) return
    const { error } = await supabase.from('pages1').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Мои таплинки</h1>
        <button
          onClick={() => router.push('/dashboard/create')}
          className="px-4 py-2 rounded-xl bg-white text-black font-medium"
        >
          + Создать таплинк
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="text-white/60">Пока нет taplink страниц</div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {pages.map((p) => {
            const publicUrl = p.slug ? `${window.location.origin}/p/${p.slug}` : ''

            return (
              <div key={p.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.title || 'Без названия'}</div>
                    <div className="text-white/60 text-sm">
                      Публичная: {p.slug ? `/p/${p.slug}` : 'slug не задан'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/editor/${p.id}`)}
                      className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                    >
                      Редактировать
                    </button>

                    {publicUrl ? (
                      <button
                        onClick={() => copy(publicUrl)}
                        className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                      >
                        Скопировать ссылку
                      </button>
                    ) : null}

                    <button
                      onClick={() => duplicate(p)}
                      className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                    >
                      Сделать копию
                    </button>

                    <button
                      onClick={() => deletePage(p.id)}
                      className="px-4 py-2 rounded-xl border border-red-400/40 text-red-300 hover:bg-red-500/10"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
