import { motion } from "motion/react";
import { Link } from "react-router";
import {
  ArrowRight,
  Zap,
  GitCompare,
  Shield,
  Type,
  Image,
  Code,
  Music,
  Video,
  Check,
  Layers,
} from "lucide-react";
import { ArenaDemo } from "../components/ArenaDemo";

/* ── Supported AI Models ── */
const modelCategories = [
  {
    id: "text",
    name: "Text & Reasoning",
    icon: Type,
    description: "Generate, analyze, and refine text with the world's leading language models.",
    models: [
      { name: "GPT-5", provider: "OpenAI", color: "#10a37f", capabilities: ["Text", "Reasoning", "Multimodal"] },
      { name: "GPT-5.2", provider: "OpenAI", color: "#10a37f", capabilities: ["Text", "Vision", "Advanced"] },
      { name: "GPT-4o", provider: "OpenAI", color: "#10a37f", capabilities: ["Text", "Vision", "Fast"] },
      { name: "Claude Sonnet 4", provider: "Anthropic", color: "#d4a27f", capabilities: ["Text", "Analysis", "Code"] },
      { name: "Claude Opus 4", provider: "Anthropic", color: "#d4a27f", capabilities: ["Deep reasoning", "Research"] },
      { name: "Claude Haiku 4", provider: "Anthropic", color: "#d4a27f", capabilities: ["Fast", "Efficient", "Code"] },
      { name: "Gemini 3", provider: "Google", color: "#4285f4", capabilities: ["Text", "Multimodal", "Reasoning"] },
      { name: "Gemini 2.5 Flash", provider: "Google", color: "#4285f4", capabilities: ["Text", "Vision", "Fast"] },
    ],
  },
  {
    id: "image",
    name: "Image Generation",
    icon: Image,
    description: "Create visuals from text prompts. Compare styles across generators instantly.",
    models: [
      { name: "Nano Banana", provider: "Google", color: "#4285f4", capabilities: ["Text-to-image", "Image-to-image"] },
      { name: "Seedream V4.5", provider: "ByteDance", color: "#00d1b2", capabilities: ["Text-to-image", "Image-to-image"] },
      { name: "Seedream 5.0 Lite", provider: "ByteDance", color: "#00d1b2", capabilities: ["Text-to-image", "Fast"] },
      { name: "DALL-E 3", provider: "OpenAI", color: "#10a37f", capabilities: ["Text-to-image", "Editing"] },
      { name: "Flux Pro", provider: "Black Forest Labs", color: "#059669", capabilities: ["Text-to-image", "Photorealistic"] },
    ],
  },
  {
    id: "code",
    name: "Code Generation",
    icon: Code,
    description: "Write, debug, and refactor code across every major language and framework.",
    models: [
      { name: "GPT-4o", provider: "OpenAI", color: "#10a37f", capabilities: ["Full-stack", "Debugging"] },
      { name: "Claude Sonnet 4", provider: "Anthropic", color: "#d4a27f", capabilities: ["Full-stack", "Analysis"] },
      { name: "Gemini 2.5 Flash", provider: "Google", color: "#4285f4", capabilities: ["Code", "Fast"] },
    ],
  },
  {
    id: "audio-video",
    name: "Audio & Video",
    icon: Video,
    description: "Generate music, voiceovers, and video content from text descriptions.",
    models: [
      { name: "Veo 3.1", provider: "Google", color: "#4285f4", capabilities: ["Text-to-video", "HD", "Motion"] },
      { name: "Sora 2", provider: "OpenAI", color: "#10a37f", capabilities: ["Text-to-video", "Cinematic"] },
      { name: "Seedance 2.0", provider: "ByteDance", color: "#00d1b2", capabilities: ["Text-to-video", "Image-to-video"] },
      { name: "Seedance 1.5 Pro", provider: "ByteDance", color: "#00d1b2", capabilities: ["Text-to-video", "Audio"] },
      { name: "Suno v4", provider: "Suno", color: "#ef4444", capabilities: ["Text-to-music", "Vocals"] },
      { name: "ElevenLabs", provider: "ElevenLabs", color: "#1a1a2e", capabilities: ["Text-to-speech", "Voice clone"] },
    ],
  },
];

/* ── Key Capabilities ── */
const capabilities = [
  {
    icon: GitCompare,
    title: "Arena",
    subtitle: "Side-by-side comparison",
    description: "Send the same prompt to multiple models simultaneously. Compare outputs, pick the best, refine. No more switching between tabs and subscriptions.",
  },
  {
    icon: Shield,
    title: "Brand Vault",
    subtitle: "Studio plan",
    description: "Upload your brand guidelines once. Every AI output is automatically checked against your tone, vocabulary, colors, and personas before you see it.",
  },
  {
    icon: Layers,
    title: "Canvas",
    subtitle: "Studio plan",
    description: "Compose publish-ready visuals with a Canva-like editor. AI-generated content lands directly on your canvas. Export in any ratio.",
  },
  {
    icon: Zap,
    title: "Flows",
    subtitle: "Coming soon",
    description: "Chain multiple AI steps into automated workflows. Brief to multi-channel campaign in one click. Repeatable, brand-safe pipelines.",
  },
];

export function AgentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[640px]"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
              <span style={{ fontSize: '14px', fontWeight: 400 }}>One account. Every AI model.</span>
            </div>
            <h1
              className="mb-5"
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
                fontWeight: 500,
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
              }}
            >
              Every model.
              <br />
              <span className="text-muted-foreground">One interface.</span>
            </h1>
            <p
              className="text-muted-foreground mb-4"
              style={{ fontSize: '17px', lineHeight: 1.55 }}
            >
              GPT-5, Claude Opus 4, Gemini 3, Nano Banana, Seedream, Veo 3.1, Sora 2, Seedance — all accessible from a single account. Compare outputs side-by-side. Pick the best. Ship it.
            </p>
            <p
              className="text-muted-foreground/60 mb-8"
              style={{ fontSize: '14px', lineHeight: 1.55 }}
            >
              No more managing 4 subscriptions. Pay only for what you use.
            </p>
            <div className="flex items-center gap-3">
              <Link
                to="/login?mode=signup"
                className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)',
                  fontSize: '15px',
                  fontWeight: 500,
                  boxShadow: '0 2px 12px rgba(59,79,196,0.3)',
                }}
              >
                Try for free
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 border border-border-strong text-foreground px-6 py-3 rounded-lg hover:bg-secondary transition-colors"
                style={{ fontSize: '15px', fontWeight: 500 }}
              >
                View pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Model Categories */}
      {modelCategories.map((category, ci) => (
        <section
          key={category.id}
          id={category.id}
          className={`py-16 md:py-24 ${ci % 2 === 1 ? "bg-secondary/40" : ""}`}
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
                  style={{ background: 'var(--ora-signal-light)' }}
                >
                  <category.icon size={15} style={{ color: 'var(--ora-signal)' }} />
                </div>
                <span
                  className="text-muted-foreground uppercase tracking-wider"
                  style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em' }}
                >
                  {category.models.length} models
                </span>
              </div>
              <h2
                className="text-foreground mb-3"
                style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                }}
              >
                {category.name}
              </h2>
              <p
                className="text-muted-foreground max-w-[560px]"
                style={{ fontSize: '16px', lineHeight: 1.55 }}
              >
                {category.description}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {category.models.map((model, mi) => (
                <motion.div
                  key={model.name}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: mi * 0.06 }}
                  className="bg-card border border-border rounded-xl p-5 hover:border-border-strong transition-colors"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: model.color + '12' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: model.color }}
                      />
                    </div>
                    <div>
                      <h3
                        className="text-foreground"
                        style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '-0.01em' }}
                      >
                        {model.name}
                      </h3>
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: '11px' }}
                      >
                        {model.provider}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {model.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded-md"
                        style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          color: 'var(--muted-foreground)',
                          background: 'var(--secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Key Capabilities */}
      <ArenaDemo />

      <section className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <h2
              className="text-foreground mb-4"
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}
            >
              More than a model switcher
            </h2>
            <p
              className="text-muted-foreground max-w-[520px]"
              style={{ fontSize: '16px', lineHeight: 1.55 }}
            >
              ORA wraps every model in a layer of intelligence: comparison, brand control, and visual production.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card border border-border rounded-xl p-7"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--ora-signal-light)' }}
                    >
                      <Icon size={18} style={{ color: 'var(--ora-signal)' }} />
                    </div>
                    <div>
                      <h3
                        className="text-foreground"
                        style={{ fontSize: '17px', fontWeight: 500, letterSpacing: '-0.01em' }}
                      >
                        {cap.title}
                      </h3>
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: '12px' }}
                      >
                        {cap.subtitle}
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-muted-foreground"
                    style={{ fontSize: '14px', lineHeight: 1.6 }}
                  >
                    {cap.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
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
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
              }}
            >
              Ready to try every AI model?
            </h2>
            <p
              className="text-muted-foreground mb-8"
              style={{ fontSize: '16px' }}
            >
              50 free credits. No credit card required.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/login?mode=signup"
                className="inline-flex items-center gap-2 text-white px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)',
                  fontSize: '15px',
                  fontWeight: 500,
                  boxShadow: '0 2px 12px rgba(59,79,196,0.3)',
                }}
              >
                Start for free
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 border border-border-strong text-foreground px-7 py-3.5 rounded-lg hover:bg-secondary transition-colors"
                style={{ fontSize: '15px', fontWeight: 500 }}
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