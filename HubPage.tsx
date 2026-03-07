import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon, Code2, Film, Music, FileText, ArrowUp, Sparkles,
  Columns2, BookOpen, Download, Trash2,
  Check, Copy, ExternalLink, Search, ChevronDown,
  RotateCcw, SlidersHorizontal, Zap, Clock, Heart, FolderOpen,
  Eye, X, Plus, ArrowRight,
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type ContentType = "image" | "code" | "film" | "sound" | "text";
type HubTab = "generate" | "library" | "compare";

interface AIModel {
  id: string;
  name: string;
  provider: string;
  speed: "fast" | "medium" | "slow";
  quality: number; /* 1-5 */
}

interface GeneratedItem {
  id: string;
  type: ContentType;
  model: AIModel;
  prompt: string;
  timestamp: string;
  saved: boolean;
  selected: boolean;
  /* Visual representation data */
  preview: GenerationPreview;
}

interface LibraryItem extends GeneratedItem {
  folder?: string;
  tags: string[];
}

type GenerationPreview =
  | { kind: "image"; palette: string[]; label: string; imageUrl?: string }
  | { kind: "text"; excerpt: string; wordCount: number }
  | { kind: "code"; language: string; snippet: string; lines: number }
  | { kind: "film"; duration: string; frames: string[]; fps: number; videoUrl?: string }
  | { kind: "sound"; waveform: number[]; duration: string; bpm?: number; audioUrl?: string };

/* ═══════════════════════════════════
   AI MODELS
   ═══════════════════════════════════ */

const aiModels: Record<ContentType, AIModel[]> = {
  image: [
    { id: "ora-vision", name: "ORA Vision", provider: "ORA", speed: "fast", quality: 5 },
    { id: "nano-banana", name: "Nano Banana", provider: "Google", speed: "fast", quality: 5 },
    { id: "seedream-v4.5", name: "Seedream V4.5", provider: "ByteDance", speed: "fast", quality: 5 },
    { id: "seedream-5-lite", name: "Seedream 5.0 Lite", provider: "ByteDance", speed: "fast", quality: 4 },
    { id: "dall-e", name: "DALL-E 3", provider: "OpenAI", speed: "fast", quality: 4 },
    { id: "flux-pro", name: "Flux Pro", provider: "Black Forest", speed: "medium", quality: 5 },
  ],
  text: [
    { id: "ora-writer", name: "ORA Writer", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-5", name: "GPT-5", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "gpt-5.2", name: "GPT-5.2", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-sonnet", name: "Claude Sonnet 4", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "claude-opus", name: "Claude Opus 4", provider: "Anthropic", speed: "medium", quality: 5 },
    { id: "claude-haiku", name: "Claude Haiku 4", provider: "Anthropic", speed: "fast", quality: 4 },
    { id: "gemini-3", name: "Gemini 3", provider: "Google", speed: "fast", quality: 5 },
    { id: "gemini-pro", name: "Gemini 2.5 Flash", provider: "Google", speed: "fast", quality: 4 },
  ],
  code: [
    { id: "ora-code", name: "ORA Code", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-4o-code", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-code", name: "Claude Sonnet 4", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "gemini-code", name: "Gemini 2.5 Flash", provider: "Google", speed: "fast", quality: 4 },
  ],
  film: [
    { id: "ora-motion", name: "ORA Motion", provider: "ORA", speed: "medium", quality: 5 },
    { id: "veo-3.1", name: "Veo 3.1", provider: "Google", speed: "medium", quality: 5 },
    { id: "sora-2", name: "Sora 2", provider: "OpenAI", speed: "slow", quality: 5 },
    { id: "seedance-2.0", name: "Seedance 2.0", provider: "ByteDance", speed: "medium", quality: 5 },
    { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro", provider: "ByteDance", speed: "medium", quality: 5 },
    { id: "seedance-1.0", name: "Seedance 1.0", provider: "ByteDance", speed: "fast", quality: 4 },
  ],
  sound: [
    { id: "ora-audio", name: "ORA Audio", provider: "ORA", speed: "fast", quality: 5 },
    { id: "elevenlabs", name: "ElevenLabs", provider: "ElevenLabs", speed: "fast", quality: 5 },
    { id: "suno", name: "Suno v4", provider: "Suno", speed: "medium", quality: 4 },
    { id: "udio", name: "Udio", provider: "Udio", speed: "medium", quality: 4 },
  ],
};

const contentTypes: { id: ContentType; label: string; icon: typeof ImageIcon }[] = [
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "text", label: "Text", icon: FileText },
  { id: "code", label: "Code", icon: Code2 },
  { id: "film", label: "Film", icon: Film },
  { id: "sound", label: "Sound", icon: Music },
];

/* ═══════════════════════════════════
   MOCK GENERATION FACTORY
   ═══════════════════════════════════ */

const palettes = [
  ["#3b4fc4", "#6b7ec9", "#c4cbe0", "#e8ebf4"],
  ["#1a1a2e", "#4a5568", "#9ba8d4", "#f4f4f6"],
  ["#2d3a8c", "#5a6abf", "#8b9ad4", "#d4daf0"],
  ["#1e293b", "#334155", "#64748b", "#cbd5e1"],
];

function generateMockPreviews(type: ContentType, prompt: string, models: AIModel[]): GeneratedItem[] {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return models.map((model, i) => {
    const id = `gen-${Date.now()}-${i}`;
    let preview: GenerationPreview;

    switch (type) {
      case "image":
        preview = {
          kind: "image",
          palette: palettes[i % palettes.length],
          label: [`Geometric composition`, `Abstract signal pattern`, `Minimal gradient field`, `Structured grid layout`][i % 4],
        };
        break;
      case "text":
        preview = {
          kind: "text",
          excerpt: [
            `In an era where brand consistency defines market leadership, the ability to maintain a unified voice across every touchpoint becomes not just an advantage — it becomes the standard.`,
            `Your brand speaks in one voice. Whether it's a LinkedIn post or a billboard, the message adapts to the medium while the essence remains untouched. That's not automation — that's intelligence.`,
            `The gap between strategy and execution has never been wider. Until now. With AI-driven content orchestration, every piece of communication carries the full weight of your brand identity.`,
            `Brand amplification isn't about being louder. It's about being clearer. Every channel, every format, every word — calibrated to resonate with precision.`,
          ][i % 4],
          wordCount: [142, 128, 156, 118][i % 4],
        };
        break;
      case "code":
        preview = {
          kind: "code",
          language: "TypeScript",
          snippet: [
            `export async function cascadeContent(\n  master: MasterBrief,\n  formats: Format[]\n): Promise<CascadeResult> {\n  const vault = await loadBrandVault();\n  return formats.map(f => adapt(master, f, vault));\n}`,
            `const pipeline = createPipeline([\n  analyzeIntent(brief),\n  validateCompliance(vault),\n  generateVariants(formats),\n  scoreAndRank(criteria),\n]);`,
            `interface BrandVault {\n  tone: ToneProfile;\n  vocabulary: ApprovedTerms;\n  visual: VisualIdentity;\n  compliance: ComplianceRules;\n  audience: AudienceSegment[];\n}`,
            `async function orchestrate(input: string) {\n  const agents = await Agent.deploy(15);\n  const results = await Promise.all(\n    agents.map(a => a.process(input))\n  );\n  return merge(results);\n}`,
          ][i % 4],
          lines: [7, 6, 7, 7][i % 4],
        };
        break;
      case "film":
        preview = {
          kind: "film",
          duration: ["0:15", "0:12", "0:18", "0:10"][i % 4],
          frames: palettes[i % palettes.length],
          fps: 30,
        };
        break;
      case "sound":
        preview = {
          kind: "sound",
          waveform: Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8),
          duration: ["0:32", "0:28", "0:45", "0:20"][i % 4],
          bpm: [120, 90, 140, 100][i % 4],
        };
        break;
    }

    return { id, type, model, prompt, timestamp: ts, saved: false, selected: false, preview };
  });
}

/* ══════════════════════════════════
   MOCK LIBRARY
   ═══════════════════════════════════ */

const mockLibrary: LibraryItem[] = [
  {
    id: "lib-1", type: "image", model: aiModels.image[0], prompt: "Abstract brand pattern for Q2 campaign",
    timestamp: "Yesterday", saved: true, selected: false, tags: ["brand", "Q2"],
    preview: { kind: "image", palette: palettes[0], label: "Brand Pattern — Q2" },
  },
  {
    id: "lib-2", type: "text", model: aiModels.text[0], prompt: "LinkedIn announcement copy",
    timestamp: "Yesterday", saved: true, selected: false, tags: ["linkedin", "launch"],
    preview: { kind: "text", excerpt: "We're excited to announce a new chapter in brand intelligence. ORA Studio brings 15 AI agents together to ensure every word carries your brand's DNA.", wordCount: 234 },
  },
  {
    id: "lib-3", type: "code", model: aiModels.code[2], prompt: "API integration for content pipeline",
    timestamp: "2 days ago", saved: true, selected: false, tags: ["api", "integration"],
    preview: { kind: "code", language: "TypeScript", snippet: `const ora = new ORAClient({ apiKey });\nconst campaign = await ora.campaigns.create({\n  brief: "Q2 product launch",\n  formats: ["email", "linkedin", "ad"],\n});`, lines: 5 },
  },
  {
    id: "lib-4", type: "film", model: aiModels.film[1], prompt: "15s product teaser for social",
    timestamp: "3 days ago", saved: true, selected: false, tags: ["social", "teaser"],
    preview: { kind: "film", duration: "0:15", frames: palettes[2], fps: 30 },
  },
  {
    id: "lib-5", type: "sound", model: aiModels.sound[0], prompt: "Ambient background for brand video",
    timestamp: "4 days ago", saved: true, selected: false, tags: ["ambient", "video"],
    preview: { kind: "sound", waveform: Array.from({ length: 48 }, (_, j) => 10 + Math.sin(j * 0.3) * 14 + Math.random() * 6), duration: "0:45", bpm: 90 },
  },
  {
    id: "lib-6", type: "image", model: aiModels.image[2], prompt: "Minimal visual for email header",
    timestamp: "5 days ago", saved: true, selected: false, tags: ["email", "header"],
    preview: { kind: "image", palette: palettes[3], label: "Email Header Visual" },
  },
];

/* ═══════════════════════════════════
   MAIN HUB COMPONENT
   ═══════════════════════════════════ */

export function HubPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<HubTab>("generate");
  const [contentType, setContentType] = useState<ContentType>((searchParams.get("type") as ContentType) || "image");
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [generations, setGenerations] = useState<GeneratedItem[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>(mockLibrary);
  const [compareItems, setCompareItems] = useState<GeneratedItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => [aiModels.image[0].id]);
  const [libraryFilter, setLibraryFilter] = useState<ContentType | "all">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [previewItem, setPreviewItem] = useState<GeneratedItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Clear URL params after reading them
  useEffect(() => {
    if (searchParams.get("prompt")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const models = aiModels[contentType];
  const activeModels = models.filter((m) => selectedModels.includes(m.id));

  useEffect(() => {
    const firstModel = aiModels[contentType][0];
    setSelectedModels(firstModel ? [firstModel.id] : []);
  }, [contentType]);

  const auth = useAuth();
  const getAuthToken = useCallback(() => {
    return auth.getAuthHeader();
  }, [auth]);

  // v43 pattern: send user JWT directly in Authorization (server decodes JWT locally now, no hang risk)
  // Falls back to publicAnonKey if user is not logged in
  // FIX: Always send publicAnonKey in Authorization (for Supabase gateway auth — no JWT validation hang).
  // Send user JWT in X-User-Token (server reads it from there first, see index.tsx line 54).
  const makeHeaders = useCallback((contentType = true) => {
    const token = getAuthToken();
    const h: Record<string, string> = {
      Authorization: `Bearer ${publicAnonKey}`,
    };
    if (token) h["X-User-Token"] = token;
    if (contentType) h["Content-Type"] = "application/json";
    return h;
  }, [getAuthToken]);

  const handleGenerate = useCallback(async () => {
    console.log("[HubPage] handleGenerate called", { prompt: prompt.slice(0, 60), isGenerating, activeModelsCount: activeModels.length, contentType });
    if (!prompt.trim() || isGenerating || activeModels.length === 0) {
      console.warn("[HubPage] handleGenerate SKIPPED:", { emptyPrompt: !prompt.trim(), isGenerating, noModels: activeModels.length === 0 });
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    setActiveTab("generate");
    const currentPrompt = prompt;
    setPrompt("");
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const isTextType = contentType === "text" || contentType === "code";
    const isImageType = contentType === "image";
    const token = getAuthToken();

    const genStartMs = Date.now();
    console.log("[HubPage] Generate:", { contentType, models: activeModels.map(m => m.id), prompt: currentPrompt.slice(0, 60) });
    console.log("[HubPage] Token type:", !token ? "NO TOKEN (not logged in)" : `user-jwt (${token.slice(0, 20)}...)`);
    console.log("[HubPage] API_BASE:", API_BASE);
    console.log("[HubPage] Start time:", new Date().toISOString());

    // Fire-and-forget health check for logging only (don't block generation)
    fetch(`${API_BASE}/health`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: AbortSignal.timeout(5_000),
    })
      .then(r => r.json())
      .then(d => console.log("[HubPage] Server health:", d))
      .catch(e => console.warn("[HubPage] Health ping failed:", e?.message || e));

    if (isTextType) {
      try {
        const modelIds = activeModels.map((m) => m.id);
        console.log("[HubPage] Text generation starting:", { models: modelIds, prompt: currentPrompt.slice(0, 60) });
        const sysPrompt = contentType === "code"
          ? "You are an expert programmer. Write clean, well-structured code. Return only the code, no explanations."
          : "You are a creative professional writer. Write high-quality, concise content.";

        // Retry logic: up to 2 attempts (transient network errors)
        let res: Response | null = null;
        let lastFetchErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            console.log(`[HubPage] Text POST attempt ${attempt + 1} ->`, `${API_BASE}/generate/text-multi`);
            res = await fetch(`${API_BASE}/generate/text-multi`, {
              method: "POST",
              headers: makeHeaders(),
              body: JSON.stringify({ prompt: currentPrompt, models: modelIds, systemPrompt: sysPrompt, maxTokens: 1024 }),
              signal: AbortSignal.timeout(45_000), // 45s timeout
            });
            console.log(`[HubPage] Text response (attempt ${attempt + 1}):`, res.status, `(${Date.now() - genStartMs}ms)`);
            lastFetchErr = null;
            break;
          } catch (fetchErr: any) {
            lastFetchErr = fetchErr;
            console.warn(`[HubPage] Text fetch attempt ${attempt + 1} failed:`, fetchErr?.name, fetchErr?.message);
            if (attempt === 0) {
              console.log("[HubPage] Retrying text in 1s...");
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        if (lastFetchErr || !res) {
          throw lastFetchErr || new Error("All text fetch attempts failed");
        }
        const rawText = await res.text();
        console.log("[HubPage] Text raw response:", rawText.slice(0, 300));
        let data: any;
        try { data = JSON.parse(rawText); } catch {
          setGenerationError(`Server returned invalid text response (status ${res.status}): ${rawText.slice(0, 200)}`);
          setGenerations([]);
          setIsGenerating(false);
          return;
        }
        if (data.success && data.results) {
          const items: GeneratedItem[] = data.results.map((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            const text = r.success ? r.result.text : `Error: ${r.error}`;
            const wc = text.split(/\s+/).filter(Boolean).length;
            const lat = r.success ? r.result.latencyMs : 0;
            const preview: GenerationPreview = contentType === "code"
              ? { kind: "code", language: "TypeScript", snippet: text.slice(0, 500), lines: text.split("\n").length }
              : { kind: "text", excerpt: text, wordCount: wc };
            return { id: `gen-${Date.now()}-${i}`, type: contentType, model: { ...model, speed: (lat < 2000 ? "fast" : lat < 5000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(lat / 1000).toFixed(1)}s)`, saved: false, selected: false, preview };
          });
          console.log("[HubPage] SUCCESS: setting", items.length, "generations. Preview[0]:", JSON.stringify(items[0]?.preview).slice(0, 200));
          setGenerations(items);
        } else {
          console.error("Generation failed:", data.error);
          setGenerationError(data.error || "Text generation failed. Check API keys and credits.");
          setGenerations([]);
        }
      } catch (err: any) {
        const elapsedMs = Date.now() - genStartMs;
        console.error("[HubPage] Text catch block:", err?.name, err?.message, `after ${elapsedMs}ms`);
        const isNetworkError = err?.name === "TypeError" && (err?.message?.includes("Load failed") || err?.message?.includes("Failed to fetch"));
        const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
        let msg: string;
        if (isTimeout) {
          msg = `Text generation timed out after ${(elapsedMs / 1000).toFixed(0)}s. The server didn't respond in time.`;
        } else if (isNetworkError) {
          msg = `Network error after ${(elapsedMs / 1000).toFixed(0)}s. Server connection lost. Please try again.`;
        } else {
          msg = `Text request error: ${err?.message || err}. Elapsed: ${(elapsedMs / 1000).toFixed(1)}s.`;
        }
        console.error("[HubPage] Text generation error:", msg);
        setGenerationError(msg);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (isImageType) {
      try {
        const modelIds = activeModels.map((m) => m.id);
        console.log("[HubPage] Image generation starting:", { models: modelIds, prompt: currentPrompt.slice(0, 60) });

        // Retry logic: up to 2 attempts (network errors in Figma preview are transient)
        let res: Response | null = null;
        let lastFetchErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            console.log(`[HubPage] Image POST attempt ${attempt + 1} ->`, `${API_BASE}/generate/image-multi`, "at", new Date().toISOString());
            const fetchStartMs = Date.now();
            res = await fetch(`${API_BASE}/generate/image-multi`, {
              method: "POST",
              headers: makeHeaders(),
              body: JSON.stringify({ prompt: currentPrompt, models: modelIds }),
              signal: AbortSignal.timeout(45_000),
            });
            console.log(`[HubPage] Image response (attempt ${attempt + 1}):`, res.status, `(${Date.now() - fetchStartMs}ms)`);
            lastFetchErr = null;
            break; // success
          } catch (fetchErr: any) {
            lastFetchErr = fetchErr;
            console.warn(`[HubPage] Image fetch attempt ${attempt + 1} failed:`, fetchErr?.name, fetchErr?.message);
            if (attempt === 0) {
              console.log("[HubPage] Retrying in 1s...");
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        if (lastFetchErr || !res) {
          throw lastFetchErr || new Error("All fetch attempts failed");
        }
        console.log("[HubPage] Image response status:", res.status, "ok:", res.ok, `(${Date.now() - genStartMs}ms total)`);
        const rawText = await res.text();
        console.log("[HubPage] Image raw response:", rawText.slice(0, 500));
        let data: any;
        try { data = JSON.parse(rawText); } catch {
          setGenerationError(`Server returned invalid response (status ${res.status}): ${rawText.slice(0, 200)}`);
          setGenerations([]);
          setIsGenerating(false);
          setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
          return;
        }
        console.log("[HubPage] Image results:", data.success, data.results?.length, data.error);
        if (data.success && data.results) {
          const items: GeneratedItem[] = data.results.map((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            if (r.success && r.result.imageUrl) {
              return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model: { ...model, speed: ((r.result.latencyMs || 0) < 10000 ? "fast" : (r.result.latencyMs || 0) < 30000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(r.result.latencyMs / 1000).toFixed(1)}s)`, saved: false, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `Generated by ${model.name} via ${r.result.provider || "AI"}`, imageUrl: r.result.imageUrl } };
            }
            const errorMsg = r.error ? ` — ${String(r.error).slice(0, 80)}` : "";
            return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `${model.name} (failed${errorMsg})` } };
          });
          setGenerations(items);
        } else {
          console.error("Image generation failed:", data.error);
          const errMsg = data.error?.includes("Unauthorized")
            ? "Authentication failed. Please sign in again before generating."
            : (data.error || "Image generation failed. Check API keys and credits.");
          setGenerationError(errMsg);
          setGenerations([]);
        }
      } catch (err: any) {
        const elapsedMs = Date.now() - genStartMs;
        console.error("[HubPage] Image catch block:", err?.name, err?.message, `after ${elapsedMs}ms`, err);
        const isNetworkError = err?.name === "TypeError" && (err?.message?.includes("Load failed") || err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError"));
        const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
        let msg: string;
        if (isTimeout) {
          msg = `Image generation timed out after ${(elapsedMs / 1000).toFixed(0)}s. The server didn't respond in time. Try again or use fewer models.`;
        } else if (isNetworkError) {
          msg = `Network error after ${(elapsedMs / 1000).toFixed(0)}s. The server connection was lost (AI providers took too long). Please try again.`;
        } else {
          msg = `Image request error: ${err?.message || err}. Elapsed: ${(elapsedMs / 1000).toFixed(1)}s.`;
        }
        console.error("[HubPage] Image generation error:", msg);
        setGenerationError(msg);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (contentType === "film") {
      // Film: real Replicate video generation
      try {
        const modelIds = activeModels.map((m) => m.id);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 240_000); // 4min for video
        const res = await fetch(`${API_BASE}/generate/video-multi`, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify({ prompt: currentPrompt, models: modelIds }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.success && data.results) {
          const items: GeneratedItem[] = data.results.map((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            const lat = r.success ? r.result.latencyMs : 0;
            if (r.success && r.result.videoUrl) {
              return { id: `gen-${Date.now()}-${i}`, type: "film" as ContentType, model: { ...model, speed: (lat < 30000 ? "fast" : lat < 90000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(lat / 1000).toFixed(0)}s)`, saved: false, selected: false, preview: { kind: "film" as const, duration: "0:15", frames: palettes[i % palettes.length], fps: 24, videoUrl: r.result.videoUrl } };
            }
            return { id: `gen-${Date.now()}-${i}`, type: "film" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "film" as const, duration: "0:00", frames: palettes[i % palettes.length], fps: 24 } };
          });
          setGenerations(items);
        } else {
          console.error("Video generation failed:", data.error);
          setGenerationError(data.error || "Video generation failed. Check API keys and credits.");
          setGenerations([]);
        }
      } catch (err: any) {
        const msg = err?.name === "AbortError"
          ? "Video generation timed out (4min). Try selecting fewer models."
          : `Video request failed: ${err}. Check network and server status.`;
        console.error("Video generation request failed:", err);
        setGenerationError(msg);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (contentType === "sound") {
      // Sound: real Replicate audio generation
      try {
        const modelIds = activeModels.map((m) => m.id);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180_000); // 3min for audio
        const res = await fetch(`${API_BASE}/generate/audio-multi`, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify({ prompt: currentPrompt, models: modelIds }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.success && data.results) {
          const items: GeneratedItem[] = data.results.map((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            const lat = r.success ? r.result.latencyMs : 0;
            if (r.success && r.result.audioUrl) {
              const waveform = Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8);
              return { id: `gen-${Date.now()}-${i}`, type: "sound" as ContentType, model: { ...model, speed: (lat < 15000 ? "fast" : lat < 45000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(lat / 1000).toFixed(0)}s)`, saved: false, selected: false, preview: { kind: "sound" as const, waveform, duration: "0:15", bpm: [120, 90, 140, 100][i % 4], audioUrl: r.result.audioUrl } };
            }
            return { id: `gen-${Date.now()}-${i}`, type: "sound" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "sound" as const, waveform: Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8), duration: "0:00" } };
          });
          setGenerations(items);
        } else {
          console.error("Audio generation failed:", data.error);
          setGenerationError(data.error || "Audio generation failed. Check API keys and credits.");
          setGenerations([]);
        }
      } catch (err: any) {
        const msg = err?.name === "AbortError"
          ? "Audio generation timed out (3min). Try selecting fewer models."
          : `Audio request failed: ${err}. Check network and server status.`;
        console.error("Audio generation request failed:", err);
        setGenerationError(msg);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  }, [prompt, contentType, activeModels, isGenerating]);

  const handleSave = useCallback((item: GeneratedItem) => {
    setGenerations((prev) => prev.map((g) => g.id === item.id ? { ...g, saved: !g.saved } : g));
    if (!item.saved) {
      setLibrary((prev) => [{ ...item, saved: true, tags: [contentType], folder: undefined }, ...prev]);
    } else {
      setLibrary((prev) => prev.filter((l) => l.id !== item.id));
    }
  }, [contentType]);

  const handleCompare = useCallback((item: GeneratedItem) => {
    setCompareItems((prev) => {
      const exists = prev.find((c) => c.id === item.id);
      if (exists) return prev.filter((c) => c.id !== item.id);
      if (prev.length >= 4) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveFromLibrary = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const filteredLibrary = library.filter((item) => {
    if (libraryFilter !== "all" && item.type !== libraryFilter) return false;
    if (librarySearch && !item.prompt.toLowerCase().includes(librarySearch.toLowerCase())) return false;
    return true;
  });

  const tabDef = [
    { id: "generate" as HubTab, label: "Generate", icon: Sparkles, count: generations.length },
    { id: "library" as HubTab, label: "Library", icon: BookOpen, count: library.length },
    { id: "compare" as HubTab, label: "Compare", icon: Columns2, count: compareItems.length },
  ];

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-6 h-12 border-b bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-ora-signal" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              AI Hub
            </span>
          </div>
          <div className="flex items-center gap-1">
            {tabDef.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${isActive ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  style={{ fontSize: "12px", fontWeight: isActive ? 600 : 400 }}
                >
                  <Icon size={13} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full ${isActive ? "bg-ora-signal text-white" : "bg-secondary text-muted-foreground"}`}
                      style={{ fontSize: "9px", fontWeight: 600, minWidth: 18, textAlign: "center", display: "inline-block" }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/studio"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontSize: "12px", fontWeight: 400 }}
          >
            Open Studio <ArrowRight size={11} />
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-ora-signal-light">
            <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
            <span className="text-ora-signal" style={{ fontSize: "11px", fontWeight: 500 }}>4 models connected</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div ref={resultsRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "generate" && (
            <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <GenerateView
                generations={generations}
                isGenerating={isGenerating}
                contentType={contentType}
                activeModels={activeModels}
                onSave={handleSave}
                onCompare={handleCompare}
                compareItems={compareItems}
                onPreview={setPreviewItem}
                error={generationError}
              />
            </motion.div>
          )}
          {activeTab === "library" && (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <LibraryView
                items={filteredLibrary}
                filter={libraryFilter}
                search={librarySearch}
                onFilterChange={setLibraryFilter}
                onSearchChange={setLibrarySearch}
                onRemove={handleRemoveFromLibrary}
                onCompare={handleCompare}
                compareItems={compareItems}
                onPreview={setPreviewItem}
              />
            </motion.div>
          )}
          {activeTab === "compare" && (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <CompareView items={compareItems} onRemove={(id) => setCompareItems((prev) => prev.filter((c) => c.id !== id))} onSave={handleSave} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ BOTTOM: Type Selector + SMS Command Bar ═══ */}
      <div className="border-t bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        {/* Content type selector + model picker */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
          <div className="flex items-center gap-1">
            {contentTypes.map((ct) => {
              const Icon = ct.icon;
              const isActive = contentType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => setContentType(ct.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${isActive ? "bg-ora-signal-light border-ora-signal/30 text-ora-signal" : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong"}`}
                  style={{ fontSize: "12px", fontWeight: isActive ? 500 : 400 }}
                >
                  <Icon size={12} />
                  {ct.label}
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
              style={{ fontSize: "11px", fontWeight: 400 }}
            >
              <SlidersHorizontal size={11} />
              {activeModels.length === 1 ? activeModels[0].name : `${activeModels.length}/${models.length} models`}
              <ChevronDown size={10} />
            </button>

            <AnimatePresence>
              {showModelPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 mb-2 bg-card border rounded-xl p-3 min-w-[240px] max-h-[360px] overflow-y-auto z-50"
                  style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                      Select models
                    </p>
                    <button
                      onClick={() => {
                        const allSelected = selectedModels.length === models.length;
                        setSelectedModels(allSelected ? [models[0].id] : models.map((m) => m.id));
                      }}
                      className="text-ora-signal hover:underline cursor-pointer"
                      style={{ fontSize: "10px", fontWeight: 500 }}
                    >
                      {selectedModels.length === models.length ? "Only first" : "Select all"}
                    </button>
                  </div>
                  {models.map((m) => {
                    const isSelected = selectedModels.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModels((prev) => {
                            if (prev.includes(m.id)) {
                              // Don't allow deselecting the last model
                              if (prev.length <= 1) return prev;
                              return prev.filter((id) => id !== m.id);
                            }
                            return [...prev, m.id];
                          });
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-ora-signal border-ora-signal" : ""}`} style={{ borderColor: isSelected ? undefined : "var(--border)" }}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 text-left">
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{m.name}</span>
                          <span className="ml-1.5" style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{m.provider}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {m.speed === "fast" && <Zap size={9} className="text-green-500" />}
                          {m.speed === "medium" && <Clock size={9} className="text-amber-500" />}
                          {m.speed === "slow" && <Clock size={9} className="text-muted-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowModelPicker(false)}
                    className="w-full mt-2 pt-2 border-t text-center text-muted-foreground hover:text-foreground cursor-pointer"
                    style={{ borderColor: "var(--border)", fontSize: "11px" }}
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* SMS Input bar */}
        <div className="px-5 pb-4 pt-1">
          <div
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all focus-within:border-ora-signal/40 focus-within:ring-2 focus-within:ring-ora-signal/10"
            style={{ borderColor: "var(--border)" }}
          >
            <Sparkles size={16} className="text-ora-signal flex-shrink-0" />
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder={getPlaceholder(contentType)}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
              style={{ fontSize: "15px", fontWeight: 400 }}
            />
            {isGenerating ? (
              <div className="flex items-center gap-2 px-3">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                <span style={{ fontSize: "12px", color: "var(--ora-signal)", fontWeight: 500 }}>
                  Generating from {activeModels.length} model{activeModels.length > 1 ? "s" : ""}...
                </span>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:opacity-90"
                style={{ background: prompt.trim() ? "var(--ora-signal)" : "var(--secondary)", color: prompt.trim() ? "#fff" : "var(--muted-foreground)" }}
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
              Press Enter — {activeModels.length} AI model{activeModels.length > 1 ? "s" : ""} generate simultaneously, you pick the best
            </span>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
              Results auto-saved to your library
            </span>
          </div>
        </div>
      </div>

      {/* ═══ PREVIEW MODAL ═══ */}
      <AnimatePresence>
        {previewItem && (
          <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onSave={() => handleSave(previewItem)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════��══════════
   PLACEHOLDER BY TYPE
   ═══════════════════════════════════ */

function getPlaceholder(type: ContentType): string {
  switch (type) {
    case "image": return "Describe the image you want to create...";
    case "text": return "Describe the text you need...";
    case "code": return "Describe what the code should do...";
    case "film": return "Describe the video you want to generate...";
    case "sound": return "Describe the sound or music you need...";
  }
}

/* ═══════════════════════════════════
   GENERATE VIEW
   ═══════════════════════════════════ */

function GenerateView({ generations, isGenerating, contentType, activeModels, onSave, onCompare, compareItems, onPreview, error }: {
  generations: GeneratedItem[];
  isGenerating: boolean;
  contentType: ContentType;
  activeModels: AIModel[];
  onSave: (item: GeneratedItem) => void;
  onCompare: (item: GeneratedItem) => void;
  compareItems: GeneratedItem[];
  onPreview: (item: GeneratedItem) => void;
  error?: string | null;
}) {
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagLog, setDiagLog] = useState<string[]>([]);

  // Debug: log render state
  console.log("[GenerateView] render:", { generationsCount: generations.length, isGenerating, error: error?.slice(0, 60) || null, activeModelsCount: activeModels.length, contentType });

  const runDiagnostic = async () => {
    setDiagRunning(true);
    setDiagLog(["Starting diagnostic..."]);
    const addLog = (msg: string) => setDiagLog(prev => [...prev, msg]);
    const t0 = Date.now();

    // Step 1: Health check
    try {
      addLog("[1/6] Health check...");
      const res = await fetch(`${API_BASE}/health`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(5_000),
      });
      const d = await res.json();
      addLog(`  OK (${Date.now() - t0}ms) — server: ${d.server}, ts: ${d.ts}`);
    } catch (err: any) {
      addLog(`  FAIL (${Date.now() - t0}ms): ${err.message}`);
      addLog("Edge Function unreachable. Check deployment.");
      setDiagRunning(false);
      return;
    }

    // Step 2: POST connectivity test
    try {
      addLog("[2/6] POST connectivity test...");
      const echoRes = await fetch(`${API_BASE}/debug/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ test: true, ts: Date.now() }),
        signal: AbortSignal.timeout(5_000),
      });
      const echoData = await echoRes.json();
      addLog(`  POST OK (${Date.now() - t0}ms) — server: ${echoData.server}, echo: ${JSON.stringify(echoData.echo)}`);
    } catch (err: any) {
      addLog(`  POST FAIL (${Date.now() - t0}ms): ${err.name}: ${err.message}`);
      addLog("  >>> POST requests are blocked! This is the root cause of generation failures. <<<");
    }

    // Step 3: API keys check
    try {
      addLog("[3/6] Checking API keys...");
      const res = await fetch(`${API_BASE}/debug/ai-config`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(5_000),
      });
      const d = await res.json();
      addLog(`  APIPOD: ${d.apipod}`);
      addLog(`  FAL: ${d.fal}`);
      addLog(`  Replicate: ${d.replicate}`);
    } catch (err: any) {
      addLog(`  FAIL: ${err.message}`);
    }

    // Step 4: Text generation test (APIPod chain)
    try {
      addLog("[4/6] Text test (APIPod → GPT-4o fallback)...");
      addLog("  Calling /debug/text-noauth (max 15s)...");
      const textRes = await fetch(`${API_BASE}/debug/text-noauth`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      const textData = await textRes.json();
      addLog(`  Total: ${textData.ms}ms`);
      if (textData.success) {
        addLog(`  Provider: ${textData.result?.provider || "unknown"}`);
        addLog(`  Text: "${(textData.result?.text || "").slice(0, 80)}..."`);
        addLog(`  Tokens: ${textData.result?.tokensUsed || 0}`);
      } else {
        addLog(`  FAIL: ${textData.error}`);
      }
    } catch (err: any) {
      addLog(`  FAIL after ${Date.now() - t0}ms: ${err.name}: ${err.message}`);
    }

    // Step 5: Image generation test (APIPod → FAL → Replicate chain)
    try {
      addLog("[5/6] Image test (APIPod → FAL → Replicate)...");
      addLog("  Calling /debug/image-noauth (max 35s)...");
      const res = await fetch(`${API_BASE}/debug/image-noauth`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(35_000),
      });
      if (!res.ok) {
        const txt = await res.text();
        addLog(`  HTTP ${res.status}: ${txt.slice(0, 300)}`);
      } else {
        const d = await res.json();
        addLog(`  Total: ${d.ms}ms`);
        if (d.success) {
          addLog(`  Provider: ${d.result?.provider || "unknown"}`);
          addLog(`  Image URL: ${d.result?.imageUrl?.slice(0, 120) || "none"}`);
          addLog(`  Latency: ${d.result?.latencyMs || 0}ms`);
        } else {
          addLog(`  FAIL: ${d.error}`);
        }
      }
    } catch (err: any) {
      addLog(`  FAIL after ${Date.now() - t0}ms: ${err.name}: ${err.message}`);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        addLog("  >>> Edge Function killed by Supabase before responding <<<");
        addLog("  The function exceeds the platform wall-clock limit.");
        addLog("  Supabase free plan: ~60s, Pro: ~150s.");
      }
    }

    // Step 6: Summary
    addLog(`[6/6] Diagnostic complete (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    setDiagRunning(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(212,24,61,0.08)" }}>
          <X size={24} style={{ color: "var(--destructive)" }} />
        </div>
        <h2 className="text-foreground mb-3" style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em" }}>
          Generation failed
        </h2>
        <p className="text-muted-foreground text-center max-w-[500px] mb-4" style={{ fontSize: "14px", lineHeight: 1.55 }}>
          {error}
        </p>
        <p className="text-muted-foreground/60 text-center max-w-[420px] mb-6" style={{ fontSize: "12px", lineHeight: 1.5 }}>
          The AI providers may be slow or temporarily unavailable. Try again — ORA uses APIPod, FAL, and Replicate as fallbacks.
        </p>

        {/* ── Inline diagnostic ── */}
        <div className="w-full max-w-[560px]">
          <button
            onClick={runDiagnostic}
            disabled={diagRunning}
            className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}
          >
            <SlidersHorizontal size={14} />
            {diagRunning ? "Running diagnostic..." : "Run diagnostic"}
          </button>
          {diagLog.length > 0 && (
            <div className="mt-4 bg-card border rounded-xl p-4 text-left overflow-auto max-h-[400px]" style={{ borderColor: "var(--border)" }}>
              <pre style={{ fontSize: "11px", lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--foreground)" }}>
                {diagLog.join("\n")}
              </pre>
              {diagRunning && (
                <div className="flex items-center gap-2 mt-2">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Waiting for server response...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (generations.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-16 h-16 rounded-2xl bg-ora-signal-light flex items-center justify-center mb-6">
          <Sparkles size={24} className="text-ora-signal" />
        </div>
        <h2 className="text-foreground mb-3" style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em" }}>
          Generate anything
        </h2>
        <p className="text-muted-foreground text-center max-w-[420px] mb-8" style={{ fontSize: "15px", lineHeight: 1.55 }}>
          Type what you need below. Select models to compare, then hit Enter. ORA generates from {activeModels.length} model{activeModels.length > 1 ? "s" : ""} — you pick the best.
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-[500px]">
          {getSuggestions(contentType).map((s) => (
            <span
              key={s}
              className="px-3 py-1.5 rounded-full border text-muted-foreground bg-card cursor-default"
              style={{ borderColor: "var(--border)", fontSize: "12px" }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* ── Diagnostic Panel ── */}
        <div className="mt-10 w-full max-w-[560px]">
          <button
            onClick={runDiagnostic}
            disabled={diagRunning}
            className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}
          >
            <SlidersHorizontal size={14} />
            {diagRunning ? "Running diagnostic..." : "Run image diagnostic"}
          </button>
          {diagLog.length > 0 && (
            <div className="mt-4 bg-card border rounded-xl p-4 text-left overflow-auto max-h-[400px]" style={{ borderColor: "var(--border)" }}>
              <pre style={{ fontSize: "11px", lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--foreground)" }}>
                {diagLog.join("\n")}
              </pre>
              {diagRunning && (
                <div className="flex items-center gap-2 mt-2">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Waiting for server response...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isGenerating) {
    const cols = activeModels.length === 1 ? "grid-cols-1 max-w-[400px]" : activeModels.length === 2 ? "grid-cols-2 max-w-[640px]" : activeModels.length === 3 ? "grid-cols-3 max-w-[860px]" : "grid-cols-2 lg:grid-cols-4";
    return (
      <div className="p-6">
        <div className={`grid ${cols} gap-4`}>
          {activeModels.map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border rounded-xl overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="aspect-[4/3] bg-secondary/30 flex items-center justify-center relative">
                <motion.div
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                >
                  <Sparkles size={20} className="text-ora-signal/40" />
                </motion.div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5 + i * 0.3, ease: "easeInOut" }}
                      className="h-full rounded-full"
                      style={{ background: "var(--ora-signal)" }}
                    />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center gap-2">
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{model.name}</span>
                <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{model.provider}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-muted-foreground mb-0.5" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Results from {generations.length} models
          </p>
          <p className="text-foreground truncate max-w-[400px]" style={{ fontSize: "13px", fontWeight: 500 }}>
            "{generations[0]?.prompt}"
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { /* regenerate */ }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", fontSize: "11px", fontWeight: 500 }}
          >
            <RotateCcw size={11} />
            Regenerate
          </button>
        </div>
      </div>
      <div className={`grid ${generations.length === 1 ? "grid-cols-1 max-w-[400px]" : generations.length === 2 ? "grid-cols-2 max-w-[640px]" : generations.length === 3 ? "grid-cols-3 max-w-[860px]" : "grid-cols-2 lg:grid-cols-4"} gap-4`}>
        {generations.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <ResultCard
              item={item}
              onSave={() => onSave(item)}
              onCompare={() => onCompare(item)}
              isComparing={!!compareItems.find((c) => c.id === item.id)}
              onPreview={() => onPreview(item)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function getSuggestions(type: ContentType): string[] {
  switch (type) {
    case "image": return ["Brand pattern", "Abstract header", "Social visual", "Ad creative", "Icon set"];
    case "text": return ["LinkedIn post", "Email copy", "Ad headline", "Blog intro", "Tagline"];
    case "code": return ["API integration", "React component", "Data pipeline", "Auth flow", "Landing page"];
    case "film": return ["Product teaser", "Brand intro", "Story ad", "Explainer clip", "Logo reveal"];
    case "sound": return ["Background ambient", "Jingle", "Podcast intro", "Notification", "Voiceover"];
  }
}

/* ═���═════════════════════════════════
   RESULT CARD
   ═══════════════════════════════════ */

function ResultCard({ item, onSave, onCompare, isComparing, onPreview }: {
  item: GeneratedItem;
  onSave: () => void;
  onCompare: () => void;
  isComparing: boolean;
  onPreview: () => void;
}) {
  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden group transition-all hover:border-border-strong ${isComparing ? "ring-2 ring-ora-signal/20 border-ora-signal/30" : ""}`}
      style={{ borderColor: isComparing ? undefined : "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
    >
      {/* Preview */}
      <div className="aspect-[4/3] relative cursor-pointer" onClick={onPreview}>
        <PreviewRenderer preview={item.preview} />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye size={18} className="text-foreground/50" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{item.model.name}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {item.model.speed === "fast" && <Zap size={9} className="text-green-500" />}
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{item.model.provider}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${item.saved ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            style={{ fontSize: "10px", fontWeight: 500 }}
          >
            {item.saved ? <Heart size={10} className="fill-current" /> : <Heart size={10} />}
            {item.saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${isComparing ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            style={{ fontSize: "10px", fontWeight: 500 }}
          >
            <Columns2 size={10} />
            Compare
          </button>
          <div className="flex-1" />
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer"
            title="Download"
          >
            <Download size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   PREVIEW RENDERER
   ═══════════════════════════════════ */

function PreviewRenderer({ preview, large = false }: { preview: GenerationPreview; large?: boolean }) {
  switch (preview.kind) {
    case "image": {
      const realUrl = preview.imageUrl || (preview.palette[0]?.startsWith("http") ? preview.palette[0] : null);
      if (realUrl) {
        return (
          <div className="w-full h-full relative bg-secondary/30">
            <img src={realUrl} alt={preview.label} className="w-full h-full object-cover" crossOrigin="anonymous" />
            {!large && (
              <div className="absolute bottom-2 left-2">
                <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm" style={{ fontSize: "9px", fontWeight: 500, color: "#fff" }}>
                  {preview.label}
                </span>
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="w-full h-full relative" style={{ background: preview.palette[3] }}>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
            <rect width="200" height="150" fill={preview.palette[3]} />
            <circle cx="100" cy="75" r="40" fill={preview.palette[0]} opacity={0.15} />
            <circle cx="100" cy="75" r="25" fill={preview.palette[0]} opacity={0.2} />
            <circle cx="100" cy="75" r="12" fill={preview.palette[0]} opacity={0.3} />
            <circle cx="100" cy="75" r="4" fill={preview.palette[0]} />
            {[30, 50, 70].map((r, i) => (
              <circle key={i} cx="100" cy="75" r={r} fill="none" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.3 - i * 0.08} />
            ))}
            <line x1="60" y1="75" x2="140" y2="75" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.2} strokeDasharray="2 2" />
            <line x1="100" y1="35" x2="100" y2="115" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.2} strokeDasharray="2 2" />
          </svg>
          {!large && (
            <div className="absolute bottom-2 left-2">
              <span className="px-2 py-0.5 rounded bg-white/80 backdrop-blur-sm" style={{ fontSize: "9px", fontWeight: 500, color: preview.palette[0] }}>
                {preview.label}
              </span>
            </div>
          )}
        </div>
      );
    }

    case "text":
      return (
        <div className="w-full h-full p-4 flex flex-col justify-center bg-card">
          <div className="space-y-1.5 mb-3">
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "100%" }} />
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "92%" }} />
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "88%" }} />
            <div className="h-1 rounded-full bg-foreground/6" style={{ width: "75%" }} />
          </div>
          <p className="text-foreground/70 line-clamp-3" style={{ fontSize: large ? "13px" : "10px", lineHeight: 1.5 }}>
            {preview.excerpt}
          </p>
          <div className="mt-auto pt-2">
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.wordCount} words</span>
          </div>
        </div>
      );

    case "code":
      return (
        <div className="w-full h-full p-3 font-mono overflow-hidden" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center gap-1 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/50" />
            <span className="ml-2" style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)" }}>{preview.language}</span>
          </div>
          <pre className="text-white/70 whitespace-pre-wrap" style={{ fontSize: large ? "11px" : "8px", lineHeight: 1.5 }}>
            {preview.snippet}
          </pre>
          <div className="mt-auto pt-1">
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>{preview.lines} lines</span>
          </div>
        </div>
      );

    case "film": {
      const hasVideo = preview.videoUrl?.startsWith("http");
      if (hasVideo) {
        return (
          <div className="w-full h-full relative bg-black flex items-center justify-center">
            <video
              src={preview.videoUrl}
              className="w-full h-full object-cover"
              controls={large}
              muted
              loop
              playsInline
              autoPlay={large}
              onMouseEnter={(e) => { if (!large) (e.target as HTMLVideoElement).play().catch(() => {}); }}
              onMouseLeave={(e) => { if (!large) { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; } }}
            />
            {!large && (
              <>
                <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "white" }}>{preview.duration}</span>
                </div>
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                  <span style={{ fontSize: "9px", fontWeight: 500, color: "white" }}>Video</span>
                </div>
              </>
            )}
          </div>
        );
      }
      return (
        <div className="w-full h-full relative flex items-center justify-center" style={{ background: preview.frames[0] }}>
          <div className="absolute inset-0 flex">
            {preview.frames.map((color, i) => (
              <div key={i} className="flex-1 border-r border-white/10" style={{ background: color, opacity: 0.3 + i * 0.15 }} />
            ))}
          </div>
          <div className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Film size={16} className="text-white/80" />
          </div>
          <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm">
            <span style={{ fontSize: "10px", fontWeight: 500, color: "white" }}>{preview.duration}</span>
          </div>
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm">
            <span style={{ fontSize: "9px", color: "white/70" }}>{preview.fps}fps</span>
          </div>
        </div>
      );
    }

    case "sound": {
      const hasAudio = preview.audioUrl?.startsWith("http");
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-card px-4">
          <div className="flex items-end gap-px w-full h-12 mb-2">
            {preview.waveform.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm min-w-[2px]"
                style={{ height: h, background: `var(--ora-signal)`, opacity: 0.3 + (h / 30) * 0.5 }}
              />
            ))}
          </div>
          {hasAudio && (
            <audio
              src={preview.audioUrl}
              controls
              className="w-full mb-1"
              style={{ height: 28 }}
            />
          )}
          <div className="flex items-center justify-between w-full">
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.duration}</span>
            {hasAudio && <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "8px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>AI Generated</span>}
            {preview.bpm && <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.bpm} BPM</span>}
          </div>
        </div>
      );
    }
  }
}

/* ══════════════════════════════════
   LIBRARY VIEW
   ═══════════════════════════════════ */

function LibraryView({ items, filter, search, onFilterChange, onSearchChange, onRemove, onCompare, compareItems, onPreview }: {
  items: LibraryItem[];
  filter: ContentType | "all";
  search: string;
  onFilterChange: (f: ContentType | "all") => void;
  onSearchChange: (s: string) => void;
  onRemove: (id: string) => void;
  onCompare: (item: GeneratedItem) => void;
  compareItems: GeneratedItem[];
  onPreview: (item: GeneratedItem) => void;
}) {
  const filterOptions: { id: ContentType | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...contentTypes.map((ct) => ({ id: ct.id, label: ct.label })),
  ];

  return (
    <div className="p-6">
      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 max-w-[320px]">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search library..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
            style={{ fontSize: "13px" }}
          />
        </div>
        <div className="flex items-center gap-1">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filter === f.id ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              style={{ fontSize: "11px", fontWeight: filter === f.id ? 500 : 400 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={24} className="mx-auto mb-3 text-muted-foreground/30" />
          <p style={{ fontSize: "14px", color: "var(--muted-foreground)" }}>No items in your library yet</p>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", opacity: 0.6 }}>Generate content and save your favorites</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border rounded-xl overflow-hidden group"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <div className="aspect-[4/3] relative cursor-pointer" onClick={() => onPreview(item)}>
                <PreviewRenderer preview={item.preview} />
              </div>
              <div className="px-3 py-2">
                <p className="truncate mb-1" style={{ fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>
                  {item.prompt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{item.model.name}</span>
                    <span style={{ fontSize: "8px", color: "var(--muted-foreground)", opacity: 0.5 }}>{item.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onCompare(item)} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer">
                      <Columns2 size={10} />
                    </button>
                    <button className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer">
                      <Download size={10} />
                    </button>
                    <button onClick={() => onRemove(item.id)} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive cursor-pointer">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Studio link banner */}
      <div className="mt-8 p-5 rounded-xl border bg-ora-signal-light/50 flex items-center justify-between" style={{ borderColor: "rgba(59, 79, 196, 0.1)" }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>
            Use your library in ORA Studio
          </p>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            Subscribe to Studio and access your entire library directly in the editing workspace.
          </p>
        </div>
        <Link
          to="/studio"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity flex-shrink-0"
          style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}
        >
          Open Studio <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/* ═══════���═════════════��═════════════
   COMPARE VIEW
   ═══════════════════════════════════ */

function CompareView({ items, onRemove, onSave }: {
  items: GeneratedItem[];
  onRemove: (id: string) => void;
  onSave: (item: GeneratedItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <Columns2 size={24} className="mb-4 text-muted-foreground/30" />
        <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--foreground)" }}>No items to compare</p>
        <p className="text-center mt-2 max-w-[360px]" style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.55 }}>
          Generate content, then click "Compare" on any result to add it here. Compare up to 4 outputs side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Comparing {items.length} result{items.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => items.forEach((item) => onRemove(item.id))}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
          style={{ fontSize: "11px" }}
        >
          Clear all
        </button>
      </div>

      <div className={`grid gap-4 ${items.length === 1 ? "grid-cols-1 max-w-lg" : items.length === 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border rounded-xl overflow-hidden relative"
            style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.03)" }}
          >
            {/* Remove button */}
            <button
              onClick={() => onRemove(item.id)}
              className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer border"
              style={{ borderColor: "var(--border)" }}
            >
              <X size={11} />
            </button>

            {/* Preview - larger in compare mode */}
            <div className="aspect-[4/3]">
              <PreviewRenderer preview={item.preview} large />
            </div>

            {/* Model info */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>{item.model.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary" style={{ fontSize: "9px", fontWeight: 500, color: "var(--muted-foreground)" }}>
                  {item.model.provider}
                </span>
              </div>

              {/* Quality indicators */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Quality</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: j < item.model.quality ? "var(--ora-signal)" : "var(--secondary)" }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Speed</span>
                  <div className="flex items-center gap-1">
                    {item.model.speed === "fast" && <Zap size={9} className="text-green-500" />}
                    <span style={{ fontSize: "10px", color: "var(--muted-foreground)", textTransform: "capitalize" }}>{item.model.speed}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => onSave(item)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors cursor-pointer ${item.saved ? "bg-ora-signal text-white" : "border hover:bg-secondary"}`}
                  style={{ borderColor: item.saved ? undefined : "var(--border)", fontSize: "11px", fontWeight: 500 }}
                >
                  {item.saved ? <Check size={11} /> : <Heart size={11} />}
                  {item.saved ? "Saved" : "Save"}
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "11px" }}>
                  <Download size={11} />
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "11px" }}>
                  <Copy size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add more slot */}
        {items.length < 4 && (
          <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 text-muted-foreground/30" style={{ borderColor: "var(--border)" }}>
            <Plus size={20} className="mb-2" />
            <span style={{ fontSize: "12px" }}>Add to compare</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   PREVIEW MODAL
   ═══════════════════════════════════ */

function PreviewModal({ item, onClose, onSave }: {
  item: GeneratedItem;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-card rounded-2xl overflow-hidden max-w-2xl w-full mx-6"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 24px 80px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview */}
        <div className="aspect-[16/10]">
          <PreviewRenderer preview={item.preview} large />
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)" }}>{item.model.name}</span>
            <span className="px-2 py-0.5 rounded bg-secondary" style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)" }}>
              {item.model.provider}
            </span>
            <div className="flex-1" />
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{item.timestamp}</span>
          </div>
          <p className="mb-4" style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            "{item.prompt}"
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${item.saved ? "bg-ora-signal text-white" : "border hover:bg-secondary"}`}
              style={{ borderColor: item.saved ? undefined : "var(--border)", fontSize: "13px", fontWeight: 500 }}
            >
              {item.saved ? <Check size={14} /> : <Heart size={14} />}
              {item.saved ? "Saved to Library" : "Save to Library"}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "13px" }}>
              <Download size={14} />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "13px" }}>
              <ExternalLink size={14} />
              Open in Studio
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer" style={{ fontSize: "13px" }}>
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}