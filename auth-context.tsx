import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase, API_BASE, publicAnonKey } from "./supabase";

export type PlanTier = "free" | "generate" | "studio";
export type UserRole = "user" | "admin";

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  plan: PlanTier;
  credits: number;
  creditsUsed: number;
  company?: string;
  jobTitle?: string;
  createdAt: string;
  lastLoginAt: string;
}

interface AuthState {
  user: { id: string; email: string; name?: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  remainingCredits: number;
  accessToken: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAuthHeader: () => string;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  remainingCredits: 0,
  accessToken: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  getAuthHeader: () => "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const signingOut = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const clearAuthState = useCallback(() => {
    currentUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    setAccessToken(null);
  }, []);

  const fetchProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    // Don't fetch profile if we're in the process of signing out
    if (signingOut.current) return null;

    // Single attempt with short timeout — server now decodes JWT locally, should be fast
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000); // 8s timeout
      
      // FIX: Use same pattern as HubPage — publicAnonKey in Authorization, user token in X-User-Token
      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;
      
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      console.log(`fetchProfile OK in ${Date.now() - t0}ms, authenticated=${data.authenticated}`);
      if (data.authenticated && data.profile) {
        if (!signingOut.current) {
          setProfile(data.profile);
          return data.profile;
        }
      } else {
        console.log("fetchProfile: not authenticated", data?.error);
      }
      return null;
    } catch (err) {
      console.log(`fetchProfile failed after ${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
      // On failure, create a minimal profile from the JWT token itself
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (payload?.sub && payload?.email && !signingOut.current) {
            const fallbackProfile: UserProfile = {
              userId: payload.sub,
              email: payload.email,
              name: payload.user_metadata?.name || payload.email.split("@")[0],
              role: payload.email.toLowerCase() === "romainortel@gmail.com" ? "admin" : "user",
              plan: payload.email.toLowerCase() === "romainortel@gmail.com" ? "studio" : "free",
              credits: payload.email.toLowerCase() === "romainortel@gmail.com" ? 999999 : 10,
              creditsUsed: 0,
              company: "",
              jobTitle: "",
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };
            console.log("fetchProfile: using JWT fallback profile");
            setProfile(fallbackProfile);
            return fallbackProfile;
          }
        }
      } catch (e2) { /* ignore JWT decode failure */ }
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (accessToken && !signingOut.current) await fetchProfile(accessToken);
  }, [accessToken, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || signingOut.current) return;
      if (data.session?.user) {
        const u = data.session.user;
        currentUserIdRef.current = u.id;
        setUser({
          id: u.id,
          email: u.email ?? "",
          name: (u.user_metadata as any)?.name ?? (u.user_metadata as any)?.full_name ?? "",
        });
        setAccessToken(data.session.access_token);
        // Fetch profile in background — don't block isLoading
        fetchProfile(data.session.access_token);
      }
      if (mounted) setIsLoading(false);
    });

    // Listen for auth changes (login, logout, Google OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log("[Auth] onAuthStateChange event:", event);

      // If signing out, always clear and ignore any session data
      if (event === "SIGNED_OUT" || signingOut.current) {
        clearAuthState();
        if (mounted) setIsLoading(false);
        return;
      }

      if (session?.user) {
        const u = session.user;
        const previousUserId = currentUserIdRef.current;
        const userChanged = previousUserId !== null && previousUserId !== u.id;
        
        // Only clear profile if the user actually changed (prevents race with INITIAL_SESSION)
        if (userChanged) {
          console.log("[Auth] User changed from", previousUserId, "to", u.id, "— clearing stale profile");
          setProfile(null);
        }
        
        currentUserIdRef.current = u.id;
        setUser({
          id: u.id,
          email: u.email ?? "",
          name: (u.user_metadata as any)?.name ?? (u.user_metadata as any)?.full_name ?? "",
        });
        setAccessToken(session.access_token);
        // Fetch profile in background — don't block UI
        fetchProfile(session.access_token);
      } else {
        clearAuthState();
      }
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, clearAuthState]);

  const signOut = useCallback(async () => {
    console.log("[Auth] signOut called");
    signingOut.current = true;
    
    // Immediately clear UI state
    clearAuthState();

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }

    // Manually clear Supabase localStorage tokens as fallback
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("[Auth] localStorage cleanup error:", e);
    }

    setTimeout(() => {
      signingOut.current = false;
    }, 500);
  }, [clearAuthState]);

  const getAuthHeader = useCallback(() => {
    return accessToken || "";
  }, [accessToken]);

  const isAdmin = profile?.role === "admin";
  const remainingCredits = isAdmin ? 999999 : Math.max(0, (profile?.credits || 0) - (profile?.creditsUsed || 0));

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isLoading,
      isAdmin,
      remainingCredits,
      accessToken,
      signOut,
      refreshProfile,
      getAuthHeader,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}