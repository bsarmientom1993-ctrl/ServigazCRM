"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Clock, PlusCircle, Bell, Search, User, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function Header({ title }: { title?: string }) {
  const { user } = useAuth();
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-black text-[#0F2C59] tracking-tight">
          {title || "Panel Operativo Servigaz"}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Clock display */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold">
          <Clock className="h-3.5 w-3.5 text-[#F06529]" />
          <span>{time}</span>
        </div>

        {/* Quick Action: New Job */}
        {(user?.rol === "ADMIN" || user?.rol === "ENCARGADO") && (
          <Link
            href="/trabajos/nuevo"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F06529] hover:bg-[#D94E15] text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Nuevo Trabajo</span>
          </Link>
        )}

        {/* Attendance Fast Clock-in */}
        <Link
          href="/asistencia"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F2C59] hover:bg-[#1A3E72] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden md:inline">Marcar Asistencia</span>
        </Link>
      </div>
    </header>
  );
}
