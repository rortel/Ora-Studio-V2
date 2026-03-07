import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function RootLayout() {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/studio");
  const isHub = location.pathname.startsWith("/hub");
  const isRemix = location.pathname.startsWith("/remix");
  const isFlows = location.pathname.startsWith("/flows");
  const isProfile = location.pathname.startsWith("/profile");
  const isAdmin = location.pathname.startsWith("/admin");
  const isSubscribe = location.pathname.startsWith("/subscribe");
  const isAppView = isStudio || isHub || isRemix || isFlows || isProfile || isAdmin || isSubscribe;

  // Scroll to top on route change, unless it's a hash link
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-14">
        <Outlet />
      </main>
      {!isAppView && <Footer />}
    </div>
  );
}