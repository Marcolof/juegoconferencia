import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Administración · Juego de la convención",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
