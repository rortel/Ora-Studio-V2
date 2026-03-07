import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section
      className="py-24 md:py-32 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--background) 0%, #0f1029 6%, #0f1029 94%, var(--background) 100%)",
      }}
    >
      {/* Animated pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          width={800}
          height={800}
          viewBox="0 0 800 800"
          fill="none"
          className="opacity-100"
        >
          <defs>
            <radialGradient id="cta-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--ora-signal)" stopOpacity="0.15" />
              <stop offset="50%" stopColor="var(--ora-signal)" stopOpacity="0.03" />
              <stop offset="100%" stopColor="var(--ora-signal)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={400} cy={400} r={350} fill="url(#cta-glow)" />
          {[100, 160, 220, 280, 340].map((r, i) => (
            <circle
              key={i}
              cx={400}
              cy={400}
              r={r}
              stroke="rgba(59,79,196,0.12)"
              strokeWidth={0.6}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={`p-${i}`}
              cx={400}
              cy={400}
              r={0}
              stroke="var(--ora-signal)"
              strokeWidth={1}
              fill="none"
              animate={{
                r: [0, 340],
                opacity: [0.4, 0],
              }}
              transition={{
                duration: 4,
                delay: i * 1.3,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
          <circle cx={400} cy={400} r={4} fill="var(--ora-signal)" />
        </svg>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-[640px] mx-auto"
        >
          <h2
            className="mb-5"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.12,
              color: "#ffffff",
            }}
          >
            Start with 50 free credits.
            <br />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>
              See what ORA can do.
            </span>
          </h2>
          <p
            className="mb-10 mx-auto max-w-[480px]"
            style={{
              fontSize: "16px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            No credit card. No setup. Pick a model, type a prompt, and generate your first output in under a minute.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login?mode=signup"
              className="group inline-flex items-center gap-2 text-white px-7 py-3.5 rounded-xl hover:opacity-90 transition-all"
              style={{
                background:
                  "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                fontSize: "15px",
                fontWeight: 500,
                boxShadow:
                  "0 2px 16px rgba(59,79,196,0.4), 0 0 0 1px rgba(59,79,196,0.2)",
              }}
            >
              Start for free — 50 credits
              <ArrowRight
                size={16}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                fontSize: "15px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              View pricing
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}