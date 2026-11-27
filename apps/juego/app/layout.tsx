import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@juego/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Escaneá el QR de alguien, charlen y descubran algo del otro.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b3df5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
