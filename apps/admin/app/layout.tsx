import type { Metadata } from "next";
import { APP_NAME } from "@juego/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: `Administración · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
