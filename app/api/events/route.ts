import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function GET() {
  return json({
    ok: true,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceKey),
  })
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'Missing env vars' }, 500)

    const body = await req.json()
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const event_type = body.event_type as string
    const session_id = body.session_id ?? null

    if (!event_type || !['nfc_touch', 'page_view', 'button_click', 'review_click'].includes(event_type)) {
      return json({ ok: false, error: 'Invalid event_type' }, 400)
    }

    // контекст страницы обязателен
    const pageSlug = body.page_slug as string | undefined
    const nfcCode = body.nfc_code as string | undefined

    // Если событие nfc_touch — обязательно nfc_code
    if (event_type === 'nfc_touch' && !nfcCode) {
      return json({ ok: false, error: 'Missing nfc_code for nfc_touch' }, 400)
    }

    let page: any = null
    let tag: any = null

    // 1) если есть slug — найдём page
    if (pageSlug) {
      const { data, error } = await supabaseAdmin
        .from('pages1')
        .select('id,user_id')
        .eq('slug', pageSlug)
        .single()
      if (error || !data) return json({ ok: false, error: 'Page not found' }, 404)
      page = data
    }

    // 2) если есть nfc_code — найдём tag
    if (nfcCode) {
      const { data, error } = await supabaseAdmin
        .from('nfc_tags')
        .select('id,user_id,page_id')
        .eq('code', nfcCode)
        .single()
      if (error || !data) return json({ ok: false, error: 'NFC tag not found' }, 404)
      tag = data
    }

    // 3) определяем владельца
    const user_id = tag?.user_id || page?.user_id
    const page_id = tag?.page_id || page?.id

    if (!user_id) return json({ ok: false, error: 'Could not resolve user_id' }, 400)

    // защита: если есть и page и tag — проверяем что tag относится к этой странице
    if (page && tag && tag.page_id !== page.id) {
      // не пишем кривые события
      return json({ ok: false, error: 'Tag does not belong to this page' }, 400)
    }

    const event = {
      user_id,
      event_type,
      session_id,
      nfc_tag_id: tag?.id ?? null,
      page_id: page_id ?? null,
      block_id: body.block_id ?? null,
      block_text: body.block_text ?? null,
      block_url: body.block_url ?? null,
      block_type: body.block_type ?? null,
    }

    const { error: insErr } = await supabaseAdmin.from('events').insert([event])
    if (insErr) return json({ ok: false, error: insErr.message }, 500)

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'Unknown error' }, 500)
  }
}
