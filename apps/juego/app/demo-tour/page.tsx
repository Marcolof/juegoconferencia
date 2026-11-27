"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Tour } from "@/components/Tour";
import { Button, Screen } from "@/components/ui";

/** Sólo en desarrollo: abre el tour sin iniciar sesión, para revisar las animaciones (F51). */
export default function DemoTourPage() {
  const [open, setOpen] = useState(true);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Screen>
      <p className="mb-4 text-muted">Página de prueba local del tour. No existe en producción.</p>
      <Button onClick={() => setOpen(true)}>Abrir el tour</Button>
      <Tour open={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}
