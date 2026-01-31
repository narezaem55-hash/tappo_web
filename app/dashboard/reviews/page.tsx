'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type TagRow = {
  id: string
  name: string | null
  code: string
  review_url: string | null
  review_provider: string | null
  yandex_org_id: string | null
}

type SnapshotRow = {
  id: string
  tag_id: string
  rating: number | null
  reviews_count: number | null
  created_at: string
}

function detectProvider(url: string) {
  const u = (url || '').toLowerCase()
  if (u.includes('yandex')) return 'Yandex'
  if (u.includes('2gis')) return '2GIS'
  if (u.includes('google')) return 'Google'
  return 'Отзывы'
}

function extractYandexOrgId(url: string): string | null {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/org\/[^/]+\/(\d+)/)
    if (m?.[1]) return m[1]
    const oid = u.searchParams.get('oid')
    if (oid && /^\d+$/.test(oid)) return oid
    return null
  } catch {
    return null
  }
}

function buildYandexReviewLink(orgId: string) {
  // Надёжный вариант: открывать саму карточку организации (там точно не блокируется)
  return `https://yandex.ru/maps/?oid=${orgId}`
}

export default function ReviewsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState<TagRow[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotRow | null>>({})

  const [modalTagId, setModalTagId] = useState<string | null>(null)
  const modalTag = useMemo(() => tags.find(t => t.id === modalTagId) || null, [modalTagId, tags])

  const [ratingInput, setRatingInput] = useState('')
  const [countInput, setCountInput] = useState('')

  const loadAll = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      router.push('/login')
      return
    }

    const { data: tagsData, error: tagsErr } = await supabase
      .from('nfc_tags')
      .select('id,name,code,review_url,review_provider,yandex_org_id')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (tagsErr) {
      alert(tagsErr.message)
      return
    }

    const list = (tagsData || []) as TagRow[]
    setTags(list)

    // подтягиваем последние замеры по каждой метке
    const { data: snaps, error: snapsErr } = await supabase
      .from('review_snapshots')
      .select('id,tag_id,rating,reviews_count,created_at')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (snapsErr) {
      // если таблицу ещё не создал — будет ошибка. тогда просто покажем пусто.
      setSnapshots({})
      return
    }

    const map: Record<string, SnapshotRow | null> = {}
    for (const t of list) map[t.id] = null

    for (const s of (snaps || []) as SnapshotRow[]) {
      if (!map[s.tag_id]) map[s.tag_id] = s
      // мы уже отсортировали DESC, значит первый попавшийся для tag_id — самый свежий
    }
    setSnapshots(map)
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await loadAll()
      setLoading(false)
    })()
    // eslint-disable-next-line
  }, [])

  const saveTag = async (id: string, patch: Partial<TagRow>) => {
    const { error } = await supabase.from('nfc_tags').update(patch).eq('id', id)
    if (error) alert(error.message)
    await loadAll()
  }

  const openSnapshotModal = (tagId: string) => {
    setModalTagId(tagId)
    setRatingInput('')
    setCountInput('')
  }

  const addSnapshot = async () => {
    if (!modalTag) return

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return

    const rating = ratingInput.trim() ? Number(ratingInput.replace(',', '.')) : null
    const reviewsCount = countInput.trim() ? Number(countInput) : null

    if (rating !== null && !Number.isFinite(rating)) {
      alert('Рейтинг должен быть числом, например 4.9')
      return
    }
    if (reviewsCount !== null && (!Number.isFinite(reviewsCount) || reviewsCount < 0)) {
      alert('Количество отзывов должно быть числом')
      return
    }

    const provider = modalTag.review_provider || (modalTag.review_url ? detectProvider(modalTag.review_url) : 'Yandex')

    const { error } = await supabase.from('review_snapshots').insert({
      user_id: userId,
      tag_id: modalTag.id,
      provider,
      rating,
      reviews_count: reviewsCount,
    })

    if (error) {
      alert(error.message)
      return
    }

    setModalTagId(null)
    await loadAll()
  }

  if (loading) return <div className="p-4">Загрузка...</div>

  return (
    <div className="w-full p-4">
      <h1 className="text-2xl font-bold mb-4">Отзывы</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
        }}
      >
        {tags.map((t) => {
          const orgId = t.yandex_org_id || (t.review_url ? extractYandexOrgId(t.review_url) : null)
          const reviewLink = orgId ? buildYandexReviewLink(orgId) : (t.review_url || null)
          const last = snapshots[t.id] || null

          return (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="text-xs text-white/60">
                  {t.review_provider || (t.review_url ? detectProvider(t.review_url) : 'Отзывы')}
                </div>

                <div className="font-semibold text-sm break-words">
                  {t.name || `Метка (${t.code})`}
                </div>

                <div className="text-xs text-white/70">
                  Последний замер:{' '}
                  {last
                    ? `⭐ ${last.rating ?? '—'} • ${last.reviews_count ?? '—'} отзывов • ${new Date(last.created_at).toLocaleDateString()}`
                    : 'нет'}
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={reviewLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg border border-white/20 text-xs"
                    style={{ opacity: reviewLink ? 1 : 0.5, pointerEvents: reviewLink ? 'auto' : 'none' }}
                  >
                    Открыть отзывы
                  </a>

                  <button
                    onClick={() => openSnapshotModal(t.id)}
                    className="px-3 py-1 rounded-lg border border-white/20 text-xs"
                  >
                    Добавить замер
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="text-white/60 text-[11px] mb-1">Ссылка Яндекс</div>
                  <input
                    defaultValue={t.review_url || ''}
                    placeholder="Вставь ссылку на организацию Яндекс.Карт"
                    className="w-full px-2 py-1 rounded-lg bg-black border border-white/10 text-xs"
                    onBlur={(e) => {
                      const url = e.target.value.trim()
                      const provider = url ? detectProvider(url) : null
                      const yid = url ? extractYandexOrgId(url) : null

                      saveTag(t.id, {
                        review_url: url || null,
                        review_provider: provider,
                        yandex_org_id: yid,
                      })
                    }}
                  />
                  <div className="text-white/40 text-[11px] mt-1">org_id: {orgId || '—'}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL: Добавить замер */}
      {modalTag && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setModalTagId(null)}
        >
          <div
            className="bg-black border border-white/10 rounded-2xl overflow-hidden"
            style={{ width: '520px', maxWidth: '95vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-semibold text-sm">
                Новый замер • {modalTag.name || modalTag.code}
              </div>
              <button
                className="px-3 py-1 rounded-lg border border-white/20 text-xs"
                onClick={() => setModalTagId(null)}
              >
                Закрыть
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm text-white/70">
                Открой “Открыть отзывы” в новой вкладке, посмотри текущие цифры и внеси сюда.
              </div>

              <div className="space-y-1">
                <div className="text-xs text-white/60">Рейтинг (например 4.9)</div>
                <input
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  placeholder="4.9"
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-white/60">Количество отзывов</div>
                <input
                  value={countInput}
                  onChange={(e) => setCountInput(e.target.value)}
                  placeholder="607"
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={addSnapshot}
                  className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-sm"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setModalTagId(null)}
                  className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
