"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MAX_ANSWER_LENGTH, gameErrorMessage, type Question } from "@juego/shared";
import { usePlayer } from "@/lib/player";
import { Button, Notice, PlayerGate, Screen, Spinner } from "@/components/ui";

type Step = "elegir" | "responder";

/**
 * Cuestionario en dos pasos (F34, R80 a R82):
 * 1. Elegir qué preguntas responder. Las fijas vienen marcadas y no se desmarcan.
 * 2. Responder sólo las elegidas.
 * El botón para avanzar queda flotando abajo para que se vea con la lista larga.
 */
export default function RespuestasPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("auth");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("elegir");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "ok" || !supabase || !state) return;
    setValues(state.answers);
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
  const min = state.min_answers;
  const enoughChosen = chosen.length >= min;
  const allAnswered = chosen.every((q) => (values[String(q.id)] ?? "").trim().length > 0);
  const canGoHome = state.answers_ready;

  function toggle(q: Question) {
    if (q.is_fixed || locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
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
    router.replace("/");
  }

  // ---------- Respuestas ya fijas: sólo lectura ----------
  if (locked) {
    return (
      <Screen title="Tus respuestas" back="/">
        <Notice>Ya jugaste tu primer encuentro: tus respuestas quedaron fijas.</Notice>
        {!questions ? (
          <Spinner />
        ) : (
          <dl className="mt-6 flex flex-col gap-4">
            {questions
              .filter((q) => state.answers[String(q.id)] !== undefined)
              .map((q) => (
                <div key={q.id} className="rounded-2xl bg-surface p-4 shadow-sm">
                  <dt className="text-sm text-muted">{q.text}</dt>
                  <dd className="mt-1 font-semibold">{state.answers[String(q.id)]}</dd>
                </div>
              ))}
          </dl>
        )}
      </Screen>
    );
  }

  // ---------- Paso 1: elegir preguntas ----------
  if (step === "elegir") {
    return (
      <Screen title="Elegí tus preguntas" back={canGoHome ? "/" : undefined}>
        <p className="text-muted">
          Marcá las preguntas que querés responder: otros jugadores van a tener que adivinar tus respuestas charlando con
          vos. Elegí al menos {min}. Las que dicen <strong>obligatoria</strong> ya vienen marcadas.
        </p>

        {!questions ? (
          <Spinner />
        ) : (
          <ul className="mt-5 flex flex-col gap-2 pb-28">
            {questions.map((q) => {
              const on = selected.has(q.id);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={q.is_fixed}
                    onClick={() => toggle(q)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                      on ? "bg-brand-soft ring-2 ring-brand" : "bg-surface ring-1 ring-line"
                    } ${q.is_fixed ? "cursor-default" : "active:scale-[0.99]"}`}
                  >
                    <span
                      aria-hidden
                      className={`grid size-6 shrink-0 place-items-center rounded-md text-sm font-bold ${
                        on ? "bg-brand text-white" : "bg-canvas ring-1 ring-line"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="flex-1 text-base">{q.text}</span>
                    {q.is_fixed && <span className="shrink-0 text-xs font-medium text-muted">obligatoria</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <BottomBar>
          <p className="mb-2 text-center text-sm text-muted" aria-live="polite">
            {enoughChosen
              ? `${chosen.length} preguntas elegidas`
              : `Elegiste ${chosen.length} de ${min} como mínimo`}
          </p>
          <Button type="button" disabled={!questions || !enoughChosen} onClick={() => setStep("responder")}>
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
        className="mb-3 self-start text-sm text-brand underline-offset-4 hover:underline"
      >
        ← Cambiar las preguntas
      </button>
      <p className="text-muted">
        Contestá en pocas palabras. Podés cambiarlas hasta tu primer encuentro.
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
