// Estilos de botón compartidos por el juego y el panel (F46).
// Cada app los envuelve en sus componentes <Button> y <LinkButton>; también se
// pueden usar en un <Link> o un <button> cualquiera con `buttonClass(...)`.
//
// Estados:
// - hover: cambia el fondo;
// - pressed (`:active`): se achica apenas y se oscurece, para notar el toque;
// - focus (`:focus-visible`): anillo de color al navegar con teclado;
// - disabled: se apaga y no reacciona.

export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerOutline" | "success" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 font-semibold transition duration-100 ease-out " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-8 rounded-lg px-3 text-xs",
  md: "min-h-10 rounded-lg px-4 text-sm",
  lg: "min-h-12 rounded-2xl px-5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-strong active:bg-brand-strong active:shadow-none",
  secondary: "bg-surface text-ink ring-1 ring-line hover:bg-canvas active:bg-brand-soft active:ring-brand",
  danger: "bg-bad text-white shadow-sm hover:brightness-110 active:brightness-90 active:shadow-none",
  dangerOutline: "bg-surface text-bad ring-1 ring-line hover:bg-bad-soft active:bg-bad-soft active:ring-bad",
  success: "bg-ok text-white shadow-sm hover:brightness-110 active:brightness-90 active:shadow-none",
  ghost: "text-brand underline-offset-4 hover:underline active:opacity-70",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  className?: string;
}

/**
 * Sólo los estados (pressed y focus), para controles con forma propia:
 * chips, botones de ícono, paginación, enlaces de navegación.
 */
export const pressableClass =
  "transition duration-100 ease-out outline-none focus-visible:ring-2 focus-visible:ring-brand " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.97]";

/** Clases de un botón con todos sus estados. */
export function buttonClass({ variant = "primary", size = "md", block = false, className = "" }: ButtonStyleOptions = {}) {
  return [base, sizes[size], variants[variant], block ? "w-full" : "", className].filter(Boolean).join(" ");
}
