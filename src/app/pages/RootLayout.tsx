import { Outlet, useLocation } from "react-router";
import { useEffect, Suspense } from "react";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AppSidebar } from "../components/AppSidebar";
import { Loader2 } from "lucide-react";

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin" style={{ color: "#5E6AD2" }} />
    </div>
  );
}

export function RootLayout() {
  const location = useLocation();
  const isHub = location.pathname.startsWith("/hub");
  const isProfile = location.pathname.startsWith("/profile");
  const isAdmin = location.pathname.startsWith("/admin");
  const isSubscribe = location.pathname.startsWith("/subscribe");
  const isAppView = isHub || isProfile || isAdmin || isSubscribe;

  // Only scroll to top on actual page navigation (pathname change), not on search param changes
  // Skip scroll-to-top for /hub paths to avoid disrupting Campaign Lab and other stateful views
  useEffect(() => { if (!location.hash && !isHub) window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-screen" style={{ background: "#131211", color: "#E8E4DF" }}>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#222120",
            color: "#E8E4DF",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "13px",
            fontFamily: "var(--font-family)",
            fontWeight: 500,
            borderRadius: "0.75rem",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          },
        }}
      />

      {isAppView ? (
        /* -- App view: sidebar (desktop) + bottom tab bar (mobile) -- */
        <>
          <AppSidebar />
          {/* Desktop: margin-left for sidebar. Mobile: no margin, but padding-bottom for tab bar */}
          <main className="min-h-screen md:ml-[48px] pb-[56px] md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                className="min-h-screen"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      ) : (
        /* -- Marketing view: top navbar + content + footer -- */
        <>
          <Navbar />
          <main className="pt-14">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}