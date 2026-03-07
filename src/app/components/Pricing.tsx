import { Link } from "react-router";
import { Check, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

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
      "Unlimited credit rollover",
      "Credit packs available",
    ],
    cta: "Start Generate",
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
      "Unlimited credit rollover",
    ],
    cta: "Start Studio",
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <span
            className="inline-block mb-4 px-3 py-1 rounded-full"
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
          <h2
            className="text-foreground mb-4"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            Transparent pricing. No surprises.
          </h2>
          <p
            className="text-muted-foreground"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Pay only for what you use. Credits never expire — unlimited rollover.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col bg-card rounded-xl border ${
                plan.highlighted ? "border-ora-signal" : "border-border"
              }`}
              style={{
                boxShadow: plan.highlighted
                  ? "0 1px 3px rgba(0,0,0,0.04), 0 16px 48px rgba(59,79,196,0.12), 0 0 0 1px rgba(59,79,196,0.08)"
                  : "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-6">
                  <span
                    className="text-white px-3 py-1 rounded-full"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    RECOMMENDED
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
                <div
                  className="flex items-baseline gap-1 mb-2"
                >
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
                  to="/pricing"
                  className={`group flex items-center justify-center gap-2 w-full py-3 rounded-xl transition-all ${
                    plan.highlighted
                      ? "text-white hover:opacity-90"
                      : "bg-secondary text-foreground hover:bg-muted border border-border"
                  }`}
                  style={{
                    background: plan.highlighted
                      ? "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)"
                      : undefined,
                    boxShadow: plan.highlighted
                      ? "0 2px 12px rgba(59,79,196,0.3)"
                      : undefined,
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

        {/* Credit packs strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 grid sm:grid-cols-3 gap-4"
        >
          {[
            { name: "Pack S", price: "\u20AC10", credits: "1,000 credits", rate: "\u20AC0.01/cr" },
            { name: "Pack M", price: "\u20AC45", credits: "5,000 credits", rate: "\u20AC0.009/cr" },
            { name: "Pack L", price: "\u20AC160", credits: "20,000 credits", rate: "\u20AC0.008/cr" },
          ].map((pack) => (
            <div
              key={pack.name}
              className="bg-card border rounded-xl px-5 py-4 flex items-center justify-between"
              style={{
                borderColor: "var(--border)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>
                  {pack.name}
                </span>
                <span
                  className="block"
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  {pack.credits} — {pack.rate}
                </span>
              </div>
              <span style={{ fontSize: "20px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                {pack.price}
              </span>
            </div>
          ))}
        </motion.div>
        <p
          className="text-center mt-6"
          style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
        >
          ORA is an AI aggregator — you only pay for actual API calls. No hidden costs, unlimited rollover.
        </p>
      </div>
    </section>
  );
}
