import { useState } from "react";
import { motion } from "motion/react";
import {
  Search, Heart, Copy, Check, Star, Zap,
  FileText, Code2, Palette, Target, MessageSquare, BarChart3,
} from "lucide-react";
import { Link } from "react-router";

/* ═══════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════ */

type Category = "all" | "writing" | "code" | "design" | "strategy" | "social" | "email";

interface Recipe {
  id: number;
  title: string;
  description: string;
  category: Category;
  prompt: string;
  author: string;
  likes: number;
  copies: number;
  models: string[];
  tags: string[];
  featured: boolean;
}

const categories: { key: Category; label: string; icon: typeof FileText }[] = [
  { key: "all", label: "All", icon: BarChart3 },
  { key: "writing", label: "Writing", icon: FileText },
  { key: "code", label: "Code", icon: Code2 },
  { key: "design", label: "Design", icon: Palette },
  { key: "strategy", label: "Strategy", icon: Target },
  { key: "social", label: "Social", icon: MessageSquare },
  { key: "email", label: "Email", icon: MessageSquare },
];

const recipes: Recipe[] = [
  {
    id: 1,
    title: "LinkedIn Thought Leadership",
    description: "Generate a thought leadership post that positions you as an industry expert with a strong hook and CTA.",
    category: "social",
    prompt: "Write a LinkedIn thought leadership post about [TOPIC] in [INDUSTRY]. Include: a provocative opening hook (question or bold statement), 3 key insights with data points, a personal anecdote or observation, and a clear CTA. Tone: authoritative but approachable. Max 1300 characters. Format with line breaks for readability.",
    author: "ORA Team",
    likes: 234,
    copies: 1890,
    models: ["Claude", "GPT-4o"],
    tags: ["linkedin", "thought-leadership", "engagement"],
    featured: true,
  },
  {
    id: 2,
    title: "Email Subject Line A/B",
    description: "Create 10 high-converting email subject lines with psychological triggers and A/B test variants.",
    category: "email",
    prompt: "Generate 10 email subject line variants for a [TYPE] email about [TOPIC]. For each: include a psychological trigger (curiosity, urgency, social proof, benefit, or fear of missing out). Mark which trigger is used. Create 5 pairs for A/B testing. Keep under 50 characters. No clickbait. Target audience: [AUDIENCE].",
    author: "Email Lab",
    likes: 189,
    copies: 1234,
    models: ["GPT-4o"],
    tags: ["email", "subject-lines", "ab-testing"],
    featured: false,
  },
  {
    id: 3,
    title: "React Component Scaffold",
    description: "Generate a clean, typed React component with props interface, tests stub, and Storybook story.",
    category: "code",
    prompt: "Create a React TypeScript component called [NAME]. Props: [PROPS]. Include: typed props interface, default export, JSDoc comments, a Jest test skeleton, and a Storybook story. Use functional component with hooks. Follow the React/TypeScript best practices.",
    author: "Dev Community",
    likes: 456,
    copies: 2103,
    models: ["Claude", "GPT-4o"],
    tags: ["react", "typescript", "component"],
    featured: true,
  },
  {
    id: 4,
    title: "Brand Voice Audit",
    description: "Paste any piece of content and get a detailed brand voice analysis with scores and improvement suggestions.",
    category: "strategy",
    prompt: "Analyze this content for brand voice consistency: [CONTENT]. Score on a 1-10 scale: Formality, Confidence, Warmth, Clarity, Uniqueness. Flag any: off-brand terms, tone inconsistencies, jargon. Suggest 3 specific rewrites to improve alignment.",
    author: "ORA Team",
    likes: 189,
    copies: 654,
    models: ["Claude"],
    tags: ["brand", "audit", "voice"],
    featured: false,
  },
  {
    id: 5,
    title: "Landing Page Copy Framework",
    description: "Generate full landing page copy following the PAS (Problem-Agitate-Solve) framework with CTA variations.",
    category: "writing",
    prompt: "Write landing page copy for [PRODUCT]. Framework: Problem-Agitate-Solve. Include: headline (under 10 words), subheadline, 3 pain points, solution section, 3 benefits with micro-copy, social proof placeholder, 2 CTA button variations. Tone: [TONE]. Target: [AUDIENCE].",
    author: "Copy Lab",
    likes: 301,
    copies: 1432,
    models: ["GPT-4o", "Claude"],
    tags: ["landing-page", "copywriting", "PAS"],
    featured: true,
  },
  {
    id: 6,
    title: "Social Media Calendar",
    description: "Generate a week of social media posts across platforms with optimal posting times and hashtags.",
    category: "social",
    prompt: "Create a 7-day social media content calendar for [BRAND] in [INDUSTRY]. Platforms: LinkedIn, Twitter/X, Instagram. For each day: post text, suggested visual type, hashtags (max 5), optimal posting time. Theme the week around [TOPIC]. Tone: [TONE].",
    author: "Social Studio",
    likes: 267,
    copies: 987,
    models: ["GPT-4o"],
    tags: ["social-media", "calendar", "planning"],
    featured: false,
  },
  {
    id: 7,
    title: "Color Palette Generator",
    description: "Describe a mood or brand personality and get a complete color palette with usage guidelines.",
    category: "design",
    prompt: "Generate a color palette for a brand that feels [ADJECTIVES]. Include: primary color (hex), secondary, accent, background, text color. For each: hex code, when to use it, and percentage of usage in a typical layout. Provide a dark mode variant. Explain the psychology behind each choice.",
    author: "Design Guild",
    likes: 178,
    copies: 543,
    models: ["Claude", "Gemini"],
    tags: ["color", "palette", "branding"],
    featured: false,
  },
  {
    id: 8,
    title: "Competitive Analysis Brief",
    description: "Analyze a competitor's messaging and identify gaps, overlaps, and differentiation opportunities.",
    category: "strategy",
    prompt: "Analyze the messaging of [COMPETITOR URL/NAME] compared to [YOUR BRAND]. Evaluate: value proposition clarity, tone of voice, key claims, visual language description, target audience focus. Identify: 3 messaging gaps you can exploit, 2 areas of overlap to differentiate, 1 unique angle they're missing.",
    author: "Strategy Hub",
    likes: 134,
    copies: 421,
    models: ["Claude"],
    tags: ["competitive", "analysis", "strategy"],
    featured: false,
  },
  {
    id: 9,
    title: "Newsletter Intro Writer",
    description: "Generate engaging newsletter intros that hook readers in the first 2 sentences.",
    category: "writing",
    prompt: "Write 5 newsletter intro variations for a [INDUSTRY] newsletter. Topic: [TOPIC]. Each intro: max 3 sentences, different hook style (anecdote, surprising stat, provocative question, trend observation, personal reflection). The reader should feel compelled to keep reading. No generic openings.",
    author: "Newsletter Pro",
    likes: 156,
    copies: 678,
    models: ["GPT-4o", "Claude"],
    tags: ["newsletter", "intro", "engagement"],
    featured: false,
  },
];

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */

export function RecipesPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredRecipes = recipes.filter((r) => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (id: number, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="pt-16 pb-6 md:pt-24 md:pb-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <span
              className="inline-block px-3 py-1 rounded-full"
              style={{
                fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "var(--ora-signal)", background: "var(--ora-signal-light)", border: "1px solid rgba(59,79,196,0.1)",
              }}
            >
              Prompt Recipes
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.12 }}
          >
            Prompts that work. <span className="text-muted-foreground">Ready to use.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="text-muted-foreground max-w-[560px] mb-8"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Community-curated prompt templates for every use case. Copy, customize, and generate in ORA.
          </motion.p>

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-[400px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes..."
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal focus:outline-none transition-colors"
                style={{ fontSize: "14px" }} />
            </div>
          </motion.div>

          {/* Category pills */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
            className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer"
                  style={{
                    fontSize: "13px", fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--ora-signal)" : "var(--muted-foreground)",
                    background: isActive ? "var(--ora-signal-light)" : "var(--secondary)",
                    border: isActive ? "1px solid rgba(59,79,196,0.15)" : "1px solid transparent",
                  }}>
                  <Icon size={13} /> {cat.label}
                </button>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Recipes grid */}
      <section className="pb-20 md:pb-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecipes.map((recipe, i) => (
              <motion.div key={recipe.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`bg-card border rounded-xl p-5 flex flex-col ${recipe.featured ? "border-ora-signal/30" : "border-border"} hover:border-border-strong transition-colors`}
                style={{ boxShadow: recipe.featured ? "0 1px 3px rgba(59,79,196,0.06)" : "0 1px 2px rgba(0,0,0,0.02)" }}>

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {recipe.featured && <Star size={12} className="text-ora-signal" fill="var(--ora-signal)" />}
                    <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)", background: "var(--secondary)" }}>
                      {recipe.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "11px" }}><Heart size={10} /> {recipe.likes}</span>
                    <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "11px" }}><Copy size={10} /> {recipe.copies}</span>
                  </div>
                </div>

                <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 500, letterSpacing: "-0.01em" }}>{recipe.title}</h3>
                <p className="text-muted-foreground mb-4 flex-1" style={{ fontSize: "13px", lineHeight: 1.55 }}>{recipe.description}</p>

                {/* Models */}
                <div className="flex items-center gap-2 mb-4">
                  {recipe.models.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-md"
                      style={{ fontSize: "10px", fontWeight: 500, color: "var(--foreground)", background: "var(--secondary)", border: "1px solid var(--border)" }}>{m}</span>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="text-muted-foreground" style={{ fontSize: "11px" }}>#{tag}</span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <button onClick={() => handleCopy(recipe.id, recipe.prompt)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer"
                    style={{
                      fontSize: "13px", fontWeight: 500,
                      background: copiedId === recipe.id ? "rgba(22,163,74,0.08)" : "var(--secondary)",
                      color: copiedId === recipe.id ? "#16a34a" : "var(--foreground)",
                      border: "1px solid var(--border)",
                    }}>
                    {copiedId === recipe.id ? (<><Check size={13} /> Copied</>) : (<><Copy size={13} /> Copy prompt</>)}
                  </button>
                  <Link
                    to={`/hub?prompt=${encodeURIComponent(recipe.prompt)}&type=${recipe.category === "code" ? "code" : "text"}`}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                    style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
                    <Zap size={12} /> Use
                  </Link>
                </div>

                {/* Author */}
                <div className="mt-3">
                  <span className="text-muted-foreground" style={{ fontSize: "11px" }}>by {recipe.author}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredRecipes.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>No recipes match your search.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
