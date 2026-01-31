"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ✅ Поменяй импорт, если у тебя supabase клиент в другом месте
import { supabase } from "../../../../lib/supabase/supabaseClient";
 // <-- если ошибка, скажи как у тебя называется файл/экспорт

type BlockType = "button" | "text" | "image" | "divider" | "map";
type Align = "left" | "center" | "right";

type Page = {
  id: string;
  title?: string | null;
  slug?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
};

type BlockRow = {
  id: string;
  page_id: string;
  type: string;
  title: string | null;
  value: string | null;
  position: number;
  created_at: string;
  data: any; // jsonb
};

function cn(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

function ensureTextData(data: any) {
  const d = data ?? {};
  const style = d.style ?? {};
  return {
    text: typeof d.text === "string" ? d.text : (d.value ?? "Текст"),
    style: {
      fontFamily: style.fontFamily ?? "Inter",
      fontSize: style.fontSize ?? "16px",
      fontWeight: style.fontWeight ?? "400",
      color: style.color ?? "#ffffff",
      align: (style.align ?? "center") as Align,
    },
  };
}

function defaultData(type: BlockType) {
  switch (type) {
    case "text":
      return ensureTextData({ text: "Текст", style: { align: "center" } });
    case "button":
      return { label: "Кнопка", url: "https://example.com" };
    case "image":
      return { url: "", alt: "Изображение" };
    case "divider":
      return { kind: "line" };
    case "map":
      return { title: "Мы на карте", address: "Москва" };
    default:
      return {};
  }
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const pageId = params?.id;

  const [page, setPage] = useState<Page | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => blocks.find((b) => b.id === activeId) ?? null, [blocks, activeId]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // drag&drop
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    if (!pageId) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  async function loadAll() {
    setMsg(null);

    // pages1
    const p = await supabase
      .from("pages1")
      .select("id,title,slug,avatar_url,banner_url")
      .eq("id", pageId)
      .maybeSingle();

    if (p.error) setMsg(p.error.message);
    setPage((p.data as any) ?? null);

    // blocks
    const b = await supabase
      .from("taplink_blocks")
      .select("*")
      .eq("page_id", pageId)
      .order("position", { ascending: true });

    if (b.error) setMsg(b.error.message);

    const rows = (b.data as any[]) ?? [];
    // нормализуем text-блоки, чтобы align был всегда
    const normalized = rows.map((r) => {
      if (r.type === "text") {
        return { ...r, data: ensureTextData(r.data) };
      }
      return r;
    });

    setBlocks(normalized);
    setActiveId(normalized?.[0]?.id ?? null);
  }

  async function addBlock(type: BlockType) {
    if (!pageId) return;
    setBusy(true);
    setMsg(null);

    const nextPos = blocks.length ? Math.max(...blocks.map((x) => x.position ?? 0)) + 1 : 1;

    const res = await supabase
      .from("taplink_blocks")
      .insert({
        page_id: pageId,
        type,
        title: type === "text" ? "Текст" : type === "button" ? "Кнопка" : type,
        value: "",
        position: nextPos,
        data: defaultData(type),
      })
      .select("*")
      .single();

    setBusy(false);

    if (res.error) return setMsg(res.error.message);

    const row = res.data as any as BlockRow;
    setBlocks((p) => [...p, row].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    setActiveId(row.id);
  }

  async function deleteBlock(id: string) {
    setBusy(true);
    setMsg(null);
    const res = await supabase.from("taplink_blocks").delete().eq("id", id);
    setBusy(false);
    if (res.error) return setMsg(res.error.message);

    setBlocks((p) => p.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function updateActiveData(patch: any) {
    if (!active) return;
    const nextData = { ...(active.data ?? {}), ...patch };

    setBlocks((p) => p.map((b) => (b.id === active.id ? { ...b, data: nextData } : b)));

    setBusy(true);
    setMsg(null);
    const res = await supabase.from("taplink_blocks").update({ data: nextData }).eq("id", active.id);
    setBusy(false);
    if (res.error) setMsg(res.error.message);
  }

  async function reorderByIds(nextIds: string[]) {
    const map = new Map<string, BlockRow>();
    blocks.forEach((b) => map.set(b.id, b));

    const nextBlocks = nextIds.map((id, idx) => {
      const b = map.get(id)!;
      return { ...b, position: idx + 1 };
    });

    setBlocks(nextBlocks);

    // сохраняем позиции
    setBusy(true);
    setMsg(null);
    const payload = nextBlocks.map((b) => ({ id: b.id, position: b.position }));
    const res = await supabase.from("taplink_blocks").upsert(payload as any);
    setBusy(false);
    if (res.error) setMsg(res.error.message);
  }

  async function uploadToStorage(file: File, kind: "avatar" | "banner") {
    if (!pageId) return;
    setBusy(true);
    setMsg(null);

    const ext = file.name.split(".").pop() || "png";
    const path = `${pageId}/${kind}-${Date.now()}.${ext}`;

    const up = await supabase.storage.from("taplink-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (up.error) {
      setBusy(false);
      return setMsg(up.error.message);
    }

    const pub = supabase.storage.from("taplink-assets").getPublicUrl(path);
    const url = pub.data.publicUrl;

    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const upd = await supabase.from("pages1").update({ [col]: url }).eq("id", pageId).select("id,avatar_url,banner_url").single();

    setBusy(false);

    if (upd.error) return setMsg(upd.error.message);

    setPage((p) => ({ ...(p as any), ...(upd.data as any) }));
  }

  async function setLinkImage(url: string, kind: "avatar" | "banner") {
    if (!pageId) return;
    setBusy(true);
    setMsg(null);

    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const upd = await supabase.from("pages1").update({ [col]: url }).eq("id", pageId).select("id,avatar_url,banner_url").single();

    setBusy(false);

    if (upd.error) return setMsg(upd.error.message);

    setPage((p) => ({ ...(p as any), ...(upd.data as any) }));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">Редактор</div>
            <div className="text-xl font-semibold">{page?.title ?? "Taplink"}</div>
            <div className="mt-1 text-xs text-white/50">
              {page?.slug ? (
                <span>
                  Публичная ссылка:{" "}
                  <Link className="underline" href={`/${page.slug}`}>
                    /{page.slug}
                  </Link>
                </span>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
              Назад
            </Link>
            <button
              onClick={() => void loadAll()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              disabled={busy}
            >
              Обновить
            </button>
          </div>
        </div>

        {msg && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">{msg}</div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          {/* LEFT */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Блоки</div>
              <div className="text-xs text-white/50">Drag & Drop</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["button", "text", "image", "divider", "map"] as BlockType[]).map((t) => (
                <button
                  key={t}
                  disabled={busy}
                  onClick={() => void addBlock(t)}
                  className="rounded-2xl border border-white/15 bg-black px-3 py-2 text-sm hover:bg-white/10"
                >
                  + {t}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {blocks
                .slice()
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => (dragId.current = b.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = dragId.current;
                      const to = b.id;
                      if (!from || from === to) return;

                      const ids = blocks.map((x) => x.id);
                      const fromIndex = ids.indexOf(from);
                      const toIndex = ids.indexOf(to);

                      ids.splice(fromIndex, 1);
                      ids.splice(toIndex, 0, from);

                      dragId.current = null;
                      void reorderByIds(ids);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2",
                      activeId === b.id ? "border-white/40 bg-white/10" : "border-white/10 bg-black/20"
                    )}
                  >
                    <button onClick={() => setActiveId(b.id)} className="text-left flex-1">
                      <div className="text-sm font-medium">{b.type}</div>
                      <div className="text-xs text-white/50">#{b.position}</div>
                    </button>

                    <button
                      onClick={() => void deleteBlock(b.id)}
                      className="rounded-xl border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
                      disabled={busy}
                    >
                      удалить
                    </button>
                  </div>
                ))}

              {blocks.length === 0 && <div className="text-sm text-white/60">Пока нет блоков — добавь выше.</div>}
            </div>
          </section>

          {/* MIDDLE */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:col-span-4">
            <div className="text-sm font-semibold">Настройки</div>

            <div className="mt-3 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">Аватар и баннер</div>
                <div className="mt-3 grid gap-4">
                  <ImagePicker
                    title="Аватар"
                    currentUrl={page?.avatar_url ?? ""}
                    onPickFile={(f) => void uploadToStorage(f, "avatar")}
                    onPickLink={(u) => void setLinkImage(u, "avatar")}
                  />
                  <ImagePicker
                    title="Баннер"
                    currentUrl={page?.banner_url ?? ""}
                    onPickFile={(f) => void uploadToStorage(f, "banner")}
                    onPickLink={(u) => void setLinkImage(u, "banner")}
                  />
                </div>
              </div>

              {!active ? (
                <div className="text-sm text-white/60">Выбери блок слева.</div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold">Блок: {active.type}</div>

                  {active.type === "text" && (
                    <TextSettings data={ensureTextData(active.data)} onChange={(patch) => void updateActiveData(patch)} />
                  )}

                  {active.type === "button" && <ButtonSettings data={active.data ?? {}} onChange={(patch) => void updateActiveData(patch)} />}

                  {active.type !== "text" && active.type !== "button" && (
                    <div className="mt-3 text-sm text-white/60">Для этого блока настройки добавим позже (MVP).</div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:col-span-4">
            <div className="text-sm font-semibold">Превью</div>

            <div className="mt-3 rounded-3xl border border-white/10 bg-black p-4">
              <div className="h-28 w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                {page?.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.banner_url} alt="banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">Баннер</div>
                )}
              </div>

              <div className="-mt-8 flex items-end gap-3 px-2">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                  {page?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-white/40">Аватар</div>
                  )}
                </div>

                <div className="pb-2">
                  <div className="text-sm font-semibold">{page?.title ?? "Название"}</div>
                  <div className="text-xs text-white/60">Taplink by Tappo</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {blocks
                  .slice()
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                  .map((b) => (
                    <BlockPreview key={b.id} block={b} />
                  ))}

                {blocks.length === 0 && <div className="text-sm text-white/60">Добавь блоки слева.</div>}
              </div>
            </div>

            <div className="mt-3 text-xs text-white/50">Перетаскивай блоки мышкой в колонке «Блоки».</div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings components ---------------- */

function TextSettings({ data, onChange }: { data: any; onChange: (patch: any) => void }) {
  const text = data?.text ?? "";
  const style = data?.style ?? {};
  const align: Align = style?.align ?? "center";

  const baseBtn =
    "h-9 w-9 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 flex items-center justify-center";
  const activeBtn = "h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center";

  return (
    <div className="mt-3 space-y-4">
      <div>
        <div className="mb-2 text-xs text-white/60">Текст</div>
        <textarea
          className="min-h-[110px] w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-sm outline-none focus:ring-2 focus:ring-white/20"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Введите текст..."
        />
      </div>

      <div>
        <div className="mb-2 text-xs text-white/60">Выравнивание</div>
        <div className="flex gap-2">
          <button type="button" className={align === "left" ? activeBtn : baseBtn} onClick={() => onChange({ style: { ...style, align: "left" } })} title="Слева">
            ⬅
          </button>
          <button type="button" className={align === "center" ? activeBtn : baseBtn} onClick={() => onChange({ style: { ...style, align: "center" } })} title="По центру">
            ⬍
          </button>
          <button type="button" className={align === "right" ? activeBtn : baseBtn} onClick={() => onChange({ style: { ...style, align: "right" } })} title="Справа">
            ➡
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-2 text-xs text-white/60">Размер</div>
          <input
            className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
            value={style?.fontSize ?? "16px"}
            onChange={(e) => onChange({ style: { ...style, fontSize: e.target.value } })}
            placeholder="16px"
          />
        </div>
        <div>
          <div className="mb-2 text-xs text-white/60">Цвет</div>
          <input
            className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
            value={style?.color ?? "#ffffff"}
            onChange={(e) => onChange({ style: { ...style, color: e.target.value } })}
            placeholder="#ffffff"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-2 text-xs text-white/60">Шрифт</div>
          <input
            className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
            value={style?.fontFamily ?? "Inter"}
            onChange={(e) => onChange({ style: { ...style, fontFamily: e.target.value } })}
            placeholder="Inter"
          />
        </div>
        <div>
          <div className="mb-2 text-xs text-white/60">Насыщенность</div>
          <input
            className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
            value={style?.fontWeight ?? "400"}
            onChange={(e) => onChange({ style: { ...style, fontWeight: e.target.value } })}
            placeholder="400"
          />
        </div>
      </div>
    </div>
  );
}

function ButtonSettings({ data, onChange }: { data: any; onChange: (patch: any) => void }) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <div className="mb-2 text-xs text-white/60">Текст кнопки</div>
        <input
          className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
          value={data?.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Кнопка"
        />
      </div>
      <div>
        <div className="mb-2 text-xs text-white/60">Ссылка</div>
        <input
          className="h-10 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-sm outline-none"
          value={data?.url ?? ""}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

function ImagePicker({
  title,
  currentUrl,
  onPickFile,
  onPickLink,
}: {
  title: string;
  currentUrl: string;
  onPickFile: (file: File) => void;
  onPickLink: (url: string) => void;
}) {
  const [link, setLink] = useState("");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-white/40">нет</div>
          )}
        </div>

        <label className="cursor-pointer rounded-2xl border border-white/15 bg-black px-4 py-2 text-sm hover:bg-white/10">
          Загрузить файл
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
            }}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-xs text-white/60">Или вставь ссылку</div>
        <div className="flex gap-2">
          <input
            className="h-10 w-full rounded-2xl border border-white/15 bg-black/20 px-3 text-sm outline-none"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
          />
          <button
            type="button"
            className="rounded-2xl bg-white px-4 text-sm font-semibold text-black hover:opacity-90"
            onClick={() => {
              if (!link.trim()) return;
              onPickLink(link.trim());
              setLink("");
            }}
          >
            Ок
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Preview ---------------- */

function BlockPreview({ block }: { block: BlockRow }) {
  const d = block.data ?? {};

  if (block.type === "text") {
    const td = ensureTextData(d);
    const s = td.style;

    return (
      <div
        style={{
          color: s.color,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          fontFamily: s.fontFamily,
          textAlign: s.align,
          whiteSpace: "pre-wrap",
        }}
        className="text-sm"
      >
        {td.text}
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <a
        href={d?.url ?? "#"}
        className="flex h-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-black hover:opacity-90"
      >
        {d?.label ?? "Кнопка"}
      </a>
    );
  }

  if (block.type === "divider") {
    return <div className="h-px bg-white/15" />;
  }

  if (block.type === "image") {
    return <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />;
  }

  if (block.type === "map") {
    return <div className="h-24 rounded-2xl border border-white/10 bg-white/5" />;
  }

  return null;
}
