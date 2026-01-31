import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

type Block = {
  id: string
  type: 'review' | 'link' | 'call'
  title: string
  value: string
  position: number
}

function getSupabaseKeys() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISH_KEY ||
    ''
  return { url, key }
}

export default async function PublicTaplinkByPSlug(props: { params: Promise<{ slug: string }> }) {
  const { params } = props
  const { slug } = await params

  const { url, key } = getSupabaseKeys()
  if (!url || !key) return notFound()

  const supabase = createClient(url, key)

  const { data: page, error: pageErr } = await supabase
    .from('pages1')
    .select('id,title,description,slug')
    .eq('slug', slug)
    .single()

  if (pageErr || !page) return notFound()

  const { data: blocksData } = await supabase
    .from('taplink_blocks')
    .select('id,type,title,value,position')
    .eq('page_id', page.id)
    .order('position', { ascending: true })

  const blocks = (blocksData || []) as Block[]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b0b0b',
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 12px',
      }}
    >
      <div style={{ width: 390, maxWidth: '100%' }}>
        <div style={{ borderRadius: 28, overflow: 'hidden', background: '#e9e9e9' }}>
          <div
            style={{
              height: 160,
              background: '#cfcfcf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0,0,0,0.6)',
              fontSize: 12,
            }}
          >
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
                fontSize: 11,
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              Аватар
            </div>
          </div>

          <div style={{ padding: '64px 20px 22px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#000' }}>
                {page.title || 'Название'}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(0,0,0,0.7)' }}>
                {page.description || ''}
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
              {blocks.map((b) => {
                let href = b.value
                if (b.type === 'call') {
                  const phone = b.value.replace(/\s/g, '')
                  href = phone.startsWith('tel:') ? phone : `tel:${phone}`
                }
                return (
                  <a
                    key={b.id}
                    href={href}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '14px 12px',
                      borderRadius: 18,
                      background: '#9c9c9c',
                      border: '1px solid rgba(0,0,0,0.12)',
                      color: '#000',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    {b.title}
                  </a>
                )
              })}
            </div>

            <div style={{ paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>
              Tappo
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
