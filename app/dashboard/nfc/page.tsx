// app/dashboard/nfc/page.tsx
// ✅ ЗАМЕНИ ЦЕЛИКОМ (снятие защиты БЕЗ пина, порядок меток, массовое создание, без "копировать таплинк")

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type PageRow = { id: string; title: string | null; slug: string | null }

type TagRow = {
  id: string
  code: string
  name: string | null
  page_id: string | null
  is_locked: boolean
  delete_pin: string | null
  created_at: string
}

function makeCode(len = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function makePin6() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' })
}

export default function NFCPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [pages, setPages] = useState<PageRow[]>([])
  const [tags, setTags] = useState<TagRow[]>([])

  const [bulkCount, setBulkCount] = useState<5 | 10 | 50>(5)
  const [bulkPrefix, setBulkPrefix] = useState('Метка')

  // чтобы не слетала клавиатура при наборе имени
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({})

  const pagesMap = useMemo(() => {
    const m: Record<string, PageRow> = {}
    for (const p of pages) m[p.id] = p
    return m
  }, [pages])

  const loadAll = async () => {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      router.push('/login')
      return
    }

    const pagesRes = await supabase
      .from('pages1')
      .select('id,title,slug')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (pagesRes.error) {
      setErrorMsg(pagesRes.error.message)
      setLoading(false)
      return
    }

    const tagsRes = await supabase
      .from('nfc_tags')
      .select('id,code,name,page_id,is_locked,delete_pin,created_at')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (tagsRes.error) {
      setErrorMsg(tagsRes.error.message)
      setLoading(false)
      return
    }

    const t = (tagsRes.data || []) as TagRow[]

    // ✅ сортировка: новые группы сверху, внутри — по имени натурально
    t.sort((x, y) => {
      if (x.created_at !== y.created_at) return y.created_at.localeCompare(x.created_at)
      const ax = (x.name || x.code).trim()
      const ay = (y.name || y.code).trim()
      return naturalCompare(ax, ay)
    })

    setPages((pagesRes.data || []) as PageRow[])
    setTags(t)

    setNameDraft((prev) => {
      const next = { ...prev }
      for (const row of t) {
        if (next[row.id] === undefined) next[row.id] = row.name || ''
      }
      for (const k of Object.keys(next)) {
        if (!t.find((x) => x.id === k)) delete next[k]
      }
      return next
    })

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    alert('Скопировано')
  }

  const bindPage = async (tagId: string, pageId: string | null) => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return

    if (tag.is_locked) {
      alert('Метка защищена. Сними защиту, чтобы менять привязку.')
      return
    }

    const { error } = await supabase.from('nfc_tags').update({ page_id: pageId }).eq('id', tagId)
    if (error) alert(error.message)
    await loadAll()
  }

  const lockTag = async (tagId: string) => {
    const { error } = await supabase.from('nfc_tags').update({ is_locked: true }).eq('id', tagId)
    if (error) alert(error.message)
    await loadAll()
  }

  // ✅ Снять защиту БЕЗ пина (как ты просил)
  const unlockTag = async (tagId: string) => {
    const { error } = await supabase.from('nfc_tags').update({ is_locked: false }).eq('id', tagId)
    if (error) alert(error.message)
    await loadAll()
  }

  const saveName = async (tagId: string) => {
    const value = (nameDraft[tagId] || '').trim()
    const { error } = await supabase.from('nfc_tags').update({ name: value }).eq('id', tagId)
    if (error) {
      alert(error.message)
      return
    }
    await loadAll()
  }

  const deleteTag = async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return

    const pin = tag.delete_pin || ''
    const answer = prompt(`Удаление метки.\nВведи PIN (6 цифр):`)
    if (!answer || answer.trim() !== pin) {
      alert('Неверный PIN. Удаление отменено.')
      return
    }

    const { error } = await supabase.from('nfc_tags').delete().eq('id', tagId)
    if (error) alert(error.message)
    await loadAll()
  }

  const bulkCreate = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      router.push('/login')
      return
    }

    const rows: any[] = []
    for (let i = 1; i <= bulkCount; i++) {
      rows.push({
        user_id: user.id,
        code: makeCode(8),
        name: `${bulkPrefix} ${i}`,
        page_id: null,
        is_locked: false,
        delete_pin: makePin6(),
      })
    }

    const { error } = await supabase.from('nfc_tags').insert(rows)
    if (error) {
      alert(error.message)
      return
    }

    alert(`Создано меток: ${bulkCount}`)
    await loadAll()
  }

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Мои метки</h1>

      {errorMsg ? (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10">{errorMsg}</div>
      ) : null}

      <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
        <div className="text-lg font-semibold">Массовое создание</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-white/60 text-sm mb-1">Количество</div>
            <select
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value) as any)}
              className="w-full px-4 py-2 rounded-xl bg-black border border-white/10"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-white/60 text-sm mb-1">Префикс названия</div>
            <input
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="Метка"
              className="w-full px-4 py-2 rounded-xl bg-black border border-white/10"
            />
          </div>
        </div>

        <button onClick={bulkCreate} className="px-5 py-2 rounded-xl bg-white text-black font-medium">
          Создать {bulkCount} меток
        </button>
      </div>

      <div className="space-y-3">
        {tags.length === 0 ? (
          <div className="text-white/60">Метки не найдены</div>
        ) : (
          tags.map((t) => {
            const nfcLink = `${window.location.origin}/n/${t.code}`
            const page = t.page_id ? pagesMap[t.page_id] : null

            return (
              <div key={t.id} className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{t.name || `Без названия (${t.code})`}</div>
                    <div className="text-white/60 text-sm">Код: {t.code}</div>
                    <div className="text-white/60 text-sm">Защита привязки: {t.is_locked ? 'ВКЛ' : 'ВЫКЛ'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copy(nfcLink)}
                      className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                    >
                      Скопировать ссылку NFC
                    </button>

                    {!t.is_locked ? (
                      <button
                        onClick={() => lockTag(t.id)}
                        className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                      >
                        Закрыть привязку
                      </button>
                    ) : (
                      <button
                        onClick={() => unlockTag(t.id)}
                        className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                      >
                        Снять защиту
                      </button>
                    )}

                    <button
                      onClick={() => deleteTag(t.id)}
                      className="px-4 py-2 rounded-xl border border-red-400/40 text-red-300 hover:bg-red-500/10"
                    >
                      Удалить (PIN)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-white/60 text-sm mb-1">Название метки</div>
                    <input
                      value={nameDraft[t.id] ?? ''}
                      onChange={(e) => setNameDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl bg-black border border-white/10"
                    />
                    <button
                      onClick={() => saveName(t.id)}
                      className="mt-2 px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
                    >
                      Сохранить название
                    </button>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-white/60 text-sm mb-1">Привязка к таплинку</div>
                    <select
                      value={t.page_id || ''}
                      onChange={(e) => bindPage(t.id, e.target.value || null)}
                      disabled={t.is_locked}
                      className={`w-full px-4 py-2 rounded-xl bg-black border border-white/10 ${
                        t.is_locked ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Не привязано</option>
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || 'Без названия'} {p.slug ? `(/p/${p.slug})` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="text-white/50 text-xs mt-2">
                      Привязано к: {page?.title || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
