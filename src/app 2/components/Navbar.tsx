import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Menu, X, Shield, LogOut, User } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { motion, AnimatePresence } from "motion/react";
import { OraLogo } from "./OraLogo";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const isHub = location.pathname.startsWith("/hub");
  const isLanding = location.pathname === "/";

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const marketingLinks = [
    { label: "Models", href: "/models" },
    { label: "Pricing", href: "/pricing" },
  ];
  const hubLinks = [
    { label: "Hub", href: "/hub" },
    { label: "Library", href: "/hub/library" },
    { label: "Brand Vault", href: "/hub/vault" },
    { label: "Analytics", href: "/hub/analytics" },
    { label: "Calendar", href: "/hub/calendar" },
  ];
  const links = isHub ? hubLinks : marketingLinks;
  const userInitial = profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  const handleSignOut = async () => { setAvatarMenuOpen(false); await signOut(); navigate("/"); };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-500"
        style={{
          background: isLanding && !scrolled
            ? "rgba(19,18,17,0.2)"
            : "rgba(19,18,17,0.85)",
          borderBottom: isLanding && !scrolled
            ? "1px solid transparent"
            : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <OraLogo size={30} animate={false} color="#E8E4DF" />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = location.pathname === l.href;
              return (
                <Link
                  key={l.href}
                  to={l.href}
                  className="px-4 py-2 rounded-lg transition-all"
                  style={{
                    fontSize: "13px",
                    fontWeight: active ? 500 : 400,
                    color: active ? "#E8E4DF" : "#5C5856",
                    background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            {isHub && user ? (
              <>
                {profile?.role === "admin" && (
                  <Link to="/admin" className="p-2.5 rounded-lg transition-colors" style={{ color: "#9A9590" }}>
                    <Shield size={16} />
                  </Link>
                )}
                <div className="relative" ref={avatarMenuRef}>
                  <button
                    onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                    className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                    style={{
                      background: "rgba(255,255,255,0.10)",
                      color: "#E8E4DF",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {userInitial}
                  </button>
                  <AnimatePresence>
                    {avatarMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                        className="absolute right-0 top-11 w-44 rounded-xl py-1.5 z-50"
                        style={{
                          background: "#1a1918",
                          border: "1px solid rgba(255,255,255,0.10)",
                          boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
                        }}
                      >
                        <Link
                          to="/profile"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                          style={{ fontSize: "13px", fontWeight: 500, color: "#E8E4DF" }}
                        >
                          <User size={14} /> Profile
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2.5 px-4 py-2.5 transition-colors w-full text-left"
                          style={{ fontSize: "13px", fontWeight: 500, color: "#C45B4A" }}
                        >
                          <LogOut size={14} /> Sign out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : user ? (
              <Link
                to="/hub"
                className="px-5 py-2 rounded-lg transition-all hover:opacity-90"
                style={{
                  background: "#E8E4DF",
                  color: "#131211",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="transition-colors"
                  style={{ fontSize: "13px", fontWeight: 400, color: "#5C5856" }}
                >
                  Sign in
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="px-5 py-2 rounded-lg transition-all hover:opacity-90"
                  style={{
                    background: "#E8E4DF",
                    color: "#131211",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  Start free
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" style={{ color: "#E8E4DF" }} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "#131211" }}
          >
            <div className="flex items-center justify-between px-6 h-14">
              <OraLogo size={28} animate={false} color="#E8E4DF" />
              <button onClick={() => setMobileOpen(false)} style={{ color: "#E8E4DF" }}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col justify-center px-8 gap-3">
              {links.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                >
                  <Link
                    to={l.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      fontSize: "clamp(2rem, 6vw, 3.5rem)",
                      fontWeight: 500,
                      color: "#E8E4DF",
                      letterSpacing: "-0.04em",
                      lineHeight: 1.1,
                      display: "block",
                    }}
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="px-8 pb-12 flex gap-4"
            >
              {user ? (
                <Link
                  to="/hub"
                  onClick={() => setMobileOpen(false)}
                  className="px-8 py-4 rounded-lg"
                  style={{ background: "#E8E4DF", color: "#131211", fontSize: "16px", fontWeight: 500 }}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login?mode=signup"
                    onClick={() => setMobileOpen(false)}
                    className="px-8 py-4 rounded-lg"
                    style={{ background: "#E8E4DF", color: "#131211", fontSize: "16px", fontWeight: 500 }}
                  >
                    Start free
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="px-6 py-4"
                    style={{ fontSize: "16px", fontWeight: 400, color: "#5C5856" }}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}