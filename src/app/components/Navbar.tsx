import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { PulseIcon } from "./PulseMotif";
import { Menu, X, Shield, Zap, LogOut, User } from "lucide-react";
import { useAuth } from "../lib/auth-context";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin, remainingCredits, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isStudio = location.pathname.startsWith("/studio");
  const isHub = location.pathname.startsWith("/hub");
  const isRemix = location.pathname.startsWith("/remix");
  const isFlows = location.pathname.startsWith("/flows");
  const isProfile = location.pathname.startsWith("/profile");
  const isAdminPage = location.pathname.startsWith("/admin");
  const isApp = isHub || isRemix || isFlows || isProfile || isAdminPage;

  const userInitial = user
    ? (user.name?.[0] || user.email?.[0] || "U").toUpperCase()
    : "";

  const planLabel = profile?.plan
    ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)
    : "";

  const marketingLinks = [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Models", href: "/models" },
    { label: "Pricing", href: "/pricing" },
  ];

  const appLinks = [
    { label: "Generate", href: "/hub" },
    { label: "Remix", href: "/remix" },
    { label: "Flows", href: "/flows" },
    { label: "Studio", href: "/studio" },
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  const studioLinks = [
    { label: "Command Center", href: "/studio" },
    { label: "Brand Vault", href: "/studio/vault" },
    { label: "Campaigns", href: "/studio/campaigns" },
    { label: "Analytics", href: "/studio/analytics" },
  ];

  const links = isStudio ? studioLinks : isApp ? appLinks : marketingLinks;

  // Close avatar menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    if (avatarMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen]);

  const handleSignOut = async () => {
    setAvatarMenuOpen(false);
    setMobileOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <PulseIcon size={24} />
          <span
            className="text-foreground"
            style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            ORA
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => {
            const isActive = location.pathname === l.href;
            return (
              <Link
                key={l.href}
                to={l.href}
                className={`transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontSize: '14px', fontWeight: isActive ? 500 : 400 }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isStudio || isApp ? (
            <>
              {/* Credits badge */}
              {profile && !isAdmin && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border" style={{ fontSize: "11px" }}>
                  <Zap size={10} className="text-ora-signal" />
                  <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{remainingCredits}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>credits</span>
                </div>
              )}
              {/* Plan / Admin badge */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-ora-signal-light">
                {isAdmin ? (
                  <>
                    <Shield size={10} className="text-ora-signal" />
                    <span className="text-ora-signal" style={{ fontSize: '12px', fontWeight: 500 }}>Admin</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                    <span className="text-ora-signal" style={{ fontSize: '12px', fontWeight: 500 }}>
                      {planLabel || user?.name || "Workspace"}
                    </span>
                  </>
                )}
              </div>
              {/* Avatar with dropdown */}
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ fontSize: '13px', fontWeight: 600 }}
                >
                  {userInitial}
                </button>
                {avatarMenuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded-xl py-1.5 z-50"
                    style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    <div className="px-3.5 py-2 border-b border-border">
                      <p className="text-foreground truncate" style={{ fontSize: '13px', fontWeight: 500 }}>{user?.name || user?.email}</p>
                      <p className="text-muted-foreground truncate" style={{ fontSize: '11px' }}>{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-3.5 py-2 text-foreground hover:bg-secondary transition-colors"
                      style={{ fontSize: '13px' }}
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      <User size={14} />
                      Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      style={{ fontSize: '13px' }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : user ? (
            <>
              <Link
                to="/hub"
                className="text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontSize: '14px' }}
              >
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 text-ora-signal hover:opacity-80 transition-opacity"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  <Shield size={13} />
                  Admin
                </Link>
              )}
              {/* Avatar with dropdown */}
              <div className="relative" ref={avatarMenuRef}>
                <button
                  onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ fontSize: '13px', fontWeight: 600 }}
                >
                  {userInitial}
                </button>
                {avatarMenuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded-xl py-1.5 z-50"
                    style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    <div className="px-3.5 py-2 border-b border-border">
                      <p className="text-foreground truncate" style={{ fontSize: '13px', fontWeight: 500 }}>{user?.name || user?.email}</p>
                      <p className="text-muted-foreground truncate" style={{ fontSize: '11px' }}>{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-3.5 py-2 text-foreground hover:bg-secondary transition-colors"
                      style={{ fontSize: '13px' }}
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      <User size={14} />
                      Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      style={{ fontSize: '13px' }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontSize: '14px' }}
              >
                Sign in
              </Link>
              <Link
                to="/login?mode=signup"
                className="text-white px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
                style={{ background: 'var(--foreground)', fontSize: '14px', fontWeight: 500 }}
              >
                Start free
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-6 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="block text-muted-foreground hover:text-foreground"
              style={{ fontSize: '15px' }}
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border flex flex-col gap-3">
            {user ? (
              <>
                {profile && !isAdmin && (
                  <div className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                    <Zap size={10} className="text-ora-signal" />
                    {remainingCredits} credits ({planLabel})
                  </div>
                )}
                {isAdmin && (
                  <Link to="/admin" className="flex items-center gap-1.5 text-ora-signal" style={{ fontSize: '15px', fontWeight: 500 }} onClick={() => setMobileOpen(false)}>
                    <Shield size={14} /> Admin
                  </Link>
                )}
                <div className="flex items-center gap-3">
                  <Link to="/hub" className="text-foreground" style={{ fontSize: '15px', fontWeight: 500 }} onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-muted-foreground cursor-pointer"
                    style={{ fontSize: '15px' }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-muted-foreground" style={{ fontSize: '15px' }} onClick={() => setMobileOpen(false)}>Sign in</Link>
                <Link to="/login?mode=signup" className="bg-primary text-primary-foreground px-5 py-2 rounded-full" style={{ fontSize: '15px' }} onClick={() => setMobileOpen(false)}>
                  Start free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}