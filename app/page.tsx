import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Tappo
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#how" className="hover:text-white">Как работает</a>
            <a href="#products" className="hover:text-white">NFC-метки</a>
            <a href="#pricing" className="hover:text-white">Тарифы</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Войти
            </Link>
            <Link
              href="/dashboard/create"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              Создать таплинк
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              NFC для бизнеса • Таплинки • Отзывы • Аналитика
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Один тап — и клиент делает то, что нужно бизнесу
            </h1>

            <p className="mt-4 text-base text-white/70 md:text-lg">
              Tappo — платформа для NFC-меток и умных таплинков: отзывы, контакты, меню, ссылки,
              аналитика — всё управляется в личном кабинете.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/create"
                className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-semibold text-black hover:opacity-90"
              >
                Создать таплинк
              </Link>
              <Link
                href="/register"
                className="rounded-2xl border border-white/20 px-6 py-3 text-center text-sm font-semibold hover:bg-white/10"
              >
                Регистрация
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium">Отзывы</div>
                <div className="mt-1 text-xs text-white/60">Собирай и обрабатывай в ЛК</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium">Контакты</div>
                <div className="mt-1 text-xs text-white/60">Соцсети, сайт, меню, прайс</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium">Аналитика</div>
                <div className="mt-1 text-xs text-white/60">Просмотры, клики, конверсия</div>
              </div>
            </div>
          </div>

          {/* Mock */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/0 p-6">
            <div className="rounded-3xl border border-white/10 bg-black p-4">
              <div className="mx-auto w-full max-w-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-white/10" />
                  <div>
                    <div className="text-sm font-semibold">Кофейня “Tappo”</div>
                    <div className="text-xs text-white/60">Нажми — и оставь отзыв</div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black">
                    Оставить отзыв ⭐️
                  </div>
                  <div className="rounded-2xl border border-white/15 px-4 py-3 text-sm">
                    Меню
                  </div>
                  <div className="rounded-2xl border border-white/15 px-4 py-3 text-sm">
                    Контакты / WhatsApp
                  </div>
                  <div className="rounded-2xl border border-white/15 px-4 py-3 text-sm">
                    Мы в соцсетях
                  </div>
                </div>

                <div className="mt-6 text-center text-xs text-white/50">
                  Пример публичного таплинка
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-white/60">
              Подключим NFC-метку → “по тапу” открывается ваша страница.
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Как работает Tappo
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {[
              ["1", "Получаешь NFC-метку", "Наклейка/брелок/стойка для точки"],
              ["2", "Клиент делает тап", "Телефон касается метки"],
              ["3", "Открывается таплинк", "Страница с действиями"],
              ["4", "Клиент оставляет отзыв", "Или открывает меню/контакты"],
              ["5", "Ты видишь аналитику", "В ЛК: клики, просмотры, отзывы"],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Шаг {n}</div>
                <div className="mt-2 text-sm font-semibold">{t}</div>
                <div className="mt-1 text-xs text-white/60">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">NFC-метки</h2>
          <p className="mt-2 text-sm text-white/60">
            Для тестового запуска можно начать с одной наклейки и одного таплинка.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ProductCard
              title="NFC-наклейка"
              photo="Фото: круглая/квадратная наклейка с логотипом Tappo на стойке кассы"
              forWho="Кафе, барбершопы, магазины"
              price="от 490 ₽"
              cta="В комплекте с подпиской"
            />
            <ProductCard
              title="NFC-брелок"
              photo="Фото: брелок с эпоксидным покрытием на связке ключей администратора"
              forWho="Мастера, сервисы, клиники"
              price="от 790 ₽"
              cta="В комплекте с подпиской"
            />
            <ProductCard
              title="NFC-стойка"
              photo="Фото: настольная стойка у ресепшена с надписью «Tap to review»"
              forWho="Рестораны, клиники, офлайн-точки"
              price="от 1990 ₽"
              cta="В комплекте с подпиской"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Тарифы</h2>
          <p className="mt-2 text-sm text-white/60">
            Для старта сделай 1 таплинк и поставь метку на кассу/ресепшен.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <PriceCard
              name="Start"
              price="490 ₽/мес"
              items={[
                "1 таплинк",
                "Отзывы (базово)",
                "Блоки: кнопки/текст/фото",
                "Поддержка: чат",
              ]}
              primary
            />
            <PriceCard
              name="Business"
              price="990 ₽/мес"
              items={[
                "до 5 таплинков",
                "Аналитика по кликам",
                "Брендирование",
                "Экспорт отзывов",
              ]}
            />
            <PriceCard
              name="Pro"
              price="1990 ₽/мес"
              items={[
                "до 20 таплинков",
                "Команда (позже)",
                "Расширенная аналитика",
                "Приоритетная поддержка",
              ]}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            <div className="font-semibold text-white">Почему подписка выгоднее QR?</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>NFC выглядит премиальнее и “в одну секунду” (без камеры).</li>
              <li>Ссылку можно менять в ЛК — не печатаешь заново.</li>
              <li>Есть аналитика и отзывы в одном месте.</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard/create"
              className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-semibold text-black hover:opacity-90"
            >
              Создать таплинк
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/20 px-6 py-3 text-center text-sm font-semibold hover:bg-white/10"
            >
              Войти в кабинет
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">FAQ</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Faq
              q="Можно без домена посмотреть сайт?"
              a="Да. На Vercel будет ссылка вида *.vercel.app — её можно использовать для тестов и первых клиентов."
            />
            <Faq
              q="Можно ли запускаться без ролей менеджеров?"
              a="Да. Для тестового запуска достаточно Owner-аккаунта. Роли/команду подключим позже, без остановки сервиса."
            />
            <Faq
              q="Что нужно для начала?"
              a="Создать таплинк в ЛК, привязать NFC-метку и поставить на кассу/ресепшен."
            />
            <Faq
              q="Можно ли менять ссылку без перепечати?"
              a="Да. Это главное преимущество: метка остаётся та же, ты меняешь контент в кабинете."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-white/60">
            © {new Date().getFullYear()} Tappo — NFC-таплинки для бизнеса
          </div>
          <div className="flex items-center gap-4 text-sm text-white/60">
            <Link href="/login" className="hover:text-white">Войти</Link>
            <Link href="/register" className="hover:text-white">Регистрация</Link>
            <Link href="/dashboard" className="hover:text-white">Личный кабинет</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProductCard(props: {
  title: string;
  photo: string;
  forWho: string;
  price: string;
  cta: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-black p-4 text-xs text-white/60">
        {props.photo}
      </div>
      <div className="mt-3 text-xs text-white/60">Кому подходит</div>
      <div className="text-sm">{props.forWho}</div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{props.price}</div>
        <div className="text-xs text-white/60">{props.cta}</div>
      </div>
    </div>
  );
}

function PriceCard(props: {
  name: string;
  price: string;
  items: string[];
  primary?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-5",
        props.primary
          ? "border-white/30 bg-white text-black"
          : "border-white/10 bg-white/5 text-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className={props.primary ? "text-sm font-semibold" : "text-sm font-semibold"}>
          {props.name}
        </div>
        <div className={props.primary ? "text-sm font-semibold" : "text-sm font-semibold"}>
          {props.price}
        </div>
      </div>

      <ul className={props.primary ? "mt-4 space-y-2 text-sm" : "mt-4 space-y-2 text-sm text-white/80"}>
        {props.items.map((x) => (
          <li key={x} className="flex gap-2">
            <span className={props.primary ? "opacity-80" : "text-white/60"}>•</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Link
          href="/dashboard/create"
          className={[
            "block rounded-2xl px-4 py-3 text-center text-sm font-semibold",
            props.primary ? "bg-black text-white hover:opacity-90" : "bg-white text-black hover:opacity-90",
          ].join(" ")}
        >
          Начать
        </Link>
      </div>
    </div>
  );
}

function Faq(props: { q: string; a: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold">{props.q}</div>
      <div className="mt-2 text-sm text-white/70">{props.a}</div>
    </div>
  );
}
