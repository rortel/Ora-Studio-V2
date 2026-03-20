import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { AuraDecoration } from "./OraLogo";

export function CTASection() {
  return (
    <section className="py-20 md:py-32" style={{ background: "#131211" }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl p-12 md:p-20 relative overflow-hidden"
          style={{
            background: "#1a1918",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Aura decorations */}
          <div className="absolute -top-32 -right-32 pointer-events-none opacity-20">
            <AuraDecoration size={400} color="#E8E4DF" />
          </div>

          <div className="relative z-10 max-w-[520px]">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "#E8E4DF",
                marginBottom: 16,
              }}
            >
              Start creating.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.18 }}
              className="mb-10"
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#9A9590",
                fontWeight: 400,
              }}
            >
              50 free credits. No card required.
              Pick a model, type a prompt, get your first output in under a minute.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.26 }}
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                to="/login?mode=signup"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-all hover:opacity-90"
                style={{
                  background: "#E8E4DF",
                  color: "#131211",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Start free
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-all"
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#9A9590",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                View pricing
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
