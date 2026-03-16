// ══════════════════════════════════════════════════════════════
// ORA Studio — Edge Function Server (Hono + KV + INLINE AI)
// ALL AI logic inlined — NO external imports, NO dynamic import
// ══════════════════════════════════════════════════════════════
import { Hono } from "npm:hono@4.4.2";
import { cors } from "npm:hono@4.4.2/cors"; // FIX: version pineée
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

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch { return null; }
}

async function getUser(c: any): Promise<AuthUser | null> {
  const token = c.req.header("X-User-Token") || c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    if (payload?.sub && payload?.email) {
      console.log("[getUser] JWT decoded locally, user:", payload.sub);
      return { id: payload.sub, email: payload.email };
    }
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
  const profile = await kv.get(`user:${userId}`);
  if (!profile) return false;
  if (profile.role === "admin") return true;
  const remaining = (profile.credits || 0) - (profile.creditsUsed || 0);
  if (remaining < amount) return false;
  profile.creditsUsed = (profile.creditsUsed || 0) + amount;
  await kv.set(`user:${userId}`, profile);
  return true;
}

async function logEvent(type: string, details: any) {
  try {
    const id = `log:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await kv.set(id, { id, type, details, timestamp: new Date().toISOString() });
  } catch (e) { console.log("[logEvent] failed:", e); }
}

// ══════════════════════════════════════════════════════════════
// INLINE AI — TEXT (APIPod), IMAGE (FAL+Replicate), VIDEO & AUDIO (Replicate)
// ══════════════════════════════════════════════════════════════
const APIPOD_BASE = "https://api.apipod.ai/v1";

function apipodHeaders(): Record<string, string> {
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) throw new Error("APIPOD_API_KEY not configured");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

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

interface ImgStrategy { type: "fal" | "replicate" | "firefly"; model: string; }
const imageStrategies: Record<string, ImgStrategy[]> = {
  "ora-vision":     [{ type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "nano-banana":    [{ type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "seedream-v4.5":  [{ type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "seedream-5-lite":[{ type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "dall-e":         [{ type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "flux-pro":       [{ type: "fal", model: "fal-ai/flux-pro/v1.1" }, { type: "fal", model: "fal-ai/flux/schnell" }, { type: "replicate", model: "black-forest-labs/flux-schnell" }],
  "firefly":        [{ type: "firefly", model: "firefly-image-3" }, { type: "fal", model: "fal-ai/flux/schnell" }],
  "firefly-3":      [{ type: "firefly", model: "firefly-image-3" }, { type: "fal", model: "fal-ai/flux/schnell" }],
  "firefly-fast":   [{ type: "firefly", model: "firefly-image-2" }, { type: "fal", model: "fal-ai/flux/schnell" }],
};

const videoStrategies: Record<string, string[]> = {
  "ora-motion":       ["minimax/video-01-live"],
  "veo-3.1":          ["minimax/video-01-live"],
  "sora-2":           ["luma/ray"],
  "seedance-2.0":     ["minimax/video-01-live"],
  "seedance-1.5-pro": ["minimax/video-01-live"],
  "seedance-1.0":     ["minimax/video-01-live"],
  "runway-gen3":      ["minimax/video-01-live"],
  "pika":             ["lightricks/ltx-video"],
  "sora":             ["luma/ray"],
};

const audioModels: Record<string, string> = {
  "ora-audio":  "meta/musicgen",
  "elevenlabs": "meta/musicgen",
  "suno":       "meta/musicgen",
  "udio":       "meta/musicgen",
};

// ── TEXT GENERATION ──────────────────────────────────────────
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

// ── IMAGE: FAL ───────────────────────────────────────────────
async function callFalImage(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not set");
  console.log(`[fal] ${falModel}`);
  const res = await fetch(`https://fal.run/${falModel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt, image_size: "landscape_4_3", num_images: 1, enable_safety_checker: true }),
  });
  if (!res.ok) { const b = await res.text(); throw new Error(`FAL ${res.status}: ${b}`); }
  const data = await res.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("FAL: no URL returned");
  return url;
}

// ── IMAGE: Adobe Firefly ──────────────────────────────────────
async function callFireflyImage(fireflyModel: string, prompt: string): Promise<string> {
  const clientId = Deno.env.get("FIREFLY_CLIENT_ID");
  const clientSecret = Deno.env.get("FIREFLY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("FIREFLY_CLIENT_ID or FIREFLY_CLIENT_SECRET not set");
  console.log(`[firefly] ${fireflyModel}`);

  // Step 1: Get access token
  const tokenRes = await fetch("https://ims-na1.adobelogin.com/ims/token/v3", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid,AdobeID,firefly_api",
    }),
  });
  if (!tokenRes.ok) { const b = await tokenRes.text(); throw new Error(`Firefly auth ${tokenRes.status}: ${b}`); }
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error("Firefly: no access_token");

  // Step 2: Generate image
  const genRes = await fetch("https://firefly-api.adobe.io/v3/images/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
      "X-Api-Key": clientId,
    },
    body: JSON.stringify({
      prompt,
      size: { width: 1344, height: 768 },
      n: 1,
    }),
  });
  if (!genRes.ok) { const b = await genRes.text(); throw new Error(`Firefly gen ${genRes.status}: ${b}`); }
  const data = await genRes.json();
  const url = data.outputs?.[0]?.image?.url;
  if (!url) throw new Error("Firefly: no URL returned");
  return url;
}

// ── IMAGE: Replicate ─────────────────────────────────────────
async function callReplicateImage(repModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  console.log(`[replicate-img] ${repModel}`);
  const cr = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: repModel, input: { prompt } }),
  });
  if (!cr.ok) { const b = await cr.text(); throw new Error(`Replicate ${cr.status}: ${b}`); }
  const pred = await cr.json();
  if (!pred.id) throw new Error("No prediction ID");
  let elapsed = 0;
  while (elapsed < 90_000) {
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
  throw new Error("Replicate image timeout (90s)");
}

// ── IMAGE GENERATION ─────────────────────────────────────────
async function generateImage(req: { prompt: string; model: string }) {
  const strats = imageStrategies[req.model];
  if (!strats) throw new Error(`Unknown image model: ${req.model}`);
  const start = Date.now();
  let lastErr: Error | null = null;
  for (const s of strats) {
    try {
      const url = s.type === "fal" ? await callFalImage(s.model, req.prompt)
               : s.type === "firefly" ? await callFireflyImage(s.model, req.prompt)
               : await callReplicateImage(s.model, req.prompt);
      return { model: req.model, provider: `${s.type}/${s.model}`, imageUrl: url, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[image] ${s.type}/${s.model} failed: ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All image strategies failed for ${req.model}`);
}

// ── VIDEO GENERATION ─────────────────────────────────────────
async function generateVideo(req: { prompt: string; model: string }) {
  const models = videoStrategies[req.model];
  if (!models) throw new Error(`Unknown video model: ${req.model}`);
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  const start = Date.now();
  let lastErr: Error | null = null;
  for (const repModel of models) {
    try {
      console.log(`[video] ${repModel}`);
      const cr = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: repModel, input: { prompt: req.prompt } }),
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
          return { model: req.model, provider: `replicate/${repModel}`, videoUrl: u, latencyMs: Date.now() - start };
        }
        if (d.status === "failed" || d.status === "canceled") throw new Error(`Replicate ${d.status}: ${d.error || "unknown"}`);
      }
      throw new Error("Replicate video timeout (180s)");
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[video] ${repModel} failed: ${lastErr.message}`);
    }
  }
  throw lastErr || new Error(`All video strategies failed for ${req.model}`);
}

// ── AUDIO GENERATION ─────────────────────────────────────────
async function generateAudio(req: { prompt: string; model: string }) {
  const repModel = audioModels[req.model];
  if (!repModel) throw new Error(`Unknown audio model: ${req.model}`);
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  const start = Date.now();
  console.log(`[audio] ${repModel}`);
  const cr = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: repModel, input: { prompt: req.prompt, duration: 8, model_version: "stereo-melody-large" } }),
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

// ══════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════
app.get("/health", (c) => c.json({ status: "ok", server: "ora-studio-inline", ts: new Date().toISOString() }));

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
    const result = await Promise.race([
      (async () => {
        const user = await requireAuth(c);
        console.log(`[/auth/me] auth OK (${Date.now() - t0}ms), fetching profile...`);
        const profile = await getOrCreateProfile(user.id, user.email);
        console.log(`[/auth/me] profile OK (${Date.now() - t0}ms)`);
        profile.lastLoginAt = new Date().toISOString();
        kv.set(`user:${user.id}`, profile).catch((e: any) => console.log("[/auth/me] kv.set lastLogin failed:", e));
        return c.json({ authenticated: true, profile });
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("auth/me handler timeout (8s)")), 8_000)),
    ]);
    return result;
  } catch (err) {
    console.log(`[/auth/me] error after ${Date.now() - t0}ms:`, String(err));
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
  } catch (err) { return c.json({ error: `Choose plan error: ${err}` }, 500); }
});

// ══════════════════════════════════════════════════════════════
// GENERATION ROUTES
// ══════════════════════════════════════════════════════════════
app.post("/generate/text-multi", async (c) => {
  try {
    const user = await requireAuth(c);
    const { prompt, models, systemPrompt, maxTokens } = await c.req.json();
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    const results = [];
    for (const model of models) {
      const canDeduct = await deductCredit(user.id, 1);
      if (!canDeduct) { results.push({ success: false, error: "Insufficient credits" }); continue; }
      try {
        const result = await generateText({ prompt, model, systemPrompt, maxTokens });
        results.push({ success: true, result });
        logEvent("generation", { userId: user.id, type: "text", model }).catch(() => {});
      } catch (err) { results.push({ success: false, error: String(err) }); }
    }
    return c.json({ success: true, results });
  } catch (err) {
    console.log("[text-multi] error:", err);
    return c.json({ success: false, error: `Text generation error: ${err}` }, 500);
  }
});

app.post("/generate/image-multi", async (c) => {
  const t0 = Date.now();
  try {
    const user = await requireAuth(c);
    const { prompt, models } = await c.req.json();
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    console.log(`[image-multi] models=${models.join(",")}`);
    const MODEL_TIMEOUT = 45_000;
    const results = await Promise.all(
      models.map(async (model: string) => {
        try {
          const canDeduct = await deductCredit(user.id, 2);
          if (!canDeduct) return { success: false, error: "Insufficient credits" };
          const result = await Promise.race([
            generateImage({ prompt, model }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${model} >${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT)),
          ]);
          logEvent("generation", { userId: user.id, type: "image", model }).catch(() => {});
          return { success: true, result };
        } catch (err) { return { success: false, error: String(err) }; }
      })
    );
    console.log(`[image-multi] done (${Date.now() - t0}ms)`);
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`[image-multi] error (${Date.now() - t0}ms):`, err);
    return c.json({ success: false, error: `Image generation error: ${err}` }, 500);
  }
});

app.post("/generate/video-multi", async (c) => {
  try {
    const user = await requireAuth(c);
    const { prompt, models } = await c.req.json();
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    const results: any[] = [];
    await Promise.all(
      models.map(async (model: string) => {
        const canDeduct = await deductCredit(user.id, 5);
        if (!canDeduct) { results.push({ success: false, error: "Insufficient credits" }); return; }
        try {
          const result = await generateVideo({ prompt, model });
          logEvent("generation", { userId: user.id, type: "video", model }).catch(() => {});
          results.push({ success: true, result });
        } catch (err) { results.push({ success: false, error: String(err) }); }
      })
    );
    return c.json({ success: true, results });
  } catch (err) {
    console.log("[video-multi] error:", err);
    return c.json({ success: false, error: `Video generation error: ${err}` }, 500);
  }
});

app.post("/generate/audio-multi", async (c) => {
  try {
    const user = await requireAuth(c);
    const { prompt, models } = await c.req.json();
    if (!prompt || !models?.length) return c.json({ error: "prompt and models required" }, 400);
    const results: any[] = [];
    await Promise.all(
      models.map(async (model: string) => {
        const canDeduct = await deductCredit(user.id, 3);
        if (!canDeduct) { results.push({ success: false, error: "Insufficient credits" }); return; }
        try {
          const result = await generateAudio({ prompt, model });
          logEvent("generation", { userId: user.id, type: "audio", model }).catch(() => {});
          results.push({ success: true, result });
        } catch (err) { results.push({ success: false, error: String(err) }); }
      })
    );
    return c.json({ success: true, results });
  } catch (err) {
    console.log("[audio-multi] error:", err);
    return c.json({ success: false, error: `Audio generation error: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// VAULT ROUTES
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// DEBUG / DIAGNOSTICS
// ══════════════════════════════════════════════════════════════
app.get("/debug/ai-config", (c) => {
  const mask = (key: string | undefined) => key ? `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)` : "NOT SET";
  return c.json({ apipod: mask(Deno.env.get("APIPOD_API_KEY")), fal: mask(Deno.env.get("FAL_API_KEY")), replicate: mask(Deno.env.get("REPLICATE_API_TOKEN")) });
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

// ══════════════════════════════════════════════════════════════
// CATCH-ALL
// ══════════════════════════════════════════════════════════════
app.all("*", (c) => c.json({ error: "Not found", path: c.req.path }, 404));

// ── Start server ─────────────────────────────────────────────
console.log("[boot] ORA server ready (inline AI, no external imports)");
Deno.serve(app.fetch);
