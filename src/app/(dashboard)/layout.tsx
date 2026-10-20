"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { HelpProvider } from "@/components/help/HelpProvider";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => { if (desktop.matches) setSidebarOpen(false); };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sidebarOpen]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-canvas text-ink"><div className="flex flex-col items-center gap-4"><Loader2 className="h-7 w-7 animate-spin text-[#F06529]" /><p className="text-sm text-muted">Preparando tu espacio...</p></div></div>;
  if (!user) return null;
  return <HelpProvider><div className="app-shell">
    <Sidebar open={sidebarOpen} onClose={closeSidebar} />
    <div className="flex-1 flex flex-col min-w-0" inert={sidebarOpen}>
      <Header onMenu={() => setSidebarOpen(true)} />
      <main id="main-content" className="app-content">{children}</main>
      <footer className="app-footer"><span>Servigaz · Gestión de servicios</span><span>Todo conectado. Cada día.</span></footer>
    </div>
  </div></HelpProvider>;
}
