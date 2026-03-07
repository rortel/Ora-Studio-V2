import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import {
  Shield,
  Layers,
  Check,
  ChevronRight,
  Palette,
  Type,
  Users,
  BookOpen,
  FileText,
  Sparkles,
  ArrowRight,
  X as XIcon,
  AlertTriangle,
  MousePointer2,
} from "lucide-react";
import { Link } from "react-router";

/* ── Color swatches for Brand Vault ── */
const brandColors = [
  { hex: "#1a1a2e", name: "Primary" },
  { hex: "#3b4fc4", name: "Accent" },
  { hex: "#f4f4f6", name: "Light" },
  { hex: "#111113", name: "Text" },
  { hex: "#ffffff", name: "Background" },
];

/* ── Canvas layers ── */
const canvasLayers = [
  { name: "Headline", type: "text", visible: true },
  { name: "Subheadline", type: "text", visible: true },
  { name: "CTA Button", type: "shape", visible: true },
  { name: "Logo", type: "image", visible: true },
  { name: "Background", type: "shape", visible: false },
];

/* ── Asset Builder steps ── */
const assetSteps = [
  { label: "Brief", done: true },
  { label: "Script", done: true },
  { label: "Visuals", done: true },
  { label: "Brand check", done: true },
];

export function StudioSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"vault" | "canvas" | "asset">("vault");
  const [beforeAfter, setBeforeAfter] = useState<"before" | "after">("before");

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Auto-cycle tabs */
  useEffect(() => {
    if (!isVisible) return;
    const tabs: Array<"vault" | "canvas" | "asset"> = ["vault", "canvas", "asset"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % tabs.length;
      setActiveTab(tabs[idx]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section ref={sectionRef} className="pt-6 pb-0 md:pt-12 md:pb-0 relative">
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, #1a1a2e 0%, #232347 35%, #2d3a6e 60%, #3b4fc4 80%, #6b7ec9 100%)",
          paddingTop: "clamp(48px, 6vw, 80px)",
          paddingBottom: "0",
        }}
      >
        {/* Noise */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-3"
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
              Studio plan — 49/mo
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
              Brand control.{" "}
              <span style={{ color: "rgba(255,255,255,0.45)" }}>
                Visual production.
              </span>
            </h2>
            <p
              className="mt-4"
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Set up your Brand Vault once. Every output checks against it. Then
              compose publish-ready assets in the Canvas — without switching
              tools.
            </p>
          </motion.div>

          {/* ── STUDIO MOCKUP ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ marginBottom: "-2px" }}
          >
            <div
              className="bg-card rounded-xl border overflow-hidden w-full max-w-[1060px] mx-auto"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                boxShadow:
                  "0 8px 60px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                    ORA Studio
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: "#16a34a",
                      background: "rgba(22,163,74,0.08)",
                    }}
                  >
                    Brand active
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    Acme Corp
                  </span>
                </div>
              </div>

              {/* App body */}
              <div className="flex min-h-[420px] md:min-h-[460px]">
                {/* ── LEFT SIDEBAR ── */}
                <div
                  className="hidden md:flex flex-col w-[200px] flex-shrink-0 border-r py-4 px-3"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--secondary)",
                  }}
                >
                  {/* Nav tabs */}
                  {(
                    [
                      { key: "vault", icon: Shield, label: "Brand Vault" },
                      { key: "canvas", icon: Layers, label: "Canvas" },
                      { key: "asset", icon: FileText, label: "Asset Builder" },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer mb-0.5"
                        style={{
                          background: isActive ? "var(--ora-signal-light)" : "transparent",
                          color: isActive ? "var(--ora-signal)" : "var(--muted-foreground)",
                        }}
                      >
                        <Icon size={14} strokeWidth={1.5} />
                        <span style={{ fontSize: "12px", fontWeight: isActive ? 500 : 400 }}>
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}

                  {/* Vault summary */}
                  <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Active brand
                    </span>
                    <p className="mt-1" style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                      Acme Corp
                    </p>
                    <div className="flex gap-1.5 mt-3">
                      {brandColors.map((c) => (
                        <div
                          key={c.hex}
                          className="w-5 h-5 rounded"
                          style={{ background: c.hex, border: "1px solid rgba(0,0,0,0.08)" }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <p
                      className="mt-3"
                      style={{
                        fontSize: "11px",
                        lineHeight: 1.5,
                        color: "var(--muted-foreground)",
                        fontStyle: "italic",
                      }}
                    >
                      "Clear. Direct. Human."
                    </p>
                  </div>
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="flex-1 relative overflow-hidden">
                  {/* ═══ Vault view ═══ */}
                  {activeTab === "vault" && (
                    <motion.div
                      key="vault"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-5 md:p-6 h-full"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <h3 style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
                          Brand Vault
                        </h3>
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}
                        >
                          96/100 score
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: Type, title: "Tone of voice", content: "Clear. Direct. Human. No jargon, no surprises.", badge: "Validated" },
                          { icon: Palette, title: "Visual identity", content: "5 brand colors, 2 fonts, logo variants", badge: "Complete" },
                          { icon: Users, title: "Personas", content: "3 personas: Startup Founder, Product Manager, Developer", badge: "Active" },
                          { icon: BookOpen, title: "Vocabulary", content: '12 approved terms, 8 banned words, "build" > "create"', badge: "Updated" },
                        ].map((card, i) => {
                          const Icon = card.icon;
                          return (
                            <motion.div
                              key={card.title}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + i * 0.08 }}
                              className="border rounded-xl p-4 cursor-default hover:border-ora-signal/20 transition-colors"
                              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                            >
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--ora-signal-light)" }}>
                                  <Icon size={13} style={{ color: "var(--ora-signal)" }} strokeWidth={1.5} />
                                </div>
                                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{card.title}</span>
                              </div>
                              <p style={{ fontSize: "11px", lineHeight: 1.55, color: "var(--muted-foreground)" }}>{card.content}</p>
                              <span
                                className="inline-block mt-2.5 px-2 py-0.5 rounded-full"
                                style={{ fontSize: "9px", fontWeight: 600, color: "#16a34a", background: "rgba(22,163,74,0.06)" }}
                              >
                                {card.badge}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ Canvas view with micro-animations ═══ */}
                  {activeTab === "canvas" && (
                    <motion.div
                      key="canvas"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-5 md:p-6 h-full flex gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <h3 style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
                            Canvas
                          </h3>
                          <div className="flex items-center gap-2">
                            {["1:1", "16:9", "9:16", "4:5"].map((r) => (
                              <span
                                key={r}
                                className="px-2 py-0.5 rounded"
                                style={{
                                  fontSize: "9px",
                                  fontWeight: 500,
                                  color: r === "1:1" ? "var(--ora-signal)" : "var(--muted-foreground)",
                                  background: r === "1:1" ? "var(--ora-signal-light)" : "var(--secondary)",
                                }}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Visual canvas with micro-animations */}
                        <div
                          className="relative rounded-xl border overflow-hidden mx-auto"
                          style={{
                            aspectRatio: "1",
                            maxWidth: "320px",
                            borderColor: "var(--border)",
                            background: "linear-gradient(145deg, #1a1a2e 0%, #2d2b55 100%)",
                          }}
                        >
                          {/* Grid dots */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                              backgroundSize: "20px 20px",
                            }}
                          />

                          {/* Animated content blocks */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-3">
                            {/* Headline — floats gently + gets "dragged" */}
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{
                                opacity: 1,
                                y: [0, -3, 0],
                                x: [0, 0, 6, 6, 0],
                              }}
                              transition={{
                                opacity: { duration: 0.4, delay: 0.15 },
                                y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                x: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 },
                              }}
                              className="w-full text-center"
                            >
                              <div
                                className="rounded px-3 py-1.5 inline-block relative"
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px dashed rgba(59,79,196,0.4)",
                                }}
                              >
                                {/* Selection corners on headline */}
                                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-sm" style={{ background: "var(--ora-signal)" }} />
                                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-sm" style={{ background: "var(--ora-signal)" }} />
                                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-sm" style={{ background: "var(--ora-signal)" }} />
                                <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-sm" style={{ background: "var(--ora-signal)" }} />
                                <span style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", letterSpacing: "-0.02em" }}>
                                  Ship faster with AI
                                </span>
                              </div>
                            </motion.div>

                            {/* Subheadline — gentle opacity pulse */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0.7, 1, 0.7] }}
                              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                              className="text-center"
                            >
                              <div
                                className="rounded px-3 py-1 inline-block"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
                              >
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                                  One prompt. Every model. Your brand.
                                </span>
                              </div>
                            </motion.div>

                            {/* CTA button — scale pulse */}
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{
                                opacity: 1,
                                scale: [1, 1.03, 1],
                              }}
                              transition={{
                                opacity: { duration: 0.4, delay: 0.5 },
                                scale: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 },
                              }}
                            >
                              <div
                                className="rounded-lg px-5 py-2 mt-2"
                                style={{ background: "#3b4fc4", border: "1px dashed rgba(59,79,196,0.6)" }}
                              >
                                <span style={{ fontSize: "11px", fontWeight: 500, color: "#ffffff" }}>
                                  Start for free
                                </span>
                              </div>
                            </motion.div>
                          </div>

                          {/* Animated cursor simulating drag */}
                          <motion.div
                            className="absolute pointer-events-none z-20"
                            initial={{ opacity: 0, left: "55%", top: "30%" }}
                            animate={{
                              opacity: [0, 1, 1, 1, 1, 0],
                              left: ["55%", "55%", "58%", "58%", "55%", "55%"],
                              top: ["30%", "30%", "28%", "28%", "30%", "30%"],
                            }}
                            transition={{
                              duration: 6,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 1,
                            }}
                          >
                            <MousePointer2
                              size={16}
                              style={{ color: "rgba(255,255,255,0.7)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
                              fill="rgba(255,255,255,0.7)"
                            />
                          </motion.div>

                          {/* Selection frame corners */}
                          <motion.div
                            className="absolute top-6 left-6 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm"
                            style={{ borderColor: "var(--ora-signal)" }}
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          />
                          <motion.div
                            className="absolute top-6 right-6 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm"
                            style={{ borderColor: "var(--ora-signal)" }}
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                          />
                          <motion.div
                            className="absolute bottom-6 left-6 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm"
                            style={{ borderColor: "var(--ora-signal)" }}
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                          />
                          <motion.div
                            className="absolute bottom-6 right-6 w-3 h-3 border-b-2 border-r-2 rounded-br-sm"
                            style={{ borderColor: "var(--ora-signal)" }}
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                          />
                        </div>

                        {/* Bottom toolbar */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded"
                              style={{ fontSize: "9px", fontWeight: 600, color: "#16a34a", background: "rgba(22,163,74,0.06)" }}
                            >
                              Brand check passed
                            </span>
                          </div>
                          <span
                            className="px-2.5 py-1 rounded-lg"
                            style={{
                              fontSize: "10px",
                              fontWeight: 500,
                              color: "var(--foreground)",
                              background: "var(--secondary)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Export PNG
                          </span>
                        </div>
                      </div>

                      {/* Layers panel with highlight animation */}
                      <div
                        className="hidden lg:block w-[160px] flex-shrink-0 border rounded-xl p-3"
                        style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
                      >
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          Layers
                        </span>
                        <div className="mt-3 space-y-1">
                          <CanvasLayersList />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ Asset Builder view ═══ */}
                  {activeTab === "asset" && (
                    <motion.div
                      key="asset"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-5 md:p-6 h-full"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <h3 style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
                          Asset Builder
                        </h3>
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{ fontSize: "10px", fontWeight: 600, color: "#16a34a", background: "rgba(22,163,74,0.06)" }}
                        >
                          Complete
                        </span>
                      </div>

                      {/* Progress steps */}
                      <div className="flex items-center gap-1 mb-5">
                        {assetSteps.map((step, i) => (
                          <div key={step.label} className="flex items-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: step.done ? "var(--ora-signal)" : "var(--secondary)" }}
                              >
                                <Check size={10} style={{ color: step.done ? "#fff" : "var(--muted-foreground)" }} strokeWidth={2.5} />
                              </div>
                              <span style={{ fontSize: "10px", fontWeight: 500, color: step.done ? "var(--foreground)" : "var(--muted-foreground)" }}>
                                {step.label}
                              </span>
                            </div>
                            {i < assetSteps.length - 1 && (
                              <ChevronRight size={10} style={{ color: "var(--muted-foreground)", opacity: 0.4, marginLeft: "2px", marginRight: "2px" }} />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Brief */}
                      <div
                        className="rounded-xl border p-4 mb-4"
                        style={{ borderColor: "var(--border)", background: "var(--input-background)" }}
                      >
                        <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                          Brief
                        </span>
                        <p className="mt-1.5" style={{ fontSize: "12px", lineHeight: 1.55, color: "var(--foreground)" }}>
                          Announce our new AI aggregator positioning. Target: indie creators and small teams. Tone: direct, honest. Channels: LinkedIn post + Story visual.
                        </p>
                      </div>

                      {/* Generated outputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="border rounded-xl p-4"
                          style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--foreground)" }}>LinkedIn Post</span>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)" }}>96/100</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="h-2 rounded-full w-full" style={{ background: "var(--foreground)", opacity: 0.07 }} />
                            <div className="h-2 rounded-full w-11/12" style={{ background: "var(--foreground)", opacity: 0.05 }} />
                            <div className="h-2 rounded-full w-9/12" style={{ background: "var(--foreground)", opacity: 0.04 }} />
                            <div className="h-2 rounded-full w-10/12" style={{ background: "var(--foreground)", opacity: 0.05 }} />
                            <div className="h-2 rounded-full w-7/12" style={{ background: "var(--foreground)", opacity: 0.03 }} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-3">
                            <Sparkles size={10} style={{ color: "var(--ora-signal)" }} />
                            <span style={{ fontSize: "9px", color: "var(--ora-signal)", fontWeight: 500 }}>Brand-compliant</span>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="border rounded-xl p-4"
                          style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--foreground)" }}>Story Visual</span>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)" }}>94/100</span>
                          </div>
                          <div
                            className="rounded-lg overflow-hidden"
                            style={{ aspectRatio: "9/12", maxHeight: "120px", background: "linear-gradient(145deg, #1a1a2e 0%, #3b4fc4 100%)" }}
                          >
                            <div className="flex flex-col items-center justify-center h-full p-3 gap-1.5">
                              <div className="w-3/4 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.25)" }} />
                              <div className="w-1/2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
                              <div className="mt-1 px-3 py-1 rounded" style={{ background: "rgba(255,255,255,0.15)" }}>
                                <div className="w-8 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.4)" }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-3">
                            <Sparkles size={10} style={{ color: "var(--ora-signal)" }} />
                            <span style={{ fontSize: "9px", color: "var(--ora-signal)", fontWeight: 500 }}>Brand-compliant</span>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── CTA + Feature strip ── */}
      <div className="bg-background border-t" style={{ borderColor: "var(--border)" }}>
        {/* Start Studio CTA */}
        <div className="flex flex-col items-center gap-4 py-8">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-lg transition-opacity hover:opacity-90"
            style={{
              background: "var(--ora-signal)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 500,
              boxShadow: "0 1px 3px rgba(59,79,196,0.3), 0 8px 24px rgba(59,79,196,0.15)",
            }}
          >
            Start Studio <ArrowRight size={16} />
          </Link>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
            Free 7-day trial. No credit card required.
          </span>
        </div>

        {/* Feature checkmarks */}
        <div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10 py-5 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {["Brand Vault", "Canvas editor", "Asset Builder", "Compliance check", "4 export ratios"].map((f) => (
            <span key={f} className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
              <Check size={11} style={{ color: "var(--ora-signal)" }} strokeWidth={2.5} />
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── BEFORE / AFTER TOGGLE ── */}
      <div className="py-16 md:py-20 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h3
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
                color: "var(--foreground)",
              }}
            >
              Same prompt. Different outcome.
            </h3>
            <p className="mt-3" style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
              See what Brand Vault enforcement changes in your generated content.
            </p>

            {/* Toggle */}
            <div className="inline-flex items-center mt-6 rounded-full p-1" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => setBeforeAfter("before")}
                className="px-5 py-2 rounded-full transition-all cursor-pointer"
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: beforeAfter === "before" ? "#ffffff" : "var(--muted-foreground)",
                  background: beforeAfter === "before" ? "var(--foreground)" : "transparent",
                }}
              >
                Without Vault
              </button>
              <button
                onClick={() => setBeforeAfter("after")}
                className="px-5 py-2 rounded-full transition-all cursor-pointer"
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: beforeAfter === "after" ? "#ffffff" : "var(--muted-foreground)",
                  background: beforeAfter === "after" ? "var(--ora-signal)" : "transparent",
                }}
              >
                With Vault
              </button>
            </div>
          </motion.div>

          {/* Before / After content */}
          <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
            <AnimatePresence mode="wait">
              {beforeAfter === "before" ? (
                <BeforeCard key="before-linkedin" />
              ) : (
                <AfterCard key="after-linkedin" type="linkedin" />
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {beforeAfter === "before" ? (
                <BeforeVisualCard key="before-visual" />
              ) : (
                <AfterVisualCard key="after-visual" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Canvas layers with cycling highlight ── */
function CanvasLayersList() {
  const [activeLayer, setActiveLayer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLayer((prev) => (prev + 1) % canvasLayers.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {canvasLayers.map((layer, i) => (
        <motion.div
          key={layer.name}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
          style={{
            background: i === activeLayer ? "var(--ora-signal-light)" : "transparent",
          }}
        >
          <div
            className="w-2 h-2 rounded-sm"
            style={{
              background: layer.type === "text" ? "var(--ora-signal)" : layer.type === "shape" ? "#6b7ec9" : "#4a5568",
              opacity: layer.visible ? 0.6 : 0.2,
            }}
          />
          <span
            style={{
              fontSize: "10px",
              color: layer.visible ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: i === activeLayer ? 500 : 400,
              textDecoration: layer.visible ? "none" : "line-through",
            }}
          >
            {layer.name}
          </span>
          {i === activeLayer && (
            <motion.div
              layoutId="layer-indicator"
              className="ml-auto w-1 h-1 rounded-full"
              style={{ background: "var(--ora-signal)" }}
            />
          )}
        </motion.div>
      ))}
    </>
  );
}

/* ── BEFORE cards ── */
function BeforeCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="border rounded-xl p-5 relative"
      style={{ borderColor: "var(--destructive)", borderStyle: "solid", boxShadow: "0 1px 3px rgba(212,24,61,0.08)" }}
    >
      {/* Score */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>LinkedIn Post</span>
        <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: "var(--destructive)", background: "rgba(212,24,61,0.06)" }}>
          54/100
        </span>
      </div>

      {/* Mock content with issues */}
      <div className="space-y-3">
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--foreground)" }}>
          <span style={{ background: "rgba(212,24,61,0.1)", padding: "1px 3px", borderRadius: "3px" }}>
            Hey everyone!
          </span>{" "}
          We're SO excited to announce that our{" "}
          <span style={{ background: "rgba(212,24,61,0.1)", padding: "1px 3px", borderRadius: "3px" }}>
            AMAZING
          </span>{" "}
          new AI tool is here.{" "}
          <span style={{ background: "rgba(212,24,61,0.1)", padding: "1px 3px", borderRadius: "3px" }}>
            It's literally going to revolutionize
          </span>{" "}
          the way you create content!!
        </p>
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
          Check it out and let us know what you think in the comments below!
        </p>
      </div>

      {/* Issues list */}
      <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        {[
          "Tone: too casual, not direct",
          'Banned word: "revolutionize"',
          "Missing brand vocabulary",
          "No clear value proposition",
        ].map((issue) => (
          <div key={issue} className="flex items-center gap-2">
            <AlertTriangle size={10} style={{ color: "var(--destructive)", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--destructive)" }}>{issue}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BeforeVisualCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="border rounded-xl p-5"
      style={{ borderColor: "var(--destructive)", boxShadow: "0 1px 3px rgba(212,24,61,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>Story Visual</span>
        <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: "var(--destructive)", background: "rgba(212,24,61,0.06)" }}>
          41/100
        </span>
      </div>

      {/* Ugly visual: wrong colors, wrong font feel */}
      <div
        className="rounded-lg overflow-hidden mx-auto"
        style={{
          aspectRatio: "9/16",
          maxHeight: "200px",
          background: "linear-gradient(145deg, #ff6b6b 0%, #ffd93d 50%, #6bcb77 100%)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full p-4 gap-2">
          <div className="w-full text-center">
            <span style={{ fontSize: "14px", fontWeight: 300, color: "#ffffff", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              AMAZING NEW AI!!
            </span>
          </div>
          <div className="w-full text-center">
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)" }}>
              check it out now!!!
            </span>
          </div>
          <div className="px-4 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}>
            <span style={{ fontSize: "9px", color: "#ffffff" }}>Click here</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        {[
          "Colors: off-brand (rainbow gradient)",
          "Typography: wrong weight & case",
          "CTA: vague, no clear action",
        ].map((issue) => (
          <div key={issue} className="flex items-center gap-2">
            <AlertTriangle size={10} style={{ color: "var(--destructive)", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--destructive)" }}>{issue}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── AFTER cards ── */
function AfterCard({ type }: { type: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="border rounded-xl p-5"
      style={{ borderColor: "var(--ora-signal)", boxShadow: "0 1px 3px rgba(59,79,196,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>LinkedIn Post</span>
        <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>
          96/100
        </span>
      </div>

      <div className="space-y-3">
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--foreground)" }}>
          We built ORA for one reason: choosing an AI model shouldn't be harder than using one.
        </p>
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
          One account. GPT-4o, Claude, Gemini — side by side. Compare outputs. Pick the best. Ship it. No switching tabs, no managing 4 subscriptions.
        </p>
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
          Built for indie creators and small teams who move fast.
        </p>
      </div>

      {/* Passes */}
      <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        {[
          "Tone: direct, clear, human",
          "Vocabulary: brand-approved terms only",
          "Structure: hook + value + CTA",
          "Persona match: Startup Founder",
        ].map((pass) => (
          <div key={pass} className="flex items-center gap-2">
            <Check size={10} style={{ color: "var(--ora-signal)", flexShrink: 0 }} strokeWidth={2.5} />
            <span style={{ fontSize: "11px", color: "var(--ora-signal)" }}>{pass}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AfterVisualCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="border rounded-xl p-5"
      style={{ borderColor: "var(--ora-signal)", boxShadow: "0 1px 3px rgba(59,79,196,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>Story Visual</span>
        <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>
          94/100
        </span>
      </div>

      {/* On-brand visual */}
      <div
        className="rounded-lg overflow-hidden mx-auto"
        style={{
          aspectRatio: "9/16",
          maxHeight: "200px",
          background: "linear-gradient(145deg, #1a1a2e 0%, #2d3a6e 50%, #3b4fc4 100%)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full p-4 gap-2.5">
          <div className="w-full text-center">
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#ffffff", letterSpacing: "-0.02em" }}>
              One prompt. Every AI.
            </span>
          </div>
          <div className="w-full text-center">
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>
              Compare. Choose. Ship.
            </span>
          </div>
          <div className="px-4 py-1.5 rounded-lg mt-1" style={{ background: "#3b4fc4", border: "1px solid rgba(255,255,255,0.15)" }}>
            <span style={{ fontSize: "9px", fontWeight: 500, color: "#ffffff" }}>Start for free</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        {[
          "Colors: brand palette only",
          "Typography: Inter, weight 500",
          "CTA: clear action, on-brand style",
        ].map((pass) => (
          <div key={pass} className="flex items-center gap-2">
            <Check size={10} style={{ color: "var(--ora-signal)", flexShrink: 0 }} strokeWidth={2.5} />
            <span style={{ fontSize: "11px", color: "var(--ora-signal)" }}>{pass}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
