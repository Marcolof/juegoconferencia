"use client";

import Link from "next/link";
import { initials } from "@juego/shared";
import type { PlayerStatus } from "@/lib/player";
import { getSupabase } from "@/lib/supabase";

export function Screen({
  title,
  back,
  children,
}: {
  title?: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-5">
      {(title || back) && (
        <header className="mb-5 flex items-center gap-3">
          {back && (
            <Link
              href={back}
              aria-label="Volver"
              className="grid size-10 place-items-center rounded-full bg-surface text-xl shadow-sm"
            >
              ←
            </Link>
          )}
          {title && <h1 className="text-xl font-bold">{title}</h1>}
        </header>
      )}
      {children}
    </main>
  );
}

const buttonBase =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition disabled:opacity-50";
const variants = {
  primary: "bg-brand text-white active:bg-brand-strong",
  secondary: "bg-surface text-ink ring-1 ring-line active:bg-brand-soft",
  ghost: "text-brand underline-offset-4 hover:underline",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={`${buttonBase} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${buttonBase} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-brand-soft text-ink",
    error: "bg-bad-soft text-bad",
    ok: "bg-ok-soft text-ok",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand"
        {...props}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Avatar({
  firstName,
  lastName,
  url,
  size = 44,
}: {
  firstName: string;
  lastName: string;
  url?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand"
    >
      {initials(firstName, lastName)}
    </span>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted">
      <span className="size-8 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Pantallas comunes mientras se carga el jugador. Devuelve null si está todo bien. */
export function PlayerGate({ status }: { status: PlayerStatus }) {
  if (status === "ok") return null;
  if (status === "loading") {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  if (status === "no-config") {
    return (
      <Screen title="Falta configurar">
        <Notice tone="error">
          La app no tiene los datos de Supabase. Completá NEXT_PUBLIC_SUPABASE_URL y
          NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (ver .env.example).
        </Notice>
      </Screen>
    );
  }
  if (status === "admin") {
    return (
      <Screen title="Cuenta de administración">
        <Notice>
          Esta cuenta es de administración y no juega. Entrá al panel de administración para ver el ranking y
          gestionar el juego.
        </Notice>
        <Button variant="secondary" className="mt-6" onClick={() => void signOutAndGo()}>
          Salir
        </Button>
      </Screen>
    );
  }
  if (status === "suspended") {
    return (
      <Screen title="Cuenta suspendida">
        <Notice tone="error">Tu cuenta está suspendida. Si creés que es un error, hablá con la organización.</Notice>
        <Button variant="secondary" className="mt-6" onClick={() => void signOutAndGo()}>
          Salir
        </Button>
      </Screen>
    );
  }
  return (
    <Screen title="No pudimos cargar tus datos">
      <Notice tone="error">Revisá tu conexión y probá de nuevo.</Notice>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        Reintentar
      </Button>
    </Screen>
  );
}

export async function signOutAndGo() {
  await getSupabase()?.auth.signOut();
  window.location.href = "/ingresar";
}
