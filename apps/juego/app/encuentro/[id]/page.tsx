"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { gameErrorMessage, type EncounterView } from "@juego/shared";
import { usePlayer } from "@/lib/player";
import { usePhotoUrls } from "@/lib/photos";
import { Avatar, Button, LinkButton, Notice, PlayerGate, Screen, Spinner } from "@/components/ui";

const POLL_MS = 3000;

export default function EncuentroPage() {
  const { id } = useParams<{ id: string }>();
  const { status, supabase } = usePlayer("ready");
  const [view, setView] = useState<EncounterView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const offsetRef = useRef(0); // diferencia entre el reloj del servidor y el del teléfono
  const photo = usePhotoUrls([view?.other.photo_path]);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    const { data, error } = await supabase.rpc("get_encounter", { p_id: id });
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    const v = data as EncounterView;
    offsetRef.current = new Date(v.now).getTime() - Date.now();
    setView(v);
  }, [supabase, id]);

  const final = view?.status === "completo" || view?.status === "vencido";

  // Carga inicial, Realtime y consulta periódica mientras el encuentro sigue abierto.
  useEffect(() => {
    if (status !== "ok" || !supabase || !id) return;
    void load();
    const channel = supabase
      .channel(`encuentro-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "encounters", filter: `id=eq.${id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [status, supabase, id, load]);

  useEffect(() => {
    if (status !== "ok" || final) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [status, final, load]);

  // Cuenta regresiva hasta el límite (R65).
  useEffect(() => {
    if (!view || final) {
      setRemaining(null);
      return;
    }
    const expires = new Date(view.expires_at).getTime();
    if (view.paused) {
      // En pausa el reloj está congelado (R110): se muestra el tiempo que queda, quieto.
      setRemaining(Math.max(0, Math.round((expires - new Date(view.now).getTime()) / 1000)));
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((expires - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(left);
      if (left === 0) void load();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [view, final, load]);

  if (status !== "ok") return <PlayerGate status={status} />;

  if (error && !view) {
    return (
      <Screen title="Encuentro" back="/">
        <Notice tone="error">{error}</Notice>
        <LinkButton href="/" className="mt-6">
          Volver al inicio
        </LinkButton>
      </Screen>
    );
  }
  if (!view) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  const other = view.other;
  const otherName = `${other.first_name} ${other.last_name}`;
  const pausedNotice = view.paused && !final && (
    <div className="mb-4">
      <Notice>El juego está en pausa: el reloj se detuvo. Cuando la organización lo reanude, siguen donde estaban.</Notice>
    </div>
  );
  const turn = view.my_turn;
  const myTurnNow = !!turn && !final;

  async function confirm() {
    if (!supabase || choice === null) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("answer_turn", { p_id: view!.id, p_index: choice });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      void load();
      return;
    }
    setChoice(null); // la pregunta siguiente arranca sin nada elegido
    setView(data as EncounterView);
  }

  const header = (
    <div className="mb-5 flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-sm">
      <Avatar
        firstName={other.first_name}
        lastName={other.last_name}
        url={other.photo_path ? photo[other.photo_path] : null}
        size={52}
      />
      <div className="flex-1">
        <p className="text-sm text-muted">Encuentro con</p>
        <p className="font-bold">{otherName}</p>
      </div>
      {remaining !== null && (
        <span
          aria-label={`Quedan ${remaining} segundos`}
          className={`rounded-full px-3 py-1 font-mono text-sm font-bold tabular-nums ${
            remaining <= 30 ? "bg-bad-soft text-bad" : "bg-brand-soft text-brand"
          }`}
        >
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );

  // ---------- Vencido (R58) ----------
  if (view.status === "vencido") {
    return (
      <Screen title="Se terminó el tiempo">
        {header}
        <Notice>Pasó el tiempo límite antes de que respondieran los dos: esta vez nadie suma.</Notice>
        <p className="mt-3 text-sm text-muted">Pueden volver a intentarlo escaneando el QR de nuevo.</p>
        <LinkButton href="/" className="mt-6">
          Volver al inicio
        </LinkButton>
      </Screen>
    );
  }

  // ---------- Resultado (R57, R59, R61, R93) ----------
  if (view.status === "completo" && view.results) {
    const results = view.results;
    const mine = results.filter((r) => r.is_correct).length;
    const theirs = view.other_correct ?? 0;
    const shared = mine + theirs; // puntaje compartido (R109)
    return (
      <Screen title="Resultado">
        {header}
        <div className="grid grid-cols-2 gap-3">
          <ResultCard label="Vos" correct={mine} total={results.length} />
          <ResultCard label={other.first_name} correct={theirs} total={view.other_total} />
        </div>
        <p className="mt-5 text-center text-lg font-bold">
          {shared > 0
            ? `¡Suman ${shared} ${shared === 1 ? "punto" : "puntos"} cada uno!`
            : "Esta vez no sumaron."}
        </p>
        <p className="mt-1 text-center text-sm text-muted">
          Los dos se llevan los aciertos de los dos: vos {mine} y {other.first_name} {theirs}.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Tus preguntas sobre {other.first_name}</h2>
        <div className="flex flex-col gap-3">
          {results.map((r, n) => (
            <section key={n} className="rounded-3xl bg-surface p-4 shadow-sm">
              <p className="text-xs text-muted">
                Pregunta {n + 1} de {results.length}
              </p>
              <p className="mt-1 font-semibold">{r.question}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {r.options.map((opt, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                      i === r.correct_index
                        ? "bg-ok-soft font-semibold text-ok"
                        : i === r.chosen_index
                          ? "bg-bad-soft text-bad"
                          : "bg-canvas"
                    }`}
                  >
                    <span className="flex-1">
                      {opt}
                      {i === r.chosen_index && i !== r.correct_index && " (tu elección)"}
                    </span>
                    {i === r.correct_index && <Check size={18} strokeWidth={3} aria-label="Correcta" />}
                    {i === r.chosen_index && i !== r.correct_index && <X size={18} strokeWidth={3} aria-hidden />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <LinkButton href="/" className="mt-5">
          Volver al inicio
        </LinkButton>
      </Screen>
    );
  }

  // ---------- Mi turno: las preguntas, una tras otra (R55, R56, R93) ----------
  if (myTurnNow && turn) {
    return (
      <Screen title="Tu turno">
        {header}
        {pausedNotice}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold tabular-nums">
              Pregunta {turn.number} de {view.total}
            </span>
            <span className="text-muted">Charlá con {other.first_name}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={view.total}
            aria-valuenow={view.answered}
            aria-label="Avance de tus preguntas"
            className="h-2 overflow-hidden rounded-full bg-brand-soft"
          >
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(view.answered / Math.max(1, view.total)) * 100}%` }}
            />
          </div>
        </div>
        <h2 className="mb-4 mt-4 text-xl font-bold">{turn.question}</h2>
        <div role="radiogroup" aria-label="Opciones" className="flex flex-col gap-3">
          {turn.options.map((opt, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={choice === i}
              onClick={() => setChoice(i)}
              className={`min-h-14 rounded-2xl px-4 text-left text-base font-medium ring-2 transition ${
                choice === i ? "bg-brand-soft ring-brand" : "bg-surface ring-line"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <Button className="mt-6" onClick={confirm} disabled={choice === null || busy || !!view.paused}>
          {busy ? "Enviando…" : turn.number >= view.total ? "Confirmar y terminar" : "Confirmar y seguir"}
        </Button>
      </Screen>
    );
  }

  // ---------- Esperando al otro ----------
  const theyAnswering =
    (view.i_am === "a" && view.status === "turno_b") || (view.i_am === "b" && view.status === "turno_a");
  const waitingText = theyAnswering
    ? view.i_am === "b" && view.status === "turno_a"
      ? `${other.first_name} tiene que responder tus preguntas. Charlen y después te toca a vos.`
      : `Ahora ${other.first_name} adivina tus respuestas. Los puntos aparecen cuando termine.`
    : `Esperando a ${other.first_name}…`;

  return (
    <Screen title="Esperando">
      {header}
      {pausedNotice}
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="size-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        <p className="text-lg">{waitingText}</p>
        {theyAnswering && view.other_total > 0 && (
          <p className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold tabular-nums text-brand">
            {view.other_answered} de {view.other_total} respondidas
          </p>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  );
}

function ResultCard({ label, correct, total }: { label: string; correct: number; total: number }) {
  const all = total > 0 && correct === total;
  const none = correct === 0;
  return (
    <div
      className={`rounded-3xl p-4 text-center ${
        none ? "bg-bad-soft text-bad" : all ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"
      }`}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {correct} de {total}
      </p>
      <p className="text-sm">{correct === 1 ? "1 acierto" : `${correct} aciertos`}</p>
    </div>
  );
}
