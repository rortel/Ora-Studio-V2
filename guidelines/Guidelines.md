# ORA Studio — Complete Project Reference for Claude

> Ce document contient l'intégralité du code source, du design system, et des directives du projet ORA Studio.
> Utilise-le comme contexte complet pour reproduire, modifier ou étendre le projet.

---

## 1. PRODUCT OVERVIEW

**ORA Studio** — "Your Brand. Amplified."

Un outil SaaS qui transforme un message maître en multiples formats brand-compliant (email, LinkedIn, ads, landing pages, stories, newsletter).

### Métaphore visuelle
Un "signal mesuré" — un point source émettant des pulses concentriques vers des cibles de format.

### Personas (5)
1. **CEO / Founder** — "Brand in safe hands."
2. **CMO** — "Move fast without sacrificing quality."
3. **Head of Comms** — "Everything on-brand. Zero exceptions."
4. **Creative Director** — "Amplify craft. Not replace it."
5. **Strategic Planner** — Translates business objectives into content strategy

### Architecture Agents (15 agents, 5 clusters)
- **Intelligence**: Brand Analyst, Strategic Planner, Audience Analyst
- **Creation**: Creative Director, Copywriter, Art Director, Email Specialist, Video Maker
- **Optimization**: SEO Strategist, Social Media Optimizer, Campaign Multiplier
- **Compliance & Quality**: Compliance Guard, Performance Analyst
- (+ 2 agents supplémentaires dans le narratif)

### Pricing (3 tiers)
- **Starter**: €99/mo (yearly €79/mo) — 1 Brand Vault, 3 agents, 20 pieces/mo
- **Agency**: €299/mo (yearly €239/mo) — 15 agents, Command Center, unlimited campaigns
- **Enterprise**: Custom — Multi-brand, Crisis Shield, API + SSO

---

## 2. DESIGN SYSTEM & RULES

### Strict Design Rules
- **NO photos** — aucune image photographique
- **NO emojis** — jamais
- **NO figurative illustrations** — pas de dessins, icônes illustratives
- **NO neon colors** — pas de couleurs néon
- **NO fog/smoke/blur effects** — pas de brouillard, fumée
- **NO rainbow gradients** — pas de dégradés arc-en-ciel

### Design Language
- **Bordures hairline** — `border: rgba(0,0,0,0.08)` et `border-strong: rgba(0,0,0,0.14)`
- **Ombres douces** — `box-shadow: 0 1px 2px rgba(0,0,0,0.02)` ou `0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.05)`
- **Couleur d'accent retenue** — `--ora-signal: #3b4fc4` (slate-blue)
- **Whitespace généreux** — sections `py-20 md:py-28`, composants avec `p-6` ou `p-7`
- **Typographie nette** — Inter, font-smoothing antialiased
- **Premium, minimal, light-theme**
- **Apple-like clarity** + **Stripe-like system design**

### Typography
- **Font**: Inter (weights: 300, 400, 500, 600)
- Headlines: `clamp(2rem, 4vw, 3rem)`, weight 500, letter-spacing `-0.035em`
- Body: 15-16px, line-height 1.55-1.6
- Labels/small: 11-13px, uppercase tracking `0.06-0.12em`
- No Tailwind font-size or font-weight classes — use inline `style={{}}` for precise control

### Color Palette
```css
--background: #fafafa;
--foreground: #111113;
--card: #ffffff;
--primary: #1a1a2e;          /* deep graphite-indigo */
--secondary: #f4f4f6;        /* cool gray */
--muted: #ededf0;
--muted-foreground: #6b6b7b;
--accent: #4a5568;           /* restrained slate */
--ora-signal: #3b4fc4;       /* THE accent color */
--ora-signal-light: rgba(59, 79, 196, 0.08);
--ora-signal-medium: rgba(59, 79, 196, 0.15);
--ora-signal-ring: rgba(59, 79, 196, 0.25);
--destructive: #d4183d;
--border: rgba(0, 0, 0, 0.08);
--border-strong: rgba(0, 0, 0, 0.14);
```

### Layout
- Max width: `1200px` pour le contenu marketing
- Padding horizontal: `px-6`
- Cards: `rounded-xl`, border hairline, shadow douce
- Sections: `py-20 md:py-28` typiquement
- Cards internes: `p-6` ou `p-7`

---

## 3. TECH STACK

- **React 18** + **Vite 6** + **TypeScript**
- **Tailwind CSS v4** (avec `@tailwindcss/vite`)
- **React Router 7** (Data mode avec `createBrowserRouter` + `RouterProvider`)
- **Motion** (ex Framer Motion) — `import { motion } from "motion/react"`
- **Lucide React** — icônes
- **Radix UI** — composants primitifs (accordion, dialog, tabs, etc.)
- **shadcn/ui** — design system de composants

### Important: React Router
```tsx
// UTILISER react-router, PAS react-router-dom
import { RouterProvider } from 'react-router';
import { createBrowserRouter, Link, useLocation, Outlet } from 'react-router';
```

---

## 4. FILE STRUCTURE

```
/
├── package.json
├── vite.config.ts
├── postcss.config.mjs
├── src/
│   ├── styles/
│   │   ├── fonts.css          # Google Fonts import (Inter)
│   │   ├── tailwind.css       # Tailwind config
│   │   ├── index.css          # Entry: imports fonts, tailwind, theme
│   │   └── theme.css          # Design tokens & base styles
│   └── app/
│       ├── App.tsx            # Entry: RouterProvider
│       ├── routes.ts          # createBrowserRouter config
│       ├── pages/
│       │   ├── RootLayout.tsx     # Navbar + Outlet + Footer
│       │   ├── LandingPage.tsx    # / — assemblage sections
│       │   ├── PricingPage.tsx    # /pricing — cards + comparison table + FAQ
│       │   ├── AgentsPage.tsx     # /agents — 4 clusters détaillés
│       │   ├── StudioPage.tsx     # /studio — chat interactif
│       │   ├── VaultPage.tsx      # /studio/vault — brand vault dashboard
│       │   ├── CampaignsPage.tsx  # /studio/campaigns — campaign list
│       │   ├── AnalyticsPage.tsx  # /studio/analytics — KPIs + charts
│       │   ├── LoginPage.tsx      # /login — auth form
│       │   └── NotFoundPage.tsx   # 404
│       └── components/
│           ├── Navbar.tsx         # Fixed top, adaptatif marketing/studio
│           ├── Hero.tsx           # Landing hero section
│           ├── PulseRadar.tsx     # SVG animation radar concentrique
│           ├── PulseMotif.tsx     # Pulse SVG réutilisable + PulseIcon + DiffusionDiagram
│           ├── SocialProof.tsx    # "Used by teams at" logos texte
│           ├── ThreeSteps.tsx     # 3 étapes Master→Cascade→Formats
│           ├── StudioMock.tsx     # Aperçu Studio avec chat + preview LinkedIn
│           ├── DecisionMakers.tsx # 4 cards personas
│           ├── Agents.tsx         # Grille 4 colonnes agents
│           ├── Pricing.tsx        # 3 cards pricing (landing)
│           ├── FAQ.tsx            # Accordéon animé
│           ├── CTASection.tsx     # CTA final avec PulseMotif background
│           ├── Footer.tsx         # 5 colonnes links
│           └── ui/               # shadcn/ui components (accordion, button, card, etc.)
```

---

## 5. ROUTES

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | LandingPage | Page marketing complète (Hero → PulseRadar → SocialProof → ThreeSteps → StudioMock → DecisionMakers → Agents → Pricing → FAQ → CTA) |
| `/pricing` | PricingPage | Pricing détaillé + toggle monthly/yearly + comparison table + FAQ |
| `/agents` | AgentsPage | 4 clusters × agents détaillés avec descriptions |
| `/studio` | StudioPage | Chat interactif avec sidebar (Morning Pulse + campaigns) |
| `/studio/vault` | VaultPage | Brand Vault dashboard (6 sections + vocabulaire) |
| `/studio/campaigns` | CampaignsPage | Liste campagnes avec search/filter |
| `/studio/analytics` | AnalyticsPage | KPIs + bar chart + format performance + agent activity |
| `/login` | LoginPage | Sign in / Sign up + Google OAuth |
| `*` | NotFoundPage | 404 avec PulseMotif |

---

## 6. COMPLETE SOURCE CODE

### 6.1 — `/vite.config.ts`
```ts
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
```

### 6.2 — `/src/styles/fonts.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
```

### 6.3 — `/src/styles/tailwind.css`
```css
@import 'tailwindcss' source(none);
@source '../**/*.{js,ts,jsx,tsx}';

@import 'tw-animate-css';
```

### 6.4 — `/src/styles/index.css`
```css
@import './fonts.css';
@import './tailwind.css';
@import './theme.css';
```

### 6.5 — `/src/styles/theme.css`
```css
@custom-variant dark (&:is(.dark *));

:root {
  --font-size: 16px;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* ORA Core Palette */
  --background: #fafafa;
  --foreground: #111113;
  --card: #ffffff;
  --card-foreground: #111113;
  --popover: #ffffff;
  --popover-foreground: #111113;

  /* Primary: deep graphite-indigo */
  --primary: #1a1a2e;
  --primary-foreground: #ffffff;

  /* Secondary: cool gray */
  --secondary: #f4f4f6;
  --secondary-foreground: #1a1a2e;

  /* Muted */
  --muted: #ededf0;
  --muted-foreground: #6b6b7b;

  /* Accent: restrained slate-blue */
  --accent: #4a5568;
  --accent-foreground: #ffffff;

  /* ORA Signal Color - the one deliberate accent */
  --ora-signal: #3b4fc4;
  --ora-signal-light: rgba(59, 79, 196, 0.08);
  --ora-signal-medium: rgba(59, 79, 196, 0.15);
  --ora-signal-ring: rgba(59, 79, 196, 0.25);

  /* Destructive */
  --destructive: #d4183d;
  --destructive-foreground: #ffffff;

  /* Borders & inputs */
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.14);
  --input: transparent;
  --input-background: #f5f5f7;
  --switch-background: #cbced4;

  --font-weight-medium: 500;
  --font-weight-normal: 400;

  --ring: rgba(59, 79, 196, 0.3);

  --chart-1: #3b4fc4;
  --chart-2: #6b7ec9;
  --chart-3: #9ba8d4;
  --chart-4: #c4cbe0;
  --chart-5: #e4e7f0;

  --radius: 0.5rem;

  --sidebar: #fafafa;
  --sidebar-foreground: #111113;
  --sidebar-primary: #1a1a2e;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #f0f0f3;
  --sidebar-accent-foreground: #1a1a2e;
  --sidebar-border: rgba(0, 0, 0, 0.08);
  --sidebar-ring: rgba(59, 79, 196, 0.3);
}

@theme inline {
  --font-family-inter: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-switch-background: var(--switch-background);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-ora-signal: var(--ora-signal);
  --color-ora-signal-light: var(--ora-signal-light);
  --color-ora-signal-medium: var(--ora-signal-medium);
  --color-ora-signal-ring: var(--ora-signal-ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
    font-family: var(--font-family);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  html {
    font-size: var(--font-size);
    scroll-behavior: smooth;
  }

  h1 { font-size: var(--text-2xl); font-weight: var(--font-weight-medium); line-height: 1.5; letter-spacing: -0.02em; }
  h2 { font-size: var(--text-xl); font-weight: var(--font-weight-medium); line-height: 1.5; letter-spacing: -0.01em; }
  h3 { font-size: var(--text-lg); font-weight: var(--font-weight-medium); line-height: 1.5; }
  h4 { font-size: var(--text-base); font-weight: var(--font-weight-medium); line-height: 1.5; }
  label { font-size: var(--text-base); font-weight: var(--font-weight-medium); line-height: 1.5; }
  button { font-size: var(--text-base); font-weight: var(--font-weight-medium); line-height: 1.5; }
  input { font-size: var(--text-base); font-weight: var(--font-weight-normal); line-height: 1.5; }
}
```

### 6.6 — `/src/app/App.tsx`
```tsx
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return <RouterProvider router={router} />;
}
```

### 6.7 — `/src/app/routes.ts`
```ts
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./pages/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { PricingPage } from "./pages/PricingPage";
import { AgentsPage } from "./pages/AgentsPage";
import { StudioPage } from "./pages/StudioPage";
import { VaultPage } from "./pages/VaultPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "pricing", Component: PricingPage },
      { path: "agents", Component: AgentsPage },
      { path: "studio", Component: StudioPage },
      { path: "studio/vault", Component: VaultPage },
      { path: "studio/campaigns", Component: CampaignsPage },
      { path: "studio/analytics", Component: AnalyticsPage },
      { path: "login", Component: LoginPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
```

### 6.8 — `/src/app/pages/RootLayout.tsx`
```tsx
import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function RootLayout() {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/studio");

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-14">
        <Outlet />
      </main>
      {!isStudio && <Footer />}
    </div>
  );
}
```

### 6.9 — `/src/app/pages/LandingPage.tsx`
```tsx
import { Hero } from "../components/Hero";
import { PulseRadar } from "../components/PulseRadar";
import { SocialProof } from "../components/SocialProof";
import { ThreeSteps } from "../components/ThreeSteps";
import { StudioMock } from "../components/StudioMock";
import { DecisionMakers } from "../components/DecisionMakers";
import { Agents } from "../components/Agents";
import { Pricing } from "../components/Pricing";
import { FAQ } from "../components/FAQ";
import { CTASection } from "../components/CTASection";

export function LandingPage() {
  return (
    <>
      <Hero />
      <PulseRadar />
      <SocialProof />
      <ThreeSteps />
      <StudioMock />
      <DecisionMakers />
      <Agents />
      <Pricing />
      <FAQ />
      <CTASection />
    </>
  );
}
```

### 6.10 — `/src/app/components/Navbar.tsx`
```tsx
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { PulseIcon } from "./PulseMotif";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/studio");

  const marketingLinks = [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Agents", href: "/agents" },
    { label: "Pricing", href: "/pricing" },
  ];

  const studioLinks = [
    { label: "Command Center", href: "/studio" },
    { label: "Brand Vault", href: "/studio/vault" },
    { label: "Campaigns", href: "/studio/campaigns" },
    { label: "Analytics", href: "/studio/analytics" },
  ];

  const links = isStudio ? studioLinks : marketingLinks;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <PulseIcon size={24} />
          <span className="text-foreground" style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            ORA Studio
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => {
            const isActive = location.pathname === l.href;
            return (
              <Link
                key={l.href}
                to={l.href}
                className={`transition-colors ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                style={{ fontSize: '14px', fontWeight: isActive ? 500 : 400 }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isStudio ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-ora-signal-light">
                <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                <span className="text-ora-signal" style={{ fontSize: '12px', fontWeight: 500 }}>Acme Corp</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground" style={{ fontSize: '13px', fontWeight: 600 }}>
                A
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: '14px' }}>
                Sign in
              </Link>
              <Link to="/studio" className="bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ fontSize: '14px', fontWeight: 500 }}>
                Try Studio
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-6 py-4 space-y-3">
          {links.map((l) => (
            <Link key={l.href} to={l.href} className="block text-muted-foreground hover:text-foreground" style={{ fontSize: '15px' }} onClick={() => setMobileOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border flex gap-3">
            <Link to="/login" className="text-muted-foreground" style={{ fontSize: '15px' }}>Sign in</Link>
            <Link to="/studio" className="bg-primary text-primary-foreground px-5 py-2 rounded-lg" style={{ fontSize: '15px' }}>
              Try Studio
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
```

### 6.11 — `/src/app/components/Hero.tsx`
```tsx
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export function Hero() {
  return (
    <section className="pt-16 pb-16 md:pt-24 md:pb-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-[640px]">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
            <span className="text-foreground" style={{ fontSize: '14px', fontWeight: 400 }}>
              15 AI agents. One brand voice.
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
            className="mb-8"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.035em' }}>
            <span className="text-foreground">Your brand's smartest</span>
            <br />
            <span className="text-muted-foreground">team member.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}
            className="text-foreground/80 mb-4" style={{ fontSize: '18px', lineHeight: 1.55 }}>
            ORA generates, validates, and adapts every piece of content — across every format — against your Brand Vault. Compliance guaranteed before you see it.
          </motion.p>

          {/* Secondary line */}
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.22 }}
            className="text-muted-foreground mb-10" style={{ fontSize: '15px', lineHeight: 1.55 }}>
            One sentence → full multi-channel campaign in 15 minutes. Always on-brand.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }}
            className="flex items-center gap-3">
            <Link to="/studio" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
              style={{ fontSize: '15px', fontWeight: 500 }}>
              Open Studio <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center gap-2 border border-border-strong text-foreground px-6 py-3 rounded-lg hover:bg-secondary transition-colors"
              style={{ fontSize: '15px', fontWeight: 500 }}>
              See how it works
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

### 6.12 — `/src/app/components/PulseMotif.tsx`
```tsx
import { motion } from "motion/react";

interface PulseMotifProps {
  size?: number;
  rings?: number;
  className?: string;
  animate?: boolean;
  strokeColor?: string;
}

export function PulseMotif({ size = 320, rings = 5, className = "", animate = true, strokeColor = "var(--ora-signal)" }: PulseMotifProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 4;
  const spacing = maxRadius / (rings + 1);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} fill="none">
      <circle cx={center} cy={center} r={2.5} fill={strokeColor} />
      {Array.from({ length: rings }).map((_, i) => {
        const radius = spacing * (i + 1);
        const opacity = 1 - i * (0.7 / rings);
        return (
          <motion.circle key={i} cx={center} cy={center} r={radius} stroke={strokeColor} strokeWidth={0.5} opacity={0}
            initial={animate ? { r: 0, opacity: 0 } : { r: radius, opacity: opacity * 0.5 }}
            animate={animate ? { r: [0, radius, radius], opacity: [0, opacity * 0.6, 0] } : undefined}
            transition={animate ? { duration: 3, delay: i * 0.4, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" } : undefined}
          />
        );
      })}
    </svg>
  );
}

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

export function DiffusionDiagram({ className = "" }: { className?: string }) {
  const targets = [
    { label: "Email", x: 88, y: 8 },
    { label: "LinkedIn", x: 95, y: 28 },
    { label: "Ad Copy", x: 92, y: 50 },
    { label: "Landing", x: 95, y: 72 },
    { label: "Stories", x: 88, y: 92 },
  ];

  return (
    <div className={`relative w-full max-w-[560px] h-[280px] ${className}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {targets.map((t, i) => (
          <motion.line key={i} x1="8" y1="50" x2={t.x} y2={t.y} stroke="var(--ora-signal)" strokeWidth="0.15" strokeDasharray="1 1"
            initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.4 }} viewport={{ once: true }}
            transition={{ duration: 1, delay: i * 0.15 }} />
        ))}
      </svg>
      <div className="absolute left-[4%] top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-ora-signal" />
        <span className="text-xs tracking-wide text-muted-foreground uppercase">Source</span>
      </div>
      {targets.map((t, i) => (
        <motion.div key={i} className="absolute flex items-center gap-1.5"
          style={{ left: `${t.x - 4}%`, top: `${t.y}%`, transform: "translateY(-50%)" }}
          initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.1 }}>
          <div className="w-1.5 h-1.5 rounded-full bg-ora-signal/50" />
          <span className="text-xs tracking-wide text-foreground/70">{t.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
```

### 6.13 — `/src/app/components/PulseRadar.tsx`
```tsx
import { motion } from "motion/react";

const targets = [
  { label: "Email", angle: -90 },
  { label: "LinkedIn", angle: -30 },
  { label: "Ad", angle: 30 },
  { label: "Landing", angle: 90 },
  { label: "Stories", angle: 150 },
  { label: "Newsletter", angle: 210 },
];

export function PulseRadar() {
  const size = 600;
  const cx = size / 2;
  const cy = size / 2;
  const rings = [60, 100, 140, 180, 220, 260];
  const targetRadius = 240;
  const dotRadius = 280;

  return (
    <section className="py-12 md:py-20 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 flex justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.8 }}
          className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="w-full h-full max-w-full">
            {rings.map((r, i) => (
              <circle key={i} cx={cx} cy={cy} r={r} stroke="var(--ora-signal)" strokeWidth={0.5} opacity={0.15 + (i * 0.04)} />
            ))}
            {targets.map((t, i) => {
              const rad = (t.angle * Math.PI) / 180;
              const x2 = cx + dotRadius * Math.cos(rad);
              const y2 = cy + dotRadius * Math.sin(rad);
              return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--border-strong)" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.5} />;
            })}
            <circle cx={cx} cy={cy} r={3} fill="var(--ora-signal)" />
            {[0, 1, 2].map((i) => (
              <motion.circle key={`pulse-${i}`} cx={cx} cy={cy} r={0} stroke="var(--ora-signal)" strokeWidth={0.5} fill="none"
                animate={{ r: [0, 260], opacity: [0.3, 0] }}
                transition={{ duration: 4, delay: i * 1.3, repeat: Infinity, ease: "easeOut" }} />
            ))}
            {targets.map((t, i) => {
              const rad = (t.angle * Math.PI) / 180;
              const dx = cx + dotRadius * Math.cos(rad);
              const dy = cy + dotRadius * Math.sin(rad);
              return (
                <g key={`dot-${i}`}>
                  <circle cx={dx} cy={dy} r={10} fill="white" stroke="var(--ora-signal)" strokeWidth={1} opacity={0.6} />
                  <circle cx={dx} cy={dy} r={3} fill="var(--ora-signal)" opacity={0.6} />
                </g>
              );
            })}
          </svg>
          {targets.map((t) => {
            const rad = (t.angle * Math.PI) / 180;
            const labelR = targetRadius * 0.82;
            const lx = 50 + (labelR / (size / 2)) * 50 * Math.cos(rad);
            const ly = 50 + (labelR / (size / 2)) * 50 * Math.sin(rad);
            return (
              <div key={t.label} className="absolute text-muted-foreground"
                style={{ left: `${lx}%`, top: `${ly}%`, transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 400 }}>
                {t.label}
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
```

### 6.14 — `/src/app/components/SocialProof.tsx`
```tsx
import { motion } from "motion/react";

const companies = ["Meridian Group", "Helix Studio", "Nortem", "Vault & Co", "Apex Digital"];

export function SocialProof() {
  return (
    <section className="py-10 border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
          <span className="text-muted-foreground uppercase tracking-widest flex-shrink-0"
            style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em' }}>
            Used by teams at
          </span>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {companies.map((name) => (
              <span key={name} className="text-muted-foreground/50" style={{ fontSize: '16px', fontWeight: 400, letterSpacing: '-0.01em' }}>
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

### 6.15 — `/src/app/components/ThreeSteps.tsx`
```tsx
import { motion } from "motion/react";

const steps = [
  { num: "01", title: "Build your Brand Vault", desc: "Drop your URL. Upload your guidelines. Answer 7 questions. ORA crawls your entire digital presence and builds a living Brand Vault — tone, vocabulary, visual codes, audience, competitors." },
  { num: "02", title: "Create the master", desc: "Write a brief or type one sentence. 15 AI agents — each a specialist — produce the core message with the right tone, the right words, compliance enforced before you see it." },
  { num: "03", title: "Cascade to every format", desc: "One click. Email, LinkedIn, ads, landing page, stories, newsletter — adapted to every platform's rules while maintaining one unified brand voice. Score: 90+ guaranteed." },
];

export function ThreeSteps() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <h2 className="text-foreground mb-4"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Master → Cascade → Formats
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '16px', lineHeight: 1.55 }}>
            Three steps from brief to brand-compliant, multi-format campaign.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div key={step.num} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="border-t border-border pt-6">
              <span className="text-ora-signal mb-4 block" style={{ fontSize: '14px', fontWeight: 500 }}>{step.num}</span>
              <h3 className="text-foreground mb-3" style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.3 }}>{step.title}</h3>
              <p className="text-muted-foreground" style={{ fontSize: '15px', lineHeight: 1.6 }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 6.16 — `/src/app/components/StudioMock.tsx`
(Chat preview with LinkedIn post — see full source in section 6 files)

### 6.17 — `/src/app/components/DecisionMakers.tsx`
(4 persona cards — CEO, CMO, Head of Comms, Creative Director)

### 6.18 — `/src/app/components/Agents.tsx`
(4-column grid of agent clusters)

### 6.19 — `/src/app/components/Pricing.tsx`
(3 pricing cards on landing page)

### 6.20 — `/src/app/components/FAQ.tsx`
(Animated accordion with 7 Q&As)

### 6.21 — `/src/app/components/CTASection.tsx`
(Final CTA with PulseMotif background)

### 6.22 — `/src/app/components/Footer.tsx`
(5-column footer with links)

---

## 7. ANIMATION PATTERNS

### Motion stagger fade-in (most common)
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: i * 0.08 }}
>
```

### Animated pulse (PulseRadar)
```tsx
<motion.circle
  animate={{ r: [0, 260], opacity: [0.3, 0] }}
  transition={{ duration: 4, delay: i * 1.3, repeat: Infinity, ease: "easeOut" }}
/>
```

### Accordion (FAQ)
```tsx
<AnimatePresence initial={false}>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    />
  )}
</AnimatePresence>
```

### Hero stagger
```tsx
// Delay increments: 0, 0.08, 0.16, 0.22, 0.28
transition={{ duration: 0.6, delay: 0.08 }}
```

---

## 8. KEY DESIGN PATTERNS

### Card pattern
```tsx
<div className="bg-card border border-border rounded-xl p-6"
  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
```

### Highlighted card (pricing)
```tsx
className={`border ${plan.highlighted ? "border-ora-signal" : "border-border"}`}
style={{ boxShadow: plan.highlighted ? '0 1px 3px rgba(0,0,0,0.04), 0 12px 40px rgba(59,79,196,0.08)' : '0 1px 2px rgba(0,0,0,0.02)' }}
```

### Section header pattern
```tsx
<h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
  Title
</h2>
<p className="text-muted-foreground" style={{ fontSize: '16px', lineHeight: 1.55 }}>
  Subtitle
</p>
```

### Badge/pill
```tsx
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card">
  <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
  <span style={{ fontSize: '14px' }}>Label</span>
</div>
```

### Status badge
```tsx
<span className="px-2 py-0.5 rounded text-white bg-green-500" style={{ fontSize: '10px', fontWeight: 600 }}>
  Live
</span>
```

### Score display
```tsx
<span className="text-ora-signal" style={{ fontSize: '14px', fontWeight: 600 }}>96/100</span>
```

---

## 9. COMPONENT INTERACTIONS

- **Navbar**: Adapts between marketing links and studio links based on `location.pathname.startsWith("/studio")`
- **Pricing toggle**: Monthly/yearly with `-20%` discount badge
- **FAQ accordion**: Single-open pattern (clicking one closes others)
- **Studio chat**: Simulated agent responses with typing indicator
- **Brand Vault**: Tab-based card selection
- **Campaigns**: Search + filter bar (UI only)
- **Analytics**: Animated bar charts + progress bars

---

## 10. DEPENDENCIES (package.json)

Key dependencies:
- `react` / `react-dom`: 18.3.1
- `react-router`: 7.13.0
- `motion`: 12.23.24
- `lucide-react`: 0.487.0
- `tailwindcss`: 4.1.12
- `@tailwindcss/vite`: 4.1.12
- `tw-animate-css`: 1.3.8
- Radix UI primitives (accordion, dialog, tabs, etc.)
- shadcn/ui components in `/src/app/components/ui/`

---

*Ce document est auto-généré depuis le code source du projet ORA Studio. Date: Mars 2026.*
