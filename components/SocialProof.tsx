import { motion } from "motion/react";

const companies = [
  "Meridian Group",
  "Helix Studio",
  "Nortem",
  "Vault & Co",
  "Apex Digital",
];

export function SocialProof() {
  return (
    <section className="py-12 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10"
        >
          <span
            className="flex-shrink-0"
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--muted-foreground)",
            }}
          >
            Used by creators, founders, and teams who want one tool instead of five
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {companies.map((name, i) => (
              <motion.span
                key={name}
                initial={{ opacity: 0, y: 4 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: "var(--foreground)",
                  opacity: 0.3,
                }}
              >
                {name}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
