import { Sparkles } from "lucide-react";
import type { AdminSession } from "@/lib/supabase-server";
import { AiOptionsButton } from "@/components/AiOptionsButton";
import { Card } from "@/components/ui";

/**
 * «Respuestas con IA» (F41, R97; movido desde Configuración en F45): cuántas
 * respuestas de jugadores activos ya tienen opciones generadas, cuántas faltan
 * y cuántas marcó la IA para revisar. Incluye el botón para generar las que faltan.
 */
export async function AiSummary({ db }: { db: AdminSession["db"] }) {
  const [{ data: aiAnswers }, { data: aiRows }, { data: activePlayers }] = await Promise.all([
    db.from("answers").select("player_id, question_id, text"),
    db.from("ai_distractors").select("player_id, question_id, answer_text, flagged"),
    db.from("profiles").select("id").eq("role", "jugador").eq("status", "activo"),
  ]);
  const activeIds = new Set(((activePlayers ?? []) as { id: string }[]).map((p) => p.id));
  const aiDone = new Set(
    ((aiRows ?? []) as { player_id: string; question_id: number; answer_text: string }[]).map(
      (r) => `${r.player_id}|${r.question_id}|${r.answer_text}`,
    ),
  );
  const relevant = ((aiAnswers ?? []) as { player_id: string; question_id: number; text: string }[]).filter((a) =>
    activeIds.has(a.player_id),
  );
  const aiWith = relevant.filter((a) => aiDone.has(`${a.player_id}|${a.question_id}|${a.text}`)).length;
  const aiPending = relevant.length - aiWith;
  const aiFlagged = ((aiRows ?? []) as { flagged: boolean }[]).filter((r) => r.flagged).length;

  return (
    <Card className="mb-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Sparkles size={18} className="text-brand" aria-hidden />
        Respuestas con IA
      </h2>
      <p className="mt-1 text-sm text-muted">
        Cuando un jugador guarda sus respuestas, la IA genera las opciones falsas: del mismo tipo que la respuesta real
        pero que no puedan ser verdad a la vez (para «Caribe», nunca «Playa»). Si la IA no está disponible, el juego usa
        las respuestas de otros jugadores y el listado de respaldo (R97).
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-canvas p-3">
          <dt className="text-xs text-muted">Con opciones de IA</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{aiWith}</dd>
        </div>
        <div className="rounded-xl bg-canvas p-3">
          <dt className="text-xs text-muted">Pendientes</dt>
          <dd className={`text-2xl font-extrabold tabular-nums ${aiPending > 0 ? "text-brand" : ""}`}>{aiPending}</dd>
        </div>
        <div className="rounded-xl bg-canvas p-3">
          <dt className="text-xs text-muted">Marcadas para revisar</dt>
          <dd className={`text-2xl font-extrabold tabular-nums ${aiFlagged > 0 ? "text-bad" : ""}`}>{aiFlagged}</dd>
        </div>
      </dl>
      <AiOptionsButton pending={aiPending} />
      {aiFlagged > 0 && (
        <p className="mt-3 text-sm text-muted">
          Las marcadas aparecen abajo con la etiqueta <strong className="text-bad">Revisar (IA)</strong>: ahí decidís si
          ocultarlas.
        </p>
      )}
    </Card>
  );
}
