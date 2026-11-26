import { redirect } from "next/navigation";

/**
 * Los jugadores ya no ven el ranking con puntaje (F49): ahora la pantalla
 * principal tiene «Mi progreso» y «Jugadores». Esta dirección queda para que
 * un enlace viejo no dé error.
 */
export default function RankingPage() {
  redirect("/");
}
