import Link from "next/link";
import { Sparkles, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/supabase-server";
import { setAnswerHidden } from "../actions";
import { Card, Flash, PageTitle, secondaryButtonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

interface AnswerRow {
  player_id: string;
  question_id: number;
  text: string;
  hidden: boolean;
  profiles: { first_name: string; last_name: string } | null;
}

export default async function RespuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; ocultas?: string }>;
}) {
  const { db } = await requireAdmin();
  const { ok, error, ocultas } = await searchParams;
  const onlyHidden = ocultas === "1";

  let query = db
    .from("answers")
    .select("player_id, question_id, text, hidden, profiles(first_name, last_name)")
    .order("text");
  if (onlyHidden) query = query.eq("hidden", true);

  const [{ data: questions }, { data: answers }, { data: ai }] = await Promise.all([
    db.from("questions").select("id, text").order("position"),
    query,
    db.from("ai_distractors").select("player_id, question_id, answer_text, options, flagged, flag_reason"),
  ]);
  const rows = (answers ?? []) as unknown as AnswerRow[];
  // Opciones y marcas de la IA (F41, R97), sólo si corresponden al texto actual de la respuesta.
  const aiBy = new Map(
    ((ai ?? []) as { player_id: string; question_id: number; answer_text: string; options: string[]; flagged: boolean; flag_reason: string | null }[]).map(
      (r) => [`${r.player_id}|${r.question_id}`, r],
    ),
  );
  const returnTo = onlyHidden ? "/respuestas?ocultas=1" : "/respuestas";

  return (
    <>
      <PageTitle
        title="Respuestas"
        subtitle="Lo que escribió cada jugador. Ocultá las inapropiadas: dejan de aparecer como opción (R71)."
      />
      <Flash ok={ok} error={error} />
      <div className="mb-5 flex gap-2 text-sm">
        <Link
          href="/respuestas"
          className={`rounded-lg px-3 py-2 ${!onlyHidden ? "bg-brand text-white" : "bg-surface ring-1 ring-line"}`}
        >
          Todas
        </Link>
        <Link
          href="/respuestas?ocultas=1"
          className={`rounded-lg px-3 py-2 ${onlyHidden ? "bg-brand text-white" : "bg-surface ring-1 ring-line"}`}
        >
          Sólo ocultas
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {((questions ?? []) as { id: number; text: string }[]).map((q) => {
          const list = rows.filter((r) => r.question_id === q.id);
          return (
            <Card key={q.id}>
              <h2 className="font-bold">{q.text}</h2>
              <p className="text-sm text-muted">
                {list.length} {list.length === 1 ? "respuesta" : "respuestas"}
              </p>
              <ul className="mt-3 max-h-[28rem] divide-y divide-line overflow-auto">
                {list.map((a) => {
                  const aiRow = aiBy.get(`${a.player_id}|${a.question_id}`);
                  const aiInfo = aiRow && aiRow.answer_text === a.text ? aiRow : null;
                  return (
                  <li key={a.player_id} className="flex items-center gap-3 py-2">
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
                      {aiInfo?.flagged && aiInfo.flag_reason && !a.hidden && (
                        <p className="text-xs text-bad">{aiInfo.flag_reason}</p>
                      )}
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
                })}
                {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Sin respuestas.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
