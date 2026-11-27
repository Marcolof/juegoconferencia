"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { gameErrorMessage } from "@juego/shared";
import { getBrowserClient } from "@/lib/supabase-browser";
import { buttonClass } from "@juego/shared/ui";
import { Logo } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "sin-permiso" ? "Esta cuenta no tiene permiso de administración." : null,
  );
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return <p className="text-bad">Falta configurar Supabase (ver .env.example).</p>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className={buttonClass({ variant: "primary", className: "min-h-11 rounded-xl text-base" })}
      >
        {busy ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export default function IngresarAdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Logo className="h-12 w-auto self-start" />
      <h1 className="mb-6 mt-3 text-2xl font-bold">Administración</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-xs text-muted">
        Sólo entran las cuentas con rol de administración. La cuenta se crea desde la app del juego.
      </p>
    </main>
  );
}
