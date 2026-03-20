import { Link } from "react-router";
import { Check, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

/**
 * Screen 4 — Pricing: Free / Pro / Team
 * Dark monochrome. No accent colors.
 */

const plans = [
  {
    name: "Starter",
    price: "29",
    period: "/mo",
    desc: "For individuals getting started.",
    credits: "200 credits/mo",
    features: [
      "200 credits/month",
      "10 AI models",
      "Text + image generation",
    ],
    cta: "Start Starter",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "79",
    period: "/mo",
    desc: "Every model. Every format.",
    credits: "1,500 credits/mo",
    features: [
      "1,500 credits/month",
      "All 38+ models",
      "Text, image, video, audio",
      "Full Arena",
      "Priority queue",
      "Credit packs",
    ],
    cta: "Start Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "149",
    period: "/mo",
    desc: "Brand-safe content at scale.",
    credits: "5,000 credits/mo",
    features: [
      "5,000 credits/month",
      "Everything in Pro",
      "Brand Vault",
      "Campaign Lab",
      "Auto Content Calendar",
      "Auto-publish & scheduling",
      "Brand Score",
      "Priority support",
    ],
    cta: "Start Business",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32" style={{ background: "#131211" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#E8E4DF",
              marginBottom: 12,
            }}
          >
            Pricing
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.55, color: "#5C5856", maxWidth: 360 }}>
            Pay for credits. Use any model. Credits never expire.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl p-6 flex flex-col relative"
              style={{
                background: p.highlighted ? "#222120" : "#1a1918",
                border: p.highlighted
                  ? "1px solid rgba(255,255,255,0.16)"
                  : "1px solid rgba(255,255,255,0.06)",
                minHeight: 400,
              }}
            >
              {p.highlighted && (
                <span
                  className="absolute top-4 right-4 px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "#E8E4DF",
                    letterSpacing: "0.04em",
                  }}
                >
                  POPULAR
                </span>
              )}

              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    color: "#E8E4DF",
                    marginBottom: 4,
                  }}
                >
                  {p.name}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#5C5856",
                    marginBottom: 16,
                  }}
                >
                  {p.desc}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>EUR</span>
                  <span
                    style={{
                      fontSize: "40px",
                      fontWeight: 500,
                      letterSpacing: "-0.035em",
                      lineHeight: 1,
                      color: "#E8E4DF",
                    }}
                  >
                    {p.price}
                  </span>
                  {p.period && (
                    <span style={{ fontSize: "14px", color: "#5C5856" }}>{p.period}</span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#9A9590",
                    marginBottom: 20,
                  }}
                >
                  {p.credits}
                </p>
              </div>

              <ul className="space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check size={12} style={{ color: "#5C5856" }} strokeWidth={2} />
                    <span style={{ fontSize: "13px", color: "#9A9590" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login?mode=signup"
                className="group mt-6 flex items-center justify-center gap-2 py-3 rounded-lg transition-all hover:opacity-90"
                style={{
                  background: p.highlighted ? "#E8E4DF" : "rgba(255,255,255,0.06)",
                  color: p.highlighted ? "#131211" : "#E8E4DF",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: p.highlighted ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {p.cta}
                <ArrowRight
                  size={13}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}