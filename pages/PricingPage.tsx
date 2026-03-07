import { motion } from "motion/react";
import { Check, Minus, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { FAQ } from "../components/FAQ";

const plans = [
  {
    name: "Free",
    price: "Free",
    period: "",
    audience: "Test ORA with no commitment and no credit card.",
    credits: "50 free credits",
    features: [
      "50 credits, no card required",
      "Multi-AI comparator (GPT-4o, Claude, Gemini)",
      "Text, image, code generation",
      "Unlimited credit rollover",
    ],
    cta: "Start for free",
    ctaHref: "/login?mode=signup",
    highlighted: false,
  },
  {
    name: "Generate",
    price: "\u20AC19",
    period: "/month",
    audience: "For creators and independents who generate regularly.",
    credits: "200 credits at activation",
    features: [
      "200 credits at activation",
      "Unlimited multi-AI comparator",
      "Text, image, code, audio, video",
      "Arena (side-by-side comparison)",
      "Unlimited credit rollover",
      "Credit packs available",
    ],
    cta: "Start Generate",
    ctaHref: "/login?mode=signup",
    highlighted: false,
  },
  {
    name: "Studio",
    price: "\u20AC49",
    period: "/month",
    audience: "For brands that want content aligned with their identity.",
    credits: "500 credits/month included",
    features: [
      "500 credits/month included",
      "Everything in Generate +",
      "Brand Vault (brand identity)",
      "1 product/service included",
      "Canvas editor (Canva-like)",
      "Complete Asset Builder",
      "Brand Score analysis",
      "Content Calendar",
      "Unlimited credit rollover",
    ],
    cta: "Start Studio",
    ctaHref: "/login?mode=signup",
    highlighted: true,
  },
];

const creditPacks = [
  { name: "Pack S", price: "\u20AC10", credits: "1,000 credits", rate: "\u20AC0.01/cr" },
  { name: "Pack M", price: "\u20AC45", credits: "5,000 credits", rate: "\u20AC0.009/cr" },
  { name: "Pack L", price: "\u20AC160", credits: "20,000 credits", rate: "\u20AC0.008/cr" },
];

const comparisonFeatures = [
  { name: "Credits", free: "50 (one-time)", generate: "200 at activation", studio: "500/month" },
  { name: "AI Models", free: "GPT-4o, Claude, Gemini", generate: "All models", studio: "All models" },
  { name: "Text generation", free: true, generate: true, studio: true },
  { name: "Image generation", free: true, generate: true, studio: true },
  { name: "Code generation", free: true, generate: true, studio: true },
  { name: "Audio generation", free: false, generate: true, studio: true },
  { name: "Video generation", free: false, generate: true, studio: true },
  { name: "Arena (side-by-side)", free: false, generate: true, studio: true },
  { name: "Brand Vault", free: false, generate: false, studio: true },
  { name: "Canvas editor", free: false, generate: false, studio: true },
  { name: "Asset Builder", free: false, generate: false, studio: true },
  { name: "Brand Score", free: false, generate: false, studio: true },
  { name: "Content Calendar", free: false, generate: false, studio: true },
  { name: "Products/services", free: "-", generate: "-", studio: "1 included" },
  { name: "Credit rollover", free: "Unlimited", generate: "Unlimited", studio: "Unlimited" },
  { name: "Credit packs", free: false, generate: true, studio: true },
  { name: "Support", free: "Community", generate: "Email", studio: "Priority" },
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
    <span className="text-foreground/70" style={{ fontSize: '13px' }}>
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
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ora-signal)",
                background: "var(--ora-signal-light)",
                border: "1px solid rgba(59,79,196,0.1)",
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
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 500,
              letterSpacing: '-0.035em',
              lineHeight: 1.12,
            }}
            className="mb-5"
          >
            Transparent pricing.{" "}
            <span className="text-muted-foreground">No surprises.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="text-muted-foreground max-w-[520px] mx-auto mb-4"
            style={{ fontSize: '16px', lineHeight: 1.55 }}
          >
            Pay only for what you use. ORA is an AI aggregator — you only pay for actual API calls. Credits never expire.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="text-muted-foreground/60"
            style={{ fontSize: '13px' }}
          >
            No hidden costs. Unlimited rollover. Cancel anytime.
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
                  plan.highlighted ? "border-ora-signal" : "border-border"
                }`}
                style={{
                  boxShadow: plan.highlighted
                    ? '0 1px 3px rgba(0,0,0,0.04), 0 16px 48px rgba(59,79,196,0.12), 0 0 0 1px rgba(59,79,196,0.08)'
                    : '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-6">
                    <span
                      className="text-white px-3 py-1 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}
                    >
                      RECOMMENDED
                    </span>
                  </div>
                )}

                <div className="p-7 pb-0">
                  <h3
                    className="text-foreground mb-1"
                    style={{ fontSize: '18px', fontWeight: 500 }}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className="text-muted-foreground mb-5"
                    style={{ fontSize: '13px' }}
                  >
                    {plan.audience}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      className="text-foreground"
                      style={{
                        fontSize: '40px',
                        fontWeight: 500,
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: '15px' }}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className="mb-6 pb-6 border-b"
                    style={{
                      borderColor: 'var(--border)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--ora-signal)',
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
                            ? 'var(--ora-signal-light)'
                            : 'var(--secondary)',
                        }}
                      >
                        <Check
                          size={9}
                          style={{
                            color: plan.highlighted
                              ? 'var(--ora-signal)'
                              : 'var(--muted-foreground)',
                          }}
                          strokeWidth={2.5}
                        />
                      </div>
                      <span
                        className="text-foreground/75"
                        style={{ fontSize: '13px', lineHeight: 1.5 }}
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
                        ? "text-white hover:opacity-90"
                        : "bg-secondary text-foreground hover:bg-muted border border-border"
                    }`}
                    style={{
                      background: plan.highlighted
                        ? 'linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)'
                        : undefined,
                      boxShadow: plan.highlighted
                        ? '0 2px 12px rgba(59,79,196,0.3)'
                        : undefined,
                      fontSize: '14px',
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
              <Zap size={14} style={{ color: 'var(--ora-signal)' }} />
              <h3
                className="text-foreground"
                style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.02em' }}
              >
                Need more credits?
              </h3>
            </div>
            <p
              className="text-muted-foreground"
              style={{ fontSize: '14px', lineHeight: 1.55 }}
            >
              Top up anytime. Available on Generate and Studio plans. Credits never expire.
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
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
              >
                <div>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--foreground)' }}>
                    {pack.name}
                  </span>
                  <span
                    className="block mt-0.5"
                    style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
                  >
                    {pack.credits}
                  </span>
                  <span
                    className="block mt-0.5"
                    style={{ fontSize: '11px', color: 'var(--ora-signal)', fontWeight: 500 }}
                  >
                    {pack.rate}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {pack.price}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-20 md:py-28 bg-secondary/40">
        <div className="max-w-[960px] mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-foreground mb-10"
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
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
                    style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)' }}
                  >
                    Feature
                  </th>
                  {["Free", "Generate", "Studio"].map((h) => (
                    <th
                      key={h}
                      className="text-center py-3 px-3"
                      style={{ fontSize: '13px', fontWeight: 600, minWidth: '100px' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
                  <tr key={row.name} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-foreground" style={{ fontSize: '14px' }}>
                      {row.name}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.free} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.generate} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureCell value={row.studio} />
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
