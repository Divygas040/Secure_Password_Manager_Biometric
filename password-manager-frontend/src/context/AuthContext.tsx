"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';

export interface User { id: number; username: string; email: string; face_enrolled: boolean; vault_unlocked: boolean; }
interface AuthState { user: User | null; loading: boolean; refreshUser: () => Promise<void>; logout: () => Promise<void>; }
const AuthContext = createContext<AuthState | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = useCallback(async () => {
    try { setUser(await api<User>('/api/users/me/')); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Remove obsolete credentials from installations of the previous client.
    try { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); } catch { /* Storage may be disabled. */ }
    void refreshUser();
  }, [refreshUser]);
  const logout = useCallback(async () => {
    await api('/api/users/logout/', { method: 'POST' });
    setUser(null);
  }, []);
  return <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider required.');
  return context;
}
