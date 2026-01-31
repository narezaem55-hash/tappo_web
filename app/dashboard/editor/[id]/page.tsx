"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ⚠️ ВАЖНО: подстрой импорт под твой проект.
// У тебя в lib точно есть supabase-клиент. Если файл называется иначе — поменяй 1 строку.
import { supabase } from "@/lib/supabase"; // <- если у тебя другой путь/экспорт, поправь тут

type BlockType = "button" | "text" | "image" | "divider" | "map";
type Align = "left" | "center" | "right";

type Taplink = {
  id: string;
  name?: string;
  slug?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
};

type TaplinkBlock = {
  id: string;
  taplink_id: string;
  type: BlockType;
  order: number;
  data: any;
};

function cn(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

function defaultBlockData(type: BlockType) {
  switch (type) {
    case "button":
      return { label: "Кнопка", url: "https://example.com", style: { variant: "dark" } };
    case "text":
      return {
        text: "Текст",
        style: {
          fontFamily: "Inter",
          fontSize: "16px",
          fontWeight: "400",
          color: "#ffffff",
          align: "center" as Align,
        },
      };
    case "image":
      return { url: "", alt: "Изображение" };
    case "divider":
      return { style: { type: "line" } };
    case "map":
      return { title: "Мы на карте", address: "Москва", lat: 55.751244, lng: 37.618423 };
    default:
      return {};
  }
}

/**
 * ✅ ПРЕДУСЛОВИЯ В SUPABASE (коротко):
 * 1) Таблица taplinks должна иметь колонки avatar_url, banner_url (см. SQL ниже).
 * 2) В Storage создать bucket: taplink-assets (public).
 *
 * SQL (в Supabase SQL editor):
 * alter table public.taplinks add column if not exists avatar_url text;
 * alter table public.taplinks add column if not exists banner_url text;
 *
 * Storage:
 * - создаёшь bucket "taplink-assets" и ставишь Public = ON
 */

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const taplinkId = params?.id;

  const [taplink, setTaplink] = useState<Taplink | null>(null);
  const [blocks, setBlocks] = useState<TaplinkBlock[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => blocks.find((b) => b.id === activeId) ?? null, [blocks, activeId]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // DnD
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    if (!taplinkId) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taplinkId]);

  async function loadAll() {
    setMsg(null);
    // taplink
    const tl = await supabase.from("taplinks").select("id,name,slug,avatar_url,banner_url").eq("id", taplinkId).maybeSingle();
    if (tl.error) setMsg(tl.error.message);
    setTaplink((tl.data as any) ?? null);

    // blocks
    const bl = await supabase.from("taplink_blocks").select("*").eq("taplink_id", taplinkId).order("order", { ascending: true });
    if (bl.error) setMsg(bl.error.message);
    const data = (bl.data as any[]) ?? [];
    setBlocks(data);
    setActiveId(data?.[0]?.id ?? null);
  }

  async function addBlock(type: BlockType) {
    if (!taplinkId) return;
    setBusy(true);
    setMsg(null);

    const nextOrder = blocks.length ? Math.max(...blocks.map((b) => b.order)) + 1 : 1;

    const res = await supabase
      .from("taplink_blocks")
      .insert({ taplink_id: taplinkId, type, order: nextOrder, data: defaultBlockData(type) })
      .select("*")
      .single();

    setBusy(false);

    if (res.error) return setMsg(res.error.message);

    const nb = res.data as any as TaplinkBlock;
    setBlocks((p) => [...p, nb].sort((a, b) => a.order - b.order));
    setActiveId(nb.id);
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

  // ✅ обновление data блока
  async function updateActiveData(patch: any) {
    if (!active) return;
    const nextData = { ...(active.data ?? {}), ...patch };

    // оптимистично
    setBlocks((p) => p.map((b) => (b.id === active.id ? { ...b, data: nextData } : b)));

    setBusy(true);
    setMsg(null);
    const res = await supabase.from("taplink_blocks").update({ data: nextData }).eq("id", active.id);
    setBusy(false);
    if (res.error) setMsg(res.error.message);
  }

  // ✅ Drag & Drop reorder (через пересчёт order)
  async function reorderByIds(nextIds: string[]) {
    const map = new Map<string, TaplinkBlock>();
    blocks.forEach((b) => map.set(b.id, b));

    const nextBlocks = nextIds
      .map((id, idx) => {
        const b = map.get(id)!;
        return { ...b, order: idx + 1 };
      })
      .filter(Boolean);

    setBlocks(nextBlocks);

    // сохраняем в базу
    setBusy(true);
    setMsg(null);
    const payload = nextBlocks.map((b) => ({ id: b.id, order: b.order }));
    const res = await supabase.from("taplink_blocks").upsert(payload as any);
    setBusy(false);
    if (res.error) setMsg(res.error.message);
  }

  // ✅ Upload avatar/banner (файл -> Supabase Storage -> URL -> taplinks.avatar_url/banner_url)
  async function uploadToStorage(file: File, kind: "avatar" | "banner") {
    if (!taplinkId) return null;
    setBusy(true);
    setMsg(null);

    const ext = file.name.split(".").pop() || "png";
    const path = `${taplinkId}/${kind}-${Date.now()}.${ext}`;

    const up = await supabase.storage.from("taplink-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (up.error) {
      setBusy(false);
      setMsg(up.error.message);
      return null;
    }

    // public url (bucket должен быть public)
    const pub = supabase.storage.from("taplink-assets").getPublicUrl(path);
    const url = pub.data.publicUrl;

    // save to taplinks
    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const upd = await supabase.from("taplinks").update({ [col]: url }).eq("id", taplinkId).select("id,avatar_url,banner_url").single();

    setBusy(false);

    if (upd.error) {
      setMsg(upd.error.message);
      return null;
    }

    setTaplink((p) => ({ ...(p as any), ...(upd.data as any) }));
    return url;
  }

  async function setLinkImage(url: string, kind: "avatar" | "banner") {
    if (!taplinkId) return;
    setBusy(true);
    setMsg(null);
    const col = kind === "avatar" ? "avatar_url" : "banner_url";
    const upd = await supabase.from("taplinks").update({ [col]: url }).eq("id", taplinkId).select("id,avatar_url,banner_url").single();
    setBusy(false);
    if (upd.error) return setMsg(upd.error.message);
    setTaplink((p) => ({ ...(p as any), ...(upd.data as any) }));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">Редактор</div>
            <div className="text-xl font-semibold">{taplink?.name ?? "Taplink"}</div>
            <div className="mt-1 text-xs text-white/50">
              {taplink?.slug ? (
                <span>
                  Публичная ссылка:{" "}
                  <Link className="underline" href={`/${taplink.slug}`}>
                    /{taplink.slug}
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
          {/* LEFT: blocks list */}
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
              {blocks.map((b) => (
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
                    <div className="text-xs text-white/50">#{b.order}</div>
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

              {blocks.length === 0 && <div className="text-sm text-white/60">Пока нет блоков — добавь справа.</div>}
            </div>
          </section>

          {/* MIDDLE: settings */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:col-span-4">
            <div className="text-sm font-semibold">Настройки</div>
            <div className="mt-3 space-y-4">
              {/* Avatar + Banner */}
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">Аватар и баннер</div>
                <div className="mt-3 grid gap-4">
                  <ImagePicker
                    title="Аватар"
                    currentUrl={taplink?.avatar_url ?? ""}
                    onPickFile={(f) => void uploadToStorage(f, "avatar")}
                    onPickLink={(u) => void setLinkImage(u, "avatar")}
                  />
                  <ImagePicker
                    title="Баннер"
                    currentUrl={taplink?.banner_url ?? ""}
                    onPickFile={(f) => void uploadToStorage(f, "banner")}
                    onPickLink={(u) => void setLinkImage(u, "banner")}
                  />
                </div>
              </div>

              {/* Active block settings */}
              {!active ? (
                <div className="text-sm text-white/60">Выбери блок слева.</div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold">Блок: {active.type}</div>

                  {active.type === "text" && (
                    <TextSettings
                      data={active.data}
                      onChange={(patch) => void updateActiveData(patch)}
                    />
                  )}

                  {active.type === "button" && (
                    <ButtonSettings
                      data={active.data}
                      onChange={(patch) => void updateActiveData(patch)}
                    />
                  )}

                  {active.type !== "text" && active.type !== "button" && (
                    <div className="mt-3 text-sm text-white/60">
                      Для этого блока настройки добавим позже (MVP).
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: preview */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 lg:col-span-4">
            <div className="text-sm font-semibold">Превью</div>

            <div className="mt-3 rounded-3xl border border-white/10 bg-black p-4">
              {/* banner */}
              <div className="h-28 w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                {taplink?.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={taplink.banner_url} alt="banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">Баннер</div>
                )}
              </div>

              <div className="-mt-8 flex items-end gap-3 px-2">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                  {taplink?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={taplink.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">Аватар</div>
                  )}
                </div>

                <div className="pb-2">
                  <div className="text-sm font-semibold">{taplink?.name ?? "Название"}</div>
                  <div className="text-xs text-white/60">Taplink by Tappo</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {blocks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((b) => (
                    <BlockPreview key={b.id} block={b} />
                  ))}

                {blocks.length === 0 && <div className="text-sm text-white/60">Добавь блоки слева.</div>}
              </div>
            </div>

            <div className="mt-3 text-xs text-white/50">
              Перетаскивай блоки мышкой в колонке «Блоки».
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Settings UI ------------------------- */

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

/* ------------------------- Preview ------------------------- */

function BlockPreview({ block }: { block: TaplinkBlock }) {
  const d = block.data ?? {};

  if (block.type === "text") {
    const style = d?.style ?? {};
    const align: Align = style?.align ?? "center";

    return (
      <div
        style={{
          color: style?.color ?? "#ffffff",
          fontSize: style?.fontSize ?? "16px",
          fontWeight: style?.fontWeight ?? "400",
          fontFamily: style?.fontFamily ?? "inherit",
          textAlign: align,
          whiteSpace: "pre-wrap",
        }}
        className="text-sm"
      >
        {d?.text ?? "Текст"}
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
