"use client";

import { useEffect, useState } from "react";
import { competitionPhase, type CompetitionPhase, type MyState } from "@juego/shared";

/**
 * Fase de la competencia (R94) calculada con el reloj del servidor (se corrige
 * el desfase con el del teléfono) y refrescada cada 15 segundos, para que el
 * aviso cambie solo cuando llega la hora de empezar o de terminar.
 * Quien manda es la base: esto sólo sirve para avisar y bloquear botones.
 */
export function useCompetition(state: MyState | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!state) {
    return { phase: "en_curso" as CompetitionPhase, paused: false, canScan: true, start: null, end: null };
  }
  const offset = new Date(state.now).getTime() - Date.now();
  const phase = competitionPhase(state.competition_start, state.competition_end, now + offset);
  const paused = !state.game_open;
  return {
    phase,
    paused,
    canScan: phase === "en_curso" && !paused,
    start: state.competition_start,
    end: state.competition_end,
  };
}
