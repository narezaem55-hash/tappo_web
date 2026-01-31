export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="text-5xl font-bold mb-4">Tappo</h1>
      <p className="text-xl opacity-70 mb-8">
        NFC + Taplink + личный кабинет + подписка
      </p>

      <div className="flex gap-4">
        <a
          href="/login"
          className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90"
        >
          Войти
        </a>

        <a
          href="/register"
          className="px-6 py-3 rounded-xl border border-white/30 hover:bg-white/10"
        >
          Регистрация
        </a>
      </div>
    </main>
  );
}
