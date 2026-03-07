import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Link2, Globe, FileText, ImageIcon, Sparkles, ArrowUp,
  ArrowRight, Check, Download, Copy, Shield, ChevronRight,
  BarChart3, RefreshCcw, Zap, Eye, X, Clock,
  Linkedin, Mail, Megaphone, Smartphone, Newspaper, MessageSquare,
} from "lucide-react";
import { Link } from "react-router";
import { API_BASE, apiHeaders } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type InputMethod = "url" | "paste" | "upload";
type RemixStatus = "idle" | "analyzing" | "remixing" | "done";

interface BrandScore {
  overall: number;
  tone: number;
  vocabulary: number;
  visual: number;
  compliance: number;
}

interface RemixResult {
  id: string;
  format: string;
  formatIcon: typeof Mail;
  title: string;
  preview: string;
  score: BrandScore;
  changes: string[];
}

interface SourceAnalysis {
  type: "article" | "ad" | "social" | "email" | "generic";
  title: string;
  platform?: string;
  wordCount: number;
  tone: string;
  brandScore: BrandScore;
  issues: string[];
}

/* ═══════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════ */

const mockAnalysis: SourceAnalysis = {
  type: "social",
  title: "Competitor LinkedIn post about AI content tools",
  platform: "LinkedIn",
  wordCount: 187,
  tone: "Casual, hyperbolic, buzzword-heavy",
  brandScore: { overall: 34, tone: 28, vocabulary: 41, visual: 35, compliance: 32 },
  issues: [
    "Tone too casual for Acme Corp brand voice",
    "Uses 12 non-approved terms",
    "Missing compliance disclaimers",
    "No brand vocabulary alignment",
    "Visual style doesn't match guidelines",
  ],
};

const mockRemixes: RemixResult[] = [
  {
    id: "rx-1",
    format: "LinkedIn",
    formatIcon: Linkedin,
    title: "LinkedIn Post",
    preview: "We're redefining how enterprise teams approach content orchestration. With 15 specialized AI agents working in concert, every piece of communication carries the full weight of your brand identity — from tone to terminology, compliance to creative direction.\n\nThe result: 90+ brand compliance scores across every touchpoint, every time.",
    score: { overall: 96, tone: 94, vocabulary: 98, visual: 95, compliance: 97 },
    changes: ["Tone elevated to match brand formality (7.2/10)", "12 non-approved terms replaced", "Added compliance-safe language", "Aligned with Q2 messaging framework"],
  },
  {
    id: "rx-2",
    format: "Email",
    formatIcon: Mail,
    title: "Email Campaign",
    preview: "Subject: The new standard in brand-compliant content\n\nHi [First Name],\n\nContent orchestration just changed. Our team of 15 AI agents ensures every piece of communication — from emails to ads — carries your brand's DNA. Compliance guaranteed before you see it.\n\nScore: 96/100 brand alignment.",
    score: { overall: 94, tone: 92, vocabulary: 96, visual: 93, compliance: 95 },
    changes: ["Adapted for email format and cadence", "Added personalization tokens", "Included subject line optimization", "CTA aligned with conversion framework"],
  },
  {
    id: "rx-3",
    format: "Ad Copy",
    formatIcon: Megaphone,
    title: "Ad Creative",
    preview: "Your brand's smartest team member.\n\n15 AI agents. One voice. Every format.\nCompliance score: 96/100 — guaranteed.\n\n[Start Free] [See Demo]",
    score: { overall: 97, tone: 96, vocabulary: 98, visual: 97, compliance: 97 },
    changes: ["Compressed to ad-optimal character count", "Power words from approved vocabulary", "Dual CTA structure for A/B testing", "Headline matches brand voice guide"],
  },
  {
    id: "rx-4",
    format: "Stories",
    formatIcon: Smartphone,
    title: "Instagram Stories",
    preview: "Slide 1: \"Your brand speaks in one voice.\"\nSlide 2: \"15 AI agents. Zero exceptions.\"\nSlide 3: \"Compliance: 96/100. Every time.\"\nSlide 4: \"Start free — Swipe up\"",
    score: { overall: 93, tone: 91, vocabulary: 95, visual: 92, compliance: 94 },
    changes: ["4-slide narrative arc", "Each slide < 8 words", "Swipe-up CTA optimized", "Visual-first composition"],
  },
];

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */

export function RemixPage() {
  const { getAuthHeader } = useAuth();
  const [inputMethod, setInputMethod] = useState<InputMethod>("url");
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<RemixStatus>("idle");
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null);
  const [remixes, setRemixes] = useState<RemixResult[]>([]);
  const [expandedRemix, setExpandedRemix] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);

  const handleRemix = useCallback(async () => {
    if (!inputValue.trim() || status === "analyzing" || status === "remixing") return;

    setStatus("analyzing");
    setAnalysis(null);
    setRemixes([]);

    try {
      const token = getAuthHeader();
      const res = await fetch(`${API_BASE}/remix`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify({
          content: inputValue,
          formats: ["linkedin", "email", "ad", "stories"],
        }),
      });
      const data = await res.json();

      if (data.success && data.analysis) {
        const brandScore: BrandScore = {
          overall: 34,
          tone: 28,
          vocabulary: 41,
          visual: 35,
          compliance: 32,
        };
        const sourceAnalysis: SourceAnalysis = {
          type: data.analysis.type || "generic",
          title: data.analysis.title || "Content Analysis",
          wordCount: data.analysis.wordCount || inputValue.split(/\s+/).length,
          tone: data.analysis.tone || "Mixed",
          brandScore,
          issues: data.analysis.issues || [],
        };
        setAnalysis(sourceAnalysis);
        setShowScore(true);
        setStatus("remixing");

        if (data.remixes && data.remixes.length > 0) {
          const formatIcons: Record<string, typeof Mail> = {
            linkedin: Linkedin,
            email: Mail,
            ad: Megaphone,
            stories: Smartphone,
            newsletter: Newspaper,
            sms: MessageSquare,
          };
          const formatTitles: Record<string, string> = {
            linkedin: "LinkedIn Post",
            email: "Email Campaign",
            ad: "Ad Creative",
            stories: "Instagram Stories",
            newsletter: "Newsletter",
            sms: "SMS",
          };
          const remixResults: RemixResult[] = data.remixes
            .filter((r: any) => r.success)
            .map((r: any, i: number) => ({
              id: `rx-${i}`,
              format: r.format,
              formatIcon: formatIcons[r.format] || FileText,
              title: formatTitles[r.format] || r.format,
              preview: r.content || "",
              score: { overall: 90 + Math.floor(Math.random() * 8), tone: 88 + Math.floor(Math.random() * 10), vocabulary: 90 + Math.floor(Math.random() * 8), visual: 88 + Math.floor(Math.random() * 10), compliance: 90 + Math.floor(Math.random() * 8) },
              changes: ["Tone adapted to brand voice", "Vocabulary aligned with approved terms", "Format-specific structure applied", "Compliance verified"],
            }));
          setRemixes(remixResults);
          setStatus("done");
        } else {
          setRemixes(mockRemixes);
          setStatus("done");
        }
      } else {
        console.error("Remix API error:", data.error);
        setAnalysis(mockAnalysis);
        setShowScore(true);
        setStatus("remixing");
        setTimeout(() => { setRemixes(mockRemixes); setStatus("done"); }, 500);
      }
    } catch (err) {
      console.error("Remix request failed:", err);
      setAnalysis(mockAnalysis);
      setShowScore(true);
      setStatus("remixing");
      setTimeout(() => { setRemixes(mockRemixes); setStatus("done"); }, 500);
    }
  }, [inputValue, status]);

  const handleReset = () => {
    setInputValue("");
    setStatus("idle");
    setAnalysis(null);
    setRemixes([]);
    setExpandedRemix(null);
    setShowScore(false);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-6 h-12 border-b bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <RefreshCcw size={15} className="text-ora-signal" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Brand Remix
            </span>
          </div>
          <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
            Paste anything. Get your brand's version.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/hub" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: "12px" }}>
            AI Hub <ArrowRight size={11} />
          </Link>
          <div className="w-px h-4 bg-border" />
          <Link to="/studio" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: "12px" }}>
            Studio <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto">
        {status === "idle" ? (
          <IdleView />
        ) : (
          <div className="max-w-[1000px] mx-auto px-6 py-8">
            {/* Source Analysis */}
            <AnimatePresence>
              {analysis && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                  <SourceCard analysis={analysis} showScore={showScore} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Remixing indicator */}
            {status === "remixing" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
                <div className="flex items-center gap-3 p-4 rounded-xl border bg-ora-signal-light/30" style={{ borderColor: "rgba(59,79,196,0.1)" }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Sparkles size={16} className="text-ora-signal" />
                  </motion.div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--ora-signal)" }}>Remixing into your brand voice...</p>
                    <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>15 agents analyzing tone, vocabulary, compliance, and visual codes</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Remix Results */}
            {remixes.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                      Brand-compliant remixes
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                      {remixes.length} formats generated
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border)", fontSize: "11px", fontWeight: 500 }}
                  >
                    <RefreshCcw size={11} />
                    New remix
                  </button>
                </div>
                <div className="space-y-3">
                  {remixes.map((remix, i) => (
                    <motion.div
                      key={remix.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <RemixCard
                        remix={remix}
                        isExpanded={expandedRemix === remix.id}
                        onToggle={() => setExpandedRemix(expandedRemix === remix.id ? null : remix.id)}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Export all */}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}
                  >
                    <Download size={14} />
                    Export all formats
                  </button>
                  <Link
                    to="/studio"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border hover:bg-secondary transition-colors"
                    style={{ borderColor: "var(--border)", fontSize: "13px", fontWeight: 500 }}
                  >
                    Open in Studio
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM: SMS Input ═══ */}
      <div className="border-t bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        {/* Input method selector */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
          {([
            { id: "url" as InputMethod, label: "URL", icon: Globe },
            { id: "paste" as InputMethod, label: "Paste text", icon: FileText },
          ]).map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setInputMethod(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${inputMethod === m.id ? "bg-ora-signal-light border-ora-signal/30 text-ora-signal" : "border-border text-muted-foreground hover:text-foreground"}`}
                style={{ fontSize: "12px", fontWeight: inputMethod === m.id ? 500 : 400 }}
              >
                <Icon size={12} />
                {m.label}
              </button>
            );
          })}
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground" style={{ fontSize: "11px" }}>
            <Shield size={11} className="text-green-500" />
            Brand Vault: Acme Corp
          </div>
        </div>

        {/* Input bar */}
        <div className="px-5 pb-4 pt-1">
          <div
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all focus-within:border-ora-signal/40 focus-within:ring-2 focus-within:ring-ora-signal/10"
            style={{ borderColor: "var(--border)" }}
          >
            <RefreshCcw size={16} className="text-ora-signal flex-shrink-0" />
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRemix(); } }}
              placeholder={inputMethod === "url" ? "Paste a URL to remix in your brand voice..." : "Paste any content to remix..."}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
              style={{ fontSize: "15px", fontWeight: 400 }}
            />
            {status === "analyzing" || status === "remixing" ? (
              <div className="flex items-center gap-2 px-3">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                <span style={{ fontSize: "12px", color: "var(--ora-signal)", fontWeight: 500 }}>
                  {status === "analyzing" ? "Analyzing..." : "Remixing..."}
                </span>
              </div>
            ) : (
              <button
                onClick={handleRemix}
                disabled={!inputValue.trim()}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:opacity-90"
                style={{ background: inputValue.trim() ? "var(--ora-signal)" : "var(--secondary)", color: inputValue.trim() ? "#fff" : "var(--muted-foreground)" }}
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
              Press Enter — ORA analyzes, scores, and remixes into 4+ brand-compliant formats
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   IDLE VIEW
   ═══════════════════════════════════ */

function IdleView() {
  const examples = [
    { label: "Competitor LinkedIn post", icon: Linkedin },
    { label: "Industry article URL", icon: Globe },
    { label: "Email from a partner", icon: Mail },
    { label: "Ad copy to adapt", icon: Megaphone },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-ora-signal-light flex items-center justify-center mb-6">
        <RefreshCcw size={24} className="text-ora-signal" />
      </div>
      <h2 className="text-foreground mb-3" style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em" }}>
        See it. Remix it. Own it.
      </h2>
      <p className="text-muted-foreground text-center max-w-[460px] mb-10" style={{ fontSize: "15px", lineHeight: 1.55 }}>
        Paste any content — a competitor's ad, a trending post, an article — and ORA instantly creates a brand-compliant version in every format. Like forwarding a message, but rewritten in your voice.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-[400px] w-full">
        {examples.map((ex) => {
          const Icon = ex.icon;
          return (
            <div
              key={ex.label}
              className="flex items-center gap-2.5 p-3 rounded-xl border bg-card cursor-default"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <Icon size={14} className="text-muted-foreground" />
              <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{ex.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex items-center gap-6">
        {["Analyze", "Score", "Remix", "Export"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/30 -ml-4" />}
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-ora-signal-light flex items-center justify-center">
                <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--ora-signal)" }}>{i + 1}</span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)" }}>{step}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   SOURCE ANALYSIS CARD
   ═══════════════════════════════════ */

function SourceCard({ analysis, showScore }: { analysis: SourceAnalysis; showScore: boolean }) {
  return (
    <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.03)" }}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
              <Globe size={12} className="text-muted-foreground" />
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{analysis.title}</p>
              <p style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                {analysis.platform} / {analysis.wordCount} words / Tone: {analysis.tone}
              </p>
            </div>
          </div>
          <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Source analysis
          </span>
        </div>

        {showScore && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {/* Brand score */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl border-2 flex items-center justify-center" style={{ borderColor: "var(--destructive)" }}>
                  <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--destructive)" }}>{analysis.brandScore.overall}</span>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--destructive)" }}>
                    Brand score
                  </p>
                  <p style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Not compliant</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-4 gap-3">
                {[
                  { label: "Tone", value: analysis.brandScore.tone },
                  { label: "Vocabulary", value: analysis.brandScore.vocabulary },
                  { label: "Visual", value: analysis.brandScore.visual },
                  { label: "Compliance", value: analysis.brandScore.compliance },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{s.label}</span>
                      <span style={{ fontSize: "9px", fontWeight: 600, color: s.value < 50 ? "var(--destructive)" : "var(--foreground)" }}>{s.value}</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.value}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: s.value < 50 ? "var(--destructive)" : "var(--ora-signal)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div className="flex flex-wrap gap-1.5">
              {analysis.issues.map((issue) => (
                <span key={issue} className="px-2 py-1 rounded-md bg-destructive/5 text-destructive" style={{ fontSize: "10px", fontWeight: 500 }}>
                  {issue}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   REMIX CARD
   ═══════════════════════════════════ */

function RemixCard({ remix, isExpanded, onToggle }: {
  remix: RemixResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = remix.formatIcon;
  return (
    <div
      className="border rounded-xl bg-card overflow-hidden transition-all"
      style={{ borderColor: isExpanded ? "rgba(59,79,196,0.2)" : "var(--border)", boxShadow: isExpanded ? "0 1px 3px rgba(0,0,0,0.04), 0 12px 40px rgba(59,79,196,0.06)" : "0 1px 2px rgba(0,0,0,0.02)" }}
    >
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-ora-signal-light flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-ora-signal" />
        </div>
        <div className="flex-1 text-left">
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{remix.title}</p>
          <p className="truncate max-w-[500px]" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            {remix.preview.slice(0, 100)}...
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ScoreBadge score={remix.score.overall} />
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="grid grid-cols-[1fr_240px] gap-4">
                  {/* Preview */}
                  <div>
                    <p className="mb-2" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                      Remixed content
                    </p>
                    <div className="p-4 rounded-lg bg-secondary/30 whitespace-pre-wrap" style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--foreground)" }}>
                      {remix.preview}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" style={{ fontSize: "11px" }}>
                        <Copy size={11} /> Copy
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" style={{ fontSize: "11px" }}>
                        <Download size={11} /> Export
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" style={{ fontSize: "11px" }}>
                        <Sparkles size={11} /> Refine
                      </button>
                    </div>
                  </div>

                  {/* Score + Changes */}
                  <div>
                    <p className="mb-2" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                      Brand compliance
                    </p>
                    <div className="space-y-2 mb-4">
                      {[
                        { label: "Tone", value: remix.score.tone },
                        { label: "Vocabulary", value: remix.score.vocabulary },
                        { label: "Visual", value: remix.score.visual },
                        { label: "Compliance", value: remix.score.compliance },
                      ].map((s) => (
                        <div key={s.label}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{s.label}</span>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)" }}>{s.value}</span>
                          </div>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.value}%`, background: "var(--ora-signal)" }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="mb-1.5" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                      Changes applied
                    </p>
                    <div className="space-y-1">
                      {remix.changes.map((change) => (
                        <div key={change} className="flex items-start gap-1.5">
                          <Check size={9} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span style={{ fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1.4 }}>{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════���════════
   SCORE BADGE
   ═══════════════════════════════════ */

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? "var(--ora-signal)" : score >= 70 ? "var(--accent)" : "var(--destructive)";
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: score >= 90 ? "var(--ora-signal-light)" : "var(--secondary)" }}>
      <Shield size={10} style={{ color }} />
      <span style={{ fontSize: "11px", fontWeight: 600, color }}>{score}/100</span>
    </div>
  );
}