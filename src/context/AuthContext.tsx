"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface UserSession {
  id: string;
  nombre: string;
  email: string;
  rol: "ADMIN" | "ENCARGADO" | "TECNICO_FIJO";
  telefono?: string;
  sucursal?: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchDemoRole: (role: "ADMIN" | "ENCARGADO" | "TECNICO_FIJO") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        router.push("/dashboard");
        return { success: true };
      } else {
        return { success: false, error: data.error || "Error al iniciar sesión" };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const switchDemoRole = async (role: "ADMIN" | "ENCARGADO" | "TECNICO_FIJO") => {
    const creds = {
      ADMIN: { email: "admin@servigaz.cl", pass: "Admin123!" },
      ENCARGADO: { email: "encargado@servigaz.cl", pass: "Admin123!" },
      TECNICO_FIJO: { email: "tecnico@servigaz.cl", pass: "Tecnico123!" },
    };
    const c = creds[role];
    await login(c.email, c.pass);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
