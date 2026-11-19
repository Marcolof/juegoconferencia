"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYER_RANKING_TOP, type MyRanking, type RankingRow } from "@juego/shared";
import { usePhotoUrls } from "@/lib/photos";
import { Avatar } from "./ui";

const REFRESH_MS = 10_000;

/** Top 10 más la posición propia (P76). Se actualiza solo cada 10 segundos. */
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

  return (
    <section aria-labelledby="ranking-titulo" className="rounded-3xl bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="ranking-titulo" className="text-lg font-bold">
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
      {rows && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">Todavía no hay jugadores.</p>
      )}

      {rows && rows.length > 0 && (
        <ol className="flex flex-col">
          {rows.map((r) => {
            const me = r.player_id === playerId;
            return (
              <li
                key={r.player_id}
                className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${me ? "bg-brand-soft" : ""}`}
              >
                <span className="w-7 text-center text-sm font-bold text-muted">{r.place}</span>
                <Avatar
                  firstName={r.first_name}
                  lastName={r.last_name}
                  url={r.photo_path ? photos[r.photo_path] : null}
                  size={36}
                />
                <span className="flex-1 truncate">
                  {r.first_name} {r.last_name}
                  {me && <span className="ml-1 text-sm text-brand">(vos)</span>}
                </span>
                <span className="font-bold tabular-nums">{r.points}</span>
              </li>
            );
          })}
        </ol>
      )}

      {mine && !iAmInTop && rows && rows.length > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-sm">
          Tu puesto: <strong>{mine.place ?? "—"}</strong> · {mine.points} {mine.points === 1 ? "punto" : "puntos"}
        </p>
      )}
    </section>
  );
}
