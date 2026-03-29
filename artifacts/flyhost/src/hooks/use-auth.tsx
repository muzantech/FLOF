import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoginBody, RegisterBody } from "@workspace/api-client-react";

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  role?: string;
  coins?: number;
  referralCode?: string | null;
  onboardingDone?: boolean;
  emailVerified?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginBody) => Promise<{ dailyCoins?: number }>;
  register: (data: RegisterBody) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Patch global fetch to ALWAYS include the token for API requests
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      if (typeof resource === "string" && resource.startsWith("/api")) {
        const token = localStorage.getItem("flyhost_token");
        if (token) {
          config = config || {};
          const existing = config.headers instanceof Headers
            ? Object.fromEntries((config.headers as Headers).entries())
            : (config.headers as Record<string, string> || {});
          config.headers = {
            ...existing,
            Authorization: `Bearer ${token}`,
          };
        }
      }
      return originalFetch(resource, config);
    };

    const initAuth = async () => {
      const token = localStorage.getItem("flyhost_token");
      if (token) {
        try {
          const res = await window.fetch("/api/auth/me");
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            localStorage.removeItem("flyhost_token");
          }
        } catch (e) {
          console.error("Auth initialization failed", e);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const refreshUser = async () => {
    try {
      const res = await window.fetch("/api/auth/me");
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (e) {
      console.error("Failed to refresh user", e);
    }
  };

  const login = async (data: LoginBody): Promise<{ dailyCoins?: number }> => {
    const res = await window.fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to login");
    }

    const { token, user } = await res.json();
    localStorage.setItem("flyhost_token", token);
    setUser(user);
    queryClient.invalidateQueries();

    // Claim daily login coins
    let dailyCoins = 0;
    try {
      const dailyRes = await window.fetch("/api/auth/daily-login", { method: "POST" });
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        if (dailyData.success) {
          dailyCoins = dailyData.coinsEarned;
          // Refresh user to get updated coins
          await refreshUser();
        }
      }
    } catch (e) {
      // Silent fail — don't block login
    }

    return { dailyCoins };
  };

  const register = async (data: RegisterBody) => {
    const res = await window.fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to register");
    }

    const { token, user } = await res.json();
    localStorage.setItem("flyhost_token", token);
    setUser(user);
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    try {
      await window.fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore
    } finally {
      localStorage.removeItem("flyhost_token");
      setUser(null);
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
