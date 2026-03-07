import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export function Hero() {
  return (
    <section className="relative pt-16 pb-12 md:pt-28 md:pb-20 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
          {/* Left: Headline + CTA */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
                color: "var(--foreground)",
              }}
            >
              Generate.
              <br />
              Compare.
              <br />
              <span className="text-muted-foreground">Choose the best.</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/login?mode=signup"
                className="group inline-flex items-center gap-2 text-white px-7 py-3.5 rounded-full hover:opacity-90 transition-all"
                style={{
                  background: "var(--foreground)",
                  fontSize: "15px",
                  fontWeight: 500,
                }}
              >
                Start free — 50 credits
                <ArrowRight
                  size={15}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 border px-7 py-3.5 rounded-full hover:bg-secondary transition-colors"
                style={{
                  borderColor: "var(--border-strong)",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                See how it works
              </a>
            </motion.div>
          </div>

          {/* Right: Description */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:pt-3"
          >
            <p
              className="mb-5"
              style={{ fontSize: "18px", lineHeight: 1.65, color: "var(--foreground)", fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Every AI model. One account.
              <br />
              Your brand if you need it.
            </p>
            <p
              style={{ fontSize: "16px", lineHeight: 1.65, color: "var(--muted-foreground)" }}
            >
              ORA brings the best models for text, image, video, and code into one clear workspace. Generate with the right model, compare outputs in Arena, pick the best — no juggling tools, no managing subscriptions.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}