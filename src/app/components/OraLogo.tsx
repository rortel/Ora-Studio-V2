import { motion } from "motion/react";

/**
 * ORA Logo — Geometric Aura
 *
 * The O is a perfect geometric circle with a single concentric echo ring
 * very close to it — the "aura". One ring only. Subtle. The diffusion
 * is implied, not illustrated.
 *
 * RA is set in Inter, weight 500, tracked. The O stroke is slightly
 * heavier than the RA text weight to anchor the eye.
 *
 * Animation: the echo ring expands from the O outward once on load.
 * Then it stays. No loop. The aura is born and settles.
 */

interface OraLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
  variant?: "full" | "mark";
  color?: string;
}

export function OraLogo({
  size = 32,
  animate = true,
  className = "",
  variant = "full",
  color,
}: OraLogoProps) {
  const fillColor = color || "currentColor";

  // ── O mark proportions ──
  // The SVG is square, sized to the logo height.
  // Main O: the letterform circle.
  // Echo: one concentric ring, close, thin, lower opacity.
  const s = size;
  const c = s / 2;

  // Main O circle
  const mainR = s * 0.28;
  const mainSW = s * 0.075;

  // Echo ring — close to the O, thinner, translucent
  const echoR = s * 0.44;
  const echoSW = s * 0.018;
  const echoOpacity = 0.28;

  const oMark = (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {/* Main O — the letterform */}
      <circle
        cx={c}
        cy={c}
        r={mainR}
        stroke={fillColor}
        strokeWidth={mainSW}
        fill="none"
      />

      {/* Echo ring — the aura */}
      {animate ? (
        <motion.circle
          cx={c}
          cy={c}
          stroke={fillColor}
          strokeWidth={echoSW}
          fill="none"
          initial={{ r: mainR, opacity: 0 }}
          animate={{ r: echoR, opacity: echoOpacity }}
          transition={{
            duration: 0.9,
            delay: 0.25,
            ease: [0.23, 1, 0.32, 1],
          }}
        />
      ) : (
        <circle
          cx={c}
          cy={c}
          r={echoR}
          stroke={fillColor}
          strokeWidth={echoSW}
          fill="none"
          opacity={echoOpacity}
        />
      )}
    </svg>
  );

  if (variant === "mark") {
    return <div className={className}>{oMark}</div>;
  }

  // ── Full logo: (O) R A ──
  // RA sized to visually match the O's cap-height feel.
  const fontSize = s * 0.6;

  return (
    <div
      className={`flex items-center ${className}`}
      style={{ gap: s * 0.02, color: fillColor }}
    >
      {oMark}
      <span
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 500,
          letterSpacing: "0.08em",
          lineHeight: 1,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        RA
      </span>
    </div>
  );
}

/**
 * Animated Aura — background decoration
 *
 * Concentric rings that pulse outward once, slowly, from center.
 * Uses the same visual language as the logo's echo ring.
 * Monochrome — takes color from context.
 */
export function AuraDecoration({
  size = 400,
  className = "",
  color,
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  const c = size / 2;
  const strokeColor = color || "currentColor";

  const rings = [0.15, 0.3, 0.45, 0.6, 0.78, 0.92];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Center dot */}
      <circle cx={c} cy={c} r={2} fill={strokeColor} opacity={0.3} />

      {/* Concentric rings — static, varying opacity */}
      {rings.map((f, i) => (
        <motion.circle
          key={i}
          cx={c}
          cy={c}
          r={c * f}
          stroke={strokeColor}
          strokeWidth={0.5}
          fill="none"
          initial={{ opacity: 0, r: c * f * 0.5 }}
          animate={{ opacity: 0.08 - i * 0.008, r: c * f }}
          transition={{
            duration: 2,
            delay: i * 0.3,
            ease: [0.23, 1, 0.32, 1],
          }}
        />
      ))}
    </svg>
  );
}
