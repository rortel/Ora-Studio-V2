import { motion } from "motion/react";

interface PulseMotifProps {
  size?: number;
  rings?: number;
  className?: string;
  animate?: boolean;
  strokeColor?: string;
}

export function PulseMotif({
  size = 320,
  rings = 5,
  className = "",
  animate = true,
  strokeColor = "var(--ora-signal)",
}: PulseMotifProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 4;
  const spacing = maxRadius / (rings + 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="none"
    >
      {/* Source point */}
      <circle cx={center} cy={center} r={2.5} fill={strokeColor} />

      {/* Concentric pulse rings */}
      {Array.from({ length: rings }).map((_, i) => {
        const radius = spacing * (i + 1);
        const opacity = 1 - i * (0.7 / rings);
        return (
          <motion.circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            stroke={strokeColor}
            strokeWidth={0.5}
            opacity={0}
            initial={animate ? { r: 0, opacity: 0 } : { r: radius, opacity: opacity * 0.5 }}
            animate={
              animate
                ? {
                    r: [0, radius, radius],
                    opacity: [0, opacity * 0.6, 0],
                  }
                : undefined
            }
            transition={
              animate
                ? {
                    duration: 3,
                    delay: i * 0.4,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                    ease: "easeOut",
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}

/** Smaller inline pulse used as a decorative element */
export function PulseIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className={className}>
      <circle cx={c} cy={c} r={1.5} fill="var(--ora-signal)" />
      <circle cx={c} cy={c} r={c * 0.4} stroke="var(--ora-signal)" strokeWidth={0.5} opacity={0.5} />
      <circle cx={c} cy={c} r={c * 0.7} stroke="var(--ora-signal)" strokeWidth={0.5} opacity={0.3} />
      <circle cx={c} cy={c} r={c * 0.95} stroke="var(--ora-signal)" strokeWidth={0.5} opacity={0.15} />
    </svg>
  );
}

/** Diffusion diagram: source -> targets with pulse lines */
export function DiffusionDiagram({ className = "" }: { className?: string }) {
  const targets = [
    { label: "Email", x: 88, y: 5 },
    { label: "LinkedIn", x: 95, y: 20 },
    { label: "SMS", x: 96, y: 38 },
    { label: "Ad Copy", x: 95, y: 55 },
    { label: "Landing", x: 93, y: 72 },
    { label: "Stories", x: 88, y: 88 },
  ];

  return (
    <div className={`relative w-full max-w-[560px] h-[280px] ${className}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {targets.map((t, i) => (
          <motion.line
            key={i}
            x1="8"
            y1="50"
            x2={t.x}
            y2={t.y}
            stroke="var(--ora-signal)"
            strokeWidth="0.15"
            strokeDasharray="1 1"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.4 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: i * 0.15 }}
          />
        ))}
      </svg>

      {/* Source */}
      <div className="absolute left-[4%] top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-ora-signal" />
        <span className="text-xs tracking-wide text-muted-foreground uppercase">Source</span>
      </div>

      {/* Targets */}
      {targets.map((t, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center gap-1.5"
          style={{ left: `${t.x - 4}%`, top: `${t.y}%`, transform: "translateY(-50%)" }}
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.1 }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-ora-signal/50" />
          <span className="text-xs tracking-wide text-foreground/70">{t.label}</span>
        </motion.div>
      ))}
    </div>
  );
}