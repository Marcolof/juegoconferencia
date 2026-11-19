import { initials } from "@juego/shared";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}

/** Mensaje que vuelve de una acción (?ok=… o ?error=…). */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl px-4 py-3 text-sm ${error ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}
    >
      {error ?? ok}
    </p>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Badge({ tone, children }: { tone: "ok" | "bad" | "brand" | "muted"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-ok-soft text-ok",
    bad: "bg-bad-soft text-bad",
    brand: "bg-brand-soft text-brand",
    muted: "bg-canvas text-muted",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function Initials({ firstName, lastName, url, size = 36 }: {
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
    <span style={style} aria-hidden className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand">
      {initials(firstName, lastName)}
    </span>
  );
}

export const inputClass =
  "min-h-10 rounded-lg border border-line bg-surface px-3 outline-none focus:border-brand";
export const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-surface px-4 text-sm font-semibold ring-1 ring-line hover:bg-canvas";
export const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-bad px-4 text-sm font-semibold text-white hover:opacity-90";
