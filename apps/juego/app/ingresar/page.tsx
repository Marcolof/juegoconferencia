"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { gameErrorMessage } from "@juego/shared";
import { getSupabase } from "@/lib/supabase";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Button, Field, Notice, PlayerGate, Screen } from "@/components/ui";

export default function IngresarPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) return <PlayerGate status="no-config" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    router.replace("/");
  }

  return (
    <Screen>
      <div className="mb-8 mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Convención Vortex</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight">Juego de la convención</h1>
        <p className="mt-3 text-muted">
          Escaneá el QR de alguien, charlen y descubran algo del otro. Suma quien acierta.
        </p>
      </div>

      <div className="mb-4">
        <GoogleSignIn />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Email corporativo"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        ¿Primera vez?{" "}
        <Link href="/crear-cuenta" className="font-semibold text-brand">
          Crear cuenta
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        ¿Te olvidaste la contraseña? Pedile a la organización que la restablezca.
      </p>
    </Screen>
  );
}
