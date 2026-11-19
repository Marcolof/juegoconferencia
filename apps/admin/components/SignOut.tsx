"use client";

import { LogOut } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase-browser";

export function SignOut() {
  return (
    <button
      onClick={async () => {
        await getBrowserClient()?.auth.signOut();
        window.location.href = "/ingresar";
      }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas"
    >
      <LogOut size={16} aria-hidden />
      Salir
    </button>
  );
}
