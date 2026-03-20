// ============================================================
// POST /vault/scan-url
// Scan a URL and extract full brand DNA using Jina + Claude
// Replace the existing route in index.ts
// ============================================================

app.post("/vault/scan-url", async (c) => {
  try {
    const user = await requireAuth(c);
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "URL required" }, 400);

    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Deduct credit
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    // ── 1. SCRAPE WITH JINA READER ──────────────────────────────
    console.log(`[scan-url] Scraping ${normalizedUrl} with Jina...`);
    let markdown = "";

    try {
      const jinaKey = Deno.env.get("JINA_API_KEY");
      const res = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
        headers: {
          ...(jinaKey ? { "Authorization": `Bearer ${jinaKey}` } : {}),
          "Accept": "text/markdown",
          "X-No-Cache": "true",
          "X-Token-Budget": "80000",
          "X-With-Generated-Alt": "true",     // captions images (logo, visuels)
          "X-With-Images-Summary": "all",      // section images complète
          "X-Remove-Selector": "nav, footer, script, style, #cookie-banner, .cookie, #gdpr",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        markdown = await res.text();
        console.log(`[scan-url] Jina OK — ${markdown.length} chars`);
      } else {
        console.log(`[scan-url] Jina error ${res.status}`);
      }
    } catch (e) {
      console.log("[scan-url] Jina failed:", e);
    }

    // ── 2. FALLBACK: direct fetch ────────────────────────────────
    if (!markdown) {
      console.log("[scan-url] Fallback: direct fetch...");
      try {
        const res = await fetch(normalizedUrl, {
          headers: { "User-Agent": "ORA-Bot/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        const html = await res.text();
        markdown = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 6000);
        console.log(`[scan-url] Fallback OK — ${markdown.length} chars`);
      } catch (e) {
        console.log("[scan-url] Fallback failed:", e);
      }
    }

    if (!markdown) {
      return c.json({ success: false, error: "Could not scrape URL" }, 422);
    }

    // ── 3. CLAUDE BRAND EXTRACTION ──────────────────────────────
    console.log("[scan-url] Sending to Claude for brand extraction...");

    const analysis = await generateText({
      model: "gpt-4o",
      maxTokens: 2000,
      systemPrompt: `You are an expert brand analyst and creative director.
Analyze the website content provided and extract a complete brand profile.
Return ONLY a valid JSON object. No markdown, no explanation, no preamble.

The JSON must follow this exact structure:
{
  "brand_name": "string — official brand name",
  "tagline": "string — main tagline or value proposition if found",
  "industry": "string — sector/industry",
  
  "positioning": {
    "statement": "string — what the brand does and for whom in one sentence",
    "market_position": "string — premium | mid-range | accessible | unknown",
    "differentiators": ["string", "string"],
    "competitive_angle": "string — what makes them unique vs competitors"
  },
  
  "tone_of_voice": {
    "primary": "string — main tone (ex: expert, playful, inspiring, serious)",
    "adjectives": ["string", "string", "string"],
    "formality": 7,
    "confidence": 8,
    "warmth": 6,
    "humor": 2,
    "do_say": ["example phrase or style that fits the brand"],
    "dont_say": ["example phrase or style that does NOT fit the brand"]
  },
  
  "semantics": {
    "approved_terms": ["words and phrases that match the brand voice"],
    "forbidden_terms": ["words that clash with the brand positioning"],
    "brand_specific": ["proper nouns, product names, trademarked terms"],
    "key_messages": ["core message 1", "core message 2", "core message 3"]
  },
  
  "target_audience": {
    "primary": "string — main target description",
    "secondary": "string — secondary target if applicable",
    "personas": ["persona 1 short description", "persona 2 short description"],
    "age_range": "string — ex: 25-45",
    "psychographics": ["value 1", "value 2"]
  },
  
  "visual_identity": {
    "colors": {
      "primary": ["#hex if detected from images/content, or descriptive name"],
      "secondary": ["#hex or name"],
      "accent": ["#hex or name"]
    },
    "typography": {
      "style": "string — serif | sans-serif | mixed | display",
      "fonts_detected": ["font name if mentioned or visible"]
    },
    "graphic_style": "string — minimalist | bold | organic | geometric | luxury | playful | editorial | other",
    "imagery_style": "string — describe the visual style of images used",
    "layout_feel": "string — clean | dense | airy | structured | dynamic"
  },
  
  "logo": {
    "description": "string — describe the logo if visible in images",
    "style": "string — wordmark | lettermark | symbol | combination | emblem",
    "url": "string — direct URL to logo image if found, else empty string"
  },
  
  "og_image": "string — og:image URL if found in content, else empty string",
  
  "compliance": {
    "regulations": "string — GDPR | CCPA | sector-specific or unknown",
    "has_privacy_policy": true,
    "certifications": ["certification 1 if mentioned"]
  },
  
  "confidence_score": 85
}

Rules:
- tone values (formality, confidence, warmth, humor) are integers 1-10
- confidence_score is 0-100 based on how much brand signal you found
- If you cannot determine a value, use null — never invent data
- For colors: extract from image descriptions, CSS mentions, or brand language
- For logo: look in the Images section of the content
- Return ONLY the JSON object`,

      prompt: `Analyze this website content and extract the complete brand profile.

URL: ${normalizedUrl}

CONTENT:
${markdown.slice(0, 12000)}`,
    });

    // ── 4. PARSE RESPONSE ────────────────────────────────────────
    let scan: any = {};
    try {
      const match = analysis.text.match(/\{[\s\S]*\}/);
      if (match) {
        scan = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log("[scan-url] JSON parse failed, returning raw");
      scan = { raw: analysis.text };
    }

    scan.source_url = normalizedUrl;
    scan.scanned_at = new Date().toISOString();
    scan.word_count = markdown.split(/\s+/).filter(Boolean).length;

    console.log(`[scan-url] Done — confidence: ${scan.confidence_score}`);
    return c.json({ success: true, scan });

  } catch (err) {
    console.error("[scan-url] Error:", err);
    return c.json({ success: false, error: `Scan error: ${err}` }, 500);
  }
});
