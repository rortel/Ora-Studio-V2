import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, ImageIcon, Film, FileText, Music } from "lucide-react";
import { Link } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";

/**
 * Screen 3 — Studio campaign multi-format preview
 * Shows the prompt bar + results appearing across formats
 */

const mockResults = [
  { model: "Photon 1", provider: "Luma AI", img: "https://images.unsplash.com/photo-1611930021698-a55ec4d5fe6e?w=600&q=90", time: "3.2s" },
  { model: "Flux Pro 2", provider: "Black Forest", img: "https://images.unsplash.com/photo-1662972580899-b64ac990c9e9?w=600&q=90", time: "5.1s" },
  { model: "DALL-E 3", provider: "OpenAI", img: "https://images.unsplash.com/photo-1769122489832-465d4e408895?w=600&q=90", time: "4.8s" },
  { model: "Seedream V4", provider: "ByteDance", img: "https://images.unsplash.com/photo-1741745978060-9add161ba2c2?w=600&q=90", time: "2.9s" },
];

export function StudioExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !fired.current) {
          fired.current = true;
          setPhase(1);
        }
      },
      { threshold: 0.25 }
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    if (phase < 1) return;
    const timers = [
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2400),
      setTimeout(() => setPhase(4), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <section ref={ref} className="py-24 md:py-32" style={{ background: "#1a1918" }}>
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#E8E4DF",
              marginBottom: 12,
            }}
          >
            The studio
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.55, color: "#5C5856", maxWidth: 440 }}>
            Type your prompt. Watch results arrive from multiple models simultaneously.
          </p>
        </motion.div>

        {/* Studio mock */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#131211",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Prompt bar */}
          <div
            className="px-5 py-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-1.5">
              {[
                { icon: ImageIcon, label: "Image", active: true },
                { icon: Film, label: "Video" },
                { icon: FileText, label: "Text" },
                { icon: Music, label: "Audio" },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.label}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md"
                    style={{
                      background: t.active ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                  >
                    <Icon size={12} style={{ color: t.active ? "#E8E4DF" : "#5C5856" }} />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: t.active ? 500 : 400,
                        color: t.active ? "#E8E4DF" : "#5C5856",
                      }}
                    >
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={phase >= 1 ? { opacity: 1 } : {}}
                style={{ fontSize: "13px", color: "#9A9590", fontWeight: 400 }}
              >
                {phase >= 1
                  ? "luxury perfume bottle, dark moody lighting, cinematic..."
                  : ""}
              </motion.span>
              {phase < 1 && (
                <span style={{ fontSize: "13px", color: "#5C5856" }}>
                  Describe what you want to create...
                </span>
              )}
            </div>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: phase >= 2 ? "#E8E4DF" : "rgba(255,255,255,0.04)",
              }}
            >
              <ArrowUp
                size={14}
                style={{ color: phase >= 2 ? "#131211" : "#5C5856" }}
              />
            </div>
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
            {mockResults.map((r, i) => (
              <motion.div
                key={r.model}
                initial={{ opacity: 0, y: 16 }}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
                transition={{
                  delay: i * 0.15,
                  duration: 0.5,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <ImageWithFallback
                    src={r.img}
                    alt={r.model}
                    className="w-full h-full object-cover"
                  />
                  {phase < 3 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(19,18,17,0.85)" }}
                    >
                      <motion.div
                        className="w-4 h-4 rounded-full"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      />
                    </div>
                  )}
                </div>
                <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "#E8E4DF" }}>
                      {r.model}
                    </span>
                    {phase >= 4 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ fontSize: "10px", color: "#5C5856" }}
                      >
                        {r.time}
                      </motion.span>
                    )}
                  </div>
                  <span style={{ fontSize: "10px", color: "#5C5856" }}>
                    {r.provider}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mt-12"
        >
          <Link
            to="/hub"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-all hover:opacity-90"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#E8E4DF",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Open the studio
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
