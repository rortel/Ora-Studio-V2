import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { GitCompare, ArrowRight, Crown, Loader2, Check } from "lucide-react";

const prompt = "Write a one-sentence tagline for an AI productivity tool. Honest, direct, no buzzwords.";

const arenaModels = [
  {
    name: "GPT-4o",
    provider: "OpenAI",
    color: "#10a37f",
    response: "One tool, every model — so you can stop switching and start shipping.",
    time: "1.2s",
    tokens: 18,
  },
  {
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    color: "#d4a27f",
    response: "Your ideas deserve better than copy-paste between four different AI tabs.",
    time: "1.8s",
    tokens: 16,
  },
  {
    name: "Gemini 2.5",
    provider: "Google",
    color: "#4285f4",
    response: "Ask once, compare instantly, pick the answer that actually fits.",
    time: "0.9s",
    tokens: 14,
  },
];

export function ArenaDemo() {
  const [phase, setPhase] = useState<"idle" | "loading" | "results" | "chosen">("idle");
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);

  // Auto-play once when scrolled into view
  useEffect(() => {
    if (autoStarted) return;
    const timeout = setTimeout(() => {
      setAutoStarted(true);
      runDemo();
    }, 800);
    return () => clearTimeout(timeout);
  }, [autoStarted]);

  const runDemo = () => {
    setPhase("loading");
    setChosenIdx(null);
    setTimeout(() => setPhase("results"), 2200);
  };

  const handleChoose = (idx: number) => {
    setChosenIdx(idx);
    setPhase("chosen");
  };

  const handleReplay = () => {
    setPhase("idle");
    setTimeout(() => runDemo(), 300);
  };

  return (
    <section className="py-20 md:py-28 bg-secondary/40">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
            style={{
              background: "var(--ora-signal-light)",
              border: "1px solid rgba(59,79,196,0.1)",
            }}
          >
            <GitCompare size={13} style={{ color: "var(--ora-signal)" }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ora-signal)" }}>
              Arena
            </span>
          </div>
          <h2
            className="text-foreground mb-4"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            Same prompt.{" "}
            <span className="text-muted-foreground">Three models. You choose.</span>
          </h2>
          <p
            className="text-muted-foreground max-w-[520px] mx-auto"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Send a single prompt to GPT-4o, Claude, and Gemini simultaneously. Compare outputs side-by-side. Pick the winner.
          </p>
        </motion.div>

        {/* Arena mockup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl overflow-hidden max-w-[960px] mx-auto"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.05)" }}
        >
          {/* Title bar */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <GitCompare size={12} style={{ color: "var(--ora-signal)" }} />
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>
                  Arena Mode
                </span>
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              3 models selected
            </span>
          </div>

          {/* Prompt area */}
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "var(--input-background)" }}>
            <span
              className="block mb-1.5"
              style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}
            >
              Prompt
            </span>
            <p style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--foreground)" }}>
              {prompt}
            </p>
          </div>

          {/* Results area */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <GitCompare size={24} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
                  <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    Waiting to generate...
                  </p>
                </motion.div>
              )}

              {phase === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid md:grid-cols-3 gap-4"
                >
                  {arenaModels.map((model, i) => (
                    <div key={model.name} className="border border-border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: model.color + "12" }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: model.color }} />
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{model.name}</span>
                      </div>
                      <div className="flex items-center gap-2 py-6 justify-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 size={16} style={{ color: model.color }} />
                        </motion.div>
                        <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>Generating...</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {(phase === "results" || phase === "chosen") && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid md:grid-cols-3 gap-4"
                >
                  {arenaModels.map((model, i) => {
                    const isChosen = chosenIdx === i;
                    return (
                      <motion.div
                        key={model.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="border rounded-xl p-4 transition-all relative"
                        style={{
                          borderColor: isChosen ? "var(--ora-signal)" : "var(--border)",
                          boxShadow: isChosen ? "0 0 0 1px var(--ora-signal), 0 4px 16px rgba(59,79,196,0.1)" : "none",
                        }}
                      >
                        {isChosen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: "var(--ora-signal)" }}
                          >
                            <Crown size={11} style={{ color: "#ffffff" }} />
                          </motion.div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: model.color + "12" }}>
                              <div className="w-2 h-2 rounded-full" style={{ background: model.color }} />
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{model.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{model.time}</span>
                            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{model.tokens} tok</span>
                          </div>
                        </div>

                        <p
                          className="mb-4"
                          style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--foreground)", fontStyle: "italic" }}
                        >
                          "{model.response}"
                        </p>

                        {phase === "results" && (
                          <button
                            onClick={() => handleChoose(i)}
                            className="w-full py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            style={{
                              fontSize: "12px",
                              fontWeight: 500,
                              color: "var(--foreground)",
                              background: "var(--secondary)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <Crown size={11} />
                            Choose this
                          </button>
                        )}

                        {phase === "chosen" && isChosen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full py-2 rounded-lg flex items-center justify-center gap-1.5"
                            style={{
                              fontSize: "12px",
                              fontWeight: 500,
                              color: "var(--ora-signal)",
                              background: "var(--ora-signal-light)",
                            }}
                          >
                            <Check size={12} strokeWidth={2.5} />
                            Selected
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom actions */}
            {phase === "chosen" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3 mt-6 pt-5 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  onClick={handleReplay}
                  className="px-5 py-2.5 rounded-lg text-foreground transition-colors hover:bg-muted cursor-pointer"
                  style={{ fontSize: "13px", fontWeight: 500, background: "var(--secondary)", border: "1px solid var(--border)" }}
                >
                  Replay demo
                </button>
                <Link
                  to="/login?mode=signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                    fontSize: "13px",
                    fontWeight: 500,
                    boxShadow: "0 2px 8px rgba(59,79,196,0.25)",
                  }}
                >
                  Try Arena
                  <ArrowRight size={13} />
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}