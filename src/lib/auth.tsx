'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'admin' | 'instructor' | 'competitor';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  bio: string;
  course: string;
  class_group: string;
  department: string;
  xp_points: number;
  shells: number;
  level: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  sessionKey: number;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 1 hour idle timeout
const IDLE_TIMEOUT = 60 * 60 * 1000;
// Check idle every 60 seconds
const IDLE_CHECK_INTERVAL = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const supabase = createClient();

  // Track last user activity for idle logout
  const lastActivityRef = useRef<number>(Date.now());
  const isSigningOutRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Error fetching profile:', error.message);
        return;
      }
      if (data) setProfile(data as Profile);
    } catch (err) {
      console.error('fetchProfile exception:', err);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ─── Auth state listener ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Safety timeout: if auth takes too long, stop loading anyway
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth init timed out, forcing loading=false');
        setLoading(false);
        setInitialized(true);
      }
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id).catch(() => {});
        } else if (event === 'SIGNED_OUT') {
          // Only clear user on explicit sign-out, not on transient null during token refresh
          setUser(null);
          setProfile(null);
        }
        // For INITIAL_SESSION with null session (not logged in) — also clear
        if (event === 'INITIAL_SESSION' && !session) {
          setUser(null);
          setProfile(null);
        }

        setLoading(false);
        setInitialized(true);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Activity tracking + idle logout ───────────────────────────────
  useEffect(() => {
    // Reset activity timestamp on any user interaction
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'pointerdown'];
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    // Periodically check if user has been idle for longer than the timeout
    const idleChecker = setInterval(() => {
      if (!user || isSigningOutRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT) {
        console.info(`User idle for ${Math.round(idle / 60000)} min — signing out`);
        isSigningOutRef.current = true;
        supabase.auth.signOut().then(() => {
          setUser(null);
          setProfile(null);
        });
      }
    }, IDLE_CHECK_INTERVAL);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(idleChecker);
    };
  }, [user, supabase]);

  // ─── Proactive session refresh when tab becomes visible ────────────
  useEffect(() => {
    let hiddenAt = 0;
    const VISIBILITY_THRESHOLD = 5 * 60_000; // 5 minutes hidden

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;

        // Reset activity on tab return (user is actively using the app)
        lastActivityRef.current = Date.now();

        if (elapsed > VISIBILITY_THRESHOLD && user) {
          // Tab was hidden for a while — refresh token proactively
          supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
            if (freshUser) {
              setUser(freshUser);
              fetchProfile(freshUser.id);
            }
            // If user is null, don't force logout here; let idle timer handle it
          }).catch(() => {
            // Network error — silently ignore, don't logout
          });
        }
        hiddenAt = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const signIn = async (email: string, password: string) => {
    isSigningOutRef.current = false;
    lastActivityRef.current = Date.now();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    return { error: error?.message || null };
  };

  const signOut = useCallback(async () => {
    isSigningOutRef.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, initialized, sessionKey, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
