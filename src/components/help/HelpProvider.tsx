"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Package, Sparkles, UserRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { guideSteps, guideStorageKey, hasSeenGuide } from "@/lib/help-guide";
const HelpContext = createContext({ openGuide: () => {} });
export function useHelp() { return useContext(HelpContext); }
const icons = { welcome: Sparkles, client: UserRound, calendar: CalendarDays, stock: Package, check: CheckCircle2, practice: BookOpen };
export function HelpProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const key = user ? guideStorageKey(user.id) : "";
  const close = useCallback((completed = false) => {
    if (key) try { localStorage.setItem(key, completed ? "completed" : "dismissed"); } catch { /* The guide remains usable without local storage. */ }
    setOpen(false);
  }, [key]);
  const openGuide = useCallback(() => { setStep(0); setOpen(true); }, []);
  useEffect(() => {
    if (!key) return;
    if(user?.rol === "ENCARGADO_TIENDA"){setOpen(false);return;}
    try { setOpen(!hasSeenGuide(localStorage.getItem(key))); } catch { setOpen(true); }
    setStep(0);
  }, [key]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") || []).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [open, close]);
  useEffect(() => { if (open) heading.current?.focus(); }, [step, open]);
  const steps = guideSteps(user?.rol || "ENCARGADO"), current = steps[step];
  const Icon = icons[current.icon];
  return <HelpContext.Provider value={{ openGuide }}><div inert={open}>{children}</div>
    {open && user && <div className="welcome-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" className="welcome-dialog">
      <div className="flex justify-between gap-3 items-center"><p className="module-eyebrow !mb-0">TU GUÍA EN SERVIGAZ · {step + 1} DE {steps.length}</p><button type="button" className="theme-toggle" aria-label="Cerrar guía" onClick={() => close()}><X size={18} /></button></div>
      <div className="welcome-art" aria-hidden="true"><div className="welcome-icon"><Icon size={42} strokeWidth={1.5} /></div><div className="flex items-center gap-2 mt-5 text-[10px] font-semibold"><span>CLIENTE</span><ArrowRight size={12} /><span>TRABAJO</span><ArrowRight size={12} /><span>CIERRE</span></div></div>
      <div className="space-y-3"><h2 id="welcome-title" ref={heading} tabIndex={-1} className="text-2xl sm:text-3xl font-semibold text-ink outline-none">{current.title}</h2><p id="welcome-description" className="text-sm text-secondary leading-relaxed">{current.description}</p><ul className="space-y-2 text-sm text-secondary">{current.points.map(point => <li className="flex gap-2 items-start" key={point}><CheckCircle2 className="shrink-0 text-[#F06529] mt-0.5" size={16} /><span>{point}</span></li>)}</ul></div>
      <div className="flex justify-center gap-2" aria-label="Progreso de la guía">{steps.map((item, index) => <button type="button" key={item.title} aria-label={"Ir al paso " + (index + 1) + ": " + item.title} aria-current={index === step ? "step" : undefined} className={"welcome-dot" + (index === step ? " active" : "")} onClick={() => setStep(index)} />)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">{step > 0 ? <button type="button" className="theme-toggle" onClick={() => setStep(n => n - 1)}><ArrowLeft size={16} />Anterior</button> : <button type="button" className="theme-toggle" onClick={() => close()}>Ver después</button>}{step < steps.length - 1 ? <button type="button" className="primary-action" onClick={() => setStep(n => n + 1)}>Siguiente<ArrowRight size={16} /></button> : <Link className="primary-action" href="/ayuda#ejemplos" onClick={() => close(true)}>Practicar con ejemplos<ArrowRight size={16} /></Link>}</div>
      <div className="text-center text-xs text-muted">{step === steps.length - 1 ? <button type="button" className="underline" onClick={() => close(true)}>Empezar a trabajar</button> : <Link className="underline" href="/ayuda" onClick={() => close()}>Abrir el centro de ayuda</Link>}</div>
    </div></div>}
  </HelpContext.Provider>;
}
