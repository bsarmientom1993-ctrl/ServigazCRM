"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme} className="theme-toggle" aria-label="Modo oscuro" aria-pressed={theme === "dark"} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
    {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Oscuro"}</span>
  </button>;
}
