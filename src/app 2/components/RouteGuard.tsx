import { useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth, type Feature, requiredPlan } from "../lib/auth-context";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { PulseIcon } from "./PulseMotif";

interface RouteGuardProps {
  children: React.ReactNode;
  /** If set, user must be logged in */
  requireAuth?: boolean;
  /** If set, user must have access to this feature */
  requireFeature?: Feature;
  /** If set, user must be admin */
  requireAdmin?: boolean;
}

export function RouteGuard({ children, requireAuth: needsAuth = true, requireFeature, requireAdmin }: RouteGuardProps) {
  const { user, isLoading, isAdmin, can, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && needsAuth && !user) {
      navigate("/login");
    }
  }, [isLoading, needsAuth, user, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in
  if (needsAuth && !user) {
    return null; // useEffect will redirect
  }

  // Profile still loading (user exists but profile not yet fetched)
  if (needsAuth && user && !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Admin check
  if (requireAdmin && !isAdmin) {
    return <AccessDenied reason="admin" />;
  }

  // Feature check
  if (requireFeature && !can(requireFeature)) {
    const minPlan = requiredPlan(requireFeature);
    return <UpgradeRequired feature={requireFeature} minPlan={minPlan} />;
  }

  return <>{children}</>;
}

function AccessDenied({ reason }: { reason: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-[400px]">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={20} style={{ color: "var(--destructive)" }} />
        </div>
        <h2 style={{ fontSize: "20px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", marginBottom: "8px" }}>
          Access restricted
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: "20px" }}>
          {reason === "admin" 
            ? "This page is restricted to administrators."
            : "You don't have permission to access this page."}
        </p>
        <Link
          to="/hub"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          Back to Hub
        </Link>
      </div>
    </div>
  );
}

function UpgradeRequired({ feature, minPlan }: { feature: Feature; minPlan: string }) {
  const featureLabels: Record<Feature, string> = {
    hub: "AI Hub",
    vault: "Brand Vault",
    analytics: "Analytics",
    campaignLab: "Campaign Lab",
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-[440px]">
        <div className="flex justify-center mb-5">
          <PulseIcon size={48} />
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", marginBottom: "8px" }}>
          {featureLabels[feature] || feature} requires {minPlan.charAt(0).toUpperCase() + minPlan.slice(1)}
        </h2>
        <p style={{ fontSize: "15px", color: "var(--muted-foreground)", lineHeight: 1.55, marginBottom: "24px" }}>
          Upgrade your plan to unlock {featureLabels[feature]?.toLowerCase() || feature} and all its capabilities.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/subscribe"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--ora-signal)", fontSize: "14px", fontWeight: 500 }}
          >
            Upgrade to {minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} <ArrowRight size={14} />
          </Link>
          <Link
            to="/hub"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors"
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            Back to Hub
          </Link>
        </div>
      </div>
    </div>
  );
}