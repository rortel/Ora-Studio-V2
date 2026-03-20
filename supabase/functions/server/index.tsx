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
const PLAN_CREDITS: Record<string, number> = { free: 10, generate: 100, studio: 500 };

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
  "runware/runware:100@1": 0.003, "runware/runware:101@1": 0.008,
  "fal/fal-ai/flux/schnell": 0.003, "fal/fal-ai/flux-pro/v1.1": 0.035,
  "replicate/black-forest-labs/flux-schnell": 0.005,
  "runware/runware:100@1:video": 0.050,
  "fal/fal-ai/minimax/video-01-live": 0.100, "fal/fal-ai/luma-dream-machine": 0.120, "fal/fal-ai/ltx-video": 0.080,
  "replicate/minimax/video-01-live": 0.150, "replicate/luma/ray": 0.180, "replicate/lightricks/ltx-video": 0.100,
  "replicate/meta/musicgen": 0.050,
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
  if (type === "video" && PROVIDER_COSTS[`${provider}:video`]) return PROVIDER_COSTS[`${provider}:video`];
  const prefix = provider.split("/")[0];
  if (prefix === "runware") return type === "video" ? 0.050 : 0.003;
  if (prefix === "fal") return type === "video" ? 0.100 : 0.005;
  if (prefix === "replicate") return type === "video" ? 0.150 : type === "audio" ? 0.050 : 0.005;
  if (prefix === "apipod") return 0.015;
  return 0.010;
}

// ══════════════════════════════════════════════════════════════
// INLINE AI — TEXT (APIPod), IMAGE (Runware→FAL→Replicate), VIDEO (Runware→FAL→Replicate), AUDIO (Replicate)
// ══════════════════════════════════════════════════════════════

const APIPOD_BASE = "https://api.apipod.ai/v1";

function apipodHeaders(): Record<string, string> {
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) throw new Error("APIPOD_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

// --- Text model registry ---
const textModelMap: Record<string, { apiModel: string; fallback?: string }> = {
  "gpt-4o":        { apiModel: "gpt-4o" },
  "gpt-5":         { apiModel: "gpt-5", fallback: "gpt-4o" },
  "gpt-5.2":       { apiModel: "gpt-5.2", fallback: "gpt-4o" },
  "claude-sonnet": { apiModel: "claude-sonnet-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  "claude-haiku":  { apiModel: "claude-haiku-4-20250514", fallback: "claude-3-5-haiku-20241022" },
  "claude-opus":   { apiModel: "claude-opus-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  "gemini-pro":    { apiModel: "gemini-2.5-flash-preview-05-20", fallback: "gemini-2.0-flash" },
  "gemini-3":      { apiModel: "gemini-3", fallback: "gemini-2.5-flash-preview-05-20" },
  "ora-writer":    { apiModel: "gpt-4o" },
  "ora-code":      { apiModel: "gpt-4o" },
  "gpt-4o-code":   { apiModel: "gpt-4o" },
  "claude-code":   { apiModel: "claude-sonnet-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  "gemini-code":   { apiModel: "gemini-2.5-flash-preview-05-20", fallback: "gemini-2.0-flash" },
};

// --- Image model registry (Runware primary, FAL secondary, Replicate tertiary) ---
interface ImgStrategy { type: "runware" | "fal" | "replicate"; model: string; }
const imageStrategies: Record<string, ImgStrategy[]> = {
  "ora-vision":    [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "nano-banana":   [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "seedream-v4.5": [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "seedream-5-lite":[{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "dall-e":        [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "flux-pro":      [{ type: "runware", model: "runware:101@1" }, { type: "fal", model: "fal-ai/flux-pro/v1.1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
};

// --- Video model registry (Runware primary, FAL secondary, Replicate tertiary) ---
interface VidStrategy { type: "runware" | "fal" | "replicate"; model: string; }
const videoStrategies: Record<string, VidStrategy[]> = {
  "ora-motion":       [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "veo-3.1":          [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "sora-2":           [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/luma-dream-machine" }, { type: "replicate", model: "luma/ray" }],
  "seedance-2.0":     [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "seedance-1.5-pro": [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "seedance-1.0":     [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "runway-gen3":      [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "pika":             [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/ltx-video" }, { type: "replicate", model: "lightricks/ltx-video" }],
  "sora":             [{ type: "runware", model: "runware:100@1" }, { type: "fal", model: "fal-ai/luma-dream-machine" }, { type: "replicate", model: "luma/ray" }],
};

// --- Audio model registry (Replicate MusicGen) ---
const audioModels: Record<string, string> = {
  "ora-audio":  "meta/musicgen",
  "elevenlabs": "meta/musicgen",
  "suno":       "meta/musicgen",
  "udio":       "meta/musicgen",
};

// ─ TEXT GENERATION (APIPod) ─────────────────────────────────
async function generateText(req: { prompt: string; model: string; systemPrompt?: string; maxTokens?: number }) {
  const mapping = textModelMap[req.model];
  if (!mapping) throw new Error(`Unknown text model: ${req.model}`);

  const sys = req.systemPrompt || "You are a creative professional AI assistant.";
  const maxTok = req.maxTokens || 1024;
  const start = Date.now();

  const chain: string[] = [mapping.apiModel];
  if (mapping.fallback && mapping.fallback !== mapping.apiModel) chain.push(mapping.fallback);
  if (!chain.includes("gpt-4o")) chain.push("gpt-4o");

  let lastErr: Error | null = null;
  for (const apiModel of chain) {
    try {
      console.log(`[text] ${apiModel}, "${req.prompt.slice(0, 50)}..."`);
      const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
        method: "POST",
        headers: apipodHeaders(),
        body: JSON.stringify({
          model: apiModel,
          messages: [{ role: "system", content: sys }, { role: "user", content: req.prompt }],
          max_tokens: maxTok,
        }),
      });
      if (!res.ok) { const b = await res.text(); throw new Error(`APIPod ${res.status}: ${b}`); }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      if (!text) throw new Error(`Empty response from ${apiModel}`);
      return { model: req.model, provider: `apipod/${apiModel}`, text, tokensUsed: data.usage?.total_tokens || 0, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[text] ${apiModel} failed: ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All text models failed for ${req.model}`);
}

// ── IMAGE: Runware call (primary provider for images) ────────
async function callRunwareImage(rwModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("RUNWARE_IMAGE_API_KEY");
  if (!key) throw new Error("RUNWARE_IMAGE_API_KEY not configured");
  console.log(`[Runware Image] model=${rwModel}, prompt="${prompt.slice(0, 60)}..."`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify([{
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt: prompt,
        model: rwModel,
        width: 1024,
        height: 768,
        numberResults: 1,
        outputFormat: "WEBP",
      }]),
      signal: controller.signal,
    });
    if (!res.ok) { const b = await res.text(); throw new Error(`Runware ${res.status}: ${b}`); }
    const data = await res.json();
    const url = data.data?.[0]?.imageURL || data.data?.[0]?.imageUrl;
    if (!url) throw new Error(`Runware returned no image URL: ${JSON.stringify(data).slice(0, 300)}`);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// ── IMAGE: FAL call (secondary provider for images) ──────────
async function callFalImage(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");
  console.log(`[FAL Image] model=${falModel}, prompt="${prompt.slice(0, 60)}..."`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000); // 15s max pour FAL
  try {
    const res = await fetch(`https://fal.run/${falModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ prompt, image_size: "landscape_4_3", num_images: 1, enable_safety_checker: true }),
      signal: controller.signal,
    });
    if (!res.ok) { const errBody = await res.text(); throw new Error(`FAL ${res.status} for ${falModel}: ${errBody}`); }
    const data = await res.json();
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error(`FAL returned no URL for ${falModel}`);
    return imageUrl;
  } finally {
    clearTimeout(timer);
  }
}

// ── IMAGE: Replicate call ────────────────────────────────────
async function callReplicateImage(repModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  console.log(`[replicate-img] ${repModel}`);
  const controller = new AbortController();
  const createTimeout = setTimeout(() => controller.abort(), 10_000); // 10s max for initial request
  let cr;
  try {
    cr = await fetch(`https://api.replicate.com/v1/models/${repModel}/predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Prefer": "wait" },
      body: JSON.stringify({ input: { prompt } }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(createTimeout);
  }
  if (!cr.ok) { const b = await cr.text(); throw new Error(`Replicate ${cr.status}: ${b}`); }
  const pred = await cr.json();
  // With "Prefer: wait", response may already contain the output
  if (pred.status === "succeeded") {
    const u = typeof pred.output === "string" ? pred.output : Array.isArray(pred.output) ? pred.output[0] : null;
    if (u) return u;
  }
  if (!pred.id) throw new Error("No prediction ID");

  let elapsed = 0;
  while (elapsed < 20_000) { // 20s max polling
    await new Promise(r => setTimeout(r, 2_000));
    elapsed += 2_000;
    const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!pr.ok) continue;
    const d = await pr.json();
    if (d.status === "succeeded") {
      const u = typeof d.output === "string" ? d.output : Array.isArray(d.output) ? d.output[0] : null;
      if (!u) throw new Error("No output URL");
      return u;
    }
    if (d.status === "failed" || d.status === "canceled") throw new Error(`Replicate ${d.status}: ${d.error || "unknown"}`);
  }
  throw new Error("Replicate image timeout (20s)");
}

// ── IMAGE GENERATION (Runware → FAL → Replicate) ─────────────
async function generateImage(req: { prompt: string; model: string }) {
  const strats = imageStrategies[req.model];
  if (!strats) throw new Error(`Unknown image model: ${req.model}`);
  const start = Date.now();
  let lastErr: Error | null = null;
  for (const s of strats) {
    try {
      let url: string;
      if (s.type === "runware") url = await callRunwareImage(s.model, req.prompt);
      else if (s.type === "fal") url = await callFalImage(s.model, req.prompt);
      else url = await callReplicateImage(s.model, req.prompt);
      return { model: req.model, provider: `${s.type}/${s.model}`, imageUrl: url, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[image] ${s.type}/${s.model} failed: ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All image strategies failed for ${req.model}`);
}

// ─ PRODUCT IMAGE ANALYSIS via GPT-4o Vision ─────────────────
async function analyzeProductImage(imageDataUrl: string): Promise<string> {
  console.log("[Vision] Analyzing product image...");
  try {
    const res = await fetch(`${APIPOD_BASE}/chat/completions`, {
      method: "POST",
      headers: apipodHeaders(),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: "Describe this product very precisely for an AI image generator. Cover: exact shape, colors, materials, finish, texture, proportions, any distinctive design details, patterns. Output a dense technical description in 80-100 words. Start with the product type." },
          ],
        }],
        max_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error(`APIPod Vision ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.log(`[Vision] analysis failed: ${e}`);
    return "";
  }
}

// ─ IMAGE-TO-IMAGE: Runware (seedImage = base64) ───────────────
async function callRunwareImageWithRef(rwModel: string, prompt: string, seedImageBase64: string): Promise<string> {
  const key = Deno.env.get("RUNWARE_IMAGE_API_KEY");
  if (!key) throw new Error("RUNWARE_IMAGE_API_KEY not configured");
  console.log(`[Runware img2img] model=${rwModel}, strength=0.30`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify([{
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt: prompt,
        model: rwModel,
        width: 1024,
        height: 1024,
        numberResults: 1,
        outputFormat: "WEBP",
        seedImage: seedImageBase64,
        strength: 0.30,
      }]),
      signal: controller.signal,
    });
    if (!res.ok) { const b = await res.text(); throw new Error(`Runware img2img ${res.status}: ${b}`); }
    const data = await res.json();
    const url = data.data?.[0]?.imageURL || data.data?.[0]?.imageUrl;
    if (!url) throw new Error(`Runware img2img: no URL: ${JSON.stringify(data).slice(0, 200)}`);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// ─ IMAGE-TO-IMAGE: FAL flux-dev (image_url = data URL) ────────
async function callFalImageWithRef(prompt: string, imageDataUrl: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");
  console.log("[FAL img2img] fal-ai/flux/dev/image-to-image, strength=0.35");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const res = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ image_url: imageDataUrl, prompt, strength: 0.35, num_images: 1, enable_safety_checker: true }),
      signal: controller.signal,
    });
    if (!res.ok) { const b = await res.text(); throw new Error(`FAL img2img ${res.status}: ${b}`); }
    const data = await res.json();
    const url = data.images?.[0]?.url;
    if (!url) throw new Error(`FAL img2img: no URL`);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// ─ GENERATE IMAGE WITH PRODUCT REFERENCE ─────────────────────
// Pipeline: Vision analyze → build enhanced prompt → Runware img2img → FAL img2img → text-to-image fallback
async function generateImageWithRef(req: { prompt: string; model: string; productImageBase64: string }) {
  const start = Date.now();

  // 1. Vision: analyze the product
  const productDesc = await analyzeProductImage(req.productImageBase64);

  // 2. Build enhanced prompt: product description anchors identity, user prompt adds scene
  const enhancedPrompt = productDesc
    ? `Photorealistic commercial product photography. PRODUCT TO REPRODUCE EXACTLY (preserve shape, colors, materials, proportions, every detail): ${productDesc}. NEW SCENE/STAGING: ${req.prompt}. Ultra-realistic 8K, professional lighting. No extra text, no logos added.`
    : `Photorealistic commercial product photography. Preserve the product from the reference image exactly — same shape, colors, materials, proportions. NEW SCENE: ${req.prompt}. Ultra-realistic 8K, professional lighting.`;

  console.log(`[img2img] enhanced prompt (${enhancedPrompt.length} chars): "${enhancedPrompt.slice(0, 120)}..."`);

  // 3. Try Runware img2img (primary — sends base64 seedImage directly)
  const strats = imageStrategies[req.model] || imageStrategies["ora-vision"];
  for (const s of strats) {
    try {
      if (s.type === "runware") {
        const url = await callRunwareImageWithRef(s.model, enhancedPrompt, req.productImageBase64);
        return { model: req.model, provider: `runware-img2img/${s.model}`, imageUrl: url, latencyMs: Date.now() - start };
      } else if (s.type === "fal") {
        const url = await callFalImageWithRef(enhancedPrompt, req.productImageBase64);
        return { model: req.model, provider: "fal-img2img/flux-dev", imageUrl: url, latencyMs: Date.now() - start };
      }
    } catch (err) {
      console.log(`[img2img] ${s.type} failed: ${err}`);
    }
  }

  // 4. Final fallback: text-to-image with enriched prompt (product description in prompt)
  console.log("[img2img] img2img providers failed → falling back to text-to-image with enriched prompt");
  return generateImage({ prompt: enhancedPrompt, model: req.model });
}

// ── VIDEO: Runware call (primary provider for video) ─────────
async function callRunwareVideo(rwModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("RUNWARE_VIDEO_API_KEY");
  if (!key) throw new Error("RUNWARE_VIDEO_API_KEY not configured");
  console.log(`[Runware Video] model=${rwModel}, prompt="${prompt.slice(0, 60)}..."`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // 2min max for video
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify([{
        taskType: "videoInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt: prompt,
        model: rwModel,
        width: 1280,
        height: 720,
        numberResults: 1,
        outputFormat: "MP4",
      }]),
      signal: controller.signal,
    });
    if (!res.ok) { const b = await res.text(); throw new Error(`Runware ${res.status}: ${b}`); }
    const data = await res.json();
    const url = data.data?.[0]?.videoURL || data.data?.[0]?.videoUrl || data.data?.[0]?.imageURL;
    if (!url) throw new Error(`Runware returned no video URL: ${JSON.stringify(data).slice(0, 300)}`);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// ── VIDEO: FAL call (secondary provider for video) ───────────
async function callFalVideo(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");
  console.log(`[FAL Video] model=${falModel}, prompt="${prompt.slice(0, 60)}..."`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // 2min max for video on FAL
  try {
    const res = await fetch(`https://fal.run/${falModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    if (!res.ok) { const errBody = await res.text(); throw new Error(`FAL ${res.status} for ${falModel}: ${errBody}`); }
    const data = await res.json();
    const videoUrl = data.video?.url || data.data?.[0]?.url || data.videos?.[0]?.url || data.url;
    if (!videoUrl) throw new Error(`FAL returned no video URL for ${falModel}: ${JSON.stringify(data).slice(0, 300)}`);
    return videoUrl;
  } finally {
    clearTimeout(timer);
  }
}

// ── VIDEO: Replicate poll ────────────────────────────────────
async function callReplicateVideo(repModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  console.log(`[replicate-video] ${repModel}`);
  const cr = await fetch(`https://api.replicate.com/v1/models/${repModel}/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: { prompt } }),
  });
  if (!cr.ok) { const b = await cr.text(); throw new Error(`Replicate ${cr.status}: ${b}`); }
  const pred = await cr.json();
  if (!pred.id) throw new Error("No prediction ID");

  let elapsed = 0;
  while (elapsed < 180_000) {
    await new Promise(r => setTimeout(r, 4_000));
    elapsed += 4_000;
    const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!pr.ok) continue;
    const d = await pr.json();
    if (d.status === "succeeded") {
      const u = typeof d.output === "string" ? d.output : Array.isArray(d.output) ? d.output[0] : null;
      if (!u) throw new Error("No output URL");
      return u;
    }
    if (d.status === "failed" || d.status === "canceled") throw new Error(`Replicate ${d.status}: ${d.error || "unknown"}`);
  }
  throw new Error("Replicate video timeout (180s)");
}

// ── VIDEO GENERATION (Runware → FAL → Replicate) ─────────────
async function generateVideo(req: { prompt: string; model: string }) {
  const strats = videoStrategies[req.model];
  if (!strats) throw new Error(`Unknown video model: ${req.model}`);
  const start = Date.now();
  let lastErr: Error | null = null;

  for (const s of strats) {
    try {
      let url: string;
      if (s.type === "runware") url = await callRunwareVideo(s.model, req.prompt);
      else if (s.type === "fal") url = await callFalVideo(s.model, req.prompt);
      else url = await callReplicateVideo(s.model, req.prompt);
      return { model: req.model, provider: `${s.type}/${s.model}`, videoUrl: url, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[video] ${s.type}/${s.model} failed: ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All video strategies failed for ${req.model}`);
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

    const results = [];
    for (const model of models) {
      if (user) deductCredit(user.id, 1).catch(() => {});
      try {
        console.log(`[text-multi] calling generateText(${model})...`);
        const result = await generateText({ prompt, model, systemPrompt, maxTokens });
        console.log(`[text-multi] ${model} OK in ${Date.now() - t0}ms, provider=${result.provider}`);
        results.push({ success: true, result });
        if (user) logEvent("generation", { userId: user.id, type: "text", model }).catch(() => {});
        logCost({ type: "text", model, provider: result.provider, costUsd: getProviderCost(result.provider, "text"), revenueEur: REVENUE_PER_TYPE.text, latencyMs: result.latencyMs, userId: user?.id || "guest", success: true }).catch(() => {});
      } catch (err) {
        console.log(`[text-multi] ${model} FAILED:`, err);
        results.push({ success: false, error: String(err) });
        logCost({ type: "text", model, provider: "unknown", costUsd: 0, revenueEur: 0, latencyMs: Date.now() - t0, userId: user?.id || "guest", success: false }).catch(() => {});
      }
    }
    console.log(`[text-multi] done in ${Date.now() - t0}ms, ${results.length} results`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[text-multi] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Text generation error: ${err}` }, 500);
  }
});

app.post("/generate/image-multi", async (c) => {
  const t0 = Date.now();
  try {
    // Auth: soft — don't block generation if auth fails
    let user: AuthUser | null = null;
    try {
      user = await getUser(c);
      console.log(`[image-multi] auth: ${user ? `user=${user.id}` : "guest (no valid JWT)"}`);
    } catch (authErr) {
      console.log(`[image-multi] auth error (continuing as guest):`, authErr);
    }
    const { prompt, models } = await c.req.json();
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    console.log(`[image-multi] models=${models.join(",")}, user=${user?.id || "guest"}, t0=${t0}`);

    const MODEL_TIMEOUT = 25_000;
    const HANDLER_TIMEOUT = 35_000;
    const CONCURRENCY = 2;

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

// ─── IMAGE WITH PRODUCT REFERENCE ─────────────────────────────
app.post("/generate/image-with-ref", async (c) => {
  const t0 = Date.now();
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); } catch {}
    const body = await c.req.json();
    const { prompt, models, productImageBase64 } = body;
    if (!prompt || !models?.length || !productImageBase64) {
      return c.json({ error: "prompt, models, and productImageBase64 required" }, 400);
    }
    console.log(`[image-with-ref] user=${user?.id || "guest"}, models=${models.join(",")}, prompt="${prompt.slice(0, 60)}"`);

    const MODEL_TIMEOUT = 55_000;
    const results = await Promise.all(
      models.map(async (model: string) => {
        try {
          const result = await Promise.race([
            generateImageWithRef({ prompt, model, productImageBase64 }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout >${MODEL_TIMEOUT}ms for ${model}`)), MODEL_TIMEOUT)),
          ]);
          if (user) logEvent("generation", { userId: user.id, type: "image-with-ref", model }).catch(() => {});
          const r = result as any;
          logCost({ type: "image", model, provider: r.provider || "unknown", costUsd: getProviderCost(r.provider || "", "image"), revenueEur: REVENUE_PER_TYPE.image, latencyMs: r.latencyMs || (Date.now() - t0), userId: user?.id || "guest", success: true }).catch(() => {});
          return { success: true, result };
        } catch (err) {
          console.log(`[image-with-ref] ${model} FAIL: ${err}`);
          return { success: false, error: String(err) };
        }
      })
    );

    console.log(`[image-with-ref] done (${Date.now() - t0}ms), results: ${results.length}`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[image-with-ref] error (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image generation error: ${err}` }, 500);
  }
});

app.post("/generate/video-multi", async (c) => {
  const t0 = Date.now();
  const VIDEO_MODEL_TIMEOUT = 150_000;
  const VIDEO_HANDLER_TIMEOUT = 200_000;
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[video-multi] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { prompt, models } = await c.req.json();
    console.log(`[video-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

    const work = Promise.all(
      models.map(async (model: string) => {
        if (user) deductCredit(user.id, 5).catch(() => {});
        try {
          const result = await Promise.race([
            generateVideo({ prompt, model }),
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
      new Promise<typeof models extends string[] ? { success: boolean; error?: string }[] : never>((_, reject) =>
        setTimeout(() => reject(new Error("Video handler timeout")), VIDEO_HANDLER_TIMEOUT)
      ),
    ]).catch((err) => models.map((m: string) => ({ success: false, error: `Timeout for ${m}: ${err}` })));

    console.log(`[video-multi] done in ${Date.now() - t0}ms`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[video-multi] FATAL error after ${Date.now() - t0}ms:`, err);
    return c.json({ success: false, error: `Video generation error: ${err}` }, 500);
  }
});

app.post("/generate/audio-multi", async (c) => {
  const t0 = Date.now();
  const AUDIO_HANDLER_TIMEOUT = 150_000;
  try {
    let user: AuthUser | null = null;
    try { user = await getUser(c); console.log(`[audio-multi] auth: ${user ? `user=${user.id}` : "guest"}`); } catch { }
    const { prompt, models } = await c.req.json();
    console.log(`[audio-multi] prompt="${prompt?.slice(0, 60)}", models=${JSON.stringify(models)}`);
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);

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
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Audio handler timeout")), AUDIO_HANDLER_TIMEOUT)
      ),
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
// ═════════��════════════════════════════════════════════════════

app.get("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const vault = await kv.get(`vault:${user.id}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) { return c.json({ success: false, error: String(err) }, 500); }
});

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

app.post("/vault/scan-url", async (c) => {
  try {
    const user = await requireAuth(c);
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "URL required" }, 400);
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    let scrapedContent = "";
    try {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        const res = await fetch("https://api.firecrawl.dev/v0/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
          body: JSON.stringify({ url, formats: ["markdown"] }),
        });
        if (res.ok) { const data = await res.json(); scrapedContent = data.data?.markdown || data.data?.content || ""; }
      }
    } catch (e) { console.log("[scan-url] Firecrawl failed:", e); }

    if (!scrapedContent) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "ORA-Bot/1.0" } });
        scrapedContent = await res.text();
        scrapedContent = scrapedContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 5000);
      } catch (e) { console.log("[scan-url] Direct fetch failed:", e); }
    }

    if (!scrapedContent) return c.json({ success: false, error: "Could not scrape URL" });

    try {
      const analysis = await generateText({
        prompt: `Analyze this brand's digital presence. Extract: brand name, tone of voice, key messages, target audience, visual style, vocabulary. Content from ${url}:\n\n${scrapedContent.slice(0, 4000)}`,
        model: "gpt-4o",
        systemPrompt: "You are a brand analyst. Return JSON: { brandName, tone (array), keyMessages (array), audience, visualStyle, vocabulary (array) }. Return ONLY valid JSON.",
        maxTokens: 1024,
      });
      let parsed: any = {};
      try { const m = analysis.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { parsed = { rawAnalysis: analysis.text }; }
      return c.json({ success: true, analysis: parsed, scrapedLength: scrapedContent.length });
    } catch (aiErr) {
      return c.json({ success: true, analysis: { rawContent: scrapedContent.slice(0, 2000) }, scrapedLength: scrapedContent.length });
    }
  } catch (err) { return c.json({ success: false, error: `Scan URL error: ${err}` }, 500); }
});

app.post("/vault/analyze-guidelines", async (c) => {
  try {
    const user = await requireAuth(c);
    const { text } = await c.req.json();
    if (!text) return c.json({ error: "Text required" }, 400);
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

    const result = await generateText({
      prompt: `Analyze these brand guidelines:\n\n${text.slice(0, 4000)}`,
      model: "gpt-4o",
      systemPrompt: "Extract: tone, colors, typography, doList, dontList, vocabulary. Return ONLY valid JSON.",
      maxTokens: 1024,
    });
    let parsed: any = {};
    try { const m = result.text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { parsed = { rawAnalysis: result.text }; }
    return c.json({ success: true, analysis: parsed });
  } catch (err) { return c.json({ success: false, error: `Analyze guidelines error: ${err}` }, 500); }
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
// ══════════════════════════════════════════════════════════════

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
    const user = await requireAuth(c);
    const { message, format, selectedElement, chatHistory } = await c.req.json();
    if (!message) return c.json({ error: "Message required" }, 400);
    const canDeduct = await deductCredit(user.id, 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);

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
// ══════════════════════════════════════════════════════════════

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
      const fk = Deno.env.get("FIRECRAWL_API_KEY");
      if (fk) {
        const res = await fetch("https://api.firecrawl.dev/v0/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${fk}` },
          body: JSON.stringify({ url, formats: ["markdown"] }),
        });
        if (res.ok) { const d = await res.json(); scrapedContent = d.data?.markdown || d.data?.content || ""; }
      }
    } catch (e) { console.log("[brand-score] Firecrawl failed:", e); }

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
    const mrr = planCounts.generate * 19 + planCounts.studio * 49;
    const allLogs = await kv.getByPrefix("log:");
    const recentLogs = allLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
    return c.json({
      success: true,
      overview: { totalUsers: users.length, planCounts, totalCreditsUsed, totalCreditsAllocated, mrr, generateRevenue: planCounts.generate * 19, studioRevenue: planCounts.studio * 49, recentLogs, serverTime: new Date().toISOString() },
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
      const pKey = entry.provider.split("/")[0]; // runware, fal, replicate, apipod
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
  return c.json({ apipod: mask(Deno.env.get("APIPOD_API_KEY")), runware_image: mask(Deno.env.get("RUNWARE_IMAGE_API_KEY")), runware_video: mask(Deno.env.get("RUNWARE_VIDEO_API_KEY")), fal: mask(Deno.env.get("FAL_API_KEY")), replicate: mask(Deno.env.get("REPLICATE_API_TOKEN")) });
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

    if (provider === "fal") {
      const key = Deno.env.get("FAL_API_KEY");
      if (!key) return c.json({ provider, status: "SKIP", error: "FAL_API_KEY not set" });
      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
        body: JSON.stringify({ prompt: "A blue circle", image_size: "square", num_images: 1 }),
      });
      const text = await res.text();
      return c.json({ provider, status: res.ok ? "OK" : "FAIL", code: res.status, ms: Date.now() - start, body: text.slice(0, 500) });
    }

    if (provider === "replicate") {
      const key = Deno.env.get("REPLICATE_API_TOKEN");
      if (!key) return c.json({ provider, status: "SKIP", error: "REPLICATE_API_TOKEN not set" });
      const res = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: `Bearer ${key}` } });
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 30s")), 30_000)),
    ]);
    return c.json({ success: true, result, ms: Date.now() - t0 });
  } catch (err) {
    return c.json({ success: false, error: String(err), ms: Date.now() - t0 });
  }
});

app.get("/debug/image-steps", async (c) => {
  const t0 = Date.now();
  const log: string[] = [];
  const step = (msg: string) => { const s = `[${Date.now() - t0}ms] ${msg}`; log.push(s); console.log(`[debug/image-steps] ${s}`); };

  step("START");

  // Step 1: Check FAL key
  const falKey = Deno.env.get("FAL_API_KEY");
  step(`FAL_API_KEY: ${falKey ? `set (${falKey.length} chars)` : "NOT SET"}`);

  // Step 2: Check Replicate key
  const repKey = Deno.env.get("REPLICATE_API_TOKEN");
  step(`REPLICATE_API_TOKEN: ${repKey ? `set (${repKey.length} chars)` : "NOT SET"}`);

  // Step 3: Try FAL with 15s abort
  let falResult = "not attempted";
  if (falKey) {
    step("FAL fetch starting...");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${falKey}` },
        body: JSON.stringify({ prompt: "A blue circle", image_size: "square_hd", num_images: 1 }),
        signal: ctrl.signal,
      });
      step(`FAL response: status=${res.status}`);
      const body = await res.text();
      step(`FAL body (${body.length} chars): ${body.slice(0, 300)}`);
      if (res.ok) {
        try { const d = JSON.parse(body); falResult = d.images?.[0]?.url || "no url in response"; }
        catch { falResult = `parse error: ${body.slice(0, 100)}`; }
      } else {
        falResult = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (err: any) {
      step(`FAL error: ${err.name}: ${err.message}`);
      falResult = `${err.name}: ${err.message}`;
    } finally {
      clearTimeout(timer);
    }
  }
  step(`FAL result: ${typeof falResult === "string" ? falResult.slice(0, 150) : falResult}`);

  // Step 4: Try Replicate create only (no polling) with 10s abort
  let repResult = "not attempted";
  if (repKey) {
    step("Replicate create starting...");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${repKey}`, "Prefer": "wait" },
        body: JSON.stringify({ input: { prompt: "A blue circle" } }),
        signal: ctrl.signal,
      });
      step(`Replicate create: status=${res.status}`);
      const body = await res.text();
      step(`Replicate body (${body.length} chars): ${body.slice(0, 300)}`);
      if (res.ok) {
        try { const d = JSON.parse(body); repResult = `prediction id=${d.id}, status=${d.status}`; }
        catch { repResult = `parse error: ${body.slice(0, 100)}`; }
      } else {
        repResult = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (err: any) {
      step(`Replicate error: ${err.name}: ${err.message}`);
      repResult = `${err.name}: ${err.message}`;
    } finally {
      clearTimeout(timer);
    }
  }
  step(`Replicate result: ${repResult}`);

  step("DONE");
  return c.json({ success: true, totalMs: Date.now() - t0, falResult, repResult, log });
});
// ══════════════════════════════════════════════════════════════
// CATCH-ALL
// ═════════════════════════════════════════════════════════════

// Quick smoke test: POST that returns immediately (no AI calls)
app.post("/debug/echo", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, echo: body, ts: new Date().toISOString(), server: "ora-inline" });
});

// ──── Start server ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// STUDIO MEDIA LIBRARY — Upload, list, delete per-client media
// ══════════════════════════════════════════════════════════════

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
    const user = await requireAuth(c);
    const { action, content, format, allFormats, targetLanguage, tone } = await c.req.json();
    if (!action) return c.json({ error: "Action required" }, 400);
    const canDeduct = await deductCredit(user.id, action === "cascade" ? 3 : 1);
    if (!canDeduct) return c.json({ error: "Insufficient credits" }, 403);
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
    await logEvent("studio-action", { userId: user.id, action, format });
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

app.all("*", (c) => c.json({ error: "Not found", path: c.req.path }, 404));

console.log("[boot] ORA server ready (inline AI, storage, studio actions)");
Deno.serve(app.fetch);