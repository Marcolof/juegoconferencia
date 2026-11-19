"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PHOTOS_BUCKET, gameErrorMessage } from "@juego/shared";
import { usePlayer } from "@/lib/player";
import { resizeImage, usePhotoUrls } from "@/lib/photos";
import { Avatar, Button, Notice, PlayerGate, Screen } from "@/components/ui";

export default function FotoPage() {
  const router = useRouter();
  const { state, status, supabase } = usePlayer("auth");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = usePhotoUrls([state?.photo_path]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (status !== "ok" || !state || !supabase) return <PlayerGate status={status} />;

  const next = state.answers_ready ? "/" : "/respuestas";
  const currentUrl = state.photo_path ? current[state.photo_path] : null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    try {
      const small = await resizeImage(picked);
      setFile(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError("No pudimos leer esa imagen. Probá con otra.");
    }
  }

  async function save() {
    if (!supabase || !state || !file) return;
    setBusy(true);
    setError(null);
    const path = `${state.id}/foto-${Date.now()}.jpg`;
    const up = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, file, { contentType: "image/jpeg", upsert: false });
    if (up.error) {
      setBusy(false);
      setError("No pudimos subir la foto. Revisá tu conexión.");
      return;
    }
    const { error } = await supabase.rpc("set_my_photo", { p_path: path });
    if (!error && state.photo_path) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([state.photo_path]);
    }
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    router.replace(next);
  }

  async function skip() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_my_photo", { p_path: state?.photo_path ?? null });
    setBusy(false);
    if (error) {
      setError(gameErrorMessage(error.message));
      return;
    }
    router.replace(next);
  }

  return (
    <Screen title="Tu foto" back={state.photo_step_done ? "/" : undefined}>
      <p className="text-muted">
        Así te reconocen en el ranking y en los encuentros. Si preferís, pasá sin foto: se van a ver tus
        iniciales.
      </p>

      <div className="my-8 flex justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa de tu foto" className="size-44 rounded-full object-cover" />
        ) : (
          <Avatar firstName={state.first_name} lastName={state.last_name} url={currentUrl} size={176} />
        )}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onPick} />

      <div className="flex flex-col gap-3">
        {file ? (
          <>
            <Button onClick={save} disabled={busy}>
              {busy ? "Guardando…" : "Usar esta foto"}
            </Button>
            <Button variant="secondary" onClick={() => cameraRef.current?.click()} disabled={busy}>
              Sacar otra
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => cameraRef.current?.click()} disabled={busy}>
              Sacar foto
            </Button>
            <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={busy}>
              Elegir de la galería
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={skip} disabled={busy}>
          {state.photo_path ? "Dejar la foto actual" : "Pasar sin foto"}
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <p className="mt-auto pt-8 text-center text-xs text-muted">
        Tu foto la verán los demás jugadores durante el evento.
      </p>
    </Screen>
  );
}
