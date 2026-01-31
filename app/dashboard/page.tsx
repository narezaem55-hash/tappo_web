'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function isoStartOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function isoDaysAgo(n: number) {
  const x = new Date()
  x.setDate(x.getDate() - n)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

type TagRow = { id: string; code: string; name: string | null }
type EventRow = {
  event_type: string
  session_id: string | null
  nfc_tag_id: string | null
  created_at: string
  block_id?: string | null
  block_text?: string | null
}

export default function DashboardHome() {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // фильтр дат
  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'custom'>('30d')
  const [from, setFrom] = useState<string>(() => isoDaysAgo(30))
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10)) // yyyy-mm-dd

  // фильтр по метке
  const [selectedTagId, setSelectedTagId] = useState<string>('all')

  const [tags, setTags] = useState<TagRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])

  // агрегаты
  const [uniqueTouches, setUniqueTouches] = useState(0)
  const [uniqueReviewClicks, setUniqueReviewClicks] = useState(0)
  const [conversion, setConversion] = useState('0%')

  // таблица по меткам
  const [tagStats, setTagStats] = useState<
    { tagId: string; name: string; touches: number; reviews: number; conv: string }[]
  >([])

  // топ кнопок
  const [topButtons, setTopButtons] = useState<{ name: string; clicks: number }[]>([])

  const fromIso = useMemo(() => {
    if (preset === 'today') return isoStartOfDay(new Date())
    if (preset === '7d') return isoDaysAgo(7)
    if (preset === '30d') return isoDaysAgo(30)
    return from.length === 10 ? new Date(from + 'T00:00:00').toISOString() : from
  }, [preset, from])

  const toIso = useMemo(() => {
    if (to.length === 10) return new Date(to + 'T23:59:59').toISOString()
    return new Date().toISOString()
  }, [to])

  const reload = async () => {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setErrorMsg('Ты не авторизован')
      setLoading(false)
      return
    }

    // метки
    const { data: tagsData, error: tagsError } = await supabase
      .from('nfc_tags')
      .select('id,code,name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (tagsError) {
      setErrorMsg(tagsError.message)
      setLoading(false)
      return
    }

    const t = (tagsData || []) as TagRow[]
    setTags(t)

    if (selectedTagId !== 'all' && !t.find((x) => x.id === selectedTagId)) {
      setSelectedTagId('all')
    }

    // события за период: добавляем button_click
    let q = supabase
      .from('events')
      .select('event_type,session_id,nfc_tag_id,created_at,block_id,block_text')
      .eq('user_id', user.id)
      .in('event_type', ['nfc_touch', 'review_click', 'button_click'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso)

    if (selectedTagId !== 'all') {
      q = q.eq('nfc_tag_id', selectedTagId)
    }

    const { data: eventsData, error: eventsError } = await q
    if (eventsError) {
      setErrorMsg(eventsError.message)
      setLoading(false)
      return
    }

    const e = (eventsData || []) as EventRow[]
    setEvents(e)

    // уникальные касания/отзывы по session_id
    const touchSessions = new Set<string>()
    const reviewSessions = new Set<string>()

    for (const row of e) {
      if (!row.session_id) continue
      if (row.event_type === 'nfc_touch') touchSessions.add(row.session_id)
      if (row.event_type === 'review_click') reviewSessions.add(row.session_id)
    }

    const touches = touchSessions.size
    const reviews = reviewSessions.size

    setUniqueTouches(touches)
    setUniqueReviewClicks(reviews)
    setConversion(`${touches > 0 ? Math.round((reviews / touches) * 100) : 0}%`)

    // эффективность меток (nfc_touch + review_click)
    const tagsForTable = selectedTagId === 'all' ? t : t.filter((x) => x.id === selectedTagId)
    const perTag: Record<string, { touch: Set<string>; review: Set<string> }> = {}
    for (const tag of tagsForTable) perTag[tag.id] = { touch: new Set(), review: new Set() }

    for (const row of e) {
      if (!row.session_id || !row.nfc_tag_id) continue
      if (!perTag[row.nfc_tag_id]) perTag[row.nfc_tag_id] = { touch: new Set(), review: new Set() }
      if (row.event_type === 'nfc_touch') perTag[row.nfc_tag_id].touch.add(row.session_id)
      if (row.event_type === 'review_click') perTag[row.nfc_tag_id].review.add(row.session_id)
    }

    const stats = tagsForTable
      .map((tag) => {
        const touchesT = perTag[tag.id]?.touch.size || 0
        const reviewsT = perTag[tag.id]?.review.size || 0
        const c = touchesT > 0 ? Math.round((reviewsT / touchesT) * 100) : 0
        return {
          tagId: tag.id,
          name: tag.name || `Без названия (${tag.code})`,
          touches: touchesT,
          reviews: reviewsT,
          conv: `${c}%`,
        }
      })
      .sort((a, b) => b.touches - a.touches)

    setTagStats(stats)

    // ТОП кнопок: уникальные клики по кнопкам (по session_id)
    // считаем так: для каждой кнопки собираем Set(session_id)
    const buttonMap: Record<string, Set<string>> = {}
    for (const row of e) {
      if (row.event_type !== 'button_click') continue
      if (!row.session_id) continue
      const name = (row.block_text || 'Без названия').trim() || 'Без названия'
      if (!buttonMap[name]) buttonMap[name] = new Set<string>()
      buttonMap[name].add(row.session_id)
    }

    const top = Object.entries(buttonMap)
      .map(([name, set]) => ({ name, clicks: set.size }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    setTopButtons(top)

    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, selectedTagId])

  const Card = ({ title, value }: { title: string; value: string | number }) => (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
      <div className="text-white/60 text-sm mb-2">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Главная</h1>

      {/* Фильтры */}
      <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="text-white/60 text-sm">Фильтр по метке:</div>
          <select
            value={selectedTagId}
            onChange={(e) => setSelectedTagId(e.target.value)}
            className="px-4 py-3 rounded-xl bg-black border border-white/10 outline-none w-full md:max-w-md"
          >
            <option value="all">Все метки</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || `Без названия (${t.code})`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPreset('today')}
            className={`px-4 py-2 rounded-xl border ${preset === 'today' ? 'bg-white text-black' : 'border-white/20'}`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPreset('7d')}
            className={`px-4 py-2 rounded-xl border ${preset === '7d' ? 'bg-white text-black' : 'border-white/20'}`}
          >
            7 дней
          </button>
          <button
            onClick={() => setPreset('30d')}
            className={`px-4 py-2 rounded-xl border ${preset === '30d' ? 'bg-white text-black' : 'border-white/20'}`}
          >
            30 дней
          </button>
          <button
            onClick={() => setPreset('custom')}
            className={`px-4 py-2 rounded-xl border ${preset === 'custom' ? 'bg-white text-black' : 'border-white/20'}`}
          >
            Свой период
          </button>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2">
              <div className="text-white/60 text-sm">От:</div>
              <input
                type="date"
                value={from.length === 10 ? from : from.slice(0, 10)}
                onChange={(e) => setFrom(e.target.value)}
                className="px-4 py-2 rounded-xl bg-black border border-white/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-white/60 text-sm">До:</div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-4 py-2 rounded-xl bg-black border border-white/10"
              />
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card title="Уникальных касаний" value={uniqueTouches} />
            <Card title="Уникальных переходов к отзывам" value={uniqueReviewClicks} />
            <Card title="Конверсия в отзывы" value={conversion} />
          </div>

          {/* Топ кнопок */}
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 mb-8">
            <h2 className="text-xl font-semibold mb-4">Топ кликов по кнопкам</h2>

            {topButtons.length === 0 ? (
              <div className="text-white/60">Пока нет кликов по кнопкам за выбранный период</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-white/60">
                      <th className="py-2 pr-4">Кнопка</th>
                      <th className="py-2 pr-4">Уникальных кликов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topButtons.map((r, idx) => (
                      <tr key={r.name + idx} className="border-t border-white/10">
                        <td className="py-3 pr-4">{r.name}</td>
                        <td className="py-3 pr-4">{r.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Эффективность меток */}
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
            <h2 className="text-xl font-semibold mb-4">Эффективность меток</h2>

            {tagStats.length === 0 ? (
              <div className="text-white/60">Нет данных за выбранный период</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-white/60">
                      <th className="py-2 pr-4">Метка</th>
                      <th className="py-2 pr-4">Касания</th>
                      <th className="py-2 pr-4">Отзывы</th>
                      <th className="py-2 pr-4">Конверсия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagStats.map((r) => (
                      <tr key={r.tagId} className="border-t border-white/10">
                        <td className="py-3 pr-4">{r.name}</td>
                        <td className="py-3 pr-4">{r.touches}</td>
                        <td className="py-3 pr-4">{r.reviews}</td>
                        <td className="py-3 pr-4">{r.conv}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 text-white/60">
            Дальше: добавим “Тип кнопки” (Отзывы/Запись/Соцсети) в редактор, чтобы аналитика была 100% точной даже с короткими ссылками.
          </div>
        </>
      )}
    </div>
  )
}
