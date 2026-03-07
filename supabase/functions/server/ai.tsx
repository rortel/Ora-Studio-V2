// ══════════════════════════════════════════════
// AI Provider Adapters — Clean Provider Split
// ══════════════════════════════════════════════
// TEXT:  APIPod (apipod.ai) — OpenAI-compatible gateway for LLMs
//        One API key → OpenAI, Anthropic, Google models
// IMAGE: Runware (primary) → FAL (secondary) → Replicate (tertiary)
//        Runware + FAL lancés en parallèle — retourne le plus rapide
// VIDEO: FAL queue (primary) → Replicate (secondary) — race parallèle
//        Runware supprimé : taskType "videoInference" non supporté
// AUDIO: Replicate only (MusicGen)

export interface GenerateTextRequest {
  prompt: string;
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface GenerateTextResult {
  model: string;
  provider: string;
  text: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface GenerateImageRequest {
  prompt: string;
  model: string;
}

export interface GenerateImageResult {
  model: string;
  provider: string;
  imageUrl: string;
  latencyMs: number;
}

export interface GenerateVideoRequest {
  prompt: string;
  model: string;
}

export interface GenerateVideoResult {
  model: string;
  provider: string;
  videoUrl: string;
  latencyMs: number;
}

export interface GenerateAudioRequest {
  prompt: string;
  model: string;
}

export interface GenerateAudioResult {
  model: string;
  provider: string;
  audioUrl: string;
  latencyMs: number;
}

// ══════════════════════════════════════════════
// APIPod BASE — single gateway for TEXT only
// ══════════════════════════════════════════════

const APIPOD_BASE_URL = "https://api.apipod.ai/v1";

function getApipodKey(): string {
  const key = Deno.env.get("APIPOD_API_KEY");
  if (!key) throw new Error("APIPOD_API_KEY not configured");
  return key;
}

function apipodHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApipodKey()}`,
  };
}

// ══════════════════════════════════════════════
// MODEL REGISTRIES
// ══════════════════════════════════════════════

// --- TEXT (LLM) — all via APIPod /chat/completions ---
const textModelMap: Record<string, { apiModel: string; fallback?: string }> = {
  // OpenAI
  "gpt-4o":          { apiModel: "gpt-4o" },
  "gpt-5":           { apiModel: "gpt-5", fallback: "gpt-4o" },
  "gpt-5.2":         { apiModel: "gpt-5.2", fallback: "gpt-4o" },
  // Anthropic
  "claude-sonnet":   { apiModel: "claude-sonnet-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  "claude-haiku":    { apiModel: "claude-haiku-4-20250514", fallback: "claude-3-5-haiku-20241022" },
  "claude-opus":     { apiModel: "claude-opus-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  // Google
  "gemini-pro":      { apiModel: "gemini-2.5-flash-preview-05-20", fallback: "gemini-2.0-flash" },
  "gemini-3":        { apiModel: "gemini-3", fallback: "gemini-2.5-flash-preview-05-20" },
  // ORA aliases (route to best available)
  "ora-writer":      { apiModel: "gpt-4o" },
  "ora-code":        { apiModel: "gpt-4o" },
  "gpt-4o-code":     { apiModel: "gpt-4o" },
  "claude-code":     { apiModel: "claude-sonnet-4-20250514", fallback: "claude-3-5-sonnet-20241022" },
  "gemini-code":     { apiModel: "gemini-2.5-flash-preview-05-20", fallback: "gemini-2.0-flash" },
};

// --- IMAGE — Runware + FAL en race parallèle, Replicate en fallback ---
interface ImageStrategy {
  type: "runware" | "fal" | "replicate";
  model: string;
}

const imageModelStrategies: Record<string, ImageStrategy[]> = {
  "ora-vision":      [
    { type: "runware", model: "runware:100@1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
  "nano-banana":     [
    { type: "runware", model: "runware:100@1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
  "seedream-v4.5":   [
    { type: "runware", model: "runware:100@1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
  "seedream-5-lite": [
    { type: "runware", model: "runware:100@1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
  "dall-e":          [
    { type: "runware", model: "runware:100@1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
  "flux-pro":        [
    { type: "runware", model: "runware:101@1" },
    { type: "fal", model: "fal-ai/flux-pro/v1.1" },
    { type: "fal", model: "fal-ai/flux/schnell" },
    { type: "replicate", model: "black-forest-labs/flux-schnell" },
  ],
};

// --- VIDEO — FAL queue (primary) + Replicate (secondary), race parallèle ---
// NOTE: Runware supprimé — taskType "videoInference" non supporté par leur API
interface VideoStrategy {
  type: "fal" | "replicate";
  model: string;
}

const videoModelStrategies: Record<string, VideoStrategy[]> = {
  "ora-motion":       [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "veo-3.1":          [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "sora-2":           [{ type: "fal", model: "fal-ai/luma-dream-machine" },    { type: "replicate", model: "luma/ray" }],
  "seedance-2.0":     [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "seedance-1.5-pro": [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "seedance-1.0":     [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "runway-gen3":      [{ type: "fal", model: "fal-ai/minimax/video-01-live" }, { type: "replicate", model: "minimax/video-01-live" }],
  "pika":             [{ type: "fal", model: "fal-ai/ltx-video" },             { type: "replicate", model: "lightricks/ltx-video" }],
  "sora":             [{ type: "fal", model: "fal-ai/luma-dream-machine" },    { type: "replicate", model: "luma/ray" }],
};

// --- AUDIO — Replicate only (MusicGen) ---
const audioModelMap: Record<string, { replicateModel: string }> = {
  "ora-audio":   { replicateModel: "meta/musicgen" },
  "elevenlabs":  { replicateModel: "meta/musicgen" },
  "suno":        { replicateModel: "meta/musicgen" },
  "udio":        { replicateModel: "meta/musicgen" },
};

// ══════════════════════════════════════════════
// TEXT GENERATION (APIPod — OpenAI-compatible)
// ══════════════════════════════════════════════

export async function generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
  const mapping = textModelMap[req.model];
  if (!mapping) {
    throw new Error(`Unknown text model: ${req.model}. Available: ${Object.keys(textModelMap).join(", ")}`);
  }

  const systemPrompt = req.systemPrompt || "You are a creative professional AI assistant. Respond concisely and with high quality.";
  const maxTokens = req.maxTokens || 1024;
  const start = Date.now();

  // Build fallback chain: primary -> fallback -> gpt-4o
  const chain: string[] = [mapping.apiModel];
  if (mapping.fallback && mapping.fallback !== mapping.apiModel) chain.push(mapping.fallback);
  if (!chain.includes("gpt-4o")) chain.push("gpt-4o");

  let lastError: Error | null = null;
  for (const apiModel of chain) {
    try {
      console.log(`[APIPod Text] model=${apiModel}, prompt="${req.prompt.slice(0, 60)}..."`);

      const res = await fetch(`${APIPOD_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: apipodHeaders(),
        body: JSON.stringify({
          model: apiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.prompt },
          ],
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`APIPod ${res.status} for ${apiModel}: ${errBody}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      if (!text) throw new Error(`APIPod returned empty text for ${apiModel}`);

      if (apiModel !== mapping.apiModel) {
        console.log(`[generateText] Primary ${mapping.apiModel} failed, used fallback ${apiModel}`);
      }

      return {
        model: req.model,
        provider: `apipod/${apiModel}`,
        text,
        tokensUsed: data.usage?.total_tokens || 0,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[generateText] ${apiModel} failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error(`All text models failed for ${req.model}`);
}

// ══════════════════════════════════════════════
// IMAGE GENERATION (Runware + FAL en race, Replicate en fallback)
// ══════════════════════════════════════════════

// Runware image call (primary — ultra-fast inference)
async function callRunwareImage(rwModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("RUNWARE_IMAGE_API_KEY");
  if (!key) throw new Error("RUNWARE_IMAGE_API_KEY not configured");

  console.log(`[Runware Image] model=${rwModel}`);

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
    if (!url) throw new Error(`Runware returned no image URL: ${JSON.stringify(data).slice(0, 200)}`);
    return url;
  } finally {
    clearTimeout(timer);
  }
}

// FAL AI image call (secondary — synchronous with timeout)
async function callFalImage(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");

  console.log(`[FAL Image] model=${falModel}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`https://fal.run/${falModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ prompt, image_size: "landscape_4_3", num_images: 1, enable_safety_checker: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`FAL ${res.status} for ${falModel}: ${errBody}`);
    }

    const data = await res.json();
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error(`FAL returned no URL for ${falModel}`);
    return imageUrl;
  } finally {
    clearTimeout(timer);
  }
}

// Replicate image call — Prefer: wait puis polling si "processing"
async function callReplicateImage(replicateModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not configured");

  console.log(`[Replicate Image] model=${replicateModel}`);

  const controller = new AbortController();
  const createTimer = setTimeout(() => controller.abort(), 20_000);
  let data: any;
  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Prefer": "wait" },
      body: JSON.stringify({ input: { prompt } }),
      signal: controller.signal,
    });
    if (!res.ok) { const b = await res.text(); throw new Error(`Replicate ${res.status}: ${b}`); }
    data = await res.json();
  } finally {
    clearTimeout(createTimer);
  }

  console.log(`[Replicate Image] initial status=${data.status}, id=${data.id}`);

  // Si succeeded immédiatement
  if (data.status === "succeeded") {
    const url = typeof data.output === "string" ? data.output : Array.isArray(data.output) ? data.output[0] : null;
    if (url) return url;
  }
  if (data.status === "failed" || data.status === "canceled") {
    throw new Error(`Replicate image ${data.status}: ${data.error || "unknown"}`);
  }

  // Polling si "processing" ou "starting" (Prefer: wait a expiré côté Replicate)
  const predictionId = data.id;
  if (!predictionId) throw new Error("Replicate: no prediction ID");

  let elapsed = 0;
  while (elapsed < 30_000) {
    await new Promise((r) => setTimeout(r, 2_000));
    elapsed += 2_000;

    const pr = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pr.ok) continue;
    const pd = await pr.json();

    if (pd.status === "succeeded") {
      const url = typeof pd.output === "string" ? pd.output : Array.isArray(pd.output) ? pd.output[0] : null;
      if (!url) throw new Error("Replicate image: no output URL");
      return url;
    }
    if (pd.status === "failed" || pd.status === "canceled") {
      throw new Error(`Replicate image ${pd.status}: ${pd.error || "unknown"}`);
    }
  }

  throw new Error("Replicate image timeout (30s polling)");
}

// Main image generation — Runware + FAL en race parallèle, Replicate en fallback
export async function generateImage(req: GenerateImageRequest): Promise<GenerateImageResult> {
  const strategies = imageModelStrategies[req.model];
  if (!strategies) {
    throw new Error(`Unknown image model: ${req.model}. Available: ${Object.keys(imageModelStrategies).join(", ")}`);
  }

  const start = Date.now();

  const callStrat = async (s: ImageStrategy): Promise<GenerateImageResult> => {
    let imageUrl: string;
    if (s.type === "runware") imageUrl = await callRunwareImage(s.model, req.prompt);
    else if (s.type === "fal") imageUrl = await callFalImage(s.model, req.prompt);
    else imageUrl = await callReplicateImage(s.model, req.prompt);
    return { model: req.model, provider: `${s.type}/${s.model}`, imageUrl, latencyMs: Date.now() - start };
  };

  // Race les 2 premiers (Runware + FAL) en parallèle
  const [s0, s1, ...rest] = strategies;
  try {
    return await Promise.any([callStrat(s0), callStrat(s1)]);
  } catch {
    // Les 2 premiers ont échoué → fallbacks séquentiels
    for (const s of rest) {
      try { return await callStrat(s); } catch (e) {
        console.log(`[generateImage] fallback ${s.type}/${s.model} failed: ${e}`);
      }
    }
    throw new Error(`All image strategies failed for ${req.model}`);
  }
}

// ══════════════════════════════════════════════
// VIDEO GENERATION (FAL queue + Replicate en race parallèle)
// NOTE: Runware supprimé — taskType "videoInference" non supporté
// ══════════════════════════════════════════════

// Params FAL adaptés par modèle
function getFalVideoBody(falModel: string, prompt: string): Record<string, unknown> {
  if (falModel.includes("minimax")) return { prompt, prompt_optimizer: true };
  if (falModel.includes("luma"))    return { prompt, duration: "5s", aspect_ratio: "16:9" };
  if (falModel.includes("ltx"))     return { prompt, negative_prompt: "low quality, blurry, distorted" };
  return { prompt };
}

// FAL video via queue API (async — polling)
async function callFalVideo(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");

  console.log(`[FAL Video queue] model=${falModel}`);
  const headers = { "Content-Type": "application/json", Authorization: `Key ${key}` };

  // Soumission à la queue
  const submitRes = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers,
    body: JSON.stringify(getFalVideoBody(falModel, prompt)),
  });
  if (!submitRes.ok) {
    const b = await submitRes.text();
    throw new Error(`FAL submit ${submitRes.status} for ${falModel}: ${b}`);
  }
  const { request_id } = await submitRes.json();
  if (!request_id) throw new Error(`FAL: no request_id for ${falModel}`);

  // Polling jusqu'à completion (max 120s)
  const pollBase = `https://queue.fal.run/${falModel}/requests/${request_id}`;
  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise((r) => setTimeout(r, 3_000));
    elapsed += 3_000;

    const statusRes = await fetch(`${pollBase}/status`, { headers });
    if (!statusRes.ok) continue;
    const status = await statusRes.json();
    console.log(`[FAL Video] ${falModel} status=${status.status} (${elapsed}ms)`);

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(pollBase, { headers });
      if (!resultRes.ok) throw new Error(`FAL result ${resultRes.status}`);
      const result = await resultRes.json();
      const url = result.video?.url || result.videos?.[0]?.url || result.data?.[0]?.url || result.url;
      if (!url) throw new Error(`FAL: no video URL in result for ${falModel}`);
      return url;
    }
    if (status.status === "FAILED") {
      throw new Error(`FAL video failed for ${falModel}: ${status.error || "unknown"}`);
    }
  }

  throw new Error(`FAL video timeout (120s) for ${falModel}`);
}

// Replicate video call (poll-based)
async function callReplicateVideo(replicateModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not configured");

  console.log(`[Replicate Video] model=${replicateModel}`);

  const createRes = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: { prompt } }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Replicate create ${createRes.status} for ${replicateModel}: ${errBody}`);
  }

  const prediction = await createRes.json();
  const predictionId = prediction.id;
  if (!predictionId) throw new Error("Replicate: no prediction ID");

  let elapsed = 0;
  while (elapsed < 180_000) {
    await new Promise((r) => setTimeout(r, 4_000));
    elapsed += 4_000;

    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "succeeded") {
      const url = typeof pollData.output === "string"
        ? pollData.output
        : Array.isArray(pollData.output) ? pollData.output[0] : null;
      if (!url) throw new Error("Replicate video: no output URL");
      return url;
    }
    if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(`Replicate video ${pollData.status}: ${pollData.error || "unknown"}`);
    }
  }

  throw new Error(`Replicate video timed out (180s) for ${replicateModel}`);
}

// Main video generation — FAL + Replicate en race parallèle
export async function generateVideo(req: GenerateVideoRequest): Promise<GenerateVideoResult> {
  const strategies = videoModelStrategies[req.model];
  if (!strategies) {
    throw new Error(`Unknown video model: ${req.model}. Available: ${Object.keys(videoModelStrategies).join(", ")}`);
  }

  const start = Date.now();

  const callVidStrat = async (s: VideoStrategy): Promise<GenerateVideoResult> => {
    const videoUrl = s.type === "fal"
      ? await callFalVideo(s.model, req.prompt)
      : await callReplicateVideo(s.model, req.prompt);
    return { model: req.model, provider: `${s.type}/${s.model}`, videoUrl, latencyMs: Date.now() - start };
  };

  // Race tous les providers en parallèle — retourne le plus rapide
  return await Promise.any(strategies.map(callVidStrat));
}

// ══════════════════════════════════════════════
// AUDIO GENERATION (Replicate only — MusicGen)
// ══════════════════════════════════════════════

export async function generateAudio(req: GenerateAudioRequest): Promise<GenerateAudioResult> {
  const mapping = audioModelMap[req.model];
  if (!mapping) {
    throw new Error(`Unknown audio model: ${req.model}. Available: ${Object.keys(audioModelMap).join(", ")}`);
  }

  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not configured");

  const start = Date.now();
  const replicateModel = mapping.replicateModel;
  console.log(`[Replicate Audio] model=${replicateModel}, prompt="${req.prompt.slice(0, 60)}..."`);

  const createRes = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      input: { prompt: req.prompt, duration: 8, model_version: "stereo-melody-large" },
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Replicate create ${createRes.status} for ${replicateModel}: ${errBody}`);
  }

  const prediction = await createRes.json();
  const predictionId = prediction.id;
  if (!predictionId) throw new Error("Replicate: no prediction ID");

  let elapsed = 0;
  while (elapsed < 120_000) {
    await new Promise((r) => setTimeout(r, 3_000));
    elapsed += 3_000;

    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "succeeded") {
      const audioUrl = typeof pollData.output === "string"
        ? pollData.output
        : Array.isArray(pollData.output) ? pollData.output[0] : null;
      if (!audioUrl) throw new Error("Replicate audio: no output URL");
      return { model: req.model, provider: `replicate/${replicateModel}`, audioUrl, latencyMs: Date.now() - start };
    }
    if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(`Replicate audio ${pollData.status}: ${pollData.error || "unknown"}`);
    }
  }

  throw new Error(`Replicate audio timed out (120s)`);
}
