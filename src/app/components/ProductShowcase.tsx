import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { Check, Loader2, Zap, Crown } from "lucide-react";

/* ── Timeline ── */
const T = {
  PROMPT_START: 0.3,
  MODELS_START: 2.2,
  MODEL_1_DONE: 3.0,
  MODEL_2_DONE: 3.6,
  MODEL_3_DONE: 4.2,
  CHOOSE: 5.0,
  BRAND_CHECK: 5.8,
  BRAND_DONE: 6.8,
};

const promptText = "Write a short tagline for an AI productivity tool. Honest, direct, no buzzwords.";

const models = [
  {
    id: "gpt4o",
    name: "GPT-4o",
    provider: "OpenAI",
    color: "#10a37f",
    output: '"Every AI tool, one workspace. Spend less time switching — more time creating."',
  },
  {
    id: "claude",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    color: "#d4a27f",
    output: '"The right AI for the right job, every time. ORA shows you all your options at once — so you always ship the best output."',
    chosen: true,
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    color: "#4285f4",
    output: '"One prompt. Multiple models. One clear decision. Stop guessing — start comparing."',
  },
];

/* ── Typing hook ── */
function useTypingText(fullText: string, startDelay: number, isActive: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    let i = 0;
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(fullText.slice(0, i));
        if (i >= fullText.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, 22);
      return () => clearInterval(interval);
    }, startDelay * 1000);
    return () => clearTimeout(startTimeout);
  }, [isActive, fullText, startDelay]);

  return { displayed, done };
}

export function ProductShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState(0);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          setIsActive(true);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const timers = [
      setTimeout(() => setPhase(1), T.PROMPT_START * 1000),
      setTimeout(() => setPhase(2), T.MODELS_START * 1000),
      setTimeout(() => setPhase(3), T.MODEL_1_DONE * 1000),
      setTimeout(() => setPhase(4), T.MODEL_2_DONE * 1000),
      setTimeout(() => setPhase(5), T.MODEL_3_DONE * 1000),
      setTimeout(() => setPhase(6), T.CHOOSE * 1000),
      setTimeout(() => setPhase(7), T.BRAND_CHECK * 1000),
      setTimeout(() => setPhase(8), T.BRAND_DONE * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  const { displayed: promptDisplayed, done: promptDone } = useTypingText(promptText, T.PROMPT_START, isActive);

  // Model states
  const [modelStates, setModelStates] = useState<Record<string, "idle" | "loading" | "done">>({
    gpt4o: "idle",
    claude: "idle",
    gemini: "idle",
  });

  useEffect(() => {
    if (!isActive) return;
    const timers = [
      setTimeout(() => setModelStates(s => ({ ...s, gpt4o: "loading", claude: "loading", gemini: "loading" })), T.MODELS_START * 1000),
      setTimeout(() => setModelStates(s => ({ ...s, gpt4o: "done" })), T.MODEL_1_DONE * 1000),
      setTimeout(() => setModelStates(s => ({ ...s, claude: "done" })), T.MODEL_2_DONE * 1000),
      setTimeout(() => setModelStates(s => ({ ...s, gemini: "done" })), T.MODEL_3_DONE * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  return (
    <section ref={sectionRef} className="pt-4 pb-0 md:pt-10 md:pb-0 relative">
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(165deg, #1a1a2e 0%, #2d2b55 30%, #3b4fc4 55%, #6b7ec9 75%, #c4cbe0 100%)",
          paddingTop: "clamp(48px, 6vw, 80px)",
          paddingBottom: "0",
        }}
      >
        {/* Noise */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Arena
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 max-w-[560px] mx-auto"
          >
            <h2
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                color: "#ffffff",
              }}
            >
              Stop guessing which model is best.
              <br />
              <span style={{ color: "rgba(255,255,255,0.45)" }}>See for yourself.</span>
            </h2>
            <p
              className="mt-4"
              style={{ fontSize: "15px", lineHeight: 1.6, color: "rgba(255,255,255,0.45)" }}
            >
              Write your prompt once. Arena sends it to multiple models in parallel. Pick the best output.
            </p>
          </motion.div>

          {/* ── ANIMATED ARENA UI ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ marginBottom: "-2px" }}
          >
            <div
              className="bg-card rounded-xl border overflow-hidden w-full max-w-[960px] mx-auto"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                boxShadow: "0 8px 60px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                    ORA Arena
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--ora-signal)",
                      background: "var(--ora-signal-light)",
                    }}
                  >
                    3 models
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    5 credits
                  </span>
                </div>
              </div>

              {/* Prompt area */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 mt-1 px-2 py-0.5 rounded"
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--ora-signal)",
                      background: "var(--ora-signal-light)",
                    }}
                  >
                    Prompt
                  </span>
                  <div
                    className="flex-1 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: promptDone ? "var(--ora-signal)" : "var(--border)",
                      background: "var(--input-background)",
                      boxShadow: promptDone ? "0 0 0 3px var(--ora-signal-light)" : "none",
                      transition: "border-color 0.3s, box-shadow 0.3s",
                      minHeight: "44px",
                    }}
                  >
                    <p style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--foreground)", minHeight: "18px" }}>
                      {promptDisplayed}
                      {phase >= 1 && !promptDone && (
                        <span
                          className="inline-block w-[2px] h-[14px] ml-0.5 bg-ora-signal"
                          style={{ verticalAlign: "text-bottom", animation: "blink 0.8s infinite" }}
                        />
                      )}
                    </p>
                  </div>
                </div>
                <style>{`@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }`}</style>
              </div>

              {/* Model outputs */}
              <div className="px-5 pb-5 space-y-3">
                {models.map((model) => {
                  const state = modelStates[model.id];
                  const isChosen = model.chosen && phase >= 6;
                  return (
                    <AnimatePresence key={model.id}>
                      {state !== "idle" && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="rounded-xl border p-4"
                          style={{
                            borderColor: isChosen ? "var(--ora-signal)" : "var(--border)",
                            background: isChosen ? "rgba(59,79,196,0.03)" : "var(--card)",
                            boxShadow: isChosen ? "0 0 0 3px var(--ora-signal-light)" : "none",
                            transition: "border-color 0.4s, box-shadow 0.4s, background 0.4s",
                          }}
                        >
                          {/* Model header */}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ background: model.color + "18" }}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ background: model.color }}
                              />
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)" }}>
                              {model.name}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                              {model.provider}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              {isChosen && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    color: "var(--ora-signal)",
                                    background: "var(--ora-signal-light)",
                                  }}
                                >
                                  <Crown size={9} />
                                  Chosen
                                </motion.span>
                              )}
                              {state === "loading" ? (
                                <Loader2 size={13} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                              ) : state === "done" ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>
                                  <Check size={13} style={{ color: model.color }} />
                                </motion.div>
                              ) : null}
                            </div>
                          </div>

                          {/* Output text */}
                          {state === "done" ? (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                              className="pl-[34px]"
                              style={{
                                fontSize: "13px",
                                lineHeight: 1.6,
                                color: "var(--foreground)",
                                opacity: 0.75,
                                fontStyle: "italic",
                              }}
                            >
                              {model.output}
                            </motion.p>
                          ) : (
                            <div className="pl-[34px] flex items-center gap-1.5 py-1">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Generating...</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })}
              </div>

              {/* Brand check strip */}
              <AnimatePresence>
                {phase >= 7 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.35 }}
                    className="border-t px-5 py-3.5 flex items-center gap-3"
                    style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(59,79,196,0.02)" }}
                  >
                    <Zap size={13} style={{ color: "var(--ora-signal)" }} />
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>
                      Studio Brand Check
                    </span>
                    {phase >= 8 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 ml-auto"
                      >
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "#16a34a",
                            background: "rgba(22,163,74,0.08)",
                          }}
                        >
                          96/100 compliant
                        </span>
                        <Check size={13} style={{ color: "#16a34a" }} />
                      </motion.div>
                    ) : (
                      <div className="flex items-center gap-2 ml-auto">
                        <Loader2 size={12} className="animate-spin" style={{ color: "var(--ora-signal)" }} />
                        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Checking against Brand Vault...</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Cost strip */}
      <div className="flex items-center justify-center gap-6 py-5 bg-background border-t" style={{ borderColor: "var(--border)" }}>
        <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
          Arena pricing — text (3 models): <span style={{ fontWeight: 500, color: "var(--foreground)" }}>5 credits</span>
        </span>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
          Credits never expire
        </span>
      </div>
    </section>
  );
}
