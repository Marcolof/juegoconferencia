import Link from "next/link";
import { ChevronRight, LayoutGrid, List } from "lucide-react";
import { requireAdmin } from "@/lib/supabase-server";
import { Card, Flash, PageTitle } from "@/components/ui";
import { AiSummary } from "./AiSummary";
import { AnswerItem, HiddenFilter, loadAnswers, plural } from "./shared";

export const dynamic = "force-dynamic";

/** En la vista de tarjetas cada pregunta muestra hasta esta cantidad de respuestas (F45). */
const PREVIEW = 4;

type View = "tarjetas" | "lista";

/**
 * Respuestas (F45): dos vistas que se cambian con un ícono.
 * - Tarjetas: vistazo general, hasta 4 respuestas por pregunta y un enlace al resto.
 * - Lista: una fila por pregunta, a todo el ancho, con la cantidad de respuestas y un
 *   chevron que lleva al detalle de la pregunta (cada persona con su respuesta).
 */
export default async function RespuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; ocultas?: string; vista?: string }>;
}) {
  const { db } = await requireAdmin();
  const { ok, error, ocultas, vista } = await searchParams;
  const onlyHidden = ocultas === "1";
  const view: View = vista === "lista" ? "lista" : "tarjetas";

  const { questions, rows, aiBy } = await loadAnswers(db, onlyHidden);
  const viewParam = view === "lista" ? "vista=lista" : "";
  const query = (extra: string[]) => {
    const q = extra.filter(Boolean).join("&");
    return q ? `?${q}` : "";
  };
  const returnTo = `/respuestas${query([viewParam, onlyHidden ? "ocultas=1" : ""])}`;
  const detailQuery = onlyHidden ? "?ocultas=1" : "";

  return (
    <>
      <PageTitle
        title="Respuestas"
        subtitle="Lo que escribió cada jugador. Ocultá las inapropiadas: dejan de aparecer como opción (R71)."
      />
      <Flash ok={ok} error={error} />

      <AiSummary db={db} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <HiddenFilter base="/respuestas" onlyHidden={onlyHidden} extra={viewParam} />
        <div className="flex rounded-lg bg-surface p-1 ring-1 ring-line" role="group" aria-label="Cambiar vista">
          <Link
            href={`/respuestas${query([onlyHidden ? "ocultas=1" : ""])}`}
            aria-label="Vista de tarjetas"
            aria-current={view === "tarjetas" ? "true" : undefined}
            title="Vista de tarjetas"
            className={`grid size-9 place-items-center rounded-md ${
              view === "tarjetas" ? "bg-brand text-white" : "text-muted hover:bg-canvas"
            }`}
          >
            <LayoutGrid size={18} aria-hidden />
          </Link>
          <Link
            href={`/respuestas${query(["vista=lista", onlyHidden ? "ocultas=1" : ""])}`}
            aria-label="Vista de lista"
            aria-current={view === "lista" ? "true" : undefined}
            title="Vista de lista"
            className={`grid size-9 place-items-center rounded-md ${
              view === "lista" ? "bg-brand text-white" : "text-muted hover:bg-canvas"
            }`}
          >
            <List size={18} aria-hidden />
          </Link>
        </div>
      </div>

      {view === "lista" ? (
        <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
          <ul className="divide-y divide-line">
            {questions.map((q) => {
              const count = rows.filter((r) => r.question_id === q.id).length;
              return (
                <li key={q.id}>
                  <Link
                    href={`/respuestas/${q.id}${detailQuery}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-canvas"
                  >
                    <span className="min-w-0 flex-1 font-medium">{q.text}</span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{plural(count)}</span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {questions.map((q) => {
            const list = rows.filter((r) => r.question_id === q.id);
            const shown = list.slice(0, PREVIEW);
            return (
              <Card key={q.id}>
                <Link href={`/respuestas/${q.id}${detailQuery}`} className="group flex items-start gap-2">
                  <span className="flex-1">
                    <h2 className="font-bold group-hover:text-brand">{q.text}</h2>
                    <p className="text-sm text-muted">{plural(list.length)}</p>
                  </span>
                  <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted group-hover:text-brand" aria-hidden />
                </Link>
                <ul className="mt-3 divide-y divide-line">
                  {shown.map((a) => (
                    <AnswerItem key={a.player_id} answer={a} aiBy={aiBy} returnTo={returnTo} />
                  ))}
                  {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Sin respuestas.</li>}
                </ul>
                {list.length > PREVIEW && (
                  <Link
                    href={`/respuestas/${q.id}${detailQuery}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand"
                  >
                    Ver las {list.length} respuestas
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
