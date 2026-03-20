
app.put("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const existing = await kv.get(`vault:${user.id}`) || {};
    const updated = { ...existing, ...body, userId: user.id, updatedAt: new Date().toISOString() };
    await kv.set(`vault:${user.id}`, updated);
    return c.json({ success: true, vault: updated });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/vault/upload-logo", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    if (!file) return c.json({ error: "No file provided" }, 400);
    const ext = file.name.split(".").pop() || "png";
    const storagePath = `vault-logos/${user.id}-logo.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    // Upsert to replace existing logo
    await sb.storage.from(MEDIA_BUCKET).remove([storagePath]).catch(() => {});
    const { error: uploadErr } = await sb.storage.from(MEDIA_BUCKET).upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });
    if (uploadErr) return c.json({ error: `Upload failed: ${uploadErr.message}` }, 500);
    // Long-lived signed URL (30 days)
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 30);
    // Save logo info in vault
    const existing = await kv.get(`vault:${user.id}`) || {};
    await kv.set(`vault:${user.id}`, { ...existing, logoUrl: urlData?.signedUrl || null, logoStoragePath: storagePath, updatedAt: new Date().toISOString() });
    console.log(`[vault/upload-logo] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, logoUrl: urlData?.signedUrl || null, storagePath });
  } catch (err) {
    console.log(`[vault/upload-logo] error: ${err}`);
    return c.json({ success: false, error: `Logo upload error: ${err}` }, 500);
  }
});

// ── Shared: fetch with hard timeout (used by vault routes) ──
async function fetchWithTimeout(input: string, init: any = {}, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(input, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// ── Shared: validate URL (basic SSRF protection) ──
function isValidScrapeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host === "0.0.0.0") return false;
    return true;
  } catch { return false; }
}

// ── Shared: scrape URL via Jina Reader (primary) with direct fetch fallback ──
async function scrapeUrl(url: string): Promise<{ content: string; source: string }> {
  const jinaKey = Deno.env.get("JINA_API_KEY");
  console.log(`[scrape] Starting for: ${url}`);
  console.log(`[scrape] JINA_API_KEY present: ${!!jinaKey}, len: ${jinaKey?.length || 0}`);

  // Primary: Jina Reader API
  if (jinaKey) {
    try {
      console.log(`[scrape] Calling Jina Reader for ${url}...`);
      const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${jinaKey}`,
          "Accept": "application/json",
          "X-No-Cache": "true",
          "X-Proxy": "auto",
          "X-Target-Selector": "body",
          "X-Token-Budget": "200000",
          "X-With-Generated-Alt": "true",
          "X-With-Images-Summary": "all",
        },
      }, 30_000);
      console.log(`[scrape] Jina status: ${res.status}`);
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.log(`[scrape] Jina error body: ${errBody.slice(0, 500)}`);
        throw new Error(`Jina ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await res.json();
      const md = data.data?.content || data.data?.text || data.content || "";
      console.log(`[scrape] Jina returned ${md.length} chars, code: ${data.code}, keys: ${JSON.stringify(Object.keys(data.data || data || {}))}`);
      if (md.length >= 50) {
        return { content: md.slice(0, 12000), source: "jina" };
      }
      console.log(`[scrape] Jina too short (${md.length}), falling back`);
    } catch (e) {
      console.log(`[scrape] Jina fail: ${e}`);
    }
    console.log(`[scrape] Falling back to direct fetch...`);
  } else {
    console.log(`[scrape] No JINA_API_KEY, skipping to direct fetch`);
  }

  // Fallback: direct fetch + strip HTML
  try {
    console.log(`[scrape] Direct fetching: ${url}`);
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    }, 8_000);
    console.log(`[scrape] Direct status: ${res.status} ${res.statusText}`);
    let html = await res.text();
    console.log(`[scrape] Direct raw: ${html.length} chars`);
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
    html = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (html.length < 100) throw new Error(`Page too short after strip (${html.length} chars)`);
    console.log(`[scrape] Direct OK: ${html.length} chars`);
    return { content: html.slice(0, 10000), source: "direct" };
  } catch (e) {
    console.log(`[scrape] Direct also failed: ${e}`);
    throw new Error(`All scrape methods failed for ${url}. Jina: ${jinaKey ? "tried" : "no key"}. Direct: ${e}`);
  }
}

// ── Shared: brand analysis system prompt ──
const BRAND_ANALYSIS_PROMPT = `You are an expert brand analyst. Analyze the website content and return a JSON object with exactly this structure:
{
  "brandName": "string",
  "tone": { "formality": 7, "confidence": 8, "warmth": 5, "humor": 3 },
  "keyMessages": ["message1", "message2", "message3"],
  "audiences": { "primary": "string", "secondary": "string", "tertiary": "string" },
  "competitors": ["competitor1", "competitor2"],
  "vocabulary": { "approvedTerms": ["word1", "word2"], "forbiddenTerms": ["word1"] },
  "socialProfiles": ["https://linkedin.com/..."],
  "colors": ["#FF0000", "#00FF00"],
  "typography": ["Inter", "Arial"],
  "compliance": { "regulations": "GDPR", "hasPrivacyPolicy": true, "hasAccessibility": false }
}
Tone values are integers 1-10. Colors are hex codes. Return ONLY the JSON object, nothing else.`;

// ── Mistral AI helper for vault analysis ──
const MISTRAL_BASE = "https://api.mistral.ai/v1";

function mistralHeaders(): Record<string, string> {
  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) throw new Error("MISTRAL_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

// ── Shared: call AI for brand analysis ──
async function analyzeBrandWithAI(content: string, url: string): Promise<any> {
  const wordCount = content.split(/\s+/).length;
  const trimmed = content.slice(0, 4000);

  console.log(`[analyze-brand] Calling Mistral for ${url} (${wordCount} words)...`);
  const aiRes = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
    method: "POST", headers: mistralHeaders(),
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: BRAND_ANALYSIS_PROMPT },
        { role: "user", content: `Analyze this brand from ${url} (1 page, ${wordCount} words):\n\n${trimmed}` },
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  }, 30_000);

  if (!aiRes.ok) {
    const errBody = (await aiRes.text()).slice(0, 300);
    console.log(`[analyze-brand] Mistral error ${aiRes.status}: ${errBody}`);
    return { brandName: "", wordCount };
  }

  const aiData = await aiRes.json();
  const rawContent = aiData.choices?.[0]?.message?.content || "";
  if (!rawContent) return { brandName: "", wordCount };

  const cleanJson = rawContent.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleanJson);
  parsed.wordCount = wordCount;
  parsed.pagesScraped = 1;
  return parsed;
}

// ── VAULT ROUTE: Scrape URL only (step 1 — lightweight, fast) ──
app.get("/vault/scrape-url", async (c) => {
  const t0 = Date.now();
  console.log(`[scrape-url] Handler entered`);
  try {
    const user = await requireAuth(c);
    const rawUrl = c.req.query("url");
    if (!rawUrl) return c.json({ success: false, error: "URL required" }, 400);
    let url: string;
    try {
      url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).href;
    } catch {
      return c.json({ success: false, error: "URL invalide" }, 400);
    }
    if (!isValidScrapeUrl(url)) return c.json({ success: false, error: "Invalid URL. Only public http/https URLs are allowed." }, 400);

    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits" }, 403);

    console.log(`[scrape-url] Scraping ${url} for ${user.id}`);
    const result = await scrapeUrl(url);
    console.log(`[scrape-url] DONE in ${Date.now() - t0}ms via ${result.source}`);
    return c.json({ success: true, content: result.content, source: result.source });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[scrape-url] ERROR in ${Date.now() - t0}ms: ${msg}`);
    return c.json({ success: false, error: `Scrape failed: ${msg}` }, 500);
  }
});

// ��─ VAULT ROUTE: Analyze scraped content with AI (step 2) ──
app.post("/vault/analyze-brand", async (c) => {
  const t0 = Date.now();
  console.log(`[analyze-brand] Handler entered`);
  try {
    await requireAuth(c);
    const body = await c.req.json();
    const { content, url } = body;
    if (!content) return c.json({ success: false, error: "Content required" }, 400);

    console.log(`[analyze-brand] Analyzing ${url || "unknown"}, ${content.length} chars...`);
    const scan = await analyzeBrandWithAI(content, url || "unknown");
    console.log(`[analyze-brand] DONE in ${Date.now() - t0}ms — brand: ${scan.brandName}`);
    return c.json({ success: true, scan });
  } catch (err) {
    console.log(`[analyze-brand] ERROR: ${err}`);
    return c.json({ success: false, error: `Analysis error: ${err}` }, 500);
  }
});

// ─── VAULT ROUTE: Monolithic scan-url (scrape + AI analysis in one call) ──
app.post("/vault/scan-url", async (c) => {
  const t0 = Date.now();
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
          "X-With-Generated-Alt": "true",
          "X-With-Images-Summary": "all",
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

    // ── 3. MISTRAL BRAND EXTRACTION ──────────────────────────────
    console.log("[scan-url] Sending to Mistral for brand extraction...");

    const mistralKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralKey) {
      return c.json({ success: false, error: "MISTRAL_API_KEY not configured" }, 500);
    }

    const systemPrompt = `You are an expert brand analyst and creative director.
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
- Return ONLY the JSON object`;

    const userPrompt = `Analyze this website content and extract the complete brand profile.

URL: ${normalizedUrl}

CONTENT:
${markdown.slice(0, 12000)}`;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      
      const aiRes = await fetch(`${MISTRAL_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralKey}`,
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 2000,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
        signal: ctrl.signal,
      });
      
      clearTimeout(timer);

      if (!aiRes.ok) {
        const errBody = await aiRes.text();
        console.log(`[scan-url] Mistral error ${aiRes.status}: ${errBody.slice(0, 300)}`);
        return c.json({ success: false, error: `AI analysis failed: ${aiRes.status}` }, 500);
      }

      const aiData = await aiRes.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "";
      
      if (!rawContent) {
        return c.json({ success: false, error: "Empty AI response" }, 500);
      }

      // ── 4. PARSE RESPONSE ────────────────────────────────────────
      let scan: any = {};
      try {
        const cleanJson = rawContent.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
        scan = JSON.parse(cleanJson);
      } catch (e) {
        console.log("[scan-url] JSON parse failed, trying raw match");
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            scan = JSON.parse(match[0]);
          } catch {
            console.log("[scan-url] JSON parse failed completely, returning raw");
            scan = { raw: rawContent };
          }
        } else {
          scan = { raw: rawContent };
        }
      }

      scan.source_url = normalizedUrl;
      scan.scanned_at = new Date().toISOString();
      scan.word_count = markdown.split(/\s+/).filter(Boolean).length;

      console.log(`[scan-url] Done in ${Date.now() - t0}ms — confidence: ${scan.confidence_score}`);
      return c.json({ success: true, scan });

    } catch (err: any) {
      if (err?.name === "AbortError") {
        return c.json({ success: false, error: "AI analysis timeout (60s)" }, 504);
      }
      throw err;
    }

  } catch (err) {
    console.error("[scan-url] Error:", err);
    return c.json({ success: false, error: `Scan error: ${err}` }, 500);
  }
});

app.post("/vault/analyze-guidelines", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json().catch(() => ({}));
    const content = body.content || body.text || "";
    const fileName = body.fileName || "guidelines";
    if (!content || content.trim().length < 20) return c.json({ success: false, error: "Content required (min 20 chars)" }, 400);
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits" }, 403);

    const trimmed = content.slice(0, 8000); // Mistral handles large context well
    console.log(`[analyze-guidelines] Analyzing ${fileName} (${trimmed.length} chars) for user ${user.id}`);

    // ── AI Analysis via Mistral (json_object + schema in system prompt) ──
    const glSys = `You are an expert brand strategist. Analyze the brand guidelines document and extract structured brand data.
Return ONLY a valid JSON object with exactly this structure (no markdown, no backticks, no explanation):
{
  "brandName": "string — the brand or company name",
  "tone": {
    "formality": 7,
    "confidence": 8,
    "warmth": 5,
    "humor": 3
  },
  "vocabulary": {
    "approvedTerms": ["word1", "word2", "word3"],
    "forbiddenTerms": ["word1", "word2"],
    "brandSpecific": ["term1", "term2"]
  },
  "audiences": {
    "primary": "description of primary audience",
    "secondary": "description of secondary audience",
    "tertiary": "description of tertiary audience"
  },
  "compliance": {
    "regulations": "e.g. GDPR, CCPA or N/A",
    "legalDisclaimers": "any required disclaimers or N/A",
    "accessibility": "WCAG level or N/A"
  },
  "visual": {
    "primaryColors": ["#hex1", "#hex2"],
    "secondaryColors": ["#hex3"],
    "fonts": ["Font Name 1", "Font Name 2"]
  },
  "keyMessages": ["message1", "message2", "message3"]
}
Rules:
- Tone values are integers 1-10.
- Colors are hex codes (e.g. #3b4fc4).
- Never leave arrays empty if you can infer data from the document. Be thorough.
- Return ONLY the JSON object.`;

    const glUser = `Analyze brand guidelines from "${fileName}":\n\n${trimmed}`;

    const glModels = ["mistral-large-latest", "mistral-small-latest"];
    let parsed: any = null;
    for (const m of glModels) {
      if (parsed) break;
      try {
        console.log(`[analyze-guidelines] Trying ${m} via Mistral (json_object)...`);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 45_000);
        const r = await fetch(`${MISTRAL_BASE}/chat/completions`, {
          method: "POST", headers: mistralHeaders(),
          body: JSON.stringify({
            model: m,
            messages: [{ role: "system", content: glSys }, { role: "user", content: glUser }],
            max_tokens: 2000,
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!r.ok) { console.log(`[analyze-guidelines] ${m} ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
        const d = await r.json();
        const raw = d.choices?.[0]?.message?.content || "";
        if (!raw) { console.log(`[analyze-guidelines] ${m} returned empty`); continue; }
        const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(cleaned);
        console.log(`[analyze-guidelines] ${m} OK: brand=${parsed.brandName}`);
      } catch (e) { console.log(`[analyze-guidelines] ${m} failed: ${e}`); }
    }
    if (!parsed) return c.json({ success: false, error: "AI analysis failed. Try again." }, 500);

    console.log(`[analyze-guidelines] OK, brand: ${parsed.brandName}`);
    return c.json({ success: true, analysis: parsed });
  } catch (err) {
    console.log(`[analyze-guidelines] FATAL: ${err}`);
    return c.json({ success: false, error: `Analyze guidelines error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// BRAND DNA — Multi-page crawl via Jina + Mistral analysis
// ══════════════════════════════════════════════════════════════

const BRAND_DNA_SYSTEM = `Tu es un expert senior en branding et stratégie de marque.
Tu analyses des sites web et extrais des profils de marque ultra-précis et actionnables.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans explication.
Tes inférences sont toujours pertinentes — tu ne laisses jamais de champ vide.`;

const BRAND_DNA_USER_PROMPT = (url: string, title: string, desc: string, pagesCrawled: number, content: string) =>
`Analyse ce site et génère un Business DNA complet.

URL: ${url}
Titre: ${title}
Description: ${desc}
Pages analysées: ${pagesCrawled}

Contenu:
${content}

JSON attendu:
{
  "brand_name": "nom officiel",
  "tagline": "slogan principal ou chaîne vide",
  "industry": "secteur précis",
  "sub_industry": "sous-secteur ou niche",
  "founded": null,
  "company_size": "startup / PME / ETI / grand groupe",
  "target_audience": {
    "primary": "audience principale précise",
    "secondary": "audience secondaire ou null",
    "b2b": true,
    "b2c": false,
    "geographies": ["France"],
    "personas": ["persona 1", "persona 2"]
  },
  "tone_of_voice": {
    "primary": "ton principal",
    "adjectives": ["adj1", "adj2", "adj3", "adj4", "adj5"],
    "writing_style": "style rédactionnel",
    "language_level": "soutenu / courant / familier / technique",
    "avoid": ["éviter 1", "éviter 2"],
    "formality": 7,
    "confidence": 8,
    "warmth": 5,
    "humor": 3
  },
  "visual_identity": {
    "colors": {
      "primary": "#000000",
      "secondary": "#ffffff",
      "accent": "#000000",
      "background": "#ffffff",
      "text": "#000000"
    },
    "style": "style visuel",
    "imagery": "type d'images",
    "typography": "style typographique inféré"
  },
  "messaging": {
    "value_proposition": "proposition de valeur en 1 phrase",
    "key_messages": ["msg1", "msg2", "msg3", "msg4"],
    "proof_points": ["preuve1", "preuve2", "preuve3"],
    "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8"],
    "cta_style": "style et ton des CTA"
  },
  "channels": {
    "recommended": ["canal1", "canal2", "canal3"],
    "content_types": ["type1", "type2", "type3"],
    "posting_frequency": "recommandation fréquence"
  },
  "products_services": ["produit1", "produit2", "produit3"],
  "differentiators": ["diff1", "diff2", "diff3"],
  "competitive_positioning": "positionnement vs concurrents en 2 phrases",
  "brand_personality": "si cette marque était une personne...",
  "brand_archetype": "un des 12 archétypes Jungiens",
  "do_say": ["exemple copy on-brand 1", "exemple copy on-brand 2"],
  "dont_say": ["à éviter 1", "à éviter 2"],
  "compliance": {
    "regulations": "GDPR / autre",
    "has_privacy_policy": true,
    "has_accessibility": false
  },
  "social_profiles": ["https://linkedin.com/...", "https://twitter.com/..."],
  "confidence_score": 0.85,
  "confidence_notes": "explication courte"
}

Tone values (formality, confidence, warmth, humor) sont des entiers 1-10. Colors sont des codes hex. Retourne UNIQUEMENT le JSON.`;

// Helper: scrape a single page with Jina Reader (with metadata)
async function scrapeSinglePage(url: string, jinaKey: string): Promise<{ url: string; markdown: string; metadata: { title: string; description: string; ogImage: string; favicon: string } }> {
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${jinaKey}`,
      "Accept": "application/json",
      "X-No-Cache": "true",
      "X-Proxy": "auto",
      "X-Target-Selector": "body",
      "X-Token-Budget": "200000",
      "X-With-Generated-Alt": "true",
      "X-With-Images-Summary": "all",
    },
  }, 30_000);
  if (!res.ok) throw new Error(`Jina ${res.status}`);
  const data = await res.json();
  const d = data.data || data;
  return {
    url,
    markdown: d.content || d.text || "",
    metadata: {
      title: d.title || "",
      description: d.description || "",
      ogImage: d.images?.[0]?.src || "",
      favicon: d.favicon || "",
    },
  };
}

// Multi-page crawl: main page + key sub-pages in parallel
async function crawlForDNA(baseUrl: string, maxPages = 3): Promise<{
  markdown: string; metadata: any; pagesCrawled: number;
}> {
  const jinaKey = Deno.env.get("JINA_API_KEY");
  if (!jinaKey) {
    console.log("[brand-dna] No JINA_API_KEY, using direct scrape");
    const result = await scrapeUrl(baseUrl);
    return { markdown: result.content, metadata: { title: "", description: "", ogImage: "", favicon: "" }, pagesCrawled: 1 };
  }

  console.log(`[brand-dna] Crawling ${baseUrl}, max ${maxPages} pages via Jina`);

  let mainResult;
  try {
    mainResult = await scrapeSinglePage(baseUrl, jinaKey);
    console.log(`[brand-dna] Main page: ${mainResult.markdown.length} chars, title: "${mainResult.metadata.title}"`);
  } catch (e) {
    console.log(`[brand-dna] Jina main failed: ${e}, trying direct scrape`);
    const direct = await scrapeUrl(baseUrl);
    return { markdown: direct.content, metadata: { title: "", description: "", ogImage: "", favicon: "" }, pagesCrawled: 1 };
  }

  if (maxPages <= 1 || mainResult.markdown.length < 200) {
    return { markdown: mainResult.markdown.slice(0, 14000), metadata: mainResult.metadata, pagesCrawled: 1 };
  }

  const origin = new URL(baseUrl).origin;
  const subPaths = ["/about", "/a-propos", "/services", "/produits", "/products", "/qui-sommes-nous", "/brand", "/manifesto"];
  const subUrls = subPaths.slice(0, Math.min(maxPages - 1, 4)).map(p => `${origin}${p}`);

  const subResults = await Promise.allSettled(
    subUrls.map(u => scrapeSinglePage(u, jinaKey).catch(() => null))
  );

  let combined = `## PAGE: ${baseUrl}\n\n${mainResult.markdown}`;
  let crawled = 1;
  for (const r of subResults) {
    if (r.status === "fulfilled" && r.value && r.value.markdown.length > 200) {
      combined += `\n\n## PAGE: ${r.value.url}\n\n${r.value.markdown}`;
      crawled++;
      console.log(`[brand-dna] Sub-page OK: ${r.value.url} (${r.value.markdown.length} chars)`);
    }
  }

  console.log(`[brand-dna] Total: ${crawled} pages, ${combined.length} chars`);
  return { markdown: combined.slice(0, 14000), metadata: mainResult.metadata, pagesCrawled: crawled };
}

// Extract Brand DNA via Mistral
async function extractBrandDNA(content: string, url: string, metadata: any, pagesCrawled: number): Promise<any> {
  console.log(`[brand-dna] Calling Mistral for analysis (${content.length} chars)...`);
  const t0 = Date.now();

  const sysPrompt = BRAND_DNA_SYSTEM + `\n\nIMPORTANT: Return ONLY a raw JSON object. No markdown fences, no backticks, no explanation before or after.`;
  const userPrompt = BRAND_DNA_USER_PROMPT(url, metadata.title || "", metadata.description || "", pagesCrawled, content);

  const dnaModels = ["mistral-large-latest", "mistral-small-latest"];
  let lastError = "";

  for (const model of dnaModels) {
    try {
      console.log(`[brand-dna] Trying ${model}...`);
      const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
        method: "POST",
        headers: mistralHeaders(),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 3500,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      }, 60_000);

      if (!res.ok) {
        const errBody = (await res.text()).slice(0, 300);
        console.log(`[brand-dna] ${model} error ${res.status}: ${errBody}`);
        lastError = `${model} ${res.status}: ${errBody.slice(0, 100)}`;
        continue;
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      console.log(`[brand-dna] ${model} responded in ${Date.now() - t0}ms, ${raw.length} chars`);

      if (!raw) { lastError = `${model} returned empty`; continue; }

      // Clean potential markdown fences
      const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();

      try { return JSON.parse(cleaned); }
      catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        lastError = `${model} returned invalid JSON`;
        console.log(`[brand-dna] ${model} JSON parse failed, raw prefix: ${cleaned.slice(0, 100)}`);
        continue;
      }
    } catch (e: any) {
      lastError = `${model}: ${e.message || e}`;
      console.log(`[brand-dna] ${model} exception: ${lastError}`);
    }
  }

  throw new Error(`All Mistral models failed for Brand DNA. Last error: ${lastError}`);
}

// POST /vault/brand-dna — SYNCHRONOUS: crawl + analyze, return result in same request
// (Supabase Edge Functions kill background work after response via EarlyDrop)
app.post("/vault/brand-dna", async (c) => {
  const t0 = Date.now();
  console.log("[brand-dna] Handler entered (sync mode)");
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { url, force_refresh = false, max_pages = 3, forceRefresh = false, maxPages } = body;
    const doForce = force_refresh || forceRefresh;
    const pages = Math.min(maxPages ?? max_pages ?? 3, 5);

    const targetUrl = url;
    if (!targetUrl || typeof targetUrl !== "string") return c.json({ success: false, error: "URL required" }, 400);
    if (!isValidScrapeUrl(targetUrl)) return c.json({ success: false, error: "Invalid URL" }, 400);

    const normalizedDomain = new URL(targetUrl).origin;
    const cacheKey = `brand_dna:${user.id}:${btoa(normalizedDomain).slice(0, 40)}`;

    // Check cache (unless force refresh)
    if (!doForce) {
      try {
        const cached = await withTimeout(kv.get(cacheKey), 3_000, "kv.get brand_dna");
        if (cached) {
          console.log(`[brand-dna] Cache hit for ${normalizedDomain}`);
          return c.json({ success: true, status: "done", dna: cached, fromCache: true });
        }
      } catch {}
    }

    const canDeduct = await deductCredit(user.id, Math.min(pages, 5));
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits" }, 403);

    // Step 1: Crawl synchronously
    console.log(`[brand-dna] Crawling ${targetUrl} (${pages} pages)...`);
    const crawlResult = await crawlForDNA(targetUrl, pages);
    if (!crawlResult.markdown || crawlResult.markdown.length < 100) {
      return c.json({ success: false, error: "Insufficient content scraped. Site may be protected or empty." }, 400);
    }
    console.log(`[brand-dna] Crawl done: ${crawlResult.markdown.length} chars, ${crawlResult.pagesCrawled} pages (${Date.now() - t0}ms)`);

    // Step 2: AI analysis synchronously
    console.log(`[brand-dna] Analyzing with AI...`);
    const dna = await extractBrandDNA(crawlResult.markdown, targetUrl, crawlResult.metadata, crawlResult.pagesCrawled);

    const result = {
      ...dna,
      source_url: targetUrl,
      domain: normalizedDomain,
      analyzed_at: new Date().toISOString(),
      user_id: user.id,
      pages_crawled: crawlResult.pagesCrawled,
      logo_url: dna.logo_url || crawlResult.metadata.favicon || null,
      og_image: crawlResult.metadata.ogImage || null,
    };

    // Cache (fire-and-forget — response already carries data)
    kv.set(cacheKey, result).catch((e: any) => console.log(`[brand-dna] KV cache failed: ${e}`));

    console.log(`[brand-dna] DONE in ${Date.now() - t0}ms — brand: ${result.brand_name}`);
    return c.json({ success: true, status: "done", dna: result });

  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[brand-dna] ERROR: ${msg}`);
    return c.json({ success: false, error: `Brand DNA analysis failed: ${msg}` }, 500);
  }
});

// GET /vault/brand-dna/status — Poll job result
app.get("/vault/brand-dna/status", async (c) => {
  try {
    const user = await requireAuth(c);
    const jobId = c.req.query("jobId");
    if (!jobId) return c.json({ success: false, error: "jobId required" }, 400);

    const job = await withTimeout(kv.get(jobId), 3_000, "kv.get dna-job");
    if (!job) return c.json({ success: false, error: "Job not found" }, 404);
    if (job.userId !== user.id) return c.json({ success: false, error: "Forbidden" }, 403);

    return c.json({
      success: true,
      status: job.status,
      ...(job.status === "done" && { dna: job.dna }),
      ...(job.status === "error" && { error: job.error }),
    });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /vault/brand-dna — Retrieve cached DNA
app.get("/vault/brand-dna", async (c) => {
  try {
    const user = await requireAuth(c);
    const domain = c.req.query("domain");
    if (!domain) return c.json({ success: false, error: "domain required" }, 400);

    const cacheKey = `brand_dna:${user.id}:${btoa(domain).slice(0, 40)}`;
    const cached = await withTimeout(kv.get(cacheKey), 3_000, "kv.get brand_dna");
    if (cached) return c.json({ success: true, dna: cached });
    return c.json({ success: false, error: "No DNA found" }, 404);
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /vault/analyze-content — SYNCHRONOUS: analyze text content and return result
// (Supabase Edge Functions kill background work after response via EarlyDrop)
app.post("/vault/analyze-content", async (c) => {
  const t0 = Date.now();
  console.log("[analyze-content] Handler entered (sync mode)");
  try {
    const user = await requireAuth(c);
    const body = await c.req.json().catch(() => ({}));
    const content = body.content || body.text || "";
    const sourceName = body.sourceName || "document";
    const sourceType = body.sourceType || "document";

    if (!content || content.trim().length < 50) {
      return c.json({ success: false, error: "Content too short (min 50 chars). Please provide more text." }, 400);
    }

    const canDeduct = await deductCredit(user.id, 2);
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits" }, 403);

    const trimmed = content.slice(0, 14000);
    console.log(`[analyze-content] ${sourceType}:"${sourceName}" (${trimmed.length} chars) for ${user.id}`);

    // Synchronous AI analysis
    const metadata = { title: sourceName, description: `Brand document: ${sourceName}`, ogImage: "", favicon: "" };
    const dna = await extractBrandDNA(trimmed, `document://${sourceName}`, metadata, 1);

    const result = {
      ...dna,
      source_url: `document://${sourceName}`,
      source_type: sourceType,
      domain: sourceName,
      analyzed_at: new Date().toISOString(),
      user_id: user.id,
      pages_crawled: 1,
      logo_url: dna.logo_url || null,
      og_image: null,
    };

    // Cache (fire-and-forget — response carries data)
    const cacheKey = `brand_dna:${user.id}:${btoa(sourceName).slice(0, 40)}`;
    kv.set(cacheKey, result).catch((e: any) => console.log(`[analyze-content] cache failed: ${e}`));

    console.log(`[analyze-content] DONE in ${Date.now() - t0}ms — brand: ${result.brand_name}`);
    return c.json({ success: true, status: "done", dna: result });

  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[analyze-content] ERROR: ${msg}`);
    return c.json({ success: false, error: `Content analysis failed: ${msg}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════════════════════

app.get("/campaigns", async (c) => {
  try {
    const user = await requireAuth(c);
    const campaigns = await kv.getByPrefix(`campaign:${user.id}:`);
    return c.json({ success: true, campaigns: campaigns || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/campaigns", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const id = `campaign:${user.id}:${Date.now()}`;
    const campaign = { id, ...body, userId: user.id, createdAt: new Date().toISOString(), status: body.status || "draft" };
    await kv.set(id, campaign);
    return c.json({ success: true, campaign });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});