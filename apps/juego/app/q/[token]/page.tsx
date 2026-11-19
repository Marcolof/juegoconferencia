"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gameErrorMessage } from "@juego/shared";
import { savePendingQr, takePendingQr, usePlayer } from "@/lib/player";
import { LinkButton, Notice, PlayerGate, Screen, Spinner } from "@/components/ui";

/** Destino del QR: sirve tanto para el escáner de la app como para la cámara del teléfono. */
export default function QrPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? "");
  const router = useRouter();
  const savedRef = useRef(false);
  if (!savedRef.current && typeof window !== "undefined" && token) {
    // Si todavía no ingresó, el QR se retoma después del ingreso.
    savePendingQr(token);
    savedRef.current = true;
  }
  const { status, supabase } = usePlayer("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ok" || !supabase || !token) return;
    let alive = true;
    supabase.rpc("start_encounter", { p_token: token }).then(({ data, error }) => {
      takePendingQr();
      if (!alive) return;
      if (error) setError(gameErrorMessage(error.message));
      else router.replace(`/encuentro/${data as string}`);
    });
    return () => {
      alive = false;
    };
  }, [status, supabase, token, router]);

  if (status !== "ok") return <PlayerGate status={status} />;

  return (
    <Screen title="Nuevo encuentro">
      {error ? (
        <>
          <Notice tone="error">{error}</Notice>
          <div className="mt-6 flex flex-col gap-3">
            <LinkButton href="/escanear">Escanear otro QR</LinkButton>
            <LinkButton href="/" variant="secondary">
              Volver al inicio
            </LinkButton>
          </div>
        </>
      ) : (
        <Spinner label="Empezando el encuentro…" />
      )}
    </Screen>
  );
}
