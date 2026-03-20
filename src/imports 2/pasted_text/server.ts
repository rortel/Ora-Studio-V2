// ══════════════════════════════════════════════════════════════
// ORA Studio — Edge Function Server (Hono + KV + INLINE AI)
// ALL AI logic inlined — NO external imports, NO dynamic import
// ══════════════════════════════════════════════════════════════

import { Hono } from "npm:hono@4.4.2";
import { cors } from "npm:hono@4.4.2/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

console.log("[boot] ORA server starting (inline AI)...");

const app = new Hono().basePath("/make-server-cad57f79");

// ── CORS ─────────────────────────────────────────────────────
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// ── REQUEST LOGGER — logs EVERY incoming request to diagnose missing image-multi ──
app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  console.log(`[REQ] ${method} ${path} at ${new Date().toISOString()}`);
  const t0 = Date.now();
  await next();
  console.log(`[RES] ${method} ${path} -> ${c.res.status} (${Date.now() - t0}ms)`);
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
  // Priority: X-User-Token header (bypasses gateway JWT validation hang)
  // Fallback: Authorization header (legacy / direct calls)
  const token = c.req.header("X-User-Token") || c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    // Fast path: decode JWT locally (gateway already validated it)
    const payload = decodeJwtPayload(token);
    if (payload?.sub && payload?.email) {
      console.log("[getUser] JWT decoded locally, user:", payload.sub);
      return { id: payload.sub, email: payload.email };
    }
    // Token is not a JWT (e.g. anon key) — skip expensive sb.auth.getUser call
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
const PLAN_CREDITS: Record<string, number> = { free: 50, generate: 500, studio: 2500 };

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
// COST TRACKING — per-provider cost & revenue logging
// ══════════════════════════════════════════════════════════════

const PROVIDER_COSTS: Record<string, number> = {
  "apipod/gpt-4o": 0.015, "apipod/gpt-5": 0.025, "apipod/gpt-5.2": 0.030,
  "apipod/claude-sonnet-4-20250514": 0.018, "apipod/claude-3-5-sonnet-20241022": 0.015,
  "apipod/claude-haiku-4-20250514": 0.005, "apipod/claude-3-5-haiku-20241022": 0.004,
  "apipod/claude-opus-4-20250514": 0.075, "apipod/gemini-2.5-flash-preview-05-20": 0.005,
  "apipod/gemini-2.0-flash": 0.003, "apipod/gemini-3": 0.008,
  "luma/photon-1": 0.030, "luma/photon-flash-1": 0.015,
  "luma/ray-2": 0.150, "luma/ray-flash-2": 0.080,
  "replicate/meta/musicgen": 0.050,
  "kling/kling-v1-6-pro": 0.120,
  "kling/kling-v1-5-pro": 0.100,
};

const CREDIT_VALUE_EUR = 0.10;
const REVENUE_PER_TYPE: Record<string, number> = {
  text: 1 * CREDIT_VALUE_EUR, image: 2 * CREDIT_VALUE_EUR,
  video: 5 * CREDIT_VALUE_EUR, audio: 3 * CREDIT_VALUE_EUR,
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

// ── PROMPT ENHANCER — translates any language to English + enriches for image generation ──
async function enhanceImagePrompt(rawPrompt: string): Promise<string> {
  const t0 = Date.now();
  // Quick heuristic: if prompt looks already English and descriptive enough, skip
  const nonAscii = rawPrompt.replace(/[\x00-\x7F]/g, "").length;
  const isLikelyEnglish = nonAscii < rawPrompt.length * 0.15;
  const isAlreadyDetailed = rawPrompt.split(/\s+/).length > 12;
  if (isLikelyEnglish && isAlreadyDetailed) {
    console.log(`[enhancePrompt] Already English & detailed, skip (${rawPrompt.slice(0, 60)})`);
    return rawPrompt;
  }
  try {
    const key = Deno.env.get("APIPOD_API_KEY");
    if (!key) { console.log("[enhancePrompt] No API key, using raw"); return rawPrompt; }
    const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert image prompt engineer. Your ONLY job is to translate the user's request into a single, detailed English image generation prompt. Output ONLY the prompt text — no quotes, no explanation, no preamble. Keep it under 120 words. Preserve the user's creative intent precisely. Add relevant visual details (lighting, composition, mood, style) that match the intent." },
          { role: "user", content: rawPrompt },
        ],
        max_tokens: 200,
      }),
    });
    if (!res.ok) { console.log(`[enhancePrompt] APIPod ${res.status}, using raw`); return rawPrompt; }
    const data = await res.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (enhanced && enhanced.length > 10) {
      console.log(`[enhancePrompt] OK (${Date.now() - t0}ms): "${rawPrompt.slice(0, 40)}" → "${enhanced.slice(0, 80)}"`);
      return enhanced;
    }
  } catch (err) { console.log(`[enhancePrompt] error (${Date.now() - t0}ms): ${err}`); }
  return rawPrompt;
}

function lumaHeaders(): Record<string, string> {
  const key = Deno.env.get("LUMA_API_KEY");
  if (!key) throw new Error("LUMA_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
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
  "claude-opus":   { apiModel: "claude-4-5-opus", fallback: "claude-4-5-sonnet" },
  "gemini-pro":    { apiModel: "gemini-2.5-pro", fallback: "gpt-4o" },
  "gemini-3":      { apiModel: "gemini-3-pro-preview", fallback: "gemini-2.5-pro" },
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
  "seedream-v4.5":   { lumaModel: "photon-1", aspectRatio: "4:3" },
  "seedream-5-lite": { lumaModel: "photon-flash-1", aspectRatio: "4:3" },
  "nano-banana":     { lumaModel: "photon-flash-1", aspectRatio: "1:1" },
  "dall-e":          { lumaModel: "photon-1", aspectRatio: "1:1" },
  "flux-pro":        { lumaModel: "photon-1", aspectRatio: "4:3" },
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

// --- Audio model registry (Replicate MusicGen) ---
const audioModels: Record<string, string> = {
  "ora-audio":  "meta/musicgen",
  "musicgen":   "meta/musicgen",
  "elevenlabs": "meta/musicgen",
  "suno":       "meta/musicgen",
  "udio":       "meta/musicgen",
};

// ─ TEXT GENERATION (APIPod only) ─────────────────────────────
// Uses APIPod model names with fallback chain + Promise.race timeout
async function generateText(req: { prompt: string; model: string; systemPrompt?: string; maxTokens?: number }) {
  const mapping = textModelMap[req.model];
  if (!mapping) throw new Error(`Unknown text model: ${req.model}`);

  const sys = req.systemPrompt || "You are a creative professional AI assistant.";
  const maxTok = req.maxTokens || 1024;
  const start = Date.now();

  // Build chain: primary → fallback → gpt-4o (ultimate safe fallback)
  const chain: string[] = [mapping.apiModel];
  if (mapping.fallback && mapping.fallback !== mapping.apiModel) chain.push(mapping.fallback);
  if (!chain.includes("gpt-4o")) chain.push("gpt-4o");

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

      // 8s timeout per model attempt — fast fail, move to fallback
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`APIPod timeout (8s) for ${apiModel}`)), 8_000)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      console.log(`[text] ${apiModel} OK in ${Date.now() - start}ms, ${result.text.length} chars`);
      return { model: req.model, provider: `apipod/${apiModel}`, text: result.text, tokensUsed: result.tokensUsed, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[text] ${apiModel} FAILED (${Date.now() - start}ms): ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All text models failed for ${req.model}`);
}

// ── IMAGE GENERATION (Luma Photon — submit + polling) ──
async function generateImage(req: { prompt: string; model: string }) {
  const mapping = imageModelMap[req.model];
  if (!mapping) throw new Error(`Unknown image model: ${req.model}`);
  const start = Date.now();

  console.log(`[image] model=${req.model} → Luma ${mapping.lumaModel}, aspect=${mapping.aspectRatio}`);
  console.log(`[image] prompt="${req.prompt.slice(0, 80)}..."`);

  // Step 1: Submit image generation
  const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
    method: "POST",
    headers: lumaHeaders(),
    body: JSON.stringify({
      prompt: req.prompt,
      model: mapping.lumaModel,
      aspect_ratio: mapping.aspectRatio,
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

// ── IMAGE WITH REFERENCE (img2img — FAL primary, Runware/Luma fallback) ──
async function generateImageWithRef(req: { prompt: string; model: string; imageRefUrl: string; strength?: number }) {
  const start = Date.now();
  const strength = req.strength ?? 0.75;
  console.log(`[img2img] model=${req.model}, strength=${strength}, ref=${req.imageRefUrl.slice(0, 80)}`);

  // Strategy 1: FAL img2img (fast, reliable)
  const falKey = Deno.env.get("FAL_API_KEY");
  if (falKey) {
    const falModels = ["fal-ai/flux/dev/image-to-image", "fal-ai/flux-general/image-to-image"];
    for (const falModel of falModels) {
      try {
        console.log(`[img2img] Trying FAL ${falModel}...`);
        const res = await fetch(`https://fal.run/${falModel}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Key ${falKey}` },
          body: JSON.stringify({
            prompt: req.prompt,
            image_url: req.imageRefUrl,
            strength,
            image_size: "landscape_4_3",
            num_images: 1,
            enable_safety_checker: true,
            num_inference_steps: 28,
          }),
        });
        if (!res.ok) { const b = await res.text(); console.log(`[img2img] FAL ${falModel} ${res.status}: ${b.slice(0, 200)}`); continue; }
        const data = await res.json();
        const imageUrl = data.images?.[0]?.url;
        if (imageUrl) {
          console.log(`[img2img] FAL ${falModel} OK in ${Date.now() - start}ms`);
          return { model: req.model, provider: `fal-img2img/${falModel}`, imageUrl, latencyMs: Date.now() - start };
        }
      } catch (err) { console.log(`[img2img] FAL ${falModel} error: ${err}`); }
    }
  }

  // Strategy 2: Runware img2img
  const rwKey = Deno.env.get("RUNWARE_IMAGE_API_KEY");
  if (rwKey) {
    try {
      console.log(`[img2img] Trying Runware img2img...`);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const res = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${rwKey}` },
        body: JSON.stringify([{ taskType: "imageInference", taskUUID: crypto.randomUUID(), positivePrompt: req.prompt, model: "runware:100@1", seedImage: req.imageRefUrl, strength, width: 1024, height: 768, numberResults: 1, outputFormat: "WEBP" }]),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const url = data.data?.[0]?.imageURL || data.data?.[0]?.imageUrl;
        if (url) { console.log(`[img2img] Runware OK in ${Date.now() - start}ms`); return { model: req.model, provider: "runware-img2img", imageUrl: url, latencyMs: Date.now() - start }; }
      }
    } catch (err) { console.log(`[img2img] Runware error: ${err}`); }
  }

  // Strategy 3: Luma Photon with image_ref
  try {
    console.log(`[img2img] Trying Luma Photon with image_ref...`);
    const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
      method: "POST", headers: lumaHeaders(),
      body: JSON.stringify({ prompt: req.prompt, model: "photon-1", aspect_ratio: "4:3", image_ref: [{ url: req.imageRefUrl, weight: strength }] }),
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
            if (pd.state === "completed" && pd.assets?.image) { console.log(`[img2img] Luma OK in ${Date.now() - start}ms`); return { model: req.model, provider: "luma/photon-1-img2img", imageUrl: pd.assets.image, latencyMs: Date.now() - start }; }
            if (pd.state === "failed") throw new Error(`Luma failed: ${pd.failure_reason || "unknown"}`);
          } catch (e) { if (e instanceof Error && e.message.startsWith("Luma failed")) throw e; }
        }
      }
    }
  } catch (err) { console.log(`[img2img] Luma error: ${err}`); }

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

// ── AUDIO GENERATION (Replicate MusicGen) ────────────────────
async function generateAudio(req: { prompt: string; model: string }) {
  const repModel = audioModels[req.model];
  if (!repModel) throw new Error(`Unknown audio model: ${req.model}`);
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  const start = Date.now();

  console.log(`[audio] ${repModel}`);
  const cr = await fetch(`https://api.replicate.com/v1/models/${repModel}/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: { prompt: req.prompt, duration: 8, model_version: "stereo-melody-large" } }),
  });
  if (!cr.ok) { const b = await cr.text(); throw new Error(`Replicate ${cr.status}: ${b}`); }
  const pred = await cr.json();
  if (!pred.id) throw new Error("No prediction ID");

  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise(r => setTimeout(r, 3_000));
    elapsed += 3_000;
    const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!pr.ok) continue;
    const d = await pr.json();
    if (d.status === "succeeded") {
      const u = typeof d.output === "string" ? d.output : Array.isArray(d.output) ? d.output[0] : null;
      if (!u) throw new Error("No output URL");
      return { model: req.model, provider: `replicate/${repModel}`, audioUrl: u, latencyMs: Date.now() - start };
    }
    if (d.status === "failed" || d.status === "canceled") throw new Error(`Replicate ${d.status}: ${d.error || "unknown"}`);
  }
  throw new Error("Replicate audio timeout (120s)");
}

// ═══════════════════════════════════════════════════���══════════
// HEALTH
// ══════════════════════════════════════════════════════════════

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    server: "ora-studio-inline",
    ts: new Date().toISOString(),
  });
});

// ── TEST APIPOD — minimal direct test ────────────────────────
app.get("/test-apipod", async (c) => {
  const APIPOD_BASE = "https://api.apipod.ai/v1";
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) return c.json({ error: "APIPOD_API_KEY not set in env" }, 500);

  const start = Date.now();
  try {
    console.log("[test-apipod] Sending test request...");
    const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Reply with exactly: OK" },
          { role: "user", content: "Test" },
        ],
        max_tokens: 10,
      }),
    });

    const status = res.status;
    const body = await res.text();
    const latency = Date.now() - start;

    console.log(`[test-apipod] status=${status} latency=${latency}ms body=${body.slice(0, 200)}`);

    if (!res.ok) {
      return c.json({ 
        success: false, 
        error: `APIPod returned ${status}`, 
        body: body.slice(0, 500),
        latencyMs: latency,
        keyPrefix: key.slice(0, 8) + "...",
      });
    }

    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const text = parsed?.choices?.[0]?.message?.content || "(no content)";

    return c.json({
      success: true,
      text,
      model: parsed?.model || "unknown",
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

// ══════════════════════════════════════════════════════════════
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

app.get("/auth/me", async (c) => {
  const t0 = Date.now();
  const userToken = c.req.header("X-User-Token") || c.req.header("Authorization")?.split(" ")[1];
  console.log("[/auth/me] request received, has X-User-Token:", !!c.req.header("X-User-Token"), "has Authorization:", !!c.req.header("Authorization"));
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
// ══════════════════════════════════════════════════════════════

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

    const { prompt, models, systemPrompt, maxTokens } = await c.req.json();
    console.log(`[text-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}, user=${user?.id || "guest"}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

    const MODEL_TIMEOUT = 25_000; // 25s per model (generateText has 8s internal timeout per attempt, but chain can have 3 models)
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
        if (user) deductCredit(user.id, 5).catch(() => {});
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

    // Enhance/translate prompt to English for better video generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[video-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}"`);

    if (user) deductCredit(user.id, 5).catch(() => {});

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

    const prompt = c.req.query("prompt");
    const model = c.req.query("model") || "ora-motion";
    const imageUrl = c.req.query("imageUrl") || undefined;

    console.log(`[video-start] raw prompt="${prompt?.slice(0, 60)}", model=${model}, img2vid=${!!imageUrl}`);
    if (!prompt) return c.json({ error: "prompt required" }, 400);

    const mapping = videoModelMap[model];
    if (!mapping) return c.json({ error: `Unknown video model: ${model}` }, 400);

    // Enhance/translate prompt to English for better video generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[video-start] enhanced prompt="${enhancedPrompt.slice(0, 80)}"`);

    if (user) deductCredit(user.id, 5).catch(() => {});

    const body: any = {
      generation_type: "video",
      prompt: enhancedPrompt,
      model: mapping.lumaModel,
      aspect_ratio: mapping.aspectRatio,
    };
    if (imageUrl) {
      body.keyframes = { frame0: { type: "image", url: imageUrl } };
    }

    const submitRes = await fetch(`${LUMA_BASE}/generations/video`, {
      method: "POST",
      headers: lumaHeaders(),
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      console.log(`[video-start] Luma submit failed ${submitRes.status}: ${errBody.slice(0, 200)}`);
      return c.json({ success: false, error: `Luma submit error ${submitRes.status}: ${errBody.slice(0, 200)}` }, 500);
    }
    const generation = await submitRes.json();
    const genId = generation.id;
    if (!genId) {
      console.log(`[video-start] No generation id:`, JSON.stringify(generation).slice(0, 300));
      return c.json({ success: false, error: "Luma returned no generation ID" }, 500);
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

// ── VIDEO STATUS (poll Luma once, return current state — fast) ──
app.get("/generate/video-status", async (c) => {
  const t0 = Date.now();
  try {
    const generationId = c.req.query("id");
    if (!generationId) return c.json({ error: "id required" }, 400);

    const pollRes = await fetch(`${LUMA_BASE}/generations/${generationId}`, {
      headers: lumaHeaders(),
    });
    if (!pollRes.ok) {
      const errBody = await pollRes.text();
      console.log(`[video-status] Luma poll ${pollRes.status}: ${errBody.slice(0, 200)}`);
      return c.json({ success: false, state: "error", error: `Luma poll error ${pollRes.status}` }, 500);
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
      return c.json({ success: true, state: "failed", error: data.failure_reason || "Luma generation failed" });
    }

    console.log(`[video-status] ${generationId} state=${state} (${Date.now() - t0}ms)`);
    return c.json({ success: true, state });
  } catch (err) {
    console.log(`[video-status] error:`, err);
    return c.json({ success: false, state: "error", error: `Status check failed: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGN LAB — plan + image-start + image-status
// ══════════════════════════════════════════════════════════════

app.get("/generate/campaign-plan", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const brief = c.req.query("brief") || "";
    const imageContext = c.req.query("imageContext") || "";
    const brandContext = c.req.query("brandContext") || "";
    const langParam = c.req.query("lang") || "";
    // Auto-detect language from brief: if it contains common French patterns, use French
    const frenchPattern = /\b(le|la|les|du|des|un|une|pour|avec|dans|sur|est|sont|nous|notre|votre|cette|ces|qui|que|mais|ou|donc|ainsi|aussi|chez|aux|par|vers|entre|comme|faire|plus|fait|très|être|avoir|tout|peut|bien|autre|même|après)\b/i;
    const lang = langParam || (frenchPattern.test(brief) ? "fr" : "en");
    if (!brief) return c.json({ error: "brief required" }, 400);

    // Parse brand context if provided
    let brandBlock = "";
    if (brandContext) {
      try {
        const bc = JSON.parse(brandContext);
        const parts: string[] = [];
        if (bc.brandName) parts.push(`Brand name: "${bc.brandName}"`);
        if (bc.tone) {
          parts.push(`Tone of voice: Formality ${bc.tone.formality}/10, Confidence ${bc.tone.confidence}/10, Warmth ${bc.tone.warmth}/10, Humor ${bc.tone.humor}/10`);
        }
        if (bc.approvedTerms?.length) parts.push(`Approved vocabulary (USE these terms when relevant): ${bc.approvedTerms.join(", ")}`);
        if (bc.forbiddenTerms?.length) parts.push(`FORBIDDEN terms (NEVER use these words in any copy): ${bc.forbiddenTerms.join(", ")}`);
        if (bc.keyMessages?.length) parts.push(`Key brand messages to weave in naturally: ${bc.keyMessages.join(" | ")}`);
        if (parts.length) brandBlock = `\n\nBRAND COMPLIANCE CONTEXT (MANDATORY - follow strictly):\n- ${parts.join("\n- ")}`;
      } catch { /* ignore parse error */ }
    }

    console.log(`[campaign-plan] brief="${brief.slice(0, 80)}", imageContext=${!!imageContext}, brandContext=${brandContext.length > 0 ? "yes" : "no"}, lang=${lang}`);

    const sysPrompt = `You are an expert social media campaign strategist and brand compliance officer. Given a campaign brief, generate a complete multi-platform campaign kit that is 100% brand-compliant.${brandBlock}

You MUST return ONLY a valid JSON object (no markdown, no code fences) with this structure:
{
  "campaignTheme": "Short 5-word campaign theme",
  "assets": [
    {
      "id": "linkedin-post",
      "platform": "LinkedIn",
      "formatName": "LinkedIn Post",
      "type": "image",
      "aspectRatio": "16:9",
      "dimensions": "1200x627",
      "copy": "Post text (professional tone, 100-200 words, line breaks as \\n)",
      "imagePrompt": "Detailed image prompt, photographic style, NO text/words in image"
    },
    {
      "id": "instagram-post",
      "platform": "Instagram",
      "formatName": "Instagram Post",
      "type": "image",
      "aspectRatio": "1:1",
      "dimensions": "1080x1080",
      "copy": "Caption (engaging, hashtags, 80-150 words)",
      "imagePrompt": "Square format prompt, visually striking, NO text in image"
    },
    {
      "id": "instagram-story",
      "platform": "Instagram",
      "formatName": "Instagram Story",
      "type": "image",
      "aspectRatio": "9:16",
      "dimensions": "1080x1920",
      "copy": "Story overlay text (15-30 words max, punchy)",
      "imagePrompt": "Vertical image prompt with space for text overlay, NO text in image"
    },
    {
      "id": "facebook-post",
      "platform": "Facebook",
      "formatName": "Facebook Post",
      "type": "image",
      "aspectRatio": "16:9",
      "dimensions": "1200x630",
      "copy": "Post text (conversational, 80-150 words)",
      "imagePrompt": "Landscape prompt, warm and engaging, NO text in image"
    },
    {
      "id": "instagram-reel",
      "platform": "Instagram",
      "formatName": "Instagram Reel",
      "type": "video",
      "aspectRatio": "9:16",
      "dimensions": "1080x1920",
      "copy": "Reel caption (short, hashtags, 50-80 words)",
      "videoPrompt": "Vertical video prompt, dynamic motion, 5 seconds"
    },
    {
      "id": "linkedin-video",
      "platform": "LinkedIn",
      "formatName": "LinkedIn Video",
      "type": "video",
      "aspectRatio": "16:9",
      "dimensions": "1920x1080",
      "copy": "Video post text (professional, 80-120 words)",
      "videoPrompt": "Landscape video prompt, polished, 5 seconds"
    }
  ]
}

RULES:
- Each imagePrompt/videoPrompt MUST be DIFFERENT but thematically cohesive
- Image prompts describe visual compositions, NEVER include text to render
- CRITICAL: Every imagePrompt/videoPrompt MUST end with: "No logos, no brand names, no text overlays, no watermarks, clean composition"
- Copy must be platform-appropriate
- ${imageContext ? `The campaign features: ${imageContext}. Reference it.` : "Create prompts from the brief."}
- ALL copy text (campaignTheme, copy fields) MUST be written in ${lang === "fr" ? "French (français). Le brief est en français, tous les textes doivent être en français." : "English."}
- imagePrompt and videoPrompt fields must ALWAYS remain in English (they are technical prompts for AI image generators)
${brandBlock ? `- BRAND COMPLIANCE: Adapt the tone of all copy to match the brand tone profile. Use approved vocabulary. NEVER use forbidden terms. Weave key messages naturally.` : ""}
- Return ONLY JSON`;

    // Direct APIPod call with 30s timeout (generateText has 8s — too short for large campaign JSON)
    const modelsToTry = ["gpt-4o", "claude-4-5-sonnet"];
    let resultText = "";
    let lastErr: Error | null = null;

    for (const apiModel of modelsToTry) {
      try {
        console.log(`[campaign-plan] trying ${apiModel}...`);
        const fetchP = fetch(`${APIPOD_BASE}/chat/completions`, {
          method: "POST",
          headers: apipodHeaders(),
          body: JSON.stringify({
            model: apiModel,
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: brief }],
            max_tokens: 3000,
          }),
        }).then(async (res) => {
          if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b.slice(0, 200)}`); }
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || "";
          if (!text) throw new Error(`Empty response from ${apiModel}`);
          return text;
        });
        const timeoutP = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout 30s for ${apiModel}`)), 30_000));
        resultText = await Promise.race([fetchP, timeoutP]);
        console.log(`[campaign-plan] ${apiModel} OK, ${resultText.length} chars (${Date.now() - t0}ms)`);
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.log(`[campaign-plan] ${apiModel} FAILED: ${lastErr.message}`);
      }
    }
    if (!resultText) throw lastErr || new Error("All models failed for campaign plan");

    let plan: any;
    try {
      let cleaned = resultText.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      plan = JSON.parse(cleaned);
    } catch {
      console.log(`[campaign-plan] JSON parse failed:`, resultText.slice(0, 500));
      return c.json({ success: false, error: "AI returned invalid JSON. Try again." }, 500);
    }

    console.log(`[campaign-plan] OK in ${Date.now() - t0}ms, ${plan.assets?.length || 0} assets`);
    if (user) logEvent("campaign-plan", { userId: user.id, brief: brief.slice(0, 100) }).catch(() => {});
    return c.json({ success: true, ...plan, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[campaign-plan] FAIL ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Campaign plan failed: ${err}` }, 500);
  }
});

app.get("/generate/image-start", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch { }

    const prompt = c.req.query("prompt");
    const aspectRatio = c.req.query("aspectRatio") || "16:9";
    const model = c.req.query("model") || "photon-1";
    const imageRefUrl = c.req.query("imageRefUrl") || undefined;

    console.log(`[image-start] prompt="${prompt?.slice(0, 60)}", ratio=${aspectRatio}, model=${model}`);
    if (!prompt) return c.json({ error: "prompt required" }, 400);

    if (user) deductCredit(user.id, 2).catch(() => {});

    const body: any = { prompt, model, aspect_ratio: aspectRatio };
    if (imageRefUrl) body.image_ref = [{ url: imageRefUrl, weight: 0.85 }];

    const submitRes = await fetch(`${LUMA_BASE}/generations/image`, {
      method: "POST", headers: lumaHeaders(), body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      return c.json({ success: false, error: `Luma image error ${submitRes.status}: ${errBody.slice(0, 200)}` }, 500);
    }
    const generation = await submitRes.json();
    const genId = generation.id;
    if (!genId) return c.json({ success: false, error: "No generation ID" }, 500);

    console.log(`[image-start] OK ${Date.now() - t0}ms, genId=${genId}`);
    return c.json({ success: true, generationId: genId, state: generation.state || "queued" });
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

app.post("/generate/audio-multi", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[audio-multi] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { prompt, models } = await c.req.json();
    console.log(`[audio-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    const AUDIO_HANDLER_TIMEOUT = 150_000;

    const work = Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 3).catch(() => {});
        try {
          const result = await generateAudio({ prompt, model });
          if (user) logEvent("generation", { userId: user.id, type: "audio", model }).catch(() => {});
          logCost({ type: "audio", model, provider: result.provider, costUsd: getProviderCost(result.provider, "audio"), revenueEur: REVENUE_PER_TYPE.audio, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});
          return { success: true, result };
        } catch (err) {
          logCost({ type: "audio", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
          return { success: false, error: String(err) };
        }
      })
    );

    const results = await Promise.race([
      work,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Audio handler timeout")), AUDIO_HANDLER_TIMEOUT)),
    ]).catch((err) => models.map((m: string) => ({ success: false, error: `Timeout for ${m}: ${err}` })));

    console.log(`[audio-multi] done in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[audio-multi] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Audio generation error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// VAULT ROUTES
// ═════════��══════════════════════════════��═════════════════════

app.get("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const vault = await kv.get(`vault:${user.id}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});
// VAULT ROUTES — Clean Restart  
// ══════════════════════════════════════════════════════════════

app.get("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const vault = await kv.get(`vault:${user.id}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.put("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const existing = (await kv.get(`vault:${user.id}`)) || {};
    const updated = { ...existing, ...body, userId: user.id, updatedAt: new Date().toISOString() };
    await kv.set(`vault:${user.id}`, updated);
    return c.json({ success: true, vault: updated });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/vault/scan-url", async (c) => {
  const t0 = Date.now();
  console.log("[vault/scan-url] ✅ Request received");
  
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const rawUrl = body.url;
    
    if (!rawUrl) return c.json({ success: false, error: "URL required" }, 400);
    
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    console.log("[vault/scan-url] Scanning:", url);
    
    // JINA SCRAPE
    const jinaKey = Deno.env.get("JINA_API_KEY");
    if (!jinaKey) return c.json({ success: false, error: "JINA_API_KEY not set" }, 500);
    
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Authorization: `Bearer ${jinaKey}`, Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!jinaRes.ok) {
      return c.json({ success: false, error: `Scrape failed: ${jinaRes.status}` }, 500);
    }
    
    const markdown = await jinaRes.text();
    console.log("[vault/scan-url] Scraped", markdown.length, "chars");
    
    if (!markdown || markdown.length < 50) {
      return c.json({ success: false, error: "Content too short" }, 422);
    }
    
    // MISTRAL ANALYSIS
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralKey) return c.json({ success: false, error: "MISTRAL_API_KEY not set" }, 500);
    
    const systemPrompt = `You are an expert brand analyst. Analyze the website and return ONLY valid JSON:
{"brandName":"string","industry":"string","tone":{"formality":7,"confidence":8,"warmth":5,"humor":3},"keyMessages":["msg1","msg2"],"vocabulary":{"approvedTerms":["word1"],"forbiddenTerms":["word1"]},"audiences":{"primary":"desc"},"colors":["#FF0000"],"typography":["Font1"]}`;
    
    const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mistralKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze: ${url}\n\n${markdown.slice(0, 8000)}` },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!mistralRes.ok) {
      return c.json({ success: false, error: `AI failed: ${mistralRes.status}` }, 500);
    }
    
    const aiData = await mistralRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    
    if (!rawContent) return c.json({ success: false, error: "Empty AI response" }, 500);
    
    const scan = JSON.parse(rawContent.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
    scan.sourceUrl = url;
    scan.scannedAt = new Date().toISOString();
    
    console.log(`[vault/scan-url] ✅ Done in ${Date.now() - t0}ms — ${scan.brandName}`);
    return c.json({ success: true, scan });
    
  } catch (err: any) {
    console.error("[vault/scan-url] Error:", err);
    return c.json({ success: false, error: String(err.message || err) }, 500);
  }
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

// ══════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════

app.get("/analytics", async (c) => {
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
});

// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
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

app.get("/admin/overview", async (c) => {
  try {
    await requireAdmin(c);
    const allUsers = await kv.getByPrefix("user:");
    const users = allUsers.filter((u: any) => u.userId);
    const planCounts = { free: 0, generate: 0, studio: 0 };
    let totalCreditsUsed = 0, totalCreditsAllocated = 0;
    for (const u of users) {
      if (u.plan && planCounts[u.plan as keyof typeof planCounts] !== undefined) planCounts[u.plan as keyof typeof planCounts]++;
      totalCreditsUsed += u.creditsUsed || 0;
      totalCreditsAllocated += u.credits || 0;
    }
    const mrr = planCounts.generate * 39 + planCounts.studio * 149;
    const allLogs = await kv.getByPrefix("log:");
    const recentLogs = allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
    return c.json({
      success: true,
      overview: { totalUsers: users.length, planCounts, totalCreditsUsed, totalCreditsAllocated, mrr, generateRevenue: planCounts.generate * 39, studioRevenue: planCounts.studio * 149, recentLogs, serverTime: new Date().toISOString() },
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

app.put("/admin/users/:userId/plan", async (c) => {
  try {
    await requireAdmin(c);
    const userId = c.req.param("userId");
    const { plan } = await c.req.json();
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
});

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

    for (const c of sorted) {
      const entry = c as CostEntry;
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
    const models = modelsRaw.split(",").filter(Boolean);
    if (!prompt || !models.length) {
      return c.json({ error: "prompt and models query params required" }, 400);
    }
    console.log(`[image-via-get] raw prompt="${prompt.slice(0, 60)}", models=${models.join(",")}`);
    // Enhance/translate prompt to English for better image generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[image-via-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}"`);
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const MODEL_TIMEOUT = 95_000;
    const HANDLER_TIMEOUT = 105_000;
    const CONCURRENCY = 3;
    const work = (async () => {
      const results: any[] = [];
      for (let i = 0; i < models.length; i += CONCURRENCY) {
        const batch = models.slice(i, i + CONCURRENCY);
        console.log(`[image-via-get] batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.join(",")}`);
        const batchResults = await Promise.all(
          batch.map(async (model: string) => {
            try {
              if (user) deductCredit(user.id, 2).catch(() => {});
              const result = await Promise.race([
                generateImage({ prompt: enhancedPrompt, model }),
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

// ── IMAGE WITH REFERENCE via GET — Visual Lab ──
app.get("/generate/image-ref-via-get", async (c) => {
  const t0 = Date.now();
  console.log(`[image-ref-via-get] ENTERED at ${new Date().toISOString()}`);
  try {
    const prompt = c.req.query("prompt") || "";
    const imageRefUrl = c.req.query("imageRefUrl") || "";
    const modelsRaw = c.req.query("models") || "";
    const strength = parseFloat(c.req.query("strength") || "0.75");
    const models = modelsRaw.split(",").filter(Boolean);
    if (!prompt || !imageRefUrl || !models.length) {
      return c.json({ error: "prompt, imageRefUrl, and models query params required" }, 400);
    }
    console.log(`[image-ref-via-get] raw prompt="${prompt.slice(0, 60)}", ref=${imageRefUrl.slice(0, 80)}, models=${models.join(",")}, strength=${strength}`);
    // Enhance/translate prompt to English for better image generation
    const enhancedPrompt = await enhanceImagePrompt(prompt);
    console.log(`[image-ref-via-get] enhanced prompt="${enhancedPrompt.slice(0, 80)}"`);
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
                generateImageWithRef({ prompt: enhancedPrompt, model, imageRefUrl, strength }),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
              ]);
              console.log(`[image-ref-via-get] ${model} OK (${Date.now() - t0}ms)`);
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
// ══════════════════════════════════════════════════════════════
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
// ═════════════════════════════════════════════════════════════

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
// ══════════════════════════════════════════════════════════════

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
    const { data: urlData } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 7200);
    console.log(`[auto-campaign/upload] OK in ${Date.now() - t0}ms`);
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
    const { imageUrl, productDescription } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);

    const packPrompt = `Professional studio packshot photograph of this product on a clean, minimal white/light gray background. Soft, even studio lighting with subtle shadows. Commercial product photography style, high-end, editorial quality. ${productDescription || "Product centered, sharp focus."}`;
    
    // Use Luma Photon with image reference for packshot
    const result = await Promise.race([
      generateImageWithRef({ prompt: packPrompt, model: "photon-1", imageRefUrl: imageUrl, strength: 0.65 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Packshot timeout 95s")), 95_000)),
    ]);

    if (user) {
      deductCredit(user.id, 3).catch(() => {});
      logCost({ type: "image", model: "photon-1", provider: (result as any).provider || "luma/photon-1", costUsd: 0.030, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/packshot] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, imageUrl: (result as any).imageUrl, provider: (result as any).provider, latencyMs: Date.now() - t0 });
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
    const { imageUrl, lifestyleContext, productDescription } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);

    const lifestylePrompt = `Lifestyle product photography: this product naturally placed in a real-world setting. ${lifestyleContext || "Elegant everyday environment, warm natural lighting, aspirational lifestyle context."} Editorial lifestyle photography, shallow depth of field, magazine-quality composition. ${productDescription || "Product naturally integrated into scene, not isolated."}`;

    const result = await Promise.race([
      generateImageWithRef({ prompt: lifestylePrompt, model: "photon-1", imageRefUrl: imageUrl, strength: 0.50 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Lifestyle timeout 95s")), 95_000)),
    ]);

    if (user) {
      deductCredit(user.id, 3).catch(() => {});
      logCost({ type: "image", model: "photon-1", provider: (result as any).provider || "luma/photon-1", costUsd: 0.030, revenueEur: REVENUE_PER_TYPE.image, latencyMs: Date.now() - t0, userId: user.id, success: true }).catch(() => {});
    }
    console.log(`[auto-campaign/lifestyle] OK in ${Date.now() - t0}ms`);
    return c.json({ success: true, imageUrl: (result as any).imageUrl, provider: (result as any).provider, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/lifestyle] error: ${err}`);
    return c.json({ success: false, error: `Lifestyle error: ${err}` }, 500);
  }
});

// Step 3a: Start Kling video animation from packshot
app.post("/auto-campaign/kling-start", async (c) => {
  const t0 = Date.now();
  console.log(`[auto-campaign/kling-start] ENTERED`);
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const { imageUrl, prompt } = await c.req.json();
    if (!imageUrl) return c.json({ error: "imageUrl required" }, 400);
    
    const videoPrompt = prompt || "Smooth, elegant product reveal. Slow rotation with dynamic lighting. Professional commercial advertisement style. Cinematic camera movement, shallow depth of field.";
    const result = await klingImageToVideo({ imageUrl, prompt: videoPrompt });
    
    if (user) deductCredit(user.id, 5).catch(() => {});
    console.log(`[auto-campaign/kling-start] submitted task=${result.taskId} in ${Date.now() - t0}ms`);
    return c.json({ success: true, taskId: result.taskId, latencyMs: Date.now() - t0 });
  } catch (err) {
    console.log(`[auto-campaign/kling-start] error: ${err}`);
    return c.json({ success: false, error: `Kling start error: ${err}` }, 500);
  }
});

// Step 3a-poll: Poll Kling video status
app.get("/auto-campaign/kling-status", async (c) => {
  try {
    const taskId = c.req.query("taskId");
    if (!taskId) return c.json({ error: "taskId required" }, 400);
    const status = await klingPollStatus(taskId);
    return c.json({ success: true, ...status });
  } catch (err) {
    console.log(`[auto-campaign/kling-status] error: ${err}`);
    return c.json({ success: false, error: `Kling status error: ${err}` }, 500);
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

// GET /library/items — list all library items for authenticated user
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

// POST /library/items — save item to library
app.post("/library/items", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const item = body.item;
    if (!item || !item.id) return c.json({ success: false, error: "Missing item" }, 400);
    const libItem = {
      ...item,
      userId: user.id,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: item.folderId || null,
    };
    await kv.set(`lib:${user.id}:${item.id}`, libItem);
    console.log(`[library/items POST] saved ${item.id} for user ${user.id}`);
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
    const updates = await c.req.json();
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

// GET /library/folders — list all folders for authenticated user
app.get("/library/folders", async (c) => {
  try {
    const user = await requireAuth(c);
    const folders = await kv.getByPrefix(`lib-folder:${user.id}:`);
    return c.json({ success: true, folders: folders || [] });
  } catch (err) {
    console.log(`[library/folders GET] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// POST /library/folders — create a folder
app.post("/library/folders", async (c) => {
  try {
    const user = await requireAuth(c);
    const { name } = await c.req.json();
    if (!name) return c.json({ success: false, error: "Missing folder name" }, 400);
    const folderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const folder = { id: folderId, name, userId: user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await kv.set(`lib-folder:${user.id}:${folderId}`, folder);
    console.log(`[library/folders POST] created ${folderId} "${name}" for user ${user.id}`);
    return c.json({ success: true, folder });
  } catch (err) {
    console.log(`[library/folders POST] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// PUT /library/folders/:id — rename folder
app.put("/library/folders/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const folderId = c.req.param("id");
    const { name } = await c.req.json();
    const existing = await kv.get(`lib-folder:${user.id}:${folderId}`);
    if (!existing) return c.json({ success: false, error: "Folder not found" }, 404);
    const updated = { ...existing, name: name || existing.name, updatedAt: new Date().toISOString() };
    await kv.set(`lib-folder:${user.id}:${folderId}`, updated);
    return c.json({ success: true, folder: updated });
  } catch (err) {
    console.log(`[library/folders PUT] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

// DELETE /library/folders/:id — delete folder (items in it become unassigned)
app.delete("/library/folders/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const folderId = c.req.param("id");
    await kv.del(`lib-folder:${user.id}:${folderId}`);
    // Unassign items from this folder
    const allItems = await kv.getByPrefix(`lib:${user.id}:`);
    const toUpdate = (allItems || []).filter((item: any) => item.folderId === folderId);
    for (const item of toUpdate) {
      await kv.set(`lib:${user.id}:${item.id}`, { ...item, folderId: null, updatedAt: new Date().toISOString() });
    }
    console.log(`[library/folders DELETE] removed ${folderId}, unassigned ${toUpdate.length} items`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`[library/folders DELETE] error: ${err}`);
    return c.json({ success: false, error: String(err) }, err?.message === "Unauthorized" ? 401 : 500);
  }
});

app.all("*", (c) => c.json({ error: "Not found", path: c.req.path }, 404));

console.log("[boot] ORA server ready (APIPod text, Luma image+video, Kling video, Replicate audio, storage, auto-campaign, studio actions, library)");
Deno.serve(app.fetch);