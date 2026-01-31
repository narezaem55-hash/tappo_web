'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

type PageRow = { id: string; title: string | null; slug: string | null; description: string | null }

type BlockType = 'link' | 'review' | 'call' | 'text' | 'image' | 'divider' | 'map'
type Block = { id: string; page_id: string; type: BlockType; title: string; value: string | null; position: number; data: any }

function labelForType(t: BlockType) {
  if (t === 'text') return 'Текст'
  if (t === 'image') return 'Фото'
  if (t === 'divider') return 'Разделитель'
  if (t === 'map') return 'Карта'
  if (t === 'call') return 'Телефон'
  if (t === 'review') return 'Отзывы'
  return 'Ссылка'
}

function toPercentCropFull(): Crop {
  return { unit: '%', x: 0, y: 0, width: 100, height: 100 }
}

async function cropToBlob(imgEl: HTMLImageElement, crop: PixelCrop, mime = 'image/png'): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = imgEl.naturalWidth / imgEl.width
  const scaleY = imgEl.naturalHeight / imgEl.height

  canvas.width = Math.max(1, Math.floor(crop.width * scaleX))
  canvas.height = Math.max(1, Math.floor(crop.height * scaleY))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas error')

  ctx.drawImage(
    imgEl,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('Не удалось создать изображение'))
      resolve(b)
    }, mime)
  })
}

// 25 популярных шрифтов (без установки доп. файлов, это web-safe + популярные системные)
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Inter', value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' },
  { label: 'System UI', value: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Verdana, sans-serif' },
  { label: 'Trebuchet', value: '"Trebuchet MS", Arial, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, Arial, sans-serif' },
  { label: 'Roboto', value: 'Roboto, "Segoe UI", Arial, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
  { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
  { label: 'Nunito', value: 'Nunito, Arial, sans-serif' },
  { label: 'Lato', value: 'Lato, Arial, sans-serif' },
  { label: 'Ubuntu', value: 'Ubuntu, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Monaco', value: 'Monaco, "Courier New", monospace' },
  { label: 'Comic Sans', value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Bookman', value: '"Bookman Old Style", Bookman, serif' },
]

const SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40]

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<PageRow | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])

  // модалки
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [blockType, setBlockType] = useState<BlockType>('link')

  // поля блока
  const [fLabel, setFLabel] = useState('')
  const [fUrl, setFUrl] = useState('')

  // ✅ текст теперь HTML + стили
  const [fTextHtml, setFTextHtml] = useState('')
  const [textColor, setTextColor] = useState('#111111')
  const [textSize, setTextSize] = useState(14)
  const [textFont, setTextFont] = useState(FONT_OPTIONS[0].value)

  // активные кнопки форматирования (подсветка)
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, strike: false })

  // contentEditable ref
  const richRef = useRef<HTMLDivElement | null>(null)

  // фото
  const [fCaption, setFCaption] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [imgSrc, setImgSrc] = useState<string>('') // objectURL
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 10, y: 10, width: 80, height: 80 })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [noCrop, setNoCrop] = useState(false)
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover')

  // autosave page
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const ignoreAutosaveRef = useRef(true)
  const autosaveTimerRef = useRef<any>(null)

  const previewUrl = useMemo(() => (page?.slug ? `/p/${page.slug}` : null), [page?.slug])

  const loadAll = async () => {
    setLoading(true)

    const { data: pageData, error: pageErr } = await supabase
      .from('pages1')
      .select('id,title,slug,description')
      .eq('id', id)
      .single()

    if (pageErr) {
      alert(pageErr.message)
      setLoading(false)
      return
    }

    const { data: blocksData, error: blocksErr } = await supabase
      .from('taplink_blocks')
      .select('id,page_id,type,title,value,position,data')
      .eq('page_id', id)
      .order('position', { ascending: true })

    if (blocksErr) {
      alert(blocksErr.message)
      setLoading(false)
      return
    }

    setPage(pageData as PageRow)
    setTitle(pageData?.title || '')
    setDescription(pageData?.description || '')
    setBlocks((blocksData || []) as Block[])
    ignoreAutosaveRef.current = false
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    if (ignoreAutosaveRef.current) return
    if (!page?.id) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)

    autosaveTimerRef.current = setTimeout(async () => {
      setSaveState('saving')
      const { error } = await supabase
        .from('pages1')
        .update({ title: title.trim(), description: description.trim() })
        .eq('id', page.id)

      if (error) {
        setSaveState('error')
        return
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 900)
    }, 300)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [title, description, page?.id])

  const openBlockPicker = () => {
    setMode('create')
    setEditingId(null)
    setPickerOpen(true)
  }

  const resetImageEditor = () => {
    setImageFile(null)
    setUploading(false)
    if (imgSrc) URL.revokeObjectURL(imgSrc)
    setImgSrc('')
    setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 })
    setCompletedCrop(null)
    setAspect(undefined)
    setNoCrop(false)
    setFitMode('cover')
  }

  const resetTextEditor = () => {
    setFTextHtml('')
    setTextColor('#111111')
    setTextSize(14)
    setTextFont(FONT_OPTIONS[0].value)
    setFmt({ bold: false, italic: false, underline: false, strike: false })
    if (richRef.current) richRef.current.innerHTML = ''
  }

  const pickType = (t: BlockType) => {
    setPickerOpen(false)

    setMode('create')
    setEditingId(null)
    setBlockType(t)

    setFLabel('')
    setFUrl('')
    setFCaption('')
    resetImageEditor()
    resetTextEditor()

    if (t === 'map') setFLabel('Наш адрес')
    if (t === 'link') setFLabel('Ссылка')
    if (t === 'review') setFLabel('Отзывы')
    if (t === 'call') setFLabel('Позвонить')

    setEditorOpen(true)

    setTimeout(() => {
      if (t === 'text') richRef.current?.focus()
    }, 50)
  }

  const openEdit = (b: Block) => {
    setMode('edit')
    setEditingId(b.id)
    setBlockType(b.type)

    const d = b.data || {}
    setFLabel((d.label as string) || (b.title as string) || '')
    setFUrl((d.url as string) || (d.link as string) || (b.value as string) || '')
    setFCaption((d.caption as string) || '')

    resetImageEditor()
    resetTextEditor()

    if (b.type === 'image') {
      setFitMode((d.fit as 'cover' | 'contain') || 'cover')
    }

    if (b.type === 'text') {
      const html = (d.html as string) || ''
      const oldText = (d.text as string) || ''
      const merged = html || (oldText ? escapeToHtml(oldText) : '')
      setFTextHtml(merged)

      const style = d.style || {}
      setTextColor((style.color as string) || '#111111')
      setTextSize(Number(style.size) || 14)
      setTextFont((style.font as string) || FONT_OPTIONS[0].value)

      setTimeout(() => {
        if (richRef.current) {
          richRef.current.innerHTML = merged
          richRef.current.focus()
          updateFmtFromSelection()
        }
      }, 50)
    }

    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    resetImageEditor()
  }

  // ✅ upload file to Supabase Storage and return public URL
  const uploadBlobToStorage = async (blob: Blob, fileNameBase: string, mime: string) => {
    setUploading(true)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      setUploading(false)
      throw new Error('Нет авторизации. Перезайди в аккаунт.')
    }

    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png'
    const filePath = `${user.id}/${id}/${fileNameBase}-${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage.from('media').upload(filePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime,
    })

    if (upErr) {
      setUploading(false)
      throw new Error(upErr.message)
    }

    const { data } = supabase.storage.from('media').getPublicUrl(filePath)
    setUploading(false)
    return data.publicUrl
  }

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!imageFile) return fUrl.trim()

    if (noCrop) {
      const blob = imageFile
      return await uploadBlobToStorage(blob, 'image', imageFile.type || 'image/png')
    }

    if (!imgRef.current) throw new Error('Не удалось открыть изображение для кадрирования')
    if (!completedCrop || completedCrop.width <= 1 || completedCrop.height <= 1) {
      throw new Error('Выбери область кадрирования')
    }

    const blob = await cropToBlob(imgRef.current, completedCrop, 'image/png')
    return await uploadBlobToStorage(blob, 'image-crop', 'image/png')
  }

  const buildPayload = async () => {
    const t = blockType

    if (t === 'divider') {
      return { type: 'divider', title: 'Разделитель', value: null as string | null, data: {} }
    }

    if (t === 'text') {
      const html = (fTextHtml || richRef.current?.innerHTML || '').trim()
      return {
        type: 'text',
        title: 'Текст',
        value: null as string | null,
        data: {
          html,
          style: { color: textColor, size: textSize, font: textFont },
        },
      }
    }

    if (t === 'image') {
      const url = await uploadImageIfNeeded()
      return {
        type: 'image',
        title: 'Фото',
        value: null as string | null,
        data: { url, caption: fCaption.trim(), fit: fitMode },
      }
    }

    if (t === 'map') {
      return {
        type: 'map',
        title: fLabel.trim() || 'Карта',
        value: null as string | null,
        data: { label: fLabel.trim() || 'Карта', link: fUrl.trim() },
      }
    }

    const label = fLabel.trim() || labelForType(t)
    return {
      type: t,
      title: label,
      value: (fUrl.trim() || null) as string | null,
      data: { label, url: fUrl.trim() || '' },
    }
  }

  const saveBlock = async () => {
    try {
      if (blockType === 'text') {
        const html = (richRef.current?.innerHTML ?? fTextHtml).trim()
        if (!stripHtml(html).trim()) return alert('Заполни текст')
      }
      if (blockType === 'image') {
        if (!imageFile && !fUrl.trim()) return alert('Выбери файл или вставь ссылку на фото')
      }
      if (blockType === 'map') {
        if (!fUrl.trim()) return alert('Вставь ссылку на карту')
      }
      if (blockType === 'link' || blockType === 'review' || blockType === 'call') {
        if (!fUrl.trim()) return alert('Вставь ссылку/телефон')
      }

      const payload = await buildPayload()

      if (mode === 'create') {
        const { error } = await supabase.from('taplink_blocks').insert({
          page_id: id,
          type: payload.type,
          title: payload.title,
          value: payload.value,
          data: payload.data,
          position: blocks.length,
        })
        if (error) return alert(error.message)
        closeEditor()
        await loadAll()
        return
      }

      if (mode === 'edit' && editingId) {
        const { error } = await supabase
          .from('taplink_blocks')
          .update({
            type: payload.type,
            title: payload.title,
            value: payload.value,
            data: payload.data,
          })
          .eq('id', editingId)
        if (error) return alert(error.message)
        closeEditor()
        await loadAll()
      }
    } catch (e: any) {
      alert(e?.message || 'Ошибка сохранения')
      setUploading(false)
    }
  }

  const deleteBlock = async () => {
    if (!editingId) return
    if (!confirm('Удалить блок?')) return
    const { error } = await supabase.from('taplink_blocks').delete().eq('id', editingId)
    if (error) return alert(error.message)
    closeEditor()
    await loadAll()
  }

  const duplicateBlock = async () => {
    if (!editingId) return
    const original = blocks.find((b) => b.id === editingId)
    if (!original) return

    const { error } = await supabase.from('taplink_blocks').insert({
      page_id: original.page_id,
      type: original.type,
      title: original.title,
      value: original.value,
      data: original.data,
      position: blocks.length,
    })
    if (error) return alert(error.message)

    closeEditor()
    await loadAll()
  }

  // ======= text toolbar helpers =======

  const updateFmtFromSelection = () => {
    // работает по текущему курсору/выделению
    const bold = document.queryCommandState('bold')
    const italic = document.queryCommandState('italic')
    const underline = document.queryCommandState('underline')
    const strike = document.queryCommandState('strikeThrough')
    setFmt({ bold, italic, underline, strike })
  }

  const exec = (cmd: string, val?: string) => {
    if (!richRef.current) return
    richRef.current.focus()
    document.execCommand(cmd, false, val)
    setFTextHtml(richRef.current.innerHTML)
    updateFmtFromSelection()
  }

  const applyFontToSelectionOrAll = (font: string) => {
  setTextFont(font)
  if (!richRef.current) return

  const sel = window.getSelection()
  const hasRange =
    !!sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed

  if (hasRange) {
    wrapSelectionWithStyle({ fontFamily: font })
    setFTextHtml(richRef.current.innerHTML)
    updateFmtFromSelection()
    return
  }

  // без выделения — применяем ко всему тексту
  richRef.current.style.fontFamily = font
  setFTextHtml(richRef.current.innerHTML)
}


  const applySizeToSelectionOrAll = (size: number) => {
    setTextSize(size)

    const sel = window.getSelection()
    const hasRange = !!sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
    if (!richRef.current) return

    if (hasRange) {
      // document.execCommand('fontSize') работает странно (1..7), поэтому делаем span-обертку
      wrapSelectionWithStyle({ fontSize: `${size}px` })
      setFTextHtml(richRef.current.innerHTML)
      return
    }

    // весь текст
    richRef.current.style.fontSize = `${size}px`
    setFTextHtml(richRef.current.innerHTML)
  }

  const applyColorToSelectionOrAll = (color: string) => {
    setTextColor(color)

    const sel = window.getSelection()
    const hasRange = !!sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
    if (!richRef.current) return

    if (hasRange) {
      exec('foreColor', color)
      return
    }

    // весь текст
    richRef.current.style.color = color
    setFTextHtml(richRef.current.innerHTML)
  }

  const wrapSelectionWithStyle = (styleObj: Record<string, string>) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) return

    const span = document.createElement('span')
    Object.entries(styleObj).forEach(([k, v]) => {
      ;(span.style as any)[k] = v
    })

    span.appendChild(range.extractContents())
    range.insertNode(span)

    // поставить курсор после вставки
    range.setStartAfter(span)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const onRichSelectionChange = () => {
    // обновляем подсветку кнопок при клике/выделении
    updateFmtFromSelection()
  }

  useEffect(() => {
    // глобально ловим выделение (когда модалка открыта)
    const handler = () => {
      if (!editorOpen || blockType !== 'text') return
      onRichSelectionChange()
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [editorOpen, blockType])

  if (loading) return <div style={{ padding: 24, color: 'rgba(255,255,255,0.7)' }}>Загрузка...</div>

  return (
    <div style={{ padding: 24 }}>
      {/* top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <button
          onClick={() => router.push('/dashboard/pages')}
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          ← Назад
        </button>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            {saveState === 'saving' && 'Сохраняю…'}
            {saveState === 'saved' && 'Сохранено ✓'}
            {saveState === 'error' && 'Ошибка'}
          </div>

          <button
            onClick={() => {
              if (!previewUrl) return alert('Нет slug. Задай slug в “Мои таплинки”')
              window.open(previewUrl, '_blank')
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Предпросмотр
          </button>
        </div>
      </div>

      {/* phone */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название бизнеса"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 800,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#000',
                    borderBottom: '1px solid rgba(0,0,0,0.12)',
                    paddingBottom: 6,
                  }}
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание"
                  style={{
                    width: '100%',
                    marginTop: 10,
                    textAlign: 'center',
                    fontSize: 14,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'rgba(0,0,0,0.7)',
                    borderBottom: '1px solid rgba(0,0,0,0.10)',
                    paddingBottom: 6,
                  }}
                />
              </div>

              <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                {blocks.map((b) => {
                  const d = b.data || {}

                  if (b.type === 'divider') {
                    return (
                      <div
                        key={b.id}
                        onClick={() => openEdit(b)}
                        style={{ height: 1, background: 'rgba(0,0,0,0.12)', borderRadius: 9999, cursor: 'pointer' }}
                      />
                    )
                  }

                  if (b.type === 'image') {
                    const imageUrl = d.url || ''
                    const caption = d.caption || ''
                    const fit = (d.fit as 'cover' | 'contain') || 'cover'
                    return (
                      <div key={b.id} onClick={() => openEdit(b)} style={{ cursor: 'pointer' }}>
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            style={{
                              width: '100%',
                              maxHeight: 420,
                              objectFit: fit,
                              display: 'block',
                              borderRadius: 16,
                            }}
                          />
                        ) : (
                          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.55)' }}>Фото</div>
                        )}
                        {caption ? <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)', whiteSpace: 'pre-wrap' }}>{caption}</div> : null}
                      </div>
                    )
                  }

                  if (b.type === 'text') {
                    const html = (d.html || '').toString()
                    const style = d.style || {}
                    const color = (style.color as string) || 'rgba(0,0,0,0.85)'
                    const size = Number(style.size) || 14
                    const font = (style.font as string) || FONT_OPTIONS[0].value
                    return (
                      <div
                        key={b.id}
                        onClick={() => openEdit(b)}
                        style={{
                          cursor: 'pointer',
                          color,
                          fontSize: size,
                          lineHeight: 1.38,
                          whiteSpace: 'normal',
                          fontFamily: font,
                        }}
                        dangerouslySetInnerHTML={{ __html: html || '<span style="opacity:.6">Текст</span>' }}
                      />
                    )
                  }

                  const label = d.label || b.title || labelForType(b.type)
                  return (
                    <button
                      key={b.id}
                      onClick={() => openEdit(b)}
                      style={{
                        width: '100%',
                        padding: '14px 12px',
                        borderRadius: 18,
                        background: '#9c9c9c',
                        border: '1px solid rgba(0,0,0,0.18)',
                        color: '#000',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {b.type === 'map' ? `🗺 ${label}` : label}
                    </button>
                  )
                })}

                <button
                  onClick={openBlockPicker}
                  style={{
                    width: '100%',
                    padding: '14px 12px',
                    borderRadius: 18,
                    background: '#8f8f8f',
                    border: '1px solid rgba(0,0,0,0.18)',
                    color: '#000',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Добавить блок +
                </button>
              </div>

              <div style={{ paddingTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Tappo</div>
            </div>
          </div>
        </div>
      </div>

      {/* picker tiles */}
      {pickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <div onClick={() => setPickerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 860, borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', background: '#1e1f22', boxShadow: '0 30px 90px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Новый блок</div>
                <button onClick={() => setPickerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>
                  ×
                </button>
              </div>

              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                  <Tile title="Текст" icon="Aa" onClick={() => pickType('text')} />
                  <Tile title="Ссылка" icon="↗" onClick={() => pickType('link')} />
                  <Tile title="Фото" icon="🖼" onClick={() => pickType('image')} />
                  <Tile title="Разделитель" icon="≡" onClick={() => pickType('divider')} />
                  <Tile title="Карта" icon="📍" onClick={() => pickType('map')} />
                  <Tile title="Телефон" icon="📞" onClick={() => pickType('call')} />
                </div>
              </div>

              <div style={{ height: 10 }} />
            </div>
          </div>
        </div>
      )}

      {/* editor modal */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <div onClick={closeEditor} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 860, borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', background: '#1e1f22', boxShadow: '0 30px 90px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {mode === 'create' ? `Добавить: ${labelForType(blockType)}` : `Редактировать: ${labelForType(blockType)}`}
                </div>
                <button onClick={closeEditor} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>
                  ×
                </button>
              </div>

              <div style={{ padding: 18 }}>
                {(blockType === 'link' || blockType === 'review' || blockType === 'call' || blockType === 'map') && (
                  <>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8 }}>
                      {blockType === 'map' ? 'Название (что увидит пользователь)' : 'Название'}
                    </div>
                    <input
                      value={fLabel}
                      onChange={(e) => setFLabel(e.target.value)}
                      placeholder={blockType === 'map' ? 'Например: Кусковская 12/1' : 'Например: Отзывы'}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.10)', outline: 'none', color: '#fff', marginBottom: 14 }}
                    />

                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8 }}>
                      {blockType === 'call' ? 'Телефон' : 'Ссылка'}
                    </div>
                    <input
                      value={fUrl}
                      onChange={(e) => setFUrl(e.target.value)}
                      placeholder={blockType === 'call' ? '+7 999 123-45-67' : 'https://example.com'}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.10)', outline: 'none', color: '#fff', marginBottom: 16 }}
                    />
                  </>
                )}

                {blockType === 'text' && (
                  <>
                    {/* ✅ ПАНЕЛЬ РЕДАКТИРОВАНИЯ */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      <button type="button" onClick={() => exec('bold')} style={tbBtnStyle(fmt.bold)}>
                        B
                      </button>
                      <button type="button" onClick={() => exec('italic')} style={tbBtnStyle(fmt.italic)}>
                        I
                      </button>
                      <button type="button" onClick={() => exec('underline')} style={tbBtnStyle(fmt.underline)}>
                        U
                      </button>
                      <button type="button" onClick={() => exec('strikeThrough')} style={tbBtnStyle(fmt.strike)}>
                        S
                      </button>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Шрифт</span>
                        <select
                          value={textFont}
                          onChange={(e) => applyFontToSelectionOrAll(e.target.value)}
                          style={tbSelectStyle}
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.label} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Размер</span>
                        <select
                          value={textSize}
                          onChange={(e) => applySizeToSelectionOrAll(Number(e.target.value))}
                          style={tbSelectStyle}
                        >
                          {SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}px
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Цвет</span>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => applyColorToSelectionOrAll(e.target.value)}
                          style={{ width: 40, height: 34, background: 'transparent', border: 'none', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8 }}>Текст</div>

                    <div
                      ref={richRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                      const v = (e.currentTarget as HTMLDivElement).innerHTML
                      setFTextHtml(v)
                    }}

                      onMouseUp={onRichSelectionChange}
                      onKeyUp={onRichSelectionChange}
                      style={{
                        width: '100%',
                        minHeight: 160,
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(0,0,0,0.22)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        outline: 'none',
                        color: '#fff',
                        marginBottom: 16,
                        overflow: 'auto',
                        fontFamily: textFont, // ✅ применяем к контейнеру (если нет выделения — всё будет этим шрифтом)
                        fontSize: `${textSize}px`,
                      }}
                    />
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      Можно выделять слово и менять стиль, либо без выделения — включать стиль и печатать дальше.
                    </div>
                  </>
                )}

                {/* image/divider/map остаются без изменений */}
                {blockType === 'image' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Фото</div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                      >
                        Выбрать файл
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setImageFile(f)
                        if (imgSrc) URL.revokeObjectURL(imgSrc)
                        if (f) {
                          const url = URL.createObjectURL(f)
                          setImgSrc(url)
                          setNoCrop(false)
                          setFitMode('cover')
                        } else {
                          setImgSrc('')
                        }
                      }}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={noCrop}
                          onChange={(e) => {
                            const v = e.target.checked
                            setNoCrop(v)
                            if (v) {
                              setFitMode('contain')
                              setAspect(undefined)
                            }
                          }}
                        />
                        Показать полностью (без обрезки)
                      </label>

                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button onClick={() => setAspect(undefined)} style={chipBtn(aspect === undefined)} type="button" disabled={noCrop}>
                          Свободно
                        </button>
                        <button onClick={() => setAspect(1)} style={chipBtn(aspect === 1)} type="button" disabled={noCrop}>
                          Квадрат 1:1
                        </button>
                      </div>
                    </div>

                    {imgSrc ? (
                      <div style={{ border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, overflow: 'hidden', background: 'rgba(0,0,0,0.25)', marginBottom: 14 }}>
                        <div style={{ padding: 10, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                          {noCrop ? 'Без кадрирования: загрузится оригинал' : 'Выдели область кадрирования'}
                        </div>

                        {!noCrop ? (
                          <div style={{ padding: 10 }}>
                            <ReactCrop
                              crop={crop}
                              onChange={(_, pc) => setCrop(pc)}
                              onComplete={(c) => setCompletedCrop(c)}
                              aspect={aspect}
                              keepSelection
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                ref={imgRef}
                                alt="crop"
                                src={imgSrc}
                                onLoad={() => setCrop(toPercentCropFull())}
                                style={{ maxHeight: 340, width: '100%', objectFit: 'contain' }}
                              />
                            </ReactCrop>
                          </div>
                        ) : (
                          <div style={{ padding: 10 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imgSrc} alt="full" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 12 }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8 }}>Или ссылка на фото (URL)</div>
                        <input
                          value={fUrl}
                          onChange={(e) => setFUrl(e.target.value)}
                          placeholder="https://…"
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.10)', outline: 'none', color: '#fff', marginBottom: 14 }}
                        />
                      </>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <button type="button" onClick={() => setFitMode('cover')} style={chipBtn(fitMode === 'cover')}>
                        Заполнить (cover)
                      </button>
                      <button type="button" onClick={() => setFitMode('contain')} style={chipBtn(fitMode === 'contain')}>
                        Показать полностью (contain)
                      </button>
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8 }}>Подпись (необязательно)</div>
                    <input
                      value={fCaption}
                      onChange={(e) => setFCaption(e.target.value)}
                      placeholder="Например: Наш салон"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.10)', outline: 'none', color: '#fff', marginBottom: 16 }}
                    />
                  </>
                )}

                {blockType === 'divider' && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 }}>Разделитель добавится как тонкая линия.</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {mode === 'edit' && (
                      <>
                        <button onClick={duplicateBlock} style={ghostBtn}>
                          Дублировать
                        </button>

                        <button onClick={deleteBlock} style={dangerBtn}>
                          Удалить
                        </button>
                      </>
                    )}
                  </div>

                  <button onClick={saveBlock} disabled={uploading} style={primaryBtn(uploading)}>
                    {uploading ? 'Загрузка…' : 'Сохранить'}
                  </button>
                </div>
              </div>

              <div style={{ height: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile(props: { title: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        height: 120,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: 'rgba(255,255,255,0.88)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 34, opacity: 0.85 }}>{props.icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{props.title}</div>
    </button>
  )
}

function tbBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 10px',
    borderRadius: 10,
    border: active ? '1px solid rgba(90,160,255,0.9)' : '1px solid rgba(255,255,255,0.14)',
    background: active ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.06)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
    minWidth: 40,
  }
}

// ✅ чтобы в выпадашке варианты было видно — делаем "светлые" option через native CSS невозможно идеально,
// но: ставим светлый фон и тёмный текст у самого select (тогда список становится читаемым в большинстве браузеров).
const tbSelectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: '#f2f2f2',
  color: '#111',
  outline: 'none',
  cursor: 'pointer',
}

function chipBtn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  }
}

const ghostBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.9)',
  cursor: 'pointer',
}

const dangerBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,80,80,0.45)',
  background: 'rgba(255,80,80,0.08)',
  color: 'rgba(255,170,170,0.95)',
  cursor: 'pointer',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: 12,
    border: 'none',
    background: disabled ? '#1f4fb8' : '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.85 : 1,
  }
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '')
}

function escapeToHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br/>')
}
