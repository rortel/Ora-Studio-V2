import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Zap,
  Sparkles,
  Crown,
  Check,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { PulseIcon } from "../components/PulseMotif";
import { useAuth } from "../lib/auth-context";
import { API_BASE, publicAnonKey } from "../lib/supabase";

interface PlanOption {
  id: "free" | "generate" | "studio";
  name: string;
  price: string;
  period: string;
  credits: string;
  description: string;
  features: string[];
  icon: typeof Zap;
  highlighted: boolean;
}

const plans: PlanOption[] = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "",
    credits: "50 credits",
    description: "Explore ORA with no commitment.",
    features: [
      "50 credits included",
      "3 AI models (GPT-4o, Claude, Gemini)",
      "Text and image generation",
      "Basic Arena (2 models)",
      "Credits never expire",
    ],
    icon: Zap,
    highlighted: false,
  },
  {
    id: "generate",
    name: "Pro",
    price: "\u20AC39",
    period: "/month",
    credits: "500 credits/month",
    description: "Every model, every format.",
    features: [
      "500 credits/month included",
      "All AI models (10+)",
      "Text, image, code, audio, video",
      "Full Arena (unlimited models)",
      "Priority generation queue",
      "Credit packs available",
    ],
    icon: Sparkles,
    highlighted: true,
  },
  {
    id: "studio",
    name: "Business",
    price: "\u20AC149",
    period: "/month",
    credits: "2,500 credits/month",
    description: "On-brand content at scale.",
    features: [
      "2,500 credits/month included",
      "Everything in Pro +",
      "Brand Vault (brand identity)",
      "Campaign Lab (multi-platform)",
      "Canvas editor & Asset Builder",
      "Brand Score & Content Calendar",
      "Priority support",
    ],
    icon: Crown,
    highlighted: false,
  },
];

export function SubscribePage() {
  const navigate = useNavigate();
  const { user, profile, accessToken, isLoading: authLoading, refreshProfile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?mode=signup");
    }
  }, [authLoading, user, navigate]);

  const handleChoosePlan = async (planId: string) => {
    setSelectedPlan(planId);
    setLoading(true);
    setError("");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (accessToken) headers["X-User-Token"] = accessToken;

      const res = await fetch(`${API_BASE}/auth/choose-plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();

      if (data.error) {
        console.error("Choose plan error:", data.error);
        setError(data.error);
        setLoading(false);
        return;
      }

      console.log("Plan chosen:", planId, data.profile);
      // Refresh profile in auth context then redirect
      await refreshProfile();
      navigate("/profile");
    } catch (err) {
      console.error("Choose plan exception:", err);
      setError("Failed to activate plan. Please try again.");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[960px] mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <PulseIcon size={28} />
            <span
              className="text-foreground"
              style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              ORA
            </span>
          </div>
          <h1
            className="text-foreground mb-3"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Welcome{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}. Choose your plan.
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px", lineHeight: 1.5 }}>
            Start free or unlock the full power of ORA. You can upgrade anytime.
          </p>
        </motion.div>

        {/* Error */}
        {error && (
          <div
            className="max-w-[400px] mx-auto mb-8 p-3 rounded-lg text-center"
            style={{
              background: "rgba(212,24,61,0.06)",
              border: "1px solid rgba(212,24,61,0.1)",
              fontSize: "13px",
              color: "var(--destructive)",
            }}
          >
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            const isLoading = isSelected && loading;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative border rounded-xl bg-card p-6 flex flex-col ${
                  plan.highlighted ? "border-ora-signal" : "border-border"
                }`}
                style={{
                  boxShadow: plan.highlighted
                    ? "0 1px 3px rgba(0,0,0,0.04), 0 12px 40px rgba(59,79,196,0.08)"
                    : "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                {/* Popular badge */}
                {plan.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white"
                    style={{
                      background: "var(--ora-signal)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: plan.highlighted
                          ? "var(--ora-signal-light)"
                          : "var(--secondary)",
                      }}
                    >
                      <Icon
                        size={15}
                        style={{
                          color: plan.highlighted
                            ? "var(--ora-signal)"
                            : "var(--muted-foreground)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 500,
                        color: "var(--foreground)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {plan.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      style={{
                        fontSize: "32px",
                        fontWeight: 500,
                        color: "var(--foreground)",
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                      }}
                    >
                      {plan.price === "0" ? "Free" : plan.price}
                    </span>
                    {plan.period && (
                      <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
                    style={{
                      background: plan.highlighted
                        ? "var(--ora-signal-light)"
                        : "var(--secondary)",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: plan.highlighted
                        ? "var(--ora-signal)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    <Zap size={10} />
                    {plan.credits}
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.45 }}>
                    {plan.description}
                  </p>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check
                        size={13}
                        className="flex-shrink-0 mt-0.5"
                        style={{
                          color: plan.highlighted
                            ? "var(--ora-signal)"
                            : "var(--muted-foreground)",
                        }}
                      />
                      <span style={{ fontSize: "13px", color: "var(--foreground)", lineHeight: 1.4 }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg transition-all cursor-pointer disabled:opacity-60 ${
                    plan.highlighted
                      ? "text-white hover:opacity-90"
                      : "border border-border-strong text-foreground hover:bg-secondary"
                  }`}
                  style={{
                    background: plan.highlighted ? "var(--ora-signal)" : undefined,
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      {plan.id === "free" ? "Continue with Free" : `Start ${plan.name}`}
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-muted-foreground"
          style={{ fontSize: "12px" }}
        >
          No credit card required for the Free plan. You can upgrade or change plans at any time.
        </motion.p>
      </div>
    </div>
  );
}