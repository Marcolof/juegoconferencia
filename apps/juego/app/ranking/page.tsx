"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { RANKING_PAGE_SIZE, type MyRanking, type RankingPage } from "@juego/shared";
import { Pagination } from "@juego/shared/ui";
import { usePlayer } from "@/lib/player";
import { usePhotoUrls } from "@/lib/photos";
import { MyPlace, RankingItem } from "@/components/Ranking";
import { PlayerGate, Screen, Spinner } from "@/components/ui";

const REFRESH_MS = 15_000;
const SEARCH_DELAY_MS = 300;

/**
 * Ranking completo (F35, R86): todos los jugadores, de a 20 por página, con
 * búsqueda por nombre. El puesto que se muestra es el del ranking general.
 */
export default function RankingCompletoPage() {
  const { state, status, supabase } = usePlayer("ready");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RankingPage | null>(null);
  const [mine, setMine] = useState<MyRanking | null>(null);
  const [failed, setFailed] = useState(false);
  const listTop = useRef<HTMLDivElement>(null);
  const photos = usePhotoUrls(data?.rows.map((r) => r.photo_path) ?? []);

  // Espera a que deje de escribir antes de buscar, y vuelve a la página 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [res, me] = await Promise.all([
      supabase.rpc("get_ranking_page", { p_search: search || null, p_page: page, p_page_size: RANKING_PAGE_SIZE }),
      supabase.rpc("get_my_ranking"),
    ]);
    if (res.error) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setData(res.data as RankingPage);
    if (!me.error) setMine(me.data as MyRanking);
  }, [supabase, search, page]);

  useEffect(() => {
    if (status !== "ok") return;
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [status, load]);

  if (status !== "ok" || !state || !supabase) return <PlayerGate status={status} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  function changePage(p: number) {
    setPage(p);
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Screen title="Ranking" back="/">
      {mine && (
        <div className="mb-4 rounded-2xl bg-brand-soft px-4 py-3">
          <MyPlace mine={mine} />
        </div>
      )}

      <div ref={listTop} className="relative mb-4 scroll-mt-4">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar por nombre"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-11 text-base outline-none focus:border-brand [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Borrar la búsqueda"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted outline-none transition hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand active:bg-brand-soft"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <section aria-label="Listado del ranking" className="rounded-3xl bg-surface p-3 shadow-sm">
        {!data && !failed && <Spinner />}
        {failed && !data && <p className="py-8 text-center text-sm text-muted">No pudimos cargar el ranking.</p>}
        {data && data.rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {search ? `No encontramos a nadie con «${search}».` : "Todavía no hay jugadores."}
          </p>
        )}
        {data && data.rows.length > 0 && (
          <>
            <p className="mb-2 px-2 text-xs text-muted" aria-live="polite">
              {search
                ? `${data.total} ${data.total === 1 ? "resultado" : "resultados"}`
                : `${data.total} ${data.total === 1 ? "jugador" : "jugadores"}`}
              {totalPages > 1 && ` · página ${data.page} de ${totalPages}`}
            </p>
            <ol className="flex flex-col">
              {data.rows.map((r) => (
                <RankingItem
                  key={r.player_id}
                  row={r}
                  photoUrl={r.photo_path ? photos[r.photo_path] : null}
                  isMe={r.player_id === state.id}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Páginas del ranking" className="mt-5" />
    </Screen>
  );
}
