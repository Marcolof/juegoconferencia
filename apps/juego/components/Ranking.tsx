"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronRight, Trophy } from "lucide-react";
import { PLAYER_RANKING_TOP, type MyRanking, type RankingRow } from "@juego/shared";
import { usePhotoUrls } from "@/lib/photos";
import { Avatar } from "./ui";

const REFRESH_MS = 10_000;

/** Una fila del ranking. La usan la principal y la pantalla del ranking completo. */
export function RankingItem({
  row,
  photoUrl,
  isMe,
}: {
  row: RankingRow;
  photoUrl?: string | null;
  isMe: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${isMe ? "bg-brand-soft" : ""}`}>
      <span className="w-8 text-center text-sm font-bold tabular-nums text-muted">{row.place}</span>
      <Avatar firstName={row.first_name} lastName={row.last_name} url={photoUrl} size={36} />
      <span className="min-w-0 flex-1 truncate">
        {row.first_name} {row.last_name}
        {isMe && <span className="ml-1 text-sm text-brand">(vos)</span>}
      </span>
      <span className="font-bold tabular-nums">{row.points}</span>
    </li>
  );
}

/** Tarjeta con el puesto propio. */
export function MyPlace({ mine }: { mine: MyRanking }) {
  return (
    <p className="text-sm">
      Tu puesto: <strong>{mine.place ?? "—"}</strong> de {mine.total_players} · {mine.points}{" "}
      {mine.points === 1 ? "punto" : "puntos"}
    </p>
  );
}

/**
 * Ranking de la principal: los primeros 8 y el puesto propio (R85). El
 * listado completo está en /ranking. Se actualiza solo cada 10 segundos.
 */
export function Ranking({ supabase, playerId }: { supabase: SupabaseClient; playerId: string }) {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [mine, setMine] = useState<MyRanking | null>(null);
  const [failed, setFailed] = useState(false);
  const photos = usePhotoUrls(rows?.map((r) => r.photo_path) ?? []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [top, me] = await Promise.all([
        supabase.rpc("get_ranking", { p_limit: PLAYER_RANKING_TOP }),
        supabase.rpc("get_my_ranking"),
      ]);
      if (!alive) return;
      if (top.error || me.error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setRows(top.data as RankingRow[]);
      setMine(me.data as MyRanking);
    }
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [supabase]);

  const iAmInTop = rows?.some((r) => r.player_id === playerId);
  const hasMore = !!mine && !!rows && mine.total_players > rows.length;

  return (
    <section aria-labelledby="ranking-titulo" className="rounded-3xl bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="ranking-titulo" className="flex items-center gap-2 text-lg font-bold">
          <Trophy size={20} className="text-brand" aria-hidden />
          Ranking
        </h2>
        {mine && (
          <span className="text-sm text-muted">
            {mine.total_players} {mine.total_players === 1 ? "jugador" : "jugadores"}
          </span>
        )}
      </div>

      {failed && !rows && <p className="py-6 text-center text-sm text-muted">No pudimos cargar el ranking.</p>}
      {!rows && !failed && <p className="py-6 text-center text-sm text-muted">Cargando…</p>}
      {rows && rows.length === 0 && <p className="py-6 text-center text-sm text-muted">Todavía no hay jugadores.</p>}

      {rows && rows.length > 0 && (
        <ol className="flex flex-col">
          {rows.map((r) => (
            <RankingItem
              key={r.player_id}
              row={r}
              photoUrl={r.photo_path ? photos[r.photo_path] : null}
              isMe={r.player_id === playerId}
            />
          ))}
        </ol>
      )}

      {mine && !iAmInTop && rows && rows.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <MyPlace mine={mine} />
        </div>
      )}

      {hasMore && (
        <Link
          href="/ranking"
          className="mt-3 flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-brand-soft text-sm font-semibold text-brand transition active:bg-brand/20"
        >
          Ver ranking completo
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}
    </section>
  );
}
