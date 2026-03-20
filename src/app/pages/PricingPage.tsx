import { motion } from "motion/react";
import { Check, Minus, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router";
import { FAQ } from "../components/FAQ";

const plans = [
  {
    name: "Starter",
    price: "\u20AC29",
    period: "/month",
    audience: "For individuals getting started with AI content.",
    credits: "200 credits/month",
    features: [
      "200 credits/month included",
      "10 AI models (GPT-4o, Claude, Gemini, etc.)",
      "Text and image generation",
      "Basic Arena (2 models)",
      "Credits roll over indefinitely",
    ],
    cta: "Start Starter",
    ctaHref: "/login?mode=signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "\u20AC79",
    period: "/month",
    audience: "For creators who need every model, every format.",
    credits: "1,500 credits/month",
    features: [
      "1,500 credits/month included",
      "All AI models (38+)",
      "Text, image, video, audio",
      "Full Arena (unlimited models)",
      "Priority generation queue",
      "Credit packs available",
      "Credits roll over indefinitely",
    ],
    cta: "Start Pro",
    ctaHref: "/login?mode=signup",
    highlighted: true,
  },
  {
    name: "Business",
    price: "\u20AC149",
    period: "/month",
    audience: "For brands that need on-brand content at scale.",
    credits: "5,000 credits/month",
    features: [
      "5,000 credits/month included",
      "Everything in Pro +",
      "Brand Vault (brand identity)",
      "Campaign Lab (multi-platform)",
      "Automated Content Calendar",
      "Auto-publish & scheduling",
      "Brand Score & compliance",
      "Priority support",
    ],
    cta: "Start Business",
    ctaHref: "/login?mode=signup",
    highlighted: false,
  },
];

const creditPacks = [
  { name: "Pack S", price: "\u20AC19", credits: "1,000 credits", rate: "\u20AC0.019/cr" },
  { name: "Pack M", price: "\u20AC79", credits: "5,000 credits", rate: "\u20AC0.016/cr" },
  { name: "Pack L", price: "\u20AC249", credits: "20,000 credits", rate: "\u20AC0.012/cr" },
];

const comparisonFeatures = [
  { name: "Credits", starter: "200/month", pro: "1,500/month", business: "5,000/month" },
  { name: "AI Models", starter: "10 models", pro: "All 38+ models", business: "All 38+ models" },
  { name: "Text generation", starter: true, pro: true, business: true },
  { name: "Image generation", starter: true, pro: true, business: true },
  { name: "Video generation", starter: false, pro: true, business: true },
  { name: "Audio generation", starter: false, pro: true, business: true },
  { name: "Arena (side-by-side)", starter: "2 models", pro: "Unlimited", business: "Unlimited" },
  { name: "Brand Vault", starter: false, pro: false, business: true },
  { name: "Campaign Lab", starter: false, pro: false, business: true },
  { name: "Automated Content Calendar", starter: false, pro: false, business: true },
  { name: "Auto-publish & scheduling", starter: false, pro: false, business: true },
  { name: "Brand Score", starter: false, pro: false, business: true },
  { name: "Generation queue", starter: "Standard", pro: "Priority", business: "Priority" },
  { name: "Credit rollover", starter: "Unlimited", pro: "Unlimited", business: "Unlimited" },
  { name: "Credit packs", starter: false, pro: true, business: true },
  { name: "Support", starter: "Community", pro: "Email", business: "Priority" },
];

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check size={14} className="text-ora-signal mx-auto" />
    ) : (
      <Minus size={14} className="text-muted-foreground/30 mx-auto" />
    );
  }
  return (
    <span className="text-foreground/70" style={{ fontSize: "13px" }}>
      {value}
    </span>
  );
}

export function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span
              className="inline-block px-3 py-1 rounded-full"
              style={{
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9A9590",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Pricing
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.12,
              color: "#E8E4DF",
            }}
            className="mb-5"
          >
            Simple pricing.{" "}
            <span className="text-muted-foreground">Scale when you need to.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="max-w-[520px] mx-auto mb-4"
            style={{ fontSize: "16px", lineHeight: 1.55, color: "#9A9590" }}
          >
            Pay for credits, use any model. No per-model pricing, no hidden fees. Credits never expire.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="text-muted-foreground/60"
            style={{ fontSize: "13px", color: "#5C5856" }}
          >
            Unlimited rollover. Cancel anytime.
          </motion.p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-6 md:pb-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`relative flex flex-col bg-card rounded-xl border ${
                  plan.highlighted ? "border-border-accent" : "border-border"
                }`}
                style={{
                  boxShadow: plan.highlighted
                    ? "0 1px 3px rgba(0,0,0,0.1), 0 16px 48px rgba(0,0,0,0.2)"
                    : "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-6">
                    <span
                      className="text-white px-3 py-1 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.10)",
                        color: "#E8E4DF",
                        fontSize: "10px",
                        fontWeight: 500,
                        letterSpacing: "0.05em",
                      }}
                    >
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="p-7 pb-0">
                  <h3
                    className="text-foreground mb-1"
                    style={{ fontSize: "18px", fontWeight: 500 }}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className="text-muted-foreground mb-5"
                    style={{ fontSize: "13px" }}
                  >
                    {plan.audience}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      className="text-foreground"
                      style={{
                        fontSize: "40px",
                        fontWeight: 500,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                      }}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: "15px" }}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className="mb-6 pb-6 border-b"
                    style={{
                      borderColor: "var(--border)",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--ora-signal)",
                    }}
                  >
                    {plan.credits}
                  </p>
                </div>

                <ul className="px-7 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                        style={{
                          background: plan.highlighted
                            ? "var(--ora-signal-light)"
                            : "var(--secondary)",
                        }}
                      >
                        <Check
                          size={9}
                          style={{
                            color: plan.highlighted
                              ? "var(--ora-signal)"
                              : "var(--muted-foreground)",
                          }}
                          strokeWidth={2.5}
                        />
                      </div>
                      <span
                        className="text-foreground/75"
                        style={{ fontSize: "13px", lineHeight: 1.5 }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="p-7 pt-8">
                  <Link
                    to={plan.ctaHref}
                    className={`group flex items-center justify-center gap-2 w-full py-3 rounded-xl transition-all ${
                      plan.highlighted
                        ? "hover:opacity-90"
                        : "bg-secondary text-foreground hover:bg-muted border border-border"
                    }`}
                    style={{
                      background: plan.highlighted
                        ? "#E8E4DF"
                        : undefined,
                      color: plan.highlighted ? "#131211" : undefined,
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    {plan.cta}
                    {plan.highlighted && (
                      <ArrowRight
                        size={14}
                        className="group-hover:translate-x-0.5 transition-transform"
                      />
                    )}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Credit packs */}
      <section className="pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Zap size={14} style={{ color: "var(--ora-signal)" }} />
              <h3
                className="text-foreground"
                style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em" }}
              >
                Need more credits?
              </h3>
            </div>
            <p
              className="text-muted-foreground"
              style={{ fontSize: "14px", lineHeight: 1.55 }}
            >
              Top up anytime. Available on Pro and Business plans. Credits never expire.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {creditPacks.map((pack, i) => (
              <motion.div
                key={pack.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl px-6 py-5 flex items-center justify-between hover:border-border-strong transition-colors"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
              >
                <div>
                  <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--foreground)" }}>
                    {pack.name}
                  </span>
                  <span
                    className="block mt-0.5"
                    style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                  >
                    {pack.credits}
                  </span>
                  <span
                    className="block mt-0.5"
                    style={{ fontSize: "11px", color: "var(--ora-signal)", fontWeight: 500 }}
                  >
                    {pack.rate}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {pack.price}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise callout */}
      <section className="pb-16 md:pb-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-xl px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}
          >
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                Enterprise
              </h3>
              <p className="mt-1" style={{ fontSize: "14px", color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                Multi-brand, SSO, dedicated support, custom integrations, volume pricing. Let's talk.
              </p>
            </div>
            <Link
              to="#"
              className="inline-flex items-center gap-2 border px-6 py-3 rounded-xl hover:bg-secondary transition-colors flex-shrink-0"
              style={{
                borderColor: "var(--border-strong)",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              Contact sales
              <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-20 md:py-28" style={{ background: "rgba(18,18,30,0.5)" }}>
        <div className="max-w-[960px] mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-foreground mb-10"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
            }}
          >
            Compare plans
          </motion.h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th
                    className="text-left py-3 pr-4"
                    style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted-foreground)" }}
                  >
                    Feature
                  </th>
                  {["Starter", "Pro", "Business"].map((h) => (
                    <th
                      key={h}
                      className="text-center py-3 px-3"
                      style={{ fontSize: "13px", fontWeight: 600, minWidth: "100px" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
                  <tr key={row.name} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-foreground" style={{ fontSize: "14px" }}>
                      {row.name}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.starter} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.pro} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.business} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <FAQ />
    </>
  );
}