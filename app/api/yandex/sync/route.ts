import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { chromium } from 'playwright'

function extractYandexOrgId(url: string): string | null {
  try {
    const u = new URL(url)
    const oid = u.searchParams.get('oid')
    if (oid) return oid
    const m = u.pathname.match(/\/org\/[^/]+\/(\d+)/)
    if (m?.[1]) return m[1]
    return null
  } catch {
    return null
  }
}

function normalizeYandexUrl(url: string): string {
  const oid = extractYandexOrgId(url)
  return oid ? `https://yandex.ru/maps/?oid=${oid}` : url
}

function findNumber(source: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = source.match(p)
    if (m?.[1]) {
      const n = Number(String(m[1]).replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function pickFromJsonLd(raw: string): { rating: number | null; reviews: number | null } {
  const obj = safeJsonParse(raw)
  if (!obj) return { rating: null, reviews: null }

  const tryOne = (x: any) => {
    const ar = x?.aggregateRating
    if (!ar) return { rating: null, reviews: null }

    const rating =
      typeof ar.ratingValue === 'number'
        ? ar.ratingValue
        : typeof ar.ratingValue === 'string'
          ? Number(ar.ratingValue.replace(',', '.'))
          : null

    const reviews =
      typeof ar.reviewCount === 'number'
        ? ar.reviewCount
        : typeof ar.reviewCount === 'string'
          ? Number(ar.reviewCount)
          : typeof ar.ratingCount === 'number'
            ? ar.ratingCount
            : typeof ar.ratingCount === 'string'
              ? Number(ar.ratingCount)
              : null

    return {
      rating: Number.isFinite(rating as any) ? (rating as number) : null,
      reviews: Number.isFinite(reviews as any) ? (reviews as number) : null,
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = tryOne(item)
      if (r.rating !== null || r.reviews !== null) return r
    }
    return { rating: null, reviews: null }
  }

  // Иногда JSON-LD: { "@graph": [...] }
  if (Array.isArray(obj?.['@graph'])) {
    for (const item of obj['@graph']) {
      const r = tryOne(item)
      if (r.rating !== null || r.reviews !== null) return r
    }
  }

  return tryOne(obj)
}

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}))
  const tagId: string | undefined = body?.tagId
  const userId: string | undefined = body?.userId

  if (!tagId || !userId) {
    return NextResponse.json({ ok: false, error: 'tagId/userId required' }, { status: 400 })
  }

  const { data: tag, error: tagErr } = await supabaseAdmin
    .from('nfc_tags')
    .select('id,user_id,review_url')
    .eq('id', tagId)
    .single()

  if (tagErr || !tag) {
    return NextResponse.json({ ok: false, error: tagErr?.message || 'tag not found' }, { status: 404 })
  }

  if (tag.user_id !== userId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const reviewUrl = (tag.review_url || '').trim()
  if (!reviewUrl) {
    return NextResponse.json({ ok: false, error: 'review_url is empty' }, { status: 400 })
  }

  const url = normalizeYandexUrl(reviewUrl)

  let browser: any = null
  try {
    await supabaseAdmin
      .from('nfc_tags')
      .update({ yandex_sync_status: 'running', yandex_sync_error: null } as any)
      .eq('id', tagId)

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(3000)

    const html = await page.content()

    // title
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content')
      .catch(() => null)
    const pageTitle = await page.title().catch(() => '')
    const title = ((ogTitle || pageTitle || '') as string).replace(/—\s*Яндекс.*$/i, '').trim() || null

    // photo (может быть логотип Яндекса — но оставим как есть)
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content')
      .catch(() => null)
    const photoUrl = ogImage && ogImage.startsWith('http') ? ogImage : null

    // 1) JSON-LD (самый хороший вариант)
    let rating: number | null = null
    let reviews: number | null = null
    const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts().catch(() => [])
    for (const chunk of ld) {
      const r = pickFromJsonLd(chunk)
      if (r.rating !== null || r.reviews !== null) {
        rating = r.rating
        reviews = r.reviews
        break
      }
    }

    // 2) Fallback regex по HTML (ВАЖНО: \d, а не \\d)
    if (rating === null) {
      rating = findNumber(html, [
        /"ratingValue"\s*:\s*"?(<)?(\d+(?:[.,]\d+)?)"?/i, // иногда бывает странная разметка, но основное ниже
        /"ratingValue"\s*:\s*"?(?:<)?(\d+(?:[.,]\d+)?)"?/i,
        /"rating"\s*:\s*"?(?:<)?(\d+(?:[.,]\d+)?)"?/i,
      ])
    }

    if (reviews === null) {
      reviews = findNumber(html, [
        /"reviewCount"\s*:\s*"?(?:<)?(\d+)"?/i,
        /"ratingCount"\s*:\s*"?(?:<)?(\d+)"?/i,
        /"reviewsCount"\s*:\s*"?(?:<)?(\d+)"?/i,
      ])
    }

    // если вообще ничего не нашли, честно падаем (чтобы видеть ошибку)
    if (rating === null && reviews === null) {
      throw new Error('Не нашёл rating/reviewCount. Возможно капча или данные грузятся иначе для этой страницы.')
    }

    await supabaseAdmin
      .from('nfc_tags')
      .update(
        {
          place_title: title,
          place_rating: rating,
          place_reviews_count: reviews,
          place_photo_url: photoUrl,
          yandex_last_sync: new Date().toISOString(),
          yandex_sync_status: 'ok',
          yandex_sync_error: null,
          review_provider: 'Yandex',
        } as any
      )
      .eq('id', tagId)

    return NextResponse.json({ ok: true, title, rating, reviews, photoUrl })
  } catch (e: any) {
    const msg = e?.message || 'sync error'
    await supabaseAdmin
      .from('nfc_tags')
      .update({ yandex_sync_status: 'error', yandex_sync_error: msg } as any)
      .eq('id', tagId)

    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
