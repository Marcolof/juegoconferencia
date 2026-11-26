"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, ListOrdered, Maximize2, Minimize2, Search, Shuffle, X, type LucideIcon } from "lucide-react";
import { PHOTOS_BUCKET, type RankingMode, type StandingRow } from "@juego/shared";
import { buttonClass, pressableClass } from "@juego/shared/ui";
import { getBrowserClient } from "@/lib/supabase-browser";
import { Initials } from "@/components/ui";
import { RANKING_MODES, groupStandings, isRankingMode, matchesSearch, shuffledStable } from "@/lib/ranking-view";

const REFRESH_MS = 5000;
const MODE_KEY = "admin:ranking-modo";
const MODE_ICONS: Record<RankingMode, LucideIcon> = {
  participantes: Shuffle,
  grupos: Layers,
  ranking: ListOrdered,
};

function readMode(): RankingMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (isRankingMode(saved)) return saved;
  } catch {
    /* sin almacenamiento: modo por defecto */
  }
  return "ranking";
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Ranking en vivo del panel (R74, F49) con tres modos y búsqueda:
 * - Participantes: todos al azar, sin puntaje ni encuentros.
 * - Por grupos: Top 10, Top 20, Top 50 y el resto, con foto, nombre y encuentros.
 * - Ranking: puesto, encuentros y puntaje.
 * Se actualiza cada 5 segundos. El modo elegido se recuerda en este navegador.
 */
export function LiveRanking() {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [updated, setUpdated] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [big, setBig] = useState(false);
  const [mode, setMode] = useState<RankingMode>("ranking");
  const [query, setQuery] = useState("");
  const shuffleKeys = useRef(new Map<string, number>());

  useEffect(() => setMode(readMode()), []);

  function changeMode(next: RankingMode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
  }

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let alive = true;
    const known = new Set<string>();

    async function load() {
      const { data, error } = await supabase!.rpc("get_admin_ranking");
      if (!alive) return;
      if (error) {
        setFailed(true);
        return;
      }
      const list = (data as StandingRow[]).map((r) => ({
        ...r,
        ord: Number(r.ord),
        place: Number(r.place),
        points: Number(r.points),
        encounters: Number(r.encounters),
      }));
      setFailed(false);
      setRows(list);
      setUpdated(new Date());
      const missing = list.map((r) => r.photo_path).filter((p): p is string => !!p && !known.has(p));
      if (missing.length) {
        missing.forEach((p) => known.add(p));
        const { data: signed } = await supabase!.storage.from(PHOTOS_BUCKET).createSignedUrls(missing, 3600);
        if (alive && signed) {
          setPhotos((prev) => {
            const next = { ...prev };
            for (const s of signed) if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
            return next;
          });
        }
      }
    }

    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => matchesSearch(r, query)), [rows, query]);
  const shuffled = useMemo(() => shuffledStable(filtered, shuffleKeys.current), [filtered]);
  const groups = useMemo(() => groupStandings(rows ?? [], query), [rows, query]);
  const photoOf = (r: StandingRow) => (r.photo_path ? photos[r.photo_path] : null);
  const avatar = big ? 56 : 44;

  return (
    <div className={big ? "fixed inset-0 z-50 overflow-auto bg-canvas p-8" : ""}>
      {big && <h1 className="mb-4 text-4xl font-extrabold">Ranking</h1>}

      {/* Controles: búsqueda, modo y pantalla grande */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar jugador</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o apellido"
            className="min-h-10 w-full rounded-lg border border-line bg-surface pl-10 pr-10 outline-none focus:border-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar búsqueda"
              className={`absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-canvas ${pressableClass}`}
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </label>

        <div role="radiogroup" aria-label="Modo de visualización" className="flex rounded-lg bg-surface p-1 ring-1 ring-line">
          {RANKING_MODES.map((m) => {
            const Icon = MODE_ICONS[m.id];
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={m.hint}
                onClick={() => changeMode(m.id)}
                className={`flex min-h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold ${pressableClass} ${
                  on ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                <Icon size={16} aria-hidden />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        <button onClick={() => setBig((b) => !b)} className={buttonClass({ variant: "secondary" })}>
          {big ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          {big ? "Salir de pantalla grande" : "Pantalla grande"}
        </button>
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {RANKING_MODES.find((m) => m.id === mode)?.hint} ·{" "}
        {failed
          ? "No se pudo actualizar. Reintentando…"
          : updated
            ? `Actualizado ${updated.toLocaleTimeString("es-AR")}`
            : "Cargando…"}
      </p>

      {rows && rows.length === 0 && <p className="py-10 text-center text-muted">Todavía no hay jugadores.</p>}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="py-10 text-center text-muted">Nadie coincide con «{query}».</p>
      )}

      {/* A · Participantes: al azar, sólo foto y nombre */}
      {mode === "participantes" && filtered.length > 0 && (
        <>
          <p className="mb-3 font-semibold">{plural(filtered.length, "participante", "participantes")}</p>
          <ul className={`grid gap-3 ${big ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-5 text-xl" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
            {shuffled.map((r) => (
              <li key={r.player_id} className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4 text-center shadow-sm">
                <Initials firstName={r.first_name} lastName={r.last_name} url={photoOf(r)} size={big ? 88 : 64} />
                <span className="line-clamp-2 font-medium">
                  {r.first_name} {r.last_name}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* B · Por grupos: sin puesto exacto, con encuentros */}
      {mode === "grupos" && filtered.length > 0 && (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
              <div className="mb-2 flex items-baseline gap-3">
                <h2 id={`grupo-${g.id}`} className={`font-extrabold ${big ? "text-3xl" : "text-xl"} ${g.id === "top10" ? "text-brand" : ""}`}>
                  {g.label}
                </h2>
                <span className="text-sm text-muted">
                  {g.detail} · {plural(g.rows.length, "jugador", "jugadores")}
                </span>
              </div>
              <ul className={`grid gap-2 ${big ? "md:grid-cols-2 xl:grid-cols-3 text-xl" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {g.rows.map((r) => (
                  <li key={r.player_id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sm">
                    <Initials firstName={r.first_name} lastName={r.last_name} url={photoOf(r)} size={avatar} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{plural(r.encounters, "encuentro", "encuentros")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* C · Ranking: puesto, encuentros y puntaje */}
      {mode === "ranking" && filtered.length > 0 && (
        <>
          <div className={`mb-1 hidden items-center gap-4 px-4 text-xs font-semibold uppercase tracking-wide text-muted sm:flex ${big ? "text-sm" : ""}`} aria-hidden>
            <span className="w-10 text-center">#</span>
            <span style={{ width: avatar }} />
            <span className="flex-1">Jugador</span>
            <span className="w-24 text-right">Encuentros</span>
            <span className="w-16 text-right">Puntos</span>
          </div>
          <ol className={`grid gap-2 ${big ? "text-xl" : ""}`}>
            {filtered.map((r) => (
              <li key={r.player_id} className="flex items-center gap-4 rounded-2xl bg-surface px-4 py-3 shadow-sm">
                <span className={`w-10 text-center font-extrabold ${r.place <= 3 && r.points > 0 ? "text-brand" : "text-muted"}`}>
                  {r.place}
                </span>
                <Initials firstName={r.first_name} lastName={r.last_name} url={photoOf(r)} size={avatar} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.first_name} {r.last_name}
                </span>
                <span className="w-24 text-right tabular-nums text-muted">
                  <span className="sm:hidden">{plural(r.encounters, "encuentro", "encuentros")}</span>
                  <span className="hidden sm:inline">{r.encounters}</span>
                </span>
                <span className="w-16 text-right font-extrabold tabular-nums">{r.points}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
