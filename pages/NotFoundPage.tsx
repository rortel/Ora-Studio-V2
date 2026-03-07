import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { PulseMotif } from "../components/PulseMotif";

export function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <PulseMotif size={600} rings={6} animate={false} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center relative z-10"
      >
        <p
          className="text-ora-signal mb-4"
          style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.05em' }}
        >
          404
        </p>
        <h1
          className="text-foreground mb-3"
          style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 500,
            letterSpacing: '-0.035em',
            lineHeight: 1.12,
          }}
        >
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8 max-w-[400px] mx-auto" style={{ fontSize: '16px', lineHeight: 1.55 }}>
          This page doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            style={{ fontSize: '15px', fontWeight: 500 }}
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 border border-border-strong text-foreground px-6 py-3 rounded-lg hover:bg-secondary transition-colors"
            style={{ fontSize: '15px', fontWeight: 500 }}
          >
            Open Studio
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
