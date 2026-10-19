import { ThemeProvider } from "@/context/ThemeContext";
import { themeBootstrap } from "@/lib/theme";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Servigaz CRM — Equipos e Instalaciones",
  description: "Sistema de Gestión Integral de Servicios de Instalación, Equipos y Mantenimiento",
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className="antialiased min-h-screen bg-canvas text-ink selection:bg-[#F06529]/20 selection:text-ink">
        <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
