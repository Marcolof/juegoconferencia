import { competitionPhase, formatCompetitionDate, toCompetitionInput } from "@juego/shared";
import { requireAdmin } from "@/lib/supabase-server";
import { AiOptionsButton } from "@/components/AiOptionsButton";
import { GameToggleButton } from "@/components/GameToggleButton";
import { addAdminEmail, removeAdminEmail, updateCompetition, updateSettings } from "../actions";
import { Card, Flash, PageTitle, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { db } = await requireAdmin();
  const { ok, error } = await searchParams;
  const [{ data: s }, { data: admins }] = await Promise.all([
    db
      .from("settings")
      .select(
        "email_domain, encounter_minutes, game_open, min_answers, questions_per_encounter, competition_start, competition_end",
      )
      .eq("id", 1)
      .single(),
    db.from("admin_emails").select("email").order("email"),
  ]);

  // Opciones con IA (F41, R97): cuántas respuestas de jugadores activos ya las tienen.
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

  const phase = competitionPhase(s?.competition_start, s?.competition_end);
  const phaseText =
    phase === "antes"
      ? s?.competition_start
        ? "Todavía no empezó"
        : "Sin lanzar"
      : phase === "terminada"
        ? "Ya terminó"
        : "En curso";

  return (
    <>
      <PageTitle title="Configuración" />
      <Flash ok={ok} error={error} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold">Competencia</h2>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
              phase === "en_curso" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"
            }`}
          >
            {phaseText}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          <strong className="text-ink">Crear la cuenta es libre</strong> en cualquier momento. Estas fechas definen cuándo
          se puede <strong className="text-ink">escanear QR</strong>. Mientras el juego <strong className="text-ink">no
          esté lanzado</strong> (sin fecha de inicio, o antes de esa fecha) los jugadores ven «El juego aún no inició» y no
          pueden escanear; cuando empieza, ven las opciones para jugar. Después de terminar tampoco se puede empezar
          ningún encuentro nuevo, pero los ya empezados se pueden terminar. Hora de Argentina. Sin fecha de fin = no
          termina nunca (R94, R96).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <GameToggleButton running={phase === "en_curso"} />
        </div>
        <form action={updateCompetition} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Empieza</span>
            <input
              type="datetime-local"
              name="competition_start"
              defaultValue={toCompetitionInput(s?.competition_start)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Termina</span>
            <input
              type="datetime-local"
              name="competition_end"
              defaultValue={toCompetitionInput(s?.competition_end)}
              className={inputClass}
            />
          </label>
          <button className={buttonClass}>Guardar fechas</button>
        </form>
        {(s?.competition_start || s?.competition_end) && (
          <p className="mt-3 text-xs text-muted">
            Guardado: {s?.competition_start ? `empieza el ${formatCompetitionDate(s.competition_start)}` : "sin inicio"}
            {" · "}
            {s?.competition_end ? `termina el ${formatCompetitionDate(s.competition_end)}` : "sin fin"}.
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <h2 className="font-bold">Opciones con IA</h2>
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
            Las marcadas se ven en <a href="/respuestas" className="font-semibold text-brand">Respuestas</a>: ahí decidís
            si ocultarlas.
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Juego</h2>
          <form action={updateSettings} className="mt-4 flex flex-col gap-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="game_open" defaultChecked={s?.game_open ?? true} className="size-5" />
              <span>
                <span className="font-medium">Encuentros abiertos (pausa manual)</span>
                <span className="block text-sm text-muted">
                  Si lo apagás, nadie puede empezar un encuentro hasta que lo vuelvas a prender, aunque la competencia
                  esté en curso.
                </span>
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Duración de cada encuentro (minutos)</span>
              <input
                type="number"
                name="encounter_minutes"
                min={1}
                max={60}
                required
                defaultValue={s?.encounter_minutes ?? 5}
                className={`${inputClass} w-32`}
              />
              <span className="text-xs text-muted">
                Se aplica a los encuentros nuevos (R65). Es el tiempo para que los dos respondan todas sus preguntas:
                con varias preguntas por encuentro conviene más de 5 minutos.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Preguntas por encuentro</span>
              <input
                type="number"
                name="questions_per_encounter"
                min={1}
                max={30}
                required
                defaultValue={s?.questions_per_encounter ?? 4}
                className={`${inputClass} w-32`}
              />
              <span className="text-xs text-muted">
                Cuántas preguntas responde cada uno sobre el otro dentro de un encuentro, una tras otra (R93). Cada
                acierto suma 1 punto. No puede superar la cantidad de preguntas que responde cada jugador.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Mínimo de preguntas que responde cada jugador</span>
              <input
                type="number"
                name="min_answers"
                min={1}
                max={30}
                required
                defaultValue={s?.min_answers ?? 4}
                className={`${inputClass} w-32`}
              />
              <span className="text-xs text-muted">
                Cada jugador elige libremente cuáles y puede responder más, pero como mínimo esta cantidad. Si la
                subís, quienes tengan menos verán un aviso para completar sus respuestas y no podrán jugar hasta
                hacerlo, aunque el juego ya esté en curso. Las que ya respondieron no se cambian una vez que el
                juego empezó.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Dominio del email corporativo</span>
              <input
                name="email_domain"
                placeholder="empresa.com"
                defaultValue={s?.email_domain ?? ""}
                className={inputClass}
              />
              <span className="text-xs text-muted">
                Vacío = se acepta cualquier email (P1 sigue abierto). Sólo afecta a las cuentas nuevas.
              </span>
            </label>
            <button className={`${buttonClass} self-start`}>Guardar</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold">Emails de administración</h2>
          <p className="mt-1 text-sm text-muted">
            Quien se registre con uno de estos emails recibe el rol de administración (R75). Si ya tiene cuenta, lo
            recibe al agregarlo.
          </p>
          <form action={addAdminEmail} className="mt-4 flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@empresa.com"
              aria-label="Email a autorizar"
              className={`${inputClass} flex-1`}
            />
            <button className={buttonClass}>Agregar</button>
          </form>
          <ul className="mt-4 divide-y divide-line">
            {((admins ?? []) as { email: string }[]).map((a) => (
              <li key={a.email} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm">{a.email}</span>
                <form action={removeAdminEmail.bind(null, a.email)}>
                  <button className={secondaryButtonClass}>Quitar</button>
                </form>
              </li>
            ))}
            {(admins ?? []).length === 0 && <li className="py-4 text-sm text-muted">Sin emails cargados.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
