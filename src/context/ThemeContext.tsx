"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { themeStorageKey } from "@/lib/theme";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);
function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      try { const saved = localStorage.getItem(themeStorageKey); if (saved === "light" || saved === "dark") return; } catch {}
      const next = media.matches ? "dark" : "light";
      apply(next); setTheme(next);
    };
    const sync = (event: StorageEvent) => {
      if (event.key !== themeStorageKey && event.key !== null) return;
      const next = event.newValue === "dark" || event.newValue === "light" ? event.newValue : media.matches ? "dark" : "light";
      apply(next); setTheme(next);
    };
    media.addEventListener("change", followSystem);
    window.addEventListener("storage", sync);
    return () => { media.removeEventListener("change", followSystem); window.removeEventListener("storage", sync); };
  }, []);
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(next); setTheme(next);
    try { localStorage.setItem(themeStorageKey, next); } catch {}
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider no está disponible.");
  return value;
}
