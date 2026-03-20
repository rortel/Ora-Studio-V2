import { supabase, API_BASE, publicAnonKey } from "../lib/supabase";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { OraLogo } from "../components/OraLogo";
import { ArrowRight, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../lib/auth-context";

const ADMIN_EMAIL = "romainortel@gmail.com";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, isLoading: authLoading } = useAuth();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // If already authenticated, redirect based on role
  useEffect(() => {
    if (!authLoading && user) {
      // Use profile.role if available, otherwise check email directly
      if (profile?.role === "admin" || user.email.toLowerCase() === ADMIN_EMAIL) {
        navigate("/admin");
      } else {
        navigate("/profile");
      }
    }
  }, [authLoading, user, profile, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        console.error("Sign in error:", authError.message);
        if (authError.message === "Invalid login credentials") {
          setError(
            "Invalid credentials. Either the account doesn't exist yet (click \"Start free\" below to create one) or you signed up via Google (use \"Continue with Google\" instead)."
          );
        } else {
          setError(authError.message);
        }
        return;
      }
      console.log("Signed in:", data.session?.user?.id);
      // Redirect based on email: admin → /admin, others → /profile
      const userEmail = data.session?.user?.email?.toLowerCase() || "";
      if (userEmail === ADMIN_EMAIL) {
        navigate("/admin");
      } else {
        navigate("/profile");
      }
    } catch (err) {
      console.error("Sign in exception:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout for signup
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${publicAnonKey}`,
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ email, password, name, _token: "" }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.error) {
        console.error("Signup error:", data.error);
        if (data.error.includes("already been registered") || data.error.includes("already exists")) {
          setError("This email is already registered. Try signing in instead, or use Google.");
        } else {
          setError(data.error);
        }
        return;
      }

      // Auto sign-in after signup
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Auto sign-in after signup failed:", signInError.message);
        setSuccess("Account created! Please sign in with your credentials.");
        setMode("signin");
        return;
      }

      console.log("Signed up and in:", signInData.session?.user?.id);
      // After signup → subscription page to choose plan
      navigate("/subscribe");
    } catch (err: any) {
      console.error("Signup exception:", err);
      if (err?.name === "AbortError") {
        setError("Server is starting up (cold start). Please try again in a few seconds.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        console.error("Reset password error:", resetError.message);
        setError(resetError.message);
      } else {
        setSuccess("Password reset email sent. Check your inbox.");
      }
    } catch (err) {
      console.error("Reset password exception:", err);
      setError("Failed to send reset email. Please try again.");
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      console.log("[GoogleAuth] Starting signInWithOAuth...");
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/profile`,
          skipBrowserRedirect: true,
        },
      });
      console.log("[GoogleAuth] Response:", { url: data?.url, error: oauthError?.message });
      if (oauthError) {
        console.error("Google OAuth error:", oauthError.message);
        if (oauthError.message.includes("provider is not enabled")) {
          setError(
            "Google login is not yet configured on this Supabase project. Go to Supabase Dashboard → Authentication → Providers → Google and enable it."
          );
        } else {
          setError(oauthError.message);
        }
        setLoading(false);
        return;
      }
      if (data?.url) {
        console.log("[GoogleAuth] Opening auth URL:", data.url);
        // Try multiple redirect strategies — iframe sandboxing can block window.location
        try {
          // Strategy 1: top-level redirect (works if not deeply sandboxed)
          const target = window.top || window.parent || window;
          target.location.href = data.url;
        } catch {
          try {
            // Strategy 2: open in new tab/popup
            const popup = window.open(data.url, "_blank", "noopener,noreferrer");
            if (!popup) {
              // Strategy 3: direct location (fallback)
              window.location.href = data.url;
            }
          } catch {
            window.location.href = data.url;
          }
        }
        return;
      }
      console.warn("[GoogleAuth] No URL returned and no error");
      setError("Google sign-in did not return a redirect URL. Please try again.");
      setLoading(false);
    } catch (err) {
      console.error("Google OAuth exception:", err);
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const switchMode = (newMode: "signin" | "signup" | "reset") => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const titles = {
    signin: { heading: "Welcome back", sub: "Sign in to your ORA account." },
    signup: { heading: "Create your account", sub: "Start free with 50 credits. No credit card." },
    reset: { heading: "Reset password", sub: "We'll send a reset link to your email." },
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <OraLogo size={40} animate={false} />
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7" style={{ background: '#1a1918', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
          <h1
            className="text-center mb-2"
            style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: "#FAFAFA" }}
          >
            {titles[mode].heading}
          </h1>
          <p className="text-center mb-7" style={{ fontSize: '14px', color: "#71717A" }}>
            {titles[mode].sub}
          </p>

          {/* Error message */}
          {error && (
            <div
              className="flex items-start gap-2.5 mb-5 p-3 rounded-lg"
              style={{ background: "rgba(212,24,61,0.06)", border: "1px solid rgba(212,24,61,0.1)" }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--destructive)" }} />
              <span style={{ fontSize: "13px", lineHeight: 1.45, color: "var(--destructive)" }}>
                {error}
              </span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div
              className="flex items-start gap-2.5 mb-5 p-3 rounded-lg"
              style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.1)" }}
            >
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
              <span style={{ fontSize: "13px", lineHeight: 1.45, color: "#16a34a" }}>
                {success}
              </span>
            </div>
          )}

          {/* Google sign in (not shown for reset) */}
          {mode !== "reset" && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 border py-2.5 rounded-lg text-foreground hover:bg-secondary transition-colors mb-5 cursor-pointer disabled:opacity-50"
                style={{ fontSize: '14px', fontWeight: 450, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '12px', color: '#5C5856' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            </>
          )}

          {/* Form */}
          <form
            onSubmit={mode === "signup" ? handleSignUp : mode === "reset" ? handleResetPassword : handleSignIn}
            className="space-y-4"
          >
            {mode === "signup" && (
              <div>
                <label className="block text-foreground mb-1.5" style={{ fontSize: '13px', fontWeight: 450 }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-input-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/40"
                  style={{ fontSize: '14px' }}
                />
              </div>
            )}
            <div>
              <label className="block text-foreground mb-1.5" style={{ fontSize: '13px', fontWeight: 450 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-input-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/40"
                style={{ fontSize: '14px' }}
              />
            </div>
            {mode !== "reset" && (
              <div>
                <label className="block text-foreground mb-1.5" style={{ fontSize: '13px', fontWeight: 450 }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                    required
                    minLength={6}
                    className="w-full bg-input-background border border-border rounded-lg px-3.5 py-2.5 pr-10 text-foreground placeholder:text-muted-foreground/40"
                    style={{ fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-60"
              style={{ fontSize: '14px', fontWeight: 500, color: '#131211', background: '#E8E4DF' }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {mode === "signup" ? "Creating..." : mode === "reset" ? "Sending..." : "Signing in..."}
                </>
              ) : (
                <>
                  {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {mode === "signin" && (
            <p className="text-center mt-4">
              <button
                onClick={() => switchMode("reset")}
                className="text-ora-signal hover:underline cursor-pointer"
                style={{ fontSize: '13px' }}
              >
                Forgot password?
              </button>
            </p>
          )}

          {mode === "reset" && (
            <p className="text-center mt-4">
              <button
                onClick={() => switchMode("signin")}
                className="text-ora-signal hover:underline cursor-pointer"
                style={{ fontSize: '13px' }}
              >
                Back to sign in
              </button>
            </p>
          )}
        </div>

        {/* Toggle signin/signup */}
        {mode !== "reset" && (
          <p className="text-center mt-6 text-muted-foreground" style={{ fontSize: '14px' }}>
            {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
            {" "}
            <button
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              className="text-ora-signal hover:underline cursor-pointer"
              style={{ fontSize: '14px', fontWeight: 500 }}
            >
              {mode === "signup" ? "Sign in" : "Start free"}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}