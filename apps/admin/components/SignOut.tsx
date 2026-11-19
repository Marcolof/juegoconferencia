"use client";

import { getBrowserClient } from "@/lib/supabase-browser";

export function SignOut() {
  return (
    <button
      onClick={async () => {
        await getBrowserClient()?.auth.signOut();
        window.location.href = "/ingresar";
      }}
      className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas"
    >
      Salir
    </button>
  );
}
