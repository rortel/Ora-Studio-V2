import { motion } from "motion/react";
import { OraLogo } from "./OraLogo";

interface PulseMotifProps { size?: number; rings?: number; className?: string; animate?: boolean; strokeColor?: string; }

export function PulseMotif({ size = 320, rings = 5, className = "", animate = true }: PulseMotifProps) {
  const c = size / 2, mr = size / 2 - 4, sp = mr / (rings + 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} fill="none">
      <circle cx={c} cy={c} r={3} fill="#E8E4DF" />
      {Array.from({ length: rings }).map((_, i) => {
        const r = sp * (i + 1), op = 0.3 - i * (0.25 / rings);
        return <motion.circle key={i} cx={c} cy={c} r={r} stroke="#E8E4DF" strokeWidth={0.5} opacity={0}
          initial={animate ? { r: 0, opacity: 0 } : { r, opacity: op }}
          animate={animate ? { r: [0, r, r], opacity: [0, op, 0] } : undefined}
          transition={animate ? { duration: 3, delay: i * 0.4, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" } : undefined} />;
      })}
    </svg>
  );
}

export function PulseIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return <OraLogo size={size} variant="mark" animate={false} className={className} />;
}

export function DiffusionDiagram({ className = "" }: { className?: string }) {
  const targets = [
    { label: "LinkedIn", x: 88, y: 5 }, { label: "Instagram", x: 95, y: 20 }, { label: "TikTok", x: 96, y: 38 },
    { label: "Facebook", x: 95, y: 55 }, { label: "Stories", x: 93, y: 72 }, { label: "Reels", x: 88, y: 88 },
  ];
  return (
    <div className={`relative w-full max-w-[560px] h-[280px] ${className}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {targets.map((t, i) => (
          <motion.line key={i} x1="8" y1="50" x2={t.x} y2={t.y} stroke="rgba(255,255,255,0.10)" strokeWidth="0.15" strokeDasharray="1 1"
            initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.3 }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.15 }} />
        ))}
      </svg>
      <div className="absolute left-[4%] top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: "#E8E4DF" }} />
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.06em" }}>Source</span>
      </div>
      {targets.map((t, i) => (
        <motion.div key={i} className="absolute flex items-center gap-1.5" style={{ left: `${t.x - 4}%`, top: `${t.y}%`, transform: "translateY(-50%)" }}
          initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 + i * 0.1 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#E8E4DF" }}>{t.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
