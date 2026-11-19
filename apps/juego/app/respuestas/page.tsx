"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAX_ANSWER_LENGTH, gameErrorMessage, type Question } from "@juego/shared";
import { usePlayer } from "@/lib/player";
import { Button, Notice, PlayerGate, Screen, Spinner } from "@/components/ui";

export default function RespuestasPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("auth");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
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
        if (error) setError("No pudimos cargar las preguntas.");
        else setQuestions(data as Question[]);
      });
  }, [status, supabase, state]);

  if (status !== "ok" || !state || !supabase) return <PlayerGate status={status} />;

  const locked = state.answers_locked;
  const complete = questions?.every((q) => (values[String(q.id)] ?? "").trim().length > 0) ?? false;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !questions) return;
    setBusy(true);
    setError(null);
    const payload: Record<string, string> = {};
    for (const q of questions) payload[String(q.id)] = (values[String(q.id)] ?? "").trim();
    const { error } = await supabase.rpc("save_my_answers", { p_answers: payload });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    router.replace("/");
  }

  return (
    <Screen title="Tus respuestas" back={Object.keys(state.answers).length >= state.total_questions ? "/" : undefined}>
      {locked ? (
        <Notice>Ya jugaste tu primer encuentro: tus respuestas quedaron fijas.</Notice>
      ) : (
        <p className="text-muted">
          Contestá en pocas palabras. Otros jugadores van a tener que adivinar tu respuesta charlando con
          vos. Podés cambiarlas hasta tu primer encuentro.
        </p>
      )}

      {!questions ? (
        <Spinner />
      ) : (
        <form onSubmit={save} className="mt-6 flex flex-col gap-5">
          {questions.map((q, i) => {
            const id = String(q.id);
            const value = values[id] ?? "";
            return (
              <label key={q.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  {i + 1}. {q.text}
                </span>
                <input
                  className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand disabled:bg-canvas"
                  maxLength={MAX_ANSWER_LENGTH}
                  required
                  disabled={locked}
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
          {!locked && (
            <Button type="submit" disabled={busy || !complete}>
              {busy ? "Guardando…" : "Guardar respuestas"}
            </Button>
          )}
        </form>
      )}
    </Screen>
  );
}
