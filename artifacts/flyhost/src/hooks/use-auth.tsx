import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, LoginBody, RegisterBody } from "@workspace/api-client-react";
import { api } from "@/lib/api-interceptor"; // Import patched api functions

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginBody) => Promise<void>;
  register: (data: RegisterBody) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Patch global fetch to ALWAYS include the token for API requests
  // This ensures generated TanStack Query hooks automatically authenticate
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      if (typeof resource === 'string' && resource.startsWith('/api')) {
        const token = localStorage.getItem('flyhost_token');
        if (token) {
          config = config || {};
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`
          };
        }
      }
      return originalFetch(resource, config);
    };

    // Initialize user session
    const initAuth = async () => {
      const token = localStorage.getItem('flyhost_token');
      if (token) {
        try {
          const res = await window.fetch('/api/auth/me');
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            localStorage.removeItem('flyhost_token');
          }
        } catch (e) {
          console.error("Auth initialization failed", e);
        }
      }
      setIsLoading(false);
    };

    initAuth();
    
    return () => {
      window.fetch = originalFetch; // Cleanup on unmount
    };
  }, []);

  const login = async (data: LoginBody) => {
    const res = await window.fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to login");
    }
    
    const { token, user } = await res.json();
    localStorage.setItem('flyhost_token', token);
    setUser(user);
    queryClient.invalidateQueries();
  };

  const register = async (data: RegisterBody) => {
    const res = await window.fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to register");
    }
    
    const { token, user } = await res.json();
    localStorage.setItem('flyhost_token', token);
    setUser(user);
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    try {
      await window.fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('flyhost_token');
      setUser(null);
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
