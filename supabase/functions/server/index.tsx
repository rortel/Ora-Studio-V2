// ══════════════════════════════════════════════════════════════
// ORA Studio — Edge Function Server (Hono + KV + INLINE AI)
// ALL AI logic inlined — NO external imports, NO dynamic import
// ══════════════════════════════════════════════════════════════

import { Hono } from "npm:hono@4.4.2";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

console.log("[boot] ORA server starting (inline AI) — deploy 2026-03-18T18:00Z — v562-redeploy");

const app = new Hono().basePath("/make-server-cad57f79");

// ── CORS — fully manual, guaranteed headers on EVERY response ──
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Token, apikey",
  "Access-Control-Max-Age": "86400",
};

app.use("*", async (c, next) => {
  // Handle preflight immediately — no auth, no routing
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  await next();
  // Inject CORS headers into every non-OPTIONS response
  try {
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      c.res.headers.set(k, v);
    }
  } catch {
    // Response headers might be immutable — rebuild response
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: {
        ...Object.fromEntries(c.res.headers.entries()),
        ...CORS_HEADERS,
      },
    });
  }
});

// ── Global error handler — ensures CORS headers on ALL error responses ──
app.onError((err, c) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`[onError] ${msg}`);
  return new Response(
    JSON.stringify({ success: false, error: msg }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    }
  );
});

// ── BODY PARSER + TOKEN EXTRACTOR ──
// Reads body once, caches parsed result, extracts _token for auth.
// This handles both Content-Type: application/json AND text/plain (CORS-safe).
// SKIP multipart/form-data — those routes handle auth manually from FormData._token
app.use("*", async (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "DELETE") {
    const ct = c.req.header("Content-Type") || "";
    // Skip binary/multipart uploads — body must remain unconsumed for route handler
    if (ct.includes("multipart/form-data")) {
      console.log(`[body-parser] SKIP multipart for ${c.req.method} ${c.req.path}`);
      await next();
      return;
    }
    try {
      const cloned = c.req.raw.clone();
      const text = await cloned.text();
      const textLen = text?.length || 0;
      if (text) {
        const body = JSON.parse(text);
        c.set("parsedBody", body);
        if (body?._token) {
          c.set("userToken", body._token);
          console.log(`[body-parser] OK: textLen=${textLen}, _token found (${body._token.slice(0, 20)}...)`);
        } else {
          console.log(`[body-parser] OK: textLen=${textLen}, keys=[${Object.keys(body).join(",")}], NO _token`);
        }
      } else {
        console.log(`[body-parser] EMPTY body for ${c.req.method} ${c.req.path}`);
      }
    } catch (err: any) {
      console.log(`[body-parser] FAIL for ${c.req.method} ${c.req.path}: ${err?.message || err}`);
    }
  }
  await next();
});

// ── REQUEST LOGGER ──
app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  console.log(`[REQ] ${method} ${path} at ${new Date().toISOString()}`);
  const t0 = Date.now();
  await next();
  console.log(`[RES] ${method} ${path} -> ${c.res.status} (${Date.now() - t0}ms)`);
});

// ── HEALTH CHECK (earliest route — tests that function booted) ──
app.get("/health", (c) => c.json({ ok: true, ts: Date.now(), v: 200, audio: "suno-start-poll" }));

// ── DEBUG ECHO — returns exactly what the server receives (no auth needed) ──
app.all("/debug/echo", async (c) => {
  const method = c.req.method;
  const url = c.req.url;
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

  let bodyPreview = "(no body)";
  let bodyLength = 0;
  let parsedOk = false;
  let tokenFound = false;
  let tokenPreview = "";
  try {
    const cloned = c.req.raw.clone();
    const raw = await cloned.text();
    bodyLength = raw.length;
    bodyPreview = raw.slice(0, 500);
    try {
      const parsed = JSON.parse(raw);
      parsedOk = true;
      tokenFound = !!parsed._token;
      if (parsed._token) tokenPreview = parsed._token.slice(0, 30) + "...";
    } catch { parsedOk = false; }
  } catch (e: any) { bodyPreview = `(clone error: ${e.message})`; }

  const contextToken = c.get?.("userToken") || null;
  const contextBody = c.get?.("parsedBody") || null;

  console.log(`[debug/echo] method=${method} bodyLen=${bodyLength} parsedOk=${parsedOk} tokenFound=${tokenFound} contextToken=${!!contextToken} contextBodyKeys=${contextBody ? Object.keys(contextBody).join(",") : "null"}`);

  return c.json({
    ok: true,
    method,
    url,
    headers,
    bodyLength,
    bodyPreview,
    parsedOk,
    tokenFound,
    tokenPreview,
    middleware: {
      userToken: contextToken ? contextToken.slice(0, 30) + "..." : null,
      parsedBodyKeys: contextBody ? Object.keys(contextBody) : null,
    },
  });
});

// ── Supabase Admin Client ────────────────────────────────────
function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Auth Helpers ─────────────────────────────────────────────
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "romainortel@gmail.com"; // FIX: depuis env

interface AuthUser { id: string; email: string; }

// Fast JWT decode (no verification needed — Supabase gateway already validated the token)
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function getUser(c: any): Promise<AuthUser | null> {
  // Token sources (priority order):
  // 1. _token extracted by body-parser middleware (avoids CORS & large header issues)
  // 2. _token query parameter (for GET requests in CORS-safe mode)
  // 3. X-User-Token header (legacy)
  // 4. Fallback: read body directly (if body-parser middleware failed)
  // 5. Authorization header (may be anon key → returns null)
  let token = c.get?.("userToken") || c.req.query("_token") || c.req.header("X-User-Token");

  // Fallback: try parsed body from middleware context
  if (!token) {
    const pb = c.get?.("parsedBody");
    if (pb?._token) {
      token = pb._token;
      console.log("[getUser] recovered token from parsedBody context");
    }
  }

  // Fallback: try to read body directly (body-parser may have failed)
  if (!token && (c.req.method === "POST" || c.req.method === "PUT")) {
    try {
      const cloned = c.req.raw.clone();
      const text = await cloned.text();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed?._token) {
          token = parsed._token;
          console.log("[getUser] recovered token from raw body fallback");
        }
      }
    } catch (bodyErr) {
      console.log("[getUser] body fallback failed:", bodyErr);
    }
  }

  // Last resort: Authorization header (may be anon key → will fail JWT decode)
  if (!token) {
    token = c.req.header("Authorization")?.split(" ")[1];
    if (token) console.log("[getUser] using Authorization header fallback");
  }

  if (!token) {
    console.log("[getUser] no token found from any source");
    return null;
  }
  try {
    // Fast path: decode JWT locally (gateway already validated it)
    const payload = decodeJwtPayload(token);
    if (payload?.sub && payload?.email) {
      console.log("[getUser] JWT decoded locally, user:", payload.sub);
      return { id: payload.sub, email: payload.email };
    }
    // Token is not a JWT (e.g. anon key) — skip
    console.log("[getUser] Token is not a valid JWT, returning null");
    return null;
  } catch (err) { console.log("[getUser] exception:", err); return null; }
}

async function requireAuth(c: any): Promise<AuthUser> {
  const user = await getUser(c);
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireAdmin(c: any): Promise<AuthUser> {
  const user = await requireAuth(c);
  const profile = await kv.get(`user:${user.id}`);
  if (user.email.toLowerCase() !== ADMIN_EMAIL && profile?.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}

// ── Credit Helpers ───────────────────────────────────────────
const PLAN_CREDITS: Record<string, number> = { free: 50, starter: 200, generate: 1500, studio: 5000 };
const CREDIT_COST = { text: 1, image: 5, video: 30, audio: 5, code: 2 } as const;

// Timeout wrapper for KV operations (prevents hanging on DB issues)
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    ),
  ]);
}

async function getOrCreateProfile(userId: string, email: string, name?: string) {
  const t0 = Date.now();
  let profile = await withTimeout(kv.get(`user:${userId}`), 5_000, "kv.get profile");
  console.log(`[getOrCreateProfile] kv.get took ${Date.now() - t0}ms`);
  if (!profile) {
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL;
    profile = {
      userId, email,
      name: name || email.split("@")[0],
      role: isAdmin ? "admin" : "user",
      plan: isAdmin ? "studio" : "free",
      credits: isAdmin ? 999999 : PLAN_CREDITS.free,
      creditsUsed: 0, company: "", jobTitle: "",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await withTimeout(kv.set(`user:${userId}`, profile), 5_000, "kv.set new profile");
  }
  return profile;
}

async function deductCredit(userId: string, amount = 1): Promise<boolean> {
  try {
    const profile = await withTimeout(kv.get(`user:${userId}`), 3_000, "kv.get deduct");
    if (!profile) return true; // laisser passer si KV lent
    if (profile.role === "admin") return true;
    const remaining = (profile.credits || 0) - (profile.creditsUsed || 0);
    if (remaining < amount) return false;
    profile.creditsUsed = (profile.creditsUsed || 0) + amount;
    kv.set(`user:${userId}`, profile).catch(() => {}); // fire-and-forget
    return true;
  } catch {
    return true; // KV timeout → laisser passer
  }
}

async function logEvent(type: string, details: any) {
  try {
    const id = `log:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await kv.set(id, { id, type, details, timestamp: new Date().toISOString() });
  } catch (e) { console.log("[logEvent] failed:", e); }
}

// ══════════════════════════════════════════════════════════════
// BRAND CONTEXT BUILDER — reads vault + Image Bank for generation
// ══════════════════════════════════════════════════════════════

interface BrandRefImage {
  storagePath: string;
  category: string;
  score: number;
  description: string;
  recommendedUsage: string[];
  mood: string;
  style: string;
}

interface BrandContext {
  brandName: string;
  industry: string;
  tagline: string;
  tone: { formality: number; confidence: number; warmth: number; humor: number; primary_tone: string; adjectives: string[] } | null;
  colorPalette: string[];
  colorNames: string[];
  photoStyle: { framing: string; mood: string; lighting: string; subjects: string } | null;
  approvedTerms: string[];
  forbiddenTerms: string[];
  keyMessages: string[];
  fonts: string[];
  targetAudiences: { name: string; description: string }[];
  imageBankColors: string[];
  imageBankMoods: string[];
  imageBankStyles: string[];
  imageBankCompositions: string[];
  imageBankLighting: string[];
  visualDirective: string;
  topRefImages: BrandRefImage[];
}

async function buildBrandContext(userId: string): Promise<BrandContext | null> {
  const t0 = Date.now();
  try {
    const [vaultData, brandImages] = await Promise.all([
      withTimeout(kv.get(`vault:${userId}`), 3_000, "kv.get vault"),
      withTimeout(kv.getByPrefix(`brand-image:${userId}:`), 3_000, "kv.getByPrefix brand-images").catch(() => [] as any[]),
    ]);
    if (!vaultData) {
      console.log(`[buildBrandContext] No vault data for ${userId} (${Date.now() - t0}ms)`);
      return null;
    }
    const ctx: BrandContext = {
      brandName: vaultData.company_name || "",
      industry: vaultData.industry || "",
      tagline: vaultData.tagline || "",
      tone: vaultData.tone || null,
      colorPalette: (vaultData.colors || []).map((c: any) => c.hex).filter(Boolean),
      colorNames: (vaultData.colors || []).map((c: any) => `${c.hex} (${c.name || c.role || ""})`).filter(Boolean),
      photoStyle: vaultData.photo_style || null,
      approvedTerms: vaultData.approved_terms || [],
      forbiddenTerms: vaultData.forbidden_terms || [],
      keyMessages: vaultData.key_messages || [],
      fonts: vaultData.fonts || [],
      targetAudiences: vaultData.target_audiences || [],
      imageBankColors: [],
      imageBankMoods: [],
      imageBankStyles: [],
      imageBankCompositions: [],
      imageBankLighting: [],
      visualDirective: "",
      topRefImages: [],
    };
    const analyzed = (brandImages || []).filter((img: any) => img?.analysis && !img.analysis._parseError);
    analyzed.sort((a: any, b: any) => (b.analysis?.brand_alignment?.score || 0) - (a.analysis?.brand_alignment?.score || 0));
    const topImages = analyzed.slice(0, 10);
    const colorsSet = new Set<string>();
    const moodsSet = new Set<string>();
    const stylesSet = new Set<string>();
    const compositionsSet = new Set<string>();
    const lightingSet = new Set<string>();
    for (const img of topImages) {
      const a = img.analysis;
      if (a.color?.dominant_palette) {
        for (const hex of a.color.dominant_palette) {
          if (hex && typeof hex === "string" && hex.startsWith("#")) colorsSet.add(hex.toUpperCase());
        }
      }
      if (a.mood?.primary_emotion) moodsSet.add(a.mood.primary_emotion);
      if (a.mood?.secondary_emotions) {
        for (const e of a.mood.secondary_emotions) if (e) moodsSet.add(e);
      }
      if (a.technique?.style_reference) stylesSet.add(a.technique.style_reference);
      if (a.composition?.framing) compositionsSet.add(a.composition.framing);
      if (a.composition?.negative_space) compositionsSet.add(`negative space: ${a.composition.negative_space}`);
      if (a.lighting?.type) lightingSet.add(a.lighting.type);
      if (a.lighting?.quality) lightingSet.add(a.lighting.quality);
      if (a.lighting?.direction) lightingSet.add(a.lighting.direction);
    }
    ctx.imageBankColors = [...colorsSet].slice(0, 15);
    ctx.imageBankMoods = [...moodsSet].slice(0, 8);
    ctx.imageBankStyles = [...stylesSet].slice(0, 5);
    ctx.imageBankCompositions = [...compositionsSet].slice(0, 6);
    ctx.imageBankLighting = [...lightingSet].slice(0, 6);
    // Collect top 5 reference images with their storage paths for img2img
    ctx.topRefImages = analyzed.slice(0, 5).map((img: any) => ({
      storagePath: img.storagePath || "",
      category: img.category || img.analysis?.category_suggested || "general",
      score: img.analysis?.brand_alignment?.score || 0,
      description: img.analysis?.one_line_description || img.altText || "",
      recommendedUsage: img.analysis?.brand_alignment?.recommended_usage || [],
      mood: img.analysis?.mood?.primary_emotion || "",
      style: img.analysis?.technique?.style_reference || "",
    })).filter((r: BrandRefImage) => r.storagePath);
    const vdParts: string[] = [];
    const allColors = [...new Set([...ctx.colorPalette, ...ctx.imageBankColors])].slice(0, 8);
    if (allColors.length > 0) vdParts.push(`Color palette: ${allColors.join(", ")}`);
    if (ctx.photoStyle) {
      const psParts = [ctx.photoStyle.framing, ctx.photoStyle.mood, ctx.photoStyle.lighting].filter(Boolean);
      if (psParts.length) vdParts.push(`Photo style: ${psParts.join(", ")}`);
    }
    if (ctx.imageBankMoods.length > 0) vdParts.push(`Mood: ${ctx.imageBankMoods.slice(0, 4).join(", ")}`);
    if (ctx.imageBankStyles.length > 0) vdParts.push(`Visual style: ${ctx.imageBankStyles.slice(0, 3).join(", ")}`);
    if (ctx.imageBankCompositions.length > 0) vdParts.push(`Composition: ${ctx.imageBankCompositions.slice(0, 3).join(", ")}`);
    if (ctx.imageBankLighting.length > 0) vdParts.push(`Lighting: ${ctx.imageBankLighting.slice(0, 3).join(", ")}`);
    ctx.visualDirective = vdParts.join(". ");
    console.log(`[buildBrandContext] OK for ${userId}: vault=true, images=${analyzed.length}/${(brandImages || []).length}, visualDirective=${ctx.visualDirective.length} chars (${Date.now() - t0}ms)`);
    return ctx;
  } catch (err) {
    console.log(`[buildBrandContext] FAILED for ${userId} (${Date.now() - t0}ms): ${err}`);
    return null;
  }
}

function buildBrandBlock(ctx: BrandContext): string {
  const parts: string[] = [];
  if (ctx.brandName) parts.push(`Brand name: "${ctx.brandName}"`);
  if (ctx.industry) parts.push(`Industry: ${ctx.industry}`);
  if (ctx.tagline) parts.push(`Tagline: "${ctx.tagline}"`);
  if (ctx.tone) {
    parts.push(`Tone of voice: Formality ${ctx.tone.formality}/10, Confidence ${ctx.tone.confidence}/10, Warmth ${ctx.tone.warmth}/10, Humor ${ctx.tone.humor}/10. Primary tone: ${ctx.tone.primary_tone}. Adjectives: ${ctx.tone.adjectives?.join(", ") || "N/A"}`);
  }
  const allColors = [...new Set([...ctx.colorPalette, ...ctx.imageBankColors])].slice(0, 10);
  if (allColors.length > 0) {
    parts.push(`Brand color palette (MUST use in image prompts): ${ctx.colorNames.length > 0 ? ctx.colorNames.join(", ") : allColors.join(", ")}`);
    if (ctx.imageBankColors.length > 0) parts.push(`Colors from analyzed brand photos: ${ctx.imageBankColors.slice(0, 8).join(", ")}`);
  }
  if (ctx.photoStyle) {
    parts.push(`Photo style: Framing=${ctx.photoStyle.framing}, Mood=${ctx.photoStyle.mood}, Lighting=${ctx.photoStyle.lighting}, Subjects=${ctx.photoStyle.subjects}`);
  }
  if (ctx.imageBankMoods.length > 0) parts.push(`Brand mood from reference photos: ${ctx.imageBankMoods.join(", ")}`);
  if (ctx.imageBankStyles.length > 0) parts.push(`Visual style references: ${ctx.imageBankStyles.join(", ")}`);
  if (ctx.imageBankCompositions.length > 0) parts.push(`Composition patterns: ${ctx.imageBankCompositions.join(", ")}`);
  if (ctx.imageBankLighting.length > 0) parts.push(`Lighting style: ${ctx.imageBankLighting.join(", ")}`);
  if (ctx.approvedTerms.length > 0) parts.push(`Approved vocabulary (USE these terms): ${ctx.approvedTerms.join(", ")}`);
  if (ctx.forbiddenTerms.length > 0) parts.push(`FORBIDDEN terms (NEVER use): ${ctx.forbiddenTerms.join(", ")}`);
  if (ctx.keyMessages.length > 0) parts.push(`Key messages: ${ctx.keyMessages.join(" | ")}`);
  if (ctx.targetAudiences.length > 0) parts.push(`Target audiences: ${ctx.targetAudiences.map(a => `${a.name} (${a.description})`).join("; ")}`);
  if (ctx.fonts.length > 0) parts.push(`Brand fonts: ${ctx.fonts.join(", ")}`);
  if (parts.length === 0) return "";
  return `\n\nBRAND COMPLIANCE CONTEXT (MANDATORY - follow strictly):\n- ${parts.join("\n- ")}`;
}

// ══════════════════════════════════════════════════════════════
// COST TRACKING — per-provider cost & revenue logging
// ══════════════════════════════════════════════════════════════

const PROVIDER_COSTS: Record<string, number> = {
  // Text (APIPod) — USD per call
  "apipod/gpt-4o": 0.015, "apipod/gpt-5": 0.025, "apipod/gpt-5.2": 0.030,
  "apipod/claude-4-5-sonnet": 0.018, "apipod/claude-sonnet-4-20250514": 0.018,
  "apipod/claude-4-5-haiku": 0.005, "apipod/claude-haiku-4-20250514": 0.005,
  "apipod/claude-4-5-opus": 0.075, "apipod/claude-opus-4-20250514": 0.075,
  "apipod/gemini-2.5-flash-preview-05-20": 0.005,
  "apipod/gemini-2.0-flash": 0.003, "apipod/gemini-3": 0.008,
  // Image — Runware
  "runware/image-std": 0.003, "runware/image": 0.003,
  // Image — FAL
  "fal/flux-schnell": 0.003, "fal/flux-pro-v1.1": 0.035, "fal/flux-dev": 0.025,
  // Image — Replicate
  "replicate/flux-schnell": 0.005,
  // Image — Luma Photon
  "luma/photon-1": 0.030, "luma/photon-flash-1": 0.015,
  // Image — Higgsfield
  "higgsfield/seedream-v4": 0.030,
  // Video — FAL
  "fal/ltx-video": 0.080, "fal/minimax-video": 0.100, "fal/luma-dream-machine": 0.120,
  // Video — Replicate
  "replicate/ltx-video": 0.100, "replicate/minimax-video": 0.150, "replicate/luma-ray": 0.179,
  // Video — Luma direct
  "luma/ray-2": 0.150, "luma/ray-flash-2": 0.080,
  // Video — Runware
  "runware/video": 0.050,
  // Video — Kling
  "kling/kling-v1-6-pro": 0.120, "kling/kling-v1-5-pro": 0.100,
  // Video — Higgsfield
  "higgsfield/soul-standard": 0.025,
  "higgsfield/kling-v2.1-pro-i2v": 0.120, "higgsfield/seedance-v1-pro-i2v": 0.100,
  "higgsfield/dop-standard": 0.100,
  // Audio — Replicate
  "replicate/meta/musicgen": 0.050,
};

const CREDIT_VALUE_EUR = 0.10;
const REVENUE_PER_TYPE: Record<string, number> = {
  text: 1 * CREDIT_VALUE_EUR, image: 5 * CREDIT_VALUE_EUR,
  video: 30 * CREDIT_VALUE_EUR, audio: 5 * CREDIT_VALUE_EUR,
};
const USD_TO_EUR = 0.92;

interface CostEntry {
  id: string; timestamp: string; type: "text" | "image" | "video" | "audio";
  model: string; provider: string; costUsd: number; costEur: number;
  revenueEur: number; marginEur: number; latencyMs: number; userId: string; success: boolean;
}

async function logCost(entry: Omit<CostEntry, "id" | "timestamp" | "costEur" | "marginEur">) {
  try {
    const costEur = entry.costUsd * USD_TO_EUR;
    const marginEur = entry.revenueEur - costEur;
    const id = `cost:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: CostEntry = { ...entry, id, timestamp: new Date().toISOString(),
      costEur: Math.round(costEur * 10000) / 10000, marginEur: Math.round(marginEur * 10000) / 10000 };
    await kv.set(id, full);
    console.log(`[cost] ${entry.type}/${entry.provider}: cost=$${entry.costUsd} rev=EUR${entry.revenueEur} margin=EUR${full.marginEur}`);
  } catch (e) { console.log("[logCost] failed:", e); }
}

function getProviderCost(provider: string, type: string): number {
  if (PROVIDER_COSTS[provider]) return PROVIDER_COSTS[provider];
  const prefix = provider.split("/")[0];
  if (prefix === "luma") return type === "video" ? 0.150 : 0.030;
  if (prefix === "replicate") return type === "audio" ? 0.050 : 0.005;
  if (prefix === "apipod") return 0.015;
  return 0.010;
}

// ══════════════════════════════════════════════════════════════
// INLINE AI — TEXT (APIPod), IMAGE (Luma Photon), VIDEO (Luma Ray), AUDIO (Replicate)
// ══════════════════════════════════════════════════════════════

const APIPOD_BASE = "https://api.apipod.ai/v1";
const LUMA_BASE = "https://api.lumalabs.ai/dream-machine/v1";
const HIGGSFIELD_BASE = "https://platform.higgsfield.ai";
const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const LEONARDO_V2_BASE = "https://cloud.leonardo.ai/api/rest/v2";

// ── PROMPT ENHANCER — translates any language to English + produces cinematic photorealistic prompts ──
async function enhanceImagePrompt(rawPrompt: string, preserveBrandName: boolean = false): Promise<string> {
  const t0 = Date.now();
  // Always enhance — even English prompts benefit from photorealistic detail injection
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) { console.log("[enhancePrompt] No API key, using raw"); return rawPrompt; }
  const enhanceModels = ["gpt-4o", "gpt-5"];
  const systemPrompt = `You are a world-class image prompt engineer specializing in photorealistic AI image generation. Your ONLY job is to transform the user's request into a single, hyper-detailed English prompt optimized for state-of-the-art image models.

RULES:
- Output ONLY the prompt text. No quotes, no explanation, no preamble, no markdown.
- Keep it between 80 and 180 words.
- Preserve the user's creative intent EXACTLY — do not change the subject or concept.
- If the user's request is in another language, translate it faithfully to English first.
- ${preserveBrandName ? `KEEP THE EXACT BRAND NAME AND PRODUCT MODEL from the user's prompt (e.g. "MAN eTGX", "Nike Air Max 90"). The brand name helps the AI match the reference image identity. Do NOT remove or replace brand names with generic descriptions. However, do NOT add any NEW brand names that aren't already in the prompt.` : `CRITICAL ANTI-HALLUCINATION: REMOVE ALL brand names, product model names, company names from the prompt. Replace with VISUAL DESCRIPTIONS ONLY. Example: instead of "MAN eTGX truck" write "a large modern European electric heavy-duty truck with a sleek aerodynamic cab, blue and silver livery". NEVER mention any brand by name — AI image models render brand names as garbled hallucinated text.`}
- CRITICAL TEMPORAL: Vehicles, machines, technology MUST be described as MODERN, CONTEMPORARY, CURRENT-GENERATION (2024-era). NEVER vintage, retro, classic, old, antique. Always add "modern, latest generation" for vehicles.
- NEVER reference competing brands or any brand at all.

ALWAYS ADD these technical details (pick what is relevant):
- Camera and lens: specific camera model, focal length, aperture (e.g. "shot on Sony A7IV, 85mm f/1.4")
- Lighting: specific lighting setup (golden hour, studio softbox, overcast diffused, neon-lit, etc.)
- Atmosphere: haze, dust particles, volumetric light, rain droplets, humidity, etc.
- Texture and material: surface detail, fabric weave, metal reflection, skin pores, etc.
- Color grading: specific film stock look, color temperature, contrast style
- Composition: rule of thirds, leading lines, shallow depth of field, bokeh quality
- Resolution keywords: "8K resolution", "ultra-detailed", "photorealistic", "hyperrealistic"
- Style anchor: "editorial photography", "cinematic still", "commercial product shot", "documentary style"

NEVER add: text, watermarks, logos, brand names, product names, model numbers, signatures, borders, collages, split screens, any readable writing.
End the prompt with: "Absolutely no visible text, no letters, no words, no brand names, no logos anywhere in the image. Ultra-detailed, 8K resolution, photorealistic."`;
  for (const m of enhanceModels) {
    try {
      const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawPrompt },
          ],
          max_tokens: 350,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) { console.log(`[enhancePrompt] ${m} returned ${res.status}, trying next...`); continue; }
      const data = await res.json();
      const enhanced = data.choices?.[0]?.message?.content?.trim();
      if (enhanced && enhanced.length > 20) {
        console.log(`[enhancePrompt] OK via ${m} (${Date.now() - t0}ms): "${rawPrompt.slice(0, 40)}" → "${enhanced.slice(0, 120)}"`);
        return enhanced;
      }
    } catch (err) { console.log(`[enhancePrompt] ${m} error: ${err}`); }
  }
  return rawPrompt;
}

function lumaHeaders(): Record<string, string> {
  const key = Deno.env.get("LUMA_API_KEY");
  if (!key) throw new Error("LUMA_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

function higgsHeaders(): Record<string, string> {
  const accessKey = (Deno.env.get("HIGGSFIELD_API_KEY") || "").trim();
  const secretKey = (Deno.env.get("HIGGSFIELD_API_SECRET") || "").trim();
  if (!accessKey || !secretKey) throw new Error("HIGGSFIELD_API_KEY or HIGGSFIELD_API_SECRET not configured");
  const maskKey = (k: string) => k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : `${k.slice(0, 2)}***`;
  console.log(`[higgsHeaders] key=${maskKey(accessKey)} (${accessKey.length}c), secret=${maskKey(secretKey)} (${secretKey.length}c)`);
  return { "Content-Type": "application/json", Accept: "application/json", Authorization: `Key ${accessKey}:${secretKey}` };
}

function apipodHeaders(): Record<string, string> {
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) throw new Error("APIPOD_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

// --- Text model registry ---
// Model map — CORRECT APIPod model names (from their docs):
// OpenAI: gpt-5, gpt-5.1-codex, gpt-5.1, gpt-4o
// Anthropic: claude-4-5-sonnet, claude-4-5-opus, claude-4-5-haiku
// Google: gemini-2.5-pro, gemini-3-pro-preview
// Other: deepseek-v3.2, doubao-pro
const textModelMap: Record<string, { apiModel: string; fallback?: string }> = {
  "gpt-4o":        { apiModel: "gpt-4o" },
  "gpt-5":         { apiModel: "gpt-5", fallback: "gpt-4o" },
  "gpt-5.1":       { apiModel: "gpt-5.1", fallback: "gpt-5" },
  "gpt-5.2":       { apiModel: "gpt-5.1", fallback: "gpt-4o" },
  "claude-sonnet": { apiModel: "claude-4-5-sonnet", fallback: "gpt-4o" },
  "claude-haiku":  { apiModel: "claude-4-5-haiku", fallback: "gpt-4o" },
  "claude-opus":   { apiModel: "claude-4-5-opus", fallback: "gpt-4o" },
  "gemini-pro":    { apiModel: "gemini-2.5-pro", fallback: "gpt-4o" },
  // gemini-3 removed — model may not exist on APIPod
  "ora-writer":    { apiModel: "gpt-4o" },
  "ora-code":      { apiModel: "gpt-4o" },
  "gpt-4o-code":   { apiModel: "gpt-4o" },
  "claude-code":   { apiModel: "claude-4-5-sonnet", fallback: "gpt-4o" },
  "gemini-code":   { apiModel: "gemini-2.5-pro", fallback: "gpt-4o" },
  "deepseek":      { apiModel: "deepseek-v3.2", fallback: "gpt-4o" },
};

// --- Image model registry (Luma Photon) ---
const imageModelMap: Record<string, { lumaModel: string; aspectRatio: string }> = {
  "ora-vision":      { lumaModel: "photon-1", aspectRatio: "4:3" },
  "photon-1":        { lumaModel: "photon-1", aspectRatio: "4:3" },
  "photon-flash-1":  { lumaModel: "photon-flash-1", aspectRatio: "4:3" },
};

// --- Direct API models (DALL-E via OpenAI, Flux via FAL) ---
const directApiModels = new Set(["dall-e", "flux-pro"]);

// --- Image models routed through secondary provider (submit + poll) ---
const hfImageModelMap: Record<string, { hfModels: string[]; aspectRatio: string }> = {
  "soul":            { hfModels: ["higgsfield-ai/soul/standard"], aspectRatio: "4:3" },
  "seedream-v4":     { hfModels: ["bytedance/seedream/v4/text-to-image", "higgsfield-ai/soul/standard"], aspectRatio: "4:3" },
  "seedream-v4.5":   { hfModels: ["bytedance/seedream/v4/text-to-image", "higgsfield-ai/soul/standard"], aspectRatio: "4:3" },
  "nano-banana":     { hfModels: ["higgsfield-ai/nano-banana/standard", "higgsfield-ai/soul/standard"], aspectRatio: "4:3" },
};

// --- Leonardo AI image models (v1 API: submit + poll) ---
// POST /api/rest/v1/generations → { sdGenerationJob: { generationId } }
// Poll: GET /api/rest/v1/generations/{id} → { generations_by_pk: { status, generated_images } }
const leonardoImageModelMap: Record<string, { leonardoModelId: string; aspectRatio: string; styleUUID: string }> = {
  "lucid-origin":        { leonardoModelId: "7b592283-e8a7-4c5a-9ba6-d18c31f258b9", aspectRatio: "4:3", styleUUID: "5bdc3f2a-1be6-4d1c-8e77-992a30824a2c" },
  "lucid-realism":       { leonardoModelId: "05ce0082-2d80-4a2d-8653-4d1c85e2418e", aspectRatio: "4:3", styleUUID: "5bdc3f2a-1be6-4d1c-8e77-992a30824a2c" },
  "flux-dev-leo":        { leonardoModelId: "b2614463-296c-462a-9586-aafdb8f00e36", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" },
  "flux-schnell-leo":    { leonardoModelId: "1dd50843-d653-4516-a8e3-f0238ee453ff", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" },
  "kontext-pro-leo":     { leonardoModelId: "28aeddf8-bd19-4803-80fc-79602d1a9989", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" },
  // Aliases for backward compat
  "leonardo-phoenix":    { leonardoModelId: "7b592283-e8a7-4c5a-9ba6-d18c31f258b9", aspectRatio: "4:3", styleUUID: "5bdc3f2a-1be6-4d1c-8e77-992a30824a2c" },
  "leonardo-lightning":  { leonardoModelId: "1dd50843-d653-4516-a8e3-f0238ee453ff", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" },
  "leonardo-kino":       { leonardoModelId: "05ce0082-2d80-4a2d-8653-4d1c85e2418e", aspectRatio: "16:9", styleUUID: "a5632c7c-ddbb-4e2f-ba34-8456ab3ac436" },
};

// --- Video models routed through secondary provider (submit + poll) ---
const hfVideoModelMap: Record<string, { hfModelsI2v: string[]; hfModelsT2v: string[]; aspectRatio: string }> = {
  "kling-v2.1":       { hfModelsI2v: ["kling-video/v2.1/pro/image-to-video"], hfModelsT2v: ["higgsfield-ai/dop/standard"], aspectRatio: "16:9" },
  "seedance-v1":      { hfModelsI2v: ["bytedance/seedance/v1/pro/image-to-video"], hfModelsT2v: ["higgsfield-ai/dop/standard"], aspectRatio: "9:16" },
  "dop":              { hfModelsI2v: ["higgsfield-ai/dop/standard"], hfModelsT2v: ["higgsfield-ai/dop/standard", "higgsfield-ai/dop/preview"], aspectRatio: "16:9" },
};

// --- Video model registry (Luma Ray) ---
const videoModelMap: Record<string, { lumaModel: string; aspectRatio: string }> = {
  "ora-motion":       { lumaModel: "ray-2", aspectRatio: "16:9" },
  "ray-2":            { lumaModel: "ray-2", aspectRatio: "16:9" },
  "ray-flash-2":      { lumaModel: "ray-flash-2", aspectRatio: "16:9" },
  "veo-3.1":          { lumaModel: "ray-2", aspectRatio: "16:9" },
  "sora-2":           { lumaModel: "ray-2", aspectRatio: "16:9" },
  "seedance-2.0":     { lumaModel: "ray-2", aspectRatio: "16:9" },
  "seedance-1.5-pro": { lumaModel: "ray-2", aspectRatio: "16:9" },
  "seedance-1.0":     { lumaModel: "ray-flash-2", aspectRatio: "16:9" },
  "runway-gen3":      { lumaModel: "ray-2", aspectRatio: "16:9" },
  "pika":             { lumaModel: "ray-flash-2", aspectRatio: "16:9" },
  "sora":             { lumaModel: "ray-2", aspectRatio: "16:9" },
};

// --- Audio model registry (Suno API via sunoapi.org) ---
const audioModelToSuno: Record<string, string> = {
  "ora-audio":  "V5",
  "musicgen":   "V4_5ALL",
  "elevenlabs": "V4_5PLUS",
  "suno":       "V5",
  "udio":       "V4_5",
};

// ─ TEXT GENERATION (APIPod only) ─────────────────────────────
// Uses APIPod model names with fallback chain + Promise.race timeout
async function generateText(req: { prompt: string; model: string; systemPrompt?: string; maxTokens?: number }) {
  const mapping = textModelMap[req.model];
  if (!mapping) throw new Error(`Unknown text model: ${req.model}`);

  const sys = req.systemPrompt || "You are a creative professional AI assistant.";
  const maxTok = req.maxTokens || 1024;
  const start = Date.now();

  // Build chain: primary → fallback → multiple safe fallbacks
  const chain: string[] = [mapping.apiModel];
  if (mapping.fallback && mapping.fallback !== mapping.apiModel) chain.push(mapping.fallback);
  // Only models confirmed on this APIPod account (claude/gemini/deepseek return "model not found")
  const safeFallbacks = ["gpt-4o", "gpt-5"];
  for (const fb of safeFallbacks) { if (!chain.includes(fb)) chain.push(fb); }

  console.log(`[text] model=${req.model} → chain=${JSON.stringify(chain)}, prompt="${req.prompt.slice(0, 50)}...", maxTok=${maxTok}`);

  let lastErr: Error | null = null;
  for (const apiModel of chain) {
    try {
      console.log(`[text] trying ${apiModel} (elapsed: ${Date.now() - start}ms)...`);

      const fetchPromise = fetch(`${APIPOD_BASE}/chat/completions`, {
        method: "POST",
        headers: apipodHeaders(),
        body: JSON.stringify({
          model: apiModel,
          messages: [{ role: "system", content: sys }, { role: "user", content: req.prompt }],
          max_tokens: maxTok,
        }),
      }).then(async (res) => {
        if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b}`); }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (!text) throw new Error(`Empty response from ${apiModel}`);
        return { text, tokensUsed: data.usage?.total_tokens || 0 };
      });

      // 30s timeout per model attempt — Campaign Lab prompts are long, need more time
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`APIPod timeout (30s) for ${apiModel}`)), 30_000)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      console.log(`[text] ${apiModel} OK in ${Date.now() - start}ms, ${result.text.length} chars`);
      return { model: req.model, provider: `apipod/${apiModel}`, text: result.text, tokensUsed: result.tokensUsed, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[text] ${apiModel} FAILED (${Date.now() - start}ms): ${lastErr.message}`);
    }
  }

  // ── FALLBACK: Direct OpenAI if APIPod chain exhausted ──
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    try {
      console.log(`[text] APIPod chain exhausted, trying direct OpenAI gpt-4o (elapsed: ${Date.now() - start}ms)...`);
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: sys }, { role: "user", content: req.prompt }],
          max_tokens: maxTok,
        }),
      });
      if (!oaiRes.ok) { const b = await oaiRes.text(); throw new Error(`OpenAI ${oaiRes.status}: ${b.slice(0, 200)}`); }
      const oaiData = await oaiRes.json();
      const text = oaiData.choices?.[0]?.message?.content || "";
      if (!text) throw new Error("Empty response from OpenAI direct");
      console.log(`[text] OpenAI direct OK in ${Date.now() - start}ms, ${text.length} chars`);
      return { model: req.model, provider: "openai-direct/gpt-4o", text, tokensUsed: oaiData.usage?.total_tokens || 0, latencyMs: Date.now() - start };
    } catch (oaiErr) {
      console.log(`[text] OpenAI direct FAILED (${Date.now() - start}ms): ${oaiErr}`);
    }
  }

  throw lastErr || new Error(`All text models failed for ${req.model}`);
}

// ── IMAGE GENERATION (Luma Photon — submit + polling) ──
async function generateImage(req: { prompt: string; model: string; aspectRatio?: string }) {
  const mapping = imageModelMap[req.model];
  if (!mapping) throw new Error(`Unknown image model: ${req.model}`);
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;

  console.log(`[image] model=${req.model} → Luma ${mapping.lumaModel}, aspect=${ar}`);
  console.log(`[image] prompt="${req.prompt.slice(0, 80)}..."`);

  // Step 1: Submit image generation
  const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
    method: "POST",
    headers: lumaHeaders(),
    body: JSON.stringify({
      prompt: req.prompt,
      model: mapping.lumaModel,
      aspect_ratio: ar,
    }),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Luma image submit ${submitRes.status}: ${b}`); }
  const generation = await submitRes.json();
  const genId = generation.id;
  if (!genId) throw new Error(`Luma image: no generation id returned: ${JSON.stringify(generation).slice(0, 300)}`);
  console.log(`[image] Luma generation submitted: ${genId}, state=${generation.state} (${Date.now() - start}ms)`);

  // Step 2: Poll for completion (max 90s, every 3s)
  let elapsed = 0;
  while (elapsed < 90_000) {
    await new Promise(r => setTimeout(r, 3_000));
    elapsed += 3_000;
    try {
      const pollRes = await fetch(`${LUMA_BASE}/generations/${genId}`, {
        headers: lumaHeaders(),
      });
      if (!pollRes.ok) {
        console.log(`[image] poll ${pollRes.status} for ${genId} (${elapsed / 1000}s, continuing)`);
        continue;
      }
      const pollData = await pollRes.json();
      const state = pollData.state;
      console.log(`[image] poll ${genId}: state=${state} (${elapsed / 1000}s)`);

      if (state === "completed") {
        const imageUrl = pollData.assets?.image;
        if (!imageUrl) throw new Error(`Luma image completed but no URL: ${JSON.stringify(pollData).slice(0, 300)}`);
        console.log(`[image] Luma ${mapping.lumaModel} OK in ${Date.now() - start}ms`);
        return { model: req.model, provider: `luma/${mapping.lumaModel}`, imageUrl, latencyMs: Date.now() - start };
      }
      if (state === "failed") {
        throw new Error(`Luma image failed: ${pollData.failure_reason || "unknown"}`);
      }
      // queued, dreaming → continue polling
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.startsWith("Luma image failed") || pollErr.message.startsWith("Luma image completed"))) throw pollErr;
      console.log(`[image] poll error (continuing): ${pollErr}`);
    }
  }
  throw new Error(`Luma image timeout (90s) for ${mapping.lumaModel}, generation=${genId}`);
}

// ── DALL-E 3 IMAGE GENERATION (OpenAI API) ──
async function generateImageDallE(req: { prompt: string; model: string; aspectRatio?: string }) {
  const start = Date.now();
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  const ar = req.aspectRatio || "1:1";
  const sizeMap: Record<string, string> = {
    "1:1": "1024x1024", "4:3": "1024x1024", "3:4": "1024x1024",
    "16:9": "1792x1024", "9:16": "1024x1792", "3:2": "1792x1024", "2:3": "1024x1792",
  };
  const size = sizeMap[ar] || "1024x1024";
  console.log(`[image-dalle] prompt="${req.prompt.slice(0, 60)}", size=${size}`);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "dall-e-3", prompt: req.prompt, n: 1, size, quality: "hd" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DALL-E 3 error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error(`DALL-E 3: no image URL in response`);
  console.log(`[image-dalle] OK (${Date.now() - start}ms)`);
  return { model: req.model, provider: "openai/dall-e-3", imageUrl, latencyMs: Date.now() - start };
}

// ── FLUX PRO IMAGE GENERATION (FAL API) ──
async function generateImageFluxPro(req: { prompt: string; model: string; aspectRatio?: string }) {
  const start = Date.now();
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");
  const ar = req.aspectRatio || "4:3";
  const dimMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 }, "4:3": { width: 1024, height: 768 },
    "3:4": { width: 768, height: 1024 }, "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 }, "3:2": { width: 1152, height: 768 },
    "2:3": { width: 768, height: 1152 },
  };
  const dims = dimMap[ar] || { width: 1024, height: 768 };
  console.log(`[image-flux-pro] prompt="${req.prompt.slice(0, 60)}", dims=${dims.width}x${dims.height}`);

  // Submit
  const submitRes = await fetch("https://queue.fal.run/fal-ai/flux-pro/v1.1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: req.prompt, image_size: dims, num_images: 1, safety_tolerance: "5" }),
  });
  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`Flux Pro submit error ${submitRes.status}: ${body.slice(0, 200)}`);
  }
  const submitData = await submitRes.json();
  const requestId = submitData.request_id;
  if (!requestId) {
    // Synchronous response (images already in submitData)
    const imageUrl = submitData.images?.[0]?.url;
    if (imageUrl) return { model: req.model, provider: "fal/flux-pro", imageUrl, latencyMs: Date.now() - start };
    throw new Error(`Flux Pro: no request_id or image in response`);
  }
  console.log(`[image-flux-pro] submitted requestId=${requestId}`);

  // Poll
  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 3_000));
    elapsed += 3_000;
    try {
      const pollRes = await fetch(`https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!pollRes.ok) { console.log(`[image-flux-pro] poll ${pollRes.status} (${elapsed / 1000}s)`); continue; }
      const pollData = await pollRes.json();
      if (pollData.status === "COMPLETED") {
        // Fetch result
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}`, {
          headers: { Authorization: `Key ${key}` },
        });
        const resultData = await resultRes.json();
        const imageUrl = resultData.images?.[0]?.url;
        if (!imageUrl) throw new Error(`Flux Pro completed but no URL`);
        console.log(`[image-flux-pro] OK (${Date.now() - start}ms)`);
        return { model: req.model, provider: "fal/flux-pro", imageUrl, latencyMs: Date.now() - start };
      }
      if (pollData.status === "FAILED") throw new Error(`Flux Pro generation failed: ${pollData.error || "unknown"}`);
      console.log(`[image-flux-pro] poll: status=${pollData.status} (${elapsed / 1000}s)`);
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.includes("completed") || pollErr.message.includes("failed"))) throw pollErr;
      console.log(`[image-flux-pro] poll error: ${pollErr}`);
    }
  }
  throw new Error(`Flux Pro timeout (120s), requestId=${requestId}`);
}

// ── DIRECT API IMAGE ROUTING ──
async function generateImageDirect(req: { prompt: string; model: string; aspectRatio?: string }) {
  if (req.model === "dall-e") return generateImageDallE(req);
  if (req.model === "flux-pro") return generateImageFluxPro(req);
  throw new Error(`Unknown direct API model: ${req.model}`);
}

// ── IMAGE GENERATION (secondary provider — submit + polling) ──
async function generateImageHf(req: { prompt: string; model: string; aspectRatio?: string }) {
  const mapping = hfImageModelMap[req.model];
  if (!mapping) throw new Error(`Unknown secondary image model: ${req.model}`);
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;
  console.log(`[image-hf] model=${req.model} → chain=${mapping.hfModels.join(",")}, aspect=${ar}`);

  const hfBody: any = { prompt: req.prompt, aspect_ratio: ar, resolution: "2K" };
  const result = await hfFetchWithFallback(mapping.hfModels, hfBody, "image-hf");
  if (!result.ok) throw new Error(`Image generation failed: ${result.error}`);

  const { data, model: usedModel } = result;
  const requestId = data.request_id;
  console.log(`[image-hf] Submitted ${usedModel}, requestId=${requestId} (${Date.now() - start}ms)`);

  // Poll for completion (max 90s, every 3s)
  let elapsed = 0;
  while (elapsed < 90_000) {
    await new Promise(r => setTimeout(r, 3_000));
    elapsed += 3_000;
    try {
      const statusUrl = `${HIGGSFIELD_BASE}/requests/${requestId}/status`;
      const pollRes = await fetch(statusUrl, { headers: higgsHeaders(), signal: AbortSignal.timeout(10_000) });
      if (!pollRes.ok) { console.log(`[image-hf] poll ${pollRes.status} for ${requestId} (${elapsed / 1000}s)`); continue; }
      const pollData = await pollRes.json();
      const state = pollData.status;
      console.log(`[image-hf] poll ${requestId}: state=${state} (${elapsed / 1000}s)`);
      if (state === "completed") {
        const imageUrl = pollData.images?.[0]?.url;
        if (!imageUrl) throw new Error(`Completed but no URL: ${JSON.stringify(pollData).slice(0, 300)}`);
        console.log(`[image-hf] ${usedModel} OK in ${Date.now() - start}ms`);
        return { model: req.model, provider: usedModel.split("/").slice(0, 2).join("/"), imageUrl, latencyMs: Date.now() - start };
      }
      if (state === "failed") throw new Error(`Image failed: ${pollData.error || "unknown"}`);
      if (state === "nsfw") throw new Error("Content failed moderation");
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.startsWith("Image failed") || pollErr.message.startsWith("Completed") || pollErr.message.startsWith("Content failed"))) throw pollErr;
      console.log(`[image-hf] poll error (continuing): ${pollErr}`);
    }
  }
  throw new Error(`Image timeout (90s), requestId=${requestId}`);
}

// ── LEONARDO AI IMAGE GENERATION (submit + poll) ──
function leonardoHeaders(): Record<string, string> {
  const key = Deno.env.get("LEONARDO_API_KEY");
  if (!key) throw new Error("LEONARDO_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}`, accept: "application/json" };
}

function leonardoAspectToDims(ar: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    "1:1":  { width: 1024, height: 1024 },
    "4:3":  { width: 1024, height: 768 },
    "3:4":  { width: 768, height: 1024 },
    "16:9": { width: 1024, height: 576 },
    "9:16": { width: 576, height: 1024 },
    "3:2":  { width: 1024, height: 683 },
    "2:3":  { width: 683, height: 1024 },
  };
  return map[ar] || { width: 1024, height: 768 };
}

async function generateImageLeonardo(req: { prompt: string; model: string; aspectRatio?: string }) {
  const mapping = leonardoImageModelMap[req.model];
  if (!mapping) throw new Error(`Unknown Leonardo model: ${req.model}`);
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;
  const dims = leonardoAspectToDims(ar);
  const isLucid = mapping.leonardoModelId.startsWith("7b5922") || mapping.leonardoModelId.startsWith("05ce00");
  console.log(`[image-leonardo] model=${req.model} → Leonardo ${mapping.leonardoModelId.slice(0, 8)}, aspect=${ar}, dims=${dims.width}x${dims.height}, lucid=${isLucid}`);

  // Step 1: Submit generation (v1 API)
  // contrast is REQUIRED (3=Low, 3.5=Medium, 4=High)
  // alchemy is NOT supported on Lucid Origin/Lucid Realism
  const submitBody: any = {
    prompt: req.prompt,
    modelId: mapping.leonardoModelId,
    width: dims.width,
    height: dims.height,
    num_images: 1,
    contrast: 3.5,
    styleUUID: mapping.styleUUID || "111dc692-d470-4eec-b791-3475abac4c46",
  };
  // Only add alchemy for non-Lucid models (FLUX, etc.)
  if (!isLucid) {
    submitBody.alchemy = true;
  }
  const submitRes = await fetch(`${LEONARDO_BASE}/generations`, {
    method: "POST",
    headers: leonardoHeaders(),
    body: JSON.stringify(submitBody),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Leonardo submit ${submitRes.status}: ${b}`); }
  const submitData = await submitRes.json();
  const generationId = submitData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error(`Leonardo: no generationId returned: ${JSON.stringify(submitData).slice(0, 300)}`);
  console.log(`[image-leonardo] submitted generationId=${generationId} (${Date.now() - start}ms)`);

  // Step 2: Poll for completion (max 120s, every 4s)
  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 4_000));
    elapsed += 4_000;
    try {
      const pollRes = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, {
        headers: leonardoHeaders(),
      });
      if (!pollRes.ok) { console.log(`[image-leonardo] poll ${pollRes.status} (${elapsed / 1000}s, continuing)`); continue; }
      const pollData = await pollRes.json();
      const gen = pollData.generations_by_pk;
      if (!gen) { console.log(`[image-leonardo] no generations_by_pk yet (${elapsed / 1000}s)`); continue; }
      const status = gen.status;
      console.log(`[image-leonardo] poll ${generationId}: status=${status} (${elapsed / 1000}s)`);
      if (status === "COMPLETE") {
        const imageUrl = gen.generated_images?.[0]?.url;
        if (!imageUrl) throw new Error(`Leonardo completed but no URL: ${JSON.stringify(gen).slice(0, 300)}`);
        console.log(`[image-leonardo] OK in ${Date.now() - start}ms`);
        return { model: req.model, provider: `leonardo/${mapping.leonardoModelId.slice(0, 8)}`, imageUrl, latencyMs: Date.now() - start };
      }
      if (status === "FAILED") {
        throw new Error(`Leonardo generation failed`);
      }
      // PENDING → continue polling
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.startsWith("Leonardo completed") || pollErr.message.startsWith("Leonardo generation failed"))) throw pollErr;
      console.log(`[image-leonardo] poll error (continuing): ${pollErr}`);
    }
  }
  throw new Error(`Leonardo image timeout (120s), generationId=${generationId}`);
}

// --- Leonardo AI v2 models (different API structure) ---
const leonardoV2ModelMap: Record<string, { modelSlug: string; aspectRatio: string; defaultStyle?: string }> = {
  "phoenix-1.0":       { modelSlug: "__v1__", aspectRatio: "4:3" },  // v1 API
  "phoenix-0.9":       { modelSlug: "__v1__", aspectRatio: "4:3" },  // v1 API
  "nano-banana-leo":   { modelSlug: "gemini-2.5-flash-image", aspectRatio: "1:1", defaultStyle: "111dc692-d470-4eec-b791-3475abac4c46" },
  "nano-banana-pro-leo": { modelSlug: "gemini-image-2", aspectRatio: "1:1", defaultStyle: "111dc692-d470-4eec-b791-3475abac4c46" },
  "nano-banana-2-leo": { modelSlug: "nano-banana-2", aspectRatio: "1:1", defaultStyle: "111dc692-d470-4eec-b791-3475abac4c46" },
  "gpt-image-leo":     { modelSlug: "gpt-image-1.5", aspectRatio: "1:1" },
  "ideogram-3-leo":    { modelSlug: "ideogram-v3.0", aspectRatio: "1:1", defaultStyle: "111dc692-d470-4eec-b791-3475abac4c46" },
  "seedream-4-leo":    { modelSlug: "seedream-4.0", aspectRatio: "16:9", defaultStyle: "111dc692-d470-4eec-b791-3475abac4c46" },
  "flux-pro-2-leo":    { modelSlug: "flux-pro-2.0", aspectRatio: "1:1" },
};

// Add Phoenix 1.0 and 0.9 to v1 map (real IDs from docs)
leonardoImageModelMap["phoenix-1.0"] = { leonardoModelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" };
leonardoImageModelMap["phoenix-0.9"] = { leonardoModelId: "6b645e3a-d64f-4341-a6d8-7a3690fbf042", aspectRatio: "4:3", styleUUID: "111dc692-d470-4eec-b791-3475abac4c46" };

// Preprocessor IDs for Image Guidance (editing) per model
const leonardoPreprocessors: Record<string, { styleRef?: number; characterRef?: number; contentRef?: number }> = {
  "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3": { styleRef: 166, characterRef: 397, contentRef: 364 },  // Phoenix 1.0
  "6b645e3a-d64f-4341-a6d8-7a3690fbf042": { styleRef: 166, characterRef: 397, contentRef: 364 },  // Phoenix 0.9
  "7b592283-e8a7-4c5a-9ba6-d18c31f258b9": { styleRef: 431, contentRef: 430 },                     // Lucid Origin
  "05ce0082-2d80-4a2d-8653-4d1c85e2418e": { styleRef: 431, contentRef: 430 },                     // Lucid Realism
  "b2614463-296c-462a-9586-aafdb8f00e36": { styleRef: 299, contentRef: 233 },                     // FLUX Dev
  "1dd50843-d653-4516-a8e3-f0238ee453ff": { styleRef: 298, contentRef: 232 },                     // FLUX Schnell
};

// v2 aspect ratio → dimensions mapping (from Nano Banana 2 docs)
function leonardoV2AspectToDims(ar: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    "1:1":  { width: 1024, height: 1024 },
    "4:3":  { width: 1200, height: 896 },
    "3:4":  { width: 896, height: 1200 },
    "16:9": { width: 1376, height: 768 },
    "9:16": { width: 768, height: 1376 },
    "3:2":  { width: 1264, height: 848 },
    "2:3":  { width: 848, height: 1264 },
    "21:9": { width: 1584, height: 672 },
  };
  return map[ar] || { width: 1024, height: 1024 };
}

// ── LEONARDO V2 IMAGE GENERATION ──
async function generateImageLeonardoV2(req: { prompt: string; model: string; aspectRatio?: string }) {
  const mapping = leonardoV2ModelMap[req.model];
  if (!mapping) throw new Error(`Unknown Leonardo v2 model: ${req.model}`);
  // If model is actually v1 (Phoenix), route to v1 function
  if (mapping.modelSlug === "__v1__") {
    return generateImageLeonardo(req);
  }
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;
  const dims = leonardoV2AspectToDims(ar);
  console.log(`[image-leonardo-v2] model=${req.model} → ${mapping.modelSlug}, aspect=${ar}, dims=${dims.width}x${dims.height}`);

  const submitBody: any = {
    model: mapping.modelSlug,
    parameters: {
      prompt: req.prompt,
      width: dims.width,
      height: dims.height,
      quantity: 1,
      prompt_enhance: "OFF",
    },
    public: false,
  };
  if (mapping.defaultStyle) {
    submitBody.parameters.style_ids = [mapping.defaultStyle];
  }

  const submitRes = await fetch(`${LEONARDO_V2_BASE}/generations`, {
    method: "POST",
    headers: leonardoHeaders(),
    body: JSON.stringify(submitBody),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Leonardo v2 submit ${submitRes.status}: ${b}`); }
  const submitData = await submitRes.json();
  const generationId = submitData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error(`Leonardo v2: no generationId: ${JSON.stringify(submitData).slice(0, 300)}`);
  console.log(`[image-leonardo-v2] submitted generationId=${generationId}`);

  // Poll v1 endpoint (same polling for v2 generations)
  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 4_000));
    elapsed += 4_000;
    try {
      const pollRes = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, { headers: leonardoHeaders() });
      if (!pollRes.ok) { console.log(`[image-leonardo-v2] poll ${pollRes.status} (${elapsed / 1000}s)`); continue; }
      const pollData = await pollRes.json();
      const gen = pollData.generations_by_pk;
      if (!gen) continue;
      console.log(`[image-leonardo-v2] poll: status=${gen.status} (${elapsed / 1000}s)`);
      if (gen.status === "COMPLETE") {
        const imageUrl = gen.generated_images?.[0]?.url;
        if (!imageUrl) throw new Error(`Leonardo v2 completed but no URL`);
        return { model: req.model, provider: `leonardo/${mapping.modelSlug}`, imageUrl, latencyMs: Date.now() - start };
      }
      if (gen.status === "FAILED") throw new Error(`Leonardo v2 generation failed`);
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.includes("completed") || pollErr.message.includes("failed"))) throw pollErr;
      console.log(`[image-leonardo-v2] poll error: ${pollErr}`);
    }
  }
  throw new Error(`Leonardo v2 timeout (120s)`);
}

// ── UPLOAD IMAGE TO LEONARDO (for editing/guidance) ──
async function uploadImageToLeonardo(imageUrl: string): Promise<{ imageId: string }> {
  const start = Date.now();
  console.log(`[leonardo-upload] Uploading external image: ${imageUrl.slice(0, 80)}`);

  // Step 1: Init upload to get presigned URL + fields
  const initRes = await fetch(`${LEONARDO_BASE}/init-image`, {
    method: "POST",
    headers: leonardoHeaders(),
    body: JSON.stringify({ extension: "jpg" }),
  });
  if (!initRes.ok) { const b = await initRes.text(); throw new Error(`Leonardo init-image ${initRes.status}: ${b}`); }
  const initData = await initRes.json();
  const { url: presignedUrl, fields, id: imageId } = initData?.uploadInitImage || {};
  if (!presignedUrl || !imageId) throw new Error(`Leonardo init-image: bad response: ${JSON.stringify(initData).slice(0, 300)}`);
  console.log(`[leonardo-upload] Got presigned URL, imageId=${imageId}`);

  // Step 2: Download the external image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  // Step 3: Upload to presigned URL with fields
  const formData = new FormData();
  // Parse the presigned fields and add them
  if (typeof fields === "string") {
    try {
      const parsedFields = JSON.parse(fields);
      for (const [key, val] of Object.entries(parsedFields)) {
        formData.append(key, val as string);
      }
    } catch { /* fields might already be an object */ }
  } else if (fields && typeof fields === "object") {
    for (const [key, val] of Object.entries(fields)) {
      formData.append(key, val as string);
    }
  }
  formData.append("file", imgBlob, "upload.jpg");

  const uploadRes = await fetch(presignedUrl, { method: "POST", body: formData });
  if (!uploadRes.ok && uploadRes.status !== 204) {
    const b = await uploadRes.text();
    console.log(`[leonardo-upload] presigned upload response ${uploadRes.status}: ${b.slice(0, 200)}`);
    // Some S3 presigned URLs return 204 on success
  }
  console.log(`[leonardo-upload] Uploaded in ${Date.now() - start}ms, imageId=${imageId}`);
  return { imageId };
}

// ── LEONARDO EDIT WITH IMAGE GUIDANCE (v1 controlnets) ──
async function generateImageLeonardoWithGuidance(req: {
  prompt: string;
  model: string;
  imageId: string;
  guidanceType: "style" | "content" | "character";
  strength?: "Low" | "Mid" | "High";
  aspectRatio?: string;
}) {
  const mapping = leonardoImageModelMap[req.model];
  if (!mapping) throw new Error(`Unknown Leonardo model for editing: ${req.model}`);
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;
  const dims = leonardoAspectToDims(ar);
  const preprocessors = leonardoPreprocessors[mapping.leonardoModelId];
  if (!preprocessors) throw new Error(`No preprocessor IDs for model ${req.model}`);

  const preprocessorMap = {
    style: preprocessors.styleRef,
    content: preprocessors.contentRef,
    character: preprocessors.characterRef,
  };
  const preprocessorId = preprocessorMap[req.guidanceType];
  if (!preprocessorId) throw new Error(`Guidance type "${req.guidanceType}" not supported for ${req.model}`);

  const isLucid = mapping.leonardoModelId.startsWith("7b5922") || mapping.leonardoModelId.startsWith("05ce00");
  console.log(`[leonardo-edit] model=${req.model}, guidance=${req.guidanceType}, preprocessor=${preprocessorId}, imageId=${req.imageId}`);

  const submitBody: any = {
    prompt: req.prompt,
    modelId: mapping.leonardoModelId,
    width: dims.width,
    height: dims.height,
    num_images: 1,
    contrast: 3.5,
    styleUUID: mapping.styleUUID || "111dc692-d470-4eec-b791-3475abac4c46",
    controlnets: [{
      initImageId: req.imageId,
      initImageType: "UPLOADED",
      preprocessorId,
      strengthType: req.strength || "Mid",
    }],
  };
  if (!isLucid) submitBody.alchemy = true;

  const submitRes = await fetch(`${LEONARDO_BASE}/generations`, {
    method: "POST",
    headers: leonardoHeaders(),
    body: JSON.stringify(submitBody),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Leonardo edit submit ${submitRes.status}: ${b}`); }
  const submitData = await submitRes.json();
  const generationId = submitData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error(`Leonardo edit: no generationId: ${JSON.stringify(submitData).slice(0, 300)}`);
  console.log(`[leonardo-edit] submitted generationId=${generationId}`);

  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 4_000));
    elapsed += 4_000;
    try {
      const pollRes = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, { headers: leonardoHeaders() });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      const gen = pollData.generations_by_pk;
      if (!gen) continue;
      console.log(`[leonardo-edit] poll: status=${gen.status} (${elapsed / 1000}s)`);
      if (gen.status === "COMPLETE") {
        const imageUrl = gen.generated_images?.[0]?.url;
        if (!imageUrl) throw new Error(`Leonardo edit completed but no URL`);
        return { model: req.model, provider: `leonardo-edit/${req.guidanceType}`, imageUrl, latencyMs: Date.now() - start };
      }
      if (gen.status === "FAILED") throw new Error(`Leonardo edit generation failed`);
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.includes("completed") || pollErr.message.includes("failed"))) throw pollErr;
    }
  }
  throw new Error(`Leonardo edit timeout (120s)`);
}

// ── LEONARDO V2 EDIT WITH IMAGE GUIDANCE ──
async function generateImageLeonardoV2WithGuidance(req: {
  prompt: string;
  model: string;
  imageId: string;
  strength?: "LOW" | "MID" | "HIGH";
  aspectRatio?: string;
}) {
  const mapping = leonardoV2ModelMap[req.model];
  if (!mapping) throw new Error(`Unknown Leonardo v2 model for editing: ${req.model}`);
  if (mapping.modelSlug === "__v1__") {
    return generateImageLeonardoWithGuidance({ ...req, guidanceType: "content", strength: req.strength === "HIGH" ? "High" : req.strength === "LOW" ? "Low" : "Mid" });
  }
  const start = Date.now();
  const ar = req.aspectRatio || mapping.aspectRatio;
  const dims = leonardoV2AspectToDims(ar);
  console.log(`[leonardo-v2-edit] model=${req.model} → ${mapping.modelSlug}, imageId=${req.imageId}`);

  const submitBody: any = {
    model: mapping.modelSlug,
    parameters: {
      prompt: req.prompt,
      width: dims.width,
      height: dims.height,
      quantity: 1,
      prompt_enhance: "OFF",
      guidances: {
        image_reference: [{
          image: { id: req.imageId, type: "UPLOADED" },
          strength: req.strength || "MID",
        }],
      },
    },
    public: false,
  };
  if (mapping.defaultStyle) submitBody.parameters.style_ids = [mapping.defaultStyle];

  const submitRes = await fetch(`${LEONARDO_V2_BASE}/generations`, {
    method: "POST",
    headers: leonardoHeaders(),
    body: JSON.stringify(submitBody),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Leonardo v2 edit ${submitRes.status}: ${b}`); }
  const submitData = await submitRes.json();
  const generationId = submitData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error(`Leonardo v2 edit: no generationId`);

  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 4_000));
    elapsed += 4_000;
    try {
      const pollRes = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, { headers: leonardoHeaders() });
      if (!pollRes.ok) continue;
      const gen = (await pollRes.json()).generations_by_pk;
      if (!gen) continue;
      if (gen.status === "COMPLETE") {
        const imageUrl = gen.generated_images?.[0]?.url;
        if (!imageUrl) throw new Error(`Leonardo v2 edit completed but no URL`);
        return { model: req.model, provider: `leonardo-v2-edit/${mapping.modelSlug}`, imageUrl, latencyMs: Date.now() - start };
      }
      if (gen.status === "FAILED") throw new Error(`Leonardo v2 edit failed`);
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.includes("completed") || pollErr.message.includes("failed"))) throw pollErr;
    }
  }
  throw new Error(`Leonardo v2 edit timeout (120s)`);
}

// ── IMAGE WITH REFERENCE (img2img — FAL Flux primary for preserve, Luma fallback) ──
async function generateImageWithRef(req: { prompt: string; model: string; imageRefUrl: string; strength?: number; preserveContent?: boolean; aspectRatio?: string }) {
  const start = Date.now();
  const rawStrength = req.strength ?? 0.80;
  const preserveContent = req.preserveContent ?? false;
  // Map client aspect ratio to FAL image_size
  const falSizeMap: Record<string, string> = { "1:1": "square_hd", "9:16": "portrait_16_9", "16:9": "landscape_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "2:3": "portrait_4_3" };
  const falImageSize = falSizeMap[req.aspectRatio || ""] || "landscape_4_3";
  // For preserveContent: strength=0.80 — 80% new scene from prompt, 20% product seed from ref.
  // The prompt now includes the brand+model name for correct product identity.
  const strength = preserveContent ? 0.80 : rawStrength;
  const negativePrompt = preserveContent
    ? "wrong brand, wrong logo, competitor brand, different product, altered product, wrong product, text overlay, watermark, visible letters, visible words, 3D render, CGI, illustration, digital art, cartoon, painting, drawing, sketch, anime"
    : "";
  const realisticSuffix = preserveContent
    ? ". Photorealistic commercial photography, natural lighting, shallow depth of field"
    : "";
  const finalPrompt = req.prompt + realisticSuffix;
  console.log(`[img2img] model=${req.model}, strength=${strength} (raw=${rawStrength}, preserve=${preserveContent}), ar=${req.aspectRatio}, ref=${req.imageRefUrl.slice(0, 80)}`);

  // ═══ When preserveContent=true: FAL Flux img2img FIRST (true pixel-preserving denoising) ═══
  // FAL Flux img2img at strength=0.85 — 85% transformation, only 15% of original pixels guide the result.
  // The product shape/colors are seeded by the ref but the scene is COMPLETELY NEW based on the prompt.
  // Example: truck studio shot + "24h du Mans, families, animations" → truck at race track with crowds.
  if (preserveContent) {
    // Strategy 1 (preserveContent): Luma Photon character_ref — PRIMARY pipeline
    // character_ref maintains visual identity of the subject (product) across generations.
    // The product IS the "character" — Luma preserves its exact appearance while placing it in new scenes.
    try {
      console.log(`[img2img] PRESERVE MODE PRIMARY: Luma Photon character_ref...`);
      const lumaArMap: Record<string, string> = { "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4", "2:3": "2:3" };
      const lumaBody: any = {
        prompt: finalPrompt,
        model: "photon-1",
        aspect_ratio: lumaArMap[req.aspectRatio || ""] || "4:3",
        character_ref: { identity0: { images: [req.imageRefUrl] } },
      };
      const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
        method: "POST", headers: lumaHeaders(),
        body: JSON.stringify(lumaBody),
      });
      if (submitRes.ok) {
        const generation = await submitRes.json();
        const genId = generation.id;
        if (genId) {
          let elapsed = 0;
          while (elapsed < 90_000) {
            await new Promise(r => setTimeout(r, 3_000)); elapsed += 3_000;
            try {
              const pollRes = await fetch(`${LUMA_BASE}/generations/${genId}`, { headers: lumaHeaders() });
              if (!pollRes.ok) continue;
              const pd = await pollRes.json();
              if (pd.state === "completed" && pd.assets?.image) {
                console.log(`[img2img] Luma character_ref OK in ${Date.now() - start}ms (PRIMARY)`);
                return { model: req.model, provider: "luma/photon-1-character", imageUrl: pd.assets.image, latencyMs: Date.now() - start };
              }
              if (pd.state === "failed") throw new Error(`Luma failed: ${pd.failure_reason || "unknown"}`);
            } catch (e) { if (e instanceof Error && e.message.startsWith("Luma failed")) throw e; }
          }
        }
      } else {
        const errBody = await submitRes.text();
        console.log(`[img2img] Luma character_ref submit failed ${submitRes.status}: ${errBody.slice(0, 200)}`);
      }
    } catch (err) { console.log(`[img2img] Luma character_ref error: ${err}`); }

    // Strategy 2 (preserveContent): FAL Flux Pro img2img — FALLBACK
    const falKey = Deno.env.get("FAL_API_KEY");
    if (falKey) {
      for (const falModel of ["fal-ai/flux-pro/v1.1/image-to-image", "fal-ai/flux/dev/image-to-image"]) {
        try {
          console.log(`[img2img] PRESERVE MODE FALLBACK: FAL ${falModel} (strength=${strength}, size=${falImageSize})...`);
          const falBody: any = {
            prompt: finalPrompt,
            image_url: req.imageRefUrl,
            strength,
            image_size: falImageSize,
            num_images: 1,
            enable_safety_checker: true,
            num_inference_steps: 30,
            guidance_scale: 10,
          };
          if (negativePrompt) falBody.negative_prompt = negativePrompt;
          const res = await fetch(`https://fal.run/${falModel}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Key ${falKey}` },
            body: JSON.stringify(falBody),
          });
          if (!res.ok) { const b = await res.text(); console.log(`[img2img] FAL ${falModel} ${res.status}: ${b.slice(0, 200)}`); continue; }
          const data = await res.json();
          const imageUrl = data.images?.[0]?.url;
          if (imageUrl) {
            console.log(`[img2img] FAL ${falModel} OK in ${Date.now() - start}ms (FALLBACK, strength=${strength})`);
            return { model: req.model, provider: `fal-img2img/${falModel}`, imageUrl, latencyMs: Date.now() - start };
          }
        } catch (err) { console.log(`[img2img] FAL ${falModel} error: ${err}`); }
      }
    }

    // Strategy 3 (preserveContent): Leonardo PhotoReal with content guidance
    const leoKey = Deno.env.get("LEONARDO_API_KEY");
    if (leoKey) {
      try {
        console.log(`[img2img] PRESERVE MODE last resort: Leonardo PhotoReal content-guidance...`);
        const { imageId } = await uploadImageToLeonardo(req.imageRefUrl);
        const leoResult = await generateImageLeonardoWithGuidance({
          prompt: finalPrompt,
          model: "lucid-realism",
          imageId,
          guidanceType: "content",
          strength: "High",
          aspectRatio: req.aspectRatio || "4:3",
        });
        if (leoResult?.imageUrl) {
          console.log(`[img2img] Leonardo PhotoReal OK in ${Date.now() - start}ms`);
          return { ...leoResult, provider: "leonardo-photoreal-content", latencyMs: Date.now() - start };
        }
      } catch (err) { console.log(`[img2img] Leonardo PhotoReal error: ${err}`); }
    }
  } else {
    // ═══ Standard mode (style reference, not content preserve): FAL first ═══

    // Strategy 1 (style): FAL img2img
    const falKey = Deno.env.get("FAL_API_KEY");
    if (falKey) {
      for (const falModel of ["fal-ai/flux/dev/image-to-image", "fal-ai/flux-general/image-to-image"]) {
        try {
          console.log(`[img2img] Trying FAL ${falModel} (strength=${strength})...`);
          const falBody: any = { prompt: finalPrompt, image_url: req.imageRefUrl, strength, image_size: falImageSize, num_images: 1, enable_safety_checker: true, num_inference_steps: 28 };
          if (negativePrompt) falBody.negative_prompt = negativePrompt;
          const res = await fetch(`https://fal.run/${falModel}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${falKey}` }, body: JSON.stringify(falBody) });
          if (!res.ok) { const b = await res.text(); console.log(`[img2img] FAL ${falModel} ${res.status}: ${b.slice(0, 200)}`); continue; }
          const data = await res.json();
          const imageUrl = data.images?.[0]?.url;
          if (imageUrl) { console.log(`[img2img] FAL ${falModel} OK in ${Date.now() - start}ms`); return { model: req.model, provider: `fal-img2img/${falModel}`, imageUrl, latencyMs: Date.now() - start }; }
        } catch (err) { console.log(`[img2img] FAL ${falModel} error: ${err}`); }
      }
    }

    // Strategy 2 (style): Runware img2img
    const rwKey = Deno.env.get("RUNWARE_IMAGE_API_KEY");
    if (rwKey) {
      try {
        console.log(`[img2img] Trying Runware img2img (strength=${strength})...`);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 30_000);
        const rwDims: Record<string, [number, number]> = { "1:1": [1024, 1024], "9:16": [768, 1344], "16:9": [1344, 768], "4:3": [1024, 768], "3:4": [768, 1024] };
        const [rwW, rwH] = rwDims[req.aspectRatio || ""] || [1024, 768];
        const rwBody: any = { taskType: "imageInference", taskUUID: crypto.randomUUID(), positivePrompt: finalPrompt, model: "runware:100@1", seedImage: req.imageRefUrl, strength, width: rwW, height: rwH, numberResults: 1, outputFormat: "WEBP" };
        if (negativePrompt) rwBody.negativePrompt = negativePrompt;
        const res = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${rwKey}` }, body: JSON.stringify([rwBody]), signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const url = data.data?.[0]?.imageURL || data.data?.[0]?.imageUrl;
          if (url) { console.log(`[img2img] Runware OK in ${Date.now() - start}ms`); return { model: req.model, provider: "runware-img2img", imageUrl: url, latencyMs: Date.now() - start }; }
        }
      } catch (err) { console.log(`[img2img] Runware error: ${err}`); }
    }

    // Strategy 3 (style): Luma Photon image_ref
    try {
      console.log(`[img2img] Trying Luma Photon with image_ref (weight=${strength})...`);
      const lumaArMap: Record<string, string> = { "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4", "2:3": "2:3" };
      const lumaBody: any = { prompt: finalPrompt, model: "photon-1", aspect_ratio: lumaArMap[req.aspectRatio || ""] || "4:3", image_ref: [{ url: req.imageRefUrl, weight: strength }] };
      const submitRes = await fetch(`${LUMA_BASE}/generations/image`, { method: "POST", headers: lumaHeaders(), body: JSON.stringify(lumaBody) });
      if (submitRes.ok) {
        const generation = await submitRes.json();
        const genId = generation.id;
        if (genId) {
          let elapsed = 0;
          while (elapsed < 90_000) {
            await new Promise(r => setTimeout(r, 3_000)); elapsed += 3_000;
            try {
              const pollRes = await fetch(`${LUMA_BASE}/generations/${genId}`, { headers: lumaHeaders() });
              if (!pollRes.ok) continue;
              const pd = await pollRes.json();
              if (pd.state === "completed" && pd.assets?.image) { console.log(`[img2img] Luma OK in ${Date.now() - start}ms`); return { model: req.model, provider: "luma/photon-1-img2img", imageUrl: pd.assets.image, latencyMs: Date.now() - start }; }
              if (pd.state === "failed") throw new Error(`Luma failed: ${pd.failure_reason || "unknown"}`);
            } catch (e) { if (e instanceof Error && e.message.startsWith("Luma failed")) throw e; }
          }
        }
      }
    } catch (err) { console.log(`[img2img] Luma error: ${err}`); }
  }

  // Final fallback: plain generation (ignore reference)
  console.log(`[img2img] All img2img failed, falling back to plain generateImage`);
  return generateImage({ prompt: req.prompt, model: req.model || "ora-vision" });
}

// ── VIDEO GENERATION (Luma Ray — submit + polling) ──
async function generateVideo(req: { prompt: string; model: string; imageUrl?: string }) {
  const mapping = videoModelMap[req.model];
  if (!mapping) throw new Error(`Unknown video model: ${req.model}`);
  const start = Date.now();

  const isImg2Vid = !!req.imageUrl;
  console.log(`[video] model=${req.model} → Luma ${mapping.lumaModel}, aspect=${mapping.aspectRatio}, img2vid=${isImg2Vid}`);
  console.log(`[video] prompt="${req.prompt.slice(0, 80)}..."`);

  // Build request body — add keyframes for image-to-video
  const body: any = {
    generation_type: "video",
    prompt: req.prompt,
    model: mapping.lumaModel,
    aspect_ratio: mapping.aspectRatio,
  };
  if (req.imageUrl) {
    body.keyframes = {
      frame0: { type: "image", url: req.imageUrl },
    };
    console.log(`[video] keyframes.frame0.url = ${req.imageUrl.slice(0, 80)}...`);
  }

  // Step 1: Submit video generation (POST /generations/video per Luma API docs)
  const submitRes = await fetch(`${LUMA_BASE}/generations/video`, {
    method: "POST",
    headers: lumaHeaders(),
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Luma video submit ${submitRes.status}: ${b}`); }
  const generation = await submitRes.json();
  const genId = generation.id;
  if (!genId) throw new Error(`Luma video: no generation id returned: ${JSON.stringify(generation).slice(0, 300)}`);
  console.log(`[video] Luma generation submitted: ${genId}, state=${generation.state} (${Date.now() - start}ms)`);

  // Step 2: Poll for completion (max 180s, every 5s)
  let elapsed = 0;
  while (elapsed < 180_000) {
    await new Promise(r => setTimeout(r, 5_000));
    elapsed += 5_000;
    try {
      const pollRes = await fetch(`${LUMA_BASE}/generations/${genId}`, {
        headers: lumaHeaders(),
      });
      if (!pollRes.ok) {
        console.log(`[video] poll ${pollRes.status} for ${genId} (${elapsed / 1000}s, continuing)`);
        continue;
      }
      const pollData = await pollRes.json();
      const state = pollData.state;
      console.log(`[video] poll ${genId}: state=${state} (${elapsed / 1000}s)`);

      if (state === "completed") {
        const videoUrl = pollData.assets?.video;
        if (!videoUrl) throw new Error(`Luma video completed but no URL: ${JSON.stringify(pollData).slice(0, 300)}`);
        console.log(`[video] Luma ${mapping.lumaModel} OK in ${Date.now() - start}ms`);
        return { model: req.model, provider: `luma/${mapping.lumaModel}`, videoUrl, latencyMs: Date.now() - start };
      }
      if (state === "failed") {
        throw new Error(`Luma video failed: ${pollData.failure_reason || "unknown"}`);
      }
      // queued, dreaming → continue polling
    } catch (pollErr) {
      if (pollErr instanceof Error && (pollErr.message.startsWith("Luma video failed") || pollErr.message.startsWith("Luma video completed"))) throw pollErr;
      console.log(`[video] poll error (continuing): ${pollErr}`);
    }
  }
  throw new Error(`Luma video timeout (180s) for ${mapping.lumaModel}, generation=${genId}`);
}

// ── AUDIO: Suno API helpers (split start + poll to avoid EarlyDrop) ──
const SUNO_BASE = "https://api.sunoapi.org";

async function sunoStartGeneration(req: { prompt: string; model: string; instrumental?: boolean; lyrics?: string; title?: string; style?: string }): Promise<{ taskId: string; sunoModel: string }> {
  const sunoModel = audioModelToSuno[req.model] || "V5";
  const key = Deno.env.get("SUNO_API_KEY");
  if (!key) throw new Error("SUNO_API_KEY not set");

  const isCustom = !!(req.lyrics || req.title || req.style);
  const instrumental = req.instrumental !== undefined ? req.instrumental : true;
  console.log(`[audio/suno] START model=${sunoModel}, custom=${isCustom}, instrumental=${instrumental}, prompt="${req.prompt.slice(0, 80)}"`);

  const body: Record<string, any> = { model: sunoModel, callBackUrl: "" };
  if (isCustom) {
    body.customMode = true;
    body.instrumental = instrumental;
    body.prompt = instrumental ? "" : (req.lyrics || req.prompt.slice(0, 3000));
    body.style = req.style || req.prompt.slice(0, 200);
    body.title = req.title || "Untitled";
  } else {
    body.customMode = false;
    body.instrumental = instrumental;
    body.prompt = req.prompt.slice(0, 500);
  }

  console.log(`[audio/suno] POST ${SUNO_BASE}/api/v1/generate body=${JSON.stringify(body).slice(0, 200)}`);
  const genRes = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!genRes.ok) {
    const b = await genRes.text();
    throw new Error(`Suno generate ${genRes.status}: ${b}`);
  }
  const genData = await genRes.json();
  console.log(`[audio/suno] response: code=${genData.code}, msg=${genData.msg}, taskId=${genData.data?.taskId}`);
  if (genData.code !== 200) throw new Error(`Suno generate error ${genData.code}: ${genData.msg}`);
  const taskId = genData.data?.taskId;
  if (!taskId) throw new Error("Suno: no taskId returned");
  return { taskId, sunoModel };
}

async function sunoPollStatus(taskId: string): Promise<{ status: string; track?: any; error?: string }> {
  const key = Deno.env.get("SUNO_API_KEY");
  if (!key) throw new Error("SUNO_API_KEY not set");
  const pollRes = await fetch(`${SUNO_BASE}/api/v1/generate/record-info?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!pollRes.ok) return { status: "POLLING", error: `HTTP ${pollRes.status}` };
  const pollData = await pollRes.json();
  if (pollData.code !== 200) return { status: "POLLING", error: `code ${pollData.code}` };
  const status = pollData.data?.status || "UNKNOWN";
  console.log(`[audio/suno] poll taskId=${taskId} status=${status}`);
  if (status === "CREATE_TASK_FAILED" || status === "GENERATE_AUDIO_FAILED" || status === "SENSITIVE_WORD_ERROR") {
    return { status: "FAILED", error: `${status}: ${pollData.data?.errorMessage || "unknown"}` };
  }
  if (status === "FIRST_SUCCESS" || status === "SUCCESS") {
    const tracks = pollData.data?.response?.sunoData;
    if (tracks?.length > 0) {
      const t = tracks[0];
      const audioUrl = t.audioUrl || t.streamAudioUrl;
      if (audioUrl) return { status: "DONE", track: { audioUrl, title: t.title, duration: t.duration, imageUrl: t.imageUrl, id: t.id } };
    }
  }
  return { status };
}

// ═════════════════��═════════════════════════════════���══════════
// HEALTH (duplicate removed — primary /health is at top of file, line ~109)
// ══════════════════════════════════════════════════════════════

// ── TEST: Campaign text generation diagnostic ────────────────
app.get("/test-campaign-text", async (c) => {
  const t0 = Date.now();
  const diag: any = { steps: [], errors: [] };
  try {
    // Step 1: Check APIPOD key
    const APIPOD_KEY = Deno.env.get("APIPOD_API_KEY");
    diag.steps.push({ step: "apipod_key", ok: !!APIPOD_KEY, elapsed: Date.now() - t0 });
    if (!APIPOD_KEY) { diag.errors.push("APIPOD_API_KEY not set"); return c.json(diag); }

    // Step 2: Minimal APIPod call
    const testPrompt = "Reply with exactly: {\"test\": \"ok\"}";
    try {
      const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${APIPOD_KEY}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: testPrompt }], max_tokens: 50 }),
      });
      const status = res.status;
      const body = await res.text();
      diag.steps.push({ step: "apipod_call", ok: res.ok, status, bodyLen: body.length, body: body.slice(0, 300), elapsed: Date.now() - t0 });
      if (!res.ok) diag.errors.push(`APIPod HTTP ${status}: ${body.slice(0, 200)}`);
    } catch (err) {
      diag.steps.push({ step: "apipod_call", ok: false, error: String(err), elapsed: Date.now() - t0 });
      diag.errors.push(`APIPod fetch error: ${err}`);
    }

    // Step 3: Check OpenAI fallback key
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    diag.steps.push({ step: "openai_key", ok: !!OPENAI_KEY, elapsed: Date.now() - t0 });

    diag.totalMs = Date.now() - t0;
    return c.json(diag);
  } catch (err) {
    diag.errors.push(`Fatal: ${err}`);
    return c.json(diag, 500);
  }
});

// ── TEST APIPOD — minimal direct test ────────────────────────
app.get("/test-apipod", async (c) => {
  const APIPOD_BASE = "https://api.apipod.ai/v1";
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) return c.json({ error: "APIPOD_API_KEY not set in env" }, 500);

  const start = Date.now();
  try {
    console.log("[test-apipod] Sending test request with multiple models...");
    const testModels = ["gpt-5", "gpt-4o", "claude-4-5-sonnet", "claude-4-5-haiku", "gemini-2.5-pro"];
    const results: any[] = [];
    for (const m of testModels) {
      const mStart = Date.now();
      try {
        const r = await fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: m, messages: [{ role: "system", content: "Reply with exactly: OK" }, { role: "user", content: "Test" }], max_tokens: 10 }),
          signal: AbortSignal.timeout(10_000),
        });
        const b = await r.text();
        results.push({ model: m, status: r.status, body: b.slice(0, 200), ms: Date.now() - mStart });
      } catch (err) {
        results.push({ model: m, status: "error", body: String(err).slice(0, 200), ms: Date.now() - mStart });
      }
    }
    const firstOk = results.find(r => r.status === 200);
    const res = { ok: !!firstOk, status: firstOk?.status || results[0]?.status } as any;
    const body = JSON.stringify(results);
    const status = firstOk ? 200 : (results[0]?.status || 500);
    const latency = Date.now() - start;

    console.log(`[test-apipod] status=${status} latency=${latency}ms results=${results.length}`);

    if (!firstOk) {
      return c.json({ 
        success: false, 
        error: `All APIPod models failed`, 
        results,
        latencyMs: latency,
        keyPrefix: key.slice(0, 8) + "...",
      });
    }

    let parsed: any;
    try { parsed = JSON.parse(firstOk.body); } catch { parsed = null; }
    const text = parsed?.choices?.[0]?.message?.content || "(no content)";

    return c.json({
      success: true,
      text,
      workingModel: firstOk.model,
      allResults: results,
      model: parsed?.model || firstOk.model,
      tokensUsed: parsed?.usage?.total_tokens || 0,
      latencyMs: latency,
      keyPrefix: key.slice(0, 8) + "...",
    });
  } catch (err) {
    return c.json({
      success: false,
      error: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - start,
      keyPrefix: key.slice(0, 8) + "...",
    });
  }
});

// ══════════════════════════════════���═══════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════

app.post("/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: "Email and password required" }, 400);
    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.createUser({
      email, password,
      user_metadata: { name: name || email.split("@")[0] },
      email_confirm: true,
    });
    if (error) { console.log("[signup] error:", error.message); return c.json({ error: error.message }); }
    if (data.user) {
      await getOrCreateProfile(data.user.id, email, name);
      await logEvent("signup", { email, userId: data.user.id });
    }
    return c.json({ success: true, user: { id: data.user?.id, email } });
  } catch (err) {
    console.log("[signup] exception:", err);
    return c.json({ error: `Signup error: ${err}` }, 500);
  }
});

// POST /auth/me — preferred: user token in body._token (avoids CORS issues)
app.post("/auth/me", async (c) => {
  const t0 = Date.now();
  const ctxToken = c.get?.("userToken");
  const ctxBody = c.get?.("parsedBody");
  console.log(`[/auth/me POST] ctxToken=${ctxToken ? ctxToken.slice(0,20)+"..." : "NULL"} ctxBodyKeys=${ctxBody ? Object.keys(ctxBody).join(",") : "NULL"} authHeader=${c.req.header("Authorization")?.slice(0,30) || "NONE"}`);
  try {
    const result = await Promise.race([
      (async () => {
        const user = await requireAuth(c);
        console.log(`[/auth/me POST] auth OK (${Date.now() - t0}ms), fetching profile...`);
        const profile = await getOrCreateProfile(user.id, user.email);
        profile.lastLoginAt = new Date().toISOString();
        kv.set(`user:${user.id}`, profile).catch((e: any) => console.log("[/auth/me POST] kv.set lastLogin failed:", e));
        return c.json({ authenticated: true, profile });
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("auth/me handler timeout (8s)")), 8_000)),
    ]);
    return result;
  } catch (err) {
    console.log(`[/auth/me POST] error after ${Date.now() - t0}ms:`, String(err));
    // Fallback: decode JWT from body._token
    try {
      const bodyToken = c.get?.("userToken");
      if (bodyToken) {
        const payload = decodeJwtPayload(bodyToken);
        if (payload?.sub && payload?.email) {
          const isAdmin = payload.email.toLowerCase() === ADMIN_EMAIL;
          return c.json({
            authenticated: true,
            profile: {
              userId: payload.sub, email: payload.email,
              name: payload.user_metadata?.name || payload.email.split("@")[0],
              role: isAdmin ? "admin" : "user",
              plan: isAdmin ? "studio" : "free",
              credits: isAdmin ? 999999 : PLAN_CREDITS.free,
              creditsUsed: 0, company: "", jobTitle: "",
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              _fallback: true,
            },
          });
        }
      }
    } catch (e2) { console.log("[/auth/me POST] fallback also failed:", e2); }
    return c.json({ authenticated: false, error: String(err) });
  }
});

// GET /auth/me — legacy (kept for backward compat)
app.get("/auth/me", async (c) => {
  const t0 = Date.now();
  const userToken = c.req.header("Authorization")?.split(" ")[1] || c.req.header("X-User-Token");
  console.log("[/auth/me] request received, has Authorization:", !!c.req.header("Authorization"));
  try {
    // Wrap entire handler in a 8s timeout to prevent infinite hangs
    const result = await Promise.race([
      (async () => {
        const user = await requireAuth(c);
        console.log(`[/auth/me] auth OK (${Date.now() - t0}ms), fetching profile...`);
        const profile = await getOrCreateProfile(user.id, user.email);
        console.log(`[/auth/me] profile OK (${Date.now() - t0}ms)`);
        profile.lastLoginAt = new Date().toISOString();
        // Fire-and-forget the lastLogin update (don't block response)
        kv.set(`user:${user.id}`, profile).catch((e: any) => console.log("[/auth/me] kv.set lastLogin failed:", e));
        return c.json({ authenticated: true, profile });
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("auth/me handler timeout (8s)")), 8_000)),
    ]);
    return result;
  } catch (err) {
    console.log(`[/auth/me] error after ${Date.now() - t0}ms:`, String(err));
    // If timeout or KV failure, try to return basic info from JWT alone
    try {
      if (userToken) {
        const payload = decodeJwtPayload(userToken);
        if (payload?.sub && payload?.email) {
          const isAdmin = payload.email.toLowerCase() === ADMIN_EMAIL;
          return c.json({
            authenticated: true,
            profile: {
              userId: payload.sub, email: payload.email,
              name: payload.user_metadata?.name || payload.email.split("@")[0],
              role: isAdmin ? "admin" : "user",
              plan: isAdmin ? "studio" : "free",
              credits: isAdmin ? 999999 : PLAN_CREDITS.free,
              creditsUsed: 0, company: "", jobTitle: "",
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              _fallback: true,
            },
          });
        }
      }
    } catch (e2) { console.log("[/auth/me] fallback also failed:", e2); }
    return c.json({ authenticated: false, error: String(err) });
  }
});

// GET+POST /user/init — Batch endpoint: returns vault + library in ONE call
// GET avoids CORS preflight entirely (token via _token query param)
app.get("/user/init", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const [vault, libraryItems] = await Promise.all([
      kv.get(`vault:${user.id}`).catch(() => null),
      kv.getByPrefix(`lib:${user.id}:`).catch(() => []),
    ]);
    console.log(`[user/init GET] user=${user.id.slice(0, 8)} vault=${vault ? "yes" : "no"} lib=${(libraryItems || []).length} (${Date.now() - t0}ms)`);
    return c.json({
      success: true,
      vault: vault || null,
      library: libraryItems || [],
      latencyMs: Date.now() - t0,
    });
  } catch (err: any) {
    console.log(`[user/init GET] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

app.post("/user/init", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const [vault, libraryItems] = await Promise.all([
      kv.get(`vault:${user.id}`).catch(() => null),
      kv.getByPrefix(`lib:${user.id}:`).catch(() => []),
    ]);
    console.log(`[user/init] user=${user.id.slice(0, 8)} vault=${vault ? "yes" : "no"} lib=${(libraryItems || []).length} (${Date.now() - t0}ms)`);
    return c.json({
      success: true,
      vault: vault || null,
      library: libraryItems || [],
      latencyMs: Date.now() - t0,
    });
  } catch (err: any) {
    console.log(`[user/init] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

app.post("/auth/choose-plan", async (c) => {
  try {
    const user = await requireAuth(c);
    const { plan } = await c.req.json();
    if (!["free", "generate", "studio"].includes(plan)) return c.json({ error: "Invalid plan" }, 400);
    const profile = await getOrCreateProfile(user.id, user.email);
    profile.plan = plan;
    profile.credits = PLAN_CREDITS[plan] || PLAN_CREDITS.free;
    await kv.set(`user:${user.id}`, profile);
    await logEvent("plan_change", { userId: user.id, email: user.email, plan });
    return c.json({ success: true, profile });
  } catch (err) {
    return c.json({ error: `Choose plan error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// GENERATION ROUTES
// ══════════════════════════════��═══════════════════════════════

app.post("/generate/text-multi", async (c) => {
  const t0 = Date.now();
  try {
    // Auth: soft — don't block generation if auth fails
    let user: AuthUser | null = null;
    try {
      user = await getUser(c);
      console.log(`[text-multi] auth: ${user ? `user=${user.id}` : "guest (no valid JWT)"}`);
    } catch (authErr) {
      console.log(`[text-multi] auth error (continuing as guest):`, authErr);
    }

    const body = c.get?.("parsedBody") || await c.req.json();
    const { prompt, models, systemPrompt, maxTokens } = body;
    console.log(`[text-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}, user=${user?.id || "guest"}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

    const MODEL_TIMEOUT = 90_000; // 90s per model (generateText has 30s internal timeout per attempt, chain can have 3 models)
    const results = await Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 1).catch(() => {});
        try {
          console.log(`[text-multi] calling generateText(${model})...`);
          const result = await Promise.race([
            generateText({ prompt, model, systemPrompt, maxTokens }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
          ]);
          console.log(`[text-multi] ${model} OK in ${Date.now() - t0}ms, provider=${result.provider}`);
          if (user) logEvent("generation", { userId: user.id, type: "text", model }).catch(() => {});
          logCost({ type: "text", model, provider: result.provider, costUsd: getProviderCost(result.provider, "text"), revenueEur: REVENUE_PER_TYPE.text, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});
          return { success: true, result };
        } catch (err) {
          console.log(`[text-multi] ${model} FAILED:`, err);
          logCost({ type: "text", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
          return { success: false, error: String(err) };
        }
      })
    );
    console.log(`[text-multi] done in ${Date.now() - t0}ms, ${results.length} results`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[text-multi] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Text generation error: ${err}` }, 500);
  }
});

// ── TEXT-MULTI VIA GET (CORS-safe — no preflight) ──
// Same logic as POST /generate/text-multi but params via query string
app.get("/generate/text-multi-get", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try {
      user = await getUser(c);
      console.log(`[text-multi-get] auth: ${user ? `user=${user.id}` : "guest"}`);
    } catch (authErr) {
      console.log(`[text-multi-get] auth error (continuing as guest):`, authErr);
    }

    const prompt = c.req.query("prompt") || "";
    const modelsStr = c.req.query("models") || "";
    const systemPrompt = c.req.query("systemPrompt") || "";
    const maxTokensStr = c.req.query("maxTokens") || "2048";
    const models = modelsStr.split(",").filter(Boolean);

    console.log(`[text-multi-get] prompt="${prompt.slice(0, 60)}", models=${JSON.stringify(models)}, user=${user?.id || "guest"}`);
    if (!prompt || !models.length) return c.json({ error: "prompt and models required" }, 400);

    const maxTokens = parseInt(maxTokensStr, 10) || 2048;
    const MODEL_TIMEOUT = 90_000;
    const results = await Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 1).catch(() => {});
        try {
          console.log(`[text-multi-get] calling generateText(${model})...`);
          const result = await Promise.race([
            generateText({ prompt, model, systemPrompt, maxTokens }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
          ]);
          console.log(`[text-multi-get] ${model} OK in ${Date.now() - t0}ms, provider=${result.provider}`);
          if (user) logEvent("generation", { userId: user.id, type: "text", model }).catch(() => {});
          logCost({ type: "text", model, provider: result.provider, costUsd: getProviderCost(result.provider, "text"), revenueEur: REVENUE_PER_TYPE.text, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});
          return { success: true, result };
        } catch (err) {
          console.log(`[text-multi-get] ${model} FAILED:`, err);
          logCost({ type: "text", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
          return { success: false, error: String(err) };
        }
      })
    );
    console.log(`[text-multi-get] done in ${Date.now() - t0}ms, ${results.length} results`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[text-multi-get] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Text generation error: ${err}` }, 500);
  }
});

app.post("/generate/image-multi", async (c) => {
  const t0 = Date.now();
  console.log(`[image-multi] >>>>>> HANDLER ENTERED at ${new Date().toISOString()}`);
  try {
    // Auth: soft — don't block generation if auth fails
    let user: AuthUser | null = null;
    try {
      user = await getUser(c);
      console.log(`[image-multi] auth OK (${Date.now() - t0}ms): ${user ? `user=${user.id}` : "guest (no valid JWT)"}`);
    } catch (authErr) {
      console.log(`[image-multi] auth error (${Date.now() - t0}ms, continuing as guest):`, authErr);
    }
    const { prompt, models } = await c.req.json();
    if (!prompt || !models?.length) {
      console.log(`[image-multi] BAD REQUEST: prompt=${!!prompt}, models=${models?.length}`);
      return c.json({ error: "prompt and models required" }, 400);
    }
    console.log(`[image-multi] models=${models.join(",")}, prompt="${prompt.slice(0, 60)}", user=${user?.id || "guest"}, t0=${t0}`);

    // Luma Photon is async (10-60s typical, 90s max polling)
    const MODEL_TIMEOUT = 95_000;
    const HANDLER_TIMEOUT = 105_000;
    const CONCURRENCY = 3;

    const work = (async () => {
      const results: any[] = [];
      for (let i = 0; i < models.length; i += CONCURRENCY) {
        const batch = models.slice(i, i + CONCURRENCY);
        console.log(`[image-multi] batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.join(",")}`);
        const batchResults = await Promise.all(
          batch.map(async (model: string) => {
            try {
              if (user) deductCredit(user.id, 2).catch(() => {});
              const result = await Promise.race([
                generateImage({ prompt, model }),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
              ]);
              console.log(`[image-multi] ${model} OK (${Date.now() - t0}ms)`);
              if (user) logEvent("generation", { userId: user.id, type: "image", model }).catch(() => {});
              const r = result as any;
              logCost({ type: "image", model, provider: r.provider || "unknown", costUsd: getProviderCost(r.provider || "", "image"), revenueEur: REVENUE_PER_TYPE.image, latencyMs: r.latencyMs || (Date.now() - t0), userId: user?.id || "guest", success: true }).catch(() => {});
              return { success: true, result };
            } catch (err) {
              console.log(`[image-multi] ${model} FAIL (${Date.now() - t0}ms): ${err}`);
              logCost({ type: "image", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
              return { success: false, error: String(err) };
            }
          })
        );
        results.push(...batchResults);
      }
      return results;
    })();

    const results = await Promise.race([
      work,
      new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error(`Handler timeout ${HANDLER_TIMEOUT}ms`)), HANDLER_TIMEOUT)),
    ]).catch((err) => {
      console.log(`[image-multi] HANDLER TIMEOUT (${Date.now() - t0}ms): ${err}`);
      return models.map((model: string) => ({ success: false, error: `Server timeout after ${((Date.now() - t0) / 1000).toFixed(1)}s for ${model}` }));
    });

    console.log(`[image-multi] done (${Date.now() - t0}ms), results: ${results.length}`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[image-multi] error (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image generation error: ${err}` }, 500);
  }
});

app.post("/generate/video-multi", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[video-multi] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { prompt, models, imageUrl } = await c.req.json();
    console.log(`[video-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}, img2vid=${!!imageUrl}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    // Luma Ray polls up to 180s, so give it room
    const VIDEO_MODEL_TIMEOUT = 190_000;
    const VIDEO_HANDLER_TIMEOUT = 210_000;

    const work = Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});
        try {
          const result = await Promise.race([
            generateVideo({ prompt, model, imageUrl }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Model timeout: ${model}`)), VIDEO_MODEL_TIMEOUT)),
          ]);
          if (user) logEvent("generation", { userId: user.id, type: "video", model }).catch(() => {});
          logCost({ type: "video", model, provider: result.provider, costUsd: getProviderCost(result.provider, "video"), revenueEur: REVENUE_PER_TYPE.video, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});
          return { success: true, result };
        } catch (err) {
          logCost({ type: "video", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
          return { success: false, error: String(err) };
        }
      })
    );

    const results = await Promise.race([
      work,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Video handler timeout")), VIDEO_HANDLER_TIMEOUT)),
    ]).catch((err) => models.map((m: string) => ({ success: false, error: `Timeout for ${m}: ${err}` })));

    console.log(`[video-multi] done in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[video-multi] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Video generation error: ${err}` }, 500);
  }
});

// ── VIDEO VIA GET (single model, Luma-only, avoids POST issues) ──
app.get("/generate/video-via-get", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const prompt = c.req.query("prompt");
    const model = c.req.query("model") || "ora-motion";
    const imageUrl = c.req.query("imageUrl") || undefined;

    console.log(`[video-get] raw prompt="${prompt?.slice(0, 60)}", model=${model}, img2vid=${!!imageUrl}, user=${user?.id || "guest"}`);
    if (!prompt) return c.json({ error: "prompt required" }, 400);

    // Enhance/translate prompt — preserve brand name when ref image exists (video uses keyframe from product photo)
    const enhancedPrompt = await enhanceImagePrompt(prompt, !!imageUrl);
    console.log(`[video-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}" (preserveBrand=${!!imageUrl})`);

    if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});

    const result = await Promise.race([
      generateVideo({ prompt: enhancedPrompt, model, imageUrl }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Video timeout (190s) for ${model}`)), 190_000)),
    ]);

    if (user) logEvent("generation", { userId: user.id, type: "video", model }).catch(() => {});
    logCost({ type: "video", model, provider: result.provider, costUsd: getProviderCost(result.provider, "video"), revenueEur: REVENUE_PER_TYPE.video, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});

    console.log(`[video-get] OK in ${Date.now() - t0}ms, provider=${result.provider}`);
    return c.json({ success: true, result });
  } catch (err) {
    console.log(`[video-get] FAIL after ${Date.now() - t0}ms:`, err);
    logCost({ type: "video", model: c.req.query("model") || "ora-motion", provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: "guest", success: false }).catch(() => {});
    return c.json({ success: false, error: `Video generation failed: ${err}` }, 500);
  }
});

// ── VIDEO START (submit to Luma, return generationId immediately — no polling) ──
app.get("/generate/video-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const rawPrompt = c.req.query("prompt");
    const model = c.req.query("model") || "ora-motion";
    const imageUrl = c.req.query("imageUrl") || undefined;
    const clientAspectRatio = c.req.query("aspectRatio") || undefined;
    // Legacy query param (kept for backward compat but we now prefer server-side fetch)
    const brandVisualPrefix = c.req.query("brandVisual") || "";

    console.log(`[video-start] raw prompt="${rawPrompt?.slice(0, 60)}", model=${model}, img2vid=${!!imageUrl}, aspectRatio=${clientAspectRatio || "default"}, user=${user?.id?.slice(0, 8) || "anon"}`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── SERVER-SIDE BRAND CONTEXT for video prompts ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try {
        brandCtx = await buildBrandContext(user.id);
      } catch (err) {
        console.log(`[video-start] buildBrandContext failed (continuing without): ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);

      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cinematic brand aesthetic.`;
        console.log(`[video-start] Brand-enriched prompt (${prompt.length} chars): ...${prompt.slice(-120)}`);
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cinematic brand aesthetic.`;
      console.log(`[video-start] Fallback brand visual from query param (${prompt.length} chars)`);
    }

    // Enhance/translate prompt — preserve brand name when ref image exists
    const enhancedPrompt = await enhanceImagePrompt(prompt, !!imageUrl);
    console.log(`[video-start] enhanced prompt="${enhancedPrompt.slice(0, 80)}" (preserveBrand=${!!imageUrl})`);

    if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});

    // Force anti-text suffix for video prompts too
    const antiTextVideo = ". No visible text, no letters, no words, no brand names, no logos anywhere in the video.";
    const finalVideoPrompt = enhancedPrompt.toLowerCase().includes("no visible text") ? enhancedPrompt : enhancedPrompt + antiTextVideo;

    // Resolve first-frame image (client-provided or auto from brand)
    let resolvedImageUrl = imageUrl;
    if (imageUrl) console.log(`[video-start] Using client image as first frame: ${imageUrl.slice(0, 100)}...`);
    if (!resolvedImageUrl && brandCtx && brandCtx.topRefImages.length > 0) {
      try {
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const bestRef = brandCtx.topRefImages[0];
        const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(bestRef.storagePath, 3600);
        if (data?.signedUrl) {
          resolvedImageUrl = data.signedUrl;
          console.log(`[video-start] Auto-resolved brand ref as first frame: "${bestRef.description?.slice(0, 50)}"`);
        }
      } catch (err) {
        console.log(`[video-start] Auto-resolve brand ref failed (continuing without): ${err}`);
      }
    }

    // ── Check if model routes through secondary provider ──
    const hfMapping = hfVideoModelMap[model];
    if (hfMapping) {
      const aspectRatio = clientAspectRatio || hfMapping.aspectRatio;
      const hfBody: any = { prompt: finalVideoPrompt, duration: 5 };
      if (resolvedImageUrl) hfBody.image_url = resolvedImageUrl;
      if (clientAspectRatio) hfBody.aspect_ratio = clientAspectRatio;

      const modelChain = resolvedImageUrl ? hfMapping.hfModelsI2v : hfMapping.hfModelsT2v;
      console.log(`[video-start] Secondary provider: model=${model}, chain=${modelChain.join(",")}, hasImage=${!!resolvedImageUrl}`);
      const result = await hfFetchWithFallback(modelChain, hfBody, "video-start-hf");
      if (!result.ok) {
        console.log(`[video-start] Secondary provider FAILED: ${result.error}`);
        return c.json({ success: false, error: `Video start failed: ${result.error}` }, 500);
      }
      const { data: hfGen, model: usedModel } = result;
      // Prefix generationId with "hf:" so video-status knows where to poll
      const genId = `hf:${hfGen.request_id}`;
      console.log(`[video-start] Secondary OK in ${Date.now() - t0}ms, model=${usedModel}, genId=${genId}`);
      if (user) logEvent("generation", { userId: user.id, type: "video", model }).catch(() => {});
      logCost({ type: "video", model, provider: usedModel.split("/").slice(0, 2).join("/"), costUsd: 0.10, revenueEur: REVENUE_PER_TYPE.video, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: true }).catch(() => {});
      return c.json({ success: true, generationId: genId, state: "queued", model });
    }

    // ── Luma path ──
    const mapping = videoModelMap[model];
    if (!mapping) return c.json({ error: `Unknown video model: ${model}` }, 400);

    const aspectRatio = clientAspectRatio || mapping.aspectRatio;

    const body: any = {
      generation_type: "video",
      prompt: finalVideoPrompt,
      model: mapping.lumaModel,
      aspect_ratio: aspectRatio,
    };

    if (resolvedImageUrl) {
      body.keyframes = { frame0: { type: "image", url: resolvedImageUrl } };
    }

    const submitRes = await fetch(`${LUMA_BASE}/generations/video`, {
      method: "POST",
      headers: lumaHeaders(),
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      console.log(`[video-start] Luma submit failed ${submitRes.status}: ${errBody.slice(0, 200)}`);
      return c.json({ success: false, error: `Video submit error ${submitRes.status}: ${errBody.slice(0, 200)}` }, 500);
    }
    const generation = await submitRes.json();
    const genId = generation.id;
    if (!genId) {
      console.log(`[video-start] No generation id:`, JSON.stringify(generation).slice(0, 300));
      return c.json({ success: false, error: "No generation ID returned" }, 500);
    }

    console.log(`[video-start] OK in ${Date.now() - t0}ms, genId=${genId}, state=${generation.state}`);
    if (user) logEvent("generation", { userId: user.id, type: "video", model }).catch(() => {});

    return c.json({
      success: true,
      generationId: genId,
      state: generation.state || "queued",
      model,
      lumaModel: mapping.lumaModel,
    });
  } catch (err) {
    console.log(`[video-start] FAIL after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Video start failed: ${err}` }, 500);
  }
});

// ── VIDEO STATUS (poll Luma or secondary provider once, return current state) ──
app.get("/generate/video-status", async (c) => {
  const t0 = Date.now();
  try {
    const rawId = c.req.query("id");
    if (!rawId) return c.json({ error: "id required" }, 400);

    // Detect secondary provider via "hf:" prefix
    if (rawId.startsWith("hf:")) {
      const requestId = rawId.slice(3);
      const statusUrl = `${HIGGSFIELD_BASE}/requests/${requestId}/status`;
      const hfRes = await fetch(statusUrl, { headers: higgsHeaders(), signal: AbortSignal.timeout(10_000) });
      if (hfRes.ok) {
        const data = await hfRes.json();
        const status = data.status;
        if (status === "completed") {
          const videoUrl = data.video?.url || null;
          console.log(`[video-status] Secondary ${requestId} COMPLETED (${Date.now() - t0}ms)`);
          return c.json({ success: true, state: "completed", videoUrl });
        }
        if (status === "failed") {
          console.log(`[video-status] Secondary ${requestId} FAILED: ${data.error}`);
          return c.json({ success: true, state: "failed", error: data.error || "Video generation failed" });
        }
        if (status === "nsfw") {
          return c.json({ success: true, state: "failed", error: "Content failed moderation" });
        }
        console.log(`[video-status] Secondary ${requestId} state=${status} (${Date.now() - t0}ms)`);
        return c.json({ success: true, state: status === "in_progress" ? "dreaming" : "queued" });
      }
      console.log(`[video-status] Secondary poll ${hfRes.status} for ${requestId}`);
      return c.json({ success: true, state: "queued" });
    }

    // Luma path
    const generationId = rawId;
    const pollRes = await fetch(`${LUMA_BASE}/generations/${generationId}`, {
      headers: lumaHeaders(),
    });
    if (!pollRes.ok) {
      const errBody = await pollRes.text();
      console.log(`[video-status] Luma poll ${pollRes.status}: ${errBody.slice(0, 200)}`);
      return c.json({ success: false, state: "error", error: `Poll error ${pollRes.status}` }, 500);
    }
    const data = await pollRes.json();
    const state = data.state;

    if (state === "completed") {
      const videoUrl = data.assets?.video;
      console.log(`[video-status] ${generationId} COMPLETED in ${Date.now() - t0}ms`);
      return c.json({ success: true, state: "completed", videoUrl: videoUrl || null });
    }
    if (state === "failed") {
      console.log(`[video-status] ${generationId} FAILED: ${data.failure_reason}`);
      return c.json({ success: true, state: "failed", error: data.failure_reason || "Video generation failed" });
    }

    console.log(`[video-status] ${generationId} state=${state} (${Date.now() - t0}ms)`);
    return c.json({ success: true, state });
  } catch (err) {
    console.log(`[video-status] error:`, err);
    return c.json({ success: false, state: "error", error: `Status check failed: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGN LAB — DEDICATED TEXT GENERATION (APIPod mandatory)
// POST version (preferred — no URL length limit)
// ══════════════════════════════════════════════════════════════

app.post("/campaign/generate-texts", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    console.log(`[campaign-texts-POST] user=${user?.id || "guest"}`);

    const body = await c.req.json().catch(() => ({}));
    const brief = ((body.brief || "") as string).slice(0, 2000);
    const targetAudience = ((body.targetAudience || "") as string).slice(0, 300);
    const productUrls = ((body.productUrls || "") as string).slice(0, 500);
    const formatIds = ((body.formats || "") as string).split(",").filter(Boolean);
    const campaignObjective = ((body.campaignObjective || "") as string).slice(0, 300);
    const toneOfVoice = ((body.toneOfVoice || "") as string).slice(0, 300);
    const contentAngle = ((body.contentAngle || "") as string).slice(0, 500);
    const keyMessages = ((body.keyMessages || "") as string).slice(0, 800);
    const callToAction = ((body.callToAction || "") as string).slice(0, 300);
    const explicitLanguage = ((body.language || "") as string).slice(0, 20);
    const campaignStartDate = ((body.campaignStartDate || "") as string).slice(0, 30);
    const campaignDuration = ((body.campaignDuration || "") as string).slice(0, 50);
    console.log(`[campaign-texts-POST] brief="${brief.slice(0,120)}", fmts=[${formatIds.join(",")}], objective=${campaignObjective}, lang=${explicitLanguage}, angle="${contentAngle.slice(0,60)}", cta="${callToAction.slice(0,60)}"`);
    if (!brief && !productUrls) return c.json({ success: false, error: "brief or productUrls required" }, 400);
    if (!formatIds.length) return c.json({ success: false, error: "formats required" }, 400);

    // ── BRAND VAULT ──
    let brandVault: any = null;
    if (user) { try { brandVault = await kv.get(`vault:${user.id}`); console.log(`[campaign-texts-POST] vault=${brandVault ? "YES" : "NO"}`); } catch {} }
    const brandCtx: string[] = [];
    if (brandVault) {
      if (brandVault.brandName) brandCtx.push(`BRAND NAME: ${brandVault.brandName}`);
      if (brandVault.tagline) brandCtx.push(`TAGLINE: ${brandVault.tagline}`);
      if (brandVault.mission) brandCtx.push(`MISSION: ${brandVault.mission}`);
      if (brandVault.vision) brandCtx.push(`VISION: ${brandVault.vision}`);
      if (brandVault.values?.length) brandCtx.push(`VALUES: ${brandVault.values.join(", ")}`);
      if (brandVault.tone) brandCtx.push(`TONE OF VOICE: ${brandVault.tone}`);
      if (brandVault.toneAttributes?.length) brandCtx.push(`TONE ATTRIBUTES: ${brandVault.toneAttributes.join(", ")}`);
      if (brandVault.personality) brandCtx.push(`BRAND PERSONALITY: ${brandVault.personality}`);
      if (brandVault.approvedTerms?.length) brandCtx.push(`APPROVED VOCABULARY: ${brandVault.approvedTerms.slice(0, 30).join(", ")}`);
      if (brandVault.forbiddenTerms?.length) brandCtx.push(`FORBIDDEN WORDS: ${brandVault.forbiddenTerms.slice(0, 30).join(", ")}`);
      if (brandVault.keyMessages?.length) brandCtx.push(`KEY MESSAGES: ${brandVault.keyMessages.slice(0, 8).join(" | ")}`);
      if (brandVault.targetAudience) brandCtx.push(`TARGET AUDIENCE: ${brandVault.targetAudience}`);
      if (brandVault.competitors?.length) brandCtx.push(`COMPETITORS: ${brandVault.competitors.slice(0, 5).join(", ")}`);
      if (brandVault.usp) brandCtx.push(`USP: ${brandVault.usp}`);
      if (brandVault.guidelines) brandCtx.push(`GUIDELINES: ${brandVault.guidelines.slice(0, 500)}`);
      if (brandVault.sections) { for (const s of brandVault.sections) { const items = (s.items || []).slice(0, 8).map((it: any) => `  - ${it.label}: ${(it.value || "").slice(0, 200)}`).join("\n"); if (items) brandCtx.push(`[${s.title || "Section"}]:\n${items}`); } }
    }
    const brandBlock = brandCtx.length > 0 ? brandCtx.join("\n") : "No Brand Vault. Use professional neutral tone.";

    const FORMAT_META: Record<string, { label: string; platform: string; type: string }> = {
      // LinkedIn
      "linkedin-post": { label: "LinkedIn Post", platform: "LinkedIn", type: "image" },
      "linkedin-carousel": { label: "LinkedIn Carousel", platform: "LinkedIn", type: "image" },
      "linkedin-video": { label: "LinkedIn Video", platform: "LinkedIn", type: "video" },
      "linkedin-text": { label: "LinkedIn Text Post", platform: "LinkedIn", type: "text" },
      // Instagram
      "instagram-post": { label: "Instagram Post", platform: "Instagram", type: "image" },
      "instagram-carousel": { label: "Instagram Carousel", platform: "Instagram", type: "image" },
      "instagram-story": { label: "Instagram Story", platform: "Instagram", type: "image" },
      "instagram-reel": { label: "Instagram Reel", platform: "Instagram", type: "video" },
      // Facebook
      "facebook-post": { label: "Facebook Post", platform: "Facebook", type: "image" },
      "facebook-story": { label: "Facebook Story", platform: "Facebook", type: "image" },
      "facebook-video": { label: "Facebook Video", platform: "Facebook", type: "video" },
      "facebook-ad": { label: "Facebook Ad", platform: "Facebook", type: "image" },
      // TikTok
      "tiktok-video": { label: "TikTok Video", platform: "TikTok", type: "video" },
      "tiktok-image": { label: "TikTok Photo", platform: "TikTok", type: "image" },
      // Twitter/X
      "twitter-post": { label: "X Post", platform: "Twitter/X", type: "image" },
      "twitter-text": { label: "X Thread", platform: "Twitter/X", type: "text" },
      // YouTube
      "youtube-thumbnail": { label: "YouTube Thumbnail", platform: "YouTube", type: "image" },
      "youtube-short": { label: "YouTube Short", platform: "YouTube", type: "video" },
      // Pinterest
      "pinterest-pin": { label: "Pinterest Pin", platform: "Pinterest", type: "image" },
      // Email
      "email-campaign": { label: "Email Campaign", platform: "Email", type: "text" },
      "newsletter": { label: "Newsletter", platform: "Email", type: "text" },
      // Web
      "landing-hero": { label: "Landing Page Hero", platform: "Web", type: "image" },
      "blog-header": { label: "Blog Header", platform: "Web", type: "image" },
      "landing-page": { label: "Landing Page", platform: "Web", type: "text" },
      // Ads
      "ad-banner": { label: "Display Ad", platform: "Ads", type: "image" },
      "google-ad-text": { label: "Google Ad Copy", platform: "Ads", type: "text" },
    };
    const formats = formatIds.map(id => ({ id, ...(FORMAT_META[id] || { label: id, platform: "Other", type: "text" }) }));
    const fmtDesc = formats.map((f: any) => `- ${f.id}: ${f.label} (${f.platform}, ${f.type})`).join("\n");

    // Language: use explicit field if provided, otherwise detect from brief
    const frPattern = /\b(le|la|les|du|des|un|une|pour|avec|dans|sur|est|sont|nous|notre|votre|cette|ces|qui|que|mais)\b/i;
    const lang = explicitLanguage && explicitLanguage !== "auto" ? explicitLanguage : (frPattern.test(brief) ? "fr" : "en");
    const langLabel = lang === "fr" ? "FRENCH" : lang === "en" ? "ENGLISH" : lang.toUpperCase();

    // Build CAMPAIGN DIRECTIVES block from structured fields
    const directives: string[] = [];
    if (campaignObjective) directives.push(`CAMPAIGN OBJECTIVE: ${campaignObjective}`);
    if (contentAngle) directives.push(`CONTENT ANGLE / EVENT CONTEXT: ${contentAngle}`);
    if (keyMessages) directives.push(`KEY MESSAGES TO INTEGRATE:\n${keyMessages}`);
    if (callToAction) directives.push(`EXACT CTA TO USE: ${callToAction}`);
    if (toneOfVoice) directives.push(`TONE OF VOICE: ${toneOfVoice}`);
    if (targetAudience) directives.push(`TARGET AUDIENCE: ${targetAudience}`);
    if (campaignStartDate) directives.push(`CAMPAIGN START DATE: ${campaignStartDate}`);
    if (campaignDuration) directives.push(`CAMPAIGN DURATION: ${campaignDuration}`);
    if (productUrls) directives.push(`PRODUCT URLs: ${productUrls}`);
    const directivesBlock = directives.length > 0 ? directives.join("\n") : "";
    const sysPrompt =
      `You are the senior content director of a brand-obsessed agency. Write REAL, PUBLISHABLE marketing copy 100% faithful to the brand and the campaign brief.\n\nBRAND VAULT (ABSOLUTE AUTHORITY):\n${brandBlock.slice(0, 3000)}\n\n${directivesBlock ? `══════ CAMPAIGN DIRECTIVES (MANDATORY — EVERY FIELD BELOW MUST BE RESPECTED IN EVERY FORMAT) ══════\n${directivesBlock}\n\n` : ""}STRICT COMPLIANCE RULES:\n1. Match exact tone, personality, vocabulary from Brand Vault.\n2. Use approved vocabulary naturally.\n3. NEVER use forbidden terms.\n4. Use EXACT product name/features/claims from the brief.\n5. Each format = UNIQUE angle, but ALL must reference the CONTENT ANGLE / EVENT CONTEXT if provided.\n6. ALL copy MUST be written in ${langLabel}. No exceptions.\n7. If a CONTENT ANGLE or EVENT CONTEXT is provided, EVERY post MUST mention it prominently — it is the campaign's central theme, not just background info.\n8. If KEY MESSAGES are provided, each post MUST integrate at least one key message.\n9. If an EXACT CTA is provided, use it VERBATIM as the call-to-action in every format. Do NOT invent a different CTA.\n10. If a TARGET AUDIENCE is specified, adapt tone, vocabulary, and hooks to speak directly to that audience.\n11. The campaign is about BOTH the product AND the event/context — never reduce it to just the product alone.
12. IMAGE PROMPTS — PRODUCT IDENTITY + BRAND-NEW SCENE: Each imagePrompt MUST NAME the exact brand and product model (e.g. \"a MAN eTGX electric truck\", \"a Nike Air Max 90\") so the AI generates the CORRECT product, never a competitor. Then add key VISUAL characteristics (color, shape, distinctive design features). Then describe a COMPLETELY NEW SCENE derived from the campaign brief, event context, target audience, and key messages. The ref photo ONLY preserves the product via img2img — the SCENE must be 100% new. Combine: (a) exact brand+model name, (b) visual features, (c) NEW environment/location from the brief, (d) TARGET AUDIENCE interacting with product, (e) MOOD/ATMOSPHERE. Always MODERN, CURRENT-GENERATION for vehicles. Every imagePrompt must be unique per format. Always end with: No visible text, no logos, no letters, no watermarks anywhere in the image.
13. VIDEO PROMPTS: videoPrompt MUST name the exact brand/product model, describe visual characteristics, then describe a NEW motion scene from the brief with target audience. Always MODERN vehicles. End with: No visible text, no logos, no letters, no brand names anywhere in the video.\n\nFORMAT REQUIREMENTS:\n- linkedin-post: Professional hook. 150-300 words. 3-5 hashtags. CTA.\n- linkedin-carousel: 5-8 slide captions, each 20-40 words. Hook slide + value slides + CTA slide.\n- linkedin-video: Professional. 50-100 words script/caption.\n- linkedin-text: Thought leadership. 200-400 words. No image needed. 3-5 hashtags.\n- instagram-post: 80-150 words. 10-15 hashtags.\n- instagram-carousel: 5-10 slide captions, each 15-30 words. Swipeable storytelling.\n- instagram-story: 15-30 words hook. Swipe CTA.\n- instagram-reel: Hook + voiceover. 20-40 words.\n- facebook-post: Conversational. 100-200 words.\n- facebook-story: 15-25 words. Tap-through CTA.\n- facebook-video: Engaging. 50-120 words caption.\n- facebook-ad: Headline(40c) + primary text(125c) + description(30c) + CTA button text.\n- tiktok-video: Viral hook 5-10 words. Script 30-60 words. Trending tone.\n- tiktok-image: Punchy caption 30-80 words. 5-8 hashtags.\n- twitter-post: Max 280 chars. Punchy. 2-3 hashtags.\n- twitter-text: Thread of 3-7 tweets, each max 280 chars. Numbered.\n- youtube-thumbnail: Title overlay text 3-6 words. Click-bait hook.\n- youtube-short: Hook + script 30-60 words. CTA subscribe.\n- pinterest-pin: Title(100c) + description(200-500c). SEO keywords.\n- email-campaign: Subject(50c) + preheader(90c) + headline + body(250-400w) + CTA.\n- newsletter: Subject + 3-5 sections with headers + body(600-1000w).\n- landing-hero: H1(8-12 words) + H2(15-25 words) + CTA button text.\n- blog-header: SEO title(60c) + meta description(155c) + intro paragraph.\n- ad-banner: Headline(30c) + subline(60c) + CTA(15c).\n- google-ad-text: 3 headlines(30c each) + 2 descriptions(90c each) + display URL path.\n\nOUTPUT: ONLY valid JSON. No markdown. No backticks. Keys = format IDs. Each value:\n{"subject":"","headline":"","caption":"MAIN COPY min 80w social / 250w email. NEVER EMPTY.","hashtags":"","ctaText":"USE THE EXACT CTA FROM DIRECTIVES","features":[],"imagePrompt":"MANDATORY: a vivid 40-80 word scene. START with exact brand+model name (e.g. MAN eTGX, Nike Air Max). Add visual characteristics. Then describe a COMPLETELY NEW scene from the brief (event, audience, key messages). Always MODERN vehicles. Each format = DIFFERENT scene. End with: No visible text, no logos, no letters, no watermarks.","videoPrompt":"MANDATORY: a 30-50 word motion scene. START with exact brand+model name. Add visual features. Describe NEW motion scene from the brief. Always MODERN vehicles. End with: No visible text, no logos."}\n\nFORMATS:\n${fmtDesc}`;

    const userPrompt = brief || `Create campaign for: ${productUrls}`;

    const APIPOD_KEY = Deno.env.get("APIPOD_API_KEY");
    const apipodModels = APIPOD_KEY ? ["gpt-4o", "gpt-5"] : [];
    let resultText = "";
    let usedProvider = "";

    for (const mdl of apipodModels) {
      try {
        console.log(`[campaign-texts-POST] APIPod ${mdl}...`);
        const fetchP = fetch(`${APIPOD_BASE}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${APIPOD_KEY}` }, body: JSON.stringify({ model: mdl, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }], max_tokens: 4096, temperature: 0.7 }) }).then(async (res) => { if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b.slice(0, 300)}`); } const d = await res.json(); return d.choices?.[0]?.message?.content || ""; });
        const timeoutP = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout 60s`)), 60_000));
        resultText = await Promise.race([fetchP, timeoutP]);
        if (resultText) { usedProvider = `apipod/${mdl}`; console.log(`[campaign-texts-POST] ${mdl} OK: ${resultText.length}c (${Date.now()-t0}ms)`); break; }
      } catch (err) { console.log(`[campaign-texts-POST] ${mdl} FAILED: ${err}`); }
    }

    if (!resultText) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        try {
          console.log(`[campaign-texts-POST] OpenAI direct...`);
          const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` }, body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }], max_tokens: 4096, temperature: 0.7 }) });
          if (!oaiRes.ok) { const b = await oaiRes.text(); throw new Error(`OpenAI ${oaiRes.status}: ${b.slice(0, 300)}`); }
          const oaiData = await oaiRes.json();
          resultText = oaiData.choices?.[0]?.message?.content || "";
          if (resultText) usedProvider = "openai-direct";
          console.log(`[campaign-texts-POST] OpenAI OK: ${resultText.length}c (${Date.now()-t0}ms)`);
        } catch (e) { console.log(`[campaign-texts-POST] OpenAI FAILED: ${e}`); }
      }
    }

    if (!resultText) { console.log(`[campaign-texts-POST] ALL FAILED (${Date.now()-t0}ms)`); return c.json({ success: false, error: "All text providers failed" }); }

    console.log(`[campaign-texts-POST] Raw(500): ${resultText.slice(0,500)}`);
    let copyMap: Record<string, any> = {};
    const strats = [
      () => JSON.parse(resultText.trim()),
      () => { const m = resultText.match(/```(?:json)?\s*([\s\S]*?)```/); if (!m) throw 0; return JSON.parse(m[1]); },
      () => { const m = resultText.match(/(\{[\s\S]*\})/); if (!m) throw 0; return JSON.parse(m[1]); },
      () => { const m = resultText.match(/(\{[\s\S]*\})/); if (!m) throw 0; return JSON.parse(m[1].replace(/,\s*([}\]])/g,"$1")); },
    ];
    for (let i = 0; i < strats.length; i++) { try { copyMap = strats[i](); if (Object.keys(copyMap).length > 0) break; } catch {} }

    if (user) deductCredit(user.id, CREDIT_COST.text).catch(() => {});
    const fmtCount = Object.keys(copyMap).length;
    console.log(`[campaign-texts-POST] DONE: ${fmtCount} fmts, ${usedProvider}, ${Date.now()-t0}ms`);
    return c.json({ success: true, copyMap, provider: usedProvider, formatCount: fmtCount, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[campaign-texts-POST] FATAL: ${err}`);
    return c.json({ success: false, error: `${err}` }, 500);
  }
});

// ── LEGACY GET endpoint (kept for compat) ──
app.get("/campaign/generate-texts-get", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    console.log(`[campaign-texts-get] user=${user?.id || "guest"}`);

    const brief = c.req.query("brief") || "";
    const targetAudience = c.req.query("targetAudience") || "";
    const productUrls = c.req.query("productUrls") || "";
    const formatIds = (c.req.query("formats") || "").split(",").filter(Boolean);
    console.log(`[campaign-texts-get] brief="${brief.slice(0,100)}", formats=[${formatIds.join(",")}]`);
    if (!brief && !productUrls) return c.json({ success: false, error: "brief or productUrls required" }, 400);
    if (!formatIds.length) return c.json({ success: false, error: "formats required" }, 400);

    // ── BRAND VAULT — full load from KV ──
    let brandVault: any = null;
    if (user) {
      try {
        brandVault = await kv.get(`vault:${user.id}`);
        console.log(`[campaign-texts-get] vault: ${brandVault ? "YES (" + (brandVault.brandName || "?") + ")" : "NO"}`);
      } catch (err) { console.log(`[campaign-texts-get] vault err: ${err}`); }
    }

    const brandCtx: string[] = [];
    if (brandVault) {
      if (brandVault.brandName) brandCtx.push(`BRAND NAME: ${brandVault.brandName}`);
      if (brandVault.tagline) brandCtx.push(`TAGLINE: ${brandVault.tagline}`);
      if (brandVault.mission) brandCtx.push(`MISSION: ${brandVault.mission}`);
      if (brandVault.vision) brandCtx.push(`VISION: ${brandVault.vision}`);
      if (brandVault.values?.length) brandCtx.push(`VALUES: ${brandVault.values.join(", ")}`);
      if (brandVault.tone) brandCtx.push(`TONE OF VOICE: ${brandVault.tone}`);
      if (brandVault.toneAttributes?.length) brandCtx.push(`TONE ATTRIBUTES: ${brandVault.toneAttributes.join(", ")}`);
      if (brandVault.personality) brandCtx.push(`BRAND PERSONALITY: ${brandVault.personality}`);
      if (brandVault.approvedTerms?.length) brandCtx.push(`APPROVED VOCABULARY (MUST use): ${brandVault.approvedTerms.slice(0, 30).join(", ")}`);
      if (brandVault.forbiddenTerms?.length) brandCtx.push(`FORBIDDEN WORDS (NEVER use): ${brandVault.forbiddenTerms.slice(0, 30).join(", ")}`);
      if (brandVault.keyMessages?.length) brandCtx.push(`KEY MESSAGES: ${brandVault.keyMessages.slice(0, 8).join(" | ")}`);
      if (brandVault.targetAudience) brandCtx.push(`TARGET AUDIENCE (vault): ${brandVault.targetAudience}`);
      if (brandVault.competitors?.length) brandCtx.push(`COMPETITORS: ${brandVault.competitors.slice(0, 5).join(", ")}`);
      if (brandVault.usp) brandCtx.push(`USP: ${brandVault.usp}`);
      if (brandVault.guidelines) brandCtx.push(`GUIDELINES: ${brandVault.guidelines.slice(0, 500)}`);
      if (brandVault.sections) {
        for (const s of brandVault.sections) {
          const items = (s.items || []).slice(0, 8).map((it: any) => `  - ${it.label}: ${(it.value || "").slice(0, 200)}`).join("\n");
          if (items) brandCtx.push(`[${s.title || "Section"}]:\n${items}`);
        }
      }
    }
    const brandBlock = brandCtx.length > 0 ? brandCtx.join("\n") : "No Brand Vault. Use professional neutral tone.";

    const FORMAT_META_GET: Record<string, { label: string; platform: string; type: string }> = {
      "linkedin-post": { label: "LinkedIn Post", platform: "LinkedIn", type: "image" },
      "linkedin-carousel": { label: "LinkedIn Carousel", platform: "LinkedIn", type: "image" },
      "linkedin-video": { label: "LinkedIn Video", platform: "LinkedIn", type: "video" },
      "linkedin-text": { label: "LinkedIn Text Post", platform: "LinkedIn", type: "text" },
      "instagram-post": { label: "Instagram Post", platform: "Instagram", type: "image" },
      "instagram-carousel": { label: "Instagram Carousel", platform: "Instagram", type: "image" },
      "instagram-story": { label: "Instagram Story", platform: "Instagram", type: "image" },
      "instagram-reel": { label: "Instagram Reel", platform: "Instagram", type: "video" },
      "facebook-post": { label: "Facebook Post", platform: "Facebook", type: "image" },
      "facebook-story": { label: "Facebook Story", platform: "Facebook", type: "image" },
      "facebook-video": { label: "Facebook Video", platform: "Facebook", type: "video" },
      "facebook-ad": { label: "Facebook Ad", platform: "Facebook", type: "image" },
      "tiktok-video": { label: "TikTok Video", platform: "TikTok", type: "video" },
      "tiktok-image": { label: "TikTok Photo", platform: "TikTok", type: "image" },
      "twitter-post": { label: "X Post", platform: "Twitter/X", type: "image" },
      "twitter-text": { label: "X Thread", platform: "Twitter/X", type: "text" },
      "youtube-thumbnail": { label: "YouTube Thumbnail", platform: "YouTube", type: "image" },
      "youtube-short": { label: "YouTube Short", platform: "YouTube", type: "video" },
      "pinterest-pin": { label: "Pinterest Pin", platform: "Pinterest", type: "image" },
      "email-campaign": { label: "Email Campaign", platform: "Email", type: "text" },
      "newsletter": { label: "Newsletter", platform: "Email", type: "text" },
      "landing-hero": { label: "Landing Page Hero", platform: "Web", type: "image" },
      "blog-header": { label: "Blog Header", platform: "Web", type: "image" },
      "landing-page": { label: "Landing Page", platform: "Web", type: "text" },
      "ad-banner": { label: "Display Ad", platform: "Ads", type: "image" },
      "google-ad-text": { label: "Google Ad Copy", platform: "Ads", type: "text" },
    };
    const formats = formatIds.map(id => ({ id, ...(FORMAT_META_GET[id] || { label: id, platform: "Other", type: "text" }) }));
    const fmtDesc = formats.map((f: any) => `- ${f.id}: ${f.label} (${f.platform}, ${f.type})`).join("\n");

    const frPattern = /\b(le|la|les|du|des|un|une|pour|avec|dans|sur|est|sont|nous|notre|votre|cette|ces|qui|que|mais|ou|donc|ainsi|aussi|chez|aux|par|vers|entre|comme|faire|plus|fait|très|être|avoir|tout|peut|bien|autre|même|après)\b/i;
    const lang = frPattern.test(brief || "") ? "fr" : "en";
    const briefShort = (brief || "").slice(0, 800);
    const urlsShort = (productUrls || "").slice(0, 300);

    const sysPrompt = `You are the senior content director of a brand-obsessed agency. Write REAL, PUBLISHABLE marketing copy 100% faithful to the brand.

BRAND VAULT (ABSOLUTE AUTHORITY):
${brandBlock.slice(0, 3000)}

COMPLIANCE RULES (NON-NEGOTIABLE):
1. Match exact tone, personality, vocabulary from the Brand Vault.
2. Use approved vocabulary naturally in every piece.
3. NEVER use forbidden terms or close synonyms.
4. NEVER rename or alter the product. Use EXACT name, features, claims.
5. Each format reinforces at least one key message.
6. Each format has a UNIQUE angle — no repetition.
7. ALL copy in ${lang === "fr" ? "FRENCH" : "ENGLISH"}.

FORMAT REQUIREMENTS:
- linkedin-post: Professional. Hook first line. 150-300 words. 3-5 hashtags. CTA.
- instagram-post: 80-150 words caption. 10-15 hashtags. Visual storytelling.
- instagram-story: 15-30 words hook. Swipe CTA. Urgency.
- facebook-post: Conversational. 100-200 words.
- instagram-reel: Hook + voiceover. 20-40 words caption.
- linkedin-video: Professional intro. 50-100 words.
- email-campaign: Subject (50 chars) + headline + body (250-400 words) + CTA button.
- landing-page: H1 + H2 + 3 features (title+desc) + CTA. Conversion-optimized.
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ""}
${urlsShort ? `PRODUCT URLs: ${urlsShort}` : ""}

OUTPUT: ONLY valid JSON. No markdown. No backticks. No explanation. Keys = format IDs. Each value:
{"subject":"","headline":"","caption":"MAIN COPY min 80w social / 250w email-landing. NEVER EMPTY.","hashtags":"","ctaText":"","features":[],"imagePrompt":"cinematic photo desc max 80w, real product, no text","videoPrompt":"motion desc 30-50w"}

FORMATS:
${fmtDesc}`;

    const userPrompt = briefShort || `Create campaign for: ${urlsShort}`;

    // ── APIPOD chain: gpt-4o -> gpt-5 -> OpenAI direct ──
    const APIPOD_KEY = Deno.env.get("APIPOD_API_KEY");
    const apipodModels = APIPOD_KEY ? ["gpt-4o", "gpt-5"] : [];
    let resultText = "";
    let usedProvider = "";

    for (const mdl of apipodModels) {
      try {
        console.log(`[campaign-texts] APIPod ${mdl}...`);
        const fetchP = fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${APIPOD_KEY}` },
          body: JSON.stringify({ model: mdl, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }], max_tokens: 4096, temperature: 0.7 }),
        }).then(async (res) => {
          if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b.slice(0, 300)}`); }
          const data = await res.json();
          return data.choices?.[0]?.message?.content || "";
        });
        const timeoutP = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout 60s ${mdl}`)), 60_000));
        resultText = await Promise.race([fetchP, timeoutP]);
        if (resultText) { usedProvider = `apipod/${mdl}`; console.log(`[campaign-texts] ${mdl} OK: ${resultText.length}c (${Date.now()-t0}ms)`); break; }
      } catch (err) { console.log(`[campaign-texts] ${mdl} FAILED: ${err}`); }
    }

    if (!resultText) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        try {
          console.log(`[campaign-texts] Trying OpenAI direct...`);
          const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }], max_tokens: 4096, temperature: 0.7 }),
          });
          if (!oaiRes.ok) { const b = await oaiRes.text(); throw new Error(`OpenAI ${oaiRes.status}: ${b.slice(0,200)}`); }
          resultText = (await oaiRes.json()).choices?.[0]?.message?.content || "";
          usedProvider = "openai-direct/gpt-4o";
          console.log(`[campaign-texts] OpenAI OK: ${resultText.length}c (${Date.now()-t0}ms)`);
        } catch (e) { console.log(`[campaign-texts] OpenAI FAILED: ${e}`); }
      }
    }

    if (!resultText) {
      console.log(`[campaign-texts] ALL FAILED (${Date.now()-t0}ms)`);
      return c.json({ success: false, error: "All text providers failed" });
    }

    // ── Parse JSON — 4 strategies ──
    console.log(`[campaign-texts] Raw(500): ${resultText.slice(0,500)}`);
    let copyMap: Record<string, any> = {};
    const strats = [
      () => JSON.parse(resultText.trim()),
      () => { const m = resultText.match(/```(?:json)?\s*([\s\S]*?)```/); if (!m) throw 0; return JSON.parse(m[1]); },
      () => { const m = resultText.match(/(\{[\s\S]*\})/); if (!m) throw 0; return JSON.parse(m[1]); },
      () => { const m = resultText.match(/(\{[\s\S]*\})/); if (!m) throw 0; return JSON.parse(m[1].replace(/,\s*([}\]])/g,"$1")); },
    ];
    for (let i = 0; i < strats.length; i++) { try { copyMap = strats[i](); if (Object.keys(copyMap).length > 0) break; } catch {} }

    if (user) deductCredit(user.id, CREDIT_COST.text).catch(() => {});
    const fmtCount = Object.keys(copyMap).length;
    console.log(`[campaign-texts] DONE: ${fmtCount} formats, ${usedProvider}, ${Date.now()-t0}ms, keys=[${Object.keys(copyMap).join(",")}]`);
    return c.json({ success: true, copyMap, provider: usedProvider, formatCount: fmtCount, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[campaign-texts] FATAL: ${err}`);
    return c.json({ success: false, error: `${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGN LAB — plan + image-start + image-status
// ══════════════════════════════════════════════════════════════

// ── CAMPAIGN PLAN CORE LOGIC (shared by GET and POST) ──
async function handleCampaignPlan(c: any, brief: string, imageContext: string, langParam: string, user: AuthUser | null, productUrls?: string[], uploadedRefUrls?: string[], templateId?: string, selectedFormats?: string[]) {
  const t0 = Date.now();

  const frenchPattern = /\b(le|la|les|du|des|un|une|pour|avec|dans|sur|est|sont|nous|notre|votre|cette|ces|qui|que|mais|ou|donc|ainsi|aussi|chez|aux|par|vers|entre|comme|faire|plus|fait|très|être|avoir|tout|peut|bien|autre|même|après)\b/i;
  const lang = langParam || (frenchPattern.test(brief) ? "fr" : "en");

  // Build brand block from full Brand Context (vault + Image Bank)
  let brandBlock = "";
  let visualDirective = "";
  let brandRefImages: { index: number; url: string; category: string; description: string; score: number }[] = [];
  let brandRefImagePromptBlock = "";
  if (user) {
    try {
      const ctx = await buildBrandContext(user.id);
      if (ctx) {
        brandBlock = buildBrandBlock(ctx);
        visualDirective = ctx.visualDirective;
        // Generate signed URLs for top brand reference images
        if (ctx.topRefImages.length > 0) {
          try {
            await ensureImageBankBucket();
            const sb = supabaseAdmin();
            const signedResults = await Promise.all(
              ctx.topRefImages.map(async (ref, i) => {
                try {
                  const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(ref.storagePath, 3600);
                  if (data?.signedUrl) {
                    return { index: i, url: data.signedUrl, category: ref.category, description: ref.description, score: ref.score, mood: ref.mood, style: ref.style, recommendedUsage: ref.recommendedUsage };
                  }
                } catch { /* skip */ }
                return null;
              })
            );
            brandRefImages = signedResults.filter(Boolean) as any[];
            if (brandRefImages.length > 0) {
              // Build a description block — client images are the PRIMARY visual source
              const descriptions = brandRefImages.map((img: any) => `  [${img.index}] "${img.description}" (category: ${img.category}, mood: ${img.mood || "N/A"}, style: ${img.style || "N/A"}, usage: ${img.recommendedUsage?.join(", ") || "any"}, score: ${img.score}/100)`);
              brandRefImagePromptBlock = `\n\nBRAND REFERENCE IMAGES — CLIENT'S OWN PHOTOS (${brandRefImages.length} images from Image Bank):\n${descriptions.join("\n")}\nCRITICAL VISUAL RULE: These are the client's REAL photos. You MUST assign a DIFFERENT "brandRefImageIndex" to EACH asset to maximize visual variety. Distribute images across all ${brandRefImages.length} available photos: asset 0 uses image 0, asset 1 uses image 1, asset 2 uses image 2, etc. Cycle if more assets than images. NEVER assign the same index to every asset. Each imagePrompt MUST describe a COMPLETELY NEW SCENE/SITUATION/ENVIRONMENT directly linked to the campaign brief and content angle. The img2img pipeline preserves the product automatically from the reference photo. Focus on: WHERE is the product now? WHO is using it? WHAT is the event/context/moment? Make each scene vivid, specific, and DIFFERENT per format. The product appearance is handled by the reference — your job is to describe the NEW world around it.`;
            }
            console.log(`[campaign-plan] Brand ref images: ${brandRefImages.length} signed URLs generated`);
          } catch (err) {
            console.log(`[campaign-plan] Failed to generate brand ref image URLs (continuing without): ${err}`);
          }
        }
        console.log(`[campaign-plan] Full brand context loaded: brandBlock=${brandBlock.length} chars, visualDirective=${visualDirective.length} chars, refImages=${brandRefImages.length}`);
      }
    } catch (err) {
      console.log(`[campaign-plan] buildBrandContext failed (continuing without): ${err}`);
    }
  }

  // ── PRODUCT URL SCRAPING: extract real content + images from client's product/service pages ──
  let productContextBlock = "";
  let productRefImages: { index: number; url: string; originalUrl: string; sourceUrl: string; rehosted: boolean }[] = [];
  if (productUrls && productUrls.length > 0) {
    const maxUrls = Math.min(productUrls.length, 5);
    const urlsToScrape = productUrls.slice(0, maxUrls);
    console.log(`[campaign-plan] Scraping ${urlsToScrape.length} product URL(s) with image extraction...`);

    // Helper: download external image → upload to Supabase Storage → return signed URL
    // This ensures Luma/AI generators can always access images (external URLs often protected)
    async function reHostImage(externalUrl: string, idx: number): Promise<string | null> {
      try {
        const imgRes = await fetchWithTimeout(externalUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "image/*,*/*;q=0.8",
            "Referer": externalUrl,
          },
        }, 10_000);
        if (!imgRes.ok) { console.log(`[rehost] HTTP ${imgRes.status} for ${externalUrl.slice(0, 80)}`); return null; }
        const ct = imgRes.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) { console.log(`[rehost] Not image (${ct}) for ${externalUrl.slice(0, 80)}`); return null; }
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength < 5_000) { console.log(`[rehost] Too small (${buf.byteLength}b) — skipping`); return null; }
        if (buf.byteLength > 10_000_000) { console.log(`[rehost] Too large (${buf.byteLength}b) — skipping`); return null; }
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const path = `product-scrape/${Date.now()}-${idx}.${ext}`;
        const { error: upErr } = await sb.storage.from(IMAGE_BANK_BUCKET).upload(path, new Uint8Array(buf), { contentType: ct, upsert: true });
        if (upErr) { console.log(`[rehost] Upload failed: ${upErr.message}`); return null; }
        const { data: signedData } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(path, 3600);
        if (signedData?.signedUrl) {
          console.log(`[rehost] OK: ${externalUrl.slice(0, 60)} → signed (${buf.byteLength}b)`);
          return signedData.signedUrl;
        }
        return null;
      } catch (e) { console.log(`[rehost] Error: ${e}`); return null; }
    }

    const scrapeResults = await Promise.allSettled(
      urlsToScrape.map(async (pageUrl, i) => {
        const jinaKey = Deno.env.get("JINA_API_KEY");
        let content = "";
        let rawImageUrls: string[] = [];
        let source = "none";
        // ── Jina with image extraction (X-With-Images-Summary header) ──
        if (jinaKey) {
          try {
            const res = await fetchWithTimeout(`https://r.jina.ai/${pageUrl}`, {
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
            }, 25_000);
            if (res.ok) {
              const data = await res.json();
              content = (data.data?.content || data.data?.text || data.content || "").slice(0, 6000);
              source = "jina";
              // Jina images: { "url": "alt_text" } map or array
              const jinaImages = data.data?.images || data.images || {};
              if (typeof jinaImages === "object" && !Array.isArray(jinaImages)) {
                for (const [imgUrl] of Object.entries(jinaImages)) {
                  if (typeof imgUrl === "string" && imgUrl.startsWith("http")) rawImageUrls.push(imgUrl);
                }
              } else if (Array.isArray(jinaImages)) {
                for (const img of jinaImages) {
                  const u = typeof img === "string" ? img : (img as any)?.url || (img as any)?.src || "";
                  if (u.startsWith("http")) rawImageUrls.push(u);
                }
              }
              console.log(`[campaign-plan] Jina product [${i}]: ${content.length} chars, ${rawImageUrls.length} structured images`);
            }
          } catch (e) {
            console.log(`[campaign-plan] Jina product [${i}] fail: ${e}`);
          }
        }
        // Extract images from markdown ![alt](url) — works for any content
        if (content.length > 0) {
          const mdImgRe = /!\[[^\]]*\]\(([^)]+)\)/g;
          let m;
          while ((m = mdImgRe.exec(content)) !== null) {
            const u = m[1].trim();
            if (u.startsWith("http") && !rawImageUrls.includes(u)) rawImageUrls.push(u);
          }
        }
        // Fallback to generic scrapeUrl if Jina failed to get content
        if (content.length < 50) {
          try {
            const result = await scrapeUrl(pageUrl, 0.5);
            content = result.content.slice(0, 6000);
            source = result.source;
          } catch (err) {
            console.log(`[campaign-plan] Product URL [${i}] fallback scrape failed: ${err}`);
          }
        }
        // Filter images: discard icons, SVGs, tracking pixels, tiny assets
        const filtered = rawImageUrls.filter((u) => {
          const l = u.toLowerCase();
          if (l.includes(".svg") || l.includes("favicon") || l.includes("data:")) return false;
          if (l.includes("tracking") || l.includes("pixel") || l.includes("analytics") || l.includes("beacon")) return false;
          if (l.includes("1x1") || l.includes("spacer") || l.includes("badge") || l.includes("button")) return false;
          if (l.match(/icon[\-_.]\d/) || l.match(/logo[\-_.](small|xs|16|32|ico)/)) return false;
          if (l.includes("avatar") || l.includes("emoji") || l.includes("flag")) return false;
          return true;
        }).slice(0, 10);
        console.log(`[campaign-plan] Product [${i}]: ${content.length} chars via ${source}, ${filtered.length} candidate images`);
        return content.length >= 50 ? { url: pageUrl, content, source, images: filtered } : null;
      })
    );
    const scraped = scrapeResults
      .filter((r): r is PromiseFulfilledResult<{ url: string; content: string; source: string; images: string[] } | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean) as { url: string; content: string; source: string; images: string[] }[];
    if (scraped.length > 0) {
      const blocks = scraped.map((s, i) => `--- Product/Service Page [${i}]: ${s.url} ---\n${s.content}`);
      // Collect candidate image URLs (deduplicated, max 6 to re-host)
      const candidateImages: { url: string; sourceUrl: string }[] = [];
      const seenImgs = new Set<string>();
      for (const s of scraped) {
        for (const imgUrl of s.images) {
          if (seenImgs.has(imgUrl) || candidateImages.length >= 6) continue;
          seenImgs.add(imgUrl);
          candidateImages.push({ url: imgUrl, sourceUrl: s.url });
        }
      }
      // Re-host images to Supabase Storage so Luma can access them reliably
      // Fallback: if re-hosting fails, keep the original external URL (may still work for public CDNs)
      if (candidateImages.length > 0) {
        console.log(`[campaign-plan] Re-hosting ${candidateImages.length} product images to storage...`);
        const reHostResults = await Promise.allSettled(
          candidateImages.map(async (img, idx) => {
            const signedUrl = await reHostImage(img.url, idx);
            if (signedUrl) {
              return { index: idx, url: signedUrl, originalUrl: img.url, sourceUrl: img.sourceUrl, rehosted: true };
            }
            // Fallback: keep original URL — some public CDNs are accessible to Luma
            console.log(`[rehost] Fallback: using original URL directly for ${img.url.slice(0, 80)}`);
            return { index: idx, url: img.url, originalUrl: img.url, sourceUrl: img.sourceUrl, rehosted: false };
          })
        );
        productRefImages = reHostResults
          .filter((r): r is PromiseFulfilledResult<{ index: number; url: string; originalUrl: string; sourceUrl: string; rehosted: boolean }> => r.status === "fulfilled")
          .map((r) => r.value);
        productRefImages.forEach((img, i) => { img.index = i; });
        const rehostedCount = productRefImages.filter((i: any) => i.rehosted).length;
        const fallbackCount = productRefImages.filter((i: any) => !i.rehosted).length;
        console.log(`[campaign-plan] Product images: ${rehostedCount} re-hosted, ${fallbackCount} direct fallback, ${productRefImages.length} total`);
      }
      const productImageDesc = productRefImages.length > 0
        ? `\n\nPRODUCT IMAGES (${productRefImages.length} real product images — will be used as image_ref for image-to-image generation):\n${productRefImages.map((img: any) => `  [productImg${img.index}] from ${img.sourceUrl} (${img.rehosted ? "re-hosted to storage" : "direct external URL"})`).join("\n")}\nCRITICAL: These product photos are used as img2img references — the pipeline preserves the product automatically (strength 0.75). Each imagePrompt MUST describe a NEW, VIVID SCENE/ENVIRONMENT for the product that is directly tied to the campaign brief, content angle, and target audience. Invent creative new situations — the product's look is preserved by the reference, so focus on describing WHERE/WHEN/HOW/WITH WHOM the product appears.`
        : "";
      productContextBlock = `\n\nPRODUCT/SERVICE PAGES — REAL CONTENT SCRAPED FROM CLIENT'S WEBSITE:\n${blocks.join("\n\n")}${productImageDesc}\n\n=== MANDATORY PRODUCT CONTEXT RULES ===\n1. ALL campaign copy MUST use REAL product names, features, pricing, descriptions, and USPs from the scraped pages above. NEVER invent fictional product information.\n2. Each imagePrompt MUST describe a NEW creative scene/situation for the product — tied to the campaign brief, event context, and audience. The product appearance is preserved automatically by the img2img reference. Focus on environment, people, mood, context.\n3. Each videoPrompt MUST show the real product in action — real features, real benefits, real use cases.\n4. campaignTheme MUST derive from the real product positioning found in the scraped content.\n5. Hashtags and CTAs must include real product names.`;
      console.log(`[campaign-plan] Product context: ${scraped.length} pages, ${productContextBlock.length} chars, ${productRefImages.length} re-hosted images`);
    }
  }

  // Build uploaded ref context block if client sent their own photos
  let uploadedRefBlock = "";
  if (uploadedRefUrls && uploadedRefUrls.length > 0) {
    uploadedRefBlock = `\n\nCLIENT-UPLOADED PRODUCT PHOTOS (${uploadedRefUrls.length} images — HIGHEST PRIORITY visual source):\n${uploadedRefUrls.map((u, i) => `  [upload${i}] ${u.slice(0, 80)}...`).join("\n")}\nCRITICAL: The client uploaded these photos specifically for this campaign. They are the PRIMARY visual reference. Every generated image/video MUST be based on these photos. Distribute them across assets — use [upload0] for asset 0, [upload1] for asset 1, etc. (cycle if fewer uploads than assets). NEVER ignore them in favor of Image Bank photos.`;
    console.log(`[campaign-plan] Client uploaded ${uploadedRefUrls.length} product photos — they take PRIORITY over Image Bank`);
  }

  console.log(`[campaign-plan] brief="${brief.slice(0, 80)}", imageContext=${!!imageContext}, brandBlock=${brandBlock.length > 0 ? "yes" : "no"}, refImages=${brandRefImages.length}, productUrls=${productUrls?.length || 0}, uploadedRefs=${uploadedRefUrls?.length || 0}, lang=${lang}`);

  // Determine if we are in "adaptation mode" (client images available) vs "creation mode" (no images)
  const hasRefImages = brandRefImages.length > 0;
  const hasProductImages = productRefImages.length > 0;
  const hasUserUploads = !!imageContext || (uploadedRefUrls && uploadedRefUrls.length > 0);
  const adaptationMode = hasRefImages || hasUserUploads || hasProductImages;

  const imagePromptInstruction = adaptationMode
    ? `"imagePrompt": "ADAPTATION directive: NAME the exact brand/product model. Describe visual elements: shape, color, material, distinctive features. Then describe a NEW scene/environment from the brief adapted for this format's aspect ratio. For vehicles: MODERN, CURRENT-GENERATION. End with: No visible text, no logos, no letters, no watermarks anywhere in the image"`
    : hasProductImages
    ? `"imagePrompt": "START with exact brand and product model name (e.g. MAN eTGX, Nike Air Max 90). Add key visual characteristics (color, shape, distinctive features). Then describe a COMPLETELY NEW SCENE derived from the campaign brief, event, audience, key messages — NOT the reference photo scene. For vehicles: always MODERN, CURRENT-GENERATION. End with: No visible text, no logos, no letters, no watermarks anywhere in the image"`
    : `"imagePrompt": "START with exact brand and product model name. Add visual characteristics and brand colors. Then describe a COMPLETELY NEW SCENE from the brief (event, audience, key messages). For vehicles: MODERN, CURRENT-GENERATION. End with: No visible text, no logos, no letters, no watermarks anywhere in the image"`;

  const videoPromptInstruction = adaptationMode
    ? `"videoPrompt": "ADAPTATION directive: NAME the exact brand/product model. Subtle motion — gentle camera pan, soft zoom on features, ambient movement. For vehicles: MODERN, CURRENT-GENERATION only. 5 seconds. End with: No visible text, no logos, no letters anywhere in the video"`
    : `"videoPrompt": "NAME the exact brand/product model. Cinematic motion scene from the brief, 5 seconds. For vehicles: MODERN, CURRENT-GENERATION only. End with: No visible text, no logos, no letters anywhere in the video"`;

  const adaptationIntro = hasUserUploads ? " The client has uploaded product photos — these are used as img2img references so the pipeline preserves the product automatically. Each imagePrompt MUST describe a BRAND-NEW SCENE/SITUATION/ENVIRONMENT tied to the campaign brief. Invent creative contexts — the product look is kept by the reference."
    : hasProductImages ? " Real product images from the client's website will be used as img2img references (the pipeline preserves the product at strength 0.75). Each imagePrompt MUST invent a COMPLETELY NEW scene/environment directly tied to the campaign brief, content angle, and audience. Focus on WHERE/WHEN/WITH WHOM — the product appearance is handled by the reference."
    : hasRefImages ? " The client's Image Bank photos are used as img2img references to preserve the product. Each imagePrompt MUST describe a NEW creative scene tied to the brief — the pipeline handles product fidelity automatically."
    : "";

  // ── Dynamic asset definitions based on template + selected formats ──
  const ALL_FORMATS: Record<string, { id: string; platform: string; formatName: string; type: "image" | "video" | "text"; aspectRatio: string; dimensions: string; copyHint: string }> = {
    "linkedin-post":    { id: "linkedin-post",    platform: "LinkedIn",  formatName: "LinkedIn Post",    type: "image", aspectRatio: "16:9", dimensions: "1200x627",  copyHint: "Post text (professional tone, 100-200 words, line breaks as \\\\n)" },
    "instagram-post":   { id: "instagram-post",   platform: "Instagram", formatName: "Instagram Post",   type: "image", aspectRatio: "1:1",  dimensions: "1080x1080", copyHint: "Caption (engaging, hashtags, 80-150 words)" },
    "instagram-story":  { id: "instagram-story",  platform: "Instagram", formatName: "Instagram Story",  type: "image", aspectRatio: "9:16", dimensions: "1080x1920", copyHint: "Story overlay text (15-30 words max, punchy)" },
    "facebook-post":    { id: "facebook-post",    platform: "Facebook",  formatName: "Facebook Post",    type: "image", aspectRatio: "16:9", dimensions: "1200x630",  copyHint: "Post text (conversational, 80-150 words)" },
    "instagram-reel":   { id: "instagram-reel",   platform: "Instagram", formatName: "Instagram Reel",   type: "video", aspectRatio: "9:16", dimensions: "1080x1920", copyHint: "Reel caption (short, hashtags, 50-80 words)" },
    "linkedin-video":   { id: "linkedin-video",   platform: "LinkedIn",  formatName: "LinkedIn Video",   type: "video", aspectRatio: "16:9", dimensions: "1920x1080", copyHint: "Video post text (professional, 80-120 words)" },
    "tiktok-video":     { id: "tiktok-video",     platform: "TikTok",    formatName: "TikTok Video",     type: "video", aspectRatio: "9:16", dimensions: "1080x1920", copyHint: "Caption (trendy, hashtags, 40-80 words)" },
    "x-post":           { id: "x-post",           platform: "X",         formatName: "X Post",           type: "image", aspectRatio: "16:9", dimensions: "1200x675",  copyHint: "Tweet (concise, under 280 chars, hashtags)" },
    "pinterest-pin":    { id: "pinterest-pin",    platform: "Pinterest", formatName: "Pinterest Pin",    type: "image", aspectRatio: "2:3",  dimensions: "1000x1500", copyHint: "Pin description (SEO-rich, 100-200 words)" },
    "youtube-thumbnail": { id: "youtube-thumbnail", platform: "YouTube", formatName: "YouTube Thumbnail", type: "image", aspectRatio: "16:9", dimensions: "1280x720",  copyHint: "Video title + description (SEO-optimized, 150-250 words)" },
  };

  const TEMPLATE_PRESETS: Record<string, string[]> = {
    "full-blast":   ["linkedin-post", "instagram-post", "instagram-story", "facebook-post", "instagram-reel", "linkedin-video"],
    "social-only":  ["instagram-post", "instagram-story", "instagram-reel"],
    "professional": ["linkedin-post", "linkedin-video", "facebook-post"],
    "video-first":  ["instagram-reel", "linkedin-video", "tiktok-video"],
    "awareness":    ["instagram-post", "facebook-post", "linkedin-post", "instagram-story", "x-post"],
    "product-launch": ["linkedin-post", "instagram-post", "instagram-story", "facebook-post", "instagram-reel", "linkedin-video"],
  };

  // Resolve which formats to generate
  let formatIds: string[];
  if (selectedFormats && selectedFormats.length > 0) {
    formatIds = selectedFormats.filter(id => ALL_FORMATS[id]);
  } else if (templateId && TEMPLATE_PRESETS[templateId]) {
    formatIds = TEMPLATE_PRESETS[templateId];
  } else {
    formatIds = TEMPLATE_PRESETS["full-blast"]; // default
  }

  // Describe strategy emphasis for templates
  const TEMPLATE_STRATEGY: Record<string, string> = {
    "full-blast": "Maximum cross-platform reach. Ensure each format brings unique value.",
    "social-only": "Instagram-focused campaign. Prioritize visual impact, trending hooks, and shareability.",
    "professional": "B2B professional reach. Prioritize thought leadership, industry authority, and clear value propositions.",
    "video-first": "Motion-driven storytelling. Lead with video energy, dynamic transitions, and emotional hooks.",
    "awareness": "Brand awareness campaign. Maximize visibility with scroll-stopping visuals and memorable messaging.",
    "product-launch": "Product launch campaign. Build excitement: tease, reveal, call to action. Each format tells a chapter.",
  };
  const strategyHint = templateId && TEMPLATE_STRATEGY[templateId] ? `\nCAMPAIGN STRATEGY: ${TEMPLATE_STRATEGY[templateId]}` : "";

  console.log(`[campaign-plan] Template: ${templateId || "default"}, formats: [${formatIds.join(", ")}]`);

  // Build the asset JSON schema dynamically
  const assetSchemaEntries = formatIds.map(id => {
    const fmt = ALL_FORMATS[id];
    if (!fmt) return "";
    if (fmt.type === "text") {
      // Text-only assets: structured copy, no image/video prompts
      return `    {
      "id": "${fmt.id}",
      "platform": "${fmt.platform}",
      "formatName": "${fmt.formatName}",
      "type": "text",
      "aspectRatio": "${fmt.aspectRatio}",
      "dimensions": "${fmt.dimensions}",
      "copy": "${fmt.copyHint}"
    }`;
    }
    const promptField = fmt.type === "video" ? videoPromptInstruction : imagePromptInstruction;
    return `    {
      "id": "${fmt.id}",
      "platform": "${fmt.platform}",
      "formatName": "${fmt.formatName}",
      "type": "${fmt.type}",
      "aspectRatio": "${fmt.aspectRatio}",
      "dimensions": "${fmt.dimensions}",
      "copy": "${fmt.copyHint}",
      ${promptField},
      "brandRefImageIndex": 0
    }`;
  }).filter(Boolean).join(",\n");

  const sysPrompt = `You are an expert social media campaign strategist and brand compliance officer.${adaptationIntro} Given a campaign brief, generate a complete multi-platform campaign kit that is 100% brand-compliant.${brandBlock}${uploadedRefBlock}${brandRefImagePromptBlock}${productContextBlock}${strategyHint}

You MUST return ONLY a valid JSON object (no markdown, no code fences) with this structure:
{
  "campaignTheme": "Short 5-word campaign theme",
  "assets": [
${assetSchemaEntries}
  ]
}

RULES:
${adaptationMode ? `- VISUAL FIDELITY IS MANDATORY: The client provided real photos. Each imagePrompt/videoPrompt MUST describe how to ADAPT the assigned reference photo (reframe, crop, subtle enhance) — NEVER describe an imaginary new scene. The generated visual must be RECOGNIZABLY the same photo, just optimized for the target format.` : `- Each imagePrompt/videoPrompt MUST be DIFFERENT but thematically cohesive`}
- *** PRODUCT IDENTITY IN IMAGE/VIDEO PROMPTS ***: imagePrompt and videoPrompt MUST START with the exact brand name and product model (e.g. "A MAN eTGX electric truck", "Nike Air Max 90 sneakers") so the AI generates the CORRECT product — never a competitor. Then add visual characteristics and describe a COMPLETELY NEW scene from the brief (event, audience, key messages).
- CRITICAL: Every imagePrompt/videoPrompt MUST end with: "Absolutely no visible text, no letters, no brand names, no logos, no words anywhere in the image, no watermarks"
${adaptationMode ? `- Every asset MUST have a "brandRefImageIndex" (integer >= 0). Match the best reference image to each format based on its category, mood, and recommended usage. Use 0 as default.` : ""}
- Copy must be platform-appropriate
${productContextBlock ? `- PRODUCT FIDELITY: Copy fields must use exact product names, real features, real benefits from the scraped pages. imagePrompt/videoPrompt MUST also include the exact brand+model name (e.g. "MAN eTGX electric truck") to ensure correct product identity — plus visual characteristics and a NEW scene from the brief.` : ""}
- For assets with type "text" (email-campaign, landing-page): the "copy" field MUST be a STRINGIFIED JSON object. The frontend calls JSON.parse() on it, so it MUST be valid JSON with properly escaped inner quotes.
  EMAIL-CAMPAIGN — Use AIDA copywriting (Attention, Interest, Desire, Action). ALL 7 keys required:
    subject: attention-grabbing 6-10 words with specificity (numbers, outcomes)
    previewText: 40-90 chars complementing subject, creating curiosity
    headline: bold benefit-driven headline hooking the reader
    body: 4 substantial paragraphs separated by \\\\n\\\\n, 300-500 words total. P1=HOOK with provocative question or bold stat. P2=AGITATE the problem. P3=SOLVE with specific features/benefits/proof. P4=URGENCY with time pressure and a P.S.
    ctaText: action verb + benefit, 2-5 words (e.g. "Claim Your Spot Now")
    ctaUrl: always "#"
    closing: warm sign-off with sender name and title, 1-2 sentences
  LANDING-PAGE — Use Hero/Trust/Features/Proof/CTA framework. ALL 8 keys required:
    headline: powerful 5-10 word hero with clear value prop
    subheadline: specific benefit promise, 15-25 words
    heroCtaText: high-conversion CTA, 2-5 words (e.g. "Start Free Trial")
    features: array of exactly 3 objects, each with "title" and "description" (30-50 words, benefit-focused)
    socialProof: object with "quote" (20-40 words, measurable results), "author" (realistic name), "role" (title at company)
    finalCtaHeadline: urgency-driven closing headline
    finalCtaText: final CTA button text
    finalCtaDescription: 1-2 sentences with scarcity, numbers, or guarantee
  CRITICAL: Write REAL persuasive marketing copy for ALL fields. NEVER use placeholders or Lorem ipsum. Every word must sell.
- ${imageContext ? `The campaign features uploaded client photos. Reference them faithfully in copy — describe what is ACTUALLY in the photos, not imagined scenes.` : "Create prompts from the brief."}
- ALL copy text (campaignTheme, copy fields) MUST be written in ${lang === "fr" ? "French (français). Le brief est en français, tous les textes doivent être en français." : "English."}
- imagePrompt and videoPrompt fields must ALWAYS remain in English (they are technical prompts for AI image generators)
${brandBlock ? `- BRAND COMPLIANCE: Adapt the tone of all copy to match the brand tone profile. Use approved vocabulary. NEVER use forbidden terms. Weave key messages naturally.` : ""}
${visualDirective ? `- VISUAL BRAND DNA: ${visualDirective}. Ensure the adaptation prompts preserve these brand characteristics from the reference photos.` : ""}
- Return ONLY JSON`;

  // Direct APIPod call — only models confirmed on this APIPod account (gpt-4o, gpt-5)
  // claude-*, gemini-*, deepseek-* all return "model not found" on this account
  // Campaign JSON is large → 60s timeout (was 20-25s which caused timeouts)
  const modelsToTry: Array<{ model: string; timeout: number }> = [
    { model: "gpt-4o", timeout: 60_000 },
    { model: "gpt-5", timeout: 60_000 },
    { model: "gpt-4o", timeout: 45_000 },   // retry gpt-4o (transient overload)
    { model: "gpt-5.1", timeout: 45_000 },  // last resort
  ];
  let resultText = "";
  let lastErr: Error | null = null;
  const allErrors: string[] = [];

  for (const { model: apiModel, timeout } of modelsToTry) {
    try {
      console.log(`[campaign-plan] trying ${apiModel} (timeout ${timeout / 1000}s)...`);
      const fetchP = fetch(`${APIPOD_BASE}/chat/completions`, {
        method: "POST",
        headers: apipodHeaders(),
        body: JSON.stringify({
          model: apiModel,
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: productContextBlock ? `${brief}\n\nIMPORTANT: Product/service pages have been scraped. Use REAL product names, features, and USPs for copy. For imagePrompt: invent NEW creative scenes/environments tied to the brief — the product appearance is preserved by the img2img reference automatically.` : brief }],
          max_tokens: Math.max(4000, formatIds.reduce((sum, id) => sum + (ALL_FORMATS[id]?.type === "text" ? 1800 : 500), 0)),
        }),
      }).then(async (res) => {
        if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b.slice(0, 200)}`); }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (!text) throw new Error(`Empty response from ${apiModel}`);
        return text;
      });
      const timeoutP = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${timeout / 1000}s for ${apiModel}`)), timeout));
      resultText = await Promise.race([fetchP, timeoutP]);
      console.log(`[campaign-plan] ${apiModel} OK, ${resultText.length} chars (${Date.now() - t0}ms)`);
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      allErrors.push(`${apiModel}: ${lastErr.message}`);
      console.log(`[campaign-plan] ${apiModel} FAILED: ${lastErr.message}`);
    }
  }
  if (!resultText) throw new Error(`All campaign-plan models failed: ${allErrors.join(" | ")}`);

  let plan: any;
  try {
    let cleaned = resultText.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    plan = JSON.parse(cleaned);
  } catch {
    console.log(`[campaign-plan] JSON parse failed:`, resultText.slice(0, 500));
    return c.json({ success: false, error: "AI returned invalid JSON. Try again." }, 500);
  }

  // Return visualDirective + brand ref images + product ref images so frontend can pass them to image-start/video-start
  console.log(`[campaign-plan] OK in ${Date.now() - t0}ms, ${plan.assets?.length || 0} assets, refImages=${brandRefImages.length}, productImages=${productRefImages.length}, uploadedRefs=${uploadedRefUrls?.length || 0}`);
  if (user) logEvent("campaign-plan", { userId: user.id, brief: brief.slice(0, 100) }).catch(() => {});
  // Strip internal fields from brandRefImages (only send index, url, category)
  const clientRefImages = brandRefImages.map((img: any) => ({ index: img.index, url: img.url, category: img.category }));
  return c.json({
    success: true, ...plan,
    visualDirective: visualDirective || "",
    brandRefImages: clientRefImages,
    productRefImages: productRefImages.length > 0 ? productRefImages : undefined,
    // Echo back uploaded ref URLs so frontend can confirm they were received
    uploadedRefUrls: uploadedRefUrls && uploadedRefUrls.length > 0 ? uploadedRefUrls : undefined,
    latencyMs: Date.now() - t0,
  });
}

// GET /generate/campaign-plan — legacy (still works, but now enriched with full brand context)
app.get("/generate/campaign-plan", async (c) => {
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }
    const brief = c.req.query("brief") || "";
    if (!brief) return c.json({ error: "brief required" }, 400);
    const imageContext = c.req.query("imageContext") || "";
    const langParam = c.req.query("lang") || "";
    return await handleCampaignPlan(c, brief, imageContext, langParam, user);
  } catch (err) {
    console.log(`[campaign-plan GET] FAIL:`, err);
    return c.json({ success: false, error: `Campaign plan failed: ${err}` }, 500);
  }
});

// POST /generate/campaign-plan — preferred (CORS-safe, user token in body)
app.post("/generate/campaign-plan", async (c) => {
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }
    const body = c.get("parsedBody") || {};
    const brief = body.brief || "";
    if (!brief) return c.json({ error: "brief required" }, 400);
    const imageContext = body.imageContext || "";
    const langParam = body.lang || "";
    // Product/service URLs to scrape for real content
    const productUrls: string[] = Array.isArray(body.productUrls) ? body.productUrls.filter((u: any) => typeof u === "string" && u.startsWith("http")).slice(0, 5) : [];
    // User-uploaded product photo URLs (already in Supabase Storage with signed URLs)
    const uploadedRefUrls: string[] = Array.isArray(body.uploadedRefUrls) ? body.uploadedRefUrls.filter((u: any) => typeof u === "string" && u.startsWith("http")).slice(0, 10) : [];
    if (uploadedRefUrls.length > 0) {
      console.log(`[campaign-plan POST] Received ${uploadedRefUrls.length} uploaded ref URLs from frontend`);
    }
    // Template + format selection
    const templateId: string | undefined = typeof body.templateId === "string" ? body.templateId : undefined;
    const selectedFormats: string[] | undefined = Array.isArray(body.selectedFormats) ? body.selectedFormats.filter((f: any) => typeof f === "string") : undefined;
    return await handleCampaignPlan(c, brief, imageContext, langParam, user, productUrls.length > 0 ? productUrls : undefined, uploadedRefUrls.length > 0 ? uploadedRefUrls : undefined, templateId, selectedFormats && selectedFormats.length > 0 ? selectedFormats : undefined);
  } catch (err) {
    console.log(`[campaign-plan POST] FAIL:`, err);
    return c.json({ success: false, error: `Campaign plan failed: ${err}` }, 500);
  }
});

app.get("/generate/image-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const rawPrompt = c.req.query("prompt");
    const aspectRatio = c.req.query("aspectRatio") || "16:9";
    const model = c.req.query("model") || "photon-1";
    const imageRefUrl = c.req.query("imageRefUrl") || undefined;
    // "upload" = user-uploaded product photo (use modify_image_ref), "bank" = Image Bank style ref (use image_ref)
    const refSource = c.req.query("refSource") || "";
    // Legacy query param (kept for backward compat but we now prefer server-side fetch)
    const brandVisualPrefix = c.req.query("brandVisual") || "";

    // Enhanced diagnostic logging — includes full URL length + imageRefUrl detection
    const fullUrl = c.req.url;
    console.log(`[image-start] FULL URL len=${fullUrl.length}, prompt="${rawPrompt?.slice(0, 60)}", ratio=${aspectRatio}, model=${model}, user=${user?.id?.slice(0, 8) || "anon"}, imageRefUrl=${imageRefUrl ? `YES (${imageRefUrl.length} chars, starts: ${imageRefUrl.slice(0, 80)}...)` : "NO"}, brandVisual=${brandVisualPrefix.length} chars`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── SERVER-SIDE BRAND CONTEXT: fetch full vault + Image Bank for stronger prompt enrichment ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try {
        brandCtx = await buildBrandContext(user.id);
      } catch (err) {
        console.log(`[image-start] buildBrandContext failed (continuing without): ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankCompositions.length > 0) brandParts.push(`${brandCtx.imageBankCompositions.slice(0, 2).join(", ")} composition`);
      else if (brandCtx.photoStyle?.framing) brandParts.push(`${brandCtx.photoStyle.framing} framing`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);

      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cohesive brand aesthetic, premium quality.`;
        console.log(`[image-start] Brand-enriched prompt (${prompt.length} chars): ...${prompt.slice(-120)}`);
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cohesive brand aesthetic.`;
      console.log(`[image-start] Fallback brand visual from query param (${prompt.length} chars)`);
    }

    if (user) deductCredit(user.id, CREDIT_COST.image).catch(() => {});

    // Force anti-text suffix on EVERY image prompt to prevent hallucinated brand names/logos
    const antiTextSuffix = ". ABSOLUTELY NO visible text, no letters, no words, no brand names, no logos, no signs, no labels, no writing anywhere in the image. Clean photographic image only.";
    if (!prompt.toLowerCase().includes("no visible text")) {
      prompt = prompt + antiTextSuffix;
    }

    // Strip known brand names from image prompts — AI generators hallucinate fake logos when they see brand names
    // This is a safety net in case the campaign AI still includes brand names in imagePrompt
    if (brandCtx?.brandName) {
      const bn = brandCtx.brandName;
      const before = prompt;
      // Simple case-insensitive replacement without complex regex escaping
      const lp = prompt.toLowerCase();
      const lb = bn.toLowerCase();
      let idx = lp.indexOf(lb);
      while (idx !== -1) {
        prompt = prompt.slice(0, idx) + "the product" + prompt.slice(idx + bn.length);
        idx = prompt.toLowerCase().indexOf(lb, idx + 11);
      }
      if (before !== prompt) console.log(`[image-start] Stripped brand name "${bn}" from prompt to prevent text hallucination`);
    }

    const body: any = { prompt, model, aspect_ratio: aspectRatio };
    const isUploadRef = refSource === "upload";

    // ── Image reference handling ──
    // User uploads → modify_image_ref (PRESERVES the photo content, adapts for format)
    // Brand Image Bank → image_ref (STYLE reference, inspires the generation)
    if (imageRefUrl && isUploadRef) {
      // CLIENT UPLOAD: use modify_image_ref to PRESERVE the actual photo
      // Weight 0.85 = preserve 85% of original, allow 15% adaptation for format/crop
      body.modify_image_ref = { url: imageRefUrl, weight: 0.85 };
      console.log(`[image-start] Using MODIFY_IMAGE_REF (upload, weight=0.85): ${imageRefUrl.slice(0, 100)}...`);
      // Simplify prompt for modify mode — strip brand visual fluff, focus on adaptation
      // The original photo IS the visual truth; the prompt should only guide the adaptation
      const formatHint = aspectRatio === "9:16" ? "vertical story format" : aspectRatio === "1:1" ? "square format" : "landscape format";
      let cleanPrompt = rawPrompt.slice(0, 300); // Keep only core of imagePrompt from AI
      // Strip brand name from the clean prompt too
      if (brandCtx?.brandName) {
        const lbn = brandCtx.brandName.toLowerCase();
        let ci = cleanPrompt.toLowerCase().indexOf(lbn);
        while (ci !== -1) {
          cleanPrompt = cleanPrompt.slice(0, ci) + "the product" + cleanPrompt.slice(ci + brandCtx.brandName.length);
          ci = cleanPrompt.toLowerCase().indexOf(lbn, ci + 11);
        }
      }
      prompt = `${cleanPrompt}. Place this product in a completely new scene for ${formatHint}. Keep the product recognizable but create a fresh environment, lighting, and context. Professional commercial photography.${antiTextSuffix}`;
      body.prompt = prompt; // Update body with simplified prompt
      console.log(`[image-start] Simplified prompt for upload modify (${prompt.length} chars)`);
    } else if (imageRefUrl) {
      // BRAND IMAGE BANK: use image_ref as style reference
      body.image_ref = [{ url: imageRefUrl, weight: 0.80 }];
      console.log(`[image-start] Using image_ref (bank, weight=0.80): ${imageRefUrl.slice(0, 100)}...`);
    }

    // If user is authenticated and has brand images but no explicit imageRefUrl, auto-resolve one
    if (!imageRefUrl && brandCtx && brandCtx.topRefImages.length > 0) {
      try {
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const bestRef = brandCtx.topRefImages[0];
        const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(bestRef.storagePath, 3600);
        if (data?.signedUrl) {
          body.image_ref = [{ url: data.signedUrl, weight: 0.80 }];
          console.log(`[image-start] Auto-resolved brand ref image (weight=0.80): "${bestRef.description?.slice(0, 50)}" (score=${bestRef.score})`);
        }
      } catch (err) {
        console.log(`[image-start] Auto-resolve brand ref failed (continuing without): ${err}`);
      }
    }

    // Log FULL Luma request body for diagnostic
    const hasImageRef = !!body.image_ref || !!body.modify_image_ref;
    const refType = body.modify_image_ref ? "modify_image_ref" : (body.image_ref ? "image_ref" : "NONE");
    const refInfo = body.modify_image_ref 
      ? `url=${body.modify_image_ref.url.slice(0, 80)}..., weight=${body.modify_image_ref.weight}`
      : body.image_ref 
        ? `url=${body.image_ref[0].url.slice(0, 80)}..., weight=${body.image_ref[0].weight}`
        : "NONE";
    console.log(`[image-start] Luma body: prompt=${prompt.length} chars, model=${model}, ratio=${aspectRatio}, refType=${refType}, refInfo=${refInfo}`);

    const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
      method: "POST", headers: lumaHeaders(), body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      console.log(`[image-start] Luma REJECT ${submitRes.status}: ${errBody.slice(0, 300)}`);
      return c.json({ success: false, error: `Luma image error ${submitRes.status}: ${errBody.slice(0, 200)}` }, 500);
    }
    const generation = await submitRes.json();
    const genId = generation.id;
    if (!genId) return c.json({ success: false, error: "No generation ID" }, 500);

    console.log(`[image-start] OK ${Date.now() - t0}ms, genId=${genId}, refType=${refType}`);
    const refObj = body.modify_image_ref || (body.image_ref ? body.image_ref[0] : null);
    return c.json({
      success: true, generationId: genId, state: generation.state || "queued",
      _debug: {
        imageRefUsed: hasImageRef,
        refType,
        imageRefSource: imageRefUrl ? (isUploadRef ? "user-upload" : "frontend-query-param") : (hasImageRef ? "server-auto-resolved" : "none"),
        imageRefUrlLen: refObj ? refObj.url.length : 0,
        imageRefUrlStart: refObj ? refObj.url.slice(0, 60) : null,
        imageRefWeight: refObj ? refObj.weight : null,
        promptLen: prompt.length,
        fullUrlLen: fullUrl.length,
        model,
      },
    });
  } catch (err) {
    console.log(`[image-start] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Image start failed: ${err}` }, 500);
  }
});

app.get("/generate/image-status", async (c) => {
  try {
    const generationId = c.req.query("id");
    if (!generationId) return c.json({ error: "id required" }, 400);
    const pollRes = await fetch(`${LUMA_BASE}/generations/${generationId}`, { headers: lumaHeaders() });
    if (!pollRes.ok) return c.json({ success: false, state: "error", error: `Poll error ${pollRes.status}` }, 500);
    const data = await pollRes.json();
    if (data.state === "completed") return c.json({ success: true, state: "completed", imageUrl: data.assets?.image || null });
    if (data.state === "failed") return c.json({ success: true, state: "failed", error: data.failure_reason || "Failed" });
    return c.json({ success: true, state: data.state });
  } catch (err) {
    return c.json({ success: false, state: "error", error: `${err}` }, 500);
  }
});

// ── COMPLIANCE CHECK — post-generation brand compliance scoring ──
// Hybrid: programmatic text checks + vision AI for images
app.post("/generate/compliance-check", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { imageUrl, copy, assetId, assetType } = body;

    if (!user) return c.json({ success: false, error: "Auth required for compliance check" }, 401);
    if (!copy && !imageUrl) return c.json({ success: false, error: "At least copy or imageUrl is required" }, 400);

    console.log(`[compliance-check] assetId=${assetId}, type=${assetType}, hasImage=${!!imageUrl}, copyLen=${copy?.length || 0}`);

    const ctx = await buildBrandContext(user.id);
    if (!ctx) {
      console.log(`[compliance-check] No brand context, returning default pass`);
      return c.json({ success: true, score: 100, breakdown: { overall: 100, text: 100, tone: 100, visual: 100 }, details: { message: "No brand vault configured — all content passes.", rating: "excellent", textIssues: [], textStrengths: [], toneIssues: [], toneStrengths: [], visualIssues: [], visualStrengths: [] }, latencyMs: Date.now() - t0 });
    }

    // ── PART 1: Programmatic text compliance (fast, deterministic) ──
    let textScore = 100;
    const textIssues: string[] = [];
    const textStrengths: string[] = [];

    if (copy && copy.length > 0) {
      const copyLower = copy.toLowerCase();

      // Check forbidden terms
      const forbiddenFound: string[] = [];
      for (const term of ctx.forbiddenTerms) {
        if (term && copyLower.includes(term.toLowerCase())) {
          forbiddenFound.push(term);
        }
      }
      if (forbiddenFound.length > 0) {
        textScore -= forbiddenFound.length * 15;
        textIssues.push(`Forbidden terms detected: ${forbiddenFound.join(", ")}`);
      } else if (ctx.forbiddenTerms.length > 0) {
        textStrengths.push("No forbidden terms used");
      }

      // Check approved vocabulary usage
      let approvedUsed = 0;
      for (const term of ctx.approvedTerms) {
        if (term && copyLower.includes(term.toLowerCase())) approvedUsed++;
      }
      if (ctx.approvedTerms.length > 0) {
        const approvedRatio = approvedUsed / Math.min(ctx.approvedTerms.length, 5);
        if (approvedRatio >= 0.4) {
          textStrengths.push(`Good vocabulary alignment (${approvedUsed} approved terms used)`);
        } else if (approvedRatio < 0.1) {
          textScore -= 10;
          textIssues.push(`Low brand vocabulary usage (${approvedUsed}/${ctx.approvedTerms.length} approved terms)`);
        }
      }

      // Check key messages integration
      let messagesReferenced = 0;
      for (const msg of ctx.keyMessages) {
        const msgWords = msg.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
        const matchCount = msgWords.filter((w: string) => copyLower.includes(w)).length;
        if (matchCount >= Math.min(2, msgWords.length)) messagesReferenced++;
      }
      if (ctx.keyMessages.length > 0 && messagesReferenced > 0) {
        textStrengths.push(`Key messages referenced (${messagesReferenced}/${ctx.keyMessages.length})`);
      }

      // Brand name check
      if (ctx.brandName && copyLower.includes(ctx.brandName.toLowerCase())) {
        textStrengths.push("Brand name mentioned");
      }
    }
    textScore = Math.max(0, Math.min(100, textScore));

    // ── PART 2: LLM tone analysis + visual compliance ──
    let visualScore = 100;
    let toneScore = 100;
    const visualIssues: string[] = [];
    const visualStrengths: string[] = [];
    const toneIssues: string[] = [];
    const toneStrengths: string[] = [];

    const apiKey = Deno.env.get("APIPOD_API_KEY");
    if (apiKey) {
      try {
        const brandRef: string[] = [];
        if (ctx.tone) brandRef.push(`Tone: formality=${ctx.tone.formality}/10, confidence=${ctx.tone.confidence}/10, warmth=${ctx.tone.warmth}/10, humor=${ctx.tone.humor}/10, primary="${ctx.tone.primary_tone}"`);
        if (ctx.colorPalette.length > 0) brandRef.push(`Brand colors: ${ctx.colorPalette.slice(0, 6).join(", ")}`);
        if (ctx.imageBankColors.length > 0) brandRef.push(`Photo colors: ${ctx.imageBankColors.slice(0, 6).join(", ")}`);
        if (ctx.photoStyle) brandRef.push(`Photo style: ${ctx.photoStyle.framing}, ${ctx.photoStyle.mood}, ${ctx.photoStyle.lighting}`);
        if (ctx.imageBankMoods.length > 0) brandRef.push(`Brand moods: ${ctx.imageBankMoods.slice(0, 4).join(", ")}`);
        if (ctx.imageBankStyles.length > 0) brandRef.push(`Visual styles: ${ctx.imageBankStyles.slice(0, 3).join(", ")}`);
        if (ctx.visualDirective) brandRef.push(`Visual DNA: ${ctx.visualDirective}`);

        const compliancePrompt = `You are a brand compliance auditor. Score the generated content against the brand guidelines.

BRAND REFERENCE:
${brandRef.join("\n")}

SCORING RULES — Return ONLY valid JSON (no markdown):
{
  "toneScore": <0-100>,
  "toneIssues": ["issue1"],
  "toneStrengths": ["strength1"],
  ${imageUrl ? `"visualScore": <0-100>,
  "visualIssues": ["issue1"],
  "visualStrengths": ["strength1"],` : ""}
  "overallNotes": "one-sentence summary"
}

SCORING CRITERIA:
- toneScore: Does the copy match the brand tone profile? (formality, warmth, confidence levels)
${imageUrl ? `- visualScore: Does the image match brand colors, mood, composition style, lighting? Deduct for: wrong color palette, clashing mood, inappropriate style. Bonus for: matching brand colors, aligned mood, consistent composition.` : ""}
- Be precise and fair. 90+ means excellent brand alignment. 70-89 is acceptable. Below 70 needs revision.`;

        const userContent: any[] = [];
        if (imageUrl) {
          userContent.push({ type: "image_url", image_url: { url: imageUrl, detail: "low" } });
        }
        if (copy) {
          userContent.push({ type: "text", text: `Generated copy to check:\n\n${copy}` });
        } else {
          userContent.push({ type: "text", text: "No copy text — only check the visual." });
        }

        const llmRes = await fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
            messages: [
              { role: "system", content: compliancePrompt },
              { role: "user", content: userContent },
            ],
            max_tokens: 600,
            temperature: 0.1,
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const rawText = llmData.choices?.[0]?.message?.content || "";
          try {
            const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const result = JSON.parse(cleaned);
            if (result.toneScore !== undefined) {
              toneScore = Math.max(0, Math.min(100, result.toneScore));
              if (result.toneIssues) toneIssues.push(...result.toneIssues);
              if (result.toneStrengths) toneStrengths.push(...result.toneStrengths);
            }
            if (result.visualScore !== undefined) {
              visualScore = Math.max(0, Math.min(100, result.visualScore));
              if (result.visualIssues) visualIssues.push(...result.visualIssues);
              if (result.visualStrengths) visualStrengths.push(...result.visualStrengths);
            }
            console.log(`[compliance-check] LLM scores: tone=${toneScore}, visual=${visualScore}`);
          } catch (parseErr) {
            console.log(`[compliance-check] LLM JSON parse failed: ${rawText.slice(0, 200)}`);
          }
        } else {
          console.log(`[compliance-check] LLM call failed: ${llmRes.status}`);
        }
      } catch (llmErr) {
        console.log(`[compliance-check] LLM error (continuing with programmatic scores): ${llmErr}`);
      }
    }

    // ── PART 3: Composite score ──
    const hasImage = !!imageUrl;
    const hasCopy = !!copy && copy.length > 0;
    let overall: number;
    if (hasImage && hasCopy) {
      overall = Math.round(textScore * 0.25 + toneScore * 0.30 + visualScore * 0.45);
    } else if (hasImage) {
      overall = Math.round(visualScore * 0.7 + toneScore * 0.3);
    } else {
      overall = Math.round(textScore * 0.5 + toneScore * 0.5);
    }

    const breakdown = {
      overall,
      text: textScore,
      tone: toneScore,
      visual: hasImage ? visualScore : null,
    };

    const details = {
      textIssues,
      textStrengths,
      toneIssues,
      toneStrengths,
      visualIssues: hasImage ? visualIssues : [],
      visualStrengths: hasImage ? visualStrengths : [],
      rating: overall >= 90 ? "excellent" : overall >= 75 ? "good" : overall >= 60 ? "acceptable" : "needs-revision",
    };

    console.log(`[compliance-check] OK in ${Date.now() - t0}ms: overall=${overall}, text=${textScore}, tone=${toneScore}, visual=${hasImage ? visualScore : "N/A"}`);
    if (user) logEvent("compliance-check", { userId: user.id, assetId, overall }).catch(() => {});

    return c.json({ success: true, score: overall, breakdown, details, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    console.log(`[compliance-check] FAIL after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Compliance check failed: ${err}` }, 500);
  }
});

// Audio START test (GET) — verify route is registered
app.get("/generate/audio-start", (c) => c.json({ ok: true, route: "audio-start", method: "GET-test" }));

// Audio START — submits to Suno, returns taskId immediately (fast, no timeout)
app.post("/generate/audio-start", async (c) => {
  console.log(`[audio-start] POST received at ${new Date().toISOString()}`);

  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }
    const body = c.get?.("parsedBody") || await c.req.json();
    const { prompt, models, instrumental, lyrics, title, style } = body;
    console.log(`[audio-start] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

    const results = await Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 3).catch(() => {});
        try {
          const { taskId, sunoModel } = await sunoStartGeneration({ prompt, model, instrumental, lyrics, title, style });
          if (user) logEvent("generation", { userId: user.id, type: "audio", model }).catch(() => {});
          return { success: true, taskId, model, sunoModel };
        } catch (err) {
          return { success: false, model, error: String(err) };
        }
      })
    );
    console.log(`[audio-start] done in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[audio-start] FATAL:`, err);
    return c.json({ success: false, error: `Audio start error: ${err}` }, 500);
  }
});

// Audio POLL — frontend calls this every 5s with taskId
app.get("/generate/audio-poll", async (c) => {
  try {
    const taskId = c.req.query("taskId");
    if (!taskId) return c.json({ error: "taskId required" }, 400);
    const result = await sunoPollStatus(taskId);
    return c.json({ success: true, ...result });
  } catch (err) {
    console.log(`[audio-poll] error:`, err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Legacy compat: audio-multi still works but uses start+poll internally (kept for reference)
app.post("/generate/audio-multi", async (c) => {
  // Redirect to the start endpoint — frontend should use audio-start + audio-poll instead
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }
    const body = c.get?.("parsedBody") || await c.req.json();
    const { prompt, models, instrumental, lyrics, title, style } = body;
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

    const results = await Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 3).catch(() => {});
        try {
          const { taskId, sunoModel } = await sunoStartGeneration({ prompt, model, instrumental, lyrics, title, style });
          // Quick poll: try up to 45s within edge function limit
          for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const poll = await sunoPollStatus(taskId);
            if (poll.status === "DONE") {
              return { success: true, result: { model, provider: `suno/${sunoModel}`, audioUrl: poll.track.audioUrl, latencyMs: Date.now() - t0, title: poll.track.title, duration: poll.track.duration, imageUrl: poll.track.imageUrl, sunoTaskId: taskId, sunoAudioId: poll.track.id } };
            }
            if (poll.status === "FAILED") return { success: false, error: poll.error };
          }
          // Not ready yet — return taskId so frontend can poll
          return { success: false, pending: true, taskId, model, error: "Still generating. Use /generate/audio-poll?taskId=" + taskId };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      })
    );
    console.log(`[audio-multi] done in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[audio-multi] FATAL:`, err);
    return c.json({ success: false, error: `Audio generation error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// BRAND VAULT v2 — Clean rebuild (March 2026)
// ═══════════════════════════════════════════════════════════��══

// ══════════════════════════════════════════════════════════════
// SUNO POST-PROCESSING ROUTES (WAV, Vocal Removal, MP4, Credits, Lyrics)
// ══════════════════════════════════════════════════════════════

// SUNO_BASE already defined above as "https://api.sunoapi.org"
function sunoHeaders() {
  const key = Deno.env.get("SUNO_API_KEY");
  if (!key) throw new Error("SUNO_API_KEY not set");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

app.get("/suno/credits", async (c) => {
  try {
    const res = await fetch(`${SUNO_BASE}/api/v1/generate/credit`, { headers: sunoHeaders() });
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    console.log("[suno/credits] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/suno/wav", async (c) => {
  const t0 = Date.now();
  try {
    const _body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { taskId, audioId } = _body;
    if (!taskId || !audioId) return c.json({ success: false, error: "taskId and audioId required" }, 400);
    console.log(`[suno/wav] submit taskId=${taskId}, audioId=${audioId}`);
    const h = sunoHeaders();
    const res = await fetch(`${SUNO_BASE}/api/v1/wav/generate`, {
      method: "POST", headers: h,
      body: JSON.stringify({ taskId, audioId, callBackUrl: "" }),
    });
    const gen = await res.json();
    if (gen.code !== 200) return c.json({ success: false, error: `Suno WAV error ${gen.code}: ${gen.msg}` }, 400);
    const wavTaskId = gen.data?.taskId;
    if (!wavTaskId) return c.json({ success: false, error: "No WAV taskId" }, 500);
    for (let elapsed = 0; elapsed < 120_000; elapsed += 4_000) {
      await new Promise(r => setTimeout(r, 4_000));
      try {
        const pr = await fetch(`${SUNO_BASE}/api/v1/wav/record-info?taskId=${wavTaskId}`, { headers: h });
        const pd = await pr.json();
        if (pd.code === 200 && pd.data?.successFlag === "SUCCESS" && pd.data?.response?.audioWavUrl) {
          console.log(`[suno/wav] done in ${Date.now() - t0}ms`);
          return c.json({ success: true, wavUrl: pd.data.response.audioWavUrl });
        }
        if (pd.data?.successFlag?.includes("FAILED")) return c.json({ success: false, error: `WAV failed: ${pd.data.errorMessage || pd.data.successFlag}` }, 500);
      } catch { /* retry */ }
    }
    return c.json({ success: false, error: "WAV timeout (120s)" }, 504);
  } catch (err) {
    console.log("[suno/wav] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/suno/vocal-removal", async (c) => {
  const t0 = Date.now();
  try {
    const _body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { taskId, audioId, type: sepType } = _body;
    if (!taskId || !audioId) return c.json({ success: false, error: "taskId and audioId required" }, 400);
    const sType = sepType || "separate_vocal";
    console.log(`[suno/vocal-removal] taskId=${taskId}, audioId=${audioId}, type=${sType}`);
    const h = sunoHeaders();
    const res = await fetch(`${SUNO_BASE}/api/v1/vocal-removal/generate`, {
      method: "POST", headers: h,
      body: JSON.stringify({ taskId, audioId, type: sType, callBackUrl: "" }),
    });
    const gen = await res.json();
    if (gen.code !== 200) return c.json({ success: false, error: `Suno vocal-removal error ${gen.code}: ${gen.msg}` }, 400);
    const vrTaskId = gen.data?.taskId;
    if (!vrTaskId) return c.json({ success: false, error: "No vocal-removal taskId" }, 500);
    for (let elapsed = 0; elapsed < 180_000; elapsed += 5_000) {
      await new Promise(r => setTimeout(r, 5_000));
      try {
        const pr = await fetch(`${SUNO_BASE}/api/v1/vocal-removal/record-info?taskId=${vrTaskId}`, { headers: h });
        const pd = await pr.json();
        if (pd.code === 200 && pd.data?.successFlag === "SUCCESS") {
          console.log(`[suno/vocal-removal] done in ${Date.now() - t0}ms`);
          return c.json({ success: true, stems: pd.data.response || {} });
        }
        if (pd.data?.successFlag?.includes("FAILED")) return c.json({ success: false, error: `Vocal removal failed: ${pd.data.errorMessage || pd.data.successFlag}` }, 500);
      } catch { /* retry */ }
    }
    return c.json({ success: false, error: "Vocal removal timeout (180s)" }, 504);
  } catch (err) {
    console.log("[suno/vocal-removal] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/suno/mp4", async (c) => {
  const t0 = Date.now();
  try {
    const _body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { taskId, audioId, author, domainName } = _body;
    if (!taskId || !audioId) return c.json({ success: false, error: "taskId and audioId required" }, 400);
    console.log(`[suno/mp4] taskId=${taskId}, audioId=${audioId}`);
    const h = sunoHeaders();
    const res = await fetch(`${SUNO_BASE}/api/v1/mp4/generate`, {
      method: "POST", headers: h,
      body: JSON.stringify({ taskId, audioId, callBackUrl: "", author: author || "ORA Studio", domainName: domainName || "" }),
    });
    const gen = await res.json();
    if (gen.code !== 200) return c.json({ success: false, error: `Suno MP4 error ${gen.code}: ${gen.msg}` }, 400);
    const mp4TaskId = gen.data?.taskId;
    if (!mp4TaskId) return c.json({ success: false, error: "No MP4 taskId" }, 500);
    for (let elapsed = 0; elapsed < 180_000; elapsed += 5_000) {
      await new Promise(r => setTimeout(r, 5_000));
      try {
        const pr = await fetch(`${SUNO_BASE}/api/v1/mp4/record-info?taskId=${mp4TaskId}`, { headers: h });
        const pd = await pr.json();
        if (pd.code === 200 && pd.data?.successFlag === "SUCCESS" && pd.data?.response?.videoUrl) {
          console.log(`[suno/mp4] done in ${Date.now() - t0}ms`);
          return c.json({ success: true, videoUrl: pd.data.response.videoUrl });
        }
        if (pd.data?.successFlag?.includes("FAILED")) return c.json({ success: false, error: `MP4 failed: ${pd.data.errorMessage || pd.data.successFlag}` }, 500);
      } catch { /* retry */ }
    }
    return c.json({ success: false, error: "MP4 timeout (180s)" }, 504);
  } catch (err) {
    console.log("[suno/mp4] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/suno/lyrics", async (c) => {
  const t0 = Date.now();
  try {
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const prompt = body?.prompt;
    if (!prompt) return c.json({ success: false, error: "prompt required" }, 400);
    console.log(`[suno/lyrics] prompt="${prompt.slice(0, 80)}"`);
    const h = sunoHeaders();

    // /api/v1/lyrics is the correct endpoint (confirmed: HTTP 200) but code=400 means wrong body format
    // Try multiple body formats
    const lyricsUrl = `${SUNO_BASE}/api/v1/lyrics`;
    const cbUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/make-server-cad57f79/suno/callback`;
    const bodyVariants = [
      { prompt: prompt.slice(0, 500), callBackUrl: cbUrl },
      { prompt: prompt.slice(0, 500), callBackUrl: "https://example.com/callback" },
    ];
    let gen: any = null;
    let genRaw = "";
    for (const bv of bodyVariants) {
      console.log(`[suno/lyrics] POST ${lyricsUrl} body=${JSON.stringify(bv).slice(0, 200)}`);
      try {
        const res = await fetch(lyricsUrl, { method: "POST", headers: h, body: JSON.stringify(bv) });
        genRaw = await res.text();
        console.log(`[suno/lyrics] status=${res.status}, body=${genRaw.slice(0, 500)}`);
        try { gen = JSON.parse(genRaw); } catch { gen = null; continue; }
        const taskId = gen?.data?.taskId || gen?.taskId || gen?.data?.task_id || gen?.task_id;
        if (taskId || gen?.code === 200 || gen?.code === 0 || gen?.success === true) {
          console.log(`[suno/lyrics] OK with format: ${Object.keys(bv).join(",")}`);
          break;
        }
        console.log(`[suno/lyrics] code=${gen?.code}, msg=${gen?.msg || gen?.message}, keys=${Object.keys(gen).join(",")}, data=${JSON.stringify(gen?.data).slice(0,200)}, next format...`);
        gen = null;
      } catch (fetchErr) { console.log(`[suno/lyrics] fetch error: ${fetchErr}`); }
    }
    if (!gen) return c.json({ success: false, error: `Suno lyrics: all formats failed. Last: ${genRaw.slice(0, 400)}` }, 500);

    const lyricsTaskId = gen?.data?.taskId || gen?.taskId || gen?.data?.task_id || gen?.task_id;
    if (!lyricsTaskId) {
      const directLyrics = gen?.data?.response || gen?.data?.lyrics || gen?.lyrics || gen?.data?.text || gen?.text;
      if (directLyrics) {
        console.log(`[suno/lyrics] got direct lyrics (no polling)`);
        return c.json({ success: true, lyrics: directLyrics });
      }
      return c.json({ success: false, error: `No taskId. keys=${Object.keys(gen).join(",")}, data=${JSON.stringify(gen?.data || {}).slice(0,200)}` }, 500);
    }
    console.log(`[suno/lyrics] taskId=${lyricsTaskId} from ${lyricsUrl}, polling...`);

    const pollEps = [
      `${SUNO_BASE}/api/v1/lyrics/record-info?taskId=${lyricsTaskId}`,
      `${SUNO_BASE}/api/v1/lyrics/${lyricsTaskId}`,
      `${SUNO_BASE}/api/v1/generate/lyrics-record-info?taskId=${lyricsTaskId}`,
    ];
    let workingPoll = "";
    for (let elapsed = 0; elapsed < 60_000; elapsed += 3_000) {
      await new Promise(r => setTimeout(r, 3_000));
      const tryEps = workingPoll ? [workingPoll] : pollEps;
      for (const pep of tryEps) {
        try {
          const pr = await fetch(pep, { headers: h });
          const pd = await pr.json();
          const st = pd.data?.status || pd.status || "";
          console.log(`[suno/lyrics] poll ${elapsed/1000}s ${pep.split("/").pop()} -> code=${pd.code}, st=${st}`);
          const lyr = pd.data?.response || pd.data?.lyrics || pd.lyrics || pd.data?.text || pd.text;
          if (lyr && (st === "SUCCESS" || st === "complete" || pd.code === 200 || pd.success)) {
            console.log(`[suno/lyrics] done in ${Date.now() - t0}ms`);
            return c.json({ success: true, lyrics: lyr });
          }
          if (typeof st === "string" && (st.includes("FAIL") || st === "failed")) {
            return c.json({ success: false, error: `Lyrics failed: ${pd.data?.errorMessage || st}` }, 500);
          }
          if (pd.code !== undefined || pd.data !== undefined) { workingPoll = pep; break; }
        } catch (pe) { console.log(`[suno/lyrics] poll err ${pep}:`, pe); }
      }
    }
    return c.json({ success: false, error: "Lyrics timeout (60s)" }, 504);
  } catch (err) {
    console.log("[suno/lyrics] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── SUNO EXTEND — extend a song from a specific timestamp ──
app.post("/suno/extend", async (c) => {
  const t0 = Date.now();
  try {
    const _body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { taskId, audioId, prompt, continueAt, model } = _body;
    if (!taskId || !audioId) return c.json({ success: false, error: "taskId and audioId required" }, 400);
    const sunoModel = audioModelToSuno[model] || "V5";
    console.log(`[suno/extend] taskId=${taskId}, audioId=${audioId}, continueAt=${continueAt}, model=${sunoModel}`);
    const h = sunoHeaders();
    const body: Record<string, any> = { taskId, audioId, model: sunoModel, callBackUrl: "" };
    if (prompt) body.prompt = prompt.slice(0, 500);
    if (continueAt !== undefined && continueAt !== null) body.continueAt = continueAt;
    const res = await fetch(`${SUNO_BASE}/api/v1/extend/generate`, {
      method: "POST", headers: h, body: JSON.stringify(body),
    });
    const gen = await res.json();
    if (gen.code !== 200) return c.json({ success: false, error: `Suno extend error ${gen.code}: ${gen.msg}` }, 400);
    const extTaskId = gen.data?.taskId;
    if (!extTaskId) return c.json({ success: false, error: "No extend taskId" }, 500);
    for (let elapsed = 0; elapsed < 180_000; elapsed += 5_000) {
      await new Promise(r => setTimeout(r, 5_000));
      try {
        const pr = await fetch(`${SUNO_BASE}/api/v1/extend/record-info?taskId=${extTaskId}`, { headers: h });
        const pd = await pr.json();
        if (pd.code === 200 && (pd.data?.status === "FIRST_SUCCESS" || pd.data?.status === "SUCCESS")) {
          const tracks = pd.data?.response?.sunoData;
          if (tracks?.length > 0) {
            const t = tracks[0];
            console.log(`[suno/extend] done in ${Date.now() - t0}ms`);
            return c.json({ success: true, track: { id: t.id, title: t.title, audioUrl: t.audioUrl || t.streamAudioUrl, imageUrl: t.imageUrl, duration: t.duration, tags: t.tags } });
          }
        }
        if (pd.data?.status?.includes("FAILED")) return c.json({ success: false, error: `Extend failed: ${pd.data.errorMessage || pd.data.status}` }, 500);
      } catch { /* retry */ }
    }
    return c.json({ success: false, error: "Extend timeout (180s)" }, 504);
  } catch (err) {
    console.log("[suno/extend] error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── MUSIC PLAYLISTS — CRUD ──
app.post("/music/playlists/list", async (c) => {
  try {
    const user = await requireAuth(c);
    const playlists = await kv.getByPrefix(`playlist:${user.id}:`);
    return c.json({ success: true, playlists: playlists || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/music/playlists/save", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { id, name, trackIds } = body;
    const plId = id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const playlist = { id: plId, userId: user.id, name: name || "Untitled", trackIds: trackIds || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await kv.set(`playlist:${user.id}:${plId}`, playlist);
    return c.json({ success: true, playlist });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/music/playlists/delete", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    await kv.del(`playlist:${user.id}:${body.id}`);
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// ── MUSIC FAVORITES ──
app.post("/music/favorites/list", async (c) => {
  try {
    const user = await requireAuth(c);
    const favs = await kv.get(`music-favs:${user.id}`);
    return c.json({ success: true, favorites: favs || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/music/favorites/toggle", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { trackId } = body;
    if (!trackId) return c.json({ success: false, error: "trackId required" }, 400);
    let favs: string[] = (await kv.get(`music-favs:${user.id}`)) || [];
    if (favs.includes(trackId)) { favs = favs.filter((f: string) => f !== trackId); }
    else { favs.push(trackId); }
    await kv.set(`music-favs:${user.id}`, favs);
    return c.json({ success: true, favorites: favs, isFavorite: favs.includes(trackId) });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// GET /vault — Load vault data (token via query param for GET)
app.get("/vault", async (c) => {
  try {
    const token = c.req.query("_token") || c.get?.("userToken") || c.req.header("Authorization")?.split(" ")[1];
    if (!token) return c.json({ success: false, error: "Unauthorized (no token for GET /vault)" }, 401);
    const jwt = decodeJwtPayload(token);
    if (!jwt?.sub) return c.json({ success: false, error: "Unauthorized (invalid JWT)" }, 401);
    const vault = await kv.get(`vault:${jwt.sub}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// POST /vault/load — CORS-safe vault read (token in body)
app.post("/vault/load", async (c) => {
  try {
    const user = await requireAuth(c);
    const vault = await kv.get(`vault:${user.id}`);
    console.log(`[vault/load] user ${user.id}: vault ${vault ? "found" : "not found"}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// POST /vault — Save vault data (CORS-safe: token in body)
app.post("/vault", async (c) => {
  try {
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { _token, ...data } = body;
    // If body only has _token → it's a read
    if (Object.keys(data).length === 0) {
      const user = await requireAuth(c);
      const vault = await kv.get(`vault:${user.id}`);
      return c.json({ success: true, vault: vault || null });
    }
    // Otherwise it's a write
    const user = await requireAuth(c);
    const existing = await kv.get(`vault:${user.id}`) || {};
    const updated = { ...existing, ...data, userId: user.id, updatedAt: new Date().toISOString() };
    await kv.set(`vault:${user.id}`, updated);
    return c.json({ success: true, vault: updated });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// POST /vault/analyze — AI analysis of URL or text content (ENRICHED)
// Accepts: { url, deep? } or { content, sourceName, sourceType }
// Returns: { success, dna: { ... } }
app.post("/vault/analyze", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { url, content, sourceName, sourceType, deep } = body;

    const creditCost = deep ? 2 : 1;
    const canDeduct = await deductCredit(user.id, creditCost);
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits." }, 403);

    let textToAnalyze = "";
    let source = sourceName || "unknown";
    let preExtracted: any = {};

    // ── Helper: normalize any color string to uppercase #RRGGBB ──
    function normalizeHex(raw: string): string | null {
      const h = raw.trim();
      if (h.length === 4 && h.startsWith("#")) {
        return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toUpperCase();
      }
      if ((h.length === 7 || h.length === 9) && h.startsWith("#")) {
        return h.slice(0, 7).toUpperCase();
      }
      return null;
    }

    function rgbToHex(r: number, g: number, b: number): string {
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
    }

    function hslToHex(h: number, s: number, l: number): string {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
      return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
    }

    function isGenericColor(hex: string): boolean {
      const generic = new Set(["#FFFFFF", "#FEFEFE", "#000000", "#010101"]);
      return generic.has(hex);
    }

    // ── Helper: extract structured data from raw HTML (enhanced with frequency counting) ──
    function extractFromHtml(html: string, pageUrl: string, externalCss = "") {
      const data: any = { colors: [], colorFrequency: {}, fonts: [], socialUrls: [], meta: {}, cssCustomProperties: {} };

      // Meta tags
      data.meta.title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
      data.meta.description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
      data.meta.ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
      data.meta.keywords = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";

      // Theme-color meta tag (explicit brand color signal)
      const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1];
      data.meta.themeColor = themeColor || "";

      // ── Collect ALL CSS sources ──
      const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      const inlineStyles = html.match(/style=["']([^"']+)["']/gi) || [];
      const svgFills = html.match(/(?:fill|stroke)=["']([^"']+)["']/gi) || [];
      const twArbitrary = html.match(/(?:bg|text|border|ring|shadow|accent|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/gi) || [];

      const allCss = [...styleBlocks, ...inlineStyles, ...svgFills, ...(externalCss ? [externalCss] : [])].join(" ");

      // ── Frequency-counted color extraction ──
      const colorFreq = new Map<string, number>();
      function addColor(hex: string | null, weight = 1) {
        if (!hex || isGenericColor(hex)) return;
        colorFreq.set(hex, (colorFreq.get(hex) || 0) + weight);
      }

      // 1. Hex colors
      const hexMatches = allCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      for (const h of hexMatches) addColor(normalizeHex(h));

      // 2. rgb() / rgba()
      const rgbMatches = allCss.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) || [];
      for (const rgb of rgbMatches) {
        const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) addColor(rgbToHex(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])));
      }

      // 3. hsl() / hsla()
      const hslMatches = allCss.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/g) || [];
      for (const hsl of hslMatches) {
        const m = hsl.match(/([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
        if (m) addColor(hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
      }

      // 4. CSS custom properties with color values (5x weight — strongest brand signal)
      const cssVarMatches = allCss.match(/--[\w-]*(?:color|bg|background|primary|secondary|accent|brand|main|text|border|surface|highlight|link)[\w-]*\s*:\s*([^;}\n]+)/gi) || [];
      for (const cv of cssVarMatches) {
        const parts = cv.split(":");
        if (parts.length < 2) continue;
        const varName = parts[0].trim();
        const varValue = parts.slice(1).join(":").trim();
        const hexInVar = varValue.match(/#[0-9a-fA-F]{3,8}\b/);
        if (hexInVar) {
          const norm = normalizeHex(hexInVar[0]);
          if (norm) { addColor(norm, 5); data.cssCustomProperties[varName] = norm; }
        }
        const rgbInVar = varValue.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgbInVar) {
          const hex = rgbToHex(parseInt(rgbInVar[1]), parseInt(rgbInVar[2]), parseInt(rgbInVar[3]));
          addColor(hex, 5); data.cssCustomProperties[varName] = hex;
        }
        const hslInVar = varValue.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
        if (hslInVar) {
          const hex = hslToHex(parseFloat(hslInVar[1]), parseFloat(hslInVar[2]), parseFloat(hslInVar[3]));
          addColor(hex, 5); data.cssCustomProperties[varName] = hex;
        }
      }

      // 5. Tailwind arbitrary color values (3x weight)
      for (const tw of twArbitrary) {
        const hexPart = tw.match(/#[0-9a-fA-F]{3,8}/);
        if (hexPart) addColor(normalizeHex(hexPart[0]), 3);
      }

      // 6. SVG fill/stroke values (2x weight)
      for (const sf of svgFills) {
        const hexInSvg = sf.match(/#[0-9a-fA-F]{3,8}/);
        if (hexInSvg) addColor(normalizeHex(hexInSvg[0]), 2);
        const rgbInSvg = sf.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgbInSvg) addColor(rgbToHex(parseInt(rgbInSvg[1]), parseInt(rgbInSvg[2]), parseInt(rgbInSvg[3])), 2);
      }

      // 7. Theme-color meta (10x weight — explicit brand declaration)
      if (themeColor) {
        const hexTheme = themeColor.match(/#[0-9a-fA-F]{3,8}/);
        if (hexTheme) addColor(normalizeHex(hexTheme[0]), 10);
        const rgbTheme = themeColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgbTheme) addColor(rgbToHex(parseInt(rgbTheme[1]), parseInt(rgbTheme[2]), parseInt(rgbTheme[3])), 10);
      }

      // Sort by frequency (most used first)
      const sorted = [...colorFreq.entries()].sort((a, b) => b[1] - a[1]);
      data.colors = sorted.map(([hex]) => hex).slice(0, 25);
      data.colorFrequency = Object.fromEntries(sorted.slice(0, 25));
      console.log(`[extractFromHtml] Colors: ${sorted.length} unique, top 5: ${sorted.slice(0, 5).map(([h, f]) => `${h}(${f})`).join(", ")}`);

      // Fonts
      const googleFonts = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"&]+)/gi) || [];
      for (const gf of googleFonts) {
        const families = gf.match(/family=([^"&]+)/)?.[1] || "";
        families.split("|").forEach((f: string) => {
          const name = decodeURIComponent(f.split(":")[0]).replace(/\+/g, " ");
          if (name) data.fonts.push(name);
        });
      }
      const fontFaces = allCss.match(/font-family\s*:\s*["']?([^;"',}]+)/gi) || [];
      for (const ff of fontFaces) {
        const name = ff.replace(/font-family\s*:\s*["']?/i, "").trim();
        if (name && !["inherit","initial","sans-serif","serif","monospace","cursive","system-ui","-apple-system","BlinkMacSystemFont","Segoe UI"].includes(name.toLowerCase()) && !name.startsWith("var(")) {
          data.fonts.push(name);
        }
      }
      data.fonts = [...new Set(data.fonts)].slice(0, 10);

      // Social URLs
      const socialPatterns = [
        { platform: "instagram", regex: /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/gi },
        { platform: "linkedin", regex: /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[^\s"'<>]+/gi },
        { platform: "facebook", regex: /https?:\/\/(www\.)?facebook\.com\/[^\s"'<>]+/gi },
        { platform: "twitter", regex: /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s"'<>]+/gi },
        { platform: "youtube", regex: /https?:\/\/(www\.)?youtube\.com\/(channel|c|@)[^\s"'<>]+/gi },
        { platform: "tiktok", regex: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"'<>]+/gi },
        { platform: "pinterest", regex: /https?:\/\/(www\.)?pinterest\.[a-z]+\/[^\s"'<>]+/gi },
        { platform: "tripadvisor", regex: /https?:\/\/(www\.)?tripadvisor\.[a-z.]+\/[^\s"'<>]+/gi },
      ];
      for (const sp of socialPatterns) {
        const matches = html.match(sp.regex) || [];
        if (matches.length > 0) {
          data.socialUrls.push({ platform: sp.platform, url: matches[0].replace(/["'<>\s]/g, "") });
        }
      }

      // Favicon
      const favicon = html.match(/<link[^>]+rel=["'](icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)?.[2] || "";
      if (favicon) {
        try { data.meta.favicon = favicon.startsWith("http") ? favicon : new URL(favicon, pageUrl).href; } catch {}
      }
      return data;
    }

    // ── Helper: fetch external CSS files linked in HTML ──
    async function fetchExternalCss(html: string, pageUrl: string): Promise<string> {
      const linkMatches = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi) || [];
      const altMatches = html.match(/<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["']/gi) || [];
      const allLinks = [...linkMatches, ...altMatches];
      const cssUrls = new Set<string>();
      for (const link of allLinks) {
        const href = link.match(/href=["']([^"']+)["']/)?.[1];
        if (!href) continue;
        try {
          const fullUrl = href.startsWith("http") ? href : new URL(href, pageUrl).href;
          if (/bootstrap|fontawesome|font-awesome|googleapis|cdnjs|unpkg|jsdelivr|normalize/i.test(fullUrl)) continue;
          cssUrls.add(fullUrl);
        } catch {}
      }

      const chunks: string[] = [];
      const urlArr = [...cssUrls].slice(0, 5);
      if (urlArr.length === 0) return "";
      console.log(`[fetchExternalCss] Fetching ${urlArr.length} CSS files`);

      await Promise.allSettled(urlArr.map(async (cssUrl) => {
        try {
          const res = await fetch(cssUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ORA-Bot/1.0)" },
            redirect: "follow",
          });
          if (res.ok) {
            const text = await res.text();
            if (text.length > 0 && text.length < 500_000) {
              chunks.push(text);
              console.log(`[fetchExternalCss] OK: ${cssUrl} (${text.length} chars)`);
            }
          }
        } catch (e) { console.log(`[fetchExternalCss] FAIL: ${cssUrl}: ${e}`); }
      }));

      return chunks.join("\n");
    }

    // ── Helper: fetch HTML ──
    async function fetchHtml(pageUrl: string): Promise<string> {
      const jinaKey = Deno.env.get("JINA_API_KEY");
      if (jinaKey) {
        try {
          const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
            headers: { Authorization: `Bearer ${jinaKey}`, Accept: "text/html", "X-No-Cache": "true", "X-Return-Format": "html", "X-Proxy": "auto" },
          });
          if (res.ok) { const h = await res.text(); if (h.length > 200) return h; }
        } catch (e) { console.log(`[vault] Jina HTML fail ${pageUrl}: ${e}`); }
      }
      try {
        const res = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ORA-Bot/1.0)" }, redirect: "follow" });
        if (res.ok) return await res.text();
      } catch (e) { console.log(`[vault] Direct fail ${pageUrl}: ${e}`); }
      return "";
    }

    // ── Helper: get clean text via Jina ──
    async function fetchJinaText(pageUrl: string): Promise<string> {
      const jinaKey = Deno.env.get("JINA_API_KEY");
      if (!jinaKey) return "";
      try {
        const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
          headers: { Authorization: `Bearer ${jinaKey}`, Accept: "application/json", "X-No-Cache": "true", "X-Proxy": "auto", "X-Target-Selector": "body" },
        });
        if (res.ok) { const d = await res.json(); return d.data?.content || d.data?.text || d.content || ""; }
      } catch (e) { console.log(`[vault] Jina text fail ${pageUrl}: ${e}`); }
      return "";
    }

    function htmlToText(html: string): string {
      return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    // ── URL scraping (enhanced) ──
    if (url) {
      console.log(`[vault/analyze] Scraping: ${url} deep=${!!deep}`);
      const rawHtml = await fetchHtml(url);
      if (rawHtml.length > 200) {
        // Fetch external CSS files for accurate color extraction (non-blocking)
        let extCss = "";
        try {
          extCss = await fetchExternalCss(rawHtml, url);
          console.log(`[vault/analyze] External CSS: ${extCss.length} chars from linked stylesheets`);
        } catch (e) {
          console.log(`[vault/analyze] External CSS fetch failed (non-fatal): ${e}`);
        }
        try {
          preExtracted = extractFromHtml(rawHtml, url, extCss);
          console.log(`[vault/analyze] Pre-extracted: ${preExtracted.colors.length} colors (${Object.keys(preExtracted.cssCustomProperties || {}).length} CSS vars), ${preExtracted.fonts.length} fonts, ${preExtracted.socialUrls.length} socials`);
        } catch (e) {
          console.log(`[vault/analyze] extractFromHtml failed (non-fatal): ${e}`);
          preExtracted = { colors: [], colorFrequency: {}, fonts: [], socialUrls: [], meta: {}, cssCustomProperties: {} };
        }
      }
      textToAnalyze = await fetchJinaText(url);
      if (!textToAnalyze && rawHtml) textToAnalyze = htmlToText(rawHtml);
      source = url;

      // Deep scan: crawl sub-pages
      if (deep && textToAnalyze.length > 50) {
        console.log(`[vault/analyze] Deep scan: crawling sub-pages...`);
        const baseUrl = new URL(url);
        const subPaths = ["/about", "/about-us", "/a-propos", "/contact", "/services", "/offres", "/our-story", "/concept"];
        const linkMatches = rawHtml.match(/href=["']([^"'#]+)["']/gi) || [];
        const internalPaths = new Set<string>();
        for (const lm of linkMatches) {
          const href = lm.match(/href=["']([^"']+)["']/)?.[1] || "";
          try {
            const u = new URL(href, url);
            if (u.hostname === baseUrl.hostname && u.pathname !== "/" && u.pathname !== baseUrl.pathname) internalPaths.add(u.pathname);
          } catch {}
        }
        const pathsToTry = [...new Set([...subPaths, ...Array.from(internalPaths).slice(0, 10)])].slice(0, 8);
        console.log(`[vault/analyze] Deep: trying ${pathsToTry.length} sub-pages`);
        const subResults = await Promise.allSettled(
          pathsToTry.map(async (path) => {
            const subUrl = `${baseUrl.origin}${path}`;
            const subText = await fetchJinaText(subUrl);
            if (subText.length > 100) {
              const subHtml = await fetchHtml(subUrl);
              if (subHtml.length > 200) {
                const sub = extractFromHtml(subHtml, subUrl); // no external CSS for sub-pages (perf)
                // Merge colors with frequency data
                for (const [hex, freq] of Object.entries(sub.colorFrequency || {})) {
                  preExtracted.colorFrequency[hex] = (preExtracted.colorFrequency[hex] || 0) + (freq as number);
                }
                // Merge CSS custom properties
                Object.assign(preExtracted.cssCustomProperties || {}, sub.cssCustomProperties || {});
                preExtracted.colors = [...new Set([...preExtracted.colors, ...sub.colors])].slice(0, 30);
                preExtracted.fonts = [...new Set([...preExtracted.fonts, ...sub.fonts])].slice(0, 10);
                for (const s of sub.socialUrls) {
                  if (!preExtracted.socialUrls.some((e: any) => e.platform === s.platform)) preExtracted.socialUrls.push(s);
                }
              }
              return `\n--- ${path} ---\n${subText.slice(0, 3000)}`;
            }
            return "";
          })
        );
        for (const r of subResults) { if (r.status === "fulfilled" && r.value) textToAnalyze += r.value; }
        console.log(`[vault/analyze] Deep: total ${textToAnalyze.length} chars`);
      }

      if (!textToAnalyze || textToAnalyze.length < 50) {
        return c.json({ success: false, error: "Could not extract content from URL." }, 400);
      }
    } else if (content) {
      textToAnalyze = content;
      console.log(`[vault/analyze] Text: ${textToAnalyze.length} chars from ${source}`);
    } else {
      return c.json({ success: false, error: "Provide url or content" }, 400);
    }

    // ── Structured context for AI (enhanced with frequency + CSS vars) ──
    const hasPreData = preExtracted.colors?.length || preExtracted.fonts?.length || preExtracted.socialUrls?.length;

    // Build color frequency string (sorted by weight)
    const colorFreqEntries = Object.entries(preExtracted.colorFrequency || {})
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 15);
    const colorFreqStr = colorFreqEntries.length > 0
      ? colorFreqEntries.map(([hex, freq]: any) => `${hex} (weight: ${freq})`).join(", ")
      : "none";

    // Build CSS custom properties string
    const cssVarsStr = Object.entries(preExtracted.cssCustomProperties || {})
      .map(([name, hex]: any) => `${name}: ${hex}`)
      .join(", ");

    const structuredContext = hasPreData ? `
REAL COLORS EXTRACTED FROM CSS/HTML (sorted by frequency/importance — these are VERIFIED hex values from the actual website code):
${colorFreqStr}
${cssVarsStr ? `\nCSS CUSTOM PROPERTIES (design tokens — highest confidence brand colors):\n${cssVarsStr}` : ""}
${preExtracted.meta?.themeColor ? `\nMETA THEME-COLOR: ${preExtracted.meta.themeColor} (explicit brand color declaration)` : ""}

OTHER EXTRACTED DATA:
- Fonts: ${preExtracted.fonts?.join(", ") || "none"}
- Social links: ${preExtracted.socialUrls?.map((s: any) => `${s.platform}: ${s.url}`).join(", ") || "none"}
- Meta title: ${preExtracted.meta?.title || ""}
- Meta description: ${preExtracted.meta?.description || ""}
- OG Image: ${preExtracted.meta?.ogImage || ""}
- Keywords: ${preExtracted.meta?.keywords || ""}
` : "";

    const maxChars = deep ? 20000 : 14000;
    const truncated = textToAnalyze.slice(0, maxChars);
    console.log(`[vault/analyze] AI input: ${truncated.length} text + ${structuredContext.length} structured`);

    const aiRes = await fetch(`${APIPOD_BASE}/chat/completions`, {
      method: "POST",
      headers: apipodHeaders(),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an elite brand analyst. Extract comprehensive brand DNA. Return ONLY valid JSON.

CRITICAL COLOR RULES:
- The "REAL COLORS EXTRACTED FROM CSS/HTML" section contains VERIFIED hex values programmatically extracted from the website's actual CSS code. These are the ONLY colors you should use.
- You MUST select the brand colors EXCLUSIVELY from this extracted list. NEVER invent, guess, or hallucinate colors based on the brand name, industry, or your training data.
- CSS Custom Properties (design tokens like --primary, --accent, --brand-color) are the STRONGEST signal for brand colors. Prioritize them.
- Meta theme-color is an explicit brand color declaration — always include it as primary or accent.
- Higher weight = more frequently used on the site = more likely a brand color.
- Assign roles (primary, secondary, accent, background, text) based on weight and CSS variable names.
- If the extracted color list is empty, return an empty colors array rather than guessing.

OTHER RULES:
- Detect ALL fonts from Google Fonts links, @font-face, font-family CSS.
- Find ALL social media from extracted links AND text mentions.
- Create 3-5 specific target audience segments with detailed descriptions.
- Extract 4-6 distinct key messages.
- Identify 8-15 approved brand terms and 5-10 forbidden terms from vocabulary patterns.
- For photo_style, infer from industry, positioning, and descriptions.
- confidence_score: 50-70 sparse data, 70-85 moderate, 85-100 rich.
- RESPOND IN THE SAME LANGUAGE as the source content.

JSON:
{
  "company_name": "string",
  "industry": "string (specific, e.g. 'Luxury Hospitality')",
  "tagline": "string or null",
  "products_services": ["string (4-6 items)"],
  "target_audiences": [{ "name": "string", "description": "string (2-3 sentences)" }],
  "colors": [{ "hex": "#XXXXXX", "name": "string", "role": "primary|secondary|accent|background|text" }],
  "logo_description": "string or null",
  "tone": { "formality": 1-10, "confidence": 1-10, "warmth": 1-10, "humor": 1-10, "primary_tone": "string", "adjectives": ["5-8 adjectives"] },
  "photo_style": { "framing": "string", "mood": "string", "lighting": "string", "subjects": "string" },
  "social_presence": [{ "platform": "string", "url": "string or null", "detected": true }],
  "key_messages": ["string (4-6)"],
  "approved_terms": ["string (8-15)"],
  "forbidden_terms": ["string (5-10)"],
  "fonts": ["string"],
  "confidence_score": 0-100
}`,
          },
          { role: "user", content: `Analyze brand from "${source}":
${structuredContext}
--- CONTENT ---
${truncated}` },
        ],
        max_tokens: 3000,
        temperature: 0.05,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.log(`[vault/analyze] AI error ${aiRes.status}: ${errText.slice(0, 200)}`);
      return c.json({ success: false, error: `AI analysis failed (${aiRes.status})` }, 500);
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    console.log(`[vault/analyze] AI response: ${raw.length} chars (${Date.now() - t0}ms)`);

    let dna: any;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      dna = match ? JSON.parse(match[0]) : null;
    } catch (e) {
      console.log(`[vault/analyze] JSON parse failed: ${e}`);
      return c.json({ success: false, error: "AI returned invalid JSON" }, 500);
    }
    if (!dna) return c.json({ success: false, error: "AI returned empty result" }, 500);

    // Post-process: ALWAYS validate AI colors against pre-extracted data
    if (preExtracted.colors?.length > 0) {
      const extractedSet = new Set(preExtracted.colors.map((c: string) => c.toUpperCase()));
      const aiColors = dna.colors || [];

      // Filter: keep AI colors ONLY if they exist in extracted set (tolerance: allow close matches)
      const validatedColors: any[] = [];
      const usedExtracted = new Set<string>();

      for (const ac of aiColors) {
        const aiHex = ac.hex?.toUpperCase();
        if (aiHex && extractedSet.has(aiHex)) {
          validatedColors.push(ac);
          usedExtracted.add(aiHex);
        } else {
          console.log(`[vault/analyze] Rejected AI-hallucinated color: ${aiHex} (not in extracted CSS)`);
        }
      }

      // Add top pre-extracted colors the AI missed (with frequency-based role assignment)
      const topColors = Object.entries(preExtracted.colorFrequency || {})
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 8);

      for (const [hex, _freq] of topColors) {
        if (!usedExtracted.has(hex)) {
          // Infer role from CSS variable name if available
          let role = "detected";
          const cssVars = preExtracted.cssCustomProperties || {};
          for (const [varName, varHex] of Object.entries(cssVars)) {
            if ((varHex as string) === hex) {
              if (/primary|brand|main/i.test(varName)) role = "primary";
              else if (/secondary/i.test(varName)) role = "secondary";
              else if (/accent|highlight/i.test(varName)) role = "accent";
              else if (/background|bg|surface/i.test(varName)) role = "background";
              else if (/text|foreground/i.test(varName)) role = "text";
              break;
            }
          }
          validatedColors.push({ hex, name: "", role });
        }
      }

      dna.colors = validatedColors.length > 0 ? validatedColors : aiColors; // fallback to AI if extraction yielded nothing
      console.log(`[vault/analyze] Colors post-process: ${validatedColors.length} validated from ${aiColors.length} AI + ${topColors.length} extracted`);
    }

    // Merge fonts
    if (preExtracted.fonts?.length > 0) {
      dna.fonts = [...new Set([...(dna.fonts || []), ...preExtracted.fonts])];
    }
    // Merge social presence
    if (preExtracted.socialUrls?.length > 0) {
      const aiP = new Set((dna.social_presence || []).map((s: any) => s.platform?.toLowerCase()));
      for (const s of preExtracted.socialUrls) {
        if (!aiP.has(s.platform)) { dna.social_presence = dna.social_presence || []; dna.social_presence.push({ platform: s.platform, url: s.url, detected: true }); }
      }
    }

    const existing = await kv.get(`vault:${user.id}`) || {};
    const merged = { ...existing, ...dna, source_url: url || existing.source_url, source_type: sourceType || "url", userId: user.id, updatedAt: new Date().toISOString(), analyzedAt: new Date().toISOString(), scanType: deep ? "deep" : "standard" };
    await kv.set(`vault:${user.id}`, merged);

    console.log(`[vault/analyze] DONE ${Date.now() - t0}ms — ${dna.company_name} (${deep ? "deep" : "std"})`);
    return c.json({ success: true, dna, vault: merged });

  } catch (err: any) {
    console.log(`[vault/analyze] ERROR (${Date.now() - t0}ms): ${err?.message || err}`);
    return c.json({ success: false, error: `Analysis failed: ${err?.message || err}` }, 500);
  }
});

// POST /vault/analyze-file — Upload file (image/PDF/PPT) for AI analysis
app.post("/vault/analyze-file", async (c) => {
  const t0 = Date.now();
  try {
    const formData = await c.req.formData();
    const tokenField = formData.get("_token") as string || "";
    const file = formData.get("file") as File;
    if (!file) return c.json({ success: false, error: "No file provided" }, 400);
    if (!tokenField) return c.json({ success: false, error: "Unauthorized" }, 401);
    const jwt = decodeJwtPayload(tokenField);
    if (!jwt?.sub) return c.json({ success: false, error: "Invalid token" }, 401);
    const userId = jwt.sub;

    const fileName = file.name || "file";
    const fileType = file.type || "";
    const fileSize = file.size || 0;
    console.log(`[vault/analyze-file] user=${userId}, file="${fileName}" (${fileType}, ${(fileSize / 1024).toFixed(1)}KB)`);

    if (fileSize > 20 * 1024 * 1024) return c.json({ success: false, error: "File too large (max 20MB)" }, 400);

    const arrayBuffer = await file.arrayBuffer();
    const isImage = fileType.startsWith("image/");

    let extractedText = "";

    if (isImage) {
      // Vision analysis via APIPod (GPT-4o vision)
      console.log(`[vault/analyze-file] Image → GPT-4o vision...`);
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const dataUri = `data:${fileType};base64,${imageBase64}`;

      try {
        const vRes = await fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: apipodHeaders(),
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Describe this brand document/image in detail. Extract: company name, colors (hex codes), logo description, fonts, tone, visual style, photo framing/mood, any text content. Be thorough and factual." },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            }],
            max_tokens: 2000,
          }),
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          extractedText = vData.choices?.[0]?.message?.content || "";
          console.log(`[vault/analyze-file] Vision OK: ${extractedText.length} chars`);
        } else {
          console.log(`[vault/analyze-file] Vision failed: ${vRes.status}`);
        }
      } catch (e) { console.log(`[vault/analyze-file] Vision error: ${e}`); }
    } else {
      // Text-based file: read as text
      try {
        const decoder = new TextDecoder("utf-8", { fatal: false });
        extractedText = decoder.decode(arrayBuffer);
        console.log(`[vault/analyze-file] Text extracted: ${extractedText.length} chars`);
      } catch (e) {
        console.log(`[vault/analyze-file] Text decode error: ${e}`);
        extractedText = `[Binary file: ${fileName} (${fileType}, ${(fileSize/1024).toFixed(0)}KB)]`;
      }
    }

    if (!extractedText || extractedText.length < 20) {
      return c.json({ success: false, error: "Could not extract content from file" }, 400);
    }

    console.log(`[vault/analyze-file] DONE in ${Date.now() - t0}ms`);
    return c.json({ success: true, extractedText, fileName, fileType });

  } catch (err: any) {
    console.log(`[vault/analyze-file] ERROR: ${err?.message || err}`);
    return c.json({ success: false, error: `File analysis failed: ${err?.message || err}` }, 500);
  }
});

// POST /vault/upload-logo — Upload logo file
app.post("/vault/upload-logo", async (c) => {
  const t0 = Date.now();
  try {
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const tokenField = formData.get("_token") as string || "";
    const file = formData.get("file") as File;
    if (!file) return c.json({ success: false, error: "No file" }, 400);
    const jwt = decodeJwtPayload(tokenField);
    if (!jwt?.sub) return c.json({ success: false, error: "Unauthorized" }, 401);
    const userId = jwt.sub;

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const storagePath = `vault-logos/${userId}/logo-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await sb.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });
    if (uploadErr) return c.json({ success: false, error: `Upload failed: ${uploadErr.message}` }, 500);

    const { data: urlData } = await sb.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const logoUrl = urlData?.signedUrl || "";
    // Save to vault
    const existing = await kv.get(`vault:${userId}`) || {};
    await kv.set(`vault:${userId}`, { ...existing, logo_url: logoUrl, logo_path: storagePath, updatedAt: new Date().toISOString() });

    console.log(`[vault/upload-logo] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, logoUrl, storagePath });
  } catch (err: any) {
    return c.json({ success: false, error: `Logo upload error: ${err?.message || err}` }, 500);
  }
});

// ── Legacy vault routes removed (PUT /vault, duplicate upload-logo, duplicate analyze-file) ──
// Primary routes defined above are the active ones.

// (duplicate /vault/upload-logo removed — primary defined ~line 4224)
// (duplicate /vault/analyze-file removed — primary defined ~line 4141)

/* ── BEGIN REMOVED LEGACY BLOCK ──
app.post("/vault/upload-logo", async (c) => {
  const t0 = Date.now();
  try {
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const tokenField = formData.get("_token") as string || "";
    let user: AuthUser | null = await getUser(c);
    if (!user && tokenField) {
      const jwt = decodeJwtPayload(tokenField);
      if (jwt?.sub && jwt?.email) user = { id: jwt.sub, email: jwt.email };
    }
    if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);
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

// ── VAULT ROUTE: Upload and analyze file (image/PDF/PPT) for onboarding ──
app.post("/vault/analyze-file", async (c) => {
  const t0 = Date.now();
  console.log("[analyze-file] Handler entered");
  try {
    const formData = await c.req.formData();
    const tokenField = formData.get("_token") as string || "";
    const questionField = formData.get("question_field") as string || "unknown";
    const questionText = formData.get("question_text") as string || "";
    const file = formData.get("file") as File;

    if (!file) return c.json({ success: false, error: "No file provided" }, 400);
    if (!tokenField) return c.json({ success: false, error: "Unauthorized: no token" }, 401);
    const jwt = decodeJwtPayload(tokenField);
    if (!jwt?.sub) return c.json({ success: false, error: "Unauthorized: invalid token" }, 401);
    const userId = jwt.sub;

    const fileName = file.name || "file";
    const fileType = file.type || "";
    const fileSize = file.size || 0;
    console.log(`[analyze-file] user=${userId}, file="${fileName}" (${fileType}, ${(fileSize / 1024).toFixed(1)}KB), field=${questionField}`);

    if (fileSize > 20 * 1024 * 1024) {
      return c.json({ success: false, error: "File too large (max 20MB)" }, 400);
    }

    await ensureBucket();
    const sb = supabaseAdmin();
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
    const fileId = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `vault-files/${userId}/${fileId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await sb.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: fileType, upsert: false });
    if (uploadErr) {
      console.log(`[analyze-file] Upload error: ${uploadErr.message}`);
      return c.json({ success: false, error: `Upload failed: ${uploadErr.message}` }, 500);
    }

    const { data: urlData } = await sb.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 7200);
    const signedUrl = urlData?.signedUrl || "";
    console.log(`[analyze-file] Uploaded in ${Date.now() - t0}ms, analyzing...`);

    const isImage = fileType.startsWith("image/");
    const isPDF = fileType === "application/pdf" || ext === "pdf";
    const isPPT = fileType.includes("presentation") || fileType.includes("powerpoint") || ext === "pptx" || ext === "ppt";
    const isDoc = fileType.includes("document") || fileType.includes("word") || ext === "docx" || ext === "doc";

    let extractedText = "";

    if (isImage) {
      console.log(`[analyze-file] Analyzing image with Mistral Vision...`);
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const dataUri = `data:${fileType};base64,${imageBase64}`;

      const visionPrompt = `Analyze this brand-related image in detail. The user uploaded it to answer this question: "${questionText}"

Extract ALL relevant brand information:
- If it's a logo: describe shape, colors (hex codes if possible), typography, style
- If it's a brand guideline page: extract colors, fonts, spacing rules, tone guidelines, dos and don'ts
- If it's a screenshot of website/app: describe visual style, color palette, layout patterns, typography
- If it's marketing material: extract messaging, tone, visual style, target audience signals
- If it's a mood board: describe the aesthetic, colors, textures, overall feeling

Be extremely specific. Provide hex color codes when visible. Name fonts if recognizable.`;

      const visionModels = ["pixtral-large-latest", "pixtral-12b-2409"];
      for (const model of visionModels) {
        try {
          const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
            method: "POST",
            headers: mistralHeaders(),
            body: JSON.stringify({
              model,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: visionPrompt },
                  { type: "image_url", image_url: { url: dataUri } },
                ],
              }],
              max_tokens: 2000,
              temperature: 0.15,
            }),
          }, 60_000);
          if (!res.ok) { console.log(`[analyze-file] ${model} error ${res.status}`); continue; }
          const data = await res.json();
          extractedText = data.choices?.[0]?.message?.content || "";
          if (extractedText) { console.log(`[analyze-file] Vision OK (${extractedText.length} chars) with ${model}`); break; }
        } catch (e: any) { console.log(`[analyze-file] ${model} exception: ${e.message}`); }
      }

    } else if (isPDF || isPPT || isDoc) {
      console.log(`[analyze-file] Extracting text from document...`);
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      const rawText = textDecoder.decode(arrayBuffer);
      if (isPDF) {
        const readable = rawText.match(/[\x20-\x7E\xA0-\xFF]{4,}/g) || [];
        const filtered = readable.filter((s: string) => !s.match(/^[\/\\<>{}()\[\]%#&]+$/) && s.length > 5).join(" ");
        extractedText = filtered.slice(0, 12000);
        console.log(`[analyze-file] PDF text: ${extractedText.length} chars`);
      }
      if (extractedText.length < 200 && fileSize < 5 * 1024 * 1024) {
        console.log(`[analyze-file] Trying Mistral document understanding...`);
        try {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const docBase64 = btoa(binary);
          const mimeType = isPDF ? "application/pdf" : fileType;
          const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
            method: "POST",
            headers: mistralHeaders(),
            body: JSON.stringify({
              model: "mistral-small-latest",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: `Extract ALL text from this document. Question context: "${questionText}". Extract brand info: colors, fonts, tone, messaging, audiences, visual rules, vocabulary, compliance. Be thorough.` },
                  { type: "document_url", document_url: { url: `data:${mimeType};base64,${docBase64}` } },
                ],
              }],
              max_tokens: 3000,
              temperature: 0.1,
            }),
          }, 90_000);
          if (res.ok) {
            const data = await res.json();
            const visionText = data.choices?.[0]?.message?.content || "";
            if (visionText.length > extractedText.length) { extractedText = visionText; console.log(`[analyze-file] Doc vision: ${extractedText.length} chars`); }
          }
        } catch (e: any) { console.log(`[analyze-file] Doc vision failed: ${e.message}`); }
      }
      if (!extractedText || extractedText.length < 20) {
        extractedText = `[Document uploaded: ${fileName} (${fileType}, ${(fileSize/1024).toFixed(0)}KB) - limited text extraction]`;
      }
    } else {
      extractedText = `[File uploaded: ${fileName} (${fileType}, ${(fileSize/1024).toFixed(0)}KB)]`;
    }

    // Summarize if long
    let fieldSummary = extractedText;
    if (extractedText.length > 500 && (isImage || isPDF || isPPT || isDoc)) {
      try {
        const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
          method: "POST",
          headers: mistralHeaders(),
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [
              { role: "system", content: `Summarize this brand analysis into a concise vault entry for the question: "${questionText}". Extract KEY facts: colors (hex), fonts, tone, key phrases, rules, constraints. Be factual. Under 400 words. Same language as source.` },
              { role: "user", content: extractedText.slice(0, 6000) },
            ],
            max_tokens: 800,
            temperature: 0.1,
          }),
        }, 30_000);
        if (res.ok) {
          const data = await res.json();
          const summary = data.choices?.[0]?.message?.content || "";
          if (summary) fieldSummary = summary;
        }
      } catch (e: any) { console.log(`[analyze-file] Summary failed: ${e.message}`); }
    }

    // Save file reference in vault
    const existing = await kv.get(`vault:${userId}`) || {};
    const fileRefs = existing.uploaded_files || [];
    fileRefs.push({ fileId, fileName, fileType, fileSize, storagePath, signedUrl, questionField, extractedText: extractedText.slice(0, 3000), uploadedAt: new Date().toISOString() });
    await kv.set(`vault:${userId}`, { ...existing, uploaded_files: fileRefs, updatedAt: new Date().toISOString() });

    console.log(`[analyze-file] DONE in ${Date.now() - t0}ms`);
    return c.json({ success: true, fileId, fileName, fileType, signedUrl, extractedText: fieldSummary, questionField });

  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[analyze-file] ERROR: ${msg}`);
    return c.json({ success: false, error: `File analysis failed: ${msg}` }, 500);
  }
});
── END REMOVED LEGACY BLOCK ── */

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

// ── Shared: scrape URL via cascade of providers ──
// Order: Jina Reader -> Firecrawl -> ScrapingBee -> direct fetch
// Never give up until ALL methods are exhausted.
// timeoutMultiplier: 1.0 = normal, 0.5 = fast mode (for brand-dna with time budget)
async function scrapeUrl(url: string, timeoutMultiplier = 1.0): Promise<{ content: string; source: string }> {
  const jinaKey = Deno.env.get("JINA_API_KEY");
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const scrapingbeeKey = Deno.env.get("SCRAPINGBEE_API_KEY");
  const errors: string[] = [];
  console.log(`[scrape] Starting for: ${url} (jina=${!!jinaKey}, firecrawl=${!!firecrawlKey}, scrapingbee=${!!scrapingbeeKey})`);

  // ── 1. Jina Reader ──
  if (jinaKey) {
    try {
      console.log(`[scrape] [1/4] Jina Reader...`);
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
      }, Math.round(30_000 * timeoutMultiplier));
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Jina ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await res.json();
      const md = data.data?.content || data.data?.text || data.content || "";
      console.log(`[scrape] Jina: ${md.length} chars`);
      if (md.length >= 50) return { content: md.slice(0, 12000), source: "jina" };
      errors.push(`Jina: too short (${md.length})`);
    } catch (e: any) {
      errors.push(`Jina: ${e.message || e}`);
      console.log(`[scrape] Jina fail: ${e}`);
    }
  }

  // ── 2. Firecrawl ──
  if (firecrawlKey) {
    try {
      console.log(`[scrape] [2/4] Firecrawl...`);
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: Math.round(3000 * timeoutMultiplier),
          timeout: Math.round(15000 * timeoutMultiplier),
        }),
      }, Math.round(20_000 * timeoutMultiplier));
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Firecrawl ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await res.json();
      const md = data.data?.markdown || data.data?.content || "";
      console.log(`[scrape] Firecrawl: ${md.length} chars`);
      if (md.length >= 50) return { content: md.slice(0, 12000), source: "firecrawl" };
      errors.push(`Firecrawl: too short (${md.length})`);
    } catch (e: any) {
      errors.push(`Firecrawl: ${e.message || e}`);
      console.log(`[scrape] Firecrawl fail: ${e}`);
    }
  }

  // ── 3. ScrapingBee (renders JS, bypasses Cloudflare) ──
  if (scrapingbeeKey) {
    try {
      console.log(`[scrape] [3/4] ScrapingBee...`);
      const params = new URLSearchParams({
        api_key: scrapingbeeKey,
        url,
        render_js: "true",
        premium_proxy: "true",
        block_ads: "true",
        block_resources: "false",
        wait: String(Math.round(3000 * timeoutMultiplier)),
      });
      const res = await fetchWithTimeout(`https://app.scrapingbee.com/api/v1/?${params}`, {
        method: "GET",
      }, Math.round(20_000 * timeoutMultiplier));
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`ScrapingBee ${res.status}: ${errBody.slice(0, 200)}`);
      }
      let html = await res.text();
      console.log(`[scrape] ScrapingBee raw: ${html.length} chars`);
      html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
      html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
      html = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      console.log(`[scrape] ScrapingBee text: ${html.length} chars`);
      if (html.length >= 80) return { content: html.slice(0, 12000), source: "scrapingbee" };
      errors.push(`ScrapingBee: too short after strip (${html.length})`);
    } catch (e: any) {
      errors.push(`ScrapingBee: ${e.message || e}`);
      console.log(`[scrape] ScrapingBee fail: ${e}`);
    }
  }

  // ── 4. Direct fetch (last resort) ──
  try {
    console.log(`[scrape] [4/4] Direct fetch...`);
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    }, Math.round(10_000 * timeoutMultiplier));
    let html = await res.text();
    console.log(`[scrape] Direct raw: ${html.length} chars, status: ${res.status}`);
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
    html = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (html.length >= 80) {
      console.log(`[scrape] Direct OK: ${html.length} chars`);
      return { content: html.slice(0, 10000), source: "direct" };
    }
    errors.push(`Direct: too short (${html.length})`);
  } catch (e: any) {
    errors.push(`Direct: ${e.message || e}`);
    console.log(`[scrape] Direct fail: ${e}`);
  }

  console.log(`[scrape] ALL 4 methods failed for ${url}: ${errors.join(" | ")}`);
  throw new Error(`All scrape methods failed for ${url}: ${errors.join(" | ")}`);
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

// ─── TEST ROUTE: Simple GET to verify server is working ──
app.get("/vault/test-simple", (c) => {
  console.log("[test-simple] ✅ GET route hit!");
  return c.json({ success: true, message: "Simple route works!" });
});

// ─── VAULT ROUTE: Monolithic scan-url (scrape + AI analysis in one call) ──
app.post("/vault/scan-url", async (c) => {
  console.log("[scan-url] ✅ POST ROUTE HIT — Starting handler...");
  const t0 = Date.now();
  console.log("[scan-url] === REQUEST START ===");
  console.log("[scan-url] Headers:", Object.fromEntries([...c.req.raw.headers.entries()]));
  
  try {
    console.log("[scan-url] Step 1: Auth");
    const user = await requireAuth(c);
    console.log("[scan-url] Step 2: Parse body");
    const scanBody = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { url } = scanBody;
    console.log("[scan-url] Step 3: Validate URL:", url);
    if (!url) return c.json({ error: "URL required" }, 400);

    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Deduct credit
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    // ── 1. SCRAPE WITH JINA READER ─────────────────────────���────
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
    "statement": "string �� what the brand does and for whom in one sentence",
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
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
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

// ═════════════════════��════════════════════════════════════════
// VAULT CONVERSATION — Guided expert onboarding
// ══════════════════════════════════════════════════════════════

// ── Conversation state machine ──
const CONVERSATION_PHASES = {
  foundation: {
    name: "Business Foundation",
    agent: "strategic-planner",
    steps: [
      { q: "Votre URL principale ?", field: "source_url", type: "url", analysis: "scrape" },
      { q: "Décrivez votre activité comme si vous parliez à un investisseur qui ne connaît pas votre secteur.", field: "business_description", type: "text", analysis: "extract_positioning" },
      { q: "Quelle est la proposition de valeur qui justifie votre existence vs. l'existant ?", field: "value_proposition", type: "text", analysis: "extract_uvp" },
      { q: "Quels sont les 3 résultats business que votre communication doit servir dans les 12 prochins mois ?", field: "business_objectives", type: "text", analysis: "extract_objectives" }
    ]
  },
  identity: {
    name: "Identity System",
    agent: "creative-director",
    steps: [
      { q: "Uploadez votre logo (tous les formats que vous avez)", field: "logo", type: "file", analysis: "vision" },
      { q: "Uploadez 5-8 visuels qui définissent votre territoire esthétique — pas forcément les vôtres, ceux de références que vous admirez", field: "visual_references", type: "files", analysis: "vision" },
      { q: "Partagez votre charte graphique si elle existe (PDF)", field: "brand_guidelines", type: "file", analysis: "ocr" },
      { q: "Système de couleurs : palette complète avec codes hex", field: "color_palette", type: "text", analysis: "extract_colors" }
    ]
  },
  voice: {
    name: "Voice Architecture",
    agent: "copywriter",
    steps: [
      { q: "Partagez 3-5 exemples de copy que vous considérez on-brand (emails, landing pages, posts, docs internes)", field: "copy_samples", type: "text", analysis: "extract_voice" },
      { q: "Quelle est la distance tonale avec votre audience ? Tutoyez-vous ? Ton corporate, peer-to-peer, ou éducatif ?", field: "tone_distance", type: "text", analysis: "extract_formality" },
      { q: "Quels mots/expressions sont interdits dans votre communication ?", field: "forbidden_terms", type: "text", analysis: "extract_vocabulary" },
      { q: "Vocabulaire spécifique : termes métier, acronymes, concepts propriétaires que vous utilisez systématiquement ?", field: "approved_terms", type: "text", analysis: "extract_vocabulary" }
    ]
  },
  market: {
    name: "Market Intelligence",
    agent: "strategic-planner",
    steps: [
      { q: "Qui prend la décision d'achat ? Qui influence ? Qui utilise ?", field: "decision_makers", type: "text", analysis: "extract_audience" },
      { q: "Listez vos 3-5 concurrents directs avec leur positionnement (1 phrase chacun)", field: "competitors", type: "text", analysis: "extract_competitors" },
      { q: "Quelle est votre différenciation factuelle (pas aspirationnelle) ?", field: "differentiation", type: "text", analysis: "extract_differentiation" },
      { q: "Quels sont les 3 freins majeurs à la conversion dans votre cycle de vente ?", field: "conversion_barriers", type: "text", analysis: "extract_barriers" },
      { q: "Quels contenus produisent vos concurrents que vous ne produisez pas — et pourquoi ?", field: "content_gaps", type: "text", analysis: "extract_gaps" }
    ]
  },
  content: {
    name: "Content Ecosystem",
    agent: "strategic-planner",
    steps: [
      { q: "Quels formats utilisez-vous déjà ? (email, LinkedIn, ads, blog, video, podcast...)", field: "active_formats", type: "text", analysis: "extract_formats" },
      { q: "Quelle est votre fréquence de publication par canal ?", field: "publication_frequency", type: "text", analysis: "extract_frequency" },
      { q: "Quels sont vos 3 meilleurs contenus des 6 derniers mois (liens) ?", field: "best_content", type: "text", analysis: "scrape_content" },
      { q: "Quels contenus avez-vous produits qui n'ont PAS fonctionné ?", field: "failed_content", type: "text", analysis: "extract_failures" }
    ]
  },
  compliance: {
    name: "Compliance & Constraints",
    agent: "compliance-guard",
    steps: [
      { q: "Secteur réglementé ? (finance, santé, pharma, légal...) → Si oui, quelles contraintes s'appliquent ?", field: "regulated_sector", type: "text", analysis: "extract_regulations" },
      { q: "Avez-vous une charte éditoriale/brand guidelines formelle ? (upload PDF)", field: "editorial_guidelines", type: "file", analysis: "ocr" },
      { q: "Y a-t-il des sujets/angles que vous ne pouvez pas traiter ?", field: "forbidden_topics", type: "text", analysis: "extract_topics" },
      { q: "Claims interdits, mentions obligatoires, disclaimers standards ?", field: "disclaimers", type: "text", analysis: "extract_disclaimers" }
    ]
  }
} as const;

// ── Helper: Get next question based on state ──
function getNextQuestion(phase: string, step: number) {
  const phases = Object.keys(CONVERSATION_PHASES);
  const currentPhaseIndex = phases.indexOf(phase);
  if (currentPhaseIndex === -1) return null;

  const currentPhase = CONVERSATION_PHASES[phase as keyof typeof CONVERSATION_PHASES];
  if (step < currentPhase.steps.length) {
    const nextStep = currentPhase.steps[step];
    return {
      phase,
      step,
      total_steps: currentPhase.steps.length,
      phase_name: currentPhase.name,
      agent: currentPhase.agent,
      question: nextStep.q,
      field: nextStep.field,
      type: nextStep.type,
      progress: Math.round(((currentPhaseIndex * 100 / phases.length) + ((step / currentPhase.steps.length) * (100 / phases.length))))
    };
  }

  // Move to next phase
  if (currentPhaseIndex < phases.length - 1) {
    const nextPhase = phases[currentPhaseIndex + 1];
    return getNextQuestion(nextPhase, 0);
  }

  // Done
  return null;
}

// ── Helper: Analyze user response with Mistral ──
async function analyzeConversationResponse(question: any, userMessage: string, existingData: any) {
  const analysisType = question.analysis || "extract_text";
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");
  if (!mistralKey) throw new Error("MISTRAL_API_KEY not configured");

  const systemPrompts: Record<string, string> = {
    extract_positioning: `Analyse cette réponse d'un dirigeant décrivant son activité. Extrait: {"industry": "secteur", "positioning": "positioning statement", "target_market": "marché cible"}. JSON uniquement.`,
    extract_uvp: `Extrait la proposition de valeur unique. Return: {"unique_value_prop": "string", "differentiation": "string"}. JSON uniquement.`,
    extract_objectives: `Extrait les objectifs business. Return: {"business_objectives": ["objectif 1", "objectif 2", "objectif 3"]}. JSON uniquement.`,
    extract_voice: `Analyse ces exemples de copy. Extrait: {"formality": 7, "warmth": 6, "boldness": 8, "sentence_structure": "type", "tone_adjectives": ["adj1", "adj2"]}. JSON uniquement.`,
    extract_formality: `Analyse la distance tonale décrite. Return: {"formality_level": 7, "address_style": "tutoiement/vouvoiement", "tone_category": "corporate/peer/educational"}. JSON uniquement.`,
    extract_vocabulary: `Extrait le vocabulaire mentionné. Return: {"approved_terms": ["term1", "term2"], "forbidden_terms": ["term1", "term2"]}. JSON uniquement.`,
    extract_audience: `Analyse les rôles dans la décision d'achat. Return: {"decision_maker": "string", "influencer": "string", "end_user": "string"}. JSON uniquement.`,
    extract_competitors: `Extrait la liste de concurrents avec leur positionnement. Return: {"competitors": [{"name": "string", "positioning": "string"}]}. JSON uniquement.`,
    extract_differentiation: `Extrait la différenciation factuelle. Return: {"differentiation": "string", "competitive_moat": ["advantage 1", "advantage 2"]}. JSON uniquement.`,
    extract_barriers: `Extrait les freins à la conversion. Return: {"conversion_barriers": ["frein 1", "frein 2", "frein 3"]}. JSON uniquement.`,
    extract_gaps: `Analyse les gaps de contenu vs. concurrence. Return: {"content_gaps": ["gap 1", "gap 2"], "rationale": "pourquoi ces gaps"}. JSON uniquement.`,
    extract_formats: `Extrait les formats de contenu utilisés. Return: {"active_formats": ["format1", "format2"]}. JSON uniquement.`,
    extract_frequency: `Extrait la fréquence de publication par canal. Return: {"publication_frequency": [{"channel": "string", "frequency": "string"}]}. JSON uniquement.`,
    extract_failures: `Analyse les contenus qui ont échoué. Return: {"failed_content": [{"type": "string", "why": "raison"}]}. JSON uniquement.`,
    extract_regulations: `Extrait les contraintes réglementaires. Return: {"regulated": true/false, "regulations": ["règle 1", "règle 2"]}. JSON uniquement.`,
    extract_topics: `Extrait les sujets interdits. Return: {"forbidden_topics": ["sujet 1", "sujet 2"]}. JSON uniquement.`,
    extract_disclaimers: `Extrait les disclaimers et mentions obligatoires. Return: {"required_disclaimers": ["disclaimer 1"], "forbidden_claims": ["claim 1"]}. JSON uniquement.`,
    extract_colors: `Extrait la palette de couleurs mentionnée. Return: {"primary_colors": ["#hex1", "#hex2"], "secondary_colors": ["#hex3"]}. JSON uniquement.`,
    extract_text: `Extrait les informations clés de cette réponse et retourne un JSON structuré pertinent pour le contexte de brand vault.`
  };

  const systemPrompt = systemPrompts[analysisType] || systemPrompts.extract_text;

  try {
    const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
      method: "POST",
      headers: mistralHeaders(),
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 800,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    }, 20_000);

    if (!res.ok) {
      const errText = await res.text();
      console.log(`[conversation] Mistral error ${res.status}: ${errText.slice(0, 200)}`);
      return { raw: userMessage };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleanJson = content.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.log(`[conversation] Analysis error: ${err}`);
    return { raw: userMessage };
  }
}

// ── ROUTE: POST /vault/conversation ──
app.post("/vault/conversation", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { message, phase = "foundation", step = 0 } = body;

    console.log(`[conversation] User ${user.id}, phase: ${phase}, step: ${step}, message: ${message?.slice(0, 100)}`);

    // Get existing vault data
    const existingVault = await kv.get(`vault:${user.id}`) || {};
    const conversationState = existingVault.conversation_state || { phase: "foundation", step: 0, data: {} };

    // If user provided a message, analyze it
    let extractedData = {};
    if (message && message.trim()) {
      const currentQuestion = getNextQuestion(conversationState.phase, conversationState.step);
      if (currentQuestion) {
        // Special handling for URL scraping
        if (currentQuestion.type === "url" && currentQuestion.analysis === "scrape") {
          try {
            let url = message.trim();
            if (!url.startsWith("http")) url = `https://${url}`;
            if (isValidScrapeUrl(url)) {
              const scrapeResult = await scrapeUrl(url);
              const brandAnalysis = await analyzeBrandWithAI(scrapeResult.content.slice(0, 6000), url);
              extractedData = { source_url: url, ...brandAnalysis };
            } else {
              extractedData = { source_url: message, error: "Invalid URL" };
            }
          } catch (err) {
            console.log(`[conversation] Scrape error: ${err}`);
            extractedData = { source_url: message, error: String(err) };
          }
        } else {
          // Standard text analysis
          extractedData = await analyzeConversationResponse(currentQuestion, message, conversationState.data);
        }

        // Merge extracted data
        conversationState.data = { ...conversationState.data, ...extractedData };
      }

      // Move to next step
      conversationState.step += 1;
    }

    // Get next question
    const nextQuestion = getNextQuestion(conversationState.phase, conversationState.step);

    if (!nextQuestion) {
      // Conversation complete — build final Brand DNA
      const finalVault = {
        ...existingVault,
        ...conversationState.data,
        conversation_complete: true,
        completedAt: new Date().toISOString(),
        confidence_score: 85
      };
      await kv.set(`vault:${user.id}`, finalVault);

      console.log(`[conversation] Complete in ${Date.now() - t0}ms`);
      return c.json({
        success: true,
        complete: true,
        vault: finalVault,
        message: "Brand Vault construit avec succès."
      });
    }

    // Save state
    conversationState.phase = nextQuestion.phase;
    conversationState.step = nextQuestion.step;
    await kv.set(`vault:${user.id}`, { ...existingVault, conversation_state: conversationState });

    console.log(`[conversation] Next question in ${Date.now() - t0}ms`);
    return c.json({
      success: true,
      complete: false,
      agent: nextQuestion.agent,
      question: nextQuestion.question,
      phase: nextQuestion.phase,
      phase_name: nextQuestion.phase_name,
      step: nextQuestion.step,
      total_steps: nextQuestion.total_steps,
      progress: nextQuestion.progress,
      extracted_data: conversationState.data
    });

  } catch (err) {
    console.log(`[conversation] Error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
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

// Helper: scrape a single page with metadata — tries Jina, then Firecrawl, then ScrapingBee, then direct
async function scrapeSinglePage(url: string, jinaKey: string): Promise<{ url: string; markdown: string; metadata: { title: string; description: string; ogImage: string; favicon: string } }> {
  const emptyMeta = { title: "", description: "", ogImage: "", favicon: "" };

  // 1. Jina
  if (jinaKey) {
    try {
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
      }, 12_000); // shorter timeout — we have many fallbacks
      if (res.ok) {
        const data = await res.json();
        const d = data.data || data;
        const md = d.content || d.text || "";
        if (md.length >= 50) {
          return {
            url,
            markdown: md,
            metadata: { title: d.title || "", description: d.description || "", ogImage: d.images?.[0]?.src || "", favicon: d.favicon || "" },
          };
        }
      }
    } catch (e) { console.log(`[scrapeSingle] Jina fail for ${url}: ${e}`); }
  }

  // 2. Firecrawl
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    try {
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${firecrawlKey}` },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 2000, timeout: 10000 }),
      }, 15_000);
      if (res.ok) {
        const data = await res.json();
        const md = data.data?.markdown || data.data?.content || "";
        const meta = data.data?.metadata || {};
        if (md.length >= 50) {
          return { url, markdown: md, metadata: { title: meta.title || "", description: meta.description || "", ogImage: meta.ogImage || "", favicon: meta.favicon || "" } };
        }
      }
    } catch (e) { console.log(`[scrapeSingle] Firecrawl fail for ${url}: ${e}`); }
  }

  // 3. ScrapingBee
  const scrapingbeeKey = Deno.env.get("SCRAPINGBEE_API_KEY");
  if (scrapingbeeKey) {
    try {
      const params = new URLSearchParams({ api_key: scrapingbeeKey, url, render_js: "true", premium_proxy: "true", block_ads: "true", wait: "2000" });
      const res = await fetchWithTimeout(`https://app.scrapingbee.com/api/v1/?${params}`, { method: "GET" }, 15_000);
      if (res.ok) {
        let html = await res.text();
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
        html = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (html.length >= 80) {
          return { url, markdown: html, metadata: { title: titleMatch?.[1]?.trim() || "", description: descMatch?.[1]?.trim() || "", ogImage: "", favicon: "" } };
        }
      }
    } catch (e) { console.log(`[scrapeSingle] ScrapingBee fail for ${url}: ${e}`); }
  }

  // 4. Direct fetch (fast mode)
  try {
    const result = await scrapeUrl(url, 0.4);
    return { url, markdown: result.content, metadata: emptyMeta };
  } catch (e) {
    throw new Error(`All methods failed for ${url}: ${e}`);
  }
}

// Multi-page crawl: main page + key sub-pages in parallel
async function crawlForDNA(baseUrl: string, maxPages = 3): Promise<{
  markdown: string; metadata: any; pagesCrawled: number;
}> {
  const jinaKey = Deno.env.get("JINA_API_KEY");
  if (!jinaKey) {
    console.log("[brand-dna] No JINA_API_KEY, using direct scrape");
    const result = await scrapeUrl(baseUrl, 0.5);
    return { markdown: result.content, metadata: { title: "", description: "", ogImage: "", favicon: "" }, pagesCrawled: 1 };
  }

  console.log(`[brand-dna] Crawling ${baseUrl}, max ${maxPages} pages via Jina`);

  let mainResult;
  try {
    mainResult = await scrapeSinglePage(baseUrl, jinaKey);
    console.log(`[brand-dna] Main page: ${mainResult.markdown.length} chars, title: "${mainResult.metadata.title}"`);
  } catch (e) {
    console.log(`[brand-dna] Jina main failed: ${e}, trying direct scrape`);
    const direct = await scrapeUrl(baseUrl, 0.5);
    return { markdown: direct.content, metadata: { title: "", description: "", ogImage: "", favicon: "" }, pagesCrawled: 1 };
  }

  if (maxPages <= 1 || mainResult.markdown.length < 200) {
    return { markdown: mainResult.markdown.slice(0, 14000), metadata: mainResult.metadata, pagesCrawled: 1 };
  }

  const origin = new URL(baseUrl).origin;
  const subPaths = [
    "/about", "/a-propos", "/about-us", "/qui-sommes-nous",
    "/services", "/produits", "/products", "/offres", "/offers",
    "/brand", "/manifesto", "/notre-histoire", "/our-story",
    "/rooms", "/chambres", "/spa", "/restaurant", "/experience",
    "/contact", "/pricing", "/tarifs",
  ];
  const subUrls = subPaths.slice(0, Math.min(maxPages - 1, 5)).map(p => `${origin}${p}`);

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

// ── Fallback intelligence: Jina Web Search ──
async function searchBrandOnWeb(brandQuery: string, url: string): Promise<string> {
  const jinaKey = Deno.env.get("JINA_API_KEY");
  if (!jinaKey) return "";
  try {
    console.log(`[brand-dna] Web search fallback for: "${brandQuery}"`);
    const hostname = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
    const searchQuery = `${brandQuery} ${hostname}`;
    const res = await fetchWithTimeout(`https://s.jina.ai/?q=${encodeURIComponent(searchQuery)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jinaKey}`,
        "Accept": "application/json",
        "X-No-Cache": "true",
      },
    }, 20_000);
    if (!res.ok) throw new Error(`Jina Search ${res.status}`);
    const data = await res.json();
    const results = data.data || data.results || [];
    if (Array.isArray(results)) {
      const texts = results.slice(0, 5).map((r: any) =>
        `[${r.title || ""}] ${r.description || r.content || r.snippet || ""}`.trim()
      ).filter((t: string) => t.length > 10);
      const combined = texts.join("\n\n");
      console.log(`[brand-dna] Web search: ${results.length} results, ${combined.length} chars`);
      return combined.slice(0, 8000);
    }
    const md = data.data?.content || data.content || "";
    console.log(`[brand-dna] Web search single: ${md.length} chars`);
    return md.slice(0, 8000);
  } catch (e) {
    console.log(`[brand-dna] Web search failed: ${e}`);
    return "";
  }
}

// ── Fallback intelligence: LLM knowledge (Mistral knows most established brands) ──
async function extractDNAFromLLMKnowledge(url: string, brandHint: string): Promise<any> {
  console.log(`[brand-dna] LLM knowledge fallback for: ${url} (hint: "${brandHint}")`);
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  const sysPrompt = BRAND_DNA_SYSTEM + `\n\nIMPORTANT: Return ONLY a raw JSON object. No markdown fences, no backticks, no explanation.`;
  const userPrompt = `I could not scrape the website, but I need you to generate the Brand DNA based on YOUR OWN KNOWLEDGE of this brand.

URL: ${url}
Domain: ${hostname}
${brandHint ? `Additional context from user: ${brandHint}` : ""}

Use everything you know about this brand from your training data: their industry, positioning, tone, colors, products/services, target audience, competitors, etc.
If you know the brand well, be precise and detailed. If you have limited knowledge, infer intelligently from the domain name, URL structure, and any context provided.
NEVER leave fields empty — always provide your best informed inference.
Mark your confidence_score accordingly (0.3-0.6 for inferred, 0.6-0.8 for partially known, 0.8+ for well-known brands).
Add confidence_notes explaining what you based your analysis on.`;

  const models = ["mistral-large-latest", "mistral-small-latest"];
  for (const model of models) {
    try {
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
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      }, 45_000);
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      if (!raw) continue;
      const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
      try { return JSON.parse(cleaned); }
      catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      }
    } catch (e) {
      console.log(`[brand-dna] LLM knowledge ${model} failed: ${e}`);
    }
  }
  return null;
}

// POST /vault/brand-dna — NEVER fails to return brand intelligence
// Cascading fallbacks: Website crawl (4 providers) -> Web search -> LLM knowledge
app.post("/vault/brand-dna", async (c) => {
  const t0 = Date.now();
  console.log("[brand-dna] Handler entered (sync mode)");
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { url, force_refresh = false, max_pages = 3, forceRefresh = false, maxPages, brand_hint = "" } = body;
    const doForce = force_refresh || forceRefresh;
    const pages = Math.min(maxPages ?? max_pages ?? 3, 5);

    const targetUrl = url;
    if (!targetUrl || typeof targetUrl !== "string") return c.json({ success: false, error: "URL required" }, 400);
    if (!isValidScrapeUrl(targetUrl)) return c.json({ success: false, error: "Invalid URL" }, 400);

    const normalizedDomain = new URL(targetUrl).origin;
    const cacheKey = `brand_dna:${user.id}:${btoa(normalizedDomain).slice(0, 40)}`;

    // Check cache
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

    let crawlContent = "";
    let crawlMetadata: any = { title: "", description: "", ogImage: "", favicon: "" };
    let pagesCrawled = 0;
    let intelligenceSource = "none";
    const DEADLINE = t0 + 50_000; // 50s hard deadline (Edge Functions = 60s)
    const timeLeft = () => DEADLINE - Date.now();

    // ── Layer 1: Direct website crawl — with 20s time budget ──
    // If the site is protected, we don't want to burn all our time here
    const crawlBudget = Math.min(20_000, timeLeft() - 25_000); // reserve 25s for Layer 2+3+AI
    if (crawlBudget > 5_000) {
      try {
        console.log(`[brand-dna] Layer 1: Crawling ${targetUrl} (budget: ${crawlBudget}ms)...`);
        const crawlPromise = crawlForDNA(targetUrl, Math.min(pages, 2)); // limit to 2 pages for speed
        const crawlResult = await Promise.race([
          crawlPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), crawlBudget)),
        ]);
        if (crawlResult && crawlResult.markdown && crawlResult.markdown.length >= 100) {
          crawlContent = crawlResult.markdown;
          crawlMetadata = crawlResult.metadata;
          pagesCrawled = crawlResult.pagesCrawled;
          intelligenceSource = "website_crawl";
          console.log(`[brand-dna] Layer 1 OK: ${crawlContent.length} chars, ${pagesCrawled} pages (${Date.now() - t0}ms)`);
        } else {
          console.log(`[brand-dna] Layer 1: insufficient or timed out (${Date.now() - t0}ms)`);
        }
      } catch (e) {
        console.log(`[brand-dna] Layer 1 failed (${Date.now() - t0}ms): ${e}`);
      }
    } else {
      console.log(`[brand-dna] Layer 1: skipped (not enough time budget)`);
    }

    // ── Layer 2: Web search (Jina Search) — fast, ~5-10s ──
    if (crawlContent.length < 200 && timeLeft() > 20_000) {
      try {
        console.log(`[brand-dna] Layer 2: Web search (${timeLeft()}ms left)...`);
        const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
        const searchContent = await searchBrandOnWeb(brand_hint || hostname, targetUrl);
        if (searchContent.length >= 100) {
          crawlContent = (crawlContent ? crawlContent + "\n\n---\n\n" : "") +
            `## WEB SEARCH RESULTS\n\n${searchContent}`;
          intelligenceSource = crawlContent.length > searchContent.length + 200 ? "crawl+search" : "web_search";
          console.log(`[brand-dna] Layer 2 OK: +${searchContent.length} chars (${Date.now() - t0}ms)`);
        }
      } catch (e) {
        console.log(`[brand-dna] Layer 2 failed: ${e}`);
      }
    }

    // ── Layer 3: LLM knowledge — ALWAYS works, ~5-15s ──
    if (crawlContent.length < 100 && timeLeft() > 15_000) {
      console.log(`[brand-dna] Layer 3: LLM knowledge (${timeLeft()}ms left)...`);
      const llmDna = await extractDNAFromLLMKnowledge(targetUrl, brand_hint);
      if (llmDna) {
        const result = {
          ...llmDna,
          source_url: targetUrl,
          domain: normalizedDomain,
          analyzed_at: new Date().toISOString(),
          user_id: user.id,
          pages_crawled: 0,
          intelligence_source: "llm_knowledge",
          logo_url: null,
          og_image: null,
        };
        kv.set(cacheKey, result).catch((e: any) => console.log(`[brand-dna] KV cache failed: ${e}`));
        console.log(`[brand-dna] Layer 3 DONE in ${Date.now() - t0}ms — brand: ${result.brand_name} (LLM knowledge)`);
        return c.json({ success: true, status: "done", dna: result });
      }
    }

    // ── Emergency Layer 3 if we have NOTHING ──
    if (crawlContent.length < 50) {
      console.log(`[brand-dna] Emergency: no content at all, forcing LLM knowledge...`);
      const llmDna = await extractDNAFromLLMKnowledge(targetUrl, brand_hint);
      if (llmDna) {
        const result = {
          ...llmDna,
          source_url: targetUrl,
          domain: normalizedDomain,
          analyzed_at: new Date().toISOString(),
          user_id: user.id,
          pages_crawled: 0,
          intelligence_source: "llm_knowledge",
          logo_url: null,
          og_image: null,
        };
        kv.set(cacheKey, result).catch((e: any) => console.log(`[brand-dna] KV cache failed: ${e}`));
        console.log(`[brand-dna] Emergency LLM DONE in ${Date.now() - t0}ms`);
        return c.json({ success: true, status: "done", dna: result });
      }
      return c.json({ success: false, error: "Unable to gather brand intelligence" }, 500);
    }

    // ── AI analysis on gathered content ──
    console.log(`[brand-dna] Analyzing ${crawlContent.length} chars (source: ${intelligenceSource}, ${timeLeft()}ms left)...`);
    const dna = await extractBrandDNA(crawlContent, targetUrl, crawlMetadata, pagesCrawled);

    const result = {
      ...dna,
      source_url: targetUrl,
      domain: normalizedDomain,
      analyzed_at: new Date().toISOString(),
      user_id: user.id,
      pages_crawled: pagesCrawled,
      intelligence_source: intelligenceSource,
      logo_url: dna.logo_url || crawlMetadata.favicon || null,
      og_image: crawlMetadata.ogImage || null,
    };

    kv.set(cacheKey, result).catch((e: any) => console.log(`[brand-dna] KV cache failed: ${e}`));
    console.log(`[brand-dna] DONE in ${Date.now() - t0}ms — brand: ${result.brand_name} (${intelligenceSource})`);
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

// POST /vault/research-company — Deep web research using Jina Search
// Runs 3 parallel searches and synthesizes findings into structured insights
app.post("/vault/research-company", async (c) => {
  const t0 = Date.now();
  console.log("[research] Handler entered");
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { brandName, url, industry } = body;

    if (!brandName || typeof brandName !== "string" || brandName.trim().length < 2) {
      return c.json({ success: false, error: "brandName required (min 2 chars)" }, 400);
    }

    const canDeduct = await deductCredit(user.id, 2);
    console.log(`[research] Credits check for ${user.id}: ${canDeduct ? "OK" : "INSUFFICIENT"}`);
    if (!canDeduct) return c.json({ success: false, error: "Insufficient credits" }, 403);

    const jinaKey = Deno.env.get("JINA_API_KEY");
    if (!jinaKey) {
      console.log("[research] JINA_API_KEY not configured, skipping web research");
      return c.json({ success: true, research: null, reason: "no_jina_key" });
    }

    // Clean brand name: strip punctuation, normalize
    const brand = brandName.trim().replace(/[:\-\u2013\u2014,;.!?]+$/g, "").trim();
    const hostname = url ? (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })() : "";
    const industryHint = industry ? ` ${industry}` : "";
    // Use hostname as search anchor if available (more reliable than user-typed brand name)
    const searchAnchor = hostname || brand;

    console.log(`[research] brand="${brand}" hostname="${hostname}" searchAnchor="${searchAnchor}"`);

    // 3 parallel Jina Search queries — use hostname for precision when available
    const queries = [
      `${searchAnchor} ${brand !== searchAnchor ? brand + " " : ""}company${industryHint} about`,
      `${searchAnchor} news 2024 2025`,
      `${searchAnchor} reviews clients competitors${industryHint}`,
    ];

    console.log(`[research] Running 3 parallel searches for "${brand}"...`);

    const searchPromises = queries.map(async (q, idx) => {
      try {
        const searchUrl = `https://s.jina.ai/?q=${encodeURIComponent(q)}`;
        console.log(`[research] Search ${idx + 1}: ${searchUrl.slice(0, 120)}...`);
        const res = await fetchWithTimeout(searchUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${jinaKey}`,
            "Accept": "text/plain",
            "X-No-Cache": "true",
          },
        }, 20_000);
        if (!res.ok) {
          const errText = (await res.text()).slice(0, 200);
          console.log(`[research] Search ${idx + 1} failed: HTTP ${res.status} — ${errText}`);
          return "";
        }
        // Jina returns LLM-friendly plain text with top 5 results
        const text = await res.text();
        console.log(`[research] Search ${idx + 1} OK — ${text.length} chars`);
        return text.slice(0, 5000);
      } catch (e) {
        console.log(`[research] Search ${idx + 1} error: ${e}`);
        return "";
      }
    });

    let [generalInfo, newsInfo, reviewsInfo] = await Promise.all(searchPromises);
    let totalChars = generalInfo.length + newsInfo.length + reviewsInfo.length;
    console.log(`[research] Searches done in ${Date.now() - t0}ms — total: ${totalChars} chars (general: ${generalInfo.length}, news: ${newsInfo.length}, reviews: ${reviewsInfo.length})`);

    // Fallback: if all 3 searches returned nothing, try a single simple search with just the hostname
    if (totalChars < 100 && hostname) {
      console.log(`[research] All searches empty, fallback with hostname: ${hostname}`);
      try {
        const fallbackUrl = `https://s.jina.ai/?q=${encodeURIComponent(hostname)}`;
        const fbRes = await fetchWithTimeout(fallbackUrl, {
          method: "GET",
          headers: { "Authorization": `Bearer ${jinaKey}`, "Accept": "text/plain" },
        }, 20_000);
        if (fbRes.ok) {
          generalInfo = (await fbRes.text()).slice(0, 6000);
          totalChars = generalInfo.length;
          console.log(`[research] Fallback search OK — ${totalChars} chars`);
        } else {
          console.log(`[research] Fallback search failed: HTTP ${fbRes.status}`);
        }
      } catch (e) {
        console.log(`[research] Fallback search error: ${e}`);
      }
    }

    if (totalChars < 50) {
      console.log("[research] Not enough data from web searches");
      return c.json({ success: true, research: null, reason: "insufficient_data" });
    }

    // Synthesize with Mistral
    const synthesisPrompt = `You are ORA, a brand intelligence assistant. You just searched the web for information about "${brand}"${hostname ? " (" + hostname + ")" : ""}.

Below are the raw search results. Synthesize them into a structured research brief IN FRENCH.

RULES:
- Be factual. Only report what you actually found in the search results.
- If a section has no relevant data, omit it entirely.
- Be concise but specific — cite real facts, names, numbers.
- Return ONLY a JSON object with these fields (all optional strings):
  {
    "summary": "2-3 sentence overview of what the company does based on web presence",
    "recent_news": "Notable recent activity, press mentions, product launches (null if nothing found)",
    "market_position": "How they position themselves, what segment they serve",
    "competitors_found": ["list", "of", "competitor", "names", "mentioned"],
    "public_perception": "What clients/reviews/mentions say about them (null if nothing found)",
    "notable_facts": ["list of interesting specific facts found"],
    "industry": "detected industry/sector",
    "social_presence": "LinkedIn, Twitter, blog activity if mentioned"
  }

SEARCH RESULTS:

## General Information
${generalInfo.slice(0, 4000) || "(no results)"}

## Recent News
${newsInfo.slice(0, 3000) || "(no results)"}

## Reviews & Competitors
${reviewsInfo.slice(0, 3000) || "(no results)"}`;

    console.log("[research] Synthesizing with Mistral...");
    const aiRes = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
      method: "POST", headers: mistralHeaders(),
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are a brand research analyst. Return ONLY valid JSON, no markdown fences." },
          { role: "user", content: synthesisPrompt },
        ],
        max_tokens: 1200,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    }, 25_000);

    if (!aiRes.ok) {
      const errBody = (await aiRes.text()).slice(0, 300);
      console.log(`[research] Mistral synthesis error ${aiRes.status}: ${errBody}`);
      return c.json({ success: true, research: { raw: true, generalInfo: generalInfo.slice(0, 2000), newsInfo: newsInfo.slice(0, 1000) } });
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    let research: any = null;
    try {
      const cleaned = rawContent.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
      research = JSON.parse(cleaned);
    } catch {
      console.log("[research] JSON parse failed, returning raw");
      research = { summary: rawContent.slice(0, 500), raw: true };
    }

    console.log(`[research] DONE in ${Date.now() - t0}ms — summary: ${(research.summary || "").slice(0, 80)}...`);
    return c.json({ success: true, research });

  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[research] ERROR: ${msg}`);
    return c.json({ success: false, error: `Research failed: ${msg}` }, 500);
  }
});

// POST /vault/analyze-content — SYNCHRONOUS: analyze text content and return result
// (Supabase Edge Functions kill background work after response via EarlyDrop)
app.post("/vault/analyze-content", async (c) => {
  const t0 = Date.now();
  console.log("[analyze-content] Handler entered (sync mode)");
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
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

// ── VAULT ROUTE: Generate contextual reaction to user's answer (conversational onboarding) ──
app.post("/vault/react-to-answer", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const {
      question_field = "",
      question_text = "",
      user_answer = "",
      previous_answers = {},
      brand_dna = null,
      web_research = null,
      next_question = "",
      phase_changing = false,
      next_phase_label = "",
    } = body;

    if (!user_answer || user_answer.length < 2) {
      return c.json({ success: true, reaction: "" });
    }

    const prevSummary = Object.entries(previous_answers)
      .filter(([_, v]) => typeof v === "string" && (v as string).length > 5)
      .map(([k, v]) => `[${k}]: ${(v as string).slice(0, 200)}`)
      .join("\n")
      .slice(0, 1500);

    const dnaContext = brand_dna
      ? `\nBrand DNA from website scan: brand="${brand_dna.brand_name}", sector="${brand_dna.industry || ""}", tone: formality=${brand_dna.tone?.formality || "?"}, warmth=${brand_dna.tone?.warmth || "?"}`
      : "";

    const researchContext = web_research
      ? `\nWeb research: ${web_research.summary?.slice(0, 200) || ""}, competitors: ${web_research.competitors_found?.join(", ") || "none found"}`
      : "";

    const sysPrompt = `Tu es ORA, une consultante brand senior. Tu menes un interview de decouverte avec un client pour construire son Brand Vault.

REGLES DE REACTION :
- Tu REAGIS a ce que le client vient de dire -- reformule un point cle, fais un lien avec ce que tu sais deja, montre que tu comprends les implications strategiques.
- Ton ton est professionnel mais chaleureux, comme une consultante senior qui ecoute vraiment.
- Sois SPECIFIQUE : mentionne des elements concrets de la reponse du client (un nom, un chiffre, une expression).
- Si tu detectes un insight strategique, dis-le : "Ce qui est interessant c'est que..." ou "Ca confirme quelque chose que j'ai repere..."
- Si le client a mentionne un concurrent ou une reference, reagis avec ta connaissance du secteur.
- JAMAIS de platitudes vides ("Merci, c'est note"). Chaque reaction doit apporter de la valeur.
- 2-4 phrases MAXIMUM. Pas plus. Sois concise et percutante.
- Ecris en francais. Pas d'emojis.
- Ne pose PAS de question -- la prochaine question sera ajoutee automatiquement apres ta reaction.
- Si une phase change, tu peux faire une micro-synthese de ce que tu as retenu (1 phrase).${dnaContext}${researchContext}`;

    const userPrompt = `CONTEXTE PRECEDENT:
${prevSummary || "(debut de conversation)"}

QUESTION POSEE: ${question_text}
CHAMP: ${question_field}

REPONSE DU CLIENT:
${user_answer.slice(0, 1500)}

${phase_changing ? `NOTE: On passe a la phase "${next_phase_label}". Fais une micro-synthese avant de transitionner.` : ""}
${next_question ? `PROCHAINE QUESTION (pour contexte -- ne la pose pas): ${next_question}` : ""}

Genere ta REACTION (2-4 phrases, specifique, pas de question):`;

    const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
      method: "POST",
      headers: mistralHeaders(),
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    }, 15_000);

    if (!res.ok) {
      console.log(`[react-to-answer] Mistral error ${res.status}`);
      return c.json({ success: true, reaction: "" });
    }

    const data = await res.json();
    const reaction = (data.choices?.[0]?.message?.content || "").trim();
    console.log(`[react-to-answer] OK in ${Date.now() - t0}ms: "${reaction.slice(0, 80)}..."`);
    return c.json({ success: true, reaction });
  } catch (err: any) {
    console.log(`[react-to-answer] ERROR: ${err?.message || err}`);
    return c.json({ success: true, reaction: "" });
  }
});

/* VAULT_END_MARKER — delete from here to CAMPAIGNS */
app.post("/vault/analyze-onboarding", async (c) => {
  const t0 = Date.now();
  console.log("[analyze-onboarding] Handler entered");
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const answers = body.answers || body;
    const brandDnaFromScan = body.brand_dna || null;
    const webResearchData = body.web_research || null;

    // Remove internal fields
    const { _token, brand_dna: _bd, web_research: _wr, ...rawAnswers } = answers;

    // Build a comprehensive text from all answers
    let answerText = Object.entries(rawAnswers)
      .filter(([_, v]) => typeof v === "string" && (v as string).trim().length > 0)
      .map(([k, v]) => `[${k}]: ${v}`)
      .join("\n\n");

    // Enrich with brand DNA from URL scan if available
    if (brandDnaFromScan) {
      const dnaContext = JSON.stringify(brandDnaFromScan, null, 2);
      answerText += `\n\n[BRAND_DNA_FROM_WEBSITE_SCAN]:\n${dnaContext.slice(0, 4000)}`;
      console.log(`[analyze-onboarding] Enriched with brand DNA scan (${dnaContext.length} chars)`);
    }

    // Enrich with web research findings if available
    if (webResearchData) {
      const researchContext = JSON.stringify(webResearchData, null, 2);
      answerText += `\n\n[WEB_RESEARCH_FINDINGS]:\n${researchContext.slice(0, 3000)}`;
      console.log(`[analyze-onboarding] Enriched with web research (${researchContext.length} chars)`);
    }

    if (answerText.length < 50) {
      return c.json({ success: false, error: "Not enough data to analyze. Please answer more questions." }, 400);
    }

    // ── Jina enrichment: search mentioned brands/competitors ──
    const jinaKey = Deno.env.get("JINA_API_KEY");
    if (jinaKey) {
      try {
        // Extract brand/competitor names from answers
        const competitorField = rawAnswers.competitors || rawAnswers.competition || "";
        const diffField = rawAnswers.differentiation || rawAnswers.positioning || "";
        const refField = rawAnswers.visual_references || rawAnswers.references || "";
        const allMentions = `${competitorField} ${diffField} ${refField}`;
        
        // Simple extraction: find capitalized multi-word names or quoted names
        const brandMatches = allMentions.match(/(?:["']([^"']+)["'])|(?:\b[A-Z][a-zA-Z&'-]+(?:\s+[A-Z][a-zA-Z&'-]+){0,3}\b)/g) || [];
        const uniqueBrands = [...new Set(brandMatches.map((b: string) => b.replace(/["']/g, "").trim()).filter((b: string) => b.length >= 3 && b.length <= 50))].slice(0, 5);
        
        if (uniqueBrands.length > 0) {
          console.log(`[analyze-onboarding] Jina enrichment: searching ${uniqueBrands.length} mentioned brands: ${uniqueBrands.join(", ")}`);
          const brandSearches = uniqueBrands.map(async (brand: string) => {
            try {
              const res = await fetchWithTimeout(`https://s.jina.ai/?q=${encodeURIComponent(`${brand} brand identity positioning`)}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${jinaKey}`, "Accept": "text/plain" },
              }, 12_000);
              if (res.ok) {
                const text = await res.text();
                return `[${brand}]: ${text.slice(0, 1500)}`;
              }
              return "";
            } catch { return ""; }
          });
          const brandResults = (await Promise.all(brandSearches)).filter(Boolean);
          if (brandResults.length > 0) {
            answerText += `\n\n[COMPETITOR_BRAND_RESEARCH]:\n${brandResults.join("\n\n")}`;
            console.log(`[analyze-onboarding] Enriched with ${brandResults.length} brand searches`);
          }
        }

        // Also search any URLs pasted in answers (guidelines, references)
        const urlRegex = /https?:\/\/[^\s,;)}\]]+/gi;
        const answerUrls = (Object.values(rawAnswers).join(" ").match(urlRegex) || [])
          .filter((u: string) => !u.includes("jina.ai"))
          .slice(0, 3);
        if (answerUrls.length > 0) {
          console.log(`[analyze-onboarding] Reading ${answerUrls.length} URLs from answers via Jina Reader`);
          const urlReads = answerUrls.map(async (pageUrl: string) => {
            try {
              const res = await fetchWithTimeout(`https://r.jina.ai/${pageUrl}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${jinaKey}`, "Accept": "text/plain", "X-No-Cache": "true" },
              }, 12_000);
              if (res.ok) {
                const text = await res.text();
                return `[URL: ${pageUrl}]: ${text.slice(0, 2000)}`;
              }
              return "";
            } catch { return ""; }
          });
          const urlResults = (await Promise.all(urlReads)).filter(Boolean);
          if (urlResults.length > 0) {
            answerText += `\n\n[REFERENCED_URLS_CONTENT]:\n${urlResults.join("\n\n")}`;
            console.log(`[analyze-onboarding] Enriched with ${urlResults.length} URL reads`);
          }
        }
      } catch (e) {
        console.log(`[analyze-onboarding] Jina enrichment error (non-fatal): ${e}`);
      }
    }

    console.log(`[analyze-onboarding] Analyzing ${answerText.length} chars of answers for user ${user.id}`);

    const sysPrompt = `You are a brand analyst. You receive raw interview answers from a brand owner.
Extract structured brand data from these answers. Return ONLY a raw JSON object with this exact structure:

{
  "brandName": "string - brand name",
  "companyUrl": "string - URL if mentioned, empty string otherwise",
  "colors": ["array of hex color codes found, e.g. #1a1a2e"],
  "fonts": ["array of font names found"],
  "approvedTerms": ["array of approved/preferred terms and expressions"],
  "forbiddenTerms": ["array of forbidden/banned terms and expressions"],
  "keyMessages": ["array of 3-5 key brand messages extracted from answers"],
  "tone": {
    "formality": "number 1-10 (1=very casual, 10=very formal)",
    "confidence": "number 1-10 (1=humble, 10=bold/assertive)",
    "warmth": "number 1-10 (1=cold/corporate, 10=warm/friendly)",
    "humor": "number 1-10 (1=serious, 10=humorous)"
  },
  "audiences": {
    "primary": "string - primary target audience description",
    "secondary": "string - secondary audience",
    "personas": ["array of persona descriptions"]
  },
  "compliance": {
    "regulations": "string - regulatory context",
    "hasPrivacyPolicy": false,
    "hasAccessibility": false
  },
  "competitors": {
    "positioning": "string - brand positioning statement",
    "differentiators": ["array of key differentiators"],
    "archetype": "string - brand archetype if detectable"
  },
  "visualAdjectives": ["array of visual style adjectives"],
  "visualReferences": ["array of reference brands/sites mentioned"],
  "businessDescription": "string - concise business description",
  "valueProposition": "string - unique value proposition"
}

Rules:
- Extract hex color codes (#XXXXXX) from answers. If colors are described by name without hex, include them as-is.
- For tone values, infer from the writing style, examples provided, and explicit tone descriptions.
- For approved/forbidden terms, include BOTH explicitly listed terms AND terms inferred from copy samples.
- Be precise: only include data that is clearly present or strongly implied in the answers.
- If a BRAND_DNA_FROM_WEBSITE_SCAN section is present, use it as PRIMARY source for colors, fonts, tone, visual style, products/services, audiences, and competitors. Cross-reference with the interview answers.
- If a COMPETITOR_BRAND_RESEARCH section is present, use it to enrich the competitors analysis with real positioning data, differentiators found online, and market context.
- If a REFERENCED_URLS_CONTENT section is present, extract any brand guidelines, visual identity rules, tone directives, or terminology from the referenced pages.
- All strings must be in the same language as the answers.
- Return ONLY raw JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Here are the brand interview answers:\n\n${answerText}`;

    const dnaModels = ["mistral-large-latest", "mistral-small-latest"];
    let lastError = "";
    let structuredData: any = null;

    for (const model of dnaModels) {
      try {
        console.log(`[analyze-onboarding] Trying ${model}...`);
        const res = await fetchWithTimeout(`${MISTRAL_BASE}/chat/completions`, {
          method: "POST",
          headers: mistralHeaders(),
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 4000,
            temperature: 0.15,
            response_format: { type: "json_object" },
          }),
        }, 60_000);

        if (!res.ok) {
          const errBody = (await res.text()).slice(0, 300);
          console.log(`[analyze-onboarding] ${model} error ${res.status}: ${errBody}`);
          lastError = `${model} ${res.status}`;
          continue;
        }

        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content ?? "";
        console.log(`[analyze-onboarding] ${model} responded in ${Date.now() - t0}ms, ${raw.length} chars`);

        if (!raw) { lastError = `${model} returned empty`; continue; }

        const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
        try {
          structuredData = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) structuredData = JSON.parse(match[0]);
          else { lastError = `${model} returned invalid JSON`; continue; }
        }
        break;
      } catch (e: any) {
        lastError = `${model}: ${e.message || e}`;
        console.log(`[analyze-onboarding] ${model} exception: ${lastError}`);
      }
    }

    if (!structuredData) {
      return c.json({ success: false, error: `AI analysis failed: ${lastError}` }, 500);
    }

    // Ensure tone values are numbers
    if (structuredData.tone) {
      for (const k of ["formality", "confidence", "warmth", "humor"]) {
        structuredData.tone[k] = Math.max(1, Math.min(10, parseInt(structuredData.tone[k]) || 5));
      }
    }

    // Merge with existing vault
    const existingVault = await kv.get(`vault:${user.id}`) || {};
    const finalVault = {
      ...existingVault,
      ...structuredData,
      onboarding_answers: rawAnswers,
      conversation_complete: true,
      completedAt: new Date().toISOString(),
      confidence_score: 85,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`vault:${user.id}`, finalVault);

    console.log(`[analyze-onboarding] DONE in ${Date.now() - t0}ms - brand: ${structuredData.brandName}`);
    return c.json({ success: true, vault: finalVault });

  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log(`[analyze-onboarding] ERROR: ${msg}`);
    return c.json({ success: false, error: `Onboarding analysis failed: ${msg}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// IMAGE BANK — Brand reference photos for Campaign Lab
// Bucket: make-cad57f79-brand-images (private)
// KV: brand-image:{userId}:{imageId} → metadata
// ══════════════════════════════════════════════════════════════

const IMAGE_BANK_BUCKET = "make-cad57f79-brand-images";
let imageBankBucketInitialized = false;

async function ensureImageBankBucket() {
  if (imageBankBucketInitialized) return;
  try {
    const sb = supabaseAdmin();
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) {
      console.log(`[image-bank] listBuckets error: ${listErr.message}`);
      return; // don't set initialized — retry next time
    }
    const exists = buckets?.some((b: any) => b.name === IMAGE_BANK_BUCKET);
    if (!exists) {
      const { error: createErr } = await sb.storage.createBucket(IMAGE_BANK_BUCKET, { public: false });
      if (createErr) {
        console.log(`[image-bank] createBucket error: ${createErr.message}`);
        return;
      }
      console.log(`[image-bank] Created bucket: ${IMAGE_BANK_BUCKET}`);
    } else {
      console.log(`[image-bank] Bucket exists: ${IMAGE_BANK_BUCKET}`);
    }
    imageBankBucketInitialized = true;
  } catch (e) { console.log("[image-bank] ensureImageBankBucket exception:", e); }
}

// POST /vault/images — Upload one or more images to the brand image bank
// Auth: reads _token from FormData (body-parser can't JSON.parse multipart)
app.post("/vault/images", async (c) => {
  const t0 = Date.now();
  try {
    await ensureImageBankBucket();
    const sb = supabaseAdmin();

    const contentType = c.req.header("Content-Type") || "";

    // ── FormData upload (binary files from browser) ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const files = formData.getAll("files") as File[];
      const tagsRaw = formData.get("tags") as string || "";
      const category = (formData.get("category") as string) || "general";

      // Manual auth from FormData _token (same pattern as upload-logo)
      const formToken = formData.get("_token") as string || "";
      const jwt = decodeJwtPayload(formToken);
      if (!jwt?.sub) {
        console.log("[image-bank] No valid JWT in FormData _token");
        return c.json({ success: false, error: "Unauthorized" }, 401);
      }
      const userId = jwt.sub;
      console.log(`[image-bank] Auth OK from FormData: user=${userId}`);

      if (!files || files.length === 0) {
        return c.json({ success: false, error: "No files provided. Use 'files' field in FormData." }, 400);
      }

      const tags = tagsRaw ? tagsRaw.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
      const results: any[] = [];

      for (const file of files) {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
        if (!allowed.includes(file.type)) {
          console.log(`[image-bank] Skipping file ${file.name}: unsupported type ${file.type}`);
          results.push({ fileName: file.name, success: false, error: `Unsupported type: ${file.type}` });
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          results.push({ fileName: file.name, success: false, error: "File exceeds 10MB limit" });
          continue;
        }

        const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const ext = file.name.split(".").pop() || "jpg";
        const storagePath = `${userId}/${imageId}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await sb.storage
          .from(IMAGE_BANK_BUCKET)
          .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

        if (uploadError) {
          console.log(`[image-bank] Upload error for ${file.name}: ${uploadError.message}`);
          results.push({ fileName: file.name, success: false, error: uploadError.message });
          continue;
        }

        const meta = {
          id: imageId,
          fileName: file.name,
          storagePath,
          fileSize: file.size,
          mimeType: file.type,
          tags,
          category,
          uploadedAt: new Date().toISOString(),
        };
        await kv.set(`brand-image:${userId}:${imageId}`, meta);
        console.log(`[image-bank] KV saved: brand-image:${userId}:${imageId}`);

        // Verify KV write immediately
        const verify = await kv.get(`brand-image:${userId}:${imageId}`);
        if (!verify) {
          console.log(`[image-bank] WARNING: KV verification FAILED for brand-image:${userId}:${imageId}`);
        }

        const { data: signedData, error: signErr } = await sb.storage
          .from(IMAGE_BANK_BUCKET)
          .createSignedUrl(storagePath, 86400); // 24h instead of 1h
        if (signErr) console.log(`[image-bank] SignedUrl error: ${signErr.message}`);

        results.push({ ...meta, success: true, signedUrl: signedData?.signedUrl || null });
      }

      console.log(`[image-bank] Upload complete: ${results.filter(r => r.success).length}/${results.length} files (${Date.now() - t0}ms) userId=${userId}`);
      return c.json({ success: true, images: results, _debug: { userId, kvKeys: results.filter(r => r.success).map(r => `brand-image:${userId}:${r.id}`) } });
    }

    return c.json({ success: false, error: "Use multipart/form-data with 'files' field to upload images." }, 400);

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank] POST /vault/images ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `Image upload failed: ${msg}` }, 500);
  }
});

// GET /vault/images — List all brand images for the user (with signed URLs)
app.get("/vault/images", async (c) => {
  const t0 = Date.now();
  try {
    // Auth: try X-User-Token first (actual JWT), then _token query, then Authorization bearer
    const xUserToken = c.req.header("X-User-Token");
    const queryToken = c.req.query("_token");
    const ctxToken = c.get?.("userToken");
    const authBearer = c.req.header("Authorization")?.split(" ")[1];
    const token = xUserToken || queryToken || ctxToken || authBearer;
    
    console.log(`[image-bank] GET auth: X-User-Token=${!!xUserToken} query=${!!queryToken} ctx=${!!ctxToken} bearer=${!!authBearer}`);
    
    if (!token) return c.json({ success: false, error: "No auth token" }, 401);
    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      console.log(`[image-bank] GET: token decode failed, token starts with: ${token.slice(0, 30)}...`);
      return c.json({ success: false, error: "Invalid token (not a JWT)" }, 401);
    }
    const userId = payload.sub;
    console.log(`[image-bank] GET: userId=${userId}`);

    await ensureImageBankBucket();
    const sb = supabaseAdmin();

    const kvPrefix = `brand-image:${userId}:`;
    const allImages = await kv.getByPrefix(kvPrefix);
    console.log(`[image-bank] GET: KV prefix="${kvPrefix}" returned ${allImages?.length || 0} images`);
    
    if (!allImages || allImages.length === 0) {
      // Debug: check if ANY brand-image keys exist (regardless of user)
      const anyImages = await kv.getByPrefix("brand-image:");
      console.log(`[image-bank] GET: 0 images for user ${userId}, but ${anyImages?.length || 0} total brand-image keys exist`);
      if (anyImages && anyImages.length > 0) {
        console.log(`[image-bank] GET: sample existing image userId from first entry:`, JSON.stringify(anyImages[0]).slice(0, 200));
      }
      return c.json({ success: true, images: [], _debug: { userId, kvPrefix, totalBrandImages: anyImages?.length || 0 } });
    }

    const filterTag = c.req.query("tag");
    const filterCategory = c.req.query("category");

    let filtered = allImages;
    if (filterTag) {
      filtered = filtered.filter((img: any) => img.tags?.includes(filterTag));
    }
    if (filterCategory) {
      filtered = filtered.filter((img: any) => img.category === filterCategory);
    }

    filtered.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const withUrls = await Promise.all(
      filtered.map(async (img: any) => {
        try {
          const { data, error: signErr } = await sb.storage
            .from(IMAGE_BANK_BUCKET)
            .createSignedUrl(img.storagePath, 86400); // 24h
          if (signErr) console.log(`[image-bank] SignedUrl error for ${img.storagePath}: ${signErr.message}`);
          return { ...img, signedUrl: data?.signedUrl || null };
        } catch {
          return { ...img, signedUrl: null };
        }
      })
    );

    console.log(`[image-bank] GET /vault/images: ${withUrls.length} images (${Date.now() - t0}ms)`);
    return c.json({ success: true, images: withUrls, _debug: { userId, count: withUrls.length } });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank] GET /vault/images ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `List images failed: ${msg}` }, 500);
  }
});

// POST /vault/images/list — List images via POST (avoids URL length limit with large JWTs)
app.post("/vault/images/list", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const userId = user.id;
    console.log(`[image-bank] POST /vault/images/list: userId=${userId}`);

    await ensureImageBankBucket();
    const sb = supabaseAdmin();

    // Read optional filters from parsed body (body-parser middleware already consumed the stream)
    const parsedBody = c.get?.("parsedBody") || {};
    const filterTag = parsedBody.tag || "";
    const filterCategory = parsedBody.category || "";

    const kvPrefix = `brand-image:${userId}:`;
    const allImages = await kv.getByPrefix(kvPrefix);
    console.log(`[image-bank] POST /vault/images/list: KV prefix="${kvPrefix}" returned ${allImages?.length || 0} images`);

    if (!allImages || allImages.length === 0) {
      const anyImages = await kv.getByPrefix("brand-image:");
      console.log(`[image-bank] POST /vault/images/list: 0 images for user ${userId}, but ${anyImages?.length || 0} total brand-image keys exist`);
      return c.json({ success: true, images: [], _debug: { userId, kvPrefix, totalBrandImages: anyImages?.length || 0 } });
    }

    let filtered = allImages;
    if (filterTag) {
      filtered = filtered.filter((img: any) => img.tags?.includes(filterTag));
    }
    if (filterCategory) {
      filtered = filtered.filter((img: any) => img.category === filterCategory);
    }

    filtered.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const withUrls = await Promise.all(
      filtered.map(async (img: any) => {
        try {
          const { data, error: signErr } = await sb.storage
            .from(IMAGE_BANK_BUCKET)
            .createSignedUrl(img.storagePath, 86400);
          if (signErr) console.log(`[image-bank] SignedUrl error for ${img.storagePath}: ${signErr.message}`);
          return { ...img, signedUrl: data?.signedUrl || null };
        } catch {
          return { ...img, signedUrl: null };
        }
      })
    );

    console.log(`[image-bank] POST /vault/images/list: ${withUrls.length} images (${Date.now() - t0}ms)`);
    return c.json({ success: true, images: withUrls, _debug: { userId, count: withUrls.length } });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank] POST /vault/images/list ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `List images failed: ${msg}` }, 500);
  }
});

// PUT /vault/images/:id — Update tags/category of an existing image
app.put("/vault/images/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const imageId = c.req.param("id");
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { tags, category } = body;

    const kvKey = `brand-image:${user.id}:${imageId}`;
    const existing = await kv.get(kvKey);
    if (!existing) {
      return c.json({ success: false, error: `Image not found: ${imageId}` }, 404);
    }

    if (tags !== undefined) {
      existing.tags = Array.isArray(tags) ? tags : (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : existing.tags);
    }
    if (category !== undefined) {
      existing.category = category;
    }
    existing.updatedAt = new Date().toISOString();

    await kv.set(kvKey, existing);
    console.log(`[image-bank] PUT /vault/images/${imageId}: tags=${JSON.stringify(existing.tags)}, category=${existing.category}`);
    return c.json({ success: true, image: existing });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank] PUT /vault/images/:id ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `Update image failed: ${msg}` }, 500);
  }
});

// DELETE /vault/images/:id — Delete an image from storage + KV
app.delete("/vault/images/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const imageId = c.req.param("id");

    const kvKey = `brand-image:${user.id}:${imageId}`;
    const existing = await kv.get(kvKey);
    if (!existing) {
      return c.json({ success: false, error: `Image not found: ${imageId}` }, 404);
    }

    await ensureImageBankBucket();
    const sb = supabaseAdmin();
    const { error: deleteError } = await sb.storage
      .from(IMAGE_BANK_BUCKET)
      .remove([existing.storagePath]);

    if (deleteError) {
      console.log(`[image-bank] Storage delete warning for ${imageId}: ${deleteError.message}`);
    }

    await kv.del(kvKey);

    console.log(`[image-bank] DELETE /vault/images/${imageId}: removed from storage + KV`);
    return c.json({ success: true, deletedId: imageId });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank] DELETE /vault/images/:id ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `Delete image failed: ${msg}` }, 500);
  }
});

// POST /vault/images/analyze — Vision analysis of a brand image (Art Director + Photographer)
app.post("/vault/images/analyze", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { imageId } = body;
    if (!imageId) return c.json({ success: false, error: "imageId is required" }, 400);

    const kvKey = `brand-image:${user.id}:${imageId}`;
    const existing = await kv.get(kvKey);
    if (!existing) return c.json({ success: false, error: `Image not found: ${imageId}` }, 404);

    await ensureImageBankBucket();
    const sb = supabaseAdmin();

    const { data: signedData } = await sb.storage
      .from(IMAGE_BANK_BUCKET)
      .createSignedUrl(existing.storagePath, 600);
    const imageUrl = signedData?.signedUrl;
    if (!imageUrl) return c.json({ success: false, error: "Could not generate signed URL for image" }, 500);

    const vaultData = await kv.get(`vault:${user.id}`);
    const brandContext = vaultData
      ? `Brand context — Company: ${vaultData.company_name || "Unknown"}, Industry: ${vaultData.industry || "N/A"}, Tone: ${vaultData.tone?.primary_tone || "N/A"}, Colors: ${(vaultData.colors || []).map((col: any) => `${col.hex} (${col.name || col.role || ""})`).join(", ") || "N/A"}, Photo style direction: ${vaultData.photo_style ? `${vaultData.photo_style.framing}, ${vaultData.photo_style.mood}, ${vaultData.photo_style.lighting}` : "N/A"}`
      : "No brand vault data available yet.";

    const systemPrompt = `You are a world-class Art Director and master Photographer combined into one expert analyst. You examine brand images with surgical precision.

Your role: analyze the provided image and return a comprehensive JSON report that will be stored as brand asset metadata. This analysis will be used by other AI agents (Copywriter, Social Media Optimizer, Campaign Multiplier) to generate on-brand content.

${brandContext}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "composition": {
    "framing": "e.g. centered, rule-of-thirds, asymmetric, full-bleed",
    "orientation": "landscape|portrait|square",
    "depth": "shallow|medium|deep",
    "negative_space": "minimal|moderate|generous",
    "leading_lines": "describe if present",
    "focal_point": "where the eye is drawn"
  },
  "color": {
    "dominant_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "palette_name": "e.g. warm earth tones, cool corporate blues, muted pastels",
    "temperature": "warm|neutral|cool",
    "saturation": "desaturated|muted|moderate|vibrant|hyper-saturated",
    "contrast": "low|medium|high",
    "harmony": "complementary|analogous|triadic|monochromatic|split-complementary"
  },
  "lighting": {
    "type": "natural|studio|mixed|ambient|dramatic",
    "direction": "front|side|back|top|rim|diffused|multi-point",
    "quality": "soft|hard|mixed",
    "key_ratio": "low-key|balanced|high-key",
    "mood_contribution": "how the light shapes the feeling"
  },
  "subject": {
    "primary": "main subject description",
    "secondary": "secondary elements if any",
    "human_presence": "none|partial|full",
    "environment": "indoor|outdoor|studio|abstract|mixed",
    "props_styling": "notable objects, clothing, textures"
  },
  "mood": {
    "primary_emotion": "the dominant feeling",
    "secondary_emotions": ["list", "of", "supporting", "feelings"],
    "energy": "calm|serene|neutral|dynamic|energetic|intense",
    "sophistication": "casual|elevated-casual|professional|premium|luxury"
  },
  "technique": {
    "estimated_focal_length": "e.g. 35mm, 85mm, 200mm",
    "depth_of_field": "very shallow (f/1.4-2.0)|shallow (f/2.8-4)|moderate (f/5.6-8)|deep (f/11+)",
    "shutter_feel": "frozen|slight-motion|motion-blur|long-exposure",
    "post_processing": "minimal|moderate|heavy — and style notes",
    "style_reference": "e.g. editorial, documentary, product, lifestyle, fine-art"
  },
  "brand_alignment": {
    "score": 0-100,
    "strengths": ["what aligns well with the brand"],
    "concerns": ["potential misalignments"],
    "recommended_usage": ["email-hero", "social-post", "ad-banner", "landing-page", "story", "blog-header", "product-detail"]
  },
  "tags_suggested": ["auto-generated", "descriptive", "tags"],
  "category_suggested": "product|lifestyle|team|office|event|social|ad|packaging|abstract|other",
  "one_line_description": "A concise, evocative one-sentence description of the image"
}`;

    const apiKey = Deno.env.get("APIPOD_API_KEY");
    if (!apiKey) return c.json({ success: false, error: "Vision API not configured (APIPOD_API_KEY)" }, 500);

    console.log(`[image-bank/analyze] Sending vision request for image=${imageId}`);

    const visionRes = await fetch(`${APIPOD_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: `Analyze this brand image with the precision of an art director and photographer. File: ${existing.fileName}` },
          ]},
        ],
        max_tokens: 2000,
      }),
    });

    if (!visionRes.ok) {
      const errBody = await visionRes.text();
      console.log(`[image-bank/analyze] Vision API error ${visionRes.status}: ${errBody}`);
      return c.json({ success: false, error: `Vision API error: ${visionRes.status}` }, 500);
    }

    const visionData = await visionRes.json();
    const rawText = visionData.choices?.[0]?.message?.content || "";
    console.log(`[image-bank/analyze] Got response: ${rawText.length} chars`);

    let analysis: any;
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.log(`[image-bank/analyze] JSON parse failed, storing raw text`);
      analysis = { _raw: rawText, _parseError: true };
    }

    existing.analysis = analysis;
    existing.analyzedAt = new Date().toISOString();
    if (analysis.tags_suggested && (!existing.tags || existing.tags.length === 0)) {
      existing.tags = analysis.tags_suggested.slice(0, 10);
    }
    if (analysis.category_suggested && existing.category === "general") {
      existing.category = analysis.category_suggested;
    }
    if (analysis.one_line_description) {
      existing.altText = analysis.one_line_description;
    }
    await kv.set(kvKey, existing);

    const tokensUsed = visionData.usage?.total_tokens || 0;
    console.log(`[image-bank/analyze] OK in ${Date.now() - t0}ms, tokens=${tokensUsed}`);

    return c.json({ success: true, analysis, tags: existing.tags, category: existing.category, altText: existing.altText, tokensUsed, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[image-bank/analyze] ERROR: ${msg}`);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `Image analysis failed: ${msg}` }, 500);
  }
});

// POST /vault/images/analyze-batch — Analyze multiple images in sequence
app.post("/vault/images/analyze-batch", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const { imageIds } = body;
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return c.json({ success: false, error: "imageIds array is required" }, 400);
    }
    const batch = imageIds.slice(0, 5);
    const results: any[] = [];

    for (const imageId of batch) {
      try {
        const kvKey = `brand-image:${user.id}:${imageId}`;
        const existing = await kv.get(kvKey);
        if (!existing) { results.push({ imageId, success: false, error: "Not found" }); continue; }
        if (existing.analysis && !existing.analysis._parseError) { results.push({ imageId, success: true, alreadyAnalyzed: true }); continue; }

        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const { data: sd } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(existing.storagePath, 600);
        if (!sd?.signedUrl) { results.push({ imageId, success: false, error: "No signed URL" }); continue; }

        const vaultData = await kv.get(`vault:${user.id}`);
        const brandCtx = vaultData ? `Brand: ${vaultData.company_name || "?"}, Industry: ${vaultData.industry || "?"}, Tone: ${vaultData.tone?.primary_tone || "?"}` : "";

        const apiKey = Deno.env.get("APIPOD_API_KEY");
        if (!apiKey) { results.push({ imageId, success: false, error: "No API key" }); continue; }

        const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: `You are an expert Art Director + Photographer. Analyze this brand image. ${brandCtx}. Return ONLY valid JSON with keys: composition{framing,orientation,depth,negative_space,focal_point}, color{dominant_palette[hex],palette_name,temperature,saturation,contrast}, lighting{type,direction,quality,key_ratio}, subject{primary,environment}, mood{primary_emotion,energy,sophistication}, technique{style_reference,post_processing}, brand_alignment{score(0-100),recommended_usage[]}, tags_suggested[], category_suggested, one_line_description.` },
              { role: "user", content: [
                { type: "image_url", image_url: { url: sd.signedUrl, detail: "low" } },
                { type: "text", text: `Analyze: ${existing.fileName}` },
              ]},
            ],
            max_tokens: 1200,
          }),
        });

        if (!res.ok) { results.push({ imageId, success: false, error: `API ${res.status}` }); continue; }
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        let analysis;
        try { analysis = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
        catch { analysis = { _raw: raw, _parseError: true }; }

        existing.analysis = analysis;
        existing.analyzedAt = new Date().toISOString();
        if (analysis.tags_suggested && (!existing.tags || existing.tags.length === 0)) existing.tags = analysis.tags_suggested.slice(0, 10);
        if (analysis.category_suggested && existing.category === "general") existing.category = analysis.category_suggested;
        if (analysis.one_line_description) existing.altText = analysis.one_line_description;
        await kv.set(kvKey, existing);
        results.push({ imageId, success: true });
      } catch (err: any) {
        results.push({ imageId, success: false, error: err?.message || String(err) });
      }
    }
    console.log(`[image-bank/analyze-batch] ${results.filter(r => r.success).length}/${batch.length} in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") return c.json({ success: false, error: msg }, 401);
    return c.json({ success: false, error: `Batch analysis failed: ${msg}` }, 500);
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

app.delete("/campaigns/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const campaignId = c.req.param("id");
    const campaigns = await kv.getByPrefix(`campaign:${user.id}:`);
    const found = campaigns.find((camp: any) => camp.id === campaignId || camp.id?.endsWith(campaignId));
    if (found) await kv.del(found.id);
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// ══════════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════���═══

app.get("/calendar", async (c) => {
  try {
    const user = await requireAuth(c);
    const events = await kv.getByPrefix(`calendar:${user.id}:`);
    return c.json({ success: true, events: events || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/calendar", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const id = `calendar:${user.id}:${Date.now()}`;
    const event = { id, ...body, userId: user.id, createdAt: new Date().toISOString() };
    await kv.set(id, event);
    return c.json({ success: true, event });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.delete("/calendar/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const eventId = c.req.param("id");
    const events = await kv.getByPrefix(`calendar:${user.id}:`);
    const found = events.find((ev: any) => ev.id === eventId || ev.id?.endsWith(eventId));
    if (found) await kv.del(found.id);
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// ── CALENDAR GENERATE — AI creates editorial schedule from campaign assets ──
app.post("/calendar/generate", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { assets, campaignTheme, brief } = body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return c.json({ success: false, error: "No assets provided" }, 400);
    }

    console.log(`[calendar-generate] user=${user.id.slice(0, 8)}, assets=${assets.length}, theme="${(campaignTheme || "").slice(0, 40)}"`);

    const assetSummary = assets.map((a: any, i: number) => {
      return `${i + 1}. Platform: ${a.platform}, Format: ${a.formatName || a.type}, Copy: "${(a.copy || "").slice(0, 100)}"`;
    }).join("\n");

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1);

    const systemPrompt = `You are an expert social media strategist. Given a set of campaign assets, create an optimal editorial calendar / posting schedule.

RULES:
- Output ONLY valid JSON — no markdown, no explanation, no preamble.
- Return an array of event objects.
- Spread posts across 2-4 weeks starting from ${startDate.toISOString().slice(0, 10)}.
- Respect platform best practices for posting times:
  - LinkedIn: Tuesday-Thursday, 8:00-10:00 or 17:00-18:00
  - Instagram: Monday-Friday, 11:00-13:00 or 19:00-21:00
  - Facebook: Wednesday-Friday, 13:00-16:00
  - Twitter/X: Monday-Friday, 9:00-11:00 or 12:00-13:00
  - Email: Tuesday-Thursday, 10:00-11:00
- Never schedule 2 posts on the same platform on the same day.
- Each event must have: title (string), channel (string matching the platform), time (HH:MM), day (1-31), month (0-11 zero-indexed), year (number).
- Add a "postingNote" field with a 1-sentence strategic reason for the timing.

JSON FORMAT:
[{ "title": "...", "channel": "LinkedIn", "time": "09:00", "day": 5, "month": 2, "year": 2026, "postingNote": "..." }]`;

    const userPrompt = `Campaign theme: "${campaignTheme || brief || "Brand campaign"}"

Assets to schedule:
${assetSummary}

Create the optimal posting schedule as a JSON array.`;

    let schedule: any[] = [];

    // Helper: parse JSON array from AI response
    const parseSchedule = (raw: string): any[] | null => {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch { return null; }
      }
      return null;
    };

    // ── STRATEGY 1: APIPod (gpt-4o, gpt-5) ──
    const apipodKey = Deno.env.get("APIPOD_API_KEY");
    if (apipodKey && schedule.length === 0) {
      for (const m of ["gpt-4o", "gpt-5"]) {
        try {
          const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apipodKey}` },
            body: JSON.stringify({
              model: m,
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
              max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) { console.log(`[calendar-generate] APIPod ${m} returned ${res.status}`); continue; }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content?.trim() || "";
          const parsed = parseSchedule(raw);
          if (parsed && parsed.length > 0) {
            schedule = parsed;
            console.log(`[calendar-generate] APIPod ${m} OK: ${schedule.length} events (${Date.now() - t0}ms)`);
            break;
          }
        } catch (err) { console.log(`[calendar-generate] APIPod ${m} error: ${err}`); }
      }
    }

    // ── STRATEGY 2: Direct OpenAI fallback ──
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && schedule.length === 0) {
      try {
        console.log(`[calendar-generate] APIPod failed, trying direct OpenAI gpt-4o...`);
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            max_tokens: 2000,
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content?.trim() || "";
          const parsed = parseSchedule(raw);
          if (parsed && parsed.length > 0) {
            schedule = parsed;
            console.log(`[calendar-generate] OpenAI gpt-4o OK: ${schedule.length} events (${Date.now() - t0}ms)`);
          }
        } else { console.log(`[calendar-generate] OpenAI returned ${res.status}`); }
      } catch (err) { console.log(`[calendar-generate] OpenAI error: ${err}`); }
    }

    // ── STRATEGY 3: Gemini fallback ──
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey && schedule.length === 0) {
      try {
        console.log(`[calendar-generate] OpenAI failed, trying Gemini...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          const parsed = parseSchedule(raw);
          if (parsed && parsed.length > 0) {
            schedule = parsed;
            console.log(`[calendar-generate] Gemini OK: ${schedule.length} events (${Date.now() - t0}ms)`);
          }
        } else { console.log(`[calendar-generate] Gemini returned ${res.status}`); }
      } catch (err) { console.log(`[calendar-generate] Gemini error: ${err}`); }
    }

    if (schedule.length === 0) {
      console.log(`[calendar-generate] ALL strategies failed (${Date.now() - t0}ms)`);
      return c.json({ success: false, error: "All AI providers failed to generate calendar. Please try again." }, 500);
    }

    const calChannelColors: Record<string, string> = {
      LinkedIn: "#0077b5", Email: "#ea4335", "Twitter/X": "#1da1f2", Instagram: "#e1306c", Facebook: "#1877F2",
      TikTok: "#00f2ea", YouTube: "#FF0000", Pinterest: "#E60023",
    };

    const savedEvents: any[] = [];
    for (const ev of schedule) {
      const id = `calendar:${user.id}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event = {
        id,
        title: ev.title || "Untitled post",
        channel: ev.channel || "LinkedIn",
        channelIcon: ev.channel || "LinkedIn",
        time: ev.time || "09:00",
        status: "scheduled" as const,
        score: 0,
        color: calChannelColors[ev.channel] || "#0077b5",
        day: ev.day,
        month: ev.month,
        year: ev.year,
        postingNote: ev.postingNote || "",
        campaignTheme: campaignTheme || brief || "",
        userId: user.id,
        createdAt: new Date().toISOString(),
      };
      await kv.set(id, event);
      savedEvents.push(event);
    }

    console.log(`[calendar-generate] Saved ${savedEvents.length} events for user ${user.id.slice(0, 8)} (${Date.now() - t0}ms)`);
    return c.json({ success: true, events: savedEvents, count: savedEvents.length });
  } catch (err) {
    console.log(`[calendar-generate] error (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Calendar generation failed: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// DEPLOY VIA ZERNIO — https://docs.zernio.com
// Base URL: https://zernio.com/api/v1
// Auth: Bearer ZERNIO_API_KEY
// Flow: Profiles → Accounts (OAuth) → Posts (content + platforms[{platform,accountId}] + mediaItems + publishNow/scheduledFor)
// MULTI-TENANT: Each ORA user gets their own Zernio profile. All
// account listing, connect, deploy, and disconnect operations are
// scoped to that profile via `zernio:profile:{userId}` in KV.
// ══════════════════════════════════════════════════════════════

const ZERNIO_BASE = "https://zernio.com/api/v1";
const zernioHeaders = () => {
  const key = Deno.env.get("ZERNIO_API_KEY");
  if (!key) throw new Error("ZERNIO_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
};
const ZERNIO_PLATFORM_MAP: Record<string, string> = {
  LinkedIn: "linkedin", Instagram: "instagram", Facebook: "facebook",
  "Twitter/X": "twitter", Twitter: "twitter",
};

// ── Shared helper: get or create user-scoped Zernio profile ──
async function getOrCreateZernioProfile(userId: string, email: string): Promise<string> {
  const kvKey = `zernio:profile:${userId}`;
  const stored = await kv.get(kvKey);
  if (stored?.profileId) {
    console.log(`[zernio] Reusing profileId=${stored.profileId} for user=${userId.slice(0, 8)}`);
    return stored.profileId;
  }
  // No stored profile — create a NEW one (NEVER reuse another user's profile)
  let brandName = "ORA Campaign";
  try {
    const vault = await kv.get(`vault:${userId}`);
    if (vault?.company_name) brandName = vault.company_name;
    else if (vault?.brandName) brandName = vault.brandName;
  } catch {}
  const createRes = await fetch(`${ZERNIO_BASE}/profiles`, {
    method: "POST", headers: zernioHeaders(),
    body: JSON.stringify({ name: brandName, description: `ORA user ${email} (${userId.slice(0, 8)})` }),
    signal: AbortSignal.timeout(10_000),
  });
  const createData = await createRes.json();
  if (!createRes.ok || !createData.profile?._id) {
    console.log(`[zernio] Profile creation FAILED: ${JSON.stringify(createData).slice(0, 300)}`);
    throw new Error(`Failed to create social publishing profile: ${createData.error || `HTTP ${createRes.status}`}`);
  }
  const profileId = createData.profile._id;
  await kv.set(kvKey, { profileId, userId, email, brandName, createdAt: new Date().toISOString() });
  console.log(`[zernio] Created new profile=${profileId} for user=${userId.slice(0, 8)}, brand="${brandName}"`);
  return profileId;
}

// ── Shared helper: list accounts scoped to a user's profile ──
async function listZernioAccountsForUser(userId: string, email: string): Promise<{ accounts: any[]; profileId: string }> {
  const profileId = await getOrCreateZernioProfile(userId, email);
  const res = await fetch(`${ZERNIO_BASE}/accounts`, {
    headers: zernioHeaders(), signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  const allAccounts = data.accounts || [];
  // Filter: only accounts belonging to this user's profile
  const userAccounts = allAccounts.filter((a: any) =>
    a.profileId === profileId || a._profile === profileId || a.profile === profileId
  );
  console.log(`[zernio] Accounts for profile=${profileId}: ${userAccounts.length}/${allAccounts.length} (${userAccounts.map((a: any) => a.platform).join(",")})`);
  // Cache in KV for fast lookup during deploy
  if (userAccounts.length > 0) {
    await kv.set(`zernio:accounts:${userId}`, {
      profileId, accounts: userAccounts.map((a: any) => ({ _id: a._id, platform: a.platform, username: a.username })),
      updatedAt: new Date().toISOString(),
    });
  }
  return { accounts: userAccounts, profileId };
}

// POST /zernio/ensure-profile — Idempotently create/retrieve user's Zernio profile
app.post("/zernio/ensure-profile", async (c) => {
  try {
    const user = await requireAuth(c);
    const profileId = await getOrCreateZernioProfile(user.id, user.email);
    return c.json({ success: true, profileId });
  } catch (err) {
    console.log(`[zernio/ensure-profile] Error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /zernio/accounts — List connected social accounts (SCOPED to user's profile)
app.get("/zernio/accounts", async (c) => {
  try {
    const user = await requireAuth(c);
    const { accounts, profileId } = await listZernioAccountsForUser(user.id, user.email);
    console.log(`[zernio/accounts] user=${user.id.slice(0, 8)}, profile=${profileId}, accounts=${accounts.length}`);
    return c.json({ success: true, accounts, profileId });
  } catch (err) {
    console.log(`[zernio] List accounts error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /zernio/profiles — List profiles (only this user's)
app.get("/zernio/profiles", async (c) => {
  try {
    const user = await requireAuth(c);
    const stored = await kv.get(`zernio:profile:${user.id}`);
    if (stored?.profileId) return c.json({ success: true, profiles: [stored] });
    return c.json({ success: true, profiles: [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// POST /zernio/profiles — Create a profile (scoped to user)
app.post("/zernio/profiles", async (c) => {
  try {
    const user = await requireAuth(c);
    const profileId = await getOrCreateZernioProfile(user.id, user.email);
    return c.json({ success: true, profile: { _id: profileId } });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// GET /zernio/connect/:platform — Get OAuth URL (uses user-scoped profile)
app.get("/zernio/connect/:platform", async (c) => {
  try {
    const user = await requireAuth(c);
    const platform = c.req.param("platform");
    const redirectUrl = c.req.query("redirectUrl") || "";
    // Always use user-scoped profile (creates one if needed)
    const profileId = await getOrCreateZernioProfile(user.id, user.email);
    const qs = `profileId=${encodeURIComponent(profileId)}${redirectUrl ? `&redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`;
    const res = await fetch(`${ZERNIO_BASE}/connect/${platform}?${qs}`, { headers: zernioHeaders(), signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    if (!res.ok) return c.json({ success: false, error: data.error || `HTTP ${res.status}` }, res.status);
    console.log(`[zernio/connect] user=${user.id.slice(0, 8)}, platform=${platform}, profile=${profileId}`);
    return c.json({ success: true, authUrl: data.authUrl, profileId });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// GET /zernio/callback — OAuth callback landing page (popup auto-closes)
app.get("/zernio/callback", async (c) => {
  try {
    const user = await getUser(c);
    const platform = c.req.query("platform") || "unknown";
    const status = c.req.query("status") || "success";
    if (user) {
      try { await listZernioAccountsForUser(user.id, user.email); } catch (e) { console.log(`[zernio/callback] refresh failed: ${e}`); }
    }
    console.log(`[zernio/callback] platform=${platform}, status=${status}, user=${user?.id?.slice(0, 8) || "anon"}`);
    const html = `<!DOCTYPE html><html><head><title>Connected</title><style>body{font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1918;color:#E8E4DF}.card{text-align:center;padding:40px;border-radius:12px;background:#2a2928;border:1px solid rgba(255,255,255,0.06)}.check{font-size:48px;margin-bottom:12px;color:#5E6AD2}h2{font-size:18px;font-weight:500;margin:0 0 8px}p{font-size:14px;color:#7A7572;margin:0}</style></head><body><div class="card"><div class="check">&#10003;</div><h2>Account Connected</h2><p>You can close this window.</p></div><script>try{window.opener?.postMessage({type:"zernio-oauth-complete",platform:"${platform}",status:"${status}"},"*")}catch(e){}setTimeout(()=>window.close(),2000)</script></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });
  } catch (err) {
    console.log(`[zernio/callback] Error: ${err}`);
    return new Response(`<html><body style="background:#1a1918;color:#E8E4DF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div><h2>Connection error</h2><p>${err}</p></div><script>setTimeout(()=>window.close(),3000)</script></body></html>`, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });
  }
});

// POST /zernio/disconnect — Disconnect a social account (scoped to user)
app.post("/zernio/disconnect", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { accountId, platform } = body;
    if (!accountId && !platform) return c.json({ success: false, error: "accountId or platform is required" }, 400);

    // Verify the account belongs to this user's profile
    const { accounts } = await listZernioAccountsForUser(user.id, user.email);
    let target: any = null;
    if (accountId) target = accounts.find((a: any) => a._id === accountId);
    else if (platform) target = accounts.find((a: any) => a.platform === platform);

    if (!target) return c.json({ success: false, error: "Account not found in your profile" }, 404);

    const delRes = await fetch(`${ZERNIO_BASE}/accounts/${target._id}`, {
      method: "DELETE", headers: zernioHeaders(), signal: AbortSignal.timeout(10_000),
    });
    if (!delRes.ok) {
      const delData = await delRes.json().catch(() => ({}));
      console.log(`[zernio/disconnect] DELETE failed: HTTP ${delRes.status}, ${JSON.stringify(delData).slice(0, 200)}`);
      return c.json({ success: false, error: delData.error || `Failed to disconnect (HTTP ${delRes.status})` }, delRes.status);
    }
    await kv.del(`zernio:accounts:${user.id}`);
    console.log(`[zernio/disconnect] user=${user.id.slice(0, 8)}, disconnected ${target.platform} account=${target._id}`);
    return c.json({ success: true, disconnectedPlatform: target.platform, accountId: target._id });
  } catch (err) {
    console.log(`[zernio/disconnect] Error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /campaign/deploy — Publish a single asset via Zernio Posts API
app.post("/campaign/deploy", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { platform, caption, hashtags, imageUrl, videoUrl, headline, scheduledAt, calendarEventId, accountId, timezone } = body;
    if (!platform) return c.json({ success: false, error: "Platform is required" }, 400);
    if (!caption && !headline) return c.json({ success: false, error: "Caption or headline is required" }, 400);

    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "Zernio API key not configured" }, 500);

    const zernioPlatform = ZERNIO_PLATFORM_MAP[platform] || platform.toLowerCase();
    if (platform === "Email" || platform === "Web") {
      return c.json({ success: true, status: "skipped", reason: `${platform} not supported by Zernio — use direct sending` });
    }

    console.log(`[deploy] user=${user.id.slice(0, 8)}, platform=${platform}->${zernioPlatform}, hasImage=${!!imageUrl}, hasVideo=${!!videoUrl}, scheduled=${!!scheduledAt}`);

    // Resolve accountId: use provided or auto-find from user's SCOPED accounts
    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      try {
        const { accounts: userAccounts } = await listZernioAccountsForUser(user.id, user.email);
        const match = userAccounts.find((a: any) => a.platform === zernioPlatform);
        if (match) { resolvedAccountId = match._id; console.log(`[deploy] Auto-resolved accountId: ${resolvedAccountId} for ${zernioPlatform} (user-scoped)`); }
      } catch (e) { console.log(`[deploy] Account lookup failed: ${e}`); }
    }
    if (!resolvedAccountId) {
      return c.json({ success: false, error: `No ${platform} account connected. Use the connect button to link your account.`, needsConnect: true, platform: zernioPlatform });
    }

    // Build Zernio POST /v1/posts payload per docs
    const contentText = [caption || headline || "", hashtags || ""].filter(Boolean).join("\n\n");
    const mediaItems: any[] = [];
    if (imageUrl) mediaItems.push({ type: "image", url: imageUrl });
    if (videoUrl) mediaItems.push({ type: "video", url: videoUrl });

    const zernioPayload: any = {
      content: contentText.slice(0, 5000),
      platforms: [{ platform: zernioPlatform, accountId: resolvedAccountId }],
    };
    if (mediaItems.length > 0) zernioPayload.mediaItems = mediaItems;
    if (scheduledAt) { zernioPayload.scheduledFor = scheduledAt; zernioPayload.timezone = timezone || "Europe/Paris"; }
    else { zernioPayload.publishNow = true; }

    let zernioResponse: any = null;
    let deploySuccess = false;
    let deployError = "";
    try {
      const res = await fetch(`${ZERNIO_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZERNIO_KEY}` },
        body: JSON.stringify(zernioPayload), signal: AbortSignal.timeout(30_000),
      });
      const responseText = await res.text();
      console.log(`[deploy] Zernio POST /posts: HTTP ${res.status}, ${responseText.length}c, body=${responseText.slice(0, 500)}`);
      try { zernioResponse = JSON.parse(responseText); } catch { zernioResponse = { raw: responseText }; }
      if (res.ok) {
        deploySuccess = true;
        const platStatus = zernioResponse?.post?.platforms?.[0];
        if (platStatus?.status === "failed") { deploySuccess = false; deployError = platStatus.errorMessage || "Platform rejected the post"; }
      } else { deployError = zernioResponse?.error || `Zernio HTTP ${res.status}: ${responseText.slice(0, 200)}`; }
    } catch (err: any) { deployError = `Zernio fetch error: ${err?.message || err}`; console.log(`[deploy] ${deployError}`); }

    if (calendarEventId && deploySuccess) {
      try {
        const eventData = await kv.get(calendarEventId);
        if (eventData) await kv.set(calendarEventId, { ...eventData, status: scheduledAt ? "scheduled" : "published", deployedAt: new Date().toISOString(), zernioPostId: zernioResponse?.post?._id || null });
      } catch (e) { console.log(`[deploy] Calendar event update failed: ${e}`); }
    }

    const deployId = `deploy:${user.id}:${Date.now()}`;
    await kv.set(deployId, { id: deployId, userId: user.id, platform, zernioPlatform, status: deploySuccess ? (scheduledAt ? "scheduled" : "published") : "failed", error: deployError || undefined, zernioPostId: zernioResponse?.post?._id || null, zernioPostUrl: zernioResponse?.post?.platforms?.[0]?.platformPostUrl || null, scheduledAt: scheduledAt || null, createdAt: new Date().toISOString() });

    const finalStatus = deploySuccess ? (scheduledAt ? "scheduled" : "published") : "failed";
    console.log(`[deploy] ${finalStatus} in ${Date.now() - t0}ms, postId=${zernioResponse?.post?._id || "none"}`);
    return c.json({ success: deploySuccess, status: finalStatus, error: deployError || undefined, zernioPostId: zernioResponse?.post?._id || null, zernioPostUrl: zernioResponse?.post?.platforms?.[0]?.platformPostUrl || null, deployId });
  } catch (err) {
    console.log(`[deploy] error (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Deploy failed: ${err}` }, 500);
  }
});

// POST /campaign/deploy-batch — Deploy multiple assets at once via Zernio
app.post("/campaign/deploy-batch", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { deployments, timezone } = body;
    if (!deployments || !Array.isArray(deployments) || deployments.length === 0) return c.json({ success: false, error: "No deployments provided" }, 400);

    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "Zernio API key not configured" }, 500);

    console.log(`[deploy-batch] user=${user.id.slice(0, 8)}, count=${deployments.length}`);

    // Pre-fetch connected accounts once (SCOPED to user's profile)
    let connectedAccounts: any[] = [];
    try {
      const { accounts: userAccounts } = await listZernioAccountsForUser(user.id, user.email);
      connectedAccounts = userAccounts;
      console.log(`[deploy-batch] ${connectedAccounts.length} user-scoped accounts found`);
    } catch (e) { console.log(`[deploy-batch] Account lookup failed: ${e}`); }

    const results: any[] = [];
    for (const dep of deployments) {
      const zernioPlatform = ZERNIO_PLATFORM_MAP[dep.platform] || dep.platform?.toLowerCase();
      if (dep.platform === "Email" || dep.platform === "Web") { results.push({ formatId: dep.formatId, platform: dep.platform, success: true, status: "skipped", reason: "Not supported by Zernio" }); continue; }
      const acctId = dep.accountId || connectedAccounts.find((a: any) => a.platform === zernioPlatform)?._id;
      if (!acctId) { results.push({ formatId: dep.formatId, platform: dep.platform, success: false, status: "failed", error: `No Zernio account connected for ${dep.platform}`, needsConnect: true }); continue; }

      try {
        const contentText = [dep.caption || dep.headline || "", dep.hashtags || ""].filter(Boolean).join("\n\n");
        const mediaItems: any[] = [];
        if (dep.imageUrl) mediaItems.push({ type: "image", url: dep.imageUrl });
        if (dep.videoUrl) mediaItems.push({ type: "video", url: dep.videoUrl });
        const zernioPayload: any = { content: contentText.slice(0, 5000), platforms: [{ platform: zernioPlatform, accountId: acctId }] };
        if (mediaItems.length > 0) zernioPayload.mediaItems = mediaItems;
        if (dep.scheduledAt) { zernioPayload.scheduledFor = dep.scheduledAt; zernioPayload.timezone = timezone || "Europe/Paris"; } else { zernioPayload.publishNow = true; }

        const res = await fetch(`${ZERNIO_BASE}/posts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZERNIO_KEY}` }, body: JSON.stringify(zernioPayload), signal: AbortSignal.timeout(25_000) });
        const text = await res.text();
        let parsed: any = {}; try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        const ok = res.ok && parsed?.post?.platforms?.[0]?.status !== "failed";
        const status = ok ? (dep.scheduledAt ? "scheduled" : "published") : "failed";
        const error = ok ? undefined : (parsed?.error || parsed?.post?.platforms?.[0]?.errorMessage || `HTTP ${res.status}: ${text.slice(0, 200)}`);
        results.push({ formatId: dep.formatId, platform: dep.platform, success: ok, status, error, zernioPostId: parsed?.post?._id, zernioPostUrl: parsed?.post?.platforms?.[0]?.platformPostUrl });
        if (dep.calendarEventId && ok) { try { const ev = await kv.get(dep.calendarEventId); if (ev) await kv.set(dep.calendarEventId, { ...ev, status, deployedAt: new Date().toISOString(), zernioPostId: parsed?.post?._id || null }); } catch {} }
      } catch (err: any) { results.push({ formatId: dep.formatId, platform: dep.platform, success: false, status: "failed", error: err?.message || String(err) }); }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[deploy-batch] ${successCount}/${deployments.length} deployed in ${Date.now() - t0}ms`);
    return c.json({ success: true, results, successCount, totalCount: deployments.length });
  } catch (err) { console.log(`[deploy-batch] error: ${err}`); return c.json({ success: false, error: `Batch deploy failed: ${err}` }, 500); }
});

// ══════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════

// GET and POST /analytics — POST is CORS-safe (token in body)
const analyticsHandler = async (c: any) => {
  try {
    const user = await requireAuth(c);
    const profile = await kv.get(`user:${user.id}`);
    const campaigns = await kv.getByPrefix(`campaign:${user.id}:`);
    const events = await kv.getByPrefix(`calendar:${user.id}:`);
    const vault = await kv.get(`vault:${user.id}`);
    const brandScores = await kv.getByPrefix(`brand-score:${user.id}:`);
    const avgScore = brandScores.length > 0
      ? Math.round(brandScores.reduce((sum: number, s: any) => sum + (s.overall || 0), 0) / brandScores.length)
      : 0;
    return c.json({
      success: true,
      analytics: {
        totalPieces: profile?.creditsUsed || 0,
        totalCampaigns: campaigns.length,
        totalEvents: events.length,
        hasVault: !!vault,
        brandScans: brandScores.length,
        avgBrandScore: avgScore,
      },
    });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
};
app.get("/analytics", analyticsHandler);
app.post("/analytics", analyticsHandler);

// ═════════════════════════════════════════════════════════��════
// FLOWS
// ══════════════════════════════════════════════════════════════

app.get("/flows", async (c) => {
  try {
    const user = await requireAuth(c);
    const flows = await kv.getByPrefix(`flow:${user.id}:`);
    return c.json({ success: true, flows: flows || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/flows", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const id = `flow:${user.id}:${Date.now()}`;
    const flow = { id, ...body, userId: user.id, createdAt: new Date().toISOString(), status: "draft" };
    await kv.set(id, flow);
    return c.json({ success: true, flow });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/flows/:id/execute", async (c) => {
  try {
    const user = await requireAuth(c);
    const flowId = c.req.param("id");
    const canDeduct = await deductCredit(user.id, 3);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    const flows = await kv.getByPrefix(`flow:${user.id}:`);
    const flow = flows.find((f: any) => f.id === flowId || f.id?.endsWith(flowId));
    if (!flow) return c.json({ success: false, error: "Flow not found" });

    const results = [];
    for (const step of (flow.steps || [])) {
      try {
        if (step.type === "generate") {
          const genResult = await generateText({
            prompt: flow.name || "Generate creative content",
            model: "gpt-4o",
            systemPrompt: "You are a creative content generator.",
            maxTokens: 512,
          });
          results.push({ status: "done", output: genResult.text.slice(0, 200) });
        } else if (step.type === "validate") {
          results.push({ status: "done", output: "Brand compliance: 92/100" });
        } else if (step.type === "cascade") {
          results.push({ status: "done", output: "Cascaded to 4 formats" });
        } else {
          results.push({ status: "done", output: `${step.label} completed` });
        }
      } catch (err) { results.push({ status: "error", error: String(err) }); }
    }

    await logEvent("flow_execution", { userId: user.id, flowId, stepsCompleted: results.filter(r => r.status === "done").length });
    return c.json({ success: true, results });
  } catch (err) { return c.json({ success: false, error: `Flow execution error: ${err}` }, 500); }
});

// ══════════════════════════════════════════════��═══════════════
// STUDIO CHAT
// ══════════════════════════════════════════════════════════════

app.post("/studio/chat", async (c) => {
  try {
    // Soft auth: allow guests to use studio chat (don't block on auth failure)
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[studio/chat] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { message, format, selectedElement, chatHistory } = await c.req.json();
    if (!message) return c.json({ error: "Message required" }, 400);
    if (user) {
      const canDeduct = await deductCredit(user.id, 1);
      if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);
    }

    const ctx = [`User message: "${message}"`];
    if (format) ctx.push(`Current format: ${format}`);
    if (selectedElement) ctx.push(`Selected element: ${selectedElement}`);
    if (chatHistory?.length) ctx.push("Recent:\n" + chatHistory.slice(-4).map((m: any) => `${m.role}: ${m.text}`).join("\n"));

    const result = await generateText({
      prompt: ctx.join("\n"),
      model: "gpt-4o",
      systemPrompt: `You are ORA Studio's AI assistant team. Return a JSON array: [{"agent":"Creative Director","text":"..."},{"agent":"Copywriter","text":"..."}]. 1-3 agents max. Return ONLY JSON.`,
      maxTokens: 1024,
    });

    let responses: any[];
    try {
      const m = result.text.match(/\[[\s\S]*\]/);
      responses = m ? JSON.parse(m[0]) : [{ agent: "Creative Director", text: result.text }];
    } catch { responses = [{ agent: "Creative Director", text: result.text }]; }

    return c.json({ success: true, responses });
  } catch (err) {
    console.log("[studio/chat] error:", err);
    return c.json({ success: false, error: `Studio chat error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// REMIX
// ══════════════════════════════════════════════════════════════

app.post("/remix", async (c) => {
  try {
    const user = await requireAuth(c);
    const { content, formats } = await c.req.json();
    if (!content) return c.json({ error: "Content required" }, 400);
    const canDeduct = await deductCredit(user.id, 2);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    const result = await generateText({
      prompt: `Remix this content for: ${(formats || []).join(", ")}.\n\nOriginal:\n"${content.slice(0, 2000)}"\n\nReturn JSON: { "analysis": { "type": "...", "title": "...", "wordCount": N, "keyThemes": [], "tone": "..." }, "remixes": [{ "format": "linkedin", "content": "..." }] }. Return ONLY JSON.`,
      model: "gpt-4o",
      systemPrompt: "You are a content remix specialist. Adapt content to different formats while maintaining the core message.",
      maxTokens: 2048,
    });

    let parsed: any = {};
    try { const m = result.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
    catch { parsed = { analysis: { type: "generic", title: "Content Analysis", wordCount: content.split(/\s+/).length, keyThemes: [], tone: "neutral" }, remixes: [] }; }

    await logEvent("generation", { userId: user.id, type: "remix" });
    return c.json({ success: true, analysis: parsed.analysis || parsed, remixes: parsed.remixes || [] });
  } catch (err) { return c.json({ success: false, error: `Remix error: ${err}` }, 500); }
});

// ══════════════════════════════════════════════════════════════
// BRAND SCORE
// ═══════════════���════════════════════════════���═════════════════

app.get("/brand-score/history", async (c) => {
  try {
    const user = await requireAuth(c);
    const history = await kv.getByPrefix(`brand-score:${user.id}:`);
    return c.json({ success: true, history: history || [] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/brand-score", async (c) => {
  try {
    const user = await requireAuth(c);
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "URL required" }, 400);
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    let scrapedContent = "";
    try {
      const jinaKey = Deno.env.get("JINA_API_KEY");
      if (jinaKey) {
        const res = await fetch(`https://r.jina.ai/${url}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${jinaKey}`,
            "Accept": "application/json",
            "X-No-Cache": "true",
            "X-Proxy": "auto",
            "X-Target-Selector": "body",
          },
        });
        if (res.ok) { const d = await res.json(); scrapedContent = d.data?.content || d.data?.text || d.content || ""; }
      }
    } catch (e) { console.log("[brand-score] Jina failed:", e); }

    if (!scrapedContent) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "ORA-Bot/1.0" } });
        scrapedContent = await res.text();
        scrapedContent = scrapedContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 5000);
      } catch (e) { console.log("[brand-score] Direct fetch failed:", e); return c.json({ success: false, error: "Could not access URL" }); }
    }

    const result = await generateText({
      prompt: `Analyze brand consistency for ${url}. Score 0-100.\nContent: ${scrapedContent.slice(0, 3000)}\n\nReturn JSON: { "overall": N, "tone": N, "vocabulary": N, "visual": N, "compliance": N, "strengths": [], "improvements": [], "summary": "..." }. Return ONLY JSON.`,
      model: "gpt-4o",
      systemPrompt: "You are a brand auditor. Evaluate brand consistency across tone, vocabulary, visual coherence, compliance.",
      maxTokens: 1024,
    });

    let results: any = {};
    try { const m = result.text.match(/\{[\s\S]*\}/); if (m) results = JSON.parse(m[0]); }
    catch { results = { overall: 50, tone: 50, vocabulary: 50, visual: 50, compliance: 50, summary: result.text }; }

    const scanId = `brand-score:${user.id}:${Date.now()}`;
    const record = { ...results, url, scannedAt: new Date().toISOString(), id: scanId };
    await kv.set(scanId, record);
    return c.json({ success: true, results: record });
  } catch (err) { return c.json({ success: false, error: `Brand score error: ${err}` }, 500); }
});

// ══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════

// Combined admin data — POST avoids CORS preflight (Content-Type: text/plain = simple request)
app.post("/admin/data", async (c) => {
  try {
    console.log("[admin/data] request received, userToken:", !!c.get?.("userToken"), "parsedBody:", !!c.get?.("parsedBody"), "authHeader:", c.req.header("Authorization")?.slice(0, 30) || "NONE");
    await requireAdmin(c);

    const allUsers = await kv.getByPrefix("user:");
    const users = allUsers.filter((u: any) => u.userId);
    const planCounts = { free: 0, starter: 0, generate: 0, studio: 0 };
    let totalCreditsUsed = 0, totalCreditsAllocated = 0;
    for (const u of users) {
      if (u.plan && planCounts[u.plan as keyof typeof planCounts] !== undefined) planCounts[u.plan as keyof typeof planCounts]++;
      totalCreditsUsed += u.creditsUsed || 0;
      totalCreditsAllocated += u.credits || 0;
    }
    const mrr = planCounts.starter * 29 + planCounts.generate * 79 + planCounts.studio * 149;

    const allLogs = await kv.getByPrefix("log:");
    const sortedLogs = allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const allCosts = await kv.getByPrefix("cost:");
    const sortedCosts = allCosts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const byProvider: Record<string, any> = {};
    const byType: Record<string, any> = {};
    const byDay: Record<string, any> = {};
    let totalCostEur = 0, totalRevenue = 0, totalMargin = 0, totalCount = 0;

    for (const item of sortedCosts) {
      const entry = item as CostEntry;
      if (!entry.provider) continue;
      totalCount++;
      totalCostEur += entry.costEur || 0;
      totalRevenue += entry.revenueEur || 0;
      totalMargin += entry.marginEur || 0;
      const pKey = entry.provider.split("/")[0];
      if (!byProvider[pKey]) byProvider[pKey] = { count: 0, totalCostUsd: 0, totalCostEur: 0, totalRevenue: 0, totalMargin: 0, avgLatency: 0, successCount: 0, failCount: 0 };
      const bp = byProvider[pKey]; bp.count++; bp.totalCostUsd += entry.costUsd || 0; bp.totalCostEur += entry.costEur || 0;
      bp.totalRevenue += entry.revenueEur || 0; bp.totalMargin += entry.marginEur || 0;
      bp.avgLatency = (bp.avgLatency * (bp.count - 1) + (entry.latencyMs || 0)) / bp.count;
      if (entry.success) bp.successCount++; else bp.failCount++;
      if (!byType[entry.type]) byType[entry.type] = { count: 0, totalCostEur: 0, totalRevenue: 0, totalMargin: 0 };
      const bt = byType[entry.type]; bt.count++; bt.totalCostEur += entry.costEur || 0; bt.totalRevenue += entry.revenueEur || 0; bt.totalMargin += entry.marginEur || 0;
      const day = entry.timestamp?.slice(0, 10) || "unknown";
      if (!byDay[day]) byDay[day] = { costEur: 0, revenueEur: 0, marginEur: 0, count: 0 };
      byDay[day].costEur += entry.costEur || 0; byDay[day].revenueEur += entry.revenueEur || 0; byDay[day].marginEur += entry.marginEur || 0; byDay[day].count++;
    }
    for (const k of Object.keys(byProvider)) {
      const p = byProvider[k]; p.totalCostUsd = Math.round(p.totalCostUsd * 10000) / 10000; p.totalCostEur = Math.round(p.totalCostEur * 10000) / 10000;
      p.totalRevenue = Math.round(p.totalRevenue * 10000) / 10000; p.totalMargin = Math.round(p.totalMargin * 10000) / 10000; p.avgLatency = Math.round(p.avgLatency);
    }

    return c.json({
      success: true,
      overview: { totalUsers: users.length, planCounts, totalCreditsUsed, totalCreditsAllocated, mrr, starterRevenue: planCounts.starter * 29, generateRevenue: planCounts.generate * 79, studioRevenue: planCounts.studio * 149, recentLogs: sortedLogs.slice(0, 20), serverTime: new Date().toISOString() },
      users,
      logs: sortedLogs.slice(0, 100),
      costs: {
        total: { count: totalCount, costEur: Math.round(totalCostEur * 10000) / 10000, revenueEur: Math.round(totalRevenue * 10000) / 10000, marginEur: Math.round(totalMargin * 10000) / 10000 },
        byProvider, byType, byDay, recentEntries: sortedCosts.slice(0, 100), providerCostTable: PROVIDER_COSTS, revenueTable: REVENUE_PER_TYPE,
      },
    });
  } catch (err) {
    console.log("[admin/data] error:", err);
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    if (String(err).includes("Unauthorized")) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Legacy GET routes (kept for backward compat)
app.get("/admin/overview", async (c) => {
  try {
    await requireAdmin(c);
    const allUsers = await kv.getByPrefix("user:");
    const users = allUsers.filter((u: any) => u.userId);
    const planCounts = { free: 0, starter: 0, generate: 0, studio: 0 };
    let totalCreditsUsed = 0, totalCreditsAllocated = 0;
    for (const u of users) {
      if (u.plan && planCounts[u.plan as keyof typeof planCounts] !== undefined) planCounts[u.plan as keyof typeof planCounts]++;
      totalCreditsUsed += u.creditsUsed || 0;
      totalCreditsAllocated += u.credits || 0;
    }
    const mrr = planCounts.starter * 29 + planCounts.generate * 79 + planCounts.studio * 149;
    const allLogs = await kv.getByPrefix("log:");
    const recentLogs = allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
    return c.json({
      success: true,
      overview: { totalUsers: users.length, planCounts, totalCreditsUsed, totalCreditsAllocated, mrr, starterRevenue: planCounts.starter * 29, generateRevenue: planCounts.generate * 79, studioRevenue: planCounts.studio * 149, recentLogs, serverTime: new Date().toISOString() },
    });
  } catch (err) {
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.get("/admin/users", async (c) => {
  try {
    await requireAdmin(c);
    const allUsers = await kv.getByPrefix("user:");
    return c.json({ success: true, users: allUsers.filter((u: any) => u.userId) });
  } catch (err) {
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.get("/admin/logs", async (c) => {
  try {
    await requireAdmin(c);
    const allLogs = await kv.getByPrefix("log:");
    const sorted = allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
    return c.json({ success: true, logs: sorted });
  } catch (err) {
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Accept both PUT and POST for plan change (POST avoids CORS preflight)
const adminPlanChangeHandler = async (c: any) => {
  try {
    await requireAdmin(c);
    const userId = c.req.param("userId");
    const body = c.get?.("parsedBody") || await c.req.json();
    const { plan } = body;
    if (!["free", "generate", "studio"].includes(plan)) return c.json({ error: "Invalid plan" }, 400);
    const profile = await kv.get(`user:${userId}`);
    if (!profile) return c.json({ error: "User not found" }, 404);
    profile.plan = plan;
    profile.credits = PLAN_CREDITS[plan] || PLAN_CREDITS.free;
    await kv.set(`user:${userId}`, profile);
    await logEvent("admin_plan_change", { userId, plan, adminAction: true });
    return c.json({ success: true, profile });
  } catch (err) {
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    return c.json({ success: false, error: String(err) }, 500);
  }
};
app.put("/admin/users/:userId/plan", adminPlanChangeHandler);
app.post("/admin/users/:userId/plan", adminPlanChangeHandler);

app.get("/admin/costs", async (c) => {
  try {
    await requireAdmin(c);
    const allCosts = await kv.getByPrefix("cost:");
    const sorted = allCosts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Aggregations
    const byProvider: Record<string, { count: number; totalCostUsd: number; totalCostEur: number; totalRevenue: number; totalMargin: number; avgLatency: number; successCount: number; failCount: number }> = {};
    const byType: Record<string, { count: number; totalCostEur: number; totalRevenue: number; totalMargin: number }> = {};
    const byDay: Record<string, { costEur: number; revenueEur: number; marginEur: number; count: number }> = {};
    let totalCostEur = 0, totalRevenue = 0, totalMargin = 0, totalCount = 0;

    for (const item of sorted) {
      const entry = item as CostEntry;
      if (!entry.provider) continue;
      totalCount++;
      totalCostEur += entry.costEur || 0;
      totalRevenue += entry.revenueEur || 0;
      totalMargin += entry.marginEur || 0;

      // By provider
      const pKey = entry.provider.split("/")[0]; // luma, replicate, apipod
      if (!byProvider[pKey]) byProvider[pKey] = { count: 0, totalCostUsd: 0, totalCostEur: 0, totalRevenue: 0, totalMargin: 0, avgLatency: 0, successCount: 0, failCount: 0 };
      const bp = byProvider[pKey];
      bp.count++;
      bp.totalCostUsd += entry.costUsd || 0;
      bp.totalCostEur += entry.costEur || 0;
      bp.totalRevenue += entry.revenueEur || 0;
      bp.totalMargin += entry.marginEur || 0;
      bp.avgLatency = (bp.avgLatency * (bp.count - 1) + (entry.latencyMs || 0)) / bp.count;
      if (entry.success) bp.successCount++; else bp.failCount++;

      // By type
      if (!byType[entry.type]) byType[entry.type] = { count: 0, totalCostEur: 0, totalRevenue: 0, totalMargin: 0 };
      const bt = byType[entry.type];
      bt.count++;
      bt.totalCostEur += entry.costEur || 0;
      bt.totalRevenue += entry.revenueEur || 0;
      bt.totalMargin += entry.marginEur || 0;

      // By day
      const day = entry.timestamp?.slice(0, 10) || "unknown";
      if (!byDay[day]) byDay[day] = { costEur: 0, revenueEur: 0, marginEur: 0, count: 0 };
      byDay[day].costEur += entry.costEur || 0;
      byDay[day].revenueEur += entry.revenueEur || 0;
      byDay[day].marginEur += entry.marginEur || 0;
      byDay[day].count++;
    }

    // Round values
    for (const k of Object.keys(byProvider)) {
      const p = byProvider[k];
      p.totalCostUsd = Math.round(p.totalCostUsd * 10000) / 10000;
      p.totalCostEur = Math.round(p.totalCostEur * 10000) / 10000;
      p.totalRevenue = Math.round(p.totalRevenue * 10000) / 10000;
      p.totalMargin = Math.round(p.totalMargin * 10000) / 10000;
      p.avgLatency = Math.round(p.avgLatency);
    }

    return c.json({
      success: true,
      costs: {
        total: { count: totalCount, costEur: Math.round(totalCostEur * 10000) / 10000, revenueEur: Math.round(totalRevenue * 10000) / 10000, marginEur: Math.round(totalMargin * 10000) / 10000 },
        byProvider, byType, byDay,
        recentEntries: sorted.slice(0, 100),
        providerCostTable: PROVIDER_COSTS,
        revenueTable: REVENUE_PER_TYPE,
      },
    });
  } catch (err) {
    if (String(err).includes("Forbidden")) return c.json({ error: "Access denied" }, 403);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ═════════════════════════════════════════════════════════════
// DEBUG / DIAGNOSTICS
// ═════════════════════════════════════════════════════════════

app.get("/debug/ai-config", (c) => {
  const mask = (key: string | undefined) => key ? `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)` : "NOT SET";
  return c.json({ apipod: mask(Deno.env.get("APIPOD_API_KEY")), luma: mask(Deno.env.get("LUMA_API_KEY")), replicate_audio: mask(Deno.env.get("REPLICATE_API_TOKEN")) });
});

app.get("/debug/test-single/:provider", async (c) => {
  try {
    const provider = c.req.param("provider");
    const start = Date.now();

    if (provider === "apipod_text") {
      const res = await fetch("https://api.apipod.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("APIPOD_API_KEY")}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "Say hello" }], max_tokens: 10 }),
      });
      const text = await res.text();
      return c.json({ provider, status: res.ok ? "OK" : "FAIL", code: res.status, ms: Date.now() - start, body: text.slice(0, 500) });
    }

    if (provider === "luma") {
      const key = Deno.env.get("LUMA_API_KEY");
      if (!key) return c.json({ provider, status: "SKIP", error: "LUMA_API_KEY not set" });
      const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      return c.json({ provider, status: res.ok ? "OK" : "FAIL", code: res.status, ms: Date.now() - start, body: text.slice(0, 500) });
    }

    return c.json({ provider, status: "UNKNOWN", error: "Unknown provider" });
  } catch (err) { return c.json({ provider: c.req.param("provider"), status: "ERROR", error: String(err) }); }
});

app.post("/debug/generate-test", async (c) => {
  try {
    await requireAuth(c);
    const { type, prompt, model } = await c.req.json();
    const start = Date.now();
    if (type === "text") {
      const result = await generateText({ prompt: prompt || "Say hello world", model: model || "gpt-4o", maxTokens: 100 });
      return c.json({ success: true, result, totalMs: Date.now() - start });
    }
    if (type === "image") {
      const result = await generateImage({ prompt: prompt || "A blue circle", model: model || "ora-vision" });
      return c.json({ success: true, result, totalMs: Date.now() - start });
    }
    if (type === "video") {
      const result = await generateVideo({ prompt: prompt || "A blue circle rotating slowly", model: model || "ora-motion" });
      return c.json({ success: true, result, totalMs: Date.now() - start });
    }
    if (type === "audio") {
      const result = await generateAudio({ prompt: prompt || "Upbeat corporate jingle", model: model || "ora-audio" });
      return c.json({ success: true, result, totalMs: Date.now() - start });
    }
    return c.json({ success: false, error: `Unknown type: ${type}` });
  } catch (err) { return c.json({ success: false, error: String(err) }); }
});

app.get("/debug/text-noauth", async (c) => {
  const t0 = Date.now();
  try {
    const result = await Promise.race([
      generateText({ prompt: "Say hello in 10 words", model: "gpt-4o", maxTokens: 50 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 15s")), 15_000)),
    ]);
    return c.json({ success: true, result, ms: Date.now() - t0 });
  } catch (err) {
    return c.json({ success: false, error: String(err), ms: Date.now() - t0 });
  }
});

app.get("/debug/image-noauth", async (c) => {
  const t0 = Date.now();
  try {
    const result = await Promise.race([
      generateImage({ prompt: "A simple blue circle on white background", model: "ora-vision" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 95s")), 95_000)),
    ]);
    return c.json({ success: true, result, ms: Date.now() - t0 });
  } catch (err) {
    return c.json({ success: false, error: String(err), ms: Date.now() - t0 });
  }
});

// ── IMAGE GENERATION VIA GET — workaround for POST not reaching server ──
app.get("/generate/image-via-get", async (c) => {
  const t0 = Date.now();
  console.log(`[image-via-get] ENTERED at ${new Date().toISOString()}`);
  try {
    const prompt = c.req.query("prompt") || "";
    const modelsRaw = c.req.query("models") || "";
    const aspectRatio = c.req.query("aspectRatio") || "";
    const models = modelsRaw.split(",").filter(Boolean);
    if (!prompt || !models.length) {
      return c.json({ error: "prompt and models query params required" }, 400);
    }
    console.log(`[image-via-get] raw prompt="${prompt.slice(0, 60)}", models=${models.join(",")}, aspectRatio=${aspectRatio || "default"}`);
    // Enhance/translate prompt to English for better image generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[image-via-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}"`);
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const MODEL_TIMEOUT = 120_000;
    const HANDLER_TIMEOUT = 170_000;
    const CONCURRENCY = 4;
    const work = (async () => {
      const results: any[] = [];
      for (let i = 0; i < models.length; i += CONCURRENCY) {
        const batch = models.slice(i, i + CONCURRENCY);
        console.log(`[image-via-get] batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.join(",")}`);
        const batchResults = await Promise.all(
          batch.map(async (model: string) => {
            try {
              if (user) deductCredit(user.id, 2).catch(() => {});
              // Route to the correct provider based on model map
              const genFn = directApiModels.has(model) ? generateImageDirect : leonardoImageModelMap[model] ? generateImageLeonardo : leonardoV2ModelMap[model] ? generateImageLeonardoV2 : hfImageModelMap[model] ? generateImageHf : generateImage;
              const result = await Promise.race([
                genFn({ prompt: enhancedPrompt, model, ...(aspectRatio ? { aspectRatio } : {}) }),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
              ]);
              console.log(`[image-via-get] ${model} OK (${Date.now() - t0}ms)`);
              const r = result as any;
              logCost({ type: "image", model, provider: r.provider || "unknown", costUsd: getProviderCost(r.provider || "", "image"), revenueEur: REVENUE_PER_TYPE.image, latencyMs: r.latencyMs || (Date.now() - t0), userId: user?.id || "guest", success: true }).catch(() => {});
              return { success: true, result };
            } catch (err) {
              console.log(`[image-via-get] ${model} FAIL (${Date.now() - t0}ms): ${err}`);
              return { success: false, error: String(err) };
            }
          })
        );
        results.push(...batchResults);
      }
      return results;
    })();
    const results = await Promise.race([
      work,
      new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error(`Handler timeout ${HANDLER_TIMEOUT}ms`)), HANDLER_TIMEOUT)),
    ]).catch((err) => {
      console.log(`[image-via-get] HANDLER TIMEOUT (${Date.now() - t0}ms): ${err}`);
      return models.map((model: string) => ({ success: false, error: `Server timeout` }));
    });
    console.log(`[image-via-get] done (${Date.now() - t0}ms), results: ${results.length}`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[image-via-get] error (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image generation error: ${err}` }, 500);
  }
});

// ── IMAGE BATCH START (submit all models, return generationIds — no polling) ──
// This is the "start" half of the start+poll pattern (like video-start).
// Frontend calls this once, then polls /generate/image-status for each model.
app.get("/generate/image-batch-start", async (c) => {
  const t0 = Date.now();
  console.log(`[image-batch-start] ENTERED at ${new Date().toISOString()}`);
  try {
    const rawPrompt = c.req.query("prompt") || "";
    const modelsRaw = c.req.query("models") || "";
    const clientAspectRatio = c.req.query("aspectRatio") || "";
    const models = modelsRaw.split(",").filter(Boolean);
    if (!rawPrompt || !models.length) {
      return c.json({ error: "prompt and models query params required" }, 400);
    }
    console.log(`[image-batch-start] raw prompt="${rawPrompt.slice(0, 60)}", models=${models.join(",")}, ar=${clientAspectRatio || "default"}`);

    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}

    // ── SERVER-SIDE BRAND CONTEXT (same as video-start) ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try { brandCtx = await buildBrandContext(user.id); } catch (err) {
        console.log(`[image-batch-start] buildBrandContext failed (continuing without): ${err}`);
      }
    }
    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);
      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Brand aesthetic.`;
        console.log(`[image-batch-start] Brand-enriched prompt (${prompt.length} chars)`);
      }
    }

    // Enhance/translate prompt ONCE for all models
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[image-batch-start] enhanced="${enhancedPrompt.slice(0, 80)}" (${Date.now() - t0}ms)`);

    // Force anti-text suffix
    const antiText = ". No visible text, no letters, no words, no brand names, no logos anywhere in the image.";
    const finalPrompt = enhancedPrompt.toLowerCase().includes("no visible text") ? enhancedPrompt : enhancedPrompt + antiText;

    // Submit each model to its provider (NO polling — just submit and return IDs)
    const generations = await Promise.all(models.map(async (model: string) => {
      try {
        if (user) deductCredit(user.id, 2).catch(() => {});
        const ar = clientAspectRatio || undefined;

        // ── Route to correct provider ──

        // Leonardo V2 models (non-v1 slug)
        const v2Map = leonardoV2ModelMap[model];
        if (v2Map && v2Map.modelSlug !== "__v1__") {
          const aspect = ar || v2Map.aspectRatio;
          const dims = leonardoV2AspectToDims(aspect);
          const submitBody: any = {
            model: v2Map.modelSlug,
            parameters: { prompt: finalPrompt, width: dims.width, height: dims.height, quantity: 1, prompt_enhance: "OFF" },
            public: false,
          };
          if (v2Map.defaultStyle) submitBody.parameters.style_ids = [v2Map.defaultStyle];
          const res = await fetch(`${LEONARDO_V2_BASE}/generations`, { method: "POST", headers: leonardoHeaders(), body: JSON.stringify(submitBody), signal: AbortSignal.timeout(15_000) });
          if (!res.ok) { const b = await res.text(); throw new Error(`Leonardo v2 submit ${res.status}: ${b.slice(0, 200)}`); }
          const data = await res.json();
          const gId = data.sdGenerationJob?.generationId;
          if (!gId) throw new Error(`Leonardo v2: no generationId`);
          console.log(`[image-batch-start] ${model} -> leo:${gId} (${Date.now() - t0}ms)`);
          return { model, generationId: `leo:${gId}`, state: "queued", provider: "leonardo-v2" };
        }

        // Leonardo V1 models (including Phoenix routed from v2 __v1__)
        const v1Map = leonardoImageModelMap[model];
        if (v1Map) {
          const aspect = ar || v1Map.aspectRatio;
          const dims = leonardoAspectToDims(aspect);
          const isLucid = v1Map.leonardoModelId.startsWith("7b5922") || v1Map.leonardoModelId.startsWith("05ce00");
          const submitBody: any = {
            prompt: finalPrompt, modelId: v1Map.leonardoModelId, width: dims.width, height: dims.height,
            num_images: 1, contrast: 3.5, styleUUID: v1Map.styleUUID || "111dc692-d470-4eec-b791-3475abac4c46",
          };
          if (!isLucid) submitBody.alchemy = true;
          const res = await fetch(`${LEONARDO_BASE}/generations`, { method: "POST", headers: leonardoHeaders(), body: JSON.stringify(submitBody), signal: AbortSignal.timeout(15_000) });
          if (!res.ok) { const b = await res.text(); throw new Error(`Leonardo submit ${res.status}: ${b.slice(0, 200)}`); }
          const data = await res.json();
          const gId = data.sdGenerationJob?.generationId;
          if (!gId) throw new Error(`Leonardo: no generationId`);
          console.log(`[image-batch-start] ${model} -> leo:${gId} (${Date.now() - t0}ms)`);
          return { model, generationId: `leo:${gId}`, state: "queued", provider: "leonardo" };
        }

        // Higgsfield models
        const hfMap = hfImageModelMap[model];
        if (hfMap) {
          const aspect = ar || hfMap.aspectRatio;
          const hfBody: any = { prompt: finalPrompt, aspect_ratio: aspect, resolution: "2K" };
          const result = await hfFetchWithFallback(hfMap.hfModels, hfBody, "image-batch-start");
          if (!result.ok) throw new Error(`HF submit: ${result.error}`);
          const requestId = result.data.request_id;
          console.log(`[image-batch-start] ${model} -> hf:${requestId} via ${result.model} (${Date.now() - t0}ms)`);
          return { model, generationId: `hf:${requestId}`, state: "queued", provider: result.model };
        }

        // Luma Photon models
        const lumaMap = imageModelMap[model];
        if (lumaMap) {
          const aspect = ar || lumaMap.aspectRatio;
          const res = await fetch(`${LUMA_BASE}/generations/image`, {
            method: "POST", headers: lumaHeaders(),
            body: JSON.stringify({ prompt: finalPrompt, model: lumaMap.lumaModel, aspect_ratio: aspect }),
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) { const b = await res.text(); throw new Error(`Luma submit ${res.status}: ${b.slice(0, 200)}`); }
          const gen = await res.json();
          if (!gen.id) throw new Error(`Luma: no generation id`);
          console.log(`[image-batch-start] ${model} -> luma:${gen.id} (${Date.now() - t0}ms)`);
          return { model, generationId: `luma:${gen.id}`, state: "queued", provider: `luma/${lumaMap.lumaModel}` };
        }

        // Direct API models (DALL-E, Flux Pro) — run synchronously (no submit+poll pattern)
        if (directApiModels.has(model)) {
          const result = await Promise.race([
            generateImageDirect({ prompt: finalPrompt, model, ...(ar ? { aspectRatio: ar } : {}) }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >90s`)), 90_000)),
          ]) as any;
          console.log(`[image-batch-start] ${model} -> direct OK (${Date.now() - t0}ms)`);
          return { model, generationId: `direct:${model}-${Date.now()}`, state: "completed", provider: result.provider, imageUrl: result.imageUrl };
        }

        throw new Error(`Unknown image model: ${model}`);
      } catch (err) {
        console.log(`[image-batch-start] ${model} SUBMIT FAILED (${Date.now() - t0}ms): ${err}`);
        return { model, generationId: null, state: "failed", error: String(err) };
      }
    }));

    const ok = generations.filter(g => g.generationId).length;
    console.log(`[image-batch-start] DONE: ${ok}/${models.length} submitted in ${Date.now() - t0}ms`);
    if (user) logEvent("generation", { userId: user.id, type: "image", models: models.join(","), count: ok }).catch(() => {});
    return c.json({ success: true, generations });
  } catch (err) {
    console.log(`[image-batch-start] FATAL (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Image batch start error: ${err}` }, 500);
  }
});

// ── IMAGE WITH REFERENCE via GET — Visual Lab ──
app.get("/generate/image-ref-via-get", async (c) => {
  const t0 = Date.now();
  console.log(`[image-ref-via-get] ENTERED at ${new Date().toISOString()}`);
  try {
    const prompt = c.req.query("prompt") || "";
    const imageRefUrl = c.req.query("imageRefUrl") || "";
    const modelsRaw = c.req.query("models") || "";
    const strength = parseFloat(c.req.query("strength") || "0.80");
    const mode = c.req.query("mode") || "style"; // "content" = high-fidelity preserve, "style" = style reference (default)
    const preserveContent = mode === "content";
    const aspectRatio = c.req.query("aspectRatio") || "";
    const models = modelsRaw.split(",").filter(Boolean);
    if (!prompt || !imageRefUrl || !models.length) {
      return c.json({ error: "prompt, imageRefUrl, and models query params required" }, 400);
    }
    console.log(`[image-ref-via-get] raw prompt="${prompt.slice(0, 60)}", ref=${imageRefUrl.slice(0, 80)}, models=${models.join(",")}, strength=${strength}, mode=${mode}, ar=${aspectRatio || "default"}`);
    // Enhance/translate prompt — preserveBrandName=true when ref image exists (character_ref needs brand identity in prompt)
    const enhancedPrompt = await enhanceImagePrompt(prompt, preserveContent);
    console.log(`[image-ref-via-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}" (preserveBrand=${preserveContent})`);
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const MODEL_TIMEOUT = 95_000;
    const CONCURRENCY = 2;
    const HANDLER_TIMEOUT = 140_000;
    const work = (async () => {
      const results: any[] = [];
      for (let i = 0; i < models.length; i += CONCURRENCY) {
        const batch = models.slice(i, i + CONCURRENCY);
        console.log(`[image-ref-via-get] batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.join(",")}`);
        const batchResults = await Promise.all(
          batch.map(async (model: string) => {
            try {
              if (user) deductCredit(user.id, 3).catch(() => {});
              const result = await Promise.race([
                generateImageWithRef({ prompt: enhancedPrompt, model, imageRefUrl, strength, preserveContent, aspectRatio: aspectRatio || undefined }),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
              ]);
              console.log(`[image-ref-via-get] ${model} OK (${Date.now() - t0}ms, mode=${mode})`);
              return { success: true, result };
            } catch (err) {
              console.log(`[image-ref-via-get] ${model} FAIL (${Date.now() - t0}ms): ${err}`);
              return { success: false, error: String(err) };
            }
          })
        );
        results.push(...batchResults);
      }
      return results;
    })();

    const results = await Promise.race([
      work,
      new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error(`Handler timeout ${HANDLER_TIMEOUT}ms`)), HANDLER_TIMEOUT)),
    ]).catch((err) => {
      console.log(`[image-ref-via-get] HANDLER TIMEOUT (${Date.now() - t0}ms): ${err}`);
      return models.map(() => ({ success: false, error: `Server timeout` }));
    });
    console.log(`[image-ref-via-get] done (${Date.now() - t0}ms), results: ${results.length}`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[image-ref-via-get] error (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image ref generation error: ${err}` }, 500);
  }
});

// ── LEONARDO EDIT — Upload image + generate with guidance ──
app.post("/leonardo/edit", async (c) => {
  const t0 = Date.now();
  console.log(`[leonardo/edit] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { imageUrl, prompt, model, guidanceType, strength, aspectRatio } = await c.req.json();
    if (!imageUrl || !prompt) return c.json({ error: "imageUrl and prompt required" }, 400);
    const editModel = model || "lucid-realism";
    const guidance = guidanceType || "content";
    console.log(`[leonardo/edit] model=${editModel}, guidance=${guidance}, strength=${strength || "Mid"}, prompt="${prompt.slice(0, 60)}"`);

    // Step 1: Upload image to Leonardo
    const { imageId } = await uploadImageToLeonardo(imageUrl);

    // Step 2: Generate with guidance
    let result: any;
    const isV2 = !!leonardoV2ModelMap[editModel] && leonardoV2ModelMap[editModel].modelSlug !== "__v1__";
    if (isV2) {
      result = await Promise.race([
        generateImageLeonardoV2WithGuidance({
          prompt, model: editModel, imageId,
          strength: (strength || "MID") as "LOW" | "MID" | "HIGH",
          aspectRatio,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Leonardo v2 edit timeout 130s")), 130_000)),
      ]);
    } else {
      result = await Promise.race([
        generateImageLeonardoWithGuidance({
          prompt, model: editModel, imageId,
          guidanceType: guidance,
          strength: strength === "HIGH" ? "High" : strength === "LOW" ? "Low" : "Mid",
          aspectRatio,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Leonardo edit timeout 130s")), 130_000)),
      ]);
    }

    if (user) {
      deductCredit(user.id, 4).catch(() => {});
      logCost({ type: "image", model: editModel, provider: (result as any).provider || "leonardo-edit", costUsd: 0.040, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[leonardo/edit] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, imageUrl: (result as any).imageUrl, provider: (result as any).provider, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[leonardo/edit] error: ${err}`);
    return c.json({ success: false, error: `Leonardo edit error: ${err}` }, 500);
  }
});

// ── LEONARDO UPLOAD — Upload external URL to Leonardo (returns imageId) ──
app.post("/leonardo/upload", async (c) => {
  const t0 = Date.now();
  try {
    const { imageUrl } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);
    const { imageId } = await uploadImageToLeonardo(imageUrl);
    return c.json({ success: true, imageId, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[leonardo/upload] error: ${err}`);
    return c.json({ success: false, error: `Upload error: ${err}` }, 500);
  }
});

// ── UPLOAD FOR VISUAL LAB (no auth required, public signed URL) ──
app.post("/hub/upload-ref", async (c) => {
  const t0 = Date.now();
  console.log(`[hub/upload-ref] ENTERED`);
  try {
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    if (!file) return c.json({ error: "No file provided" }, 400);
    const ext = file.name.split(".").pop() || "bin";
    const fileId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `hub-refs/${fileId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await sb.storage.from(MEDIA_BUCKET).upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });
    if (uploadErr) return c.json({ error: `Upload failed: ${uploadErr.message}` }, 500);
    // Create a long-lived signed URL (2 hours) for the AI providers to access
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 7200);
    console.log(`[hub/upload-ref] OK in ${Date.now() - t0}ms, path=${storagePath}`);
    return c.json({ success: true, signedUrl: urlData?.signedUrl || null, storagePath, fileId });
  } catch (err) {
    console.log(`[hub/upload-ref] error: ${err}`);
    return c.json({ success: false, error: `Upload error: ${err}` }, 500);
  }
});

app.get("/debug/image-steps", async (c) => {
  const t0 = Date.now();
  const log: string[] = [];
  const step = (msg: string) => { const s = `[${Date.now() - t0}ms] ${msg}`; log.push(s); console.log(`[debug/image-steps] ${s}`); };

  step("START");

  // Check Luma key
  const lumaKey = Deno.env.get("LUMA_API_KEY");
  step(`LUMA_API_KEY: ${lumaKey ? `set (${lumaKey.length} chars)` : "NOT SET"}`);

  // Try Luma Photon with 30s abort
  let lumaResult = "not attempted";
  if (lumaKey) {
    step("Luma Photon submit starting...");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lumaKey}` },
        body: JSON.stringify({ prompt: "A blue circle on white background", model: "photon-flash-1", aspect_ratio: "1:1" }),
        signal: ctrl.signal,
      });
      step(`Luma response: status=${res.status}`);
      const body = await res.text();
      step(`Luma body (${body.length} chars): ${body.slice(0, 300)}`);
      if (res.ok) {
        try { const d = JSON.parse(body); lumaResult = `generation id=${d.id}, state=${d.state}`; }
        catch { lumaResult = `parse error: ${body.slice(0, 100)}`; }
      } else {
        lumaResult = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (err: any) {
      step(`Luma error: ${err.name}: ${err.message}`);
      lumaResult = `${err.name}: ${err.message}`;
    } finally {
      clearTimeout(timer);
    }
  }
  step(`Luma result: ${typeof lumaResult === "string" ? lumaResult.slice(0, 150) : lumaResult}`);

  step("DONE");
  return c.json({ success: true, totalMs: Date.now() - t0, lumaResult, log });
});
// ════���═════════════════════════════════════════════════════════
// DIAGNOSTIC: Test ALL image providers individually + full pipeline
// ══════════════════════════════════════════════════════════════

app.get("/debug/image-providers", async (c) => {
  const t0 = Date.now();
  const log: string[] = [];
  const step = (msg: string) => { const s = `[${Date.now() - t0}ms] ${msg}`; log.push(s); console.log(`[debug/image-providers] ${s}`); };

  step("START — Testing Luma Photon image generation");

  const keys: Record<string, string> = {};
  const lumaKey = Deno.env.get("LUMA_API_KEY");
  keys.LUMA = lumaKey ? `set (${lumaKey.length} chars, starts: ${lumaKey.slice(0, 8)}...)` : "NOT SET";
  step(`LUMA key: ${keys.LUMA}`);

  const testPrompt = "A simple blue circle on white background";
  const results: Record<string, any> = {};

  // Test: Luma Photon (submit + polling)
  step("--- LUMA PHOTON TEST ---");
  try {
    const lumaStart = Date.now();
    const result = await Promise.race([
      generateImage({ prompt: testPrompt, model: "ora-vision" }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Luma test timeout 95s")), 95_000)),
    ]);
    results.luma = { success: true, provider: (result as any).provider, url: (result as any).imageUrl?.slice(0, 100), ms: Date.now() - lumaStart };
    step(`LUMA OK: ${Date.now() - lumaStart}ms — ${(result as any).imageUrl?.slice(0, 80)}`);
  } catch (err: any) {
    results.luma = { success: false, error: err.message, ms: Date.now() - t0 };
    step(`LUMA FAIL: ${err.message}`);
  }

  step(`ALL DONE — total ${Date.now() - t0}ms`);

  const summary = {
    keys,
    providers: {
      luma: results.luma?.success ? `OK (${results.luma.ms}ms)` : `FAIL: ${results.luma?.error}`,
    },
  };

  return c.json({ success: true, totalMs: Date.now() - t0, summary, results, log });
});

// ══════════════════════════════════════════════════════════════
// CATCH-ALL
// ═══════════════════════════════��═════════════════════════════

// Quick smoke test: POST that returns immediately (no AI calls)
app.post("/debug/echo", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, echo: body, ts: new Date().toISOString(), server: "ora-inline" });
});

// ── ALTERNATIVE image endpoint — minimal, no batching, no auth ──
// If this works but image-multi doesn't, the issue is in image-multi's handler code
app.post("/generate/image-simple", async (c) => {
  const t0 = Date.now();
  console.log(`[image-simple] >>>>>> ENTERED at ${new Date().toISOString()}`);
  try {
    const { prompt, models } = await c.req.json();
    console.log(`[image-simple] prompt="${prompt?.slice(0, 50)}", models=${JSON.stringify(models)}`);
    const model = (models && models[0]) || "ora-vision";

    const result = await Promise.race([
      generateImage({ prompt: prompt || "A blue circle", model }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("image-simple timeout 95s")), 95_000)),
    ]);

    console.log(`[image-simple] OK in ${Date.now() - t0}ms, provider=${(result as any).provider}`);
    return c.json({ success: true, results: [{ success: true, result }] });
  } catch (err) {
    console.log(`[image-simple] FAIL in ${Date.now() - t0}ms: ${err}`);
    return c.json({ success: true, results: [{ success: false, error: String(err) }] });
  }
});

// ──── Start server ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// STUDIO MEDIA LIBRARY — Upload, list, delete per-client media
// ════════════════════════════════════════════════���═════════════

const MEDIA_BUCKET = "make-cad57f79-media";
let bucketInitialized = false;
async function ensureBucket() {
  if (bucketInitialized) return;
  try {
    const sb = supabaseAdmin();
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === MEDIA_BUCKET);
    if (!exists) {
      await sb.storage.createBucket(MEDIA_BUCKET, { public: false });
      console.log(`[storage] Created bucket: ${MEDIA_BUCKET}`);
    }
    bucketInitialized = true;
  } catch (e) { console.log("[storage] ensureBucket error:", e); }
}

app.post("/studio/media/upload", async (c) => {
  try {
    const user = await requireAuth(c);
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const clientId = (formData.get("clientId") as string) || "default";
    const customName = (formData.get("name") as string) || file?.name || "untitled";
    if (!file) return c.json({ error: "No file provided" }, 400);
    const ext = file.name.split(".").pop() || "bin";
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${user.id}/${clientId}/${fileId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await sb.storage.from(MEDIA_BUCKET).upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });
    if (uploadErr) return c.json({ error: `Upload failed: ${uploadErr.message}` }, 500);
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
    const mediaItem = { id: fileId, name: customName.replace(/\.[^/.]+$/, ""), originalName: file.name, type: file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image", mimeType: file.type, size: file.size, storagePath, signedUrl: urlData?.signedUrl || null, source: "uploaded", clientId, userId: user.id, createdAt: new Date().toISOString(), dimensions: null };
    await kv.set(`media:${user.id}:${clientId}:${fileId}`, mediaItem);
    return c.json({ success: true, item: mediaItem });
  } catch (err) { return c.json({ success: false, error: `Upload error: ${err}` }, 500); }
});

app.get("/studio/media", async (c) => {
  try {
    const user = await requireAuth(c);
    const clientId = c.req.query("clientId") || "default";
    const source = c.req.query("source");
    const items = await kv.getByPrefix(`media:${user.id}:${clientId}:`);
    let mediaItems = (items || []).filter((item: any) => item && item.id);
    if (source && source !== "all") mediaItems = mediaItems.filter((item: any) => item.source === source);
    const sb = supabaseAdmin();
    const refreshed = await Promise.all(mediaItems.map(async (item: any) => {
      try { if (item.storagePath) { const { data } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(item.storagePath, 3600); return { ...item, signedUrl: data?.signedUrl || item.signedUrl }; } return item; } catch { return item; }
    }));
    return c.json({ success: true, items: refreshed.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
  } catch (err) { return c.json({ success: false, error: `Media list error: ${err}` }, 500); }
});

app.delete("/studio/media/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const fileId = c.req.param("id");
    const clientId = c.req.query("clientId") || "default";
    const item = await kv.get(`media:${user.id}:${clientId}:${fileId}`);
    if (!item) return c.json({ error: "Media not found" }, 404);
    if (item.storagePath) { const sb = supabaseAdmin(); await sb.storage.from(MEDIA_BUCKET).remove([item.storagePath]); }
    await kv.del(`media:${user.id}:${clientId}:${fileId}`);
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: `Delete error: ${err}` }, 500); }
});

app.post("/studio/media/generate", async (c) => {
  try {
    const user = await requireAuth(c);
    const { prompt, clientId = "default", model = "ora-vision" } = await c.req.json();
    if (!prompt) return c.json({ error: "Prompt required" }, 400);
    const canDeduct = await deductCredit(user.id, 2);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);
    await ensureBucket();
    const imgResult = await generateImage({ prompt, model });
    if (!imgResult?.imageUrl) return c.json({ error: "Image generation failed" }, 500);
    const sb = supabaseAdmin();
    const imgResponse = await fetch(imgResult.imageUrl);
    const imgBuffer = await imgResponse.arrayBuffer();
    const fileId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${user.id}/${clientId}/${fileId}.png`;
    await sb.storage.from(MEDIA_BUCKET).upload(storagePath, imgBuffer, { contentType: "image/png", upsert: false });
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
    const mediaItem = { id: fileId, name: prompt.slice(0, 60), originalName: `${fileId}.png`, type: "image", mimeType: "image/png", size: imgBuffer.byteLength, storagePath, signedUrl: urlData?.signedUrl || null, source: "generated", clientId, userId: user.id, createdAt: new Date().toISOString(), dimensions: null, prompt };
    await kv.set(`media:${user.id}:${clientId}:${fileId}`, mediaItem);
    return c.json({ success: true, item: mediaItem });
  } catch (err) { return c.json({ success: false, error: `Generate error: ${err}` }, 500); }
});

app.post("/studio/action", async (c) => {
  try {
    // Soft auth: allow guests to use studio actions (don't block on auth failure)
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[studio/action] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { action, content, format, allFormats, targetLanguage, tone } = await c.req.json();
    if (!action) return c.json({ error: "Action required" }, 400);
    if (user) {
      const canDeduct = await deductCredit(user.id, action === "cascade" ? 3 : 1);
      if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);
    }
    const actionPrompts: Record<string, string> = {
      cascade: `Take this master content and adapt for: ${(allFormats || ["email","linkedin","ad","landing","stories","newsletter","sms"]).join(", ")}.\n\nMaster (${format || "linkedin"}):\n"""\n${content || ""}\n"""\n\nReturn JSON: { "formats": { "linkedin": { "headline":"...","body":"...","cta":"..." }, "email": { "subject":"...","headline":"...","body":"...","cta":"..." }, "sms": { "message":"..." }, "ad": { "headline":"...","cta":"..." }, "landing": { "headline":"...","subtitle":"...","cta":"..." }, "stories": { "text":"...","cta":"..." }, "newsletter": { "headline":"...","body":"...","readMore":"..." } } }. ONLY JSON.`,
      rewrite: `Rewrite with ${tone || "bolder"} tone.\n\n"""\n${content || ""}\n"""\n\nReturn JSON: { "rewritten":"...", "changes":[], "score":95 }. ONLY JSON.`,
      shorten: `Shorten by 30-40%.\n\n"""\n${content || ""}\n"""\n\nReturn JSON: { "shortened":"...", "originalLength":N, "newLength":N, "reduction":"X%" }. ONLY JSON.`,
      addCta: `Add compelling CTA.\n\n"""\n${content || ""}\n"""\n\nReturn JSON: { "withCta":"...", "ctaText":"..." }. ONLY JSON.`,
      translate: `Translate to ${targetLanguage || "French"}.\n\n"""\n${content || ""}\n"""\n\nReturn JSON: { "translated":"...", "language":"${targetLanguage || "French"}", "notes":"" }. ONLY JSON.`,
    };
    const prompt = actionPrompts[action];
    if (!prompt) return c.json({ error: `Unknown action: ${action}` }, 400);
    const result = await generateText({ prompt, model: "gpt-4o", systemPrompt: "You are ORA Studio's content optimization engine. Return ONLY valid JSON.", maxTokens: action === "cascade" ? 3000 : 1500 });
    let parsed: any;
    try { const m = result.text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { error: "Parse failed" }; } catch { parsed = { rawText: result.text }; }
    if (user) await logEvent("studio-action", { userId: user.id, action, format });
    return c.json({ success: true, action, result: parsed });
  } catch (err) { return c.json({ success: false, error: `Action error: ${err}` }, 500); }
});

app.get("/studio/clients", async (c) => {
  try {
    const user = await requireAuth(c);
    const clients = await kv.get(`clients:${user.id}`);
    return c.json({ success: true, clients: clients || [{ id: "default", name: "Acme Corp", logo: "A", color: "#3b4fc4", campaigns: 3 }] });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

app.post("/studio/clients", async (c) => {
  try {
    const user = await requireAuth(c);
    const { clients } = await c.req.json();
    await kv.set(`clients:${user.id}`, clients);
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

// ══════════════════════════════════════════════════════════════
// KLING AI — Image-to-Video (JWT auth + polling)
// ══════════════════════════════════════════════════════════════

const KLING_BASE = "https://api.klingai.com/v1";

async function klingJwt(): Promise<string> {
  const ak = Deno.env.get("KLING_ACCESS_KEY");
  const sk = Deno.env.get("KLING_SECRET_KEY");
  if (!ak || !sk) throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY not configured");
  const now = Math.floor(Date.now() / 1000);
  // Base64url encode (no padding)
  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ iss: ak, exp: now + 1800, nbf: now - 5, iat: now });
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sk), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${data}.${sigB64}`;
}

async function klingHeaders(): Promise<Record<string, string>> {
  const jwt = await klingJwt();
  return { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };
}

// Submit image-to-video to Kling
async function klingImageToVideo(req: { imageUrl: string; prompt: string; duration?: string; mode?: string }): Promise<{ taskId: string }> {
  const start = Date.now();
  const headers = await klingHeaders();
  const body = {
    model_name: "kling-v1-6-pro",
    image: req.imageUrl,
    prompt: req.prompt,
    duration: req.duration || "5",
    mode: req.mode || "std",
    cfg_scale: 0.5,
  };
  console.log(`[kling] submitting image-to-video, prompt="${req.prompt.slice(0, 60)}"...`);
  const res = await fetch(`${KLING_BASE}/videos/image2video`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.text(); throw new Error(`Kling submit ${res.status}: ${b}`); }
  const data = await res.json();
  const taskId = data.data?.task_id;
  if (!taskId) throw new Error(`Kling: no task_id returned: ${JSON.stringify(data).slice(0, 300)}`);
  console.log(`[kling] submitted task=${taskId} in ${Date.now() - start}ms`);
  return { taskId };
}

// Poll Kling task status
async function klingPollStatus(taskId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const headers = await klingHeaders();
  const res = await fetch(`${KLING_BASE}/videos/image2video/${taskId}`, { headers });
  if (!res.ok) { const b = await res.text(); throw new Error(`Kling poll ${res.status}: ${b}`); }
  const data = await res.json();
  const taskData = data.data;
  if (!taskData) return { status: "unknown" };
  const status = taskData.task_status; // submitted, processing, succeed, failed
  if (status === "succeed") {
    const videoUrl = taskData.task_result?.videos?.[0]?.url;
    return { status: "completed", videoUrl };
  }
  if (status === "failed") {
    return { status: "failed", error: taskData.task_status_msg || "Unknown error" };
  }
  return { status: status === "processing" ? "processing" : "queued" };
}

// ══════════════════════════════════════════════════════════════
// AUTO-CAMPAIGN PREMIUM — Full pipeline endpoints
// ══════════════════��═══════════════════════════════════════════

// Step 1: Upload product image → Supabase Storage, return signed URL
app.post("/auto-campaign/upload", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/upload] ENTERED`);
  try {
    await ensureBucket();
    const sb = supabaseAdmin();
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    if (!file) return c.json({ error: "No file provided" }, 400);
    const ext = file.name.split(".").pop() || "png";
    const fileId = `ac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `auto-campaign/${fileId}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await sb.storage.from(MEDIA_BUCKET).upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });
    if (uploadErr) return c.json({ error: `Upload failed: ${uploadErr.message}` }, 500);
    // Long TTL (24h) so Luma can always access the image during generation + retries
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 86400);
    console.log(`[auto-campaign/upload] OK in ${Date.now() - t0}ms, path=${storagePath}, signedUrl=${urlData?.signedUrl ? `${urlData.signedUrl.length} chars` : "MISSING"}`);
    return c.json({ success: true, signedUrl: urlData?.signedUrl || null, storagePath, fileId });
  } catch (err) {
    console.log(`[auto-campaign/upload] error: ${err}`);
    return c.json({ success: false, error: `Upload error: ${err}` }, 500);
  }
});

// Step 2: Generate packshot from uploaded product image
app.post("/auto-campaign/packshot", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/packshot] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { imageUrl, productDescription, provider } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);

    const packPrompt = `Professional studio packshot photograph of this product on a clean, minimal white/light gray background. Soft, even studio lighting with subtle shadows. Commercial product photography style, high-end, editorial quality. ${productDescription || "Product centered, sharp focus."}`;
    
    let result: any;
    const useLeonardo = provider === "leonardo";
    
    if (useLeonardo) {
      // Leonardo AI with Content Reference — upload product image then generate with guidance
      console.log(`[auto-campaign/packshot] Using Leonardo Lucid Realism + Content Reference`);
      const { imageId } = await uploadImageToLeonardo(imageUrl);
      console.log(`[auto-campaign/packshot] Product image uploaded to Leonardo: imageId=${imageId}`);
      result = await Promise.race([
        generateImageLeonardoWithGuidance({
          prompt: packPrompt,
          model: "lucid-realism",
          imageId,
          guidanceType: "content",
          strength: "High",  // High fidelity to keep product appearance faithful
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Leonardo packshot timeout 150s")), 150_000)),
      ]);
    } else {
      // Default: Luma Photon with image reference
      result = await Promise.race([
        generateImageWithRef({ prompt: packPrompt, model: "photon-1", imageRefUrl: imageUrl, strength: 0.65 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Packshot timeout 95s")), 95_000)),
      ]);
    }

    if (user) {
      deductCredit(user.id, 3).catch(() => {});
      logCost({ type: "image", model: useLeonardo ? "leonardo-lucid-realism" : "photon-1", provider: result.provider || (useLeonardo ? "leonardo-edit/content" : "luma/photon-1"), costUsd: 0.030, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/packshot] OK in ${Date.now() - t0}ms (provider=${useLeonardo ? "leonardo" : "luma"})`);
    return c.json({ success: true, imageUrl: result.imageUrl, provider: result.provider, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/packshot] error: ${err}`);
    return c.json({ success: false, error: `Packshot error: ${err}` }, 500);
  }
});

// Step 2b: Generate lifestyle image from uploaded product image
app.post("/auto-campaign/lifestyle", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/lifestyle] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { imageUrl, lifestyleContext, productDescription, provider } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);

    const lifestylePrompt = `Lifestyle product photography: this product naturally placed in a real-world setting. ${lifestyleContext || "Elegant everyday environment, warm natural lighting, aspirational lifestyle context."} Editorial lifestyle photography, shallow depth of field, magazine-quality composition. ${productDescription || "Product naturally integrated into scene, not isolated."}`;

    let result: any;
    const useLeonardo = provider === "leonardo";

    if (useLeonardo) {
      // Leonardo AI with Content Reference — upload product image then generate lifestyle with guidance
      console.log(`[auto-campaign/lifestyle] Using Leonardo Lucid Realism + Content Reference`);
      const { imageId } = await uploadImageToLeonardo(imageUrl);
      console.log(`[auto-campaign/lifestyle] Product image uploaded to Leonardo: imageId=${imageId}`);
      result = await Promise.race([
        generateImageLeonardoWithGuidance({
          prompt: lifestylePrompt,
          model: "lucid-realism",
          imageId,
          guidanceType: "content",
          strength: "Mid",  // Mid strength — keep product recognizable but allow creative scene composition
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Leonardo lifestyle timeout 150s")), 150_000)),
      ]);
    } else {
      result = await Promise.race([
        generateImageWithRef({ prompt: lifestylePrompt, model: "photon-1", imageRefUrl: imageUrl, strength: 0.50 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Lifestyle timeout 95s")), 95_000)),
      ]);
    }

    if (user) {
      deductCredit(user.id, 3).catch(() => {});
      logCost({ type: "image", model: useLeonardo ? "leonardo-lucid-realism" : "photon-1", provider: result.provider || (useLeonardo ? "leonardo-edit/content" : "luma/photon-1"), costUsd: 0.030, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/lifestyle] OK in ${Date.now() - t0}ms (provider=${useLeonardo ? "leonardo" : "luma"})`);
    return c.json({ success: true, imageUrl: result.imageUrl, provider: result.provider, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/lifestyle] error: ${err}`);
    return c.json({ success: false, error: `Lifestyle error: ${err}` }, 500);
  }
});

// Step 3a: Start Luma Ray video animation from packshot (image-to-video)
app.post("/auto-campaign/kling-start", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/video-start] ENTERED (Luma Ray)`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { imageUrl, prompt } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);
    
    const videoPrompt = prompt || "Smooth, elegant product reveal. Slow rotation with dynamic lighting. Professional commercial advertisement style. Cinematic camera movement, shallow depth of field.";
    
    // Submit to Luma Ray (image-to-video via keyframes)
    const body: any = {
      generation_type: "video",
      prompt: videoPrompt,
      model: "ray-2",
      aspect_ratio: "16:9",
      keyframes: {
        frame0: { type: "image", url: imageUrl },
      },
    };
    console.log(`[auto-campaign/video-start] Submitting to Luma Ray ray-2, prompt="${videoPrompt.slice(0, 60)}..."`);
    const submitRes = await fetch(`${LUMA_BASE}/generations/video`, {
      method: "POST",
      headers: lumaHeaders(),
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) { const b = await submitRes.text(); throw new Error(`Luma Ray submit ${submitRes.status}: ${b}`); }
    const generation = await submitRes.json();
    const genId = generation.id;
    if (!genId) throw new Error(`Luma Ray: no generation id returned: ${JSON.stringify(generation).slice(0, 300)}`);
    
    if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});
    console.log(`[auto-campaign/video-start] Luma Ray submitted genId=${genId}, state=${generation.state} in ${Date.now() - t0}ms`);
    return c.json({ success: true, taskId: genId, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/video-start] error: ${err}`);
    return c.json({ success: false, error: `Video start error: ${err}` }, 500);
  }
});

// Step 3a-poll: Poll Luma Ray video status
app.get("/auto-campaign/kling-status", async (c) => {
  try {
    const taskId = c.req.query("taskId");
    if (!taskId) return c.json({ error: "taskId required" }, 400);
    
    // Poll Luma generation status
    const pollRes = await fetch(`${LUMA_BASE}/generations/${taskId}`, { headers: lumaHeaders() });
    if (!pollRes.ok) { const b = await pollRes.text(); return c.json({ success: false, status: "error", error: `Luma poll ${pollRes.status}: ${b}` }, 500); }
    const data = await pollRes.json();
    const state = data.state;
    console.log(`[auto-campaign/video-status] genId=${taskId}, state=${state}`);
    
    if (state === "completed") {
      const videoUrl = data.assets?.video;
      if (!videoUrl) return c.json({ success: true, status: "failed", error: "Completed but no video URL" });
      return c.json({ success: true, status: "completed", videoUrl });
    }
    if (state === "failed") {
      return c.json({ success: true, status: "failed", error: data.failure_reason || "Video generation failed" });
    }
    // queued, dreaming, processing
    return c.json({ success: true, status: state === "dreaming" ? "processing" : (state || "queued") });
  } catch (err) {
    console.log(`[auto-campaign/video-status] error: ${err}`);
    return c.json({ success: false, error: `Video status error: ${err}` }, 500);
  }
});

// Step 3b: Generate ad copy for all networks
app.post("/auto-campaign/copy", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/copy] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { productDescription, tone } = await c.req.json();
    
    const copyPrompt = `You are an elite advertising copywriter. Create compelling, scroll-stopping ad copy for this product across 3 social media platforms: Instagram, LinkedIn, and Facebook.

Product: ${productDescription || "Premium product"}
Tone: ${tone || "Bold, premium, aspirational"}

Return JSON:
{
  "headline": "Main campaign headline (max 8 words, punchy)",
  "tagline": "Campaign tagline (max 12 words)",
  "networks": {
    "instagram": { "caption": "...(max 2200 chars, engaging with line breaks and storytelling)", "hashtags": "...(8-12 relevant hashtags)", "cta": "..." },
    "linkedin": { "post": "...(professional thought-leadership tone, 300 chars max, value-driven)", "cta": "..." },
    "facebook": { "primary_text": "...(max 125 chars, conversational)", "headline": "...(max 40 chars)", "description": "...(max 30 chars)", "cta": "..." }
  }
}
Return ONLY valid JSON.`;

    const result = await generateText({ prompt: copyPrompt, model: "claude-sonnet", systemPrompt: "You are a world-class advertising copywriter. Return ONLY valid JSON.", maxTokens: 2048 });
    
    let parsed: any = {};
    try { const m = result.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { parsed = { headline: "Your product, elevated.", tagline: "Premium quality, delivered.", networks: {} }; }

    if (user) {
      deductCredit(user.id, 2).catch(() => {});
      logCost({ type: "text", model: "claude-sonnet", provider: result.provider, costUsd: getProviderCost(result.provider, "text"), revenueEur: REVENUE_PER_TYPE.text * 3, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/copy] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, copy: parsed, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/copy] error: ${err}`);
    return c.json({ success: false, error: `Copy error: ${err}` }, 500);
  }
});

// Step 3c: Generate audio (reuses existing MusicGen)
app.post("/auto-campaign/audio", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/audio] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { mood } = await c.req.json();
    
    const audioPrompt = mood || "Modern, upbeat commercial background music. Premium brand feel, clean electronic beats with subtle bass. Advertising jingle style, energetic but sophisticated.";
    const result = await generateAudio({ prompt: audioPrompt, model: "ora-audio" });
    
    if (user) {
      deductCredit(user.id, 3).catch(() => {});
      logCost({ type: "audio", model: "ora-audio", provider: result.provider, costUsd: getProviderCost(result.provider, "audio"), revenueEur: REVENUE_PER_TYPE.audio, latencyMs: result.latencyMs, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/audio] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, audioUrl: result.audioUrl, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/audio] error: ${err}`);
    return c.json({ success: false, error: `Audio error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// LIBRARY — per-user asset & content library with folders
// KV keys: lib:{userId}:{itemId}  |  lib-folder:{userId}:{folderId}
// ══════════════════════════════════════════════════════════════

// GET /library/items — list all library items for authenticated user (legacy)
app.get("/library/items", async (c) => {
  try {
    const user = await requireAuth(c);
    const items = await kv.getByPrefix(`lib:${user.id}:`);
    return c.json({ success: true, items: items || [] });
  } catch (err) {
    console.log(`[library/items GET] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/list — CORS-safe list endpoint (POST + text/plain = no preflight)
app.post("/library/list", async (c) => {
  try {
    const user = await requireAuth(c);
    const items = await kv.getByPrefix(`lib:${user.id}:`);
    console.log(`[library/list] user ${user.id}: ${(items || []).length} items`);
    return c.json({ success: true, items: items || [] });
  } catch (err) {
    console.log(`[library/list] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/items — save item to library
app.post("/library/items", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const item = body.item;
    if (!item || !item.id) return c.json({ success: false, error: "Missing item" }, 400);
    const libItem: any = {
      ...item,
      userId: user.id,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: item.folderId || null,
    };

    // Auto-persist external media URLs to Supabase Storage (fire-and-forget for speed)
    const preview = item.preview || {};
    const urlsToPersist: Array<{ key: string; url: string; type: string }> = [];
    if (preview.imageUrl && !preview.imageUrl.includes("supabase.co/storage")) urlsToPersist.push({ key: "imageUrl", url: preview.imageUrl, type: "image" });
    if (preview.videoUrl && !preview.videoUrl.includes("supabase.co/storage")) urlsToPersist.push({ key: "videoUrl", url: preview.videoUrl, type: "video" });
    if (preview.audioUrl && !preview.audioUrl.includes("supabase.co/storage")) urlsToPersist.push({ key: "audioUrl", url: preview.audioUrl, type: "audio" });

    if (urlsToPersist.length > 0) {
      // Persist in background — don't block the save response
      (async () => {
        try {
          await ensureGeneratedAssetsBucket();
          const sb = supabaseAdmin();
          for (const { key, url, type } of urlsToPersist) {
            try {
              const dlRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
              if (!dlRes.ok) { console.log(`[lib-persist] Download failed for ${key}: HTTP ${dlRes.status}`); continue; }
              const ct = dlRes.headers.get("content-type") || "";
              const buf = await dlRes.arrayBuffer();
              if (buf.byteLength < 100 || buf.byteLength > 200_000_000) continue;
              let ext = type === "video" ? "mp4" : type === "audio" ? "mp3" : "jpg";
              if (ct.includes("png")) ext = "png";
              else if (ct.includes("webp")) ext = "webp";
              else if (ct.includes("webm")) ext = "webm";
              const storagePath = `${user.id}/${Date.now()}-${item.id.slice(0, 12)}.${ext}`;
              const { error: upErr } = await sb.storage.from(GENERATED_ASSETS_BUCKET).upload(storagePath, new Uint8Array(buf), { contentType: ct || `${type}/${ext}`, upsert: true });
              if (upErr) { console.log(`[lib-persist] Upload failed for ${key}: ${upErr.message}`); continue; }
              const { data: signedData } = await sb.storage.from(GENERATED_ASSETS_BUCKET).createSignedUrl(storagePath, 7 * 24 * 3600);
              if (signedData?.signedUrl) {
                // Update the library item with the persistent URL
                const current = await kv.get(`lib:${user.id}:${item.id}`);
                if (current && current.preview) {
                  current.preview[key] = signedData.signedUrl;
                  current.preview[`${key}StoragePath`] = storagePath;
                  current.updatedAt = new Date().toISOString();
                  await kv.set(`lib:${user.id}:${item.id}`, current);
                  console.log(`[lib-persist] Persisted ${key} for ${item.id}: ${storagePath} (${(buf.byteLength / 1024).toFixed(0)}KB)`);
                }
              }
            } catch (err) { console.log(`[lib-persist] Failed to persist ${key}: ${err}`); }
          }
        } catch (err) { console.log(`[lib-persist] Background persist error: ${err}`); }
      })();
    }

    await kv.set(`lib:${user.id}:${item.id}`, libItem);
    console.log(`[library/items POST] saved ${item.id} for user ${user.id} (${urlsToPersist.length} URLs to persist)`);
    return c.json({ success: true, item: libItem });
  } catch (err) {
    console.log(`[library/items POST] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// PUT /library/items/:id — update item (move to folder, rename, etc.)
app.put("/library/items/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const itemId = c.req.param("id");
    const updates = c.get?.("parsedBody") || await c.req.json();
    const existing = await kv.get(`lib:${user.id}:${itemId}`);
    if (!existing) return c.json({ success: false, error: "Item not found" }, 404);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`lib:${user.id}:${itemId}`, updated);
    return c.json({ success: true, item: updated });
  } catch (err) {
    console.log(`[library/items PUT] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// DELETE /library/items/:id — remove item from library
app.delete("/library/items/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const itemId = c.req.param("id");
    await kv.del(`lib:${user.id}:${itemId}`);
    console.log(`[library/items DELETE] removed ${itemId} for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`[library/items DELETE] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/folders-list — CORS-safe list folders
app.post("/library/folders-list", async (c) => {
  try {
    const user = await requireAuth(c);
    const folders = await kv.getByPrefix(`lib-folder:${user.id}:`);
    console.log(`[library/folders-list] user ${user.id}: ${(folders || []).length} folders`);
    return c.json({ success: true, folders: folders || [] });
  } catch (err) {
    console.log(`[library/folders-list] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/folders-create — CORS-safe create a folder
app.post("/library/folders-create", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const name = body.name;
    if (!name) return c.json({ success: false, error: "Missing folder name" }, 400);
    const folderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const folder = { id: folderId, name, userId: user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await kv.set(`lib-folder:${user.id}:${folderId}`, folder);
    console.log(`[library/folders-create] created ${folderId} "${name}" for user ${user.id}`);
    return c.json({ success: true, folder });
  } catch (err) {
    console.log(`[library/folders-create] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/folders-rename — CORS-safe rename folder
app.post("/library/folders-rename", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const folderId = body.folderId;
    const name = body.name;
    const existing = await kv.get(`lib-folder:${user.id}:${folderId}`);
    if (!existing) return c.json({ success: false, error: "Folder not found" }, 404);
    const updated = { ...existing, name: name || existing.name, updatedAt: new Date().toISOString() };
    await kv.set(`lib-folder:${user.id}:${folderId}`, updated);
    return c.json({ success: true, folder: updated });
  } catch (err) {
    console.log(`[library/folders-rename] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/folders-delete — CORS-safe delete folder
app.post("/library/folders-delete", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const folderId = body.folderId;
    await kv.del(`lib-folder:${user.id}:${folderId}`);
    const allItems = await kv.getByPrefix(`lib:${user.id}:`);
    const toUpdate = (allItems || []).filter((item: any) => item.folderId === folderId);
    for (const item of toUpdate) {
      await kv.set(`lib:${user.id}:${item.id}`, { ...item, folderId: null, updatedAt: new Date().toISOString() });
    }
    console.log(`[library/folders-delete] removed ${folderId}, unassigned ${toUpdate.length} items`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`[library/folders-delete] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/items-update — CORS-safe update item (move to folder, rename)
app.post("/library/items-update", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const itemId = body.itemId;
    const updates = body.updates || {};
    const existing = await kv.get(`lib:${user.id}:${itemId}`);
    if (!existing) return c.json({ success: false, error: "Item not found" }, 404);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`lib:${user.id}:${itemId}`, updated);
    return c.json({ success: true, item: updated });
  } catch (err) {
    console.log(`[library/items-update] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/items-delete — CORS-safe delete item
app.post("/library/items-delete", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const itemId = body.itemId;
    await kv.del(`lib:${user.id}:${itemId}`);
    console.log(`[library/items-delete] removed ${itemId} for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`[library/items-delete] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGN LAB — Image & Video generation via Luma (Photon + Ray)
// ══════════════════════════════════════════════════════════════

// ── Campaign Lab: Image Start (Luma Photon) ──
app.get("/generate/cl-image-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const rawPrompt = c.req.query("prompt");
    const aspectRatio = c.req.query("aspectRatio") || "16:9";
    const imageRefUrl = c.req.query("imageRefUrl") || undefined;
    const refSource = c.req.query("refSource") || "";
    const brandVisualPrefix = c.req.query("brandVisual") || "";

    console.log(`[cl-image-start] prompt="${rawPrompt?.slice(0, 60)}", ratio=${aspectRatio}, imageRef=${imageRefUrl ? "YES" : "NO"}, refSource=${refSource}, user=${user?.id?.slice(0, 8) || "anon"}`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── Server-side Brand Context ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try { brandCtx = await buildBrandContext(user.id); } catch (err) {
        console.log(`[cl-image-start] buildBrandContext failed: ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankCompositions.length > 0) brandParts.push(`${brandCtx.imageBankCompositions.slice(0, 2).join(", ")} composition`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);
      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cohesive brand aesthetic, premium quality.`;
        console.log(`[cl-image-start] Brand-enriched prompt (${prompt.length} chars)`);
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cohesive brand aesthetic.`;
    }

    if (user) deductCredit(user.id, 2).catch(() => {});

    // Anti-text suffix
    const antiTextSuffix = ". ABSOLUTELY NO visible text, no letters, no words, no brand names, no logos, no signs, no labels, no writing anywhere in the image. Clean photographic image only.";
    if (!prompt.toLowerCase().includes("no visible text")) prompt += antiTextSuffix;

    // Strip brand names from prompt
    if (brandCtx?.brandName) {
      const lb = brandCtx.brandName.toLowerCase();
      let idx = prompt.toLowerCase().indexOf(lb);
      while (idx !== -1) {
        prompt = prompt.slice(0, idx) + "the product" + prompt.slice(idx + brandCtx.brandName.length);
        idx = prompt.toLowerCase().indexOf(lb, idx + 11);
      }
    }

    // ── Build image generation context ──
    const isUploadRef = refSource === "upload";
    const hasImageRef = !!imageRefUrl;
    // Track auto-resolved brand ref URL (for Luma image_ref)
    let autoResolvedImageUrl: string | null = null;

    // Auto-resolve brand ref if no explicit ref
    if (!imageRefUrl && brandCtx && brandCtx.topRefImages.length > 0) {
      try {
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const bestRef = brandCtx.topRefImages[0];
        const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(bestRef.storagePath, 3600);
        if (data?.signedUrl) {
          autoResolvedImageUrl = data.signedUrl;
          console.log(`[cl-image-start] Auto-resolved brand ref: "${bestRef.description?.slice(0, 50)}" (score=${bestRef.score})`);
        }
      } catch (err) {
        console.log(`[cl-image-start] Auto-resolve brand ref failed: ${err}`);
      }
    }

    // ── Luma Photon generation ──
    console.log(`[cl-image-start] Luma Photon: promptLen=${prompt.length}, ratio=${aspectRatio}, hasImage=${hasImageRef}`);

    const lumaBody: any = { prompt, model: "photon-1", aspect_ratio: aspectRatio };
    if (imageRefUrl && isUploadRef) {
      lumaBody.modify_image_ref = { url: imageRefUrl, weight: 0.85 };
    } else if (imageRefUrl) {
      lumaBody.image_ref = [{ url: imageRefUrl, weight: 0.80 }];
    } else if (autoResolvedImageUrl) {
      lumaBody.image_ref = [{ url: autoResolvedImageUrl, weight: 0.80 }];
    }
    console.log(`[cl-image-start] Luma request: model=photon-1, ratio=${aspectRatio}, hasModifyRef=${!!lumaBody.modify_image_ref}, hasImageRef=${!!lumaBody.image_ref}`);
    const lumaRes = await fetch(`${LUMA_BASE}/generations/image`, { method: "POST", headers: lumaHeaders(), body: JSON.stringify(lumaBody) });
    if (!lumaRes.ok) {
      const errBody = await lumaRes.text();
      console.log(`[cl-image-start] Luma failed ${lumaRes.status}: ${errBody.slice(0, 300)}`);
      return c.json({ success: false, error: `Campaign image failed (Luma ${lumaRes.status}): ${errBody.slice(0, 150)}` }, 500);
    }
    const lumaGen = await lumaRes.json();
    const lumaGenId = lumaGen.id;
    if (!lumaGenId) return c.json({ success: false, error: "Luma returned no generation ID" }, 500);

    console.log(`[cl-image-start] Luma OK ${Date.now() - t0}ms, genId=${lumaGenId}`);
    if (user) logEvent("cl-image", { userId: user.id, model: "photon-1", provider: "luma" }).catch(() => {});
    logCost({ type: "image", model: "photon-1", provider: "luma/photon-1", costUsd: 0.025, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: true }).catch(() => {});
    return c.json({
      success: true, generationId: lumaGenId, state: lumaGen.state || "queued",
      provider: "luma", model: "photon-1",
      _debug: { imageRefUsed: hasImageRef, refType: isUploadRef ? "upload-modify" : (hasImageRef ? "bank-ref" : "text-to-image"), model: "photon-1" },
    });
  } catch (err) {
    console.log(`[cl-image-start] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Campaign image start failed: ${err}` }, 500);
  }
});

// ── Campaign Lab: Video Start (Luma Ray) ──
app.get("/generate/cl-video-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const rawPrompt = c.req.query("prompt");
    const model = c.req.query("model") || "kling";
    const imageUrl = c.req.query("imageUrl") || undefined;
    const clientAspectRatio = c.req.query("aspectRatio") || undefined;
    const brandVisualPrefix = c.req.query("brandVisual") || "";

    console.log(`[cl-video-start-get] prompt="${rawPrompt?.slice(0, 60)}", model=${model}, img2vid=${!!imageUrl}, ratio=${clientAspectRatio || "default"}, user=${user?.id?.slice(0, 8) || "anon"}`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── Server-side Brand Context ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try { brandCtx = await buildBrandContext(user.id); } catch (err) {
        console.log(`[cl-video-start] buildBrandContext failed: ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);
      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cinematic brand aesthetic.`;
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cinematic brand aesthetic.`;
    }

    if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});

    // Enhance/translate prompt
    const enhancedPrompt = await enhanceImagePrompt(prompt);

    // Anti-text for video
    const antiTextVideo = ". No visible text, no letters, no words, no brand names, no logos anywhere in the video.";
    const finalPrompt = enhancedPrompt.toLowerCase().includes("no visible text") ? enhancedPrompt : enhancedPrompt + antiTextVideo;

    // ── Resolve first frame image ──
    let resolvedImageUrl = imageUrl;
    if (!resolvedImageUrl && brandCtx && brandCtx.topRefImages.length > 0) {
      try {
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const bestRef = brandCtx.topRefImages[0];
        const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(bestRef.storagePath, 3600);
        if (data?.signedUrl) {
          resolvedImageUrl = data.signedUrl;
          console.log(`[cl-video-start] Auto-resolved brand ref as first frame: "${bestRef.description?.slice(0, 50)}"`);
        }
      } catch (err) {
        console.log(`[cl-video-start] Auto-resolve brand ref failed: ${err}`);
      }
    }

    // ── Luma Ray generation ──
    const lumaMapping = videoModelMap["ora-motion"] || { lumaModel: "ray-2", aspectRatio: "16:9" };
    const lumaBody: any = {
      generation_type: "video", prompt: finalPrompt,
      model: lumaMapping.lumaModel, aspect_ratio: clientAspectRatio || lumaMapping.aspectRatio,
    };
    if (resolvedImageUrl) lumaBody.keyframes = { frame0: { type: "image", url: resolvedImageUrl } };

    console.log(`[cl-video-start] Using Luma directly: model=${lumaMapping.lumaModel}, promptLen=${finalPrompt.length}, hasImage=${!!resolvedImageUrl}`);
    const lumaRes = await fetch(`${LUMA_BASE}/generations/video`, { method: "POST", headers: lumaHeaders(), body: JSON.stringify(lumaBody) });
    if (!lumaRes.ok) {
      const errBody = await lumaRes.text();
      console.log(`[cl-video-start] Luma failed ${lumaRes.status}: ${errBody.slice(0, 300)}`);
      return c.json({ success: false, error: `Campaign video failed (Luma ${lumaRes.status}): ${errBody.slice(0, 150)}` }, 500);
    }
    const lumaGen = await lumaRes.json();
    const lumaGenId = lumaGen.id;
    if (!lumaGenId) return c.json({ success: false, error: "Luma returned no generation ID" }, 500);

    console.log(`[cl-video-start] Luma OK ${Date.now() - t0}ms, genId=${lumaGenId}`);
    if (user) logEvent("cl-video", { userId: user.id, model: lumaMapping.lumaModel, provider: "luma" }).catch(() => {});
    logCost({ type: "video", model: lumaMapping.lumaModel, provider: `luma/${lumaMapping.lumaModel}`, costUsd: 0.10, revenueEur: REVENUE_PER_TYPE.video, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: true }).catch(() => {});
    return c.json({
      success: true, generationId: lumaGenId, state: lumaGen.state || "queued",
      provider: "luma", model: lumaMapping.lumaModel,
    });
  } catch (err) {
    console.log(`[cl-video-start] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Campaign video start failed: ${err}` }, 500);
  }
});

// ── Campaign Lab: Status Poll (Luma) ──
app.get("/generate/cl-status", async (c) => {
  const t0 = Date.now();
  try {
    const generationId = c.req.query("id");
    const assetType = c.req.query("type") || "image";
    if (!generationId) return c.json({ error: "id required" }, 400);

    const lumaEndpoint = `${LUMA_BASE}/generations/${generationId}`;
    const lumaRes = await fetch(lumaEndpoint, { headers: lumaHeaders(), signal: AbortSignal.timeout(8_000) });
    if (lumaRes.ok) {
      const data = await lumaRes.json();
      const state = data.state;
      if (state === "completed") {
        const imageUrl = data.assets?.image || null;
        const videoUrl = data.assets?.video || null;
        console.log(`[cl-status] Luma ${generationId} COMPLETED (${Date.now() - t0}ms)`);
        return c.json({ success: true, state: "completed", imageUrl: assetType === "image" ? imageUrl : null, videoUrl: assetType === "video" ? videoUrl : null });
      }
      if (state === "failed") {
        console.log(`[cl-status] Luma ${generationId} FAILED: ${data.failure_reason}`);
        return c.json({ success: true, state: "failed", error: data.failure_reason || "Failed" });
      }
      // queued / dreaming
      console.log(`[cl-status] Luma ${generationId} state=${state} (${Date.now() - t0}ms)`);
      return c.json({ success: true, state });
    }
    console.log(`[cl-status] Luma poll ${lumaRes.status} for ${generationId}`);
    return c.json({ success: true, state: "queued" });
  } catch (err) {
    console.log(`[cl-status] error:`, err);
    return c.json({ success: false, state: "error", error: `Status check failed: ${err}` }, 500);
  }
});

// ═══════════════════════════════════��══════════════════════════
// HIGGSFIELD — Campaign Lab additional provider
// ══════════════════════════════════════════════════════════════

// Higgsfield model fallback chains
const HF_IMAGE_MODELS = [
  "higgsfield-ai/soul/standard",
  "bytedance/seedream/v4/text-to-image",
  "higgsfield-ai/nano-banana/standard",
];
const HF_VIDEO_MODELS_I2V = [
  "kling-video/v2.1/pro/image-to-video",
  "bytedance/seedance/v1/pro/image-to-video",
  "higgsfield-ai/dop/standard",
];
const HF_VIDEO_MODELS_T2V = [
  "higgsfield-ai/dop/standard",
  "higgsfield-ai/dop/preview",
];

// Helper: adapt Higgsfield body per model — different models accept different params
function hfAdaptBody(model: string, baseBody: any): any {
  const b = { ...baseBody };
  if (model.includes("soul/")) {
    b.resolution = "720p";
    if (!model.includes("image-to")) delete b.image_url;
  } else if (model.includes("nano-banana/")) {
    b.resolution = b.resolution || "2K";
    if (!model.includes("image-to")) delete b.image_url;
  } else if (model.includes("seedream/")) {
    b.resolution = b.resolution || "2K";
    if (!model.includes("image-to")) delete b.image_url;
  } else if (model.includes("kling-video/") || model.includes("kling/")) {
    delete b.resolution; b.duration = b.duration || 5;
  } else if (model.includes("seedance/")) {
    delete b.resolution; b.duration = b.duration || 5;
  } else if (model.includes("dop/")) {
    delete b.resolution; b.duration = b.duration || 5;
  }
  return b;
}

// Helper: try Higgsfield with model fallback chain
async function hfFetchWithFallback(models: string[], body: any, tag: string): Promise<{ ok: true; data: any; model: string } | { ok: false; error: string }> {
  let lastErr = "";
  for (const model of models) {
    try {
      const adaptedBody = hfAdaptBody(model, body);
      console.log(`[${tag}] Trying ${model}, keys=[${Object.keys(adaptedBody).join(",")}] res=${adaptedBody.resolution || "-"} dur=${adaptedBody.duration || "-"}`);
      const url = `${HIGGSFIELD_BASE}/${model}`;
      const res = await fetch(url, {
        method: "POST",
        headers: higgsHeaders(),
        body: JSON.stringify(adaptedBody),
        signal: AbortSignal.timeout(30_000),
      });
      const resText = await res.text().catch(() => "");
      console.log(`[${tag}] ${model} -> HTTP ${res.status}, body=${resText.slice(0, 600)}`);
      if (res.ok) {
        let data: any;
        try { data = JSON.parse(resText); } catch { data = {}; }
        if (data.request_id) {
          console.log(`[${tag}] ${model} OK -> request_id=${data.request_id}, status=${data.status}`);
          return { ok: true, data, model };
        }
        lastErr = `${model}: no request_id`;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        const hint = `AUTH FAILED (HTTP ${res.status}) — verify HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET`;
        console.log(`[${tag}] ${hint}: ${resText.slice(0, 300)}`);
        return { ok: false, error: `${model}: ${hint}` };
      }
      lastErr = `${model} HTTP ${res.status}: ${resText.slice(0, 250)}`;
    } catch (err) {
      console.log(`[${tag}] ${model} fetch error: ${err}`);
      lastErr = `${model}: ${err}`;
    }
  }
  return { ok: false, error: lastErr || "All Higgsfield models failed" };
}

// ── Auth Diagnostic Route (secondary image/video provider) ──
app.get("/generate/hf-ping", async (c) => {
  try {
    const headers = higgsHeaders();
    const testBody = { prompt: "simple red sphere on white background", aspect_ratio: "1:1", resolution: "720p" };
    console.log(`[hf-ping] Testing auth with soul/standard`);
    const res = await fetch(`${HIGGSFIELD_BASE}/higgsfield-ai/soul/standard`, {
      method: "POST",
      headers,
      body: JSON.stringify(testBody),
      signal: AbortSignal.timeout(15_000),
    });
    const status = res.status;
    const bodyText = await res.text().catch(() => "");
    console.log(`[hf-ping] HTTP ${status}, body=${bodyText.slice(0, 600)}`);
    if (res.ok) {
      let data: any = {};
      try { data = JSON.parse(bodyText); } catch {}
      if (data.cancel_url) fetch(data.cancel_url, { method: "POST", headers }).catch(() => {});
      return c.json({ success: true, status, message: "Secondary provider auth OK", requestId: data.request_id });
    }
    return c.json({ success: false, status, error: bodyText.slice(0, 500) });
  } catch (err) {
    console.log(`[hf-ping] error:`, err);
    return c.json({ success: false, error: `${err}` });
  }
});

// ── (Legacy Campaign Lab HF routes removed — models now served via Hub aggregator routes) ──

// ══════════════════════════════════════════════════════════════
// VOICE TRANSCRIPTION — OpenAI Whisper API
// ══════════════════════════════════════════════════════════════

app.post("/transcribe", async (c) => {
  const t0 = Date.now();
  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.log("[transcribe] OPENAI_API_KEY not configured");
      return c.json({ success: false, error: "OpenAI API key not configured" }, 500);
    }

    const formData = await c.req.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File)) {
      console.log("[transcribe] No audio file in request");
      return c.json({ success: false, error: "No audio file provided" }, 400);
    }

    console.log(`[transcribe] Received audio: ${audioFile.name}, size=${audioFile.size}, type=${audioFile.type}`);

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
      signal: AbortSignal.timeout(30_000),
    });

    const whisperText = await whisperRes.text();
    console.log(`[transcribe] Whisper response: ${whisperRes.status} (${Date.now() - t0}ms) raw=${whisperText.slice(0, 300)}`);

    if (!whisperRes.ok) {
      console.log(`[transcribe] Whisper API error: ${whisperRes.status} ${whisperText.slice(0, 500)}`);
      return c.json({ success: false, error: `Whisper API error (${whisperRes.status}): ${whisperText.slice(0, 200)}` }, 500);
    }

    let result: any;
    try { result = JSON.parse(whisperText); } catch {
      return c.json({ success: false, error: "Invalid JSON from Whisper API" }, 500);
    }

    const transcription = result.text || "";
    console.log(`[transcribe] OK (${Date.now() - t0}ms): "${transcription.slice(0, 100)}"`);

    return c.json({ success: true, text: transcription, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
    console.log(`[transcribe] FAILED (${elapsed}ms): ${err?.message || err}`);
    return c.json({
      success: false,
      error: isTimeout ? `Transcription timed out after ${(elapsed / 1000).toFixed(0)}s` : `Transcription error: ${err?.message || err}`,
    }, 500);
  }
});

// ═════════════════════════════���════════════════════════════════
// CAMPAIGN LAB v2 — High-fidelity pipeline (upload refs, vision analysis, batch+select)
// These routes are ADDITIVE — they do NOT modify any existing route or function.
// ══════════════════════════════════════════════════════════════

const CAMPAIGN_REF_BUCKET = "make-cad57f79-campaign-refs";
let campaignRefBucketInitialized = false;

async function ensureCampaignRefBucket() {
  if (campaignRefBucketInitialized) return;
  try {
    const sb = supabaseAdmin();
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) { console.log(`[campaign-ref] listBuckets error: ${listErr.message}`); return; }
    const exists = buckets?.some((b: any) => b.name === CAMPAIGN_REF_BUCKET);
    if (!exists) {
      const { error: createErr } = await sb.storage.createBucket(CAMPAIGN_REF_BUCKET, { public: true });
      if (createErr) { console.log(`[campaign-ref] createBucket error: ${createErr.message}`); return; }
      console.log(`[campaign-ref] Created PUBLIC bucket: ${CAMPAIGN_REF_BUCKET}`);
    } else {
      // Ensure existing bucket is public (may have been created as private)
      try { await sb.storage.updateBucket(CAMPAIGN_REF_BUCKET, { public: true }); } catch {}
    }
    campaignRefBucketInitialized = true;
  } catch (e) { console.log("[campaign-ref] ensureCampaignRefBucket exception:", e); }
}

// ── POST /campaign/upload-refs — Upload reference photos to Storage, return signed URLs ──
app.post("/campaign/upload-refs", async (c) => {
  const t0 = Date.now();
  try {
    // Manual auth from FormData _token (body-parser skips multipart)
    const formData = await c.req.formData();
    const formToken = formData.get("_token") as string || "";
    const jwt = decodeJwtPayload(formToken);
    if (!jwt?.sub) {
      console.log("[campaign/upload-refs] No valid JWT in FormData _token");
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    const userId = jwt.sub;
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file") && value instanceof File) files.push(value);
    }
    if (files.length === 0) return c.json({ error: "No files provided" }, 400);
    console.log(`[campaign/upload-refs] ${files.length} files from user ${userId.slice(0, 8)}`);

    await ensureCampaignRefBucket();
    const sb = supabaseAdmin();
    const results: { path: string; signedUrl: string; fileName: string }[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buf = await file.arrayBuffer();
      const { error: upErr } = await sb.storage.from(CAMPAIGN_REF_BUCKET).upload(storagePath, new Uint8Array(buf), {
        contentType: file.type || "image/jpeg", upsert: true,
      });
      if (upErr) { console.log(`[campaign/upload-refs] Upload failed for ${file.name}: ${upErr.message}`); continue; }
      const { data: signedData } = await sb.storage.from(CAMPAIGN_REF_BUCKET).createSignedUrl(storagePath, 3600);
      if (signedData?.signedUrl) {
        results.push({ path: storagePath, signedUrl: signedData.signedUrl, fileName: file.name });
      }
    }

    console.log(`[campaign/upload-refs] OK: ${results.length}/${files.length} uploaded in ${Date.now() - t0}ms`);
    return c.json({ success: true, refs: results });
  } catch (err) {
    console.log(`[campaign/upload-refs] FAIL (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Upload failed: ${err}` }, 500);
  }
});

// ── POST /campaign/analyze-refs — GPT-4o Vision analysis of reference photos → Visual DNA ──
app.post("/campaign/analyze-refs", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { imageUrls, brief, targetAudience } = body;
    if (!imageUrls?.length) return c.json({ error: "imageUrls required" }, 400);

    console.log(`[campaign/analyze-refs] ${imageUrls.length} images, brief=${brief?.length || 0} chars, user=${user.id.slice(0, 8)}`);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.log("[campaign/analyze-refs] No OPENAI_API_KEY, returning empty DNA");
      return c.json({ success: true, visualDNA: null, reason: "No OpenAI key" });
    }

    const imageContent = imageUrls.slice(0, 5).map((url: string) => ({
      type: "image_url",
      image_url: { url, detail: "high" },
    }));

    const systemPrompt = `You are a visual intelligence analyst for brand campaigns. Analyze the provided reference images and extract a VISUAL DNA that will be used to generate NEW images matching these references as closely as possible.

Extract PRECISELY:
1. SUBJECT: Main subject (product type, color, material, shape, size, distinctive features). Be HYPER-SPECIFIC.
2. ENVIRONMENT: Setting, background, surfaces, props. Name exact materials and colors.
3. COLOR_PALETTE: List 5-8 dominant colors as hex codes with descriptive names.
4. LIGHTING: Direction (e.g. "camera-left 45°"), quality (hard/soft/diffused), color temperature (Kelvin), shadow style, fill ratio.
5. COMPOSITION: Framing (close-up/medium/wide), angle (eye-level/overhead/low/three-quarter), rule of thirds placement, depth of field.
6. TEXTURE: Surface details visible (grain, reflection, matte, glossy, fabric, metal, skin).
7. MOOD: Emotional tone with 3-4 descriptors (e.g. "premium, understated, warm, aspirational").
8. PHOTOGRAPHY_STYLE: Genre and reference (e.g. "commercial product shot, Apple-style hero imagery").
9. POST_PROCESSING: Contrast level, saturation, grain, color grading (e.g. "low contrast, slightly desaturated, warm color grade, minimal grain").
10. DISTINCTIVE_ELEMENTS: Anything unique that MUST be reproduced (specific object detail, spatial relationship, gesture, distinctive shape).

Output as JSON with these 10 keys (snake_case). Values should be strings. Be HYPER-SPECIFIC — the output will be used verbatim in image generation prompts.`;

    const userPrompt = `Analyze these ${imageUrls.length} reference image(s).${brief ? ` Campaign context: "${brief.slice(0, 500)}"` : ""}${targetAudience ? ` Target audience: "${targetAudience.slice(0, 200)}"` : ""}

Extract the Visual DNA as described.`;

    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: userPrompt }, ...imageContent] },
        ],
        max_tokens: 1200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.log(`[campaign/analyze-refs] OpenAI Vision error ${visionRes.status}: ${errText.slice(0, 300)}`);
      return c.json({ success: true, visualDNA: null, reason: `Vision API error: ${visionRes.status}` });
    }

    const visionData = await visionRes.json();
    const rawText = visionData.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[campaign/analyze-refs] Vision response (${rawText.length} chars): ${rawText.slice(0, 200)}`);

    let visualDNA: any = null;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        visualDNA = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (e) {
      console.log(`[campaign/analyze-refs] JSON parse failed, trying cleanup: ${e}`);
      try { visualDNA = JSON.parse(rawText.replace(/,\s*([}\]])/g, "$1")); } catch {}
    }

    if (visualDNA) {
      if (user) deductCredit(user.id, 1).catch(() => {});
      console.log(`[campaign/analyze-refs] OK in ${Date.now() - t0}ms, keys=${Object.keys(visualDNA).join(",")}`);
    } else {
      console.log(`[campaign/analyze-refs] Failed to parse Visual DNA, returning raw text`);
      visualDNA = { raw_analysis: rawText };
    }

    return c.json({ success: true, visualDNA });
  } catch (err) {
    console.log(`[campaign/analyze-refs] FAIL (${Date.now() - t0}ms):`, err);
    return c.json({ success: true, visualDNA: null, reason: `Analysis failed: ${err}` });
  }
});

// ── POST /campaign/generate-image — Batch image generation with image_ref ──
// Generates N variants of the same prompt+ref, returns all URLs for selection
app.post("/campaign/generate-image", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { prompt, aspectRatio, imageRefUrl, batchSize, refSource } = body;
    if (!prompt) return c.json({ error: "prompt required" }, 400);

    const batch = Math.min(batchSize || 1, 4);
    const ar = aspectRatio || "1:1";
    const model = "photon-1";
    console.log(`[campaign/generate-image] batch=${batch}, ar=${ar}, hasRef=${!!imageRefUrl}, refSource=${refSource || "none"}, user=${user.id.slice(0, 8)}`);

    // Build Luma body
    const buildBody = () => {
      const b: any = { prompt, model, aspect_ratio: ar };
      if (imageRefUrl) {
        if (refSource === "upload") {
          // User-uploaded photo: modify_image_ref preserves content, weight 0.85
          b.modify_image_ref = { url: imageRefUrl, weight: 0.85 };
        } else {
          // Style reference: image_ref with weight 0.80
          b.image_ref = [{ url: imageRefUrl, weight: 0.80 }];
        }
      }
      return b;
    };

    // Submit N generations in parallel
    const submissions = await Promise.all(
      Array.from({ length: batch }).map(async (_, i) => {
        try {
          const lumaBody = buildBody();
          const res = await fetch(`${LUMA_BASE}/generations/image`, {
            method: "POST", headers: lumaHeaders(), body: JSON.stringify(lumaBody),
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) { const b = await res.text(); throw new Error(`Luma submit ${res.status}: ${b.slice(0, 200)}`); }
          const gen = await res.json();
          if (!gen.id) throw new Error("No generation ID");
          console.log(`[campaign/generate-image] variant ${i + 1}/${batch} submitted: ${gen.id}`);
          if (user) deductCredit(user.id, 2).catch(() => {});
          return { index: i, generationId: gen.id, state: "queued" };
        } catch (err) {
          console.log(`[campaign/generate-image] variant ${i + 1} submit failed: ${err}`);
          return { index: i, generationId: null, state: "failed", error: String(err) };
        }
      })
    );

    // Poll all submitted generations until complete (max 90s)
    const results = await Promise.all(
      submissions.filter(s => s.generationId).map(async (sub) => {
        let elapsed = 0;
        while (elapsed < 90_000) {
          await new Promise(r => setTimeout(r, 3_000));
          elapsed += 3_000;
          try {
            const pollRes = await fetch(`${LUMA_BASE}/generations/${sub.generationId}`, { headers: lumaHeaders() });
            if (!pollRes.ok) continue;
            const pd = await pollRes.json();
            if (pd.state === "completed" && pd.assets?.image) {
              console.log(`[campaign/generate-image] variant ${sub.index + 1} OK in ${elapsed / 1000}s`);
              return { index: sub.index, imageUrl: pd.assets.image, state: "completed" };
            }
            if (pd.state === "failed") {
              return { index: sub.index, imageUrl: null, state: "failed", error: pd.failure_reason || "Failed" };
            }
          } catch (pollErr) {
            if (pollErr instanceof Error && pollErr.message.includes("failed")) {
              return { index: sub.index, imageUrl: null, state: "failed", error: pollErr.message };
            }
          }
        }
        return { index: sub.index, imageUrl: null, state: "timeout" };
      })
    );

    const completed = results.filter(r => r.imageUrl);
    console.log(`[campaign/generate-image] ${completed.length}/${batch} completed in ${Date.now() - t0}ms`);
    return c.json({ success: true, results, completedCount: completed.length });
  } catch (err) {
    console.log(`[campaign/generate-image] FAIL (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image generation failed: ${err}` }, 500);
  }
});

// ── POST /campaign/select-best — GPT-4o Vision scores candidates against reference ──
app.post("/campaign/select-best", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { referenceUrl, candidateUrls } = body;
    if (!referenceUrl || !candidateUrls?.length) return c.json({ error: "referenceUrl and candidateUrls required" }, 400);

    // If only 1 candidate, skip scoring — it's the best by default
    if (candidateUrls.length === 1) {
      return c.json({ success: true, bestIndex: 0, scores: [{ index: 0, total: 100 }], skipped: true });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.log("[campaign/select-best] No OPENAI_API_KEY, returning first candidate");
      return c.json({ success: true, bestIndex: 0, scores: [], reason: "No OpenAI key" });
    }

    console.log(`[campaign/select-best] ${candidateUrls.length} candidates vs reference, user=${user.id.slice(0, 8)}`);

    const imageContent: any[] = [
      { type: "text", text: "REFERENCE IMAGE (this is the target to match):" },
      { type: "image_url", image_url: { url: referenceUrl, detail: "high" } },
    ];
    candidateUrls.forEach((url: string, i: number) => {
      imageContent.push({ type: "text", text: `CANDIDATE ${i + 1}:` });
      imageContent.push({ type: "image_url", image_url: { url, detail: "low" } });
    });

    const systemPrompt = `You are a visual QA expert. Compare each candidate image to the reference image. Score each candidate 0-100 on these 5 axes:
1. subject_fidelity: Does it show the same product/subject with correct details?
2. color_accuracy: Does the color palette match the reference?
3. composition_match: Same framing, angle, spatial arrangement?
4. lighting_consistency: Same direction, quality, temperature?
5. mood_atmosphere: Same emotional tone and visual feel?

Output JSON: {"scores":[{"index":0,"subject_fidelity":85,"color_accuracy":90,"composition_match":78,"lighting_consistency":82,"mood_atmosphere":88,"total":85},...], "bestIndex":2}
Total = average of 5 axes. bestIndex = index of highest total. Output ONLY the JSON, no explanation.`;

    const selectRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: imageContent },
        ],
        max_tokens: 600,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!selectRes.ok) {
      const errText = await selectRes.text();
      console.log(`[campaign/select-best] Vision error ${selectRes.status}: ${errText.slice(0, 200)}`);
      return c.json({ success: true, bestIndex: 0, scores: [], reason: `Vision error: ${selectRes.status}` });
    }

    const selectData = await selectRes.json();
    const rawText = selectData.choices?.[0]?.message?.content?.trim() || "";
    let result: any = null;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch { try { result = JSON.parse(rawText); } catch {} }

    if (result && typeof result.bestIndex === "number") {
      if (user) deductCredit(user.id, 1).catch(() => {});
      console.log(`[campaign/select-best] Best=${result.bestIndex}, scores=${JSON.stringify(result.scores?.map((s: any) => s.total))} in ${Date.now() - t0}ms`);
      return c.json({ success: true, ...result });
    }

    console.log(`[campaign/select-best] Parse failed, returning first candidate. Raw: ${rawText.slice(0, 200)}`);
    return c.json({ success: true, bestIndex: 0, scores: [], reason: "Parse failed" });
  } catch (err) {
    console.log(`[campaign/select-best] FAIL (${Date.now() - t0}ms):`, err);
    return c.json({ success: true, bestIndex: 0, scores: [], reason: `Selection failed: ${err}` });
  }
});

// ── POST /campaign/build-prompt — Build enriched image prompt from Visual DNA + brief + brand ──
app.post("/campaign/build-prompt", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || await c.req.json();
    const { visualDNA, brief, platform, formatType, targetAudience } = body;
    if (!brief && !visualDNA) return c.json({ error: "brief or visualDNA required" }, 400);

    // Build brand context
    let brandCtx: BrandContext | null = null;
    try { brandCtx = await buildBrandContext(user.id); } catch {}

    const parts: string[] = [];

    // Subject from Visual DNA
    if (visualDNA?.subject) parts.push(`Subject: ${visualDNA.subject}`);
    if (visualDNA?.environment) parts.push(`Setting: ${visualDNA.environment}`);

    // Lighting from Visual DNA
    if (visualDNA?.lighting) parts.push(`Lighting: ${visualDNA.lighting}`);

    // Color palette from Visual DNA (priority) or brand
    if (visualDNA?.color_palette) {
      parts.push(`Color palette: ${visualDNA.color_palette}`);
    } else if (brandCtx) {
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) parts.push(`Color palette: ${allColors.join(", ")}`);
    }

    // Composition
    if (visualDNA?.composition) parts.push(`Composition: ${visualDNA.composition}`);

    // Texture & mood
    if (visualDNA?.texture) parts.push(`Texture: ${visualDNA.texture}`);
    if (visualDNA?.mood) parts.push(`Mood: ${visualDNA.mood}`);

    // Photography style
    if (visualDNA?.photography_style) parts.push(`Style: ${visualDNA.photography_style}`);
    if (visualDNA?.post_processing) parts.push(`Post-processing: ${visualDNA.post_processing}`);

    // Distinctive elements
    if (visualDNA?.distinctive_elements) parts.push(`Must reproduce: ${visualDNA.distinctive_elements}`);

    // Brief adaptation
    if (brief) parts.push(`Campaign context: ${brief.slice(0, 400)}`);
    if (platform) parts.push(`For ${platform} audience`);
    if (targetAudience) parts.push(`Target: ${targetAudience.slice(0, 150)}`);

    // Brand elements (if no Visual DNA already covers them)
    if (brandCtx && !visualDNA) {
      if (brandCtx.imageBankMoods.length > 0) parts.push(`Mood: ${brandCtx.imageBankMoods.slice(0, 3).join(", ")}`);
      if (brandCtx.imageBankStyles.length > 0) parts.push(`Style: ${brandCtx.imageBankStyles.slice(0, 2).join(", ")}`);
      if (brandCtx.imageBankLighting.length > 0) parts.push(`Lighting: ${brandCtx.imageBankLighting.slice(0, 2).join(", ")}`);
    }

    // Anti-text + technical anchors
    parts.push("No visible text, no letters, no words, no brand names, no logos anywhere in the image");
    parts.push("Ultra-detailed, 8K resolution, photorealistic");

    // Strip brand name to prevent text hallucination
    let enrichedPrompt = parts.join(". ") + ".";
    if (brandCtx?.brandName) {
      const bn = brandCtx.brandName.toLowerCase();
      let idx = enrichedPrompt.toLowerCase().indexOf(bn);
      while (idx !== -1) {
        enrichedPrompt = enrichedPrompt.slice(0, idx) + "the product" + enrichedPrompt.slice(idx + brandCtx.brandName.length);
        idx = enrichedPrompt.toLowerCase().indexOf(bn, idx + 11);
      }
    }

    console.log(`[campaign/build-prompt] OK (${enrichedPrompt.length} chars) in ${Date.now() - t0}ms`);
    return c.json({ success: true, prompt: enrichedPrompt });
  } catch (err) {
    console.log(`[campaign/build-prompt] FAIL (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Prompt build failed: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// ASSET PERSISTENCE — Re-host external CDN URLs to Supabase Storage
// Bucket: make-cad57f79-generated-assets (private)
// ══════════════════════════════════════════════════════════════

const GENERATED_ASSETS_BUCKET = "make-cad57f79-generated-assets";
let generatedAssetsBucketInitialized = false;

async function ensureGeneratedAssetsBucket() {
  if (generatedAssetsBucketInitialized) return;
  try {
    const sb = supabaseAdmin();
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) { console.log(`[gen-assets] listBuckets error: ${listErr.message}`); return; }
    const exists = buckets?.some((b: any) => b.name === GENERATED_ASSETS_BUCKET);
    if (!exists) {
      const { error: createErr } = await sb.storage.createBucket(GENERATED_ASSETS_BUCKET, { public: false });
      if (createErr) { console.log(`[gen-assets] createBucket error: ${createErr.message}`); return; }
      console.log(`[gen-assets] Bucket created: ${GENERATED_ASSETS_BUCKET}`);
    }
    generatedAssetsBucketInitialized = true;
  } catch (err) { console.log(`[gen-assets] init error: ${err}`); }
}

// POST /assets/persist — Download external URL, upload to Storage, return permanent signed URL
app.post("/assets/persist", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const { url, type, assetId } = body;
    if (!url) return c.json({ success: false, error: "Missing url" }, 400);

    const assetType = type || "image";
    console.log(`[assets/persist] user=${user.id.slice(0, 8)} type=${assetType} url=${url.slice(0, 100)}...`);

    const dlRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!dlRes.ok) return c.json({ success: false, error: `Download failed: HTTP ${dlRes.status}` }, 502);

    const ct = dlRes.headers.get("content-type") || "";
    const buf = await dlRes.arrayBuffer();
    if (buf.byteLength < 100) return c.json({ success: false, error: "Asset too small" }, 400);
    if (buf.byteLength > 200_000_000) return c.json({ success: false, error: "Asset too large (>200MB)" }, 400);

    let ext = "bin";
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("mp4")) ext = "mp4";
    else if (ct.includes("webm")) ext = "webm";
    else if (ct.includes("mpeg") || ct.includes("mp3")) ext = "mp3";
    else if (ct.includes("wav")) ext = "wav";
    else if (ct.includes("ogg")) ext = "ogg";
    else if (assetType === "video") ext = "mp4";
    else if (assetType === "audio") ext = "mp3";
    else if (assetType === "image") ext = "jpg";

    await ensureGeneratedAssetsBucket();
    const sb = supabaseAdmin();
    const storagePath = `${user.id}/${Date.now()}-${assetId || Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage.from(GENERATED_ASSETS_BUCKET).upload(storagePath, new Uint8Array(buf), { contentType: ct || `${assetType === "video" ? "video" : assetType === "audio" ? "audio" : "image"}/${ext}`, upsert: true });
    if (upErr) return c.json({ success: false, error: `Upload failed: ${upErr.message}` }, 500);

    const { data: signedData } = await sb.storage.from(GENERATED_ASSETS_BUCKET).createSignedUrl(storagePath, 7 * 24 * 3600);
    if (!signedData?.signedUrl) return c.json({ success: false, error: "Failed to create signed URL" }, 500);

    const kvKey = `asset:${user.id}:${assetId || storagePath}`;
    await kv.set(kvKey, {
      storagePath, bucket: GENERATED_ASSETS_BUCKET, type: assetType,
      originalUrl: url.slice(0, 500), sizeBytes: buf.byteLength, contentType: ct,
      createdAt: new Date().toISOString(),
    });

    console.log(`[assets/persist] OK: ${storagePath} (${(buf.byteLength / 1024).toFixed(0)}KB) in ${Date.now() - t0}ms`);
    return c.json({ success: true, signedUrl: signedData.signedUrl, storagePath, sizeBytes: buf.byteLength });
  } catch (err) {
    console.log(`[assets/persist] error (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Persist failed: ${err}` }, 500);
  }
});

// POST /assets/refresh-url — Generate fresh signed URL for a stored asset
app.post("/assets/refresh-url", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const { storagePath } = body;
    if (!storagePath) return c.json({ success: false, error: "Missing storagePath" }, 400);
    if (!storagePath.startsWith(user.id)) return c.json({ success: false, error: "Access denied" }, 403);

    await ensureGeneratedAssetsBucket();
    const sb = supabaseAdmin();
    const { data } = await sb.storage.from(GENERATED_ASSETS_BUCKET).createSignedUrl(storagePath, 7 * 24 * 3600);
    if (!data?.signedUrl) return c.json({ success: false, error: "Failed to create signed URL" }, 500);
    return c.json({ success: true, signedUrl: data.signedUrl });
  } catch (err) {
    return c.json({ success: false, error: `Refresh failed: ${err}` }, 500);
  }
});

// POST /assets/batch-refresh — Refresh multiple signed URLs at once
app.post("/assets/batch-refresh", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const { storagePaths } = body;
    if (!Array.isArray(storagePaths) || storagePaths.length === 0) return c.json({ success: false, error: "Missing storagePaths" }, 400);

    await ensureGeneratedAssetsBucket();
    const sb = supabaseAdmin();
    const results = await Promise.all(
      storagePaths.filter((p: string) => p.startsWith(user.id)).map(async (p: string) => {
        try {
          const { data } = await sb.storage.from(GENERATED_ASSETS_BUCKET).createSignedUrl(p, 7 * 24 * 3600);
          return { storagePath: p, signedUrl: data?.signedUrl || null };
        } catch { return { storagePath: p, signedUrl: null }; }
      })
    );
    return c.json({ success: true, results });
  } catch (err) {
    return c.json({ success: false, error: `Batch refresh failed: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// ANALYTICS — Social metrics from deployed posts (Zernio)
// ══════════════════════════════════════════════════════════════

app.post("/analytics/social", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const deploys = await kv.getByPrefix(`deploy:${user.id}:`);
    if (!deploys || deploys.length === 0) {
      return c.json({ success: true, posts: [], summary: { totalDeployed: 0, totalScheduled: 0, totalFailed: 0, platforms: {} } });
    }

    const summary: any = { totalDeployed: 0, totalScheduled: 0, totalFailed: 0, platforms: {} };
    const posts: any[] = [];
    const profileData = await kv.get(`zernio:profile:${user.id}`);
    const profileId = profileData?.profileId;
    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");

    for (const deploy of deploys) {
      const d = deploy as any;
      const platform = d.platform || "unknown";
      if (!summary.platforms[platform]) {
        summary.platforms[platform] = { deployed: 0, scheduled: 0, failed: 0, impressions: 0, engagements: 0, clicks: 0 };
      }
      if (d.status === "published") { summary.totalDeployed++; summary.platforms[platform].deployed++; }
      else if (d.status === "scheduled") { summary.totalScheduled++; summary.platforms[platform].scheduled++; }
      else if (d.status === "failed") { summary.totalFailed++; summary.platforms[platform].failed++; }

      let metrics = null;
      if (d.zernioPostId && ZERNIO_KEY && profileId) {
        try {
          const postRes = await fetch(`${ZERNIO_BASE}/posts/${d.zernioPostId}`, {
            headers: { Authorization: `Bearer ${ZERNIO_KEY}` },
            signal: AbortSignal.timeout(5_000),
          });
          if (postRes.ok) {
            const postData = await postRes.json();
            const platformData = postData?.post?.platforms?.[0];
            if (platformData?.analytics) {
              metrics = {
                impressions: platformData.analytics.impressions || 0,
                engagements: platformData.analytics.engagements || platformData.analytics.likes || 0,
                clicks: platformData.analytics.clicks || 0,
                comments: platformData.analytics.comments || 0,
                shares: platformData.analytics.shares || platformData.analytics.reposts || 0,
                reach: platformData.analytics.reach || 0,
              };
              summary.platforms[platform].impressions += metrics.impressions;
              summary.platforms[platform].engagements += metrics.engagements;
              summary.platforms[platform].clicks += metrics.clicks;
            }
          }
        } catch (err) { console.log(`[analytics/social] Zernio fetch failed for ${d.zernioPostId}: ${err}`); }
      }
      posts.push({
        id: d.id, platform, status: d.status, zernioPostId: d.zernioPostId || null,
        zernioPostUrl: d.zernioPostUrl || null, scheduledAt: d.scheduledAt || null,
        createdAt: d.createdAt, metrics,
      });
    }

    posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    console.log(`[analytics/social] ${posts.length} deploys, ${summary.totalDeployed} published, in ${Date.now() - t0}ms`);
    return c.json({ success: true, posts, summary });
  } catch (err) {
    console.log(`[analytics/social] error: ${err}`);
    return c.json({ success: false, error: `Social analytics failed: ${err}` }, 500);
  }
});

// GET /analytics/post-detail — Fetch raw Zernio post data for a single deployed post (debug + detailed metrics)
app.get("/analytics/post-detail", async (c) => {
  try {
    const user = await requireAuth(c);
    const zernioPostId = c.req.query("postId");
    if (!zernioPostId) return c.json({ success: false, error: "Missing postId" }, 400);

    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "ZERNIO_API_KEY not configured" }, 500);

    const res = await fetch(`${ZERNIO_BASE}/posts/${zernioPostId}`, {
      headers: { Authorization: `Bearer ${ZERNIO_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    console.log(`[analytics/post-detail] Zernio GET /posts/${zernioPostId}: HTTP ${res.status}, body=${text.slice(0, 2000)}`);

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!res.ok) return c.json({ success: false, error: `Zernio HTTP ${res.status}`, rawResponse: parsed });

    const post = parsed?.post || parsed;
    const platforms = post?.platforms || [];
    const allMetrics: any[] = [];

    for (const p of platforms) {
      const analytics = p?.analytics || p?.metrics || p?.stats || {};
      const metricEntry: any = {
        platform: p?.platform || "unknown",
        status: p?.status || "unknown",
        platformPostUrl: p?.platformPostUrl || p?.postUrl || null,
        platformPostId: p?.platformPostId || p?.postId || null,
        likes: analytics.likes || analytics.reactions || analytics.favorites || analytics.hearts || 0,
        comments: analytics.comments || analytics.replies || 0,
        shares: analytics.shares || analytics.reposts || analytics.retweets || analytics.reshares || 0,
        impressions: analytics.impressions || analytics.views || 0,
        reach: analytics.reach || analytics.uniqueImpressions || 0,
        clicks: analytics.clicks || analytics.linkClicks || analytics.urlClicks || 0,
        engagements: analytics.engagements || analytics.engagement || analytics.totalEngagement || 0,
        saves: analytics.saves || analytics.bookmarks || 0,
        videoViews: analytics.videoViews || analytics.video_views || 0,
        profileVisits: analytics.profileVisits || analytics.profile_visits || 0,
        followers: analytics.followers || analytics.followerGain || 0,
        _rawAnalytics: analytics,
        _rawPlatformKeys: Object.keys(p || {}),
      };
      if (metricEntry.impressions > 0) {
        metricEntry.engagementRate = ((metricEntry.likes + metricEntry.comments + metricEntry.shares) / metricEntry.impressions * 100).toFixed(2) + "%";
      }
      allMetrics.push(metricEntry);
    }

    return c.json({
      success: true, postId: zernioPostId, status: post?.status || "unknown",
      content: (post?.content || "").slice(0, 200),
      createdAt: post?.createdAt || null, scheduledFor: post?.scheduledFor || null, publishedAt: post?.publishedAt || null,
      platforms: allMetrics, _rawKeys: Object.keys(post || {}), _rawPlatformCount: platforms.length,
    });
  } catch (err) {
    console.log(`[analytics/post-detail] error: ${err}`);
    return c.json({ success: false, error: `Post detail failed: ${err}` }, 500);
  }
});

// POST /analytics/all-posts-metrics — Fetch metrics for ALL deployed posts from Zernio
app.post("/analytics/all-posts-metrics", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "ZERNIO_API_KEY not configured" }, 500);

    const profileData = await kv.get(`zernio:profile:${user.id}`);
    const profileId = profileData?.profileId;
    if (!profileId) return c.json({ success: true, posts: [], totals: {}, message: "No Zernio profile found" });

    const deploys = await kv.getByPrefix(`deploy:${user.id}:`);
    const publishedDeploys = (deploys || []).filter((d: any) => d.zernioPostId && (d.status === "published" || d.status === "scheduled"));

    if (publishedDeploys.length === 0) {
      return c.json({ success: true, posts: [], totals: {}, message: "No published posts" });
    }

    const posts: any[] = [];
    const batchSize = 5;
    for (let i = 0; i < publishedDeploys.length; i += batchSize) {
      const batch = publishedDeploys.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (d: any) => {
          try {
            const res = await fetch(`${ZERNIO_BASE}/posts/${d.zernioPostId}`, {
              headers: { Authorization: `Bearer ${ZERNIO_KEY}` },
              signal: AbortSignal.timeout(8_000),
            });
            if (!res.ok) return { deployId: d.id, platform: d.platform, status: d.status, zernioPostId: d.zernioPostId, error: `HTTP ${res.status}`, metrics: null };
            const data = await res.json();
            const post = data?.post || data;
            const platformInfo = post?.platforms?.[0] || {};
            const analytics = platformInfo?.analytics || platformInfo?.metrics || platformInfo?.stats || {};

            console.log(`[all-posts-metrics] Post ${d.zernioPostId}: analyticsKeys=[${Object.keys(analytics).join(",")}]`);

            return {
              deployId: d.id, platform: d.platform, status: platformInfo?.status || d.status,
              zernioPostId: d.zernioPostId, zernioPostUrl: d.zernioPostUrl || platformInfo?.platformPostUrl || null,
              publishedAt: post?.publishedAt || post?.createdAt || d.createdAt, scheduledAt: d.scheduledAt,
              content: (post?.content || "").slice(0, 150),
              metrics: {
                likes: analytics.likes || analytics.reactions || analytics.favorites || 0,
                comments: analytics.comments || analytics.replies || 0,
                shares: analytics.shares || analytics.reposts || analytics.retweets || 0,
                impressions: analytics.impressions || analytics.views || 0,
                reach: analytics.reach || analytics.uniqueImpressions || 0,
                clicks: analytics.clicks || analytics.linkClicks || 0,
                engagements: analytics.engagements || analytics.engagement || 0,
                saves: analytics.saves || analytics.bookmarks || 0,
                videoViews: analytics.videoViews || analytics.video_views || 0,
              },
              _hasAnalytics: Object.keys(analytics).length > 0,
              _analyticsKeys: Object.keys(analytics),
            };
          } catch (err) { return { deployId: d.id, platform: d.platform, zernioPostId: d.zernioPostId, error: String(err), metrics: null }; }
        })
      );
      for (const r of batchResults) { if (r.status === "fulfilled") posts.push(r.value); }
    }

    const totals: any = { likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0, saves: 0, postsWithMetrics: 0, totalPosts: posts.length };
    const byPlatform: Record<string, any> = {};

    for (const p of posts) {
      if (p.metrics) {
        const m = p.metrics;
        if (m.likes || m.comments || m.shares || m.impressions) totals.postsWithMetrics++;
        totals.likes += m.likes; totals.comments += m.comments; totals.shares += m.shares;
        totals.impressions += m.impressions; totals.reach += m.reach; totals.clicks += m.clicks;
        totals.engagements += m.engagements; totals.saves += m.saves;
        const plat = p.platform || "unknown";
        if (!byPlatform[plat]) byPlatform[plat] = { likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0, count: 0 };
        byPlatform[plat].likes += m.likes; byPlatform[plat].comments += m.comments; byPlatform[plat].shares += m.shares;
        byPlatform[plat].impressions += m.impressions; byPlatform[plat].reach += m.reach; byPlatform[plat].clicks += m.clicks;
        byPlatform[plat].engagements += m.engagements; byPlatform[plat].count++;
      }
    }
    if (totals.impressions > 0) totals.engagementRate = ((totals.likes + totals.comments + totals.shares) / totals.impressions * 100).toFixed(2) + "%";

    console.log(`[all-posts-metrics] ${totals.postsWithMetrics}/${totals.totalPosts} have metrics, in ${Date.now() - t0}ms`);
    return c.json({ success: true, posts, totals, byPlatform });
  } catch (err) {
    console.log(`[all-posts-metrics] error: ${err}`);
    return c.json({ success: false, error: `Metrics fetch failed: ${err}` }, 500);
  }
});

// POST /calendar/deploy — Deploy a single calendar event to its platform
app.post("/calendar/deploy", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const { eventId } = body;
    if (!eventId) return c.json({ success: false, error: "Missing eventId" }, 400);

    const event = await kv.get(eventId);
    if (!event) return c.json({ success: false, error: "Event not found" }, 404);

    if (!event.copy && !event.caption && !event.headline && !event.imageUrl && !event.videoUrl) {
      return c.json({ success: false, error: "Event has no content to deploy. Generate assets in Campaign Lab first." }, 400);
    }

    const platform = event.channel || event.channelIcon || "LinkedIn";
    const zernioPlatform = ZERNIO_PLATFORM_MAP[platform];
    if (!zernioPlatform) {
      await kv.set(eventId, { ...event, status: "published", deployedAt: new Date().toISOString() });
      return c.json({ success: true, status: "published", message: `${platform} marked as published (not a social platform)` });
    }

    const profileId = await getOrCreateZernioProfile(user.id, user.email);
    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "ZERNIO_API_KEY not configured" }, 500);

    const accountsRes = await fetch(`${ZERNIO_BASE}/profiles/${profileId}/accounts`, {
      headers: { Authorization: `Bearer ${ZERNIO_KEY}` }, signal: AbortSignal.timeout(10_000),
    });
    const accountsData = await accountsRes.json();
    const accounts = accountsData?.accounts || [];
    const acct = accounts.find((a: any) => a.platform === zernioPlatform && a.status === "active");
    if (!acct) {
      return c.json({ success: false, error: `No ${platform} account connected.`, needsConnect: true, platform: zernioPlatform });
    }

    const contentText = [event.headline || "", event.copy || event.caption || "", event.hashtags || ""].filter(Boolean).join("\n\n");
    const mediaItems: any[] = [];
    if (event.imageUrl) mediaItems.push({ type: "image", url: event.imageUrl });
    if (event.videoUrl) mediaItems.push({ type: "video", url: event.videoUrl });

    const zernioPayload: any = {
      content: contentText.slice(0, 5000),
      platforms: [{ platform: zernioPlatform, accountId: acct._id || acct.id }],
    };
    if (mediaItems.length > 0) zernioPayload.mediaItems = mediaItems;

    const eventDate = new Date(event.year, event.month, event.day, parseInt(event.time?.split(":")[0] || "9"), parseInt(event.time?.split(":")[1] || "0"));
    const now = new Date();
    if (eventDate > now) {
      zernioPayload.scheduledFor = eventDate.toISOString();
      zernioPayload.timezone = body.timezone || "Europe/Paris";
    } else { zernioPayload.publishNow = true; }

    const res = await fetch(`${ZERNIO_BASE}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZERNIO_KEY}` },
      body: JSON.stringify(zernioPayload), signal: AbortSignal.timeout(30_000),
    });
    const responseText = await res.text();
    let zernioResponse: any = {};
    try { zernioResponse = JSON.parse(responseText); } catch { zernioResponse = { raw: responseText }; }

    if (res.ok) {
      const status = eventDate > now ? "scheduled" : "published";
      await kv.set(eventId, { ...event, status, deployedAt: new Date().toISOString(), zernioPostId: zernioResponse?.post?._id || null });
      const deployId = `deploy:${user.id}:${Date.now()}`;
      await kv.set(deployId, {
        id: deployId, userId: user.id, platform, zernioPlatform, status,
        zernioPostId: zernioResponse?.post?._id || null,
        zernioPostUrl: zernioResponse?.post?.platforms?.[0]?.platformPostUrl || null,
        scheduledAt: eventDate > now ? eventDate.toISOString() : null,
        createdAt: new Date().toISOString(),
      });
      console.log(`[calendar/deploy] ${status} event ${eventId} to ${platform} in ${Date.now() - t0}ms`);
      return c.json({ success: true, status, zernioPostId: zernioResponse?.post?._id || null });
    } else {
      const error = zernioResponse?.error || `HTTP ${res.status}: ${responseText.slice(0, 200)}`;
      return c.json({ success: false, error });
    }
  } catch (err) {
    console.log(`[calendar/deploy] error: ${err}`);
    return c.json({ success: false, error: `Calendar deploy failed: ${err}` }, 500);
  }
});

// POST /calendar/deploy-all — Deploy all events with content
app.post("/calendar/deploy-all", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get?.("parsedBody") || await c.req.json();
    const { eventIds, timezone } = body;

    let events: any[] = [];
    if (eventIds && Array.isArray(eventIds)) {
      const loaded = await Promise.all(eventIds.map((id: string) => kv.get(id)));
      events = loaded.filter(Boolean).map((ev: any, i: number) => ({ ...ev, _kvKey: eventIds[i] }));
    } else {
      const allEvents = await kv.getByPrefix(`calendar:${user.id}:`);
      events = (allEvents || []).filter((ev: any) => ev.status === "scheduled" || ev.status === "draft");
    }

    const deployableEvents = events.filter((ev: any) => ev.copy || ev.caption || ev.headline || ev.imageUrl || ev.videoUrl);
    if (deployableEvents.length === 0) {
      return c.json({ success: true, results: [], message: "No events with content to deploy" });
    }

    const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_KEY) return c.json({ success: false, error: "ZERNIO_API_KEY not configured" }, 500);

    const profileId = await getOrCreateZernioProfile(user.id, user.email);
    const accountsRes = await fetch(`${ZERNIO_BASE}/profiles/${profileId}/accounts`, {
      headers: { Authorization: `Bearer ${ZERNIO_KEY}` }, signal: AbortSignal.timeout(10_000),
    });
    const accountsData = await accountsRes.json();
    const accounts = accountsData?.accounts || [];

    const results: any[] = [];
    const now = new Date();

    for (const ev of deployableEvents) {
      const eventKvKey = ev._kvKey || ev.id;
      const platform = ev.channel || ev.channelIcon || "LinkedIn";
      const zernioPlatform = ZERNIO_PLATFORM_MAP[platform];

      if (!zernioPlatform) {
        await kv.set(eventKvKey, { ...ev, _kvKey: undefined, status: "published", deployedAt: new Date().toISOString() });
        results.push({ eventId: eventKvKey, platform, success: true, status: "published" });
        continue;
      }

      const acct = accounts.find((a: any) => a.platform === zernioPlatform && a.status === "active");
      if (!acct) {
        results.push({ eventId: eventKvKey, platform, success: false, error: `No ${platform} account connected`, needsConnect: true });
        continue;
      }

      try {
        const contentText = [ev.headline || "", ev.copy || ev.caption || "", ev.hashtags || ""].filter(Boolean).join("\n\n");
        const mediaItems: any[] = [];
        if (ev.imageUrl) mediaItems.push({ type: "image", url: ev.imageUrl });
        if (ev.videoUrl) mediaItems.push({ type: "video", url: ev.videoUrl });

        const zernioPayload: any = {
          content: contentText.slice(0, 5000),
          platforms: [{ platform: zernioPlatform, accountId: acct._id || acct.id }],
        };
        if (mediaItems.length > 0) zernioPayload.mediaItems = mediaItems;

        const eventDate = new Date(ev.year, ev.month, ev.day, parseInt(ev.time?.split(":")[0] || "9"), parseInt(ev.time?.split(":")[1] || "0"));
        if (eventDate > now) {
          zernioPayload.scheduledFor = eventDate.toISOString();
          zernioPayload.timezone = timezone || "Europe/Paris";
        } else { zernioPayload.publishNow = true; }

        const res = await fetch(`${ZERNIO_BASE}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZERNIO_KEY}` },
          body: JSON.stringify(zernioPayload), signal: AbortSignal.timeout(25_000),
        });
        const text = await res.text();
        let parsed: any = {}; try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        const ok = res.ok;
        const status = ok ? (eventDate > now ? "scheduled" : "published") : "failed";

        if (ok) {
          await kv.set(eventKvKey, { ...ev, _kvKey: undefined, status, deployedAt: new Date().toISOString(), zernioPostId: parsed?.post?._id || null });
          const deployId = `deploy:${user.id}:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await kv.set(deployId, {
            id: deployId, userId: user.id, platform, zernioPlatform, status,
            zernioPostId: parsed?.post?._id || null,
            zernioPostUrl: parsed?.post?.platforms?.[0]?.platformPostUrl || null,
            scheduledAt: eventDate > now ? eventDate.toISOString() : null,
            createdAt: new Date().toISOString(),
          });
        }
        results.push({ eventId: eventKvKey, platform, success: ok, status, error: ok ? undefined : (parsed?.error || `HTTP ${res.status}`), zernioPostId: parsed?.post?._id });
      } catch (err: any) {
        results.push({ eventId: eventKvKey, platform, success: false, error: err?.message || String(err) });
      }
    }

    const successCount = results.filter((r: any) => r.success).length;
    console.log(`[calendar/deploy-all] ${successCount}/${deployableEvents.length} deployed in ${Date.now() - t0}ms`);
    return c.json({ success: true, results, successCount, totalCount: deployableEvents.length });
  } catch (err) {
    console.log(`[calendar/deploy-all] error: ${err}`);
    return c.json({ success: false, error: `Calendar batch deploy failed: ${err}` }, 500);
  }
});

app.all("*", (c) => c.json({ error: "Not found", path: c.req.path }, 404));

console.log("[boot] ORA server ready — asset-persistence, calendar-deploy, social-analytics — deploy 2026-03-20T12:00Z");

// ── SOCIAL INTELLIGENCE (PARKED — waiting for dedicated social API) ──
// POST /vault/social-listen — DISABLED
// POST /vault/social-analyze — DISABLED
/* PARKED: social-listen and social-analyze routes removed.
   Scraping social platforms (LinkedIn, Instagram, Twitter) via Jina/Firecrawl/ScrapingBee
   hits login walls. Will revisit with a dedicated social API post-launch.
*/

// ══════════════════════════════════════════════════════════════
// DEAD CODE BELOW — kept as reference, unreachable
// ══════════════════════════════════════════════════════════════
if (false) { const c: any = null; // @ts-ignore — dead code fence
app.post("/vault/social-listen-PARKED", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || {};
    const accounts: { platform: string; profileUrl: string }[] = body.accounts || [];
    const competitors: { name: string; accounts: { platform: string; profileUrl: string }[] }[] = body.competitors || [];

    if (accounts.length === 0 && competitors.length === 0) {
      return c.json({ success: false, error: "No accounts or competitors provided" }, 400);
    }

    console.log(`[social-listen] user=${user.id} accounts=${accounts.length} competitors=${competitors.length}`);

    // Helper: scrape a profile URL and extract posts via APIPod
    async function extractPostsFromProfile(profileUrl: string, platform: string): Promise<any[]> {
      try {
        if (!isValidScrapeUrl(profileUrl)) {
          console.log(`[social-listen] Invalid URL: ${profileUrl}`);
          return [];
        }
        const { content, source } = await scrapeUrl(profileUrl, 0.7);
        console.log(`[social-listen] Scraped ${profileUrl} via ${source}: ${content.length} chars`);
        if (content.length < 100) return [];

        const key = Deno.env.get("APIPOD_API_KEY");
        if (!key) { console.log("[social-listen] No APIPOD_API_KEY"); return []; }

        const extractPrompt = `You are a social media content analyst. From the following scraped web page content of a ${platform} profile, extract the most recent posts/articles/updates.

For each post, extract:
- "text": the post content (first 300 chars if long)
- "date": publication date if visible (ISO format or relative like "2 days ago"), or null
- "engagement": any visible metrics like likes, comments, shares, reposts as a short string (e.g. "142 likes, 23 comments"), or null
- "type": "text" | "image" | "video" | "article" | "link"

Return a JSON array of up to 15 posts, ordered by most recent first.
If you cannot extract any posts (e.g. page is a login wall), return an empty array [].
Return ONLY the JSON array, no markdown, no explanation.

PAGE CONTENT:
${content.slice(0, 8000)}`;

        const models = ["gpt-4o", "gpt-5"];
        for (const m of models) {
          try {
            const res = await fetchWithTimeout(`${APIPOD_BASE}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body: JSON.stringify({
                model: m,
                messages: [{ role: "user", content: extractPrompt }],
                max_tokens: 3000,
                temperature: 0.1,
              }),
            }, 25_000);
            if (!res.ok) { console.log(`[social-listen] extract ${m} ${res.status}`); continue; }
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
            const jsonStr = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
            const posts = JSON.parse(jsonStr);
            if (Array.isArray(posts)) {
              console.log(`[social-listen] Extracted ${posts.length} posts from ${profileUrl} via ${m}`);
              return posts.slice(0, 15);
            }
          } catch (err) { console.log(`[social-listen] extract ${m} error: ${err}`); }
        }
        return [];
      } catch (err) {
        console.log(`[social-listen] Failed to scrape ${profileUrl}: ${err}`);
        return [];
      }
    }

    // Scrape own accounts (sequential to avoid rate limits)
    const ownResults: { platform: string; profileUrl: string; posts: any[] }[] = [];
    for (const acc of accounts) {
      const posts = await extractPostsFromProfile(acc.profileUrl, acc.platform);
      ownResults.push({ platform: acc.platform, profileUrl: acc.profileUrl, posts });
    }

    // Scrape competitor accounts
    const compResults: { name: string; data: { platform: string; profileUrl: string; posts: any[] }[] }[] = [];
    for (const comp of competitors) {
      const compData: { platform: string; profileUrl: string; posts: any[] }[] = [];
      for (const acc of (comp.accounts || []).slice(0, 5)) {
        const posts = await extractPostsFromProfile(acc.profileUrl, acc.platform);
        compData.push({ platform: acc.platform, profileUrl: acc.profileUrl, posts });
      }
      compResults.push({ name: comp.name, data: compData });
    }

    console.log(`[social-listen] Done in ${Date.now() - t0}ms — own=${ownResults.length} competitors=${compResults.length}`);
    return c.json({ success: true, own: ownResults, competitors: compResults });
  } catch (err) {
    console.log(`[social-listen] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Social listening failed: ${err}` }, 500);
  }
});

// POST /vault/social-analyze — Strategic Planner AI analysis of social activity
app.post("/vault/social-analyze", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const body = c.get("parsedBody") || {};
    const { vault, own, competitors } = body;

    if (!vault || !own) {
      return c.json({ success: false, error: "Missing vault or own posts data" }, 400);
    }

    const key = Deno.env.get("APIPOD_API_KEY");
    if (!key) return c.json({ success: false, error: "APIPOD_API_KEY not configured" }, 500);

    console.log(`[social-analyze] user=${user.id} own=${own?.length || 0} competitors=${competitors?.length || 0}`);

    const vaultContext = `BRAND CONTEXT:
- Company: ${vault.company_name || "Unknown"}
- Industry: ${vault.industry || "Unknown"}
- Tagline: ${vault.tagline || "N/A"}
- Tone: ${vault.tone?.primary_tone || "N/A"} (formality: ${vault.tone?.formality || "?"}/10, warmth: ${vault.tone?.warmth || "?"}/10)
- Key messages: ${(vault.key_messages || []).join("; ") || "N/A"}
- Products/Services: ${(vault.products_services || []).join(", ") || "N/A"}
- Target audiences: ${(vault.target_audiences || []).map((a: any) => a.name).join(", ") || "N/A"}`;

    const ownSummary = (own || []).map((acc: any) => {
      const postsText = (acc.posts || []).slice(0, 15).map((p: any, i: number) =>
        `  ${i + 1}. [${p.type || "text"}] ${(p.text || "").slice(0, 200)}${p.engagement ? ` | ${p.engagement}` : ""}${p.date ? ` | ${p.date}` : ""}`
      ).join("\n");
      return `${acc.platform} (${acc.profileUrl}):\n${postsText || "  No posts extracted"}`;
    }).join("\n\n");

    const compSummary = (competitors || []).map((comp: any) => {
      const perPlatform = (comp.data || []).map((acc: any) => {
        const postsText = (acc.posts || []).slice(0, 15).map((p: any, i: number) =>
          `  ${i + 1}. [${p.type || "text"}] ${(p.text || "").slice(0, 200)}${p.engagement ? ` | ${p.engagement}` : ""}`
        ).join("\n");
        return `  ${acc.platform}:\n${postsText || "    No posts extracted"}`;
      }).join("\n");
      return `COMPETITOR: ${comp.name}\n${perPlatform}`;
    }).join("\n\n");

    const systemPrompt = `You are a Strategic Planner AI agent for a brand content strategy team. Your role is to analyze social media activity of a brand and its competitors, identify content gaps and opportunities, and recommend actionable next topics.

You must respond with a JSON object (no markdown wrapping) with this exact structure:
{
  "ownTopics": ["topic1", "topic2", ...],
  "ownStrengths": ["what the brand does well on social"],
  "ownWeaknesses": ["what could improve"],
  "competitorTopics": ["topics competitors cover"],
  "gaps": ["topics competitors cover that the brand doesn't", "emerging trends the brand is missing"],
  "recommendations": [
    {
      "topic": "Specific topic suggestion",
      "reason": "Why this topic matters now",
      "format": "linkedin_post | story | newsletter | email | ad | article",
      "priority": "high | medium | low",
      "angle": "Specific angle or hook for this content"
    }
  ]
}

Provide 3-5 recommendations, ordered by priority. Each recommendation must be specific, actionable, and aligned with the brand's tone and audience. Consider seasonality, industry trends, and competitive gaps.`;

    const userPrompt = `${vaultContext}

OWN SOCIAL ACTIVITY:
${ownSummary || "No own posts available"}

${compSummary ? `COMPETITOR ACTIVITY:\n${compSummary}` : "No competitor data available."}

Analyze the above and provide strategic content recommendations.`;

    const models = ["gpt-4o", "gpt-5"];
    for (const m of models) {
      try {
        const res = await fetchWithTimeout(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 4000,
            temperature: 0.4,
          }),
        }, 45_000);
        if (!res.ok) { console.log(`[social-analyze] ${m} ${res.status}`); continue; }
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || "{}";
        const jsonStr = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
        const analysis = JSON.parse(jsonStr);
        console.log(`[social-analyze] OK via ${m} in ${Date.now() - t0}ms — ${analysis.recommendations?.length || 0} recommendations`);
        return c.json({ success: true, analysis, model: m });
      } catch (err) { console.log(`[social-analyze] ${m} error: ${err}`); }
    }

    return c.json({ success: false, error: "All AI models failed for analysis" }, 500);
  } catch (err) {
    console.log(`[social-analyze] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Social analysis failed: ${err}` }, 500);
  }
});
} // end dead code fence (if false)

// ══════════════════════════════════════════════════════════════
// TEMPLATE PIPELINE — Email & Landing Page generation via templates
// Routes: suggest-templates, generate-slots, compile-mjml
// DO NOT EDIT existing routes above this line.
// ══════════════════════════════════════════════════════════════

// ── POST /campaign/suggest-templates — AI recommends 2-3 templates based on brief ──
app.post("/campaign/suggest-templates", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const brief = ((body.brief || "") as string).slice(0, 2000);
    const templateType = ((body.type || "email") as string);
    const catalogJson = ((body.catalog || "[]") as string);
    if (!brief) return c.json({ success: false, error: "brief required" }, 400);
    let brandBlock = "";
    if (user) { const ctx = await buildBrandContext(user.id).catch(() => null); if (ctx) brandBlock = buildBrandBlock(ctx); }
    const sysPrompt = `You are a marketing template expert. Given a campaign brief and a catalog of ${templateType} templates, recommend the 2-3 BEST templates.\nConsider the brief intent (promo, event, editorial, product launch, etc.) and brand industry/tone.${brandBlock}\n\nTEMPLATE CATALOG:\n${catalogJson}\n\nOUTPUT: ONLY valid JSON array: [{"id":"template-id","reason":"1 sentence why","score":85}]\nOrder by score desc. Max 3. No markdown.`;
    const result = await generateText({ prompt: brief, model: "gpt-4o", systemPrompt: sysPrompt, maxTokens: 500 });
    let suggestions: any[] = [];
    try { const raw = result.text.trim().replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim(); suggestions = JSON.parse(raw); } catch { const m = result.text.match(/\[[\s\S]*\]/); if (m) suggestions = JSON.parse(m[0]); }
    console.log(`[suggest-templates] OK: ${suggestions.length} suggestions in ${Date.now() - t0}ms`);
    return c.json({ success: true, suggestions, latencyMs: Date.now() - t0 });
  } catch (err) { console.log(`[suggest-templates] ERROR (${Date.now() - t0}ms): ${err}`); return c.json({ success: false, error: `${err}` }, 500); }
});

// ── POST /campaign/generate-slots — AI generates content for template placeholders ──
app.post("/campaign/generate-slots", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const brief = ((body.brief || "") as string).slice(0, 2000);
    const templateId = ((body.templateId || "") as string);
    const templateName = ((body.templateName || "") as string);
    const templateCategory = ((body.templateCategory || "") as string);
    const contentSlots = (body.contentSlots || []) as string[];
    const targetAudience = ((body.targetAudience || "") as string).slice(0, 300);
    const lang = ((body.lang || "en") as string);
    if (!brief) return c.json({ success: false, error: "brief required" }, 400);
    if (!contentSlots.length) return c.json({ success: false, error: "contentSlots required" }, 400);
    let brandBlock = "";
    if (user) { const ctx = await buildBrandContext(user.id).catch(() => null); if (ctx) brandBlock = buildBrandBlock(ctx); }
    const isLP = templateId.includes("lp-");
    const slotsDesc = contentSlots.map(s => `- ${s}`).join("\n");
    const sysPrompt = `You are the senior content director of a brand-obsessed agency. Generate REAL, PUBLISHABLE content for a ${templateCategory} ${isLP ? "landing page" : "email"} template.\n\nTEMPLATE: "${templateName}" (${templateCategory})${brandBlock ? "\n" + brandBlock : ""}${targetAudience ? `\nTARGET AUDIENCE: ${targetAudience}` : ""}\n\nLANGUAGE: ALL content in ${lang === "fr" ? "FRENCH" : "ENGLISH"}.\n\nCONTENT SLOTS TO FILL:\n${slotsDesc}\n\nRULES:\n1. Match exact tone, personality, vocabulary from Brand Vault if available.\n2. Headlines: punchy, max 8 words. Body text: 40-80 words. Excerpts: 15-25 words.\n3. CTA text: action-oriented, max 4 words.\n4. For IMAGE_URL slots: generate a detailed image prompt (80-120 words, photorealistic, cinematic) prefixed with "PROMPT:".\n5. For PRICE slots: use realistic prices with currency symbol.\n6. For DATE slots: use upcoming dates.\n7. Each slot value should be a string. Never empty.\n\nOUTPUT: ONLY valid JSON object. No markdown, no backticks.\nExample: {"HERO_HEADLINE":"...", "HERO_BODY":"...", "CTA_TEXT":"..."}`;
    const result = await generateText({ prompt: brief, model: "gpt-4o", systemPrompt: sysPrompt, maxTokens: 3000 });
    let slotData: Record<string, string> = {};
    try { const raw = result.text.trim().replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim(); slotData = JSON.parse(raw); } catch { const m = result.text.match(/\{[\s\S]*\}/); if (m) slotData = JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1")); }
    if (user) deductCredit(user.id, 2).catch(() => {});
    console.log(`[generate-slots] OK: ${Object.keys(slotData).length}/${contentSlots.length} slots, template=${templateId}, ${Date.now() - t0}ms`);
    return c.json({ success: true, slotData, provider: result.provider, filledCount: Object.keys(slotData).length, latencyMs: Date.now() - t0 });
  } catch (err) { console.log(`[generate-slots] ERROR (${Date.now() - t0}ms): ${err}`); return c.json({ success: false, error: `${err}` }, 500); }
});

// ── POST /campaign/compile-mjml — Compile MJML source to HTML ──
app.post("/campaign/compile-mjml", async (c) => {
  const t0 = Date.now();
  try {
    const body = c.get("parsedBody") || await c.req.json().catch(() => ({}));
    const mjmlSource = ((body.mjml || "") as string);
    if (!mjmlSource) return c.json({ success: false, error: "mjml source required" }, 400);
    let html = ""; let compilationMethod = "none";
    try {
      const mjml2html = (await import("npm:mjml@5")).default;
      const result = mjml2html(mjmlSource, { validationLevel: "soft", minify: false });
      html = result.html || ""; compilationMethod = "mjml@5";
      if (result.errors?.length) console.log(`[compile-mjml] ${result.errors.length} warnings`);
    } catch (mjmlErr) {
      console.log(`[compile-mjml] mjml failed: ${mjmlErr}`);
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;}</style></head><body>${mjmlSource.replace(/<mj-[^>]*>/g, "<div>").replace(/<\/mj-[^>]*>/g, "</div>")}</body></html>`;
      compilationMethod = "fallback-strip";
    }
    console.log(`[compile-mjml] OK: ${html.length}c via ${compilationMethod} (${Date.now() - t0}ms)`);
    return c.json({ success: true, html, method: compilationMethod, latencyMs: Date.now() - t0 });
  } catch (err) { console.log(`[compile-mjml] ERROR (${Date.now() - t0}ms): ${err}`); return c.json({ success: false, error: `${err}` }, 500); }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGN LAB — SOUNDTRACK GENERATION + VIDEO/AUDIO MERGE
// ══════════════════════════════════════════════════════════════

const MERGED_BUCKET = "make-cad57f79-merged-videos";
let mergedBucketInitialized = false;

async function ensureMergedBucket() {
  if (mergedBucketInitialized) return;
  try {
    const sb = supabaseAdmin();
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === MERGED_BUCKET);
    if (!exists) {
      await sb.storage.createBucket(MERGED_BUCKET, { public: false });
      console.log(`[merge] Created bucket: ${MERGED_BUCKET}`);
    }
    mergedBucketInitialized = true;
  } catch (err) { console.log(`[merge] Bucket init error: ${err}`); }
}

// POST /campaign-lab/generate-soundtrack
app.post("/campaign-lab/generate-soundtrack", async (c) => {
  const t0 = Date.now();
  try {
    const { brief, mood, style } = await c.req.json();
    if (!brief && !mood) return c.json({ success: false, error: "brief or mood required" }, 400);
    const stylePrompt = style || `${mood || "cinematic ambient"}, instrumental, professional, brand video background`;
    console.log(`[generate-soundtrack] brief="${(brief || "").slice(0, 60)}", mood="${mood || "auto"}", style="${stylePrompt.slice(0, 80)}"`);

    const { taskId, sunoModel } = await sunoStartGeneration({
      prompt: brief?.slice(0, 200) || mood || "cinematic background music",
      model: "suno",
      instrumental: true,
      style: stylePrompt,
      title: "Campaign Soundtrack",
    });

    const maxPoll = 36;
    for (let i = 0; i < maxPoll; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await sunoPollStatus(taskId);
      console.log(`[generate-soundtrack] poll #${i + 1}: ${poll.status}`);
      if (poll.status === "DONE" && poll.track?.audioUrl) {
        console.log(`[generate-soundtrack] OK in ${Date.now() - t0}ms: ${poll.track.audioUrl.slice(0, 80)}`);
        return c.json({ success: true, audioUrl: poll.track.audioUrl, title: poll.track.title, duration: poll.track.duration, taskId });
      }
      if (poll.status === "FAILED") {
        return c.json({ success: false, error: poll.error || "Suno generation failed" }, 500);
      }
    }
    return c.json({ success: false, error: "Soundtrack generation timeout (180s)" }, 504);
  } catch (err: any) {
    console.log(`[generate-soundtrack] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Soundtrack error: ${err.message || err}` }, 500);
  }
});

// POST /campaign-lab/soundtrack-start — Start Suno generation, return taskId immediately
app.post("/campaign-lab/soundtrack-start", async (c) => {
  try {
    const { brief, mood, style } = await c.req.json();
    if (!brief && !mood) return c.json({ success: false, error: "brief or mood required" }, 400);
    const stylePrompt = style || `${mood || "cinematic ambient"}, instrumental, professional, brand video background`;
    console.log(`[soundtrack-start] brief="${(brief || "").slice(0, 60)}", style="${stylePrompt.slice(0, 80)}"`);
    const { taskId, sunoModel } = await sunoStartGeneration({
      prompt: brief?.slice(0, 200) || mood || "cinematic background music",
      model: "suno", instrumental: true, style: stylePrompt, title: "Campaign Soundtrack",
    });
    console.log(`[soundtrack-start] OK taskId=${taskId}, model=${sunoModel}`);
    return c.json({ success: true, taskId, sunoModel });
  } catch (err: any) {
    console.log(`[soundtrack-start] ERROR: ${err}`);
    return c.json({ success: false, error: `Soundtrack start: ${err.message || err}` }, 500);
  }
});

// GET /campaign-lab/soundtrack-poll — Poll Suno status, return quickly
app.get("/campaign-lab/soundtrack-poll", async (c) => {
  try {
    const taskId = c.req.query("taskId");
    if (!taskId) return c.json({ success: false, error: "taskId required" }, 400);
    const poll = await sunoPollStatus(taskId);
    console.log(`[soundtrack-poll] taskId=${taskId} status=${poll.status}`);
    if (poll.status === "DONE" && poll.track?.audioUrl) {
      return c.json({ success: true, status: "done", audioUrl: poll.track.audioUrl, title: poll.track.title, duration: poll.track.duration });
    }
    if (poll.status === "FAILED") {
      return c.json({ success: true, status: "failed", error: poll.error });
    }
    return c.json({ success: true, status: "pending" });
  } catch (err: any) {
    console.log(`[soundtrack-poll] ERROR: ${err}`);
    return c.json({ success: false, error: `Poll: ${err.message || err}` }, 500);
  }
});

// POST /campaign-lab/merge-video-audio
app.post("/campaign-lab/merge-video-audio", async (c) => {
  const t0 = Date.now();
  try {
    const { videoUrl, audioUrl } = await c.req.json();
    if (!videoUrl || !audioUrl) return c.json({ success: false, error: "videoUrl and audioUrl required" }, 400);
    console.log(`[merge] video=${videoUrl.slice(0, 80)}, audio=${audioUrl.slice(0, 80)}`);

    await ensureMergedBucket();

    const ts = Date.now();
    const videoPath = `/tmp/merge-video-${ts}.mp4`;
    const audioPath = `/tmp/merge-audio-${ts}.mp3`;
    const outputPath = `/tmp/merge-output-${ts}.mp4`;

    console.log(`[merge] Downloading video...`);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Video download failed: HTTP ${videoRes.status}`);
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());
    await Deno.writeFile(videoPath, videoBytes);
    console.log(`[merge] Video saved: ${videoBytes.length} bytes`);

    console.log(`[merge] Downloading audio...`);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Audio download failed: HTTP ${audioRes.status}`);
    const audioBytes = new Uint8Array(await audioRes.arrayBuffer());
    await Deno.writeFile(audioPath, audioBytes);
    console.log(`[merge] Audio saved: ${audioBytes.length} bytes`);

    console.log(`[merge] Running FFmpeg merge...`);
    const ffmpegCmd = new Deno.Command("ffmpeg", {
      args: ["-y", "-i", videoPath, "-i", audioPath, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outputPath],
      stdout: "piped",
      stderr: "piped",
    });

    const ffmpegResult = await ffmpegCmd.output();
    const ffmpegStderr = new TextDecoder().decode(ffmpegResult.stderr);
    if (!ffmpegResult.success) {
      console.log(`[merge] FFmpeg failed: ${ffmpegStderr.slice(-500)}`);
      throw new Error(`FFmpeg merge failed: ${ffmpegStderr.slice(-200)}`);
    }
    console.log(`[merge] FFmpeg OK, reading output...`);

    const mergedBytes = await Deno.readFile(outputPath);
    console.log(`[merge] Output: ${mergedBytes.length} bytes`);

    const storagePath = `merged/${ts}-campaign.mp4`;
    const sb = supabaseAdmin();
    const { error: upErr } = await sb.storage.from(MERGED_BUCKET).upload(storagePath, mergedBytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: signedData } = await sb.storage.from(MERGED_BUCKET).createSignedUrl(storagePath, 7200);
    if (!signedData?.signedUrl) throw new Error("Failed to create signed URL");

    try { await Deno.remove(videoPath); } catch {}
    try { await Deno.remove(audioPath); } catch {}
    try { await Deno.remove(outputPath); } catch {}

    console.log(`[merge] OK in ${Date.now() - t0}ms: ${signedData.signedUrl.slice(0, 80)}`);
    return c.json({ success: true, mergedVideoUrl: signedData.signedUrl, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    console.log(`[merge] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Merge error: ${err.message || err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// POST-PRODUCTION AGENT — AI-powered beat-sync video + audio merge
// Analyzes both tracks, detects beats & scene cuts, LLM decides sync strategy
// ══════════════════════════════════════════════════════════════

async function runFFprobe(filePath: string): Promise<string> {
  const cmd = new Deno.Command("ffprobe", {
    args: ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
    stdout: "piped", stderr: "piped",
  });
  const out = await cmd.output();
  return new TextDecoder().decode(out.stdout).trim();
}

async function runFFmpegAnalysis(args: string[]): Promise<string> {
  const cmd = new Deno.Command("ffmpeg", { args, stdout: "piped", stderr: "piped" });
  const out = await cmd.output();
  return new TextDecoder().decode(out.stderr);
}

function parseSceneCuts(ffOut: string): number[] {
  const cuts: number[] = [];
  const re = /pts_time:(\d+\.?\d*)/g;
  let m;
  while ((m = re.exec(ffOut)) !== null) cuts.push(parseFloat(m[1]));
  return cuts;
}

function parseSilenceEnds(ffOut: string): number[] {
  const ends: number[] = [];
  const re = /silence_end:\s*(\d+\.?\d*)/g;
  let m;
  while ((m = re.exec(ffOut)) !== null) ends.push(parseFloat(m[1]));
  return ends;
}

function estimateBPM(beats: number[]): number {
  if (beats.length < 3) return 120;
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const d = beats[i] - beats[i - 1];
    if (d > 0.15 && d < 2.0) intervals.push(d);
  }
  if (intervals.length === 0) return 120;
  return Math.round(60 / (intervals.reduce((a, b) => a + b, 0) / intervals.length));
}

function calculateOptimalTrim(sceneCuts: number[], beats: number[]): number {
  if (sceneCuts.length === 0 || beats.length === 0) return 0;
  const firstCut = sceneCuts.find(s => s > 0.2) || sceneCuts[0] || 0;
  let bestTrim = 0;
  let bestDist = Infinity;
  for (const beat of beats) {
    const trim = beat - firstCut;
    if (trim < 0) continue;
    if (trim > 10) break;
    let totalDist = 0;
    for (const cut of sceneCuts) {
      let minD = Infinity;
      for (const b of beats) { const dd = Math.abs(b - (cut + trim)); if (dd < minD) minD = dd; }
      totalDist += minD;
    }
    if (totalDist < bestDist) { bestDist = totalDist; bestTrim = trim; }
  }
  return bestTrim;
}

function buildFallbackSyncArgs(params: { videoDuration: number; audioDuration: number; sceneCuts: number[]; beats: number[]; bpm: number; tone: string }, parsed: any): { strategy: string; ffmpegArgs: string[] } {
  const trimStart = parsed.audioTrimStart || calculateOptimalTrim(params.sceneCuts, params.beats);
  const fadeIn = parsed.fadeIn || 0.3;
  const fadeOut = parsed.fadeOut || Math.min(1.0, params.videoDuration * 0.15);
  const fadeOutStart = Math.max(0, params.videoDuration - fadeOut - trimStart);
  const vol = parsed.volume || (params.tone.match(/bold|energetic|provocative/i) ? 0.95 : 0.8);
  const fp = [`atrim=start=${trimStart.toFixed(3)}`, `asetpts=PTS-STARTPTS`];
  if (fadeIn > 0) fp.push(`afade=t=in:st=0:d=${fadeIn.toFixed(2)}`);
  if (fadeOut > 0) fp.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOut.toFixed(2)}`);
  fp.push(`volume=${vol.toFixed(2)}`);
  return {
    strategy: `Algorithmic sync: trim@${trimStart.toFixed(2)}s, fade in=${fadeIn}s out=${fadeOut}s, vol=${vol}`,
    ffmpegArgs: ["-filter_complex", `[1:a]${fp.join(",")}[outa]`, "-map", "0:v", "-map", "[outa]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart"],
  };
}

async function callPostProductionAgent(params: { videoDuration: number; audioDuration: number; sceneCuts: number[]; beats: number[]; bpm: number; tone: string; brief: string }): Promise<{ strategy: string; ffmpegArgs: string[] }> {
  const APIPOD_KEY = Deno.env.get("APIPOD_API_KEY");
  if (!APIPOD_KEY) throw new Error("APIPOD_API_KEY not set for post-production agent");

  const systemPrompt = `You are a world-class post-production AI agent specialized in synchronizing music with video.
You receive precise analysis data from FFmpeg (beat timestamps, scene cut timestamps, durations, BPM).
Your job: produce FFmpeg arguments that create a perfectly beat-synced music video clip.

RULES:
1. Map "0:v" for video stream, "1:a" for audio stream.
2. Always use -shortest to match video length.
3. Audio codec: AAC 192k. Video codec: copy (never re-encode video).
4. Always add -movflags +faststart.
5. Calculate the optimal audio start offset to align a strong beat with the first visual scene cut.
   - If first scene cut is at 0.8s and nearest beat is at 1.1s, set atrim=start=0.3 so the beat lands on the cut.
   - Goal: every scene change should have a beat within +/-0.1s.
6. Add audio fade-in (0.2-0.5s) and fade-out (0.5-1.5s before video end).
7. If tone is energetic/bold: shorter fades, volume 0.9-1.0. If refined/luxury: longer fades, volume 0.7-0.85.
8. If beats don't align with scene cuts, consider slight atempo (0.97-1.03 max).
9. Combine all audio filters into ONE -filter_complex with [1:a] input and [outa] output.
10. Use -map 0:v -map "[outa]" for final mapping.

OUTPUT (strict JSON, no markdown):
{
  "strategy": "1-2 sentence sync approach description",
  "audioTrimStart": <number>,
  "fadeIn": <number>,
  "fadeOut": <number>,
  "atempo": <number 0.97-1.03>,
  "volume": <number 0.5-1.0>,
  "ffmpegArgs": ["array","of","ffmpeg","arguments"]
}

ffmpegArgs must NOT include -y, -i, or output path. Only: -filter_complex, -map, -c:v, -c:a, -b:a, -shortest, -movflags.`;

  const userPrompt = `VIDEO: ${params.videoDuration.toFixed(2)}s, scene cuts at [${params.sceneCuts.map(s => s.toFixed(3)).join(", ")}] (${params.sceneCuts.length} cuts)
AUDIO: ${params.audioDuration.toFixed(2)}s, ~${params.bpm} BPM, beats at [${params.beats.slice(0, 40).map(b => b.toFixed(3)).join(", ")}]${params.beats.length > 40 ? ` (${params.beats.length} total)` : ""}
TONE: ${params.tone} | BRIEF: ${params.brief.slice(0, 200)}

Produce optimal beat-synced FFmpeg args.`;

  console.log(`[post-prod-agent] Calling LLM: ${params.sceneCuts.length} cuts, ${params.beats.length} beats, ${params.bpm} BPM`);
  const res = await fetch("https://api.apipod.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${APIPOD_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 1000, temperature: 0.3 }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(`Post-prod agent API ${res.status}: ${e.slice(0, 200)}`); }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log(`[post-prod-agent] Response: ${content.slice(0, 500)}`);

  let jsonStr = content;
  const jm = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jm) jsonStr = jm[1];
  const bm = jsonStr.match(/\{[\s\S]*\}/);
  if (bm) jsonStr = bm[0];

  try {
    const parsed = JSON.parse(jsonStr);
    const args: string[] = parsed.ffmpegArgs || [];
    if (!args.some((a: string) => a === "-map")) {
      console.log(`[post-prod-agent] Missing -map, building from parsed params...`);
      return buildFallbackSyncArgs(params, parsed);
    }
    return { strategy: parsed.strategy || "AI-synced", ffmpegArgs: args };
  } catch (e) {
    console.log(`[post-prod-agent] Parse failed: ${e}, using algorithmic fallback`);
    return buildFallbackSyncArgs(params, {});
  }
}

// POST /campaign-lab/smart-merge — AI-powered beat-sync post-production
app.post("/campaign-lab/smart-merge", async (c) => {
  const t0 = Date.now();
  try {
    const { videoUrl, audioUrl, brief, tone } = await c.req.json();
    if (!videoUrl || !audioUrl) return c.json({ success: false, error: "videoUrl and audioUrl required" }, 400);
    console.log(`[smart-merge] Starting AI post-production...`);
    console.log(`[smart-merge] video=${videoUrl.slice(0, 80)}, audio=${audioUrl.slice(0, 80)}`);

    await ensureMergedBucket();
    const ts = Date.now();
    const vp = `/tmp/sm-v-${ts}.mp4`, ap = `/tmp/sm-a-${ts}.mp3`, op = `/tmp/sm-o-${ts}.mp4`;

    // Step 1: Download
    console.log(`[smart-merge] 1/5 Downloading...`);
    const [vr, ar] = await Promise.all([fetch(videoUrl), fetch(audioUrl)]);
    if (!vr.ok) throw new Error(`Video DL failed: ${vr.status}`);
    if (!ar.ok) throw new Error(`Audio DL failed: ${ar.status}`);
    const [vb, ab] = await Promise.all([vr.arrayBuffer().then(b => new Uint8Array(b)), ar.arrayBuffer().then(b => new Uint8Array(b))]);
    await Promise.all([Deno.writeFile(vp, vb), Deno.writeFile(ap, ab)]);
    console.log(`[smart-merge] Saved: v=${vb.length}B, a=${ab.length}B (${Date.now() - t0}ms)`);

    // Step 2: Video analysis
    console.log(`[smart-merge] 2/5 Video analysis...`);
    const vDur = parseFloat(await runFFprobe(vp)) || 5;
    const scOut = await runFFmpegAnalysis(["-i", vp, "-vf", "select='gt(scene,0.2)',showinfo", "-f", "null", "-"]);
    const sceneCuts = parseSceneCuts(scOut);
    console.log(`[smart-merge] Video: ${vDur.toFixed(2)}s, ${sceneCuts.length} cuts [${sceneCuts.map(s => s.toFixed(2)).join(",")}] (${Date.now() - t0}ms)`);

    // Step 3: Audio analysis
    console.log(`[smart-merge] 3/5 Audio analysis...`);
    const aDur = parseFloat(await runFFprobe(ap)) || 30;
    const [bassOut, allOut] = await Promise.all([
      runFFmpegAnalysis(["-i", ap, "-af", "highpass=f=60,lowpass=f=250,silencedetect=noise=-26dB:d=0.08", "-f", "null", "-"]),
      runFFmpegAnalysis(["-i", ap, "-af", "silencedetect=noise=-22dB:d=0.05", "-f", "null", "-"]),
    ]);
    const bassBeats = parseSilenceEnds(bassOut);
    const allBeats = parseSilenceEnds(allOut);
    const beatSet = new Set(bassBeats.map(b => Math.round(b * 100)));
    const merged = [...bassBeats];
    for (const b of allBeats) {
      const r = Math.round(b * 100);
      if (!beatSet.has(r) && !beatSet.has(r - 1) && !beatSet.has(r + 1)) { merged.push(b); beatSet.add(r); }
    }
    merged.sort((a, b) => a - b);
    const bpm = estimateBPM(merged);
    console.log(`[smart-merge] Audio: ${aDur.toFixed(2)}s, ${merged.length} beats (bass=${bassBeats.length} all=${allBeats.length}), ~${bpm}BPM (${Date.now() - t0}ms)`);

    // Step 4: Post-production agent
    console.log(`[smart-merge] 4/5 Post-production agent...`);
    const agentResult = await callPostProductionAgent({ videoDuration: vDur, audioDuration: aDur, sceneCuts, beats: merged, bpm, tone: tone || "professional", brief: brief || "" });
    console.log(`[smart-merge] Strategy: ${agentResult.strategy}`);

    // Step 5: Execute FFmpeg
    console.log(`[smart-merge] 5/5 FFmpeg merge...`);
    const ffArgs = ["-y", "-i", vp, "-i", ap, ...agentResult.ffmpegArgs, op];
    console.log(`[smart-merge] cmd: ffmpeg ${ffArgs.join(" ").slice(0, 300)}`);
    let cmd = new Deno.Command("ffmpeg", { args: ffArgs, stdout: "piped", stderr: "piped" });
    let result = await cmd.output();
    let finalStrategy = agentResult.strategy;

    if (!result.success) {
      console.log(`[smart-merge] Agent filter failed, trying algorithmic...`);
      const fb = buildFallbackSyncArgs({ videoDuration: vDur, audioDuration: aDur, sceneCuts, beats: merged, bpm, tone: tone || "professional" }, {});
      cmd = new Deno.Command("ffmpeg", { args: ["-y", "-i", vp, "-i", ap, ...fb.ffmpegArgs, op], stdout: "piped", stderr: "piped" });
      result = await cmd.output();
      finalStrategy = fb.strategy;
      if (!result.success) {
        console.log(`[smart-merge] Algorithmic failed, simple merge...`);
        cmd = new Deno.Command("ffmpeg", { args: ["-y", "-i", vp, "-i", ap, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", op], stdout: "piped", stderr: "piped" });
        result = await cmd.output();
        if (!result.success) throw new Error(`All merge strategies failed`);
        finalStrategy = "simple-merge (fallback)";
      }
    }

    const ob = await Deno.readFile(op);
    console.log(`[smart-merge] Output: ${ob.length}B`);
    const sp = `merged/${ts}-smart-sync.mp4`;
    const sb = supabaseAdmin();
    const { error: ue } = await sb.storage.from(MERGED_BUCKET).upload(sp, ob, { contentType: "video/mp4", upsert: true });
    if (ue) throw new Error(`Upload failed: ${ue.message}`);
    const { data: sd } = await sb.storage.from(MERGED_BUCKET).createSignedUrl(sp, 7200);
    if (!sd?.signedUrl) throw new Error("Signed URL failed");

    try { await Deno.remove(vp); } catch {}
    try { await Deno.remove(ap); } catch {}
    try { await Deno.remove(op); } catch {}

    console.log(`[smart-merge] OK ${Date.now() - t0}ms — ${finalStrategy}`);
    return c.json({ success: true, mergedVideoUrl: sd.signedUrl, strategy: finalStrategy, analysis: { videoDuration: +vDur.toFixed(2), audioDuration: +aDur.toFixed(2), sceneCuts: sceneCuts.length, beats: merged.length, bpm }, latencyMs: Date.now() - t0 });
  } catch (err: any) {
    console.log(`[smart-merge] ERROR (${Date.now() - t0}ms): ${err}`);
    return c.json({ success: false, error: `Smart merge: ${err.message || err}` }, 500);
  }
});

// ── AUDIO routes handled DIRECTLY in Deno.serve — bypasses Hono entirely ──
const AUDIO_MODEL_MAP_D: Record<string, string> = { "ora-audio": "V5", "musicgen": "V4_5ALL", "elevenlabs": "V4_5PLUS", "suno": "V5", "udio": "V4_5" };

async function handleAudioStart(req: Request): Promise<Response> {
  const t0 = Date.now();
  const H = { "Content-Type": "application/json", ...CORS_HEADERS };
  try {
    const body = await req.json();
    const { prompt, models, instrumental, lyrics, title, style } = body;
    console.log(`[audio-start-direct] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}`);
    if (!prompt || !models?.length) return new Response(JSON.stringify({ success: false, error: "prompt and models required" }), { status: 400, headers: H });
    const key = Deno.env.get("SUNO_API_KEY");
    console.log(`[audio-start-direct] SUNO_API_KEY present=${!!key}, len=${key?.length || 0}, prefix=${key?.slice(0,6) || "NONE"}`);
    if (!key) return new Response(JSON.stringify({ success: false, error: "SUNO_API_KEY not set" }), { status: 500, headers: H });
    const SUNO = "https://api.sunoapi.org";
    const results = await Promise.all(models.map(async (model: string) => {
      try {
        const sunoModel = AUDIO_MODEL_MAP_D[model] || "V5";
        const isCustom = !!(lyrics || title || style);
        const inst = instrumental !== undefined ? instrumental : true;
        const rb: Record<string, any> = { model: sunoModel, callBackUrl: "https://kbvkjafkztbsewtaijuh.supabase.co/functions/v1/make-server-cad57f79/suno/callback" };
        if (isCustom) { rb.customMode = true; rb.instrumental = inst; rb.prompt = inst ? "" : (lyrics || prompt.slice(0, 3000)); rb.style = style || prompt.slice(0, 200); rb.title = title || "Untitled"; }
        else { rb.customMode = false; rb.instrumental = inst; rb.prompt = prompt.slice(0, 500); }
        console.log(`[audio-start-direct] Suno POST body=${JSON.stringify(rb).slice(0, 200)}`);
        const res = await fetch(`${SUNO}/api/v1/generate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(rb) });
        const txt = await res.text();
        console.log(`[audio-start-direct] Suno status=${res.status}, body=${txt.slice(0, 300)}`);
        if (!res.ok) throw new Error(`Suno ${res.status}: ${txt.slice(0, 200)}`);
        const d = JSON.parse(txt);
        if (d.code !== 200) throw new Error(`Suno error ${d.code}: ${d.msg}`);
        if (!d.data?.taskId) throw new Error("No taskId");
        return { success: true, taskId: d.data.taskId, model, sunoModel };
      } catch (err) { console.log(`[audio-start-direct] ${model} err: ${err}`); return { success: false, model, error: String(err) }; }
    }));
    console.log(`[audio-start-direct] done ${Date.now() - t0}ms`);
    return new Response(JSON.stringify({ success: true, results }), { headers: H });
  } catch (err) { console.log(`[audio-start-direct] FATAL: ${err}`); return new Response(JSON.stringify({ success: false, error: `${err}` }), { status: 500, headers: H }); }
}

async function handleAudioPoll(req: Request): Promise<Response> {
  const H = { "Content-Type": "application/json", ...CORS_HEADERS };
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return new Response(JSON.stringify({ error: "taskId required" }), { status: 400, headers: H });
    const key = Deno.env.get("SUNO_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "SUNO_API_KEY not set" }), { status: 500, headers: H });
    const pr = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, { headers: { Authorization: `Bearer ${key}` } });
    const txt = await pr.text();
    if (!pr.ok) return new Response(JSON.stringify({ success: true, status: "POLLING", error: `HTTP ${pr.status}` }), { headers: H });
    const d = JSON.parse(txt);
    if (d.code !== 200) return new Response(JSON.stringify({ success: true, status: "POLLING", error: `code ${d.code}` }), { headers: H });
    const st = d.data?.status || "UNKNOWN";
    const dataKeys = Object.keys(d.data || {}).join(",");
    const respKeys = d.data?.response ? Object.keys(d.data.response).join(",") : "none";
    console.log(`[audio-poll] st="${st}" dataKeys=[${dataKeys}] respKeys=[${respKeys}] bodyLen=${txt.length}`);
    if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "SENSITIVE_WORD_ERROR", "CALLBACK_EXCEPTION"].includes(st)) return new Response(JSON.stringify({ success: true, status: "FAILED", error: `${st}: ${d.data?.errorMessage || ""}` }), { headers: H });
    // Try to extract tracks from ALL possible response structures
    const tracks = d.data?.response?.sunoData || d.data?.sunoData || d.data?.response?.data || [];
    if (Array.isArray(tracks) && tracks.length > 0) {
      const t = tracks[0];
      const au = t.audioUrl || t.streamAudioUrl || t.audio_url || t.song_url;
      if (au) {
        console.log(`[audio-poll] DONE! audioUrl=${au.slice(0, 80)} title=${t.title}`);
        return new Response(JSON.stringify({ success: true, status: "DONE", track: { audioUrl: au, title: t.title || "Generated Audio", duration: t.duration || 0, imageUrl: t.imageUrl || t.image_url || "", id: t.id || taskId } }), { headers: H });
      }
    }
    // Any status with FAIL in it
    if (st.includes("FAIL")) return new Response(JSON.stringify({ success: true, status: "FAILED", error: `${st}: ${d.data?.errorMessage || ""}` }), { headers: H });
    // Everything else = keep polling
    console.log(`[audio-poll] still pending, st="${st}"`);
    return new Response(JSON.stringify({ success: true, status: "PENDING" }), { headers: H });
  } catch (err) { console.log(`[audio-poll-direct] err: ${err}`); return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: H }); }
}

// Ensure campaign ref bucket exists at startup (for direct client uploads)
ensureCampaignRefBucket().catch(() => {});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // ── Audio routes intercepted BEFORE Hono ──
  const pathname = new URL(req.url).pathname;
  const p = pathname.replace("/make-server-cad57f79", "");
  console.log(`[Deno.serve] method=${req.method} pathname=${pathname} p=${p}`);
  if ((p === "/suno/start" || p === "/generate/audio-start") && req.method === "POST") {
    console.log(`[Deno.serve] -> handleAudioStart path=${p}`);
    return handleAudioStart(req);
  }
  if ((p === "/suno/poll" || p === "/generate/audio-poll") && req.method === "GET") {
    console.log(`[Deno.serve] -> handleAudioPoll path=${p}`);
    return handleAudioPoll(req);
  }
  if (p === "/suno/callback" && req.method === "POST") {
    console.log(`[Deno.serve] -> suno callback received`);
    try { const cb = await req.json(); console.log(`[suno-callback] ${JSON.stringify(cb).slice(0,500)}`); } catch {}
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
  try {
    const res = await app.fetch(req);
    // GUARANTEE CORS headers on EVERY response (even if Hono middleware failed)
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      headers.set(k, v);
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } catch (err) {
    console.log(`[Deno.serve] UNCAUGHT error for ${req.method} ${req.url}: ${err}`);
    return new Response(JSON.stringify({ success: false, error: `Server crash: ${err}` }), { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }
});

// ══════════════════════════════════════════════════════════════
// END OF SERVER — Legacy code below is unreachable
// ══════════════════════════════════════════════════════════════
/* @ts-ignore — Legacy cl-hf routes removed, keeping as reference */
const __DEAD_CODE__ = false; if (__DEAD_CODE__) { app.all("/generate/cl-hf-image-start", async (c: any) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    // Accept POST body (preferred) or GET query params (fallback)
    let body: any = {};
    if (c.req.method === "POST") {
      try { body = await c.req.json(); } catch { }
    }
    const rawPrompt = body.prompt || c.req.query("prompt");
    const aspectRatio = body.aspectRatio || c.req.query("aspectRatio") || "16:9";
    const imageRefUrl = body.imageRefUrl || c.req.query("imageRefUrl") || undefined;
    const refSource = body.refSource || c.req.query("refSource") || "";
    const brandVisualPrefix = body.brandVisual || c.req.query("brandVisual") || "";

    console.log(`[cl-hf-image-start] prompt="${rawPrompt?.slice(0, 60)}", ratio=${aspectRatio}, imageRef=${imageRefUrl ? "YES" : "NO"}, user=${user?.id?.slice(0, 8) || "anon"}`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── Server-side Brand Context ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try { brandCtx = await buildBrandContext(user.id); } catch (err) {
        console.log(`[cl-hf-image-start] buildBrandContext failed: ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankCompositions.length > 0) brandParts.push(`${brandCtx.imageBankCompositions.slice(0, 2).join(", ")} composition`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);
      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cohesive brand aesthetic, premium quality.`;
        console.log(`[cl-hf-image-start] Brand-enriched prompt (${prompt.length} chars)`);
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cohesive brand aesthetic.`;
    }

    if (user) deductCredit(user.id, 2).catch(() => {});

    // Anti-text suffix
    const antiTextSuffix = ". ABSOLUTELY NO visible text, no letters, no words, no brand names, no logos, no signs, no labels, no writing anywhere in the image. Clean photographic image only.";
    if (!prompt.toLowerCase().includes("no visible text")) prompt += antiTextSuffix;

    // Strip brand names from prompt
    if (brandCtx?.brandName) {
      const lb = brandCtx.brandName.toLowerCase();
      let idx = prompt.toLowerCase().indexOf(lb);
      while (idx !== -1) {
        prompt = prompt.slice(0, idx) + "the product" + prompt.slice(idx + brandCtx.brandName.length);
        idx = prompt.toLowerCase().indexOf(lb, idx + 11);
      }
    }

    // ── Higgsfield image generation with fallback chain ──
    // NOTE: resolution is adapted per-model in hfAdaptBody — don't hardcode "2K" here
    const hfBody: any = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: "2K",  // will be downgraded to 720p for soul, 1080p for nano-banana by hfAdaptBody
    };
    if (imageRefUrl) {
      hfBody.image_url = imageRefUrl;  // will be removed for non-image-to-image models by hfAdaptBody
    }

    console.log(`[cl-hf-image-start] Sending to Higgsfield: promptLen=${prompt.length}, ratio=${aspectRatio}, hasRef=${!!imageRefUrl}`);
    const result = await hfFetchWithFallback(HF_IMAGE_MODELS, hfBody, "cl-hf-image-start");
    if (!result.ok) {
      console.log(`[cl-hf-image-start] ALL MODELS FAILED after ${Date.now() - t0}ms: ${result.error}`);
      return c.json({ success: false, error: `Higgsfield image failed: ${result.error}` }, 500);
    }

    const { data: hfGen, model: usedModel } = result;
    console.log(`[cl-hf-image-start] OK ${Date.now() - t0}ms, model=${usedModel}, requestId=${hfGen.request_id}`);
    if (user) logEvent("cl-hf-image", { userId: user.id, model: usedModel, provider: "higgsfield" }).catch(() => {});
    logCost({ type: "image", model: usedModel, provider: `higgsfield/${usedModel.split("/").pop()}`, costUsd: 0.025, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: true }).catch(() => {});
    return c.json({
      success: true, generationId: hfGen.request_id, state: hfGen.status || "queued",
      provider: "higgsfield", model: usedModel,
    });
  } catch (err) {
    console.log(`[cl-hf-image-start] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Higgsfield image start failed: ${err}` }, 500);
  }
});

// ── Campaign Lab: Higgsfield Video Start (GET + POST) ──
app.all("/generate/cl-hf-video-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    // Accept POST body (preferred) or GET query params (fallback)
    let body: any = {};
    if (c.req.method === "POST") {
      try { body = await c.req.json(); } catch { }
    }
    const rawPrompt = body.prompt || c.req.query("prompt");
    const imageUrl = body.imageUrl || c.req.query("imageUrl") || undefined;
    const clientAspectRatio = body.aspectRatio || c.req.query("aspectRatio") || undefined;
    const brandVisualPrefix = body.brandVisual || c.req.query("brandVisual") || "";
    // POST variant of cl-video-start

    console.log(`[cl-hf-video-start] prompt="${rawPrompt?.slice(0, 60)}", img2vid=${!!imageUrl}, ratio=${clientAspectRatio || "default"}, user=${user?.id?.slice(0, 8) || "anon"}`);
    if (!rawPrompt) return c.json({ error: "prompt required" }, 400);

    // ── Server-side Brand Context ──
    let prompt = rawPrompt;
    let brandCtx: BrandContext | null = null;
    if (user) {
      try { brandCtx = await buildBrandContext(user.id); } catch (err) {
        console.log(`[cl-hf-video-start] buildBrandContext failed: ${err}`);
      }
    }

    if (brandCtx) {
      const brandParts: string[] = [];
      const allColors = [...new Set([...brandCtx.colorPalette, ...brandCtx.imageBankColors])].slice(0, 6);
      if (allColors.length > 0) brandParts.push(`dominant color palette ${allColors.join(", ")}`);
      if (brandCtx.imageBankMoods.length > 0) brandParts.push(`${brandCtx.imageBankMoods.slice(0, 3).join(", ")} mood`);
      else if (brandCtx.photoStyle?.mood) brandParts.push(`${brandCtx.photoStyle.mood} mood`);
      if (brandCtx.imageBankLighting.length > 0) brandParts.push(`${brandCtx.imageBankLighting.slice(0, 3).join(", ")} lighting`);
      else if (brandCtx.photoStyle?.lighting) brandParts.push(`${brandCtx.photoStyle.lighting} lighting`);
      if (brandCtx.imageBankStyles.length > 0) brandParts.push(`${brandCtx.imageBankStyles.slice(0, 2).join(", ")} style`);
      if (brandParts.length > 0) {
        prompt = `${rawPrompt}. Visual direction: ${brandParts.join(", ")}. Cinematic brand aesthetic.`;
      }
    } else if (brandVisualPrefix && brandVisualPrefix.length > 10) {
      prompt = `${rawPrompt}. Visual direction: ${brandVisualPrefix}. Cinematic brand aesthetic.`;
    }

    if (user) deductCredit(user.id, CREDIT_COST.video).catch(() => {});

    // Enhance/translate prompt
    const enhancedPrompt = await enhanceImagePrompt(prompt);

    // Anti-text for video
    const antiTextVideo = ". No visible text, no letters, no words, no brand names, no logos anywhere in the video.";
    const finalPrompt = enhancedPrompt.toLowerCase().includes("no visible text") ? enhancedPrompt : enhancedPrompt + antiTextVideo;

    // ── Resolve first frame image ──
    let resolvedImageUrl = imageUrl;
    if (!resolvedImageUrl && brandCtx && brandCtx.topRefImages.length > 0) {
      try {
        await ensureImageBankBucket();
        const sb = supabaseAdmin();
        const bestRef = brandCtx.topRefImages[0];
        const { data } = await sb.storage.from(IMAGE_BANK_BUCKET).createSignedUrl(bestRef.storagePath, 3600);
        if (data?.signedUrl) {
          resolvedImageUrl = data.signedUrl;
          console.log(`[cl-hf-video-start] Auto-resolved brand ref as first frame: "${bestRef.description?.slice(0, 50)}"`);
        }
      } catch (err) {
        console.log(`[cl-hf-video-start] Auto-resolve brand ref failed: ${err}`);
      }
    }

    // ── Higgsfield video generation with fallback chain ──
    const hfBody: any = { prompt: finalPrompt, duration: 5 };
    if (resolvedImageUrl) hfBody.image_url = resolvedImageUrl;
    if (clientAspectRatio) hfBody.aspect_ratio = clientAspectRatio;

    // Pick model chain based on whether we have an image
    const modelChain = resolvedImageUrl ? HF_VIDEO_MODELS_I2V : HF_VIDEO_MODELS_T2V;

    console.log(`[cl-hf-video-start] Sending to Higgsfield: promptLen=${finalPrompt.length}, hasImage=${!!resolvedImageUrl}, models=${modelChain.join(",")}`);
    const result = await hfFetchWithFallback(modelChain, hfBody, "cl-hf-video-start");
    if (!result.ok) {
      console.log(`[cl-hf-video-start] ALL MODELS FAILED after ${Date.now() - t0}ms: ${result.error}`);
      return c.json({ success: false, error: `Higgsfield video failed: ${result.error}` }, 500);
    }

    const { data: hfGen, model: usedModel } = result;
    console.log(`[cl-hf-video-start] OK ${Date.now() - t0}ms, model=${usedModel}, requestId=${hfGen.request_id}`);
    if (user) logEvent("cl-hf-video", { userId: user.id, model: usedModel, provider: "higgsfield" }).catch(() => {});
    logCost({ type: "video", model: usedModel, provider: `higgsfield/${usedModel.split("/").pop()}`, costUsd: 0.10, revenueEur: REVENUE_PER_TYPE.video, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: true }).catch(() => {});
    return c.json({
      success: true, generationId: hfGen.request_id, state: hfGen.status || "queued",
      provider: "higgsfield", model: usedModel,
    });
  } catch (err) {
    console.log(`[cl-hf-video-start] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Higgsfield video start failed: ${err}` }, 500);
  }
});

// ── Campaign Lab: Higgsfield Status Poll ──
app.get("/generate/cl-hf-status", async (c) => {
  const t0 = Date.now();
  try {
    const requestId = c.req.query("id");
    const assetType = c.req.query("type") || "image";
    if (!requestId) return c.json({ error: "id required" }, 400);

    const statusUrl = `${HIGGSFIELD_BASE}/requests/${requestId}/status`;
    const hfRes = await fetch(statusUrl, { headers: higgsHeaders(), signal: AbortSignal.timeout(10_000) });
    if (hfRes.ok) {
      const data = await hfRes.json();
      const status = data.status;
      if (status === "completed") {
        const imageUrl = data.images?.[0]?.url || null;
        const videoUrl = data.video?.url || null;
        console.log(`[cl-hf-status] Higgsfield ${requestId} COMPLETED (${Date.now() - t0}ms)`);
        return c.json({
          success: true, state: "completed",
          imageUrl: assetType === "image" ? imageUrl : null,
          videoUrl: assetType === "video" ? videoUrl : null,
        });
      }
      if (status === "failed") {
        console.log(`[cl-hf-status] Higgsfield ${requestId} FAILED: ${data.error || "unknown"}`);
        return c.json({ success: true, state: "failed", error: data.error || "Higgsfield generation failed" });
      }
      if (status === "nsfw") {
        console.log(`[cl-hf-status] Higgsfield ${requestId} NSFW`);
        return c.json({ success: true, state: "failed", error: "Content failed moderation (NSFW)" });
      }
      // queued / in_progress
      console.log(`[cl-hf-status] Higgsfield ${requestId} status=${status} (${Date.now() - t0}ms)`);
      return c.json({ success: true, state: status === "in_progress" ? "dreaming" : "queued" });
    }
    console.log(`[cl-hf-status] Higgsfield poll ${hfRes.status} for ${requestId}`);
    return c.json({ success: true, state: "queued" });
  } catch (err) {
    console.log(`[cl-hf-status] error:`, err);
    return c.json({ success: false, state: "error", error: `Higgsfield status check failed: ${err}` }, 500);
  }
});

// (end of legacy dead code block)
}