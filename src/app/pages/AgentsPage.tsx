import { motion } from "motion/react";
import { Link } from "react-router";
import {
  ArrowRight,
  Shield,
  Brain,
  Paintbrush,
  PenTool,
  Camera,
  Video,
  Target,
  BarChart3,
  Layers,
  Zap,
  CheckCircle2,
  ChevronRight,
  Users,
  Search,
  Hash,
  Share2,
  Repeat,
} from "lucide-react";
import { PulseMotif } from "../components/PulseMotif";

/* ── Agent Data (from real codebase) ── */

interface AgentDef {
  name: string;
  displayName: string;
  role: string;
  layer: "intelligence" | "creation" | "compliance" | "orchestration" | "optimization";
  color: string;
  expertise: string[];
  description: string;
  signature: string; // one-line quote that captures the agent's philosophy
}

const agents: AgentDef[] = [
  {
    name: "brand-analyst",
    displayName: "Brand Analyst",
    role: "Builds and maintains the Brand Vault",
    layer: "intelligence",
    color: "#8B5CF6",
    expertise: ["Brand audit", "Competitive analysis", "Identity mapping", "Tone analysis", "Visual extraction"],
    description: "15 years at Wolff Olins, Pentagram, Landor. Deconstructs brands to DNA level. Extracts exact hex colors, exact font names, exact recurring phrases. Scores confidence 0-100 based on data depth.",
    signature: "If data is missing, I leave it empty. I never fabricate.",
  },
  {
    name: "strategic-planner",
    displayName: "Strategic Planner",
    role: "Content strategy aligned to business objectives",
    layer: "intelligence",
    color: "#EC4899",
    expertise: ["Strategic planning", "Trend analysis", "Editorial calendar", "Competitive intelligence"],
    description: "Ex BBDO strategy, Ogilvy consulting, McKinsey marketing practice. Designs content strategies using the Content Pyramid (10% thought leadership, 30% expertise, 60% presence) and Objective Matrix (awareness, authority, trust, conversion).",
    signature: "Every piece of content must trace back to a reason it exists.",
  },
  {
    name: "audience-analyst",
    displayName: "Audience Analyst",
    role: "Deep audience intelligence and engagement patterns",
    layer: "intelligence",
    color: "#06B6D4",
    expertise: ["Audience research", "Persona development", "Behavioral analysis"],
    description: "Ex Nielsen, Kantar. Goes beyond demographics into psychographics -- motivation, behavior, emotional triggers. Identifies content formats that drive engagement for each audience type and flags messaging-audience mismatches.",
    signature: "Focus on motivation, behavior, emotional triggers. Demographics are just the start.",
  },
  {
    name: "creative-director",
    displayName: "Creative Director",
    role: "Defines creative direction, supervises all creative output",
    layer: "creation",
    color: "#F97316",
    expertise: ["Creative direction", "Concept development", "Campaign architecture", "Brand storytelling"],
    description: "20 years at Wieden+Kennedy, Droga5, 72andSunny. Cannes Lions Grand Prix winner. Thinks in concepts, not executions. Always proposes 3 creative routes with tension analysis. Kills any idea a competitor could use.",
    signature: "The best ideas feel like they could only exist for one brand.",
  },
  {
    name: "copywriter",
    displayName: "Copywriter",
    role: "Writes all text content in the brand voice",
    layer: "creation",
    color: "#22C55E",
    expertise: ["Copywriting", "Brand voice", "Storytelling", "Headlines", "CTAs", "Hooks"],
    description: "15 years at Publicis, BETC, Wieden+Kennedy. Respects vault tone scores to the decimal -- formality, warmth, boldness, technicality, humor. Platform-native rules for LinkedIn, Instagram, Twitter, Email, Blog, Video.",
    signature: "If a competitor could use this exact text, I rewrite.",
  },
  {
    name: "art-director",
    displayName: "Art Director",
    role: "Visual direction and image generation within brand codes",
    layer: "creation",
    color: "#EAB308",
    expertise: ["Art direction", "Visual storytelling", "Imagen 3", "Moodboards"],
    description: "Ex Mother, Marcel, Sid Lee. Provides visual direction AND generates key visuals via Imagen 3. Never suggests colors outside the palette. Max 3 visuals per direction with typography treatment and layout direction.",
    signature: "If it looks stock-photo-generic, I reject it.",
  },
  {
    name: "photographer",
    displayName: "Photographer",
    role: "AI image generation within brand visual codes",
    layer: "creation",
    color: "#3B82F6",
    expertise: ["AI image generation", "Photo direction", "Platform adaptation", "Imagen 3"],
    description: "Expert in AI image generation prompt engineering. Weaves brand colors into lighting, includes vault mood keywords, excludes vault avoid keywords. Generates via Imagen 3 with automatic Supabase Storage upload.",
    signature: "Specific beats generic. Camera angle, lighting, subject, action, colors.",
  },
  {
    name: "video-maker",
    displayName: "Video Maker",
    role: "Video scripts + AI video/thumbnail generation",
    layer: "creation",
    color: "#EF4444",
    expertise: ["Video scripting", "Storyboarding", "Short-form", "Veo 2", "AI video"],
    description: "Ex Brut, Konbini, TikTok-first brands. Creates complete video briefs with hook/body/CTA timestamps, AI-ready prompts for Veo 2, and thumbnail generation. Each script includes short/medium/long versions.",
    signature: "80% watch without sound. Captions are not optional.",
  },
  {
    name: "seo-strategist",
    displayName: "SEO Strategist",
    role: "Search optimization preserving brand voice",
    layer: "optimization",
    color: "#22C55E",
    expertise: ["SEO", "Keyword strategy", "Content gaps", "Search intent"],
    description: "Ex Moz, Semrush. Optimizes for search WITHOUT killing brand voice. Outputs title tags, meta descriptions, H-structure, primary/secondary/semantic keywords, and content gaps vs competitors. Intent over volume.",
    signature: "Keywords natural. Brand voice sacred. Search intent over volume.",
  },
  {
    name: "social-optimizer",
    displayName: "Social Optimizer",
    role: "Platform-specific content adaptation",
    layer: "optimization",
    color: "#06B6D4",
    expertise: ["Social media", "Platform algorithms", "Content adaptation"],
    description: "Ex We Are Social, VaynerMedia. Same message, different expression. Adapts formality per platform (LinkedIn +1, Instagram -1, TikTok -2), respects character limits, hashtag counts, and platform-native conventions.",
    signature: "Same message, different expression. Never copy-paste across platforms.",
  },
  {
    name: "hashtag-specialist",
    displayName: "Hashtag & Timing",
    role: "Strategic hashtags and optimal publishing times",
    layer: "optimization",
    color: "#F97316",
    expertise: ["Hashtag strategy", "Trend detection", "Publishing timing"],
    description: "Generates 4-tier hashtag sets: brand-owned (1-2), niche-sector (5-10), trending-timely (2-3), and community-used (2-3). Per-platform counts (LinkedIn 3-5, Instagram 20-30, X 1-2). Optimal posting windows per platform.",
    signature: "Relevance over reach. Platform-specific counts, not blanket hashtags.",
  },
  {
    name: "campaign-multiplier",
    displayName: "Campaign Multiplier",
    role: "One content piece into full multi-channel campaign",
    layer: "optimization",
    color: "#EC4899",
    expertise: ["Content repurposing", "Multi-channel", "Format adaptation", "Shockwave"],
    description: "Creates a SHOCKWAVE from one piece: 1 newsletter, 5 LinkedIn posts (different angles), 3 Instagram formats (carousel/single/story), 3 tweets, 1 video script, 1 blog outline. Each piece stands alone. Each piece is brand-compliant.",
    signature: "From 1 input, produce everything. Each piece stands alone.",
  },
  {
    name: "compliance-guard",
    displayName: "Compliance Guard",
    role: "Validates ALL output -- nothing ships below 90/100",
    layer: "compliance",
    color: "#6D9B7E",
    expertise: ["Brand compliance", "Quality assurance", "Tone validation", "Auto-fix"],
    description: "The last checkpoint before content goes live. Scores on a 100-point rubric: Tone (30), Vocabulary (25), Structure (20), Brand (15), Platform (10). Auto-fixes below 90. Banned words = instant -5 penalty. Mathematically verifiable scores.",
    signature: "The same content scored twice must get the same score, plus or minus 2 points.",
  },
];

const layers = [
  {
    id: "intelligence",
    name: "Intelligence",
    subtitle: "Understand the brand DNA, map the audience, plan the strategy",
    color: "#8B5CF6",
    icon: Brain,
  },
  {
    id: "creation",
    name: "Creation",
    subtitle: "Write, design, shoot, film -- every asset vault-calibrated",
    color: "#F97316",
    icon: Paintbrush,
  },
  {
    id: "optimization",
    name: "Optimization",
    subtitle: "Adapt to platforms, optimize for search, multiply to every channel",
    color: "#06B6D4",
    icon: Repeat,
  },
  {
    id: "compliance",
    name: "Compliance",
    subtitle: "Score, validate, auto-fix -- nothing ships below 90/100",
    color: "#6D9B7E",
    icon: Shield,
  },
];

/* ── Orchestrator routing signals (simplified for display) ── */
const routingExamples = [
  { message: "Make this more casual and warm", agent: "Copywriter", confidence: 85 },
  { message: "Try a completely different creative direction", agent: "Creative Director", confidence: 90 },
  { message: "Generate a hero image for the campaign", agent: "Photographer", confidence: 95 },
  { message: "Create a 15s reel script for Instagram", agent: "Video Maker", confidence: 95 },
  { message: "Is this post on-brand?", agent: "Compliance Guard", confidence: 90 },
  { message: "Cascade this to every platform", agent: "Campaign Multiplier", confidence: 95 },
  { message: "What should we post this week?", agent: "Strategic Planner", confidence: 85 },
  { message: "Adapt this for LinkedIn", agent: "Social Optimizer", confidence: 85 },
  { message: "Optimize this blog post for SEO", agent: "SEO Strategist", confidence: 95 },
  { message: "Who is our target audience really?", agent: "Audience Analyst", confidence: 85 },
  { message: "Best hashtags and posting time?", agent: "Hashtag & Timing", confidence: 90 },
];

/* ── Compliance rubric ── */
const rubricItems = [
  { category: "Tone Alignment", points: 30, desc: "Formality, warmth, boldness, technicality, humor -- each measured against vault targets" },
  { category: "Vocabulary", points: 25, desc: "Zero banned words, power words present, no AI cliches, jargon used correctly" },
  { category: "Structure & Craft", points: 20, desc: "Sentence length, headline style, CTA style, hook quality" },
  { category: "Brand Alignment", points: 15, desc: "Values match, audience fit, positioning consistency" },
  { category: "Platform Fit", points: 10, desc: "Correct length, platform best practices, format rules" },
];

/* ── Component ── */

const agentIcons: Record<string, any> = {
  "brand-analyst": Brain,
  "strategic-planner": Target,
  "audience-analyst": Users,
  "creative-director": Layers,
  copywriter: PenTool,
  "art-director": Paintbrush,
  photographer: Camera,
  "video-maker": Video,
  "seo-strategist": Search,
  "social-optimizer": Share2,
  "hashtag-specialist": Hash,
  "campaign-multiplier": Repeat,
  "compliance-guard": Shield,
};

export function AgentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-16 pb-12 md:pt-24 md:pb-16 relative overflow-hidden">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 opacity-[0.04] pointer-events-none">
          <PulseMotif size={800} rings={8} animate={false} />
        </div>
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[680px]"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
              <span style={{ fontSize: "14px", fontWeight: 400 }}>
                13 specialized agents. One orchestrator.
              </span>
            </div>
            <h1
              className="mb-5"
              style={{
                fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                color: "#FFFFFF",
              }}
            >
              Brand Vault in.
              <br />
              <span className="text-muted-foreground">Compliant assets out.</span>
            </h1>
            <p
              className="text-muted-foreground mb-4"
              style={{ fontSize: "17px", lineHeight: 1.55 }}
            >
              Every asset passes through a pipeline of specialized AI agents -- each with a distinct expertise, a vault-calibrated system prompt, and a compliance score they must beat. Nothing ships below 90/100.
            </p>
            <p
              className="text-muted-foreground/60 mb-8"
              style={{ fontSize: "14px", lineHeight: 1.55 }}
            >
              The orchestrator routes your message to the right agent automatically. You just talk.
            </p>
            <div className="flex items-center gap-3">
              <Link
                to="/login?mode=signup"
                className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
                style={{
                  background: "var(--ora-signal)",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Try Studio
                <ArrowRight size={16} />
              </Link>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 border border-border-strong text-foreground px-6 py-3 rounded-full hover:bg-secondary transition-colors"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                See the pipeline
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pipeline visual ── */}
      <section id="pipeline" className="py-16 md:py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <h2
              className="text-foreground mb-3"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              The compliance pipeline
            </h2>
            <p
              className="text-muted-foreground max-w-[560px]"
              style={{ fontSize: "16px", lineHeight: 1.55 }}
            >
              Your Brand Vault feeds every agent. The Compliance Guard validates every output. Nothing reaches Campaign Lab without passing.
            </p>
          </motion.div>

          {/* Pipeline flow */}
          <div className="flex flex-col md:flex-row items-stretch gap-4 mb-16">
            {/* Vault */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-shrink-0 md:w-48 bg-card border border-ora-signal/30 rounded-xl p-5 flex flex-col items-center justify-center text-center"
              style={{ boxShadow: "0 1px 3px rgba(59,79,196,0.08)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "var(--ora-signal-light)" }}
              >
                <Shield size={18} style={{ color: "var(--ora-signal)" }} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Brand Vault</span>
              <span className="text-muted-foreground mt-1" style={{ fontSize: "11px" }}>
                DNA, tone, colors, vocabulary
              </span>
            </motion.div>

            {/* Arrow */}
            <div className="hidden md:flex items-center px-2">
              <ChevronRight size={20} className="text-muted-foreground/30" />
            </div>

            {/* Agents */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex-1 bg-card border border-border rounded-xl p-5"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground uppercase tracking-wider" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em" }}>
                  Orchestrator routes to
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {agents.map((a) => {
                  const Icon = agentIcons[a.name] || Brain;
                  return (
                    <div
                      key={a.name}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background"
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: a.color + "15" }}
                      >
                        <Icon size={12} style={{ color: a.color }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 500 }}>{a.displayName}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Arrow */}
            <div className="hidden md:flex items-center px-2">
              <ChevronRight size={20} className="text-muted-foreground/30" />
            </div>

            {/* Compliance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex-shrink-0 md:w-48 bg-card border border-green-500/20 rounded-xl p-5 flex flex-col items-center justify-center text-center"
              style={{ boxShadow: "0 1px 3px rgba(16,185,129,0.06)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(16,185,129,0.12)" }}>
                <CheckCircle2 size={18} style={{ color: "#6D9B7E" }} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>90+ / 100</span>
              <span className="text-muted-foreground mt-1" style={{ fontSize: "11px" }}>
                or auto-fixed then re-scored
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Agent Layers ── */}
      {layers.map((layer, li) => {
        const layerAgents = agents.filter((a) => a.layer === layer.id);
        if (layerAgents.length === 0) return null;
        const LayerIcon = layer.icon;
        return (
          <section
            key={layer.id}
            className={`py-16 md:py-24 ${li % 2 === 1 ? "bg-secondary/30" : ""}`}
          >
            <div className="max-w-[1200px] mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-10"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: layer.color + "12" }}
                  >
                    <LayerIcon size={15} style={{ color: layer.color }} />
                  </div>
                  <span
                    className="text-muted-foreground uppercase tracking-wider"
                    style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em" }}
                  >
                    {layer.id} layer
                  </span>
                </div>
                <h2
                  className="text-foreground mb-3"
                  style={{
                    fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.15,
                  }}
                >
                  {layer.name}
                </h2>
                <p
                  className="text-muted-foreground max-w-[560px]"
                  style={{ fontSize: "16px", lineHeight: 1.55 }}
                >
                  {layer.subtitle}
                </p>
              </motion.div>

              <div className={`grid gap-6 ${layerAgents.length === 1 ? "max-w-[600px]" : "md:grid-cols-2 lg:grid-cols-" + Math.min(layerAgents.length, 3)}`}>
                {layerAgents.map((agent, ai) => {
                  const Icon = agentIcons[agent.name] || Brain;
                  return (
                    <motion.div
                      key={agent.name}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: ai * 0.06 }}
                      className="bg-card border border-border rounded-xl p-6 hover:border-border-strong transition-colors group"
                      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                          style={{ background: agent.color + "12" }}
                        >
                          <Icon size={18} style={{ color: agent.color }} />
                        </div>
                        <div>
                          <h3
                            className="text-foreground"
                            style={{ fontSize: "16px", fontWeight: 500, letterSpacing: "-0.01em" }}
                          >
                            {agent.displayName}
                          </h3>
                          <span
                            className="text-muted-foreground"
                            style={{ fontSize: "12px" }}
                          >
                            {agent.role}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p
                        className="text-muted-foreground mb-4"
                        style={{ fontSize: "13px", lineHeight: 1.6 }}
                      >
                        {agent.description}
                      </p>

                      {/* Signature quote */}
                      <div className="border-l-2 pl-3 mb-4" style={{ borderColor: agent.color + "40" }}>
                        <p
                          className="text-foreground/70 italic"
                          style={{ fontSize: "12px", lineHeight: 1.5 }}
                        >
                          "{agent.signature}"
                        </p>
                      </div>

                      {/* Expertise tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {agent.expertise.map((exp) => (
                          <span
                            key={exp}
                            className="px-2 py-0.5 rounded-md"
                            style={{
                              fontSize: "10px",
                              fontWeight: 500,
                              color: "var(--muted-foreground)",
                              background: "var(--secondary)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {exp}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Orchestrator Routing ── */}
      <section className="py-16 md:py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--ora-signal-light)" }}
              >
                <Zap size={15} style={{ color: "var(--ora-signal)" }} />
              </div>
              <span
                className="text-muted-foreground uppercase tracking-wider"
                style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em" }}
              >
                Smart routing
              </span>
            </div>
            <h2
              className="text-foreground mb-3"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              The Orchestrator
            </h2>
            <p
              className="text-muted-foreground max-w-[560px]"
              style={{ fontSize: "16px", lineHeight: 1.55 }}
            >
              You don't pick agents. You just type. The orchestrator scores every message against weighted keyword signals and routes to the best specialist.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Routing examples */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-xl p-6"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <h3
                className="text-foreground mb-4"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                Example routing
              </h3>
              <div className="space-y-3">
                {routingExamples.map((ex, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-foreground/80 block truncate"
                        style={{ fontSize: "13px" }}
                      >
                        "{ex.message}"
                      </span>
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground/30 flex-shrink-0" />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-md bg-secondary border border-border"
                        style={{ fontSize: "11px", fontWeight: 500 }}
                      >
                        {ex.agent}
                      </span>
                      <span
                        className="text-ora-signal"
                        style={{ fontSize: "10px", fontWeight: 600 }}
                      >
                        {ex.confidence}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Generate + Validate pipeline */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-6"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <h3
                className="text-foreground mb-4"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                Generate + Validate loop
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-ora-signal-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-ora-signal" style={{ fontSize: "10px", fontWeight: 700 }}>1</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>Agent generates content</span>
                    <p className="text-muted-foreground" style={{ fontSize: "12px", lineHeight: 1.4 }}>
                      Copywriter, Art Director, or Video Maker produces the asset using vault-calibrated prompts.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-ora-signal-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-ora-signal" style={{ fontSize: "10px", fontWeight: 700 }}>2</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>Compliance Guard scores it</span>
                    <p className="text-muted-foreground" style={{ fontSize: "12px", lineHeight: 1.4 }}>
                      100-point rubric across 5 dimensions. Banned words = instant deduction. Every issue cites exact text.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(16,185,129,0.12)" }}>
                    <CheckCircle2 size={12} style={{ color: "#6D9B7E" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>Score 90+ ? Ship it.</span>
                    <p className="text-muted-foreground" style={{ fontSize: "12px", lineHeight: 1.4 }}>
                      Below 80? Auto-fix round applied, re-scored. The client never sees non-compliant content.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Compliance Rubric ── */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <h2
              className="text-foreground mb-3"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              The 100-point rubric
            </h2>
            <p
              className="text-muted-foreground max-w-[560px]"
              style={{ fontSize: "16px", lineHeight: 1.55 }}
            >
              Every piece of content is scored against this rubric. The math must add up. The score must be reproducible.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {rubricItems.map((item, i) => (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-foreground"
                    style={{ fontSize: "13px", fontWeight: 500 }}
                  >
                    {item.category}
                  </span>
                  <span
                    className="text-ora-signal"
                    style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em" }}
                  >
                    {item.points}
                  </span>
                </div>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: "12px", lineHeight: 1.5 }}
                >
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Grade scale */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            {[
              { grade: "A+", range: "95-100", color: "#6D9B7E" },
              { grade: "A", range: "90-94", color: "#22C55E" },
              { grade: "B", range: "80-89", color: "#EAB308" },
              { grade: "C", range: "70-79", color: "#F97316" },
              { grade: "D", range: "60-69", color: "#C45050" },
              { grade: "F", range: "<60", color: "#DC2626" },
            ].map((g) => (
              <div
                key={g.grade}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border"
              >
                <span style={{ fontSize: "14px", fontWeight: 600, color: g.color }}>{g.grade}</span>
                <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{g.range}</span>
              </div>
            ))}
            <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
              Nothing ships below A.
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── Learned Preferences ── */}
      <section className="py-16 md:py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-[640px] mx-auto text-center"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--ora-signal-light)" }}
            >
              <BarChart3 size={20} style={{ color: "var(--ora-signal)" }} />
            </div>
            <h2
              className="text-foreground mb-4"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              Agents that learn
            </h2>
            <p
              className="text-muted-foreground mb-3"
              style={{ fontSize: "16px", lineHeight: 1.55 }}
            >
              Every edit you make teaches the system. Rejection patterns, vocabulary additions, tone drift -- agents pre-apply your preferences so you stop repeating yourself.
            </p>
            <p className="text-muted-foreground/60" style={{ fontSize: "14px", lineHeight: 1.55 }}>
              The Copywriter remembers you always shorten intros. The Art Director stops suggesting stock-photo lighting. The Compliance Guard tightens rules around terms you flagged. Your agents get sharper with every interaction.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 md:py-28 text-center border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="text-foreground mb-4"
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
              }}
            >
              Your brand deserves more than a chatbot.
            </h2>
            <p
              className="text-muted-foreground mb-8"
              style={{ fontSize: "16px" }}
            >
              13 agents. 100-point compliance. Zero off-brand surprises.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/login?mode=signup"
                className="inline-flex items-center gap-2 text-white px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity"
                style={{
                  background: "var(--ora-signal)",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Start for free
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 border border-border-strong text-foreground px-7 py-3.5 rounded-full hover:bg-secondary transition-colors"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                View pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}