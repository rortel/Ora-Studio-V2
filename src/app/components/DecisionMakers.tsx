import { motion } from "motion/react";
import { Shield, Zap, Eye, Sparkles } from "lucide-react";

const roles = [
  {
    title: "CEO / Founder",
    quote: "Brand in safe hands.",
    desc: "Morning Pulse at 8am. Voice-to-content. Board-ready brand reports. Done in 5 minutes.",
    icon: Shield,
    gradient: "linear-gradient(135deg, rgba(59,79,196,0.06) 0%, rgba(59,79,196,0.01) 100%)",
    accentPos: "top-0 left-0",
  },
  {
    title: "CMO",
    quote: "Move fast without sacrificing quality.",
    desc: 'One sentence. Full multi-channel campaign in 15 minutes. The "Clone me" feature learns your validation patterns.',
    icon: Zap,
    gradient: "linear-gradient(135deg, rgba(59,79,196,0.04) 0%, rgba(59,79,196,0.08) 100%)",
    accentPos: "top-0 right-0",
  },
  {
    title: "Head of Comms",
    quote: "Everything on-brand. Zero exceptions.",
    desc: "Real-time compliance scoring on every piece. Approval workflow. Crisis Shield.",
    icon: Eye,
    gradient: "linear-gradient(135deg, rgba(59,79,196,0.08) 0%, rgba(59,79,196,0.02) 100%)",
    accentPos: "bottom-0 left-0",
  },
  {
    title: "Creative Director",
    quote: "Amplify craft. Not replace it.",
    desc: "Brief Accelerator. Variation Engine. ORA learns your taste — not just your brand.",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, rgba(59,79,196,0.02) 0%, rgba(59,79,196,0.06) 100%)",
    accentPos: "bottom-0 right-0",
  },
];

export function DecisionMakers() {
  return (
    <section id="roles" className="py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
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
            Built for you
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
            Built for every decision-maker
          </h2>
          <p
            className="text-muted-foreground max-w-[560px]"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            ORA fits into each role's daily rhythm — not as another tool to
            open, but as the first thing they open.
          </p>
        </motion.div>

        {/* 2x2 Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {roles.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group relative bg-card border rounded-xl p-7 transition-all hover:border-ora-signal/20 cursor-default overflow-hidden"
                style={{
                  borderColor: "var(--border)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {/* Subtle gradient overlay on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: role.gradient }}
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: "var(--ora-signal-light)",
                        border: "1px solid rgba(59,79,196,0.08)",
                      }}
                    >
                      <Icon
                        size={16}
                        style={{ color: "var(--ora-signal)" }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className="text-foreground"
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {role.title}
                    </h3>
                  </div>
                  <p
                    className="mb-4"
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      fontStyle: "italic",
                      color: "var(--ora-signal)",
                      opacity: 0.8,
                    }}
                  >
                    "{role.quote}"
                  </p>
                  <p
                    className="text-muted-foreground"
                    style={{ fontSize: "14px", lineHeight: 1.65 }}
                  >
                    {role.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
