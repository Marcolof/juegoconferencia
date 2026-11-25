"use client";

import { useEffect, useState } from "react";
import { gameErrorMessage, type PublicSettings } from "@juego/shared";
import { getSupabase } from "@/lib/supabase";
import { Button, Notice } from "@/components/ui";

/**
 * «Ingresar con Google» (F47, R111). Sólo aparece cuando la organización lo
 * habilita en el panel. Pide una cuenta del dominio corporativo (hd) y, al
 * volver, la app retoma la sesión sola. Si es la primera vez, la cuenta se crea
 * con el nombre y el apellido de Google.
 */
export function GoogleSignIn() {
  const supabase = getSupabase();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase?.rpc("get_public_settings").then(({ data }) => {
      if (data) setSettings(data as PublicSettings);
    });
  }, [supabase]);

  if (!supabase || !settings?.google_login) return null;

  async function go() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: "select_account",
          ...(settings?.email_domain ? { hd: settings.email_domain } : {}),
        },
      },
    });
    if (error) {
      setBusy(false);
      setError(gameErrorMessage(error.message));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" onClick={go} disabled={busy}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
        </svg>
        {busy ? "Abriendo Google…" : "Ingresar con Google"}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
