import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/supabase-server";
import { Card, Flash, PageTitle } from "@/components/ui";
import { AnswerItem, HiddenFilter, loadAnswers, plural } from "../shared";

export const dynamic = "force-dynamic";

/** Detalle de una pregunta (F45): cada persona con su respuesta. */
export default async function PreguntaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; ocultas?: string }>;
}) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const { ok, error, ocultas } = await searchParams;
  const questionId = Number(id);
  if (!Number.isInteger(questionId)) notFound();
  const onlyHidden = ocultas === "1";

  const { questions, rows, aiBy } = await loadAnswers(db, onlyHidden, questionId);
  const question = questions[0];
  if (!question) notFound();
  const base = `/respuestas/${questionId}`;
  const returnTo = onlyHidden ? `${base}?ocultas=1` : base;

  return (
    <>
      <Link
        href={`/respuestas?vista=lista${onlyHidden ? "&ocultas=1" : ""}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <ChevronLeft size={16} aria-hidden />
        Todas las preguntas
      </Link>
      <PageTitle title={question.text} subtitle={plural(rows.length)} />
      <Flash ok={ok} error={error} />
      <div className="mb-5">
        <HiddenFilter base={base} onlyHidden={onlyHidden} />
      </div>
      <Card>
        <ul className="divide-y divide-line">
          {rows.map((a) => (
            <AnswerItem key={a.player_id} answer={a} aiBy={aiBy} returnTo={returnTo} />
          ))}
          {rows.length === 0 && <li className="py-6 text-center text-sm text-muted">Sin respuestas.</li>}
        </ul>
      </Card>
    </>
  );
}
