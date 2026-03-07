import { motion } from "motion/react";

const models = [
  { name: "GPT-4o", provider: "OpenAI", color: "#10a37f" },
  { name: "Claude Sonnet 4", provider: "Anthropic", color: "#d4a27f" },
  { name: "Gemini 2.5", provider: "Google", color: "#4285f4" },
  { name: "Mistral Large", provider: "Mistral AI", color: "#f97316" },
  { name: "Llama 4", provider: "Meta", color: "#1877f2" },
  { name: "Command R+", provider: "Cohere", color: "#6366f1" },
  { name: "DALL-E 3", provider: "OpenAI", color: "#10a37f" },
  { name: "Stable Diffusion", provider: "Stability AI", color: "#a855f7" },
  { name: "Suno v4", provider: "Suno", color: "#ef4444" },
  { name: "Sora", provider: "OpenAI", color: "#10a37f" },
];

export function SupportedModels() {
  return (
    <section className="py-16 md:py-24 border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
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
            Models
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
            Every major model.{" "}
            <span className="text-muted-foreground">One account.</span>
          </h2>
          <p
            className="text-muted-foreground max-w-[480px] mx-auto"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Text, image, audio, video, code — from the best providers. New
            models added continuously.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {models.map((model, i) => (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-border-strong transition-colors"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: model.color + "14" }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: model.color }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-foreground truncate"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                >
                  {model.name}
                </p>
                <p
                  className="text-muted-foreground truncate"
                  style={{ fontSize: "11px" }}
                >
                  {model.provider}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8 text-muted-foreground"
          style={{ fontSize: "13px" }}
        >
          + 20 more models available. New providers added monthly.
        </motion.p>
      </div>
    </section>
  );
}
