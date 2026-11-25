"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MIN_PASSWORD_LENGTH,
  emailMatchesDomain,
  gameErrorMessage,
  type PublicSettings,
} from "@juego/shared";
import { getSupabase } from "@/lib/supabase";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Button, Field, Notice, PlayerGate, Screen } from "@/components/ui";

export default function CrearCuentaPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase?.rpc("get_public_settings").then(({ data }) => {
      if (data) setSettings(data as PublicSettings);
    });
  }, [supabase]);

  if (!supabase) return <PlayerGate status="no-config" />;

  const domain = settings?.email_domain ?? null;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const email = form.email.trim().toLowerCase();
    if (!emailMatchesDomain(email, domain)) {
      setError(`Usá tu email corporativo (@${domain}).`);
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Completá tu nombre y tu apellido.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { first_name: form.firstName.trim(), last_name: form.lastName.trim() } },
    });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    if (!data.session) {
      // El proyecto pide confirmar el email (P72 dice que no): avisamos en lugar de trabarnos.
      setError("La cuenta se creó, pero el proyecto pide confirmar el email. Avisale a la organización.");
      return;
    }
    router.replace("/foto");
  }

  return (
    <Screen title="Crear cuenta" back="/ingresar">
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
          placeholder={domain ? `nombre@${domain}` : undefined}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres. Pueden ser números o letras.`}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <Field
          label="Nombre"
          autoComplete="given-name"
          required
          maxLength={60}
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
        />
        <Field
          label="Apellido"
          autoComplete="family-name"
          required
          maxLength={60}
          value={form.lastName}
          onChange={(e) => set("lastName", e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-semibold text-brand">
          Ingresar
        </Link>
      </p>
    </Screen>
  );
}
