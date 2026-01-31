'use client'

import { usePathname, useRouter } from 'next/navigation'

export default function TopBar() {
  const router = useRouter()
  const pathname = usePathname()

  // Кнопка "Назад" не нужна на главной
  const showBack = pathname !== '/dashboard'
  if (!showBack) return null

  const smartBack = () => {
    // если есть история в этой вкладке — идём назад
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    // если историю неоткуда брать — ведём в кабинет
    router.push('/dashboard')
  }

  return (
    <div className="mb-6">
      <button
        onClick={smartBack}
        className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10"
      >
        ← Назад
      </button>
    </div>
  )
}
