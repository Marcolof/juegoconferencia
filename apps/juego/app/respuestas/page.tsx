"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, PencilLine } from "lucide-react";
import { MAX_ANSWER_LENGTH, gameErrorMessage, type Question } from "@juego/shared";
import { usePlayer } from "@/lib/player";
import { requestAiOptions } from "@/lib/ai-request";
import { Button, Notice, PlayerGate, Screen, Spinner } from "@/components/ui";

type Step = "resumen" | "elegir" | "responder";

/**
 * Cuestionario en dos pasos (F34, R80 a R82):
 * 1. Elegir qué preguntas responder. Si alguna es obligatoria (is_fixed), viene
 *    marcada y no se desmarca. Desde F37 ninguna lo es.
 * 2. Responder sólo las elegidas.
 * El botón para avanzar queda flotando abajo para que se vea con la lista larga.
 * Si ya las había guardado, primero ve sólo sus preguntas y un botón para
 * editarlas (F36, R89).
 */
export default function RespuestasPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("auth");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "ok" || !supabase || !state) return;
    setValues(state.answers);
    // Con las respuestas ya guardadas arranca en el resumen; si no, en elegir.
    // Si ya jugó pero ahora se piden más, va directo a elegir las que faltan.
    const missing = Object.keys(state.answers).length < state.min_answers;
    setStep((s) => s ?? (state.answers_ready && !(state.answers_locked && missing) ? "resumen" : "elegir"));
    supabase
      .from("questions")
      .select("id, position, text, is_fixed")
      .order("position")
      .then(({ data, error }) => {
        if (error) {
          setError("No pudimos cargar las preguntas.");
          return;
        }
        const qs = data as Question[];
        setQuestions(qs);
        // Marcadas de entrada: las fijas y las que ya respondió.
        setSelected(new Set(qs.filter((q) => q.is_fixed || state.answers[String(q.id)] !== undefined).map((q) => q.id)));
      });
  }, [status, supabase, state]);

  const chosen = useMemo(
    () => (questions ?? []).filter((q) => selected.has(q.id)),
    [questions, selected],
  );

  if (status !== "ok" || !state || !supabase) return <PlayerGate status={status} />;

  const locked = state.answers_locked;
  // Cantidad exacta de preguntas que se responden (F38, R92): ni más ni menos.
  const total = state.min_answers;
  const exactChosen = chosen.length === total;
  const allAnswered = chosen.every((q) => (values[String(q.id)] ?? "").trim().length > 0);
  const canGoHome = state.answers_ready;
  const savedCount = Object.keys(state.answers).length;
  // Ya jugó, pero el administrador pidió más respuestas que las que tiene: puede sumar
  // las que faltan, sin cambiar las que ya dio (las vieron otros jugadores).
  const completing = locked && savedCount < total;
  const missingCount = Math.max(total - savedCount, 0);
  const isSaved = (q: Question) => state.answers[String(q.id)] !== undefined;

  function toggle(q: Question) {
    if (q.is_fixed || (locked && isSaved(q))) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else if (next.size < total) next.add(q.id); // al llegar al tope no se suman más
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const payload: Record<string, string> = {};
    for (const q of chosen) payload[String(q.id)] = (values[String(q.id)] ?? "").trim();
    const { error } = await supabase.rpc("save_my_answers", { p_answers: payload });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    void requestAiOptions(supabase);
    router.replace("/");
  }

  // Sólo las preguntas que ya eligió y guardó, con su respuesta.
  const savedList = !questions ? (
    <Spinner />
  ) : (
    <dl className="mt-6 flex flex-col gap-3">
      {questions
        .filter((q) => state.answers[String(q.id)] !== undefined)
        .map((q) => (
          <div key={q.id} className="rounded-2xl bg-surface p-4 shadow-sm">
            <dt className="text-sm text-muted">{q.text}</dt>
            <dd className="mt-1 font-semibold">{state.answers[String(q.id)]}</dd>
          </div>
        ))}
    </dl>
  );

  // ---------- Respuestas ya fijas: sólo lectura ----------
  if (locked && !completing) {
    return (
      <Screen title="Tus preguntas" back="/">
        <Notice>Ya jugaste tu primer encuentro: tus respuestas quedaron fijas.</Notice>
        {savedList}
      </Screen>
    );
  }

  if (!step) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  // ---------- Resumen: las preguntas elegidas y un botón para editarlas (R89) ----------
  if (step === "resumen") {
    return (
      <Screen title="Tus preguntas" back="/">
        <p className="text-muted">
          Elegiste {savedCount} {savedCount === 1 ? "pregunta" : "preguntas"}. Otros jugadores van a tener que adivinar
          tus respuestas charlando con vos. Podés cambiarlas hasta tu primer encuentro.
        </p>
        <div className="pb-28">{savedList}</div>
        <BottomBar>
          <Button type="button" onClick={() => setStep("elegir")} disabled={!questions}>
            <PencilLine size={18} aria-hidden />
            Editar preguntas
          </Button>
        </BottomBar>
      </Screen>
    );
  }

  // ---------- Paso 1: elegir preguntas ----------
  if (step === "elegir") {
    return (
      <Screen title="Elegí tus preguntas" back={canGoHome ? "/" : undefined}>
        <p className="sticky top-0 z-10 -mx-4 mb-3 bg-canvas/95 px-4 py-2 text-center text-lg font-bold tabular-nums backdrop-blur" aria-hidden>
          <span className={exactChosen ? "text-ok" : "text-brand"}>{chosen.length}</span>
          <span className="text-muted"> de {total}</span>
        </p>
        {savedCount > 0 && savedCount < total && (
          <Notice tone="error">
            Ahora se piden {total} preguntas y vos respondiste {savedCount}. Completá {missingCount === 1 ? "la que falta" : `las ${missingCount} que faltan`}
            {completing ? ": las que ya respondiste no se pueden cambiar." : "."}
          </Notice>
        )}
        <p className="text-muted">
          Elegí <strong className="text-ink">exactamente {total} preguntas</strong> para responder: otros jugadores van a
          tener que adivinar tus respuestas charlando con vos.
        </p>

        {!questions ? (
          <Spinner />
        ) : (
          <ul className="mt-5 flex flex-col gap-2 pb-32">
            {questions.map((q) => {
              const on = selected.has(q.id);
              // Con el cupo completo, las que no están marcadas quedan bloqueadas.
              const blocked = !on && chosen.length >= total;
              // Si ya jugó, las que ya respondió quedan marcadas y no se pueden sacar.
              const kept = q.is_fixed || (locked && isSaved(q));
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={kept || blocked}
                    onClick={() => toggle(q)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                      on ? "bg-brand-soft ring-2 ring-brand" : "bg-surface ring-1 ring-line"
                    } ${kept ? "cursor-default" : blocked ? "cursor-not-allowed opacity-45" : "active:scale-[0.99]"}`}
                  >
                    <span
                      aria-hidden
                      className={`grid size-6 shrink-0 place-items-center rounded-md text-sm font-bold ${
                        on ? "bg-brand text-white" : "bg-canvas ring-1 ring-line"
                      }`}
                    >
                      {on && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-base">{q.text}</span>
                    {q.is_fixed && <span className="shrink-0 text-xs font-medium text-muted">obligatoria</span>}
                    {!q.is_fixed && locked && isSaved(q) && (
                      <span className="shrink-0 text-xs font-medium text-muted">ya respondida</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <BottomBar>
          <p
            className={`mb-2 text-center text-sm font-semibold tabular-nums ${exactChosen ? "text-ok" : "text-muted"}`}
            aria-live="polite"
          >
            {exactChosen
              ? `${chosen.length} de ${total}: ¡listo!`
              : `${chosen.length} de ${total} preguntas elegidas`}
          </p>
          <Button type="button" disabled={!questions || !exactChosen} onClick={() => setStep("responder")}>
            Siguiente
          </Button>
        </BottomBar>
      </Screen>
    );
  }

  // ---------- Paso 2: responder las elegidas ----------
  return (
    <Screen title="Tus respuestas">
      <button
        type="button"
        onClick={() => setStep("elegir")}
        className="mb-3 flex items-center gap-1.5 self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        Cambiar las preguntas
      </button>
      <p className="text-muted">
        {locked
          ? "Contestá en pocas palabras las que faltan. Las que ya respondiste no se pueden cambiar."
          : "Contestá en pocas palabras. Podés cambiarlas hasta tu primer encuentro."}
      </p>

      <form onSubmit={save} className="mt-6 flex flex-col gap-5 pb-28">
        {chosen.map((q, i) => {
          const id = String(q.id);
          const value = values[id] ?? "";
          return (
            <label key={q.id} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {i + 1}. {q.text}
              </span>
              <input
                className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand"
                maxLength={MAX_ANSWER_LENGTH}
                required
                readOnly={locked && isSaved(q)}
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
              />
              <span className="text-right text-xs text-muted">
                {value.length}/{MAX_ANSWER_LENGTH}
              </span>
            </label>
          );
        })}
        {error && <Notice tone="error">{error}</Notice>}

        <BottomBar>
          <Button type="submit" disabled={busy || !allAnswered}>
            {busy ? "Guardando…" : "Guardar respuestas"}
          </Button>
        </BottomBar>
      </form>
    </Screen>
  );
}

/** Barra flotante abajo de la pantalla, del mismo ancho que el contenido. */
function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
