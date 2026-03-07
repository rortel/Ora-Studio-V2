import { motion } from "motion/react";
import { Sparkles, Columns2, CheckCircle2 } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Generate with the right model",
    desc: "Text, image, video, code — pick from the top models for each category, or let ORA route your prompt. No juggling tabs, no managing subscriptions.",
    icon: Sparkles,
  },
  {
    num: "02",
    title: "Compare outputs in Arena",
    desc: "One prompt to 2-4 models at once. Results side by side. Pick the best, mix parts from different outputs, or refine on the spot.",
    icon: Columns2,
  },
  {
    num: "03",
    title: "Choose. Publish. Move on.",
    desc: "Keep what works, discard the rest. Add Studio for brand consistency, the Canvas editor, and publish-ready assets — when the project calls for it.",
    icon: CheckCircle2,
  },
];

export function ThreeSteps() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
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
            How it works
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
            Generate. Compare. Choose.
          </h2>
          <p
            className="text-muted-foreground"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            A clear workflow for every type of generation. No complexity, no tool switching.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-card border rounded-xl p-7 transition-all hover:border-ora-signal/30 cursor-default"
                style={{
                  borderColor: "var(--border)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <span
                  className="absolute top-4 right-5 select-none pointer-events-none"
                  style={{
                    fontSize: "72px",
                    fontWeight: 600,
                    color: "var(--ora-signal)",
                    opacity: 0.04,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}
                >
                  {step.num}
                </span>

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "var(--ora-signal-light)",
                    border: "1px solid rgba(59,79,196,0.1)",
                  }}
                >
                  <Icon
                    size={18}
                    style={{ color: "var(--ora-signal)" }}
                    strokeWidth={1.5}
                  />
                </div>

                <span
                  className="text-ora-signal mb-2 block"
                  style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em" }}
                >
                  Step {step.num}
                </span>
                <h3
                  className="text-foreground mb-3"
                  style={{
                    fontSize: "18px",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: "14px", lineHeight: 1.65 }}
                >
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
