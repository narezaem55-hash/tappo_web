import Link from 'next/link'
import TopBar from './_components/TopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-72 border-r border-white/10 p-6 hidden md:block">
        <div className="text-2xl font-bold mb-8">Tappo</div>

        <nav className="space-y-2">
          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard">
            Главная
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/pages">
            Мои таплинки
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/nfc">
            Мои метки
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/reviews">
            Отзывы
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/analytics">
            Аналитика
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/billing">
            Тариф и оплата
          </Link>

          <Link className="block px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" href="/dashboard/settings">
            Настройки
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <TopBar />
        {children}
      </main>
    </div>
  )
}
