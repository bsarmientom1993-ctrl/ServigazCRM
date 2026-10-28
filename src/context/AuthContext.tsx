"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface UserSession {
  id: string;
  nombre: string;
  email: string;
  rol: "ADMIN" | "ENCARGADO" | "TECNICO_FIJO" | "ENCARGADO_TIENDA";
  telefono?: string;
  sucursal?: string;
  sucursalId?: string | null;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
        router.push(data.user.rol === "ENCARGADO_TIENDA" ? "/inventario" : data.user.rol === "TECNICO_FIJO" ? "/agenda" : "/dashboard");
        return { success: true };
      } else {
        return { success: false, error: data.error || "Error al iniciar sesión" };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: fetchSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
