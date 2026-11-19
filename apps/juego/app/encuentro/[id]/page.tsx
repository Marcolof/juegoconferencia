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
  const turn = view.my_turn;
  const myTurnNow = !!turn && turn.chosen_index === null && !final;

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

  // ---------- Resultado (R57, R59, R61) ----------
  if (view.status === "completo" && turn) {
    const mine = turn.is_correct ? 1 : 0;
    return (
      <Screen title="Resultado">
        {header}
        <div className="grid grid-cols-2 gap-3">
          <ResultCard label="Vos" ok={!!turn.is_correct} yes="Acertaste" no="No acertaste" />
          <ResultCard label={other.first_name} ok={!!view.other_correct} yes="Acertó" no="No acertó" />
        </div>
        <section className="mt-5 rounded-3xl bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Tu pregunta sobre {other.first_name}</p>
          <p className="mt-1 font-semibold">{turn.question}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {turn.options.map((opt, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                  i === turn.correct_index
                    ? "bg-ok-soft font-semibold text-ok"
                    : i === turn.chosen_index
                      ? "bg-bad-soft text-bad"
                      : "bg-canvas"
                }`}
              >
                <span className="flex-1">
                  {opt}
                  {i === turn.chosen_index && i !== turn.correct_index && " (tu elección)"}
                </span>
                {i === turn.correct_index && <Check size={18} strokeWidth={3} aria-label="Correcta" />}
                {i === turn.chosen_index && i !== turn.correct_index && <X size={18} strokeWidth={3} aria-hidden />}
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-5 text-center text-lg font-bold">
          {mine ? "¡Sumaste 1 punto!" : "Esta vez no sumaste."}
        </p>
        <LinkButton href="/" className="mt-5">
          Volver al inicio
        </LinkButton>
      </Screen>
    );
  }

  // ---------- Mi turno (R55, R56) ----------
  if (myTurnNow && turn) {
    return (
      <Screen title="Tu turno">
        {header}
        <p className="text-sm text-muted">Charlá con {other.first_name} y elegí su respuesta.</p>
        <h2 className="mb-4 mt-2 text-xl font-bold">{turn.question}</h2>
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
        <Button className="mt-6" onClick={confirm} disabled={choice === null || busy}>
          {busy ? "Enviando…" : "Confirmar respuesta"}
        </Button>
      </Screen>
    );
  }

  // ---------- Esperando al otro ----------
  const waitingText =
    view.i_am === "b" && view.status === "turno_a"
      ? `${other.first_name} está adivinando una de tus respuestas. ¡Charlen! Después te toca a vos.`
      : `Ahora ${other.first_name} adivina una de tus respuestas. Los puntos aparecen cuando responda.`;

  return (
    <Screen title="Esperando">
      {header}
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="size-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        <p className="text-lg">{waitingText}</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  );
}

function ResultCard({ label, ok, yes, no }: { label: string; ok: boolean; yes: string; no: string }) {
  return (
    <div className={`rounded-3xl p-4 text-center ${ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{ok ? yes : no}</p>
      <p className="text-sm">{ok ? "+1 punto" : "0 puntos"}</p>
    </div>
  );
}
