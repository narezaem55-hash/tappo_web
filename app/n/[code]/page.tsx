'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getSessionId() {
  const KEY_ID = 'tappo_session_id'
  const KEY_TS = 'tappo_session_ts'
  const TTL_MS = 30 * 60 * 1000

  const now = Date.now()
  const prevTs = Number(localStorage.getItem(KEY_TS) || '0')
  let sid = localStorage.getItem(KEY_ID)

  if (!sid || !prevTs || now - prevTs > TTL_MS) {
    sid = uuidv4()
    localStorage.setItem(KEY_ID, sid)
  }

  localStorage.setItem(KEY_TS, String(now))
  return sid
}

async function logEvent(payload: any) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true as any,
    })
  } catch {}
}

export default function NFCPage() {
  const params = useParams()
  const code = params.code as string
  const [status, setStatus] = useState('Загрузка...')

  useEffect(() => {
    const run = async () => {
      const sessionId = getSessionId()

      // антидребезг: 1 касание в 60 сек на (session + code)
      const debounceKey = `tappo_nfc_touch_${sessionId}_${code}`
      const last = Number(sessionStorage.getItem(debounceKey) || '0')
      const now = Date.now()

      if (!last || now - last > 60_000) {
        logEvent({
          event_type: 'nfc_touch',
          session_id: sessionId,
          nfc_code: code,
        })
        sessionStorage.setItem(debounceKey, String(now))
      }

      const { data: tag } = await supabase
        .from('nfc_tags')
        .select('page_id')
        .eq('code', code)
        .single()

      if (!tag?.page_id) {
        setStatus('❌ NFC метка не найдена')
        return
      }

      const { data: page } = await supabase
        .from('pages1')
        .select('slug')
        .eq('id', tag.page_id)
        .single()

      if (!page?.slug) {
        setStatus('❌ Страница не найдена')
        return
      }

      // ✅ передаём код метки в публичную страницу
      window.location.replace(`/p/${page.slug}?nfc=${encodeURIComponent(code)}`)
    }

    run()
  }, [code])

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-xl">{status}</div>
    </main>
  )
}
