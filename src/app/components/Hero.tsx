import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   THE CONSTELLATION — Immersive Cinematic Hero
   
   Concept: A single creative signal radiates outward,
   birthing a living constellation of content across
   every format. The viewer witnesses creation itself.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── Orbital content cards — the constellation ─── */
const cards = [
  {
    img: "https://images.unsplash.com/photo-1767089261452-1245afe371af?w=400&q=85",
    label: "Brand Campaign",
    format: "Image",
    x: -38, y: -32, z: 80, rotate: -6, scale: 1.05,
  },
  {
    img: "https://images.unsplash.com/photo-1737920459846-2d0318700658?w=400&q=85",
    label: "Product Launch",
    format: "Ad",
    x: 34, y: -28, z: 40, rotate: 4, scale: 0.95,
  },
  {
    img: "https://images.unsplash.com/photo-1688377051459-aebb99b42bff?w=400&q=85",
    label: "Social Story",
    format: "Video",
    x: -42, y: 12, z: 120, rotate: -3, scale: 0.85,
  },
  {
    img: "https://images.unsplash.com/photo-1744148621897-5fb0b6323543?w=400&q=85",
    label: "Editorial",
    format: "Story",
    x: 40, y: 18, z: 60, rotate: 5, scale: 1.0,
  },
  {
    img: "https://images.unsplash.com/photo-1650464595868-fd12e3047d33?w=400&q=85",
    label: "Fashion Editorial",
    format: "Reel",
    x: -18, y: -44, z: 160, rotate: -2, scale: 0.75,
  },
  {
    img: "https://images.unsplash.com/photo-1749800843099-83d0ee3d809e?w=400&q=85",
    label: "Nature Film",
    format: "Video",
    x: 18, y: 40, z: 100, rotate: 3, scale: 0.88,
  },
  {
    img: "https://images.unsplash.com/photo-1666003400042-a9e68d6bff0f?w=400&q=85",
    label: "Brand Story",
    format: "Post",
    x: -44, y: 38, z: 200, rotate: -4, scale: 0.7,
  },
  {
    img: "https://images.unsplash.com/photo-1670177257750-9b47927f68eb?w=400&q=85",
    label: "Luxury Product",
    format: "Ad",
    x: 44, y: -40, z: 140, rotate: 2, scale: 0.78,
  },
  {
    img: "https://images.unsplash.com/photo-1714273709936-e5363d76b88f?w=400&q=85",
    label: "Travel Campaign",
    format: "TikTok",
    x: 0, y: 44, z: 180, rotate: -1, scale: 0.72,
  },
  {
    img: "https://images.unsplash.com/photo-1713147906717-173b53ca4e56?w=400&q=85",
    label: "Abstract Visual",
    format: "Image",
    x: -30, y: -8, z: 220, rotate: 6, scale: 0.65,
  },
  {
    img: "https://images.unsplash.com/photo-1676044162854-1550e3f6dcc2?w=400&q=85",
    label: "Botanical Series",
    format: "Pinterest",
    x: 30, y: 6, z: 240, rotate: -5, scale: 0.6,
  },
];

/* ─── Words that cycle through — the creative signal ─── */
const ROTATING_WORDS = ["LinkedIn", "Instagram", "TikTok", "Facebook", "Reel", "Story", "Ad", "Campaign"];

/* ─── Film-grain noise SVG as inline data URI ─── */
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

/* ─── Easing ─── */
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const [phase, setPhase] = useState(0);
  // 0: void  1: pulse  2: constellation rises  3: text  4: full

  const [wordIndex, setWordIndex] = useState(0);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  /* Phase progression */
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2600),
      setTimeout(() => setPhase(4), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  /* Rotating words */
  useEffect(() => {
    if (phase < 4) return;
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  /* Mouse parallax */
  const handleMouse = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseX((e.clientX - rect.left) / rect.width - 0.5);
    setMouseY((e.clientY - rect.top) / rect.height - 0.5);
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        height: "100svh",
        minHeight: 600,
        background: "#0a0a09",
        marginTop: "-56px",
        paddingTop: "56px",
      }}
      onMouseMove={handleMouse}
    >
      {/* ━━━ Layer 0: Film grain ━━━ */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          mixBlendMode: "overlay",
          opacity: 0.5,
        }}
      />

      {/* ━━━ Layer 1: Radial spotlights ━━━ */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 2.5 }}
        style={{
          background: `
            radial-gradient(ellipse 35% 45% at 50% 45%, rgba(232,228,223,0.06) 0%, transparent 100%),
            radial-gradient(ellipse 60% 30% at 30% 60%, rgba(196,154,90,0.03) 0%, transparent 100%),
            radial-gradient(ellipse 50% 35% at 70% 35%, rgba(196,91,74,0.02) 0%, transparent 100%)
          `,
        }}
      />

      {/* ━━━ Layer 2: The Pulse — concentric rings from center ━━━ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          className="absolute"
          width="1200"
          height="1200"
          viewBox="0 0 1200 1200"
          fill="none"
          style={{ maxWidth: "140vw", maxHeight: "140vh" }}
        >
          {/* Static rings */}
          {[120, 200, 300, 420, 560].map((r, i) => (
            <motion.circle
              key={`ring-${i}`}
              cx={600}
              cy={600}
              r={r}
              stroke="#E8E4DF"
              strokeWidth={0.5}
              fill="none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: phase >= 1 ? 0.04 + i * 0.005 : 0,
                scale: 1,
              }}
              transition={{
                duration: 2,
                delay: 0.3 + i * 0.15,
                ease: EASE_OUT_EXPO as unknown as number[],
              }}
            />
          ))}

          {/* Animated pulse rings — perpetual */}
          {phase >= 1 &&
            [0, 1, 2].map((i) => (
              <motion.circle
                key={`pulse-${i}`}
                cx={600}
                cy={600}
                stroke="#E8E4DF"
                strokeWidth={0.8}
                fill="none"
                initial={{ r: 0, opacity: 0 }}
                animate={{
                  r: [0, 580],
                  opacity: [0.12, 0],
                }}
                transition={{
                  duration: 5,
                  delay: i * 1.7,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            ))}

          {/* Center dot */}
          <motion.circle
            cx={600}
            cy={600}
            fill="#E8E4DF"
            initial={{ r: 0, opacity: 0 }}
            animate={{
              r: phase >= 1 ? 3 : 0,
              opacity: phase >= 1 ? 0.8 : 0,
            }}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO as unknown as number[] }}
          />
        </svg>
      </div>

      {/* ━━━ Layer 3: The Constellation — floating cards in 3D space ━━━ */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}
      >
        <div
          className="relative"
          style={{
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `rotateX(${mouseY * -3}deg) rotateY(${mouseX * 3}deg)`,
            transition: "transform 0.6s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          {cards.map((card, i) => {
            const depth = card.z;
            const blur = depth > 150 ? `blur(${Math.min((depth - 150) * 0.015, 3)}px)` : "none";
            const opacityVal = Math.max(0.35, 1 - depth * 0.002);

            return (
              <motion.div
                key={i}
                className="absolute rounded-xl overflow-hidden"
                style={{
                  left: `calc(50% + ${card.x}%)`,
                  top: `calc(50% + ${card.y}%)`,
                  width: `${140 * card.scale}px`,
                  height: `${180 * card.scale}px`,
                  transform: `translate(-50%, -50%) translateZ(${-depth}px) rotate(${card.rotate}deg)`,
                  filter: blur,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{
                  opacity: phase >= 2 ? opacityVal : 0,
                  scale: phase >= 2 ? 1 : 0.3,
                }}
                transition={{
                  duration: 1.4,
                  delay: phase >= 2 ? 0.08 * i : 0,
                  ease: EASE_OUT_EXPO as unknown as number[],
                }}
              >
                <ImageWithFallback
                  src={card.img}
                  alt={card.label}
                  className="w-full h-full object-cover"
                />
                {/* Gradient scrim */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(to top, rgba(10,10,9,0.8) 0%, transparent 50%)",
                  }}
                />
                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                  <span
                    style={{
                      fontSize: `${Math.max(9, 11 * card.scale)}px`,
                      fontWeight: 500,
                      color: "rgba(232,228,223,0.9)",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                    }}
                  >
                    {card.label}
                  </span>
                  <br />
                  <span
                    style={{
                      fontSize: `${Math.max(8, 9 * card.scale)}px`,
                      fontWeight: 400,
                      color: "rgba(154,149,144,0.7)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    {card.format}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ━━━ Layer 4: Vignette overlay (focus toward center) ━━━ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 65% at 50% 50%, transparent 30%, rgba(10,10,9,0.7) 100%)
          `,
        }}
      />

      {/* ━━━ Layer 5: The Words — cinematic typography ━━━ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="text-center px-6 max-w-[900px]">
          {/* Main headline */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.01 }}
              >
                {/* Line 1 */}
                <div className="overflow-hidden mb-2">
                  <motion.div
                    initial={{ y: "110%" }}
                    animate={{ y: "0%" }}
                    transition={{ duration: 1.2, ease: EASE_OUT_EXPO as unknown as number[] }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
                        fontWeight: 300,
                        lineHeight: 1.05,
                        letterSpacing: "-0.045em",
                        color: "#E8E4DF",
                      }}
                    >
                      Every AI model.
                    </span>
                  </motion.div>
                </div>

                {/* Line 2 */}
                <div className="overflow-hidden mb-8">
                  <motion.div
                    initial={{ y: "110%" }}
                    animate={{ y: "0%" }}
                    transition={{
                      duration: 1.2,
                      delay: 0.12,
                      ease: EASE_OUT_EXPO as unknown as number[],
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
                        fontWeight: 300,
                        lineHeight: 1.05,
                        letterSpacing: "-0.045em",
                        color: "#5C5856",
                      }}
                    >
                      One creative studio.
                    </span>
                  </motion.div>
                </div>

                {/* Rotating format word */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase >= 4 ? 1 : 0 }}
                  transition={{ duration: 0.8 }}
                  className="mb-6"
                >
                  <div className="flex items-center justify-center gap-3">
                    <div
                      className="h-[1px] w-8"
                      style={{ background: "rgba(232,228,223,0.15)" }}
                    />
                    <div className="overflow-hidden h-[20px] relative" style={{ minWidth: 120 }}>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={wordIndex}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 400,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase" as const,
                            color: "#9A9590",
                            textAlign: "center",
                          }}
                        >
                          {ROTATING_WORDS[wordIndex]}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <div
                      className="h-[1px] w-8"
                      style={{ background: "rgba(232,228,223,0.15)" }}
                    />
                  </div>
                </motion.div>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 16 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  style={{
                    fontSize: "clamp(14px, 1.5vw, 17px)",
                    lineHeight: 1.6,
                    color: "#9A9590",
                    fontWeight: 400,
                    maxWidth: 460,
                    margin: "0 auto",
                    marginBottom: 36,
                  }}
                >
                  38+ models for images, video, text & audio.
                  <br />
                  One brief. Every channel. Brand-compliant. Always.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA buttons */}
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT_EXPO as unknown as number[] }}
                className="flex items-center justify-center gap-3 pointer-events-auto"
              >
                <Link
                  to="/login?mode=signup"
                  className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl overflow-hidden transition-all"
                  style={{
                    background: "#E8E4DF",
                    color: "#0a0a09",
                    fontSize: "14px",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {/* Shimmer on hover */}
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
                      backgroundSize: "200% 100%",
                      animation: "none",
                    }}
                  />
                  <span className="relative">Start creating</span>
                  <ArrowRight
                    size={15}
                    className="relative group-hover:translate-x-0.5 transition-transform duration-300"
                  />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl transition-all duration-300 hover:bg-white/[0.04]"
                  style={{
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "#9A9590",
                    border: "1px solid rgba(255,255,255,0.08)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  See how it works
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ━━━ Layer 6: Bottom gradient to next section ━━━ */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-30"
        style={{
          background: "linear-gradient(to top, #131211 0%, transparent 100%)",
        }}
      />

      {/* ━━━ Layer 7: Scroll indicator ━━━ */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-[1px] h-6"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, rgba(232,228,223,0.3), transparent)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Corner accents ━━━ */}
      <motion.div
        className="absolute top-6 right-6 z-20 hidden md:flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 4 ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#6B8C5A" }}
        />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: "#5C5856",
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
          }}
        >
          38+ models live
        </span>
      </motion.div>
    </section>
  );
}