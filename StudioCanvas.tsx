import { motion } from "motion/react";

export type FormatType = "linkedin" | "email" | "sms" | "ad" | "landing" | "stories" | "newsletter";

export interface CanvasElement {
  id: string;
  type: "text" | "image" | "shape" | "button";
  label: string;
  content?: string;
  color?: string;
}

interface StudioCanvasProps {
  format: FormatType;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
  content?: Record<string, string>;
}

const formatDimensions: Record<FormatType, { w: number; h: number }> = {
  linkedin: { w: 520, h: 640 },
  email: { w: 600, h: 780 },
  sms: { w: 375, h: 667 },
  ad: { w: 728, h: 400 },
  landing: { w: 800, h: 600 },
  stories: { w: 360, h: 640 },
  newsletter: { w: 600, h: 820 },
};

function SelectionOverlay({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return (
    <>
      <div className="absolute inset-0 border-2 rounded pointer-events-none" style={{ borderColor: "var(--ora-signal)" }} />
      <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded" style={{ background: "var(--ora-signal)", fontSize: "9px", fontWeight: 600, color: "#fff" }}>
        {label}
      </div>
      {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((pos) => (
        <div key={pos} className={`absolute ${pos} w-2 h-2 rounded-sm pointer-events-none`} style={{ background: "var(--ora-signal)", border: "1px solid #fff" }} />
      ))}
      {["-top-1 left-1/2 -translate-x-1/2", "-bottom-1 left-1/2 -translate-x-1/2", "top-1/2 -left-1 -translate-y-1/2", "top-1/2 -right-1 -translate-y-1/2"].map((pos) => (
        <div key={pos} className={`absolute ${pos} w-1.5 h-1.5 rounded-sm pointer-events-none`} style={{ background: "var(--ora-signal)", border: "1px solid #fff" }} />
      ))}
    </>
  );
}

function CanvasBlock({ id, selected, onSelect, label, children, className = "" }: {
  id: string; selected: boolean; onSelect: (id: string) => void; label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative cursor-pointer group ${className}`} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
      <div className={`transition-all ${selected ? "" : "group-hover:ring-1 group-hover:ring-ora-signal/30"}`}>
        {children}
      </div>
      <SelectionOverlay active={selected} label={label} />
    </div>
  );
}

/* ---- FORMAT PREVIEWS ---- */

function LinkedInPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <CanvasBlock id="ln-header" selected={selectedId === "ln-header"} onSelect={onSelect} label="Profile Header">
        <div className="flex items-center gap-3 p-4 pb-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center" style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>A</div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Acme Corp</p>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>12,847 followers · Promoted</p>
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="ln-body" selected={selectedId === "ln-body"} onSelect={onSelect} label="Post Body">
        <div className="px-4 pb-3">
          <p style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.4, color: "var(--foreground)" }}>
            {content.headline || "Most analytics tools give you data. We give you decisions."}
          </p>
          <p className="mt-2" style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--foreground)", opacity: 0.8 }}>
            {content.body || "We just shipped AI Analytics — and it doesn't just surface numbers. It tells you what to do next. Real-time. Automated. Predictive."}
          </p>
          <p className="mt-2" style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
            {content.cta || "Start free → link in bio"}
          </p>
        </div>
      </CanvasBlock>
      <CanvasBlock id="ln-image" selected={selectedId === "ln-image"} onSelect={onSelect} label="Post Image">
        <div className="w-full" style={{ height: 280, background: "linear-gradient(135deg, #e8eaf6 0%, #c5cae9 50%, #e8eaf6 100%)" }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "var(--ora-signal)", opacity: 0.15 }}>
                <div className="w-6 h-6 rounded-full" style={{ background: "var(--ora-signal)", opacity: 0.6 }} />
              </div>
              <p style={{ fontSize: "18px", fontWeight: 500, color: "var(--primary)", letterSpacing: "-0.02em" }}>AI Analytics</p>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: 4 }}>Data → Decisions</p>
            </div>
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="ln-engagement" selected={selectedId === "ln-engagement"} onSelect={onSelect} label="Engagement">
        <div className="px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              {["#3b82f6", "#ef4444", "#10b981"].map((c) => (
                <div key={c} className="w-4 h-4 rounded-full border border-white" style={{ background: c }} />
              ))}
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>2,847</span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>184 comments · 52 shares</span>
        </div>
      </CanvasBlock>
    </div>
  );
}

function EmailPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <CanvasBlock id="em-header" selected={selectedId === "em-header"} onSelect={onSelect} label="Header">
        <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full" style={{ background: "var(--ora-signal)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Acme Corp</span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Unsubscribe</span>
        </div>
      </CanvasBlock>
      <CanvasBlock id="em-hero" selected={selectedId === "em-hero"} onSelect={onSelect} label="Hero Image">
        <div style={{ height: 200, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #e3f2fd 100%)" }} className="flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2" style={{ background: "rgba(59,79,196,0.1)" }}>
              <div className="w-4 h-4 rounded" style={{ background: "var(--ora-signal)" }} />
            </div>
            <p style={{ fontSize: "10px", color: "var(--muted-foreground)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Hero Visual</p>
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="em-headline" selected={selectedId === "em-headline"} onSelect={onSelect} label="Headline">
        <div className="px-8 pt-6">
          <h2 style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.25 }}>
            {content.headline || "Your analytics just got smarter"}
          </h2>
        </div>
      </CanvasBlock>
      <CanvasBlock id="em-body" selected={selectedId === "em-body"} onSelect={onSelect} label="Body Text">
        <div className="px-8 py-4">
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
            {content.body || "We've shipped AI Analytics — real-time predictions, automated decisions, and insights you can act on immediately. No more dashboards. Just answers."}
          </p>
        </div>
      </CanvasBlock>
      <CanvasBlock id="em-cta" selected={selectedId === "em-cta"} onSelect={onSelect} label="CTA Button">
        <div className="px-8 pb-6">
          <div className="inline-block px-6 py-2.5 rounded-lg text-white" style={{ background: "var(--ora-signal)", fontSize: "14px", fontWeight: 500 }}>
            {content.cta || "Try AI Analytics Free →"}
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="em-footer" selected={selectedId === "em-footer"} onSelect={onSelect} label="Footer">
        <div className="px-8 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <p style={{ fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            Acme Corp · 123 Innovation Drive · San Francisco, CA 94105
          </p>
        </div>
      </CanvasBlock>
    </div>
  );
}

function SMSPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  return (
    <div className="bg-[#f2f2f7] rounded-[2rem] overflow-hidden border border-border-strong/30" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
      <div className="px-6 pt-3 pb-1 flex items-center justify-between">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2.5 rounded-sm border" style={{ borderColor: "var(--foreground)" }}>
            <div className="w-2.5 h-full rounded-sm" style={{ background: "var(--foreground)" }} />
          </div>
        </div>
      </div>
      <CanvasBlock id="sms-header" selected={selectedId === "sms-header"} onSelect={onSelect} label="Header">
        <div className="px-4 py-3 text-center border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="w-10 h-10 mx-auto rounded-full bg-ora-signal/15 flex items-center justify-center mb-1">
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--ora-signal)" }}>A</span>
          </div>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Acme Corp</p>
          <p style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Business Chat</p>
        </div>
      </CanvasBlock>
      <div className="p-4 space-y-3" style={{ minHeight: 380 }}>
        <CanvasBlock id="sms-msg1" selected={selectedId === "sms-msg1"} onSelect={onSelect} label="Message 1">
          <div className="flex justify-start">
            <div className="bg-[#e5e5ea] rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%]">
              <p style={{ fontSize: "14px", lineHeight: 1.4, color: "#000" }}>
                {content.message || "Your AI Analytics dashboard is ready. See your first predictions now →"}
              </p>
            </div>
          </div>
        </CanvasBlock>
        <CanvasBlock id="sms-msg2" selected={selectedId === "sms-msg2"} onSelect={onSelect} label="Message 2">
          <div className="flex justify-start">
            <div className="bg-[#e5e5ea] rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%]">
              <p style={{ fontSize: "14px", lineHeight: 1.4, color: "#000" }}>
                acme.co/analytics-free
              </p>
              <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <div style={{ height: 80, background: "linear-gradient(135deg, #e8eaf6, #c5cae9)" }} className="flex items-center justify-center">
                  <div className="w-6 h-6 rounded" style={{ background: "var(--ora-signal)", opacity: 0.3 }} />
                </div>
                <div className="bg-white px-3 py-2">
                  <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>Try AI Analytics Free</p>
                  <p style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>acme.co</p>
                </div>
              </div>
            </div>
          </div>
        </CanvasBlock>
        <div className="text-center">
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Delivered · 2:34 PM</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="bg-white rounded-full px-4 py-2 border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>Text Message</span>
        </div>
      </div>
    </div>
  );
}

function AdPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  const headlineParts = (content.headline || "Data → Decisions.\nIn seconds.").split("\n");
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <CanvasBlock id="ad-bg" selected={selectedId === "ad-bg"} onSelect={onSelect} label="Background">
        <div className="relative" style={{ height: 400, background: "linear-gradient(135deg, #1a1a2e 0%, #2d2d5e 50%, #1a1a2e 100%)" }}>
          <CanvasBlock id="ad-headline" selected={selectedId === "ad-headline"} onSelect={onSelect} label="Headline">
            <div className="absolute top-10 left-8 right-8">
              <p style={{ fontSize: "28px", fontWeight: 500, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                {headlineParts[0]}
                {headlineParts[1] && <><br /><span style={{ opacity: 0.6 }}>{headlineParts[1]}</span></>}
              </p>
            </div>
          </CanvasBlock>
          <CanvasBlock id="ad-visual" selected={selectedId === "ad-visual"} onSelect={onSelect} label="Visual Element">
            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 h-32">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                <circle cx="50" cy="50" r="2" fill="var(--ora-signal)" />
                {[15, 25, 35, 45].map((r) => (
                  <circle key={r} cx="50" cy="50" r={r} stroke="var(--ora-signal)" strokeWidth="0.5" opacity={0.3} />
                ))}
              </svg>
            </div>
          </CanvasBlock>
          <CanvasBlock id="ad-cta" selected={selectedId === "ad-cta"} onSelect={onSelect} label="CTA">
            <div className="absolute bottom-10 left-8">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-lg" style={{ background: "var(--ora-signal)" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#fff" }}>{content.cta || "Try Free"}</span>
              </div>
            </div>
          </CanvasBlock>
          <CanvasBlock id="ad-logo" selected={selectedId === "ad-logo"} onSelect={onSelect} label="Logo">
            <div className="absolute bottom-10 right-8 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Acme Corp</span>
            </div>
          </CanvasBlock>
        </div>
      </CanvasBlock>
    </div>
  );
}

function StoriesPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  return (
    <div className="rounded-[2rem] overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
      <CanvasBlock id="st-bg" selected={selectedId === "st-bg"} onSelect={onSelect} label="Background">
        <div className="relative" style={{ height: 640, background: "linear-gradient(180deg, #1a1a2e 0%, #2c2c5a 40%, #3b4fc4 100%)" }}>
          <div className="absolute top-3 left-3 right-3 flex gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full" style={{ background: i === 1 ? "#fff" : "rgba(255,255,255,0.3)" }} />
            ))}
          </div>
          <CanvasBlock id="st-visual" selected={selectedId === "st-visual"} onSelect={onSelect} label="Visual">
            <div className="absolute inset-0 flex items-center justify-center" style={{ top: "15%", bottom: "30%" }}>
              <div className="text-center">
                <svg viewBox="0 0 120 120" fill="none" className="w-28 h-28 mx-auto mb-4">
                  <circle cx="60" cy="60" r="3" fill="rgba(255,255,255,0.9)" />
                  {[15, 28, 42, 55].map((r) => (
                    <circle key={r} cx="60" cy="60" r={r} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  ))}
                </svg>
              </div>
            </div>
          </CanvasBlock>
          <CanvasBlock id="st-text" selected={selectedId === "st-text"} onSelect={onSelect} label="Text Overlay">
            <div className="absolute bottom-32 left-6 right-6 text-center">
              <p style={{ fontSize: "24px", fontWeight: 500, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "pre-line" }}>
                {content.text || "Your data,\ndecoded."}
              </p>
              <p className="mt-2" style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                AI Analytics by Acme Corp
              </p>
            </div>
          </CanvasBlock>
          <CanvasBlock id="st-cta" selected={selectedId === "st-cta"} onSelect={onSelect} label="CTA">
            <div className="absolute bottom-10 left-6 right-6 text-center">
              <div className="inline-block px-8 py-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#fff" }}>{content.cta || "Swipe Up"}</span>
              </div>
            </div>
          </CanvasBlock>
        </div>
      </CanvasBlock>
    </div>
  );
}

function LandingPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  const headlineParts = (content.headline || "Analytics that think\nfor you.").split("\n");
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <CanvasBlock id="lp-nav" selected={selectedId === "lp-nav"} onSelect={onSelect} label="Navigation">
        <div className="px-6 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: "var(--ora-signal)", opacity: 0.5 }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>Acme</span>
          </div>
          <div className="flex gap-4">
            {["Features", "Pricing", "Docs"].map((l) => (
              <span key={l} style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{l}</span>
            ))}
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="lp-hero" selected={selectedId === "lp-hero"} onSelect={onSelect} label="Hero Headline">
        <div className="px-8 pt-12 pb-4 text-center">
          <p style={{ fontSize: "28px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            {headlineParts[0]}
            {headlineParts[1] && <><br /><span style={{ color: "var(--muted-foreground)" }}>{headlineParts[1]}</span></>}
          </p>
        </div>
      </CanvasBlock>
      <CanvasBlock id="lp-sub" selected={selectedId === "lp-sub"} onSelect={onSelect} label="Subtitle">
        <div className="px-12 pb-6 text-center">
          <p style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--muted-foreground)" }}>
            {content.subtitle || "Real-time predictions. Automated decisions. Start free."}
          </p>
        </div>
      </CanvasBlock>
      <CanvasBlock id="lp-cta" selected={selectedId === "lp-cta"} onSelect={onSelect} label="CTA">
        <div className="text-center pb-8">
          <div className="inline-block px-6 py-2.5 rounded-lg text-white" style={{ background: "var(--primary)", fontSize: "13px", fontWeight: 500 }}>
            {content.cta || "Start Free Trial →"}
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="lp-visual" selected={selectedId === "lp-visual"} onSelect={onSelect} label="Hero Visual">
        <div className="mx-8 mb-8 rounded-lg" style={{ height: 220, background: "linear-gradient(135deg, #f0f0f3, #e8eaf6, #f0f0f3)" }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex gap-4">
              {[60, 90, 45, 75, 55].map((h, i) => (
                <div key={i} className="w-8 rounded-t" style={{ height: h, background: `rgba(59,79,196,${0.15 + i * 0.1})` }} />
              ))}
            </div>
          </div>
        </div>
      </CanvasBlock>
    </div>
  );
}

function NewsletterPreview({ selectedId, onSelect, content }: { selectedId: string | null; onSelect: (id: string) => void; content: Record<string, string> }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <CanvasBlock id="nl-header" selected={selectedId === "nl-header"} onSelect={onSelect} label="Newsletter Header">
        <div className="px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ background: "var(--ora-signal)" }} />
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>The Acme Signal</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>#47 · Feb 2026</span>
          </div>
        </div>
      </CanvasBlock>
      <CanvasBlock id="nl-s1" selected={selectedId === "nl-s1"} onSelect={onSelect} label="Section 1 — Feature">
        <div className="px-8 py-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="rounded-lg mb-4" style={{ height: 120, background: "linear-gradient(135deg, #e8eaf6, #c5cae9)" }} />
          <h3 style={{ fontSize: "18px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{content.headline || "AI Analytics is live"}</h3>
          <p className="mt-2" style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--muted-foreground)" }}>
            {content.body || "Predictions, not just dashboards. See what's coming next for your business."}
          </p>
          <p className="mt-3" style={{ fontSize: "13px", fontWeight: 500, color: "var(--ora-signal)" }}>{content.readMore || "Read more →"}</p>
        </div>
      </CanvasBlock>
      <CanvasBlock id="nl-s2" selected={selectedId === "nl-s2"} onSelect={onSelect} label="Section 2 — Quick Bites">
        <div className="px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Quick Bites</p>
          <ul className="mt-3 space-y-2">
            {["New Figma integration shipped", "SOC 2 certification renewed", "Q1 brand report template available"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-ora-signal flex-shrink-0" />
                <span style={{ fontSize: "13px", lineHeight: 1.45, color: "var(--foreground)" }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CanvasBlock>
      <CanvasBlock id="nl-s3" selected={selectedId === "nl-s3"} onSelect={onSelect} label="Section 3 — Customer Story">
        <div className="px-8 py-5">
          <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Customer Story</p>
          <p className="mt-3" style={{ fontSize: "14px", fontStyle: "italic", lineHeight: 1.5, color: "var(--foreground)" }}>
            "We reduced content production time by 80% in the first month."
          </p>
          <p className="mt-2" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>— Head of Marketing, Nortem</p>
        </div>
      </CanvasBlock>
    </div>
  );
}

export function StudioCanvas({ format, selectedId, onSelect, zoom, content = {} }: StudioCanvasProps) {
  const dim = formatDimensions[format];
  const scale = zoom / 100;

  const renderPreview = () => {
    switch (format) {
      case "linkedin": return <LinkedInPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "email": return <EmailPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "sms": return <SMSPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "ad": return <AdPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "landing": return <LandingPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "stories": return <StoriesPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
      case "newsletter": return <NewsletterPreview selectedId={selectedId} onSelect={onSelect} content={content} />;
    }
  };

  return (
    <div
      className="flex-1 overflow-auto flex items-center justify-center"
      style={{ background: "#e8e8ec" }}
      onClick={() => onSelect(null)}
    >
      <motion.div
        key={format}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        style={{ width: dim.w, transform: `scale(${scale})`, transformOrigin: "center center" }}
        className="my-8"
      >
        {renderPreview()}
      </motion.div>
    </div>
  );
}
