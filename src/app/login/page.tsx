"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, UserCheck, Wrench, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const { login, switchDemoRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await login(email, password);
    if (!res.success) {
      setError(res.error || "Error al iniciar sesión");
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: "ADMIN" | "ENCARGADO" | "TECNICO_FIJO") => {
    setLoading(true);
    setError("");
    await switchDemoRole(role);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0F2C59] to-slate-950 p-4 sm:p-6">
      {/* Decorative ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#F06529]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="relative w-44 h-28 mx-auto mb-2 drop-shadow-md">
            <Image
              src="/logo.jpg"
              alt="Servigaz Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
            Sistema de Gestión Integral • v12.0
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2 animate-shake">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@servigaz.cl"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F06529] focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F06529] focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#0F2C59] to-[#1A3E72] hover:from-[#133E68] hover:to-[#0F2C59] text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#F06529]" />
              Acceso Rápido de Prueba (Roles)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("ADMIN")}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-[#0F2C59] bg-slate-50 hover:bg-[#0F2C59]/5 flex flex-col items-center gap-1 transition-all group cursor-pointer text-center"
            >
              <div className="p-1.5 rounded-lg bg-[#0F2C59]/10 group-hover:bg-[#0F2C59] text-[#0F2C59] group-hover:text-white transition-colors">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">Admin</span>
              <span className="text-[9px] text-slate-400">Total</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("ENCARGADO")}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-[#F06529] bg-slate-50 hover:bg-[#F06529]/5 flex flex-col items-center gap-1 transition-all group cursor-pointer text-center"
            >
              <div className="p-1.5 rounded-lg bg-[#F06529]/10 group-hover:bg-[#F06529] text-[#F06529] group-hover:text-white transition-colors">
                <UserCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">Encargado</span>
              <span className="text-[9px] text-slate-400">Gestión</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("TECNICO_FIJO")}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50 flex flex-col items-center gap-1 transition-all group cursor-pointer text-center"
            >
              <div className="p-1.5 rounded-lg bg-emerald-100 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white transition-colors">
                <Wrench className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">Técnico</span>
              <span className="text-[9px] text-slate-400">Terreno</span>
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-slate-400 text-xs font-medium text-center">
        Servigaz — Equipos e Instalaciones © {new Date().getFullYear()} • Plataforma Segura
      </footer>
    </div>
  );
}
