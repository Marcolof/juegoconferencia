"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePlayer } from "@/lib/player";
import { useActiveEncounterRedirect } from "@/lib/encounters";
import { PlayerGate, Screen } from "@/components/ui";

export default function MiQrPage() {
  const { state, status, supabase } = usePlayer("ready");
  const [qr, setQr] = useState<string | null>(null);
  useActiveEncounterRedirect(status === "ok" ? supabase : null, state?.id);

  useEffect(() => {
    if (!state?.qr_token) return;
    const url = `${window.location.origin}/q/${state.qr_token}`;
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" }).then(setQr);
  }, [state?.qr_token]);

  // Mantiene la pantalla encendida mientras se muestra el QR, si el navegador lo permite.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, []);

  if (status !== "ok" || !state) return <PlayerGate status={status} />;

  return (
    <Screen title="Mi QR" back="/">
      <p className="text-center text-muted">Mostrale este código a la otra persona para que lo escanee.</p>
      <div className="my-6 rounded-3xl bg-white p-5 shadow-sm">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Tu código QR" className="mx-auto aspect-square w-full max-w-80" />
        ) : (
          <div className="mx-auto aspect-square w-full max-w-80 animate-pulse rounded-2xl bg-canvas" />
        )}
      </div>
      <p className="text-center text-lg font-semibold">
        {state.first_name} {state.last_name}
      </p>
      <p className="mt-1 break-all text-center font-mono text-xs text-muted">Código: {state.qr_token}</p>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted" role="status">
        <span className="size-2 animate-pulse rounded-full bg-brand" />
        Esperando que te escaneen…
      </p>
    </Screen>
  );
}
