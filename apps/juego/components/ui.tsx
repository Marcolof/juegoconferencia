"use client";

import Link from "next/link";
import { buttonClass, type ButtonSize } from "@juego/shared/ui";
import { ArrowLeft } from "lucide-react";
import { APP_NAME, LOGO_SRC, initials } from "@juego/shared";
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
              className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm transition active:bg-brand-soft"
            >
              <ArrowLeft size={20} aria-hidden />
            </Link>
          )}
          {title && <h1 className="text-xl font-bold">{title}</h1>}
        </header>
      )}
      {children}
    </main>
  );
}

// Botones (F46): estilos compartidos con el panel, con estados pressed y focus.
// En el juego los botones son grandes y ocupan todo el ancho, salvo que se indique otra cosa.
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Button({
  variant = "primary",
  size = "lg",
  block = true,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: ButtonSize; block?: boolean }) {
  return <button className={buttonClass({ variant, size, block, className })} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "lg",
  block = true,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, className })}>
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

/** Logo de Vortex Meet (F50). El texto alternativo es el nombre del producto. */
export function Logo({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_SRC} alt={APP_NAME} width={2731} height={966} className={className} />;
}
