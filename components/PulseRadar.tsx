import { motion } from "motion/react";

const targets = [
  { label: "Email", angle: -90, desc: "Sequences & newsletters" },
  { label: "LinkedIn", angle: -36, desc: "Posts & articles" },
  { label: "SMS", angle: 12, desc: "Short-form direct" },
  { label: "Ad", angle: 60, desc: "Copy & creatives" },
  { label: "Landing", angle: 108, desc: "Full page builds" },
  { label: "Stories", angle: 156, desc: "Vertical social" },
  { label: "Newsletter", angle: 204, desc: "Weekly digests" },
];

export function PulseRadar() {
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const rings = [55, 90, 125, 160, 195, 230];
  const dotRadius = 230;

  return (
    <section
      className="py-20 md:py-28 overflow-hidden relative"
      style={{
        background:
          "linear-gradient(180deg, var(--background) 0%, #0f1029 4%, #0f1029 96%, var(--background) 100%)",
      }}
    >
      {/* Section header */}
      <div className="max-w-[1200px] mx-auto px-6 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <span
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ora-signal)",
              background: "rgba(59,79,196,0.12)",
              border: "1px solid rgba(59,79,196,0.2)",
            }}
          >
            Signal propagation
          </span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              color: "#ffffff",
            }}
          >
            One message.{" "}
            <span style={{ color: "rgba(255,255,255,0.4)" }}>
              Every channel.
            </span>
          </h2>
          <p
            className="mt-3 mx-auto max-w-[460px]"
            style={{
              fontSize: "15px",
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Your master content propagates outward — adapted, optimized, and
            brand-compliant for each destination.
          </p>
        </motion.div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
          style={{ width: size, height: size }}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            className="w-full h-full max-w-full"
          >
            <defs>
              <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor="var(--ora-signal)"
                  stopOpacity="0.2"
                />
                <stop
                  offset="50%"
                  stopColor="var(--ora-signal)"
                  stopOpacity="0.05"
                />
                <stop
                  offset="100%"
                  stopColor="var(--ora-signal)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>

            {/* Glow */}
            <circle cx={cx} cy={cy} r={240} fill="url(#radar-glow)" />

            {/* Concentric rings */}
            {rings.map((r, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke="rgba(59,79,196,0.25)"
                strokeWidth={0.6}
                opacity={0.3 + i * 0.08}
              />
            ))}

            {/* Radial lines */}
            {targets.map((t, i) => {
              const rad = (t.angle * Math.PI) / 180;
              const x2 = cx + dotRadius * Math.cos(rad);
              const y2 = cy + dotRadius * Math.sin(rad);
              return (
                <line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(59,79,196,0.2)"
                  strokeWidth={0.6}
                  strokeDasharray="3 5"
                />
              );
            })}

            {/* Center dot with glow */}
            <circle
              cx={cx}
              cy={cy}
              r={12}
              fill="var(--ora-signal)"
              opacity={0.12}
            />
            <circle cx={cx} cy={cy} r={5} fill="var(--ora-signal)" />

            {/* Animated pulses */}
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={`pulse-${i}`}
                cx={cx}
                cy={cy}
                r={0}
                stroke="var(--ora-signal)"
                strokeWidth={1.2}
                fill="none"
                animate={{
                  r: [0, 230],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 4,
                  delay: i * 1.3,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Target nodes - outer circles */}
            {targets.map((t, i) => {
              const rad = (t.angle * Math.PI) / 180;
              const dx = cx + dotRadius * Math.cos(rad);
              const dy = cy + dotRadius * Math.sin(rad);
              return (
                <g key={`dot-${i}`}>
                  <circle
                    cx={dx}
                    cy={dy}
                    r={16}
                    fill="rgba(59,79,196,0.08)"
                    stroke="rgba(59,79,196,0.3)"
                    strokeWidth={0.8}
                  />
                  <circle
                    cx={dx}
                    cy={dy}
                    r={4}
                    fill="var(--ora-signal)"
                    opacity={0.8}
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels as card-like elements */}
          {targets.map((t, i) => {
            const rad = (t.angle * Math.PI) / 180;
            const labelR = 260;
            const lx = 50 + (labelR / (size / 2)) * 50 * Math.cos(rad);
            const ly = 50 + (labelR / (size / 2)) * 50 * Math.sin(rad);
            return (
              <motion.div
                key={t.label}
                className="absolute"
                style={{
                  left: `${lx}%`,
                  top: `${ly}%`,
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <div
                  className="px-3 py-1.5 rounded-lg text-center"
                  style={{
                    background: "rgba(59,79,196,0.08)",
                    border: "1px solid rgba(59,79,196,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    className="block"
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.85)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="block"
                    style={{
                      fontSize: "9px",
                      color: "rgba(255,255,255,0.35)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.desc}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {/* Center label */}
          <div
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, 16px)",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ora-signal)",
              }}
            >
              Source
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
