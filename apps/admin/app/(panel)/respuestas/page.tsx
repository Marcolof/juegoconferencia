import Link from "next/link";
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

  const [{ data: questions }, { data: answers }] = await Promise.all([
    db.from("questions").select("id, text").order("position"),
    query,
  ]);
  const rows = (answers ?? []) as unknown as AnswerRow[];
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
                {list.map((a) => (
                  <li key={a.player_id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${a.hidden ? "text-muted line-through" : ""}`}>{a.text}</p>
                      <Link href={`/personas/${a.player_id}`} className="text-xs text-muted hover:text-brand">
                        {a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : "—"}
                      </Link>
                    </div>
                    <form action={setAnswerHidden.bind(null, a.player_id, a.question_id, !a.hidden, returnTo)}>
                      <button className={secondaryButtonClass}>{a.hidden ? "Mostrar" : "Ocultar"}</button>
                    </form>
                  </li>
                ))}
                {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Sin respuestas.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
