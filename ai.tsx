// ══════════════════════════════════════════════
// AI Provider Adapters — Clean Provider Split
// ══════════════════════════════════════════════
// TEXT:  APIPod (apipod.ai) — OpenAI-compatible gateway for LLMs
//        One API key → OpenAI, Anthropic, Google models
// IMAGE: Runware (primary) → FAL (secondary) → Replicate (tertiary)
// VIDEO: Runware (primary) → FAL (secondary) → Replicate (tertiary)
// AUDIO: Replicate only (MusicGen)
//
// Fallback chain: Runware → FAL → Replicate for images & video
// APIPod is used only for text (LLM) generation.

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

// --- IMAGE — Runware primary, FAL secondary, Replicate tertiary ---
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

// --- VIDEO — Runware primary, FAL secondary, Replicate tertiary ---
interface VideoStrategy {
  type: "runware" | "fal" | "replicate";
  model: string;
}

const videoModelStrategies: Record<string, VideoStrategy[]> = {
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
// IMAGE GENERATION (Runware → FAL → Replicate)
// ══════════════════════════════════════════════

// Runware image call (primary — ultra-fast inference)
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

// FAL AI image call (secondary — synchronous)
async function callFalImage(falModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("FAL_API_KEY not configured");

  console.log(`[FAL Image] model=${falModel}, prompt="${prompt.slice(0, 60)}..."`);

  const res = await fetch(`https://fal.run/${falModel}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${key}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_4_3",
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`FAL ${res.status} for ${falModel}: ${errBody}`);
  }

  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error(`FAL returned no URL for ${falModel}`);
  return imageUrl;
}

// Replicate image call (synchronous via Prefer: wait)
async function callReplicateImage(replicateModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not configured");

  console.log(`[Replicate Image] model=${replicateModel}, prompt="${prompt.slice(0, 60)}..."`);

  // Use /v1/models/{owner}/{name}/predictions with Prefer: wait (synchronous)
  const url = `https://api.replicate.com/v1/models/${replicateModel}/predictions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Prefer": "wait",
    },
    body: JSON.stringify({
      input: { prompt },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Replicate ${res.status} for ${replicateModel}: ${errBody}`);
  }

  const data = await res.json();
  console.log(`[Replicate Image] status=${data.status}, id=${data.id}`);

  if (data.status === "succeeded") {
    const imageUrl = typeof data.output === "string"
      ? data.output
      : Array.isArray(data.output)
      ? data.output[0]
      : null;
    if (!imageUrl) throw new Error("Replicate image returned no output URL");
    return imageUrl;
  } else if (data.status === "failed" || data.status === "canceled") {
    throw new Error(`Replicate image ${data.status}: ${data.error || "unknown"}`);
  }

  throw new Error(`Replicate image unexpected status: ${data.status}`);
}

// Main image generation with fallback chain
export async function generateImage(req: GenerateImageRequest): Promise<GenerateImageResult> {
  const strategies = imageModelStrategies[req.model];
  if (!strategies) {
    throw new Error(`Unknown image model: ${req.model}. Available: ${Object.keys(imageModelStrategies).join(", ")}`);
  }

  const start = Date.now();
  let lastError: Error | null = null;

  for (const strategy of strategies) {
    try {
      let imageUrl: string;

      if (strategy.type === "runware") {
        imageUrl = await callRunwareImage(strategy.model, req.prompt);
      } else if (strategy.type === "fal") {
        imageUrl = await callFalImage(strategy.model, req.prompt);
      } else {
        imageUrl = await callReplicateImage(strategy.model, req.prompt);
      }

      return {
        model: req.model,
        provider: `${strategy.type}/${strategy.model}`,
        imageUrl,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[generateImage] ${strategy.type}/${strategy.model} failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error(`All image strategies failed for ${req.model}`);
}

// ══════════════════════════════════════════════
// VIDEO GENERATION (Runware → FAL → Replicate)
// ══════════════════════════════════════════════

// Runware video call (primary — fast inference)
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

// FAL AI video call (secondary provider for video)
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

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`FAL ${res.status} for ${falModel}: ${errBody}`);
    }

    const data = await res.json();
    const videoUrl = data.video?.url || data.data?.[0]?.url || data.videos?.[0]?.url || data.url;
    if (!videoUrl) throw new Error(`FAL returned no video URL for ${falModel}: ${JSON.stringify(data).slice(0, 300)}`);
    return videoUrl;
  } finally {
    clearTimeout(timer);
  }
}

// Replicate video call (poll-based)
async function callReplicateVideo(replicateModel: string, prompt: string): Promise<string> {
  const key = Deno.env.get("REPLICATE_API_TOKEN");
  if (!key) throw new Error("REPLICATE_API_TOKEN not configured");

  console.log(`[Replicate Video] model=${replicateModel}, prompt="${prompt.slice(0, 60)}..."`);

  const createRes = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: { prompt },
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Replicate create ${createRes.status} for ${replicateModel}: ${errBody}`);
  }

  const prediction = await createRes.json();
  const predictionId = prediction.id;
  if (!predictionId) throw new Error("Replicate returned no prediction ID");

  const maxWait = 180_000;
  const pollInterval = 4_000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "succeeded") {
      const url = typeof pollData.output === "string"
        ? pollData.output
        : Array.isArray(pollData.output) ? pollData.output[0] : null;
      if (!url) throw new Error("Replicate video returned no output URL");
      return url;
    } else if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(`Replicate video ${pollData.status}: ${pollData.error || "unknown"}`);
    }
  }

  throw new Error(`Replicate video timed out after ${maxWait / 1000}s`);
}

// Main video generation with fallback
export async function generateVideo(req: GenerateVideoRequest): Promise<GenerateVideoResult> {
  const strategies = videoModelStrategies[req.model];
  if (!strategies) {
    throw new Error(`Unknown video model: ${req.model}. Available: ${Object.keys(videoModelStrategies).join(", ")}`);
  }

  const start = Date.now();
  let lastError: Error | null = null;

  for (const strategy of strategies) {
    try {
      let videoUrl: string;

      if (strategy.type === "runware") {
        videoUrl = await callRunwareVideo(strategy.model, req.prompt);
      } else if (strategy.type === "fal") {
        videoUrl = await callFalVideo(strategy.model, req.prompt);
      } else {
        videoUrl = await callReplicateVideo(strategy.model, req.prompt);
      }

      return {
        model: req.model,
        provider: `${strategy.type}/${strategy.model}`,
        videoUrl,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[generateVideo] ${strategy.type}/${strategy.model} failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error(`All video strategies failed for ${req.model}`);
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: {
        prompt: req.prompt,
        duration: 8,
        model_version: "stereo-melody-large",
      },
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Replicate create ${createRes.status} for ${replicateModel}: ${errBody}`);
  }

  const prediction = await createRes.json();
  const predictionId = prediction.id;
  if (!predictionId) throw new Error("Replicate returned no prediction ID");

  const maxWait = 120_000;
  const pollInterval = 3_000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "succeeded") {
      const audioUrl = typeof pollData.output === "string"
        ? pollData.output
        : Array.isArray(pollData.output) ? pollData.output[0] : null;
      if (!audioUrl) throw new Error("Replicate audio returned no output URL");

      return {
        model: req.model,
        provider: `replicate/${replicateModel}`,
        audioUrl,
        latencyMs: Date.now() - start,
      };
    } else if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(`Replicate audio ${pollData.status}: ${pollData.error || "unknown"}`);
    }
  }

  throw new Error(`Replicate audio timed out after ${maxWait / 1000}s`);
}