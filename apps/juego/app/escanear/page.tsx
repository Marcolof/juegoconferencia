"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { tokenFromQr, usePlayer } from "@/lib/player";
import { useCompetition } from "@/lib/competition";
import { CompetitionNotice } from "@/components/CompetitionNotice";
import { Button, Notice, PlayerGate, Screen } from "@/components/ui";

type CameraState = "starting" | "on" | "denied" | "unavailable";

export default function EscanearPage() {
  const router = useRouter();
  const { state, status, reload } = usePlayer("ready");
  const comp = useCompetition(state, reload);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [manual, setManual] = useState("");

  useEffect(() => {
    // Fuera de la competencia no se abre la cámara (R94).
    if (status !== "ok" || !comp.canScan) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    let last = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function found(raw: string) {
      if (done) return;
      done = true;
      router.replace(`/q/${encodeURIComponent(tokenFromQr(raw))}`);
    }

    function tick(time: number) {
      const video = videoRef.current;
      if (done || !video || !ctx) return;
      // Unas 8 lecturas por segundo alcanzan y cuidan la batería.
      if (time - last > 120 && video.readyState === video.HAVE_ENOUGH_DATA) {
        last = time;
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          found(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCamera("on");
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const name = (err as DOMException)?.name;
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    void start();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [status, router, comp.canScan]);

  if (status !== "ok") return <PlayerGate status={status} />;

  // Antes de empezar, después de terminar o en pausa: no se escanea (R94).
  if (!comp.canScan) {
    return (
      <Screen title="Escanear QR" back="/">
        <CompetitionNotice phase={comp.phase} paused={comp.paused} start={comp.start} end={comp.end} />
      </Screen>
    );
  }

  return (
    <Screen title="Escanear QR" back="/">
      <div className="relative overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        {camera === "on" && (
          <div aria-hidden className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/80" />
        )}
        {camera === "starting" && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">Abriendo la cámara…</p>
        )}
      </div>

      <div className="mt-4">
        {camera === "on" && <p className="text-center text-muted">Apuntá al QR de la otra persona.</p>}
        {camera === "denied" && (
          <Notice tone="error">
            No tenemos permiso para usar la cámara. Habilitalo en la configuración del navegador y volvé a
            intentar.
          </Notice>
        )}
        {camera === "unavailable" && (
          <Notice tone="error">No pudimos abrir la cámara en este dispositivo.</Notice>
        )}
      </div>

      <form
        className="mt-auto flex flex-col gap-2 pt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) router.replace(`/q/${encodeURIComponent(tokenFromQr(manual))}`);
        }}
      >
        <label className="text-sm text-muted" htmlFor="codigo">
          ¿No funciona la cámara? Escribí el código que figura en el enlace del QR.
        </label>
        <div className="flex gap-2">
          <input
            id="codigo"
            className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 outline-none focus:border-brand"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Button type="submit" variant="secondary" className="w-auto">
            Ir
          </Button>
        </div>
      </form>
    </Screen>
  );
}
