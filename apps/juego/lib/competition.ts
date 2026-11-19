"use client";

import { useEffect, useState } from "react";
import { competitionPhase, type CompetitionPhase, type MyState } from "@juego/shared";

const RELOAD_MS = 10_000;

/**
 * Fase de la competencia (R94, R96) calculada con el reloj del servidor (se
 * corrige el desfase con el del teléfono) y refrescada cada 15 segundos, para
 * que el aviso cambie solo cuando llega la hora de empezar o de terminar.
 *
 * Si el juego todavía no empezó, además vuelve a pedir el estado cada 10
 * segundos: así, cuando el administrador lo lanza, el jugador lo ve sin
 * recargar la página. Quien manda es la base: esto sólo sirve para avisar y
 * bloquear botones.
 */
export function useCompetition(state: MyState | null, reload?: () => Promise<unknown>) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const offset = state ? new Date(state.now).getTime() - Date.now() : 0;
  const phase: CompetitionPhase = state
    ? competitionPhase(state.competition_start, state.competition_end, now + offset)
    : "en_curso";
  const paused = state ? !state.game_open : false;
  const waiting = !!state && (phase === "antes" || paused);

  useEffect(() => {
    if (!waiting || !reload) return;
    const t = setInterval(() => void reload(), RELOAD_MS);
    return () => clearInterval(t);
  }, [waiting, reload]);

  return {
    phase,
    paused,
    canScan: phase === "en_curso" && !paused,
    start: state?.competition_start ?? null,
    end: state?.competition_end ?? null,
  };
}
