"use client";

import { CalendarClock, Flag, PauseCircle } from "lucide-react";
import { formatCompetitionDate, type CompetitionPhase } from "@juego/shared";

/**
 * Aviso de la fase de la competencia (R94). No se muestra mientras está en
 * curso y sin pausa. `compact` lo deja en una línea para la pantalla principal.
 */
export function CompetitionNotice({
  phase,
  paused,
  start,
  end,
  compact = false,
}: {
  phase: CompetitionPhase;
  paused: boolean;
  start: string | null;
  end: string | null;
  compact?: boolean;
}) {
  if (phase === "en_curso" && !paused) return null;

  let Icon = CalendarClock;
  let title = "";
  let detail = "";
  if (phase === "antes") {
    title = "La competencia todavía no empezó";
    detail = start
      ? `Empieza el ${formatCompetitionDate(start)} (hora de Argentina). Mientras tanto, dejá lista tu cuenta y tus preguntas.`
      : "Dejá lista tu cuenta y tus preguntas.";
  } else if (phase === "terminada") {
    Icon = Flag;
    title = "La competencia terminó";
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
        {!compact && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
        {compact && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
      </div>
    </div>
  );
}
