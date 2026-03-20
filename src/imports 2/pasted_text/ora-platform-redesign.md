Redesign a SaaS AI content generation platform called ORA.
Full platform redesign — all screens, all components.

─── VIBE ───────────────────────────────────────────
Dark, vivid, electric. Not just dark — dark with colors
that POP. Think Pika.art meets a creative studio app.
Energetic, punchy, alive. Every screen should feel like
something is happening.

─── COLOR PALETTE ──────────────────────────────────
Background base:     #0A0A12  (near-black, blue tint)
Background surface:  #12121E
Primary accent:      #7B2FFF  (electric violet — main CTA, highlights)
Secondary accent:    #00F0FF  (cyan — AI/generation states, tech feel)
Success / confirm:   #AAFF00  (electric lime — scores, validation)
Warning / energy:    #FF8C00  (hot orange — urgency, badges)
Text primary:        #FFFFFF
Text muted:          #8888AA
Borders:             #1E1E32

Rule: accents always appear with glow/shadow, never flat.
Example: violet button → box-shadow: 0 0 24px rgba(123,47,255,0.45)

─── TYPOGRAPHY ─────────────────────────────────────
Font: Inter or Plus Jakarta Sans
Hero titles: 72-96px, weight 800, tracking -0.03em
Section titles: 28-36px, weight 700, tracking -0.02em
Body: 15px, weight 400, line-height 1.6
Labels/pills: 10-11px, weight 700, uppercase, tracking 0.08em
Tone: short, verb-first, conversational.
  "Generate" not "Content generation"
  "Your last 12 creations" not "Recent outputs"
  "What do you want to make?" not "Enter your prompt"

─── CARDS — THE CORE COMPONENT ─────────────────────
Cards are the primary UI pattern across all screens.
Every piece of generated content lives in a card.

Card anatomy:
  - Image fills top 70% of card (object-fit: cover)
  - Gradient overlay at bottom of image (dark, subtle)
  - Footer: format pill + title + score badge
  - Corner radius: 16px
  - Border: 1px solid #1E1E32 at rest

Card states (design all 4):
  1. Empty/available  → dashed border, muted icon, subtle pattern bg
  2. Generating       → cyan glow border, shimmer animation overlay,
                        spinner, border: 1px solid rgba(0,240,255,0.3)
  3. Generated        → full image, score in lime/orange depending on value
  4. Hover/selected   → scale(1.03), violet border + violet glow,
                        box-shadow: 0 8px 32px rgba(123,47,255,0.3)

Format pills on cards (color-coded):
  Story 9:16  → violet pill
  Reel 4:5    → cyan pill
  Post 1:1    → white/neutral pill
  Video 16:9  → orange pill
  Carousel    → lime pill

Score badge: top-right corner of image, semi-transparent dark bg,
colored number (lime if >85, orange if 70-85, muted if <70)

Card grid: auto-fill, min 200px, gap 12px.
First card in a section can be "featured" (double width).

─── KEY SCREENS TO DESIGN ──────────────────────────

1. LANDING PAGE
   Hero: full-viewport, background = grid of generated images
   at low opacity, radial gradient glow in violet + cyan on top.
   Massive headline. Conversational input bar (pill-shaped,
   violet focus state). Horizontal scrolling strip of cards below.

2. DASHBOARD (logged in)
   Left sidebar: minimal, icon-only, dark.
   Main area: "What are you making today?" input at top.
   Below: card grid of recent generations.
   Right panel (optional): quick stats, score breakdown.

3. GENERATION SCREEN
   Split view: left = conversational prompt interface (chat-style,
   message bubbles, dark bg), right = live card grid updating
   as content generates. Show 3 card states simultaneously.
   Progress feels like a conversation, not a loading bar.

4. CONTENT LIBRARY
   Full card grid, filterable by format (pills as filter tabs).
   Featured card (first, double-width) = top scored content.
   Masonry or uniform grid, both show the images as heroes.

5. PRICING PAGE
   3 cards, dark surface bg.
   Middle "recommended" card: violet glow border, slightly elevated.
   Price displayed large, feature list minimal and scannable.

─── IMAGES AS QUEENS ───────────────────────────────
Images are never decorative. They ARE the product.
  - Always full-bleed in cards, no padding around images
  - Slight gradient overlay only at the bottom (for text legibility)
  - Never add extra frames, borders, or decorative containers around images
  - On landing: images visible behind the hero text (low opacity grid)
  - In library: images fill the entire card top area

─── CONVERSATIONAL FEEL ────────────────────────────
The platform should feel like texting, not filling a form.
  - Input fields: pill-shaped, not rectangular
  - Progress: shown as a chat thread, not a progress bar
  - Labels speak: "Top pick" not "Recommended"
               "Generating your story..." not "Processing"
               "Done — here are 4 options" not "Results"
  - Empty states: friendly, directive — "Drop a prompt, get a visual"
  - Notifications: toast-style, bottom-right, short sentences

─── MOTION PRINCIPLES ──────────────────────────────
(for prototyping in Figma)
  - Card hover: 0.18s ease, scale 1.03 + glow appears
  - CTA buttons: 0.15s, scale 0.97 on press
  - Generating shimmer: 1.8s linear infinite sweep
  - Page transitions: fade + 8px slide up, 0.2s ease-out
  - Score badge appear: scale from 0.5, 0.3s spring

─── DO NOT ─────────────────────────────────────────
  - No coral color anywhere
  - No light backgrounds (stay dark)
  - No rounded rectangles around images (images bleed to card edges)
  - No heavy gradients on text (keep it white and clean)
  - No more than 3 accent colors visible on any single screen
  - No generic SaaS look (no blue + white + rounded cards on white bg)
