"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "@/lib/auth-api";
import { ApiError, onSessionLost } from "@/lib/http";
import type { User } from "@/lib/schemas";

interface AuthContextValue {
  /** The logged-in user, or null for a guest. Check `ready` before treating null as a guest. */
  user: User | null;
  /** False until the first "who am I?" check has finished. */
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  /** Log in as the shared test account, without a password. */
  loginQa: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .fetchMe()
      .then((me) => !cancelled && setUser(me))
      .catch((error) => {
        // 401 AUTH_REQUIRED simply means "no session": a guest. Anything else also leaves
        // the user as a guest rather than blocking the app.
        if (!(error instanceof ApiError)) console.error(error);
      })
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // A request found the session dead (refresh failed): behave as logged out everywhere.
  useEffect(() => onSessionLost(() => setUser(null)), []);

  const login = useCallback(async (username: string, password: string) => {
    setUser(await authApi.login(username, password));
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setUser(await authApi.register(username, password));
  }, []);

  const loginQa = useCallback(async () => {
    setUser(await authApi.loginQa());
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, loginQa, logout }),
    [user, ready, login, register, loginQa, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
