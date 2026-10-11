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
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-[#F06529]/20 selection:text-[#0F2C59]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
