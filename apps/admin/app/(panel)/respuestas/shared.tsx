import Link from "next/link";
import { Sparkles, TriangleAlert } from "lucide-react";
import type { AdminSession } from "@/lib/supabase-server";
import { setAnswerHidden } from "../actions";
import { secondaryButtonClass } from "@/components/ui";
import { pressableClass } from "@juego/shared/ui";

// Piezas compartidas por la pantalla Respuestas y el detalle de cada pregunta (F45).

export interface Question {
  id: number;
  text: string;
}

export interface AnswerRow {
  player_id: string;
  question_id: number;
  text: string;
  hidden: boolean;
  profiles: { first_name: string; last_name: string } | null;
}

export interface AiRow {
  player_id: string;
  question_id: number;
  answer_text: string;
  options: string[];
  flagged: boolean;
  flag_reason: string | null;
}

/** Carga preguntas, respuestas (todas u ocultas) y opciones de la IA. */
export async function loadAnswers(db: AdminSession["db"], onlyHidden: boolean, questionId?: number) {
  let query = db
    .from("answers")
    .select("player_id, question_id, text, hidden, profiles(first_name, last_name)")
    .order("text");
  if (onlyHidden) query = query.eq("hidden", true);
  if (questionId !== undefined) query = query.eq("question_id", questionId);

  let questionsQuery = db.from("questions").select("id, text").order("position");
  if (questionId !== undefined) questionsQuery = questionsQuery.eq("id", questionId);

  const [{ data: questions }, { data: answers }, { data: ai }] = await Promise.all([
    questionsQuery,
    query,
    db.from("ai_distractors").select("player_id, question_id, answer_text, options, flagged, flag_reason"),
  ]);
  const aiBy = new Map(((ai ?? []) as AiRow[]).map((r) => [`${r.player_id}|${r.question_id}`, r]));
  return {
    questions: (questions ?? []) as Question[],
    rows: (answers ?? []) as unknown as AnswerRow[],
    aiBy,
  };
}

/** Una respuesta con su autor, las opciones de la IA, la marca de revisión y el botón para ocultarla. */
export function AnswerItem({
  answer: a,
  aiBy,
  returnTo,
}: {
  answer: AnswerRow;
  aiBy: Map<string, AiRow>;
  returnTo: string;
}) {
  const aiRow = aiBy.get(`${a.player_id}|${a.question_id}`);
  // Sólo si corresponden al texto actual de la respuesta (F41, R97).
  const aiInfo = aiRow && aiRow.answer_text === a.text ? aiRow : null;
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${a.hidden ? "text-muted line-through" : ""}`}>
          {a.text}
          {aiInfo?.flagged && !a.hidden && (
            <span
              title={aiInfo.flag_reason ?? undefined}
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 align-middle text-xs font-semibold text-bad"
            >
              <TriangleAlert size={12} aria-hidden />
              Revisar (IA)
            </span>
          )}
        </p>
        {aiInfo?.flagged && aiInfo.flag_reason && !a.hidden && <p className="text-xs text-bad">{aiInfo.flag_reason}</p>}
        <Link href={`/personas/${a.player_id}`} className="text-xs text-muted hover:text-brand">
          {a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : "—"}
        </Link>
        {aiInfo && (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-brand" aria-label="Opciones de la IA" />
            <span>{aiInfo.options.join(" · ")}</span>
          </p>
        )}
      </div>
      <form action={setAnswerHidden.bind(null, a.player_id, a.question_id, !a.hidden, returnTo)}>
        <button className={secondaryButtonClass}>{a.hidden ? "Mostrar" : "Ocultar"}</button>
      </form>
    </li>
  );
}

/** Filtro Todas / Sólo ocultas, que conserva la vista elegida. */
export function HiddenFilter({ base, onlyHidden, extra = "" }: { base: string; onlyHidden: boolean; extra?: string }) {
  const sep = (q: string) => (q ? `?${q}` : "");
  const all = sep(extra);
  const hidden = sep([extra, "ocultas=1"].filter(Boolean).join("&"));
  return (
    <div className="flex gap-2 text-sm">
      <Link
        href={`${base}${all}`}
        className={`rounded-lg px-3 py-2 ${pressableClass} ${!onlyHidden ? "bg-brand text-white" : "bg-surface ring-1 ring-line"}`}
      >
        Todas
      </Link>
      <Link
        href={`${base}${hidden}`}
        className={`rounded-lg px-3 py-2 ${pressableClass} ${onlyHidden ? "bg-brand text-white" : "bg-surface ring-1 ring-line"}`}
      >
        Sólo ocultas
      </Link>
    </div>
  );
}

export function plural(n: number) {
  return `${n} ${n === 1 ? "respuesta" : "respuestas"}`;
}
