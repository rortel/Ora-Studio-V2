import { motion } from "motion/react";

/**
 * Screen 2 — "One prompt, all models" aggregator diagram
 */

const steps = [
  {
    num: "01",
    title: "One prompt",
    desc: "Type once. ORA sends your brief to every AI model simultaneously. No switching tabs, no copy-pasting.",
  },
  {
    num: "02",
    title: "All models",
    desc: "38+ models across image, video, text, code, audio. Each returns its best interpretation. Side by side.",
  },
  {
    num: "03",
    title: "Pick the best",
    desc: "Compare quality, speed, cost instantly. Save to library. Iterate. Ship.",
  },
];

const modelNodes = [
  { name: "GPT-5", x: 78, y: 8 },
  { name: "Claude 4.5", x: 88, y: 22 },
  { name: "Flux Pro", x: 92, y: 38 },
  { name: "Luma Ray", x: 90, y: 54 },
  { name: "DALL-E 3", x: 84, y: 68 },
  { name: "Sora 2", x: 74, y: 82 },
  { name: "Gemini", x: 62, y: 92 },
];

export function ThreeSteps() {
  return (
    <section id="how-it-works" className="py-24 md:py-32" style={{ background: "#131211" }}>
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
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
            One prompt. All models.
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.55, color: "#5C5856", maxWidth: 440 }}>
            The aggregator pattern: your brief goes everywhere at once.
          </p>
        </motion.div>

        {/* Diagram + steps side by side */}
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Aggregator diagram */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <svg viewBox="0 0 100 100" className="w-full max-w-[480px]" fill="none">
              {/* Source dot */}
              <circle cx="8" cy="50" r="2" fill="#E8E4DF" />
              <text x="8" y="58" textAnchor="middle" fill="#5C5856" fontSize="3" fontFamily="Inter">
                prompt
              </text>

              {/* Lines to targets */}
              {modelNodes.map((node, i) => (
                <motion.line
                  key={i}
                  x1="10"
                  y1="50"
                  x2={node.x}
                  y2={node.y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.3"
                  strokeDasharray="1 1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                />
              ))}

              {/* Model nodes */}
              {modelNodes.map((node, i) => (
                <g key={`node-${i}`}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r="1.5"
                    fill="#E8E4DF"
                    opacity={0.4}
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 0.4 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  />
                  <motion.text
                    x={node.x + 3}
                    y={node.y + 1}
                    fill="#9A9590"
                    fontSize="2.5"
                    fontFamily="Inter"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                  >
                    {node.name}
                  </motion.text>
                </g>
              ))}
            </svg>
          </motion.div>

          {/* Steps */}
          <div className="space-y-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-5"
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#5C5856",
                    minWidth: 28,
                    paddingTop: 2,
                  }}
                >
                  {s.num}
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: "17px",
                      fontWeight: 500,
                      color: "#E8E4DF",
                      letterSpacing: "-0.02em",
                      marginBottom: 6,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#9A9590" }}>
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
