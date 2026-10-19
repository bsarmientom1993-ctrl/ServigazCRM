"use client";
import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Wrench, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await login(email.trim(), password);
      if (!result.success) setError(result.error || "No se pudo iniciar sesión.");
    } finally { setLoading(false); }
  };
  return <main className="login-shell">
    <section className="login-story" aria-label="Servigaz, gestión de servicios">
      <div className="story-grid" aria-hidden="true" />
      <div className="login-brand">
        <div className="brand-mark"><Image src="/logo.jpg" alt="Servigaz" width={54} height={54} priority /></div>
        <div><span className="block text-xl font-semibold tracking-tight">SERVIGAZ<span className="text-orange-400">.</span></span><span className="text-xs text-slate-300">Equipos e instalaciones</span></div>
      </div>
      <div className="story-copy">
        <p className="story-eyebrow"><span /> CONECTA CADA ETAPA</p>
        <h1>Tu operación,<br />con todo<br /><span>bajo control.</span></h1>
        <p className="story-description">Del primer contacto al trabajo terminado.<br className="hidden xl:block" /> Un espacio para organizar lo que importa.</p>
        <div className="story-features">
          {[{ icon: Users, title: "Más cerca de tus clientes", description: "Contactos, cotizaciones y seguimiento." },
            { icon: Wrench, title: "Cada trabajo en su lugar", description: "Agenda, equipo y ejecución conectados." },
            { icon: Wallet, title: "Claridad en cada cobro", description: "Pagos y cierre de tus órdenes." }].map(item =>
            <div className="story-feature" key={item.title}><span><item.icon size={20} strokeWidth={1.6} /></span><div><p>{item.title}</p><small>{item.description}</small></div></div>)}
        </div>
      </div>
      <div className="story-footer"><span className="flex items-center gap-2"><span className="status-dot" /> Gestión comercial y operativa</span><span>Hecho para avanzar.</span></div>
    </section>
    <section className="login-form-side" aria-labelledby="login-heading">
      <div className="login-toolbar"><span className="text-sm font-semibold text-ink lg:invisible">SERVIGAZ<span className="text-[#F06529]">.</span></span><ThemeToggle /></div>
      <div className="login-form-wrap">
        <span className="login-lock"><LockKeyhole size={22} strokeWidth={1.6} /></span>
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted mt-7 mb-3">Bienvenido a tu espacio</p>
        <h2 id="login-heading">Todo listo para<br />un nuevo día.</h2>
        <p className="text-muted text-sm leading-6 mt-4 mb-9">Ingresa a tu cuenta para continuar con la gestión de tus servicios.</p>
        {error && <div role="alert" className="login-error">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label htmlFor="email" className="form-label">Correo electrónico</label><div className="login-input-wrap"><Mail size={18} /><input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@servigaz.com" disabled={loading} /></div></div>
          <div><label htmlFor="password" className="form-label">Contraseña</label><div className="login-input-wrap"><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" disabled={loading} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} disabled={loading}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <button type="submit" disabled={loading} className="login-submit">{loading ? <><Loader2 size={18} className="animate-spin" /> Ingresando...</> : <>Ingresar al sistema<ArrowRight size={18} /></>}</button>
        </form>
        <div className="login-security"><ShieldCheck size={16} /><span>Acceso seguro para tu equipo de trabajo</span></div>
        <div className="login-workflow" aria-label="Etapas del servicio">{["Solicitud", "Cotización", "Ejecución", "Cierre"].map((step, index) => <span key={step}><i>{index === 3 ? <Check size={10} /> : index + 1}</i>{step}</span>)}</div>
      </div>
      <footer className="login-footer">© {new Date().getFullYear()} Servigaz <span>Organiza. Conecta. Avanza.</span></footer>
    </section>
  </main>;
}
