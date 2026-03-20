/**
 * ORA Studio — api/brand-dna.js
 * Crawl multi-pages via Firecrawl, analyse via Claude Anthropic,
 * retourne un Business DNA structuré + stocke dans Redis/Supabase.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseUserFromToken, getBearerToken } from "../server/auth.js";
import { redisGet, redisSet } from "../server/redis.js";

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const CACHE_TTL = 60 * 60 * 24 * 7;

function isSafeExternalUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const h = url.hostname.toLowerCase();
  const blocked = [/^localhost$/, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./, /^::1$/, /^0\.0\.0\.0$/];
  return !blocked.some((re) => re.test(h));
}

async function scrapePage(url) {
  const res = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ url, formats: ["markdown", "screenshot"], onlyMainContent: false, waitFor: 2000 }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape error ${res.status}`);
  const data = await res.json();
  return {
    url,
    markdown: data.data?.markdown ?? "",
    screenshot: data.data?.screenshot ?? null,
    pages_crawled: 1,
    metadata: {
      title: data.data?.metadata?.title ?? "",
      description: data.data?.metadata?.description ?? "",
      ogImage: data.data?.metadata?.ogImage ?? "",
      favicon: data.data?.metadata?.favicon ?? "",
    },
  };
}

async function crawlMultiPage(baseUrl, maxPages = 5) {
  const priorityPaths = ["/", "/about", "/a-propos", "/services", "/produits", "/products", "/brand", "/manifesto", "/qui-sommes-nous"];
  const origin = new URL(baseUrl).origin;

  const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    body: JSON.stringify({
      url: baseUrl,
      limit: maxPages,
      scrapeOptions: { formats: ["markdown"] },
      includePaths: priorityPaths.map((p) => `${origin}${p}`),
      excludePaths: ["*/blog/*", "*/news/*", "*/actualites/*", "*/careers/*", "*/jobs/*", "*/login/*", "*/signup/*", "*/cart/*", "*/checkout/*", "*.pdf", "*.xml"],
    }),
  });

  if (!crawlRes.ok) {
    console.warn("[brand-dna] Crawl failed, fallback to single page");
    return scrapePage(baseUrl);
  }

  const { id: jobId } = await crawlRes.json();
  let pages = [];

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`${FIRECRAWL_API}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    });
    const status = await statusRes.json();
    if (status.status === "completed") { pages = status.data ?? []; break; }
    if (status.status === "failed") break;
  }

  if (!pages.length) return scrapePage(baseUrl);

  const sorted = pages
    .filter((p) => (p.markdown?.length ?? 0) > 200)
    .sort((a, b) => {
      const score = (u) => priorityPaths.some((path) => { try { return new URL(u).pathname === path; } catch { return false; } }) ? 1 : 0;
      return score(b.metadata?.sourceURL ?? "") - score(a.metadata?.sourceURL ?? "");
    });

  const home = sorted[0] ?? pages[0];

  return {
    url: baseUrl,
    markdown: sorted.slice(0, maxPages).map((p) => `\n\n## PAGE: ${p.metadata?.sourceURL ?? ""}\n\n${p.markdown ?? ""}`).join("").slice(0, 14000),
    screenshot: home?.screenshot ?? null,
    pages_crawled: sorted.length,
    metadata: {
      title: home?.metadata?.title ?? "",
      description: home?.metadata?.description ?? "",
      ogImage: home?.metadata?.ogImage ?? "",
      favicon: home?.metadata?.favicon ?? "",
    },
  };
}

async function extractBrandDNA(crawlResult, targetUrl) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    system: `Tu es un expert senior en branding et stratégie de marque.
Tu analyses des sites web et extrais des profils de marque ultra-précis et actionnables.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans explication.
Tes inférences sont toujours pertinentes — tu ne laisses jamais de champ vide.`,
    messages: [{
      role: "user",
      content: `Analyse ce site et génère un Business DNA complet.

URL: ${targetUrl}
Titre: ${crawlResult.metadata.title}
Description: ${crawlResult.metadata.description}
Pages analysées: ${crawlResult.pages_crawled ?? 1}

Contenu:
${crawlResult.markdown}

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
    "avoid": ["éviter 1", "éviter 2"]
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
  "logo_url": "${crawlResult.metadata.favicon || ""}",
  "og_image": "${crawlResult.metadata.ogImage || ""}",
  "confidence_score": 0.85,
  "confidence_notes": "explication courte"
}`,
    }],
  });

  const raw = message.content[0]?.text ?? "";
  try { return JSON.parse(raw); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Claude n'a pas retourné un JSON valide");
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });
  const user = await getSupabaseUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  // ── GET : récupère un DNA existant
  if (req.method === "GET") {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: "domain requis" });
    const cacheKey = `brand_dna:${user.id}:${Buffer.from(domain).toString("base64").slice(0, 40)}`;
    try {
      const cached = await redisGet(cacheKey);
      if (cached) return res.status(200).json({ success: true, source: "cache", dna: JSON.parse(cached) });
    } catch {}
    return res.status(404).json({ error: "Aucun DNA trouvé pour ce domaine" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url, force_refresh = false, max_pages = 5 } = req.body ?? {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "URL requise" });
  if (!isSafeExternalUrl(url)) return res.status(400).json({ error: "URL invalide ou non autorisée" });

  const normalizedUrl = new URL(url).origin;
  const cacheKey = `brand_dna:${user.id}:${Buffer.from(normalizedUrl).toString("base64").slice(0, 40)}`;

  if (!force_refresh) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) return res.status(200).json({ success: true, source: "cache", dna: JSON.parse(cached) });
    } catch {}
  }

  try {
    const crawlResult = await crawlMultiPage(url, Math.min(max_pages, 10));

    if (!crawlResult.markdown || crawlResult.markdown.length < 100) {
      return res.status(422).json({ error: "Contenu insuffisant", details: "Site protégé ou vide" });
    }

    const dna = await extractBrandDNA(crawlResult, url);

    const result = {
      ...dna,
      source_url: url,
      domain: normalizedUrl,
      analyzed_at: new Date().toISOString(),
      user_id: user.id,
      screenshot_url: crawlResult.screenshot ?? null,
      pages_crawled: crawlResult.pages_crawled ?? 1,
    };

    await redisSet(cacheKey, JSON.stringify(result), CACHE_TTL);

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("brand_dna").upsert(
        { user_id: user.id, domain: normalizedUrl, dna: result, updated_at: new Date().toISOString() },
        { onConflict: "user_id,domain" }
      );
    } catch {}

    return res.status(200).json({ success: true, source: "fresh", dna: result });

  } catch (err) {
    console.error("[brand-dna] Error:", err);
    return res.status(500).json({ error: "Échec de l'analyse", details: err.message });
  }
}
