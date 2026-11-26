"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Handshake, Sparkles, Star, Trophy, Users } from "lucide-react";
import { PLAYERS_PAGE_SIZE, type MyProgress, type PlayersPage } from "@juego/shared";
import { Pagination, pressableClass } from "@juego/shared/ui";
import { usePhotoUrls } from "@/lib/photos";
import { Avatar } from "./ui";

const REFRESH_MS = 10_000;

type Tab = "progreso" | "jugadores";
const TABS: readonly { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "progreso", label: "Mi progreso", icon: Sparkles },
  { id: "jugadores", label: "Jugadores", icon: Users },
];

/**
 * Parte de abajo de la pantalla principal (F49): reemplaza al ranking.
 * Dos pestañas: «Mi progreso» (encuentros y puntos, sin puesto) y
 * «Jugadores» (todos, sin puntaje, con páginas).
 */
export function HomeTabs({ supabase, playerId }: { supabase: SupabaseClient; playerId: string }) {
  const [tab, setTab] = useState<Tab>("progreso");
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ progreso: null, jugadores: null });

  // Flechas izquierda/derecha para moverse entre pestañas (patrón de tabs accesibles).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    refs.current[next]?.focus();
  }

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-sm">
      <div role="tablist" aria-label="Tu juego" onKeyDown={onKeyDown} className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${pressableClass} ${
                on ? "bg-surface text-brand shadow-sm" : "text-muted active:bg-brand-soft"
              }`}
            >
              <Icon size={18} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "progreso" ? <MyProgressPanel supabase={supabase} /> : <PlayersPanel supabase={supabase} playerId={playerId} />}
      </div>
    </section>
  );
}

/** Mensaje según el tramo: sólo «entre los primeros 10/50», nunca el puesto (F49). */
export function progressMessage(progress: MyProgress | null): { text: string; highlight: boolean } {
  if (progress?.tier === "top10") return { text: "¡Estás entre los primeros 10!", highlight: true };
  if (progress?.tier === "top50") return { text: "¡Estás entre los primeros 50!", highlight: true };
  return { text: "Conocé a más gente de Vortex y sumá puntos", highlight: false };
}

/** Texto que entra palabra por palabra. Sin animación si el teléfono pide menos movimiento. */
function AnimatedText({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p key={text} className={className} aria-live="polite">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} className="word-in" style={{ animationDelay: `${i * 90}ms` }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </p>
  );
}

function MyProgressPanel({ supabase }: { supabase: SupabaseClient }) {
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error } = await supabase.rpc("get_my_progress");
      if (!alive) return;
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setProgress(data as MyProgress);
    }
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [supabase]);

  const msg = progressMessage(progress);
  const Icon = msg.highlight ? Trophy : Sparkles;

  return (
    <div>
      <div
        className={`mb-4 flex items-center gap-3 rounded-2xl px-4 py-4 ${
          msg.highlight ? "bg-gradient-to-r from-brand to-brand-strong text-white" : "bg-brand-soft text-ink"
        }`}
      >
        <Icon size={28} aria-hidden className={`shrink-0 ${msg.highlight ? "text-white" : "text-brand"} ${msg.highlight ? "pop-in" : ""}`} />
        <AnimatedText text={msg.text} className="text-lg font-bold leading-snug" />
      </div>

      {failed && !progress && <p className="py-4 text-center text-sm text-muted">No pudimos cargar tu progreso.</p>}

      <dl className="grid grid-cols-2 gap-3">
        <Stat icon={Handshake} label="Encuentros" value={progress?.encounters} />
        <Stat icon={Star} label="Puntos" value={progress?.points} />
      </dl>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-canvas px-4 py-3">
      <dt className="flex items-center gap-1.5 text-sm text-muted">
        <Icon size={16} aria-hidden className="text-brand" />
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-extrabold tabular-nums">{value ?? "–"}</dd>
    </div>
  );
}

function PlayersPanel({ supabase, playerId }: { supabase: SupabaseClient; playerId: string }) {
  const [data, setData] = useState<PlayersPage | null>(null);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const photos = usePhotoUrls(data?.rows.map((r) => r.photo_path) ?? []);

  const load = useCallback(
    async (p: number) => {
      const { data: res, error } = await supabase.rpc("get_players_page", { p_page: p, p_page_size: PLAYERS_PAGE_SIZE });
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setData(res as PlayersPage);
    },
    [supabase],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  function goTo(p: number) {
    setPage(p);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div ref={listRef} className="scroll-mt-4">
      {data && (
        <p className="mb-2 text-sm text-muted">
          {data.total} {data.total === 1 ? "jugador" : "jugadores"}
        </p>
      )}
      {failed && !data && <p className="py-6 text-center text-sm text-muted">No pudimos cargar los jugadores.</p>}
      {!data && !failed && <p className="py-6 text-center text-sm text-muted">Cargando…</p>}
      {data && data.rows.length === 0 && <p className="py-6 text-center text-sm text-muted">Todavía no hay jugadores.</p>}

      {data && data.rows.length > 0 && (
        <ul className="flex flex-col">
          {data.rows.map((r) => {
            const me = r.player_id === playerId;
            return (
              <li key={r.player_id} className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${me ? "bg-brand-soft" : ""}`}>
                <Avatar firstName={r.first_name} lastName={r.last_name} url={r.photo_path ? photos[r.photo_path] : null} size={40} />
                <span className="min-w-0 flex-1 truncate">
                  {r.first_name} {r.last_name}
                  {me && <span className="ml-1 text-sm text-brand">(vos)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goTo} label="Páginas de jugadores" className="mt-4" />
    </div>
  );
}
