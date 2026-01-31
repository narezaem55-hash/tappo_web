import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

type BlockType = 'link' | 'review' | 'call' | 'text' | 'image' | 'divider' | 'map'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizeParamsSlug(params: any): Promise<string> | string {
  // Next иногда прокидывает params как Promise
  if (params && typeof params.then === 'function') return params.then((p: any) => p.slug)
  return params?.slug
}

export default async function PublicTaplinkPage({ params }: { params: any }) {
  const maybe = normalizeParamsSlug(params)
  const slug = typeof maybe === 'string' ? maybe : await maybe

  if (!slug) return notFound()

  const { data: page, error: pageErr } = await supabase
    .from('pages1')
    .select('id,title,description,slug')
    .eq('slug', slug)
    .single()

  if (pageErr || !page) return notFound()

  const { data: blocks, error: blocksErr } = await supabase
    .from('taplink_blocks')
    .select('id,type,title,value,position,data')
    .eq('page_id', page.id)
    .order('position', { ascending: true })

  if (blocksErr) return notFound()

  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0b', display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 390, maxWidth: '100%' }}>
        <div style={{ borderRadius: 28, overflow: 'hidden', background: '#e9e9e9', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
          <div style={{ height: 160, background: '#cfcfcf', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.6)', fontSize: 12 }}>
            Баннер
          </div>

          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 80,
                height: 80,
                borderRadius: 9999,
                background: '#bdbdbd',
                border: '4px solid #e9e9e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0,0,0,0.6)',
                fontSize: 11,
              }}
            >
              Аватар
            </div>
          </div>

          <div style={{ padding: '64px 20px 22px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#000' }}>{page.title || 'Без названия'}</div>
              {page.description ? <div style={{ marginTop: 8, fontSize: 14, color: 'rgba(0,0,0,0.70)' }}>{page.description}</div> : null}
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
              {(blocks || []).map((b: any) => {
                const type = b.type as BlockType
                const d = b.data || {}

                if (type === 'divider') {
                  return <div key={b.id} style={{ height: 1, background: 'rgba(0,0,0,0.12)', borderRadius: 9999 }} />
                }

                if (type === 'image') {
                  const url = d.url || ''
                  const caption = d.caption || ''
                  const fit = (d.fit as 'cover' | 'contain') || 'cover'
                  return (
                    <div key={b.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {url ? (
                        <img src={url} alt="" style={{ width: '100%', maxHeight: 520, objectFit: fit, display: 'block', borderRadius: 16 }} />
                      ) : null}
                      {caption ? <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)', whiteSpace: 'pre-wrap' }}>{caption}</div> : null}
                    </div>
                  )
                }

                if (type === 'text') {
                  // ✅ ВОТ ТУТ БЫЛА ТВОЯ ПРОБЛЕМА "Текст" — теперь выводим HTML из data.html
                  const html = (d.html || '').toString()
                  const style = d.style || {}
                  const color = (style.color as string) || 'rgba(0,0,0,0.85)'
                  const size = Number(style.size) || 14
                  const font = (style.font as string) || 'system-ui'

                  return (
                    <div
                      key={b.id}
                      style={{
                        color,
                        fontSize: size,
                        lineHeight: 1.38,
                        fontFamily: font,
                        whiteSpace: 'normal',
                      }}
                      dangerouslySetInnerHTML={{ __html: html || '' }}
                    />
                  )
                }

                // buttons
                const label = d.label || b.title || 'Кнопка'
                let href = d.url || d.link || b.value || '#'
                if (type === 'call') {
                  // если пользователь ввёл просто номер — делаем tel:
                  const raw = String(href || '').trim()
                  if (raw && !raw.startsWith('tel:') && !raw.startsWith('http')) href = `tel:${raw}`
                }

                return (
                  <a
                    key={b.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      width: '100%',
                      padding: '14px 12px',
                      borderRadius: 18,
                      background: '#9c9c9c',
                      border: '1px solid rgba(0,0,0,0.18)',
                      color: '#000',
                      fontWeight: 800,
                      textAlign: 'center',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    {type === 'map' ? `🗺 ${label}` : label}
                  </a>
                )
              })}
            </div>

            <div style={{ paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Tappo</div>
          </div>
        </div>
      </div>
    </div>
  )
}
