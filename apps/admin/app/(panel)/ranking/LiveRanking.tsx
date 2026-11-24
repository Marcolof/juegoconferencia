"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { PHOTOS_BUCKET, type RankingRow } from "@juego/shared";
import { getBrowserClient } from "@/lib/supabase-browser";
import { buttonClass } from "@juego/shared/ui";
import { Initials } from "@/components/ui";

const REFRESH_MS = 5000;

/** Ranking completo en vivo (R74). Se actualiza cada 5 segundos. */
export function LiveRanking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [updated, setUpdated] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [big, setBig] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let alive = true;
    const known = new Set<string>();

    async function load() {
      const { data, error } = await supabase!.rpc("get_ranking", { p_limit: null });
      if (!alive) return;
      if (error) {
        setFailed(true);
        return;
      }
      const list = data as RankingRow[];
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

  return (
    <div className={big ? "fixed inset-0 z-50 overflow-auto bg-canvas p-8" : ""}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {big && <h1 className="flex-1 text-4xl font-extrabold">Ranking</h1>}
        <p className={`text-sm text-muted ${big ? "" : "flex-1"}`} aria-live="polite">
          {failed
            ? "No se pudo actualizar. Reintentando…"
            : updated
              ? `Actualizado ${updated.toLocaleTimeString("es-AR")}`
              : "Cargando…"}
        </p>
        <button
          onClick={() => setBig((b) => !b)}
          className={buttonClass({ variant: "secondary" })}
        >
          {big ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          {big ? "Salir de pantalla grande" : "Pantalla grande"}
        </button>
      </div>

      {rows && rows.length === 0 && <p className="py-10 text-center text-muted">Todavía no hay jugadores.</p>}

      {rows && rows.length > 0 && (
        <ol className={`grid gap-2 ${big ? "md:grid-cols-2 text-xl" : ""}`}>
          {rows.map((r) => (
            <li key={r.player_id} className="flex items-center gap-4 rounded-2xl bg-surface px-4 py-3 shadow-sm">
              <span className={`w-10 text-center font-extrabold ${r.place <= 3 ? "text-brand" : "text-muted"}`}>
                {r.place}
              </span>
              <Initials
                firstName={r.first_name}
                lastName={r.last_name}
                url={r.photo_path ? photos[r.photo_path] : null}
                size={big ? 52 : 40}
              />
              <span className="flex-1 truncate font-medium">
                {r.first_name} {r.last_name}
              </span>
              <span className="font-extrabold tabular-nums">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
