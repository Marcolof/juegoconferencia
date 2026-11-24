"use client";

import { CalendarClock, Flag, PauseCircle } from "lucide-react";
import { formatCompetitionDate, type CompetitionPhase } from "@juego/shared";

/**
 * Estado del juego (R94, R96): «aún no inició», «terminó» o «en pausa». No se
 * muestra mientras el juego está en curso y sin pausa: ahí se ven las opciones
 * para jugar.
 */
export function CompetitionNotice({
  phase,
  paused,
  start,
  end,
}: {
  phase: CompetitionPhase;
  paused: boolean;
  start: string | null;
  end: string | null;
}) {
  if (phase === "en_curso" && !paused) return null;

  let Icon = CalendarClock;
  let title = "";
  let detail = "";
  if (phase === "antes") {
    title = "El juego aún no inició";
    detail = start
      ? `Va a empezar el ${formatCompetitionDate(start)} (hora de Argentina). Cuando empiece vas a ver acá las opciones para jugar. Mientras tanto, podés editar tus preguntas.`
      : "La organización lo va a lanzar en breve. Cuando empiece vas a ver acá las opciones para jugar. Mientras tanto, podés editar tus preguntas.";
  } else if (phase === "terminada") {
    Icon = Flag;
    title = "El juego terminó";
    detail = end
      ? `Terminó el ${formatCompetitionDate(end)}. Ya no se pueden escanear más QR; el ranking queda como está.`
      : "Ya no se pueden escanear más QR; el ranking queda como está.";
  } else {
    Icon = PauseCircle;
    title = "Los encuentros están en pausa";
    detail = "La organización los pausó un momento. Enseguida se retoman.";
  }

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-ink">
      <Icon size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}
