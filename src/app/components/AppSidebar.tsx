import { Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Home, FolderOpen, Rocket, Shield, BarChart3, Calendar, User, LogOut, Layers, Music } from "lucide-react";
import { OraLogo } from "./OraLogo";
import { useAuth } from "../lib/auth-context";
import { useState, useRef, useEffect } from "react";

/**
 * AppSidebar — Desktop: micro-sidebar icons-only (~48px, fixed left)
 *              Mobile:  bottom tab bar (fixed bottom, 56px)
 */

const navItems = [
  { icon: Home, label: "Hub", href: "/hub" },
  { icon: FolderOpen, label: "Library", href: "/hub/library" },
  { icon: Music, label: "Music", href: "/hub/music" },
  { icon: Layers, label: "Campaigns", href: "/hub/library?tab=campaigns" },
  { icon: Shield, label: "Vault", href: "/hub/vault" },
  { icon: BarChart3, label: "Analytics", href: "/hub/analytics" },
  { icon: Calendar, label: "Calendar", href: "/hub/calendar" },
];

// Mobile: show only 5 items (skip Analytics on mobile for space)
const mobileNavItems = [
  { icon: Home, label: "Hub", href: "/hub" },
  { icon: FolderOpen, label: "Library", href: "/hub/library" },
  { icon: Music, label: "Music", href: "/hub/music" },
  { icon: Shield, label: "Vault", href: "/hub/vault" },
  { icon: Calendar, label: "Calendar", href: "/hub/calendar" },
];

function isNavActive(href: string, pathname: string, search: string): boolean {
  // Campaigns special case: matches /hub/library?tab=campaigns
  if (href === "/hub/library?tab=campaigns") {
    return pathname === "/hub/library" && search.includes("tab=campaigns");
  }
  // Library: active on /hub/library without campaigns tab
  if (href === "/hub/library") {
    return pathname === "/hub/library" && !search.includes("tab=campaigns");
  }
  // Hub: exact match only
  if (href === "/hub") {
    return pathname === "/hub";
  }
  // Default: starts with
  return pathname.startsWith(href);
}

export function AppSidebar() {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const userInitial = profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      {/* ═══ DESKTOP SIDEBAR ═══ */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-50 hidden md:flex flex-col items-center py-3"
        style={{
          width: 48,
          background: "#131211",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo mark */}
        <Link to="/" className="mb-6 flex items-center justify-center w-full">
          <OraLogo size={22} variant="mark" animate={false} color="#E8E4DF" />
        </Link>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item.href, location.pathname, location.search);

            return (
              <div key={item.href} className="relative w-full flex justify-center">
                <Link
                  to={item.href}
                  onMouseEnter={() => setTooltip(item.label)}
                  onMouseLeave={() => setTooltip(null)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    color: isActive ? "#E8E4DF" : "#5C5856",
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r"
                      style={{ background: "#E8E4DF" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
                {/* Tooltip */}
                <AnimatePresence>
                  {tooltip === item.label && (
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md whitespace-nowrap pointer-events-none z-[100]"
                      style={{
                        background: "#2a2928",
                        border: "1px solid rgba(255,255,255,0.10)",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#E8E4DF",
                      }}
                    >
                      {item.label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Bottom -- avatar */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#E8E4DF",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {userInitial}
          </button>
          <AnimatePresence>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-[52px] bottom-0 w-40 rounded-xl py-1.5 z-[100]"
                style={{
                  background: "#1a1918",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
                }}
              >
                <Link
                  to="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  style={{ fontSize: "13px", fontWeight: 500, color: "#E8E4DF" }}
                >
                  <User size={14} /> Profile
                </Link>
                {profile?.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    style={{ fontSize: "13px", fontWeight: 500, color: "#E8E4DF" }}
                  >
                    <Shield size={14} /> Admin
                  </Link>
                )}
                <button
                  onClick={async () => { setAvatarOpen(false); await signOut(); }}
                  className="flex items-center gap-2.5 px-4 py-2.5 transition-colors w-full text-left hover:bg-[rgba(255,255,255,0.04)]"
                  style={{ fontSize: "13px", fontWeight: 500, color: "#C45B4A" }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ═══ MOBILE BOTTOM TAB BAR ═══ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around"
        style={{
          height: 56,
          background: "rgba(19,18,17,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(item.href, location.pathname, location.search);

          return (
            <Link
              key={item.href}
              to={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors"
              style={{ color: isActive ? "#E8E4DF" : "#5C5856" }}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full"
                    style={{ background: "#E8E4DF" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
              <span style={{ fontSize: "9px", fontWeight: isActive ? 600 : 400, letterSpacing: "0.02em" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}