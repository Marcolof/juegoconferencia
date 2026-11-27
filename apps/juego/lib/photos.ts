"use client";

import { useEffect, useState } from "react";
import { PHOTOS_BUCKET } from "@juego/shared";
import { getSupabase } from "./supabase";

const cache = new Map<string, { url: string; expires: number }>();
const TTL_SECONDS = 3600;

/** URLs firmadas de las fotos (el bucket es privado: sólo jugadores registrados, P80). */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).sort().join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = getSupabase();
    const wanted = key ? key.split("|") : [];
    if (!supabase || wanted.length === 0) return;
    const now = Date.now();
    const fresh: Record<string, string> = {};
    const missing: string[] = [];
    for (const p of wanted) {
      const hit = cache.get(p);
      if (hit && hit.expires > now) fresh[p] = hit.url;
      else missing.push(p);
    }
    setUrls((prev) => ({ ...prev, ...fresh }));
    if (missing.length === 0) return;
    let cancelled = false;
    supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(missing, TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const item of data) {
          if (item.path && item.signedUrl) {
            next[item.path] = item.signedUrl;
            cache.set(item.path, { url: item.signedUrl, expires: now + (TTL_SECONDS - 60) * 1000 });
          }
        }
        setUrls((prev) => ({ ...prev, ...next }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

/**
 * Achica la foto a 320 px de lado y la pasa a JPEG liviano antes de subirla
 * (reporte 19: lo mínimo que se sigue viendo bien en los avatares y en la
 * pantalla grande). Si aun así pasa de 60 KB, la vuelve a comprimir más.
 */
export async function resizeImage(file: File, max = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const encode = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("sin imagen"))), "image/jpeg", quality),
    );
  const blob = await encode(0.7);
  return blob.size > 60_000 ? await encode(0.5) : blob;
}
