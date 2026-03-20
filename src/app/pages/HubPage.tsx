import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon, Code2, Film, Music, FileText, ArrowUp, Sparkles,
  Columns2, BookOpen, Download, Trash2,
  Check, Copy, ExternalLink, Search, ChevronDown,
  RotateCcw, SlidersHorizontal, Zap, Clock, Heart, FolderOpen,
  Eye, X, Plus, ArrowRight, ChevronLeft, ChevronRight,
  Upload, Layers, Camera, Paintbrush, Maximize2, Rocket,
  Play, Pencil, FolderPlus, Mic, MicOff, Square,
  Scissors, Video, FileAudio, Loader2,
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { CampaignLab } from "../components/CampaignLab";
import { RouteGuard } from "../components/RouteGuard";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type ContentType = "image" | "code" | "film" | "sound" | "text" | "campaign";
type HubTab = "generate" | "library" | "compare";
type LibraryTab = "content" | "campaign";

interface LibraryFolder {
  id: string;
  name: string;
  source: LibraryTab;
}

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
  folderId?: string;
  tags: string[];
  source: LibraryTab;
}

type GenerationPreview =
  | { kind: "image"; palette: string[]; label: string; imageUrl?: string }
  | { kind: "text"; excerpt: string; wordCount: number; tone?: string }
  | { kind: "code"; language: string; snippet: string; lines: number }
  | { kind: "film"; duration: string; frames: string[]; fps: number; videoUrl?: string }
  | { kind: "sound"; waveform: number[]; duration: string; bpm?: number; audioUrl?: string; sunoTaskId?: string; sunoAudioId?: string; title?: string; imageUrl?: string };

/* ═══════════════════════════════════
   AI MODELS
   ═══════════════════════════════════ */

const aiModels: Record<ContentType, AIModel[]> = {
  image: [
    { id: "ora-vision", name: "ORA Vision", provider: "ORA", speed: "fast", quality: 5 },
    { id: "photon-1", name: "Photon 1", provider: "Luma AI", speed: "fast", quality: 5 },
    { id: "photon-flash-1", name: "Photon Flash 1", provider: "Luma AI", speed: "fast", quality: 4 },
    { id: "soul", name: "Soul", provider: "ORA", speed: "fast", quality: 5 },
    { id: "seedream-v4", name: "Seedream V4", provider: "ByteDance", speed: "fast", quality: 5 },
    { id: "nano-banana", name: "Nano Banana", provider: "Google", speed: "fast", quality: 5 },
    { id: "dall-e", name: "DALL-E 3", provider: "OpenAI", speed: "fast", quality: 4 },
    { id: "flux-pro", name: "Flux Pro", provider: "Black Forest", speed: "medium", quality: 5 },
    { id: "phoenix-1.0", name: "Phoenix 1.0", provider: "Leonardo AI", speed: "fast", quality: 5 },
    { id: "lucid-origin", name: "Lucid Origin", provider: "Leonardo AI", speed: "fast", quality: 5 },
    { id: "lucid-realism", name: "Lucid Realism", provider: "Leonardo AI", speed: "fast", quality: 5 },
    { id: "flux-dev-leo", name: "FLUX Dev", provider: "Leonardo AI", speed: "fast", quality: 5 },
    { id: "flux-schnell-leo", name: "FLUX Schnell", provider: "Leonardo AI", speed: "fast", quality: 4 },
    { id: "kontext-pro-leo", name: "Kontext Pro", provider: "Leonardo AI", speed: "medium", quality: 5 },
    { id: "nano-banana-2-leo", name: "Nano Banana 2", provider: "Leonardo AI", speed: "fast", quality: 5 },
    { id: "gpt-image-leo", name: "GPT Image 1.5", provider: "Leonardo AI", speed: "medium", quality: 5 },
    { id: "ideogram-3-leo", name: "Ideogram 3.0", provider: "Leonardo AI", speed: "medium", quality: 5 },
    { id: "seedream-4-leo", name: "Seedream 4.0", provider: "Leonardo AI", speed: "fast", quality: 5 },
  ],
  text: [
    { id: "ora-writer", name: "ORA Writer", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-5", name: "GPT-5", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "gpt-5.1", name: "GPT-5.1", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-sonnet", name: "Claude 4.5 Sonnet", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "claude-opus", name: "Claude 4.5 Opus", provider: "Anthropic", speed: "medium", quality: 5 },
    { id: "claude-haiku", name: "Claude 4.5 Haiku", provider: "Anthropic", speed: "fast", quality: 4 },
    { id: "gemini-pro", name: "Gemini 2.5 Pro", provider: "Google", speed: "fast", quality: 5 },
    { id: "deepseek", name: "DeepSeek V3.2", provider: "DeepSeek", speed: "fast", quality: 5 },
  ],
  code: [
    { id: "ora-code", name: "ORA Code", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-4o-code", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-code", name: "Claude Sonnet 4", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "gemini-code", name: "Gemini 2.5 Flash", provider: "Google", speed: "fast", quality: 4 },
  ],
  film: [
    { id: "ora-motion", name: "ORA Motion", provider: "ORA", speed: "medium", quality: 5 },
    { id: "ray-2", name: "Ray 2", provider: "Luma AI", speed: "medium", quality: 5 },
    { id: "ray-flash-2", name: "Ray Flash 2", provider: "Luma AI", speed: "fast", quality: 4 },
    { id: "kling-v2.1", name: "Kling V2.1 Pro", provider: "Kuaishou", speed: "medium", quality: 5 },
    { id: "seedance-v1", name: "Seedance V1 Pro", provider: "ByteDance", speed: "medium", quality: 5 },
    { id: "dop", name: "DOP", provider: "ORA", speed: "medium", quality: 5 },
    { id: "veo-3.1", name: "Veo 3.1", provider: "Google", speed: "medium", quality: 5 },
    { id: "sora-2", name: "Sora 2", provider: "OpenAI", speed: "medium", quality: 5 },
    { id: "seedance-2.0", name: "Seedance 2.0", provider: "ByteDance", speed: "medium", quality: 5 },
    { id: "runway-gen3", name: "Gen-3 Alpha", provider: "Runway", speed: "medium", quality: 4 },
    { id: "pika", name: "Pika 2.0", provider: "Pika", speed: "fast", quality: 4 },
  ],
  sound: [
    { id: "ora-audio", name: "ORA Audio V5", provider: "Suno", speed: "medium", quality: 5 },
  ],
  campaign: [],
};

const contentTypes: { id: ContentType; label: string; icon: typeof ImageIcon }[] = [
  { id: "campaign", label: "Campaign", icon: Rocket },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "text", label: "Text", icon: FileText },
  { id: "film", label: "Film", icon: Film },
  { id: "sound", label: "Sound", icon: Music },
];

/* ═══════════════════════════════════
   MOCK GENERATION FACTORY
   ═══════════════════════════════════ */

const palettes = [
  ["#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD"],
  ["#22D3EE", "#06B6D4", "#0891B2", "#155E75"],
  ["#A3E635", "#84CC16", "#65A30D", "#4D7C0F"],
  ["#FB923C", "#F97316", "#EA580C", "#9A3412"],
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

const defaultFolders: LibraryFolder[] = [
  { id: "f-general", name: "General", source: "content" },
  { id: "f-campaigns", name: "All Campaigns", source: "campaign" },
];

/* ═══════════════════════════════════
   MAIN HUB COMPONENT
   ═══════════════════════════════════ */

export function HubPage() {
  return (
    <RouteGuard requireAuth requireFeature="hub">
      <HubPageContent />
    </RouteGuard>
  );
}

function HubPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<HubTab>("generate");
  const [contentType, setContentType] = useState<ContentType>((searchParams.get("type") as ContentType) || "image");
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [generations, setGenerations] = useState<GeneratedItem[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [compareItems, setCompareItems] = useState<GeneratedItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => aiModels.image.slice(0, 4).map(m => m.id));
  const [aspectRatio, setAspectRatio] = useState<string>("4:3");
  const [libraryFilter, setLibraryFilter] = useState<ContentType | "all">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("content");
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>(defaultFolders);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [previewItem, setPreviewItem] = useState<GeneratedItem | null>(null);
  const [refImage, setRefImage] = useState<{ file: File; previewUrl: string; signedUrl?: string; uploading?: boolean } | null>(null);
  const [refStrength, setRefStrength] = useState(0.75);
  const [promptCollapsed, setPromptCollapsed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelPickerBtnRef = useRef<HTMLButtonElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; bottom: number } | null>(null);

  // ── Suno credits ──
  const [sunoCredits, setSunoCredits] = useState<number | null>(null);
  useEffect(() => {
    if (contentType === "sound") {
      fetch(`${API_BASE}/suno/credits`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
        .then(r => r.json())
        .then(d => { if (d.code === 200 && typeof d.data === "number") setSunoCredits(d.data); })
        .catch(() => {});
    }
  }, [contentType]);

  // ── Sound options state ──
  const [soundInstrumental, setSoundInstrumental] = useState(true);
  const [soundLyrics, setSoundLyrics] = useState("");
  const [soundTitle, setSoundTitle] = useState("");
  const [soundStyle, setSoundStyle] = useState("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  const generateLyricsFromPrompt = async () => {
    const p = prompt.trim() || soundStyle.trim();
    if (!p) { toast.error("Type a prompt or style first"); return; }
    setIsGeneratingLyrics(true);
    try {
      const res = await fetch(`${API_BASE}/suno/lyrics`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "text/plain" },
        body: JSON.stringify({ prompt: p }),
      });
      const rawText = await res.text();
      console.log("[generateLyrics] raw response:", rawText.slice(0, 500));
      let data: any;
      try { data = JSON.parse(rawText); } catch { toast.error(`Invalid response from server: ${rawText.slice(0, 100)}`); setIsGeneratingLyrics(false); return; }
      if (data.success && data.lyrics) {
        let text = "";
        const lyr = data.lyrics;
        if (typeof lyr === "string") {
          text = lyr;
        } else if (Array.isArray(lyr?.data) && lyr.data.length > 0) {
          // API returns {taskId, data: [{text, title, status}, ...]}
          const best = lyr.data.find((d: any) => d.status === "complete" && d.text) || lyr.data[0];
          text = best?.text || "";
          if (best?.title && !soundTitle.trim()) setSoundTitle(best.title);
        } else if (lyr.text) {
          text = lyr.text;
        } else {
          text = JSON.stringify(lyr);
        }
        setSoundLyrics(text);
        setSoundInstrumental(false);
        toast.success("Lyrics generated!");
      } else {
        console.error("[generateLyrics] failed:", data);
        toast.error(data.error || "Lyrics generation failed");
      }
    } catch (err: any) {
      console.error("[generateLyrics] error:", err);
      toast.error(`Lyrics error: ${err.message || err}`);
    }
    setIsGeneratingLyrics(false);
  };

  // ── Voice recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    // Check if we're in an iframe — browsers block getUserMedia in cross-origin iframes
    const inIframe = window.self !== window.top;
    if (inIframe) {
      console.warn("[Voice] Running inside an iframe — mic access is blocked by browser security policy");
      toast.error("Microphone blocked in preview", {
        description: "Open the app in a new tab to use voice prompt.",
        duration: 8000,
        action: {
          label: "Open in new tab",
          onClick: () => window.open(window.location.href, "_blank"),
        },
      });
      return;
    }

    // Check if getUserMedia is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("[Voice] getUserMedia not available (HTTPS required)");
      toast.error("Microphone not available", { description: "Your browser does not support audio recording, or the page is not served over HTTPS." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer webm/opus, fall back to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setRecordingDuration(0);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          console.warn("[Voice] Audio too short, ignoring");
          setIsRecording(false);
          return;
        }
        console.log(`[Voice] Recording complete: ${(audioBlob.size / 1024).toFixed(1)}KB, type=${mimeType}`);
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "ogg";
          formData.append("audio", audioBlob, `recording.${ext}`);
          const res = await fetch(`${API_BASE}/transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${publicAnonKey}` },
            body: formData,
            signal: AbortSignal.timeout(30_000),
          });
          const data = await res.json();
          if (data.success && data.text) {
            console.log(`[Voice] Transcription OK (${data.latencyMs}ms): "${data.text.slice(0, 80)}"`);
            setPrompt((prev) => (prev ? prev + " " + data.text : data.text));
            toast.success("Voice transcribed", { description: `${data.text.slice(0, 60)}${data.text.length > 60 ? "..." : ""}` });
            // Focus input after transcription
            setTimeout(() => inputRef.current?.focus(), 100);
          } else {
            console.error("[Voice] Transcription failed:", data.error);
            toast.error("Transcription failed", { description: data.error || "Unknown error" });
          }
        } catch (err: any) {
          console.error("[Voice] Transcription error:", err);
          toast.error("Transcription error", { description: err?.message || "Network error" });
        }
        setIsTranscribing(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      console.log("[Voice] Recording started");
    } catch (err: any) {
      console.error("[Voice] Mic access error:", err?.name, err?.message);
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access denied", {
          description: "Click the lock icon in your browser's address bar to allow microphone access, then try again.",
          duration: 8000,
        });
      } else if (err?.name === "NotFoundError") {
        toast.error("No microphone found", { description: "Please connect a microphone and try again." });
      } else {
        toast.error("Microphone error", { description: err?.message || "Could not access microphone." });
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      console.log("[Voice] Recording stopped by user");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return;
    function handleClick(e: MouseEvent) {
      if (
        modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node) &&
        modelPickerBtnRef.current && !modelPickerBtnRef.current.contains(e.target as Node)
      ) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showModelPicker]);

  // Compute picker position when opened
  useEffect(() => {
    if (showModelPicker && modelPickerBtnRef.current) {
      const rect = modelPickerBtnRef.current.getBoundingClientRect();
      setPickerPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    }
  }, [showModelPicker]);



  // Clear URL params after reading them
  useEffect(() => {
    if (searchParams.get("prompt")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const models = aiModels[contentType];
  const activeModels = models.filter((m) => selectedModels.includes(m.id));

  useEffect(() => {
    const typeModels = aiModels[contentType];
    // Film: default 1 model (Luma is slow, avoid parallel overload)
    const defaultCount = contentType === "film" ? 1 : 4;
    setSelectedModels(typeModels.slice(0, defaultCount).map(m => m.id));
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

  const handleRefUpload = useCallback(async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setRefImage({ file, previewUrl, uploading: true });
    // Force visual mode if not already in image or film
    if (contentType !== "image" && contentType !== "film") setContentType("image");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/hub/upload-ref`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.signedUrl) {
        setRefImage(prev => prev ? { ...prev, signedUrl: data.signedUrl, uploading: false } : null);
        console.log("[HubPage] Ref image uploaded:", data.signedUrl.slice(0, 80));
      } else {
        console.error("[HubPage] Ref upload failed:", data.error);
        setRefImage(prev => prev ? { ...prev, uploading: false } : null);
      }
    } catch (err) {
      console.error("[HubPage] Ref upload error:", err);
      setRefImage(prev => prev ? { ...prev, uploading: false } : null);
    }
  }, []);

  const clearRefImage = useCallback(() => {
    if (refImage?.previewUrl) URL.revokeObjectURL(refImage.previewUrl);
    setRefImage(null);
  }, [refImage]);

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
      // SINGLE request, ALL models — EXACT same pattern as working diagnostic
      const modelIds = activeModels.map((m) => m.id);
      const sysPrompt = contentType === "code"
        ? "You are an expert programmer. Write clean, well-structured code. Return only the code, no explanations."
        : "You are a creative professional writer. Write high-quality, concise content.";
      console.log(`[HubPage] Text GET (single, ${modelIds.length} models):`, modelIds);
      try {
        const tok = getAuthToken();
        const textParams = new URLSearchParams({
          prompt: currentPrompt,
          models: modelIds.join(","),
          systemPrompt: sysPrompt,
          maxTokens: "2048",
        });
        if (tok) textParams.set("_token", tok);
        const textGetUrl = `${API_BASE}/generate/text-multi-get?${textParams.toString()}`;
        console.log(`[HubPage] Text GET URL:`, textGetUrl.slice(0, 180));
        const res = await fetch(textGetUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(120_000),
        });
        const rawText = await res.text();
        console.log(`[HubPage] Text response: ${res.status} (${Date.now() - genStartMs}ms) raw=${rawText.slice(0, 250)}`);
        const data = JSON.parse(rawText);
        if (data.success && data.results) {
          const items: GeneratedItem[] = [];
          data.results.forEach((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            const text = r.success ? r.result.text : `Error: ${r.error}`;
            const wc = text.split(/\s+/).filter(Boolean).length;
            const lat = r.success ? r.result.latencyMs : 0;
            const preview: GenerationPreview = contentType === "code"
              ? { kind: "code", language: "TypeScript", snippet: text.slice(0, 500), lines: text.split("\n").length }
              : { kind: "text", excerpt: text, wordCount: wc };
            items.push({ id: `gen-${Date.now()}-${i}`, type: contentType, model: { ...model, speed: (lat < 2000 ? "fast" : lat < 5000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(lat / 1000).toFixed(1)}s)`, saved: false, selected: false, preview });
          });
          console.log(`[HubPage] Text OK: ${items.length} items (${Date.now() - genStartMs}ms)`);
          setGenerations(items);
          autoSaveToLibrary(items);
          const fails = data.results.filter((r: any) => !r.success);
          if (fails.length > 0) setGenerationError(`${fails.length}/${data.results.length} models had errors`);
        } else {
          setGenerationError(data.error || "Text generation failed");
          setGenerations([]);
        }
      } catch (err: any) {
        const elapsed = Date.now() - genStartMs;
        const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
        console.error(`[HubPage] Text FAILED (${elapsed}ms):`, err?.name, err?.message);
        setGenerationError(isTimeout
          ? `Timed out (${(elapsed/1000).toFixed(0)}s). Try fewer models or shorter prompt.`
          : `Error: ${err?.message || err}`);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (isImageType && refImage?.signedUrl) {
      // ── Visual Lab V2: Vision Analysis + content-preserve mode ──
      try {
        const modelIds = activeModels.map((m) => m.id);
        console.log("[HubPage] Visual Lab V2 img2img starting:", { models: modelIds, prompt: currentPrompt.slice(0, 60), refUrl: refImage.signedUrl.slice(0, 60) });

        // Determine mode from strength slider:
        // High strength (>0.4) = scene transformation (style) — user wants to CHANGE the image
        // Low strength (<=0.4) = content preservation — user wants to keep the image faithful
        const refMode = refStrength > 0.4 ? "style" : "content";
        console.log(`[HubPage] V2 ref mode=${refMode} (strength=${refStrength})`);

        // Vision DNA analysis — ONLY for content preservation mode
        // In style/transform mode, Vision DNA is counter-productive (pushes model to preserve original characteristics)
        let enrichedPrompt = currentPrompt;
        if (refMode === "content") {
          let visualDNA = "";
          try {
            console.log("[HubPage] V2 Analyzing ref image with Vision (content mode)...");
            const atok = getAuthToken();
            const analyzeBody = atok 
              ? { imageUrls: [refImage.signedUrl], _token: atok }
              : { imageUrls: [refImage.signedUrl] };
            const analyzeRes = await fetch(`${API_BASE}/campaign/analyze-refs`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                "Content-Type": "text/plain",
              },
              body: JSON.stringify(analyzeBody),
              signal: AbortSignal.timeout(30_000),
            });
            const analyzeData = await analyzeRes.json();
            if (analyzeData.success && analyzeData.visualDNA) {
              visualDNA = analyzeData.visualDNA;
              console.log("[HubPage] V2 Visual DNA extracted:", typeof visualDNA === "string" ? visualDNA.slice(0, 120) : JSON.stringify(visualDNA).slice(0, 120));
            } else {
              console.warn("[HubPage] V2 Vision analysis failed, continuing without DNA:", analyzeData.error);
            }
          } catch (visionErr) {
            console.warn("[HubPage] V2 Vision analysis error (non-blocking):", visionErr);
          }
          if (visualDNA) {
            enrichedPrompt = `${currentPrompt}. Visual reference: ${typeof visualDNA === "string" ? visualDNA : JSON.stringify(visualDNA)}`;
          }
        } else {
          console.log("[HubPage] V2 Skipping Vision DNA (style/transform mode — prompt used as-is)");
        }
        console.log("[HubPage] V2 Final prompt:", enrichedPrompt.slice(0, 120));
        const encodedPrompt = encodeURIComponent(enrichedPrompt);
        const encodedModels = encodeURIComponent(modelIds.join(","));
        const encodedRef = encodeURIComponent(refImage.signedUrl);
        const arRefParam = aspectRatio ? `&aspectRatio=${encodeURIComponent(aspectRatio)}` : "";
        const refGetUrl = `${API_BASE}/generate/image-ref-via-get?prompt=${encodedPrompt}&models=${encodedModels}&imageRefUrl=${encodedRef}&strength=${refStrength}&mode=${refMode}${arRefParam}`;
        const res = await fetch(refGetUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(140_000),
        });
        const rawText = await res.text();
        console.log(`[HubPage] Visual Lab response: ${res.status} (${Date.now() - genStartMs}ms)`);
        let data: any;
        try { data = JSON.parse(rawText); } catch {
          setGenerationError(`Server returned invalid response (status ${res.status})`);
          setGenerations([]);
          setIsGenerating(false);
          return;
        }
        if (data.success && data.results) {
          const items: GeneratedItem[] = data.results.map((r: any, i: number) => {
            const model = activeModels[i] || activeModels[0];
            if (r.success && r.result.imageUrl) {
              return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model: { ...model, speed: ((r.result.latencyMs || 0) < 10000 ? "fast" : (r.result.latencyMs || 0) < 30000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(r.result.latencyMs / 1000).toFixed(1)}s)`, saved: true, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `Visual Lab - ${model.name} via ${r.result.provider || "AI"}`, imageUrl: r.result.imageUrl } };
            }
            const errorMsg = r.error ? ` - ${String(r.error).slice(0, 80)}` : "";
            return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `${model.name} (failed${errorMsg})` } };
          });
          setGenerations(items);
          autoSaveToLibrary(items);
        } else {
          setGenerationError(data.error || "Visual Lab generation failed");
          setGenerations([]);
        }
      } catch (err: any) {
        const elapsedMs = Date.now() - genStartMs;
        const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
        setGenerationError(isTimeout ? `Visual Lab timed out after ${(elapsedMs / 1000).toFixed(0)}s.` : `Visual Lab error: ${err?.message || err}`);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (isImageType) {
      try {
        const modelIds = activeModels.map((m) => m.id);
        console.log("[HubPage] Image generation starting:", { models: modelIds, prompt: currentPrompt.slice(0, 60) });

        // USE GET instead of POST — POST requests never reach the Supabase edge function
        const encodedPrompt = encodeURIComponent(currentPrompt);
        const encodedModels = encodeURIComponent(modelIds.join(","));
        const arParam = aspectRatio ? `&aspectRatio=${encodeURIComponent(aspectRatio)}` : "";
        const imageGetUrl = `${API_BASE}/generate/image-via-get?prompt=${encodedPrompt}&models=${encodedModels}${arParam}`;
        console.log(`[HubPage] Image GET ->`, imageGetUrl.slice(0, 150), `(${modelIds.length} models, ar=${aspectRatio})`, new Date().toISOString());
        const res = await fetch(imageGetUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(180_000),
        });
        console.log("[HubPage] Image response:", res.status, `(${Date.now() - genStartMs}ms total)`);
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
              return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model: { ...model, speed: ((r.result.latencyMs || 0) < 10000 ? "fast" : (r.result.latencyMs || 0) < 30000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(r.result.latencyMs / 1000).toFixed(1)}s)`, saved: true, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `Generated by ${model.name} via ${r.result.provider || "AI"}`, imageUrl: r.result.imageUrl } };
            }
            const errorMsg = r.error ? ` — ${String(r.error).slice(0, 80)}` : "";
            return { id: `gen-${Date.now()}-${i}`, type: "image" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "image" as const, palette: palettes[i % palettes.length], label: `${model.name} (failed${errorMsg})` } };
          });
          setGenerations(items);
          autoSaveToLibrary(items);
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
      // Film: multi-model aggregator — start + poll for each selected model in parallel
      const hasRef = !!refImage?.signedUrl;
      console.log("[HubPage] Film generation (multi-model start+poll):", { models: activeModels.map(m => m.id), img2vid: hasRef, prompt: currentPrompt.slice(0, 60) });

      // V2: Vision DNA enrichment — only in content-preserve mode (low strength)
      // In transform mode (high strength), the ref image is used as keyframe directly, no need for Vision DNA
      let filmPrompt = currentPrompt;
      if (hasRef && refStrength <= 0.4) {
        try {
          console.log("[HubPage] Film V2: Analyzing ref image with Vision (content mode)...");
          const filmTok = getAuthToken();
          const filmAnalyzeBody = filmTok
            ? { imageUrls: [refImage!.signedUrl!], _token: filmTok }
            : { imageUrls: [refImage!.signedUrl!] };
          const analyzeRes = await fetch(`${API_BASE}/campaign/analyze-refs`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "text/plain",
            },
            body: JSON.stringify(filmAnalyzeBody),
            signal: AbortSignal.timeout(30_000),
          });
          const analyzeData = await analyzeRes.json();
          if (analyzeData.success && analyzeData.visualDNA) {
            const dnaStr = typeof analyzeData.visualDNA === "string" ? analyzeData.visualDNA : JSON.stringify(analyzeData.visualDNA);
            filmPrompt = `${currentPrompt}. Visual reference: ${dnaStr}`;
            console.log("[HubPage] Film V2: Enriched video prompt:", filmPrompt.slice(0, 120));
          }
        } catch (visionErr) {
          console.warn("[HubPage] Film V2: Vision analysis failed (non-blocking):", visionErr);
        }
      } else if (hasRef) {
        console.log("[HubPage] Film V2: Skipping Vision DNA (transform mode, ref used as keyframe)");
      }

      // Show placeholder items immediately
      const placeholders: GeneratedItem[] = activeModels.map((model, i) => ({
        id: `gen-${Date.now()}-${i}`, type: "film" as ContentType, model, prompt: currentPrompt, timestamp: `${ts} (generating...)`,
        saved: false, selected: false, preview: { kind: "film" as const, duration: "0:00", frames: palettes[i % palettes.length], fps: 24 },
      }));
      setGenerations(placeholders);

      // Helper: start + poll a single model
      const generateOneVideo = async (model: AIModel, index: number): Promise<GeneratedItem> => {
        const modelStart = Date.now();
        try {
          const startParams = new URLSearchParams({ prompt: filmPrompt, model: model.id });
          if (hasRef) startParams.set("imageUrl", refImage!.signedUrl!);
          const startUrl = `${API_BASE}/generate/video-start?${startParams.toString()}`;
          console.log(`[HubPage] Video START [${model.id}]:`, startUrl.slice(0, 150));

          const startRes = await fetch(startUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${publicAnonKey}` },
            signal: AbortSignal.timeout(15_000),
          });
          const startText = await startRes.text();
          let startData: any;
          try { startData = JSON.parse(startText); } catch {
            throw new Error(`Invalid response (HTTP ${startRes.status})`);
          }
          if (!startData.success || !startData.generationId) {
            throw new Error(startData.error || "Failed to start");
          }

          const generationId = startData.generationId;
          console.log(`[HubPage] Video [${model.id}] submitted:`, generationId);

          const MAX_POLLS = 60;
          for (let poll = 0; poll < MAX_POLLS; poll++) {
            await new Promise(r => setTimeout(r, 5_000));
            try {
              const statusUrl = `${API_BASE}/generate/video-status?id=${encodeURIComponent(generationId)}`;
              const statusRes = await fetch(statusUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${publicAnonKey}` },
                signal: AbortSignal.timeout(10_000),
              });
              const statusText = await statusRes.text();
              let statusData: any;
              try { statusData = JSON.parse(statusText); } catch { continue; }
              console.log(`[HubPage] Video [${model.id}] POLL #${poll + 1}: state=${statusData.state}`);
              if (statusData.state === "completed" && statusData.videoUrl) {
                const elapsed = Date.now() - modelStart;
                return {
                  id: `gen-${Date.now()}-${index}`, type: "film",
                  model: { ...model, speed: (elapsed < 30000 ? "fast" : elapsed < 90000 ? "medium" : "slow") as "fast"|"medium"|"slow" },
                  prompt: currentPrompt, timestamp: `${ts} (${(elapsed / 1000).toFixed(0)}s)`, saved: false, selected: false,
                  preview: { kind: "film", duration: "0:15", frames: palettes[index % palettes.length], fps: 24, videoUrl: statusData.videoUrl },
                };
              }
              if (statusData.state === "failed") {
                throw new Error(statusData.error || "Video generation failed");
              }
            } catch (pollErr: any) {
              if (pollErr?.message?.includes("failed")) throw pollErr;
              console.warn(`[HubPage] Video [${model.id}] poll #${poll + 1} error (retrying):`, pollErr?.message);
            }
          }
          throw new Error("Timed out (5 min)");
        } catch (err: any) {
          console.error(`[HubPage] Video [${model.id}] error:`, err?.message);
          return {
            id: `gen-${Date.now()}-${index}`, type: "film", model, prompt: currentPrompt, timestamp: ts,
            saved: false, selected: false, preview: { kind: "film", duration: "0:00", frames: palettes[index % palettes.length], fps: 24 },
          };
        }
      };

      try {
        // Launch all models in parallel, update results as each completes
        const promises = activeModels.map((model, i) =>
          generateOneVideo(model, i).then((result) => {
            setGenerations(prev => prev.map((item, idx) => idx === i ? result : item));
            return result;
          })
        );
        const results = await Promise.allSettled(promises);
        const allItems = results.map((r, i) => r.status === "fulfilled" ? r.value : placeholders[i]);
        setGenerations(allItems);
        autoSaveToLibrary(allItems);
        const failures = allItems.filter(item => !(item.preview as any).videoUrl);
        if (failures.length === allItems.length) {
          setGenerationError("All video generations failed. Try again or select different models.");
        } else if (failures.length > 0) {
          setGenerationError(`${failures.length}/${allItems.length} models failed`);
        }
      } catch (err: any) {
        console.error("[HubPage] Video multi-model error:", err?.message || err);
        setGenerationError(`Video error: ${err?.message || err}`);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } else if (contentType === "sound") {
      // Sound: Suno API — 2-phase: start (fast) then poll from frontend
      try {
        const modelIds = activeModels.map((m) => m.id);
        const audioTok = getAuthToken();

        // Phase 1: Start generation with retry (edge function cold starts can cause 404)
        const startBody = JSON.stringify({
          prompt: currentPrompt,
          models: modelIds,
          instrumental: soundInstrumental,
          ...(soundLyrics.trim() ? { lyrics: soundLyrics.trim() } : {}),
          ...(soundTitle.trim() ? { title: soundTitle.trim() } : {}),
          ...(soundStyle.trim() ? { style: soundStyle.trim() } : {}),
          ...(audioTok ? { _token: audioTok } : {}),
        });
        let startData: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`[HubPage] audio-start: attempt ${attempt + 1}/3 to /suno/start...`);
          try {
            const startRes = await fetch(`${API_BASE}/suno/start`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                "Content-Type": "text/plain",
              },
              body: startBody,
            });
            if (!startRes.ok) {
              console.log(`[HubPage] audio-start: HTTP ${startRes.status}, retrying...`);
              if (attempt < 2) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
              throw new Error(`Server returned HTTP ${startRes.status}`);
            }
            startData = await startRes.json();
            console.log("[HubPage] audio-start response:", startData);
            break;
          } catch (fetchErr: any) {
            console.log(`[HubPage] audio-start attempt ${attempt + 1} failed:`, fetchErr);
            if (attempt < 2) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
            throw fetchErr;
          }
        }
        if (!startData?.success || !startData?.results) {
          throw new Error(startData?.error || "Failed to start audio generation");
        }

        // Check for immediate errors
        const failedStarts = startData.results.filter((r: any) => !r.success);
        if (failedStarts.length === startData.results.length) {
          throw new Error(failedStarts[0]?.error || "All models failed to start");
        }

        // Phase 2: Poll each taskId from frontend (avoids edge function timeout)
        const pendingTasks = startData.results.filter((r: any) => r.success && r.taskId);
        const t0 = Date.now();
        const MAX_POLL_MS = 360_000;
        const POLL_INTERVAL = 5_000;
        const completed: any[] = new Array(pendingTasks.length).fill(null);

        while (Date.now() - t0 < MAX_POLL_MS) {
          const allDone = completed.every(c => c !== null);
          if (allDone) break;
          await new Promise(r => setTimeout(r, POLL_INTERVAL));

          for (let idx = 0; idx < pendingTasks.length; idx++) {
            if (completed[idx] !== null) continue;
            const task = pendingTasks[idx];
            try {
              const pollRes = await fetch(`${API_BASE}/suno/poll?taskId=${task.taskId}`, {
                headers: { Authorization: `Bearer ${publicAnonKey}` },
              });
              if (!pollRes.ok) { console.log(`[HubPage] poll ${task.taskId}: HTTP ${pollRes.status}, will retry`); continue; }
              const poll = await pollRes.json();
              console.log(`[HubPage] poll ${task.taskId}: status=${poll.status}`);
              if (poll.status === "DONE" && poll.track) {
                completed[idx] = { success: true, track: poll.track, model: task.model, sunoModel: task.sunoModel, taskId: task.taskId };
              } else if (poll.status === "FAILED") {
                completed[idx] = { success: false, error: poll.error };
              }
              // else keep polling
            } catch (pollErr) {
              console.log(`[HubPage] poll error for ${task.taskId}:`, pollErr);
            }
          }
        }

        // Build generation items from completed results
        const items: GeneratedItem[] = pendingTasks.map((task: any, i: number) => {
          const model = activeModels.find(m => m.id === task.model) || activeModels[0];
          const c = completed[i];
          if (c?.success && c.track?.audioUrl) {
            const lat = Date.now() - t0;
            const waveform = Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8);
            const dur = c.track.duration ? `${Math.floor(c.track.duration / 60)}:${String(Math.floor(c.track.duration % 60)).padStart(2, "0")}` : "0:15";
            return { id: `gen-${Date.now()}-${i}`, type: "sound" as ContentType, model: { ...model, speed: (lat < 15000 ? "fast" : lat < 45000 ? "medium" : "slow") as "fast"|"medium"|"slow" }, prompt: currentPrompt, timestamp: `${ts} (${(lat / 1000).toFixed(0)}s)`, saved: true, selected: false, preview: { kind: "sound" as const, waveform, duration: dur, bpm: [120, 90, 140, 100][i % 4], audioUrl: c.track.audioUrl, sunoTaskId: c.taskId, sunoAudioId: c.track.id, title: c.track.title, imageUrl: c.track.imageUrl } };
          }
          return { id: `gen-${Date.now()}-${i}`, type: "sound" as ContentType, model, prompt: currentPrompt, timestamp: ts, saved: false, selected: false, preview: { kind: "sound" as const, waveform: Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8), duration: "0:00" } };
        });
        setGenerations(items);
        autoSaveToLibrary(items.filter(it => it.saved));
        if (items.every(it => !it.saved)) {
          setGenerationError("Audio generation timed out or failed. Try again.");
        }
      } catch (err: any) {
        console.error("Audio generation request failed:", err);
        setGenerationError(`Audio request failed: ${err?.message || err}. Check network and server status.`);
        setGenerations([]);
      }
      setIsGenerating(false);
      setTimeout(() => resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  }, [prompt, contentType, activeModels, isGenerating, refImage, refStrength, aspectRatio]);

  // ── v483 server call helper (standard auth pattern) ──
  const serverPost = useCallback((path: string, bodyData: any) => {
    const token = getAuthToken();
    // Put _token in body (like auth/me) instead of X-User-Token header to avoid CORS preflight issues
    const payload = token ? { ...bodyData, _token: token } : bodyData;
    return fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
    }).then(res => res.json());
  }, [getAuthToken]);

  // CORS-safe delete (uses POST instead of DELETE to avoid preflight)
  const serverDelete = useCallback((itemId: string) => {
    return serverPost("/library/items-delete", { itemId });
  }, [serverPost]);

  // ── Load library from server on mount (POST = no CORS preflight) ──
  const libraryLoadedRef = useRef(false);
  useEffect(() => {
    const token = getAuthToken();
    if (!token || libraryLoadedRef.current) return;
    libraryLoadedRef.current = true;
    console.log("[HubPage] Loading library from server...");
    serverPost("/library/list", {})
      .then(data => {
        if (data.success && data.items?.length > 0) {
          console.log("[HubPage] Loaded", data.items.length, "library items from server");
          setLibrary(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = data.items.filter((i: any) => !existingIds.has(i.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      })
      .catch(err => console.warn("[HubPage] Library load error (non-fatal):", err));
  }, [getAuthToken, serverPost]);

  const handleSave = useCallback((item: GeneratedItem) => {
    console.log("[HubPage] handleSave:", { id: item.id, wasSaved: item.saved, type: item.type });
    setGenerations((prev) => prev.map((g) => g.id === item.id ? { ...g, saved: !g.saved } : g));
    if (!item.saved) {
      setLibrary((prev) => [{ ...item, saved: true, tags: [contentType], folder: undefined, source: "content" as const }, ...prev]);
      toast.success("Saved to Library", { duration: 2000 });
      serverPost("/library/items", { item: { ...item, saved: true, tags: [contentType] } })
        .then(data => { if (data.success) console.log("[HubPage] Saved to server:", item.id); else console.warn("[HubPage] Save failed:", data.error); })
        .catch(err => console.error("[HubPage] Save error:", err));
    } else {
      setLibrary((prev) => prev.filter((l) => l.id !== item.id));
      toast("Removed from Library", { duration: 1500 });
      serverDelete(item.id).catch(err => console.error("[HubPage] Delete error:", err));
    }
  }, [contentType, serverPost, serverDelete]);

  const handleCompareAll = useCallback((items: GeneratedItem[]) => {
    setCompareItems((prev) => {
      const newItems = items.filter((item) => !prev.find((c) => c.id === item.id));
      if (newItems.length === 0) {
        toast("All items already in Compare", { duration: 1200 });
        return prev;
      }
      const available = 8 - prev.length;
      const toAdd = newItems.slice(0, available);
      if (toAdd.length < newItems.length) {
        toast(`Added ${toAdd.length}/${newItems.length} (limit 8)`, { duration: 1500 });
      } else {
        toast.success(`Added ${toAdd.length} items to Compare`, { duration: 1500 });
      }
      return [...prev, ...toAdd];
    });
    setActiveTab("compare");
  }, []);

  // ── Export handler: downloads content to user's device ──
  const handleExport = useCallback(async (item: GeneratedItem) => {
    try {
      const preview = item.preview;
      const baseName = `ora-${item.type}-${item.model.id}-${Date.now()}`;
      const downloadBlob = (blob: Blob, filename: string) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      };
      if (preview.kind === "image" && (preview.imageUrl || preview.palette?.[0]?.startsWith("http"))) {
        toast("Downloading image...", { duration: 2000 });
        const res = await fetch(preview.imageUrl || preview.palette[0]);
        downloadBlob(await res.blob(), `${baseName}.png`);
        toast.success("Image exported", { duration: 1500 });
      } else if (preview.kind === "film" && (preview as any).videoUrl) {
        toast("Downloading video...", { duration: 3000 });
        const res = await fetch((preview as any).videoUrl);
        downloadBlob(await res.blob(), `${baseName}.mp4`);
        toast.success("Video exported", { duration: 1500 });
      } else if (preview.kind === "sound" && (preview as any).audioUrl) {
        toast("Downloading audio...", { duration: 2000 });
        const res = await fetch((preview as any).audioUrl);
        downloadBlob(await res.blob(), `${baseName}.mp3`);
        toast.success("Audio exported", { duration: 1500 });
      } else if (preview.kind === "text" && (preview as any).excerpt) {
        downloadBlob(new Blob([(preview as any).fullText || (preview as any).excerpt], { type: "text/plain" }), `${baseName}.txt`);
        toast.success("Text exported", { duration: 1500 });
      } else if (preview.kind === "code" && (preview as any).snippet) {
        const code = Array.isArray((preview as any).snippet) ? (preview as any).snippet[0] : (preview as any).snippet;
        downloadBlob(new Blob([code], { type: "text/plain" }), `${baseName}.ts`);
        toast.success("Code exported", { duration: 1500 });
      } else {
        toast.error("Nothing to export for this item", { duration: 2000 });
      }
    } catch (err) {
      console.error("[HubPage] Export error:", err);
      toast.error("Export failed", { duration: 2000 });
    }
  }, []);

  const handleRemoveFromLibrary = useCallback((id: string) => {
    setLibrary((prev) => prev.filter((l) => l.id !== id));
    serverDelete(id).catch(() => {});
  }, [serverDelete]);

  // ── Auto-save to library (Content tab) ──
  const autoSaveToLibrary = useCallback((items: GeneratedItem[], source: LibraryTab = "content") => {
    const defaultFolder = libraryFolders.find(f => f.source === source);
    const newItems: LibraryItem[] = items
      .filter(item => {
        // Only auto-save items that have real content (not failed/placeholder)
        if (item.preview.kind === "image" && (item.preview as any).imageUrl) return true;
        if (item.preview.kind === "film" && (item.preview as any).videoUrl) return true;
        if (item.preview.kind === "text" && (item.preview as any).excerpt) return true;
        if (item.preview.kind === "code" && (item.preview as any).snippet) return true;
        if (item.preview.kind === "sound" && (item.preview as any).audioUrl) return true;
        return false;
      })
      .map(item => ({
        ...item,
        saved: true,
        tags: [item.type],
        source,
        folderId: defaultFolder?.id,
      }));
    if (newItems.length > 0) {
      setLibrary(prev => [...newItems, ...prev]);
      // Persist each item to server (fire-and-forget)
      console.log(`[HubPage] Auto-saving ${newItems.length} items to server...`);
      for (const item of newItems) {
        serverPost("/library/items", { item: { id: item.id, type: item.type, model: item.model, prompt: item.prompt, timestamp: item.timestamp, preview: item.preview, saved: true, tags: item.tags, source: item.source, savedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
          .then(data => { if (!data.success) console.warn(`[HubPage] Auto-save failed for ${item.id}:`, data.error); })
          .catch(err => console.warn("[HubPage] Auto-save error:", err));
      }
    }
  }, [libraryFolders, serverPost]);

  // ── Animate: switch to Film mode with image as ref ──
  const handleAnimate = useCallback((item: GeneratedItem) => {
    const imgUrl = item.preview.kind === "image" ? (item.preview.imageUrl || null) : null;
    if (!imgUrl) return;
    // Set ref image from generated image URL
    setRefImage({ file: new File([], "generated.jpg"), previewUrl: imgUrl, signedUrl: imgUrl, uploading: false });
    setContentType("film");
    setActiveTab("generate");
    setPrompt("");
    toast.success("Image loaded for animation. Describe the motion you want.", { duration: 3000 });
  }, []);

  // ── Campaign Lab callback: auto-save campaign assets ──
  const handleCampaignAssetComplete = useCallback((asset: {
    id: string; type: "image" | "video" | "text"; imageUrl?: string; videoUrl?: string;
    prompt: string; model?: string; campaignTheme?: string;
    textContent?: Record<string, any>; copy?: string; platform?: string; formatName?: string;
  }) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const campaignFolder = libraryFolders.find(f => f.source === "campaign");
    let folderId = campaignFolder?.id;
    if (asset.campaignTheme) {
      const existing = libraryFolders.find(f => f.source === "campaign" && f.name === asset.campaignTheme);
      if (existing) {
        folderId = existing.id;
      } else {
        const newFolder: LibraryFolder = { id: `f-camp-${Date.now()}`, name: asset.campaignTheme, source: "campaign" };
        setLibraryFolders(prev => [...prev, newFolder]);
        folderId = newFolder.id;
      }
    }
    let preview: GenerationPreview;
    let itemType: ContentType;
    if (asset.type === "video") {
      preview = { kind: "film", duration: "0:05", frames: palettes[0], fps: 24, videoUrl: asset.videoUrl };
      itemType = "film";
    } else if (asset.type === "text") {
      const label = asset.textContent?.subject || asset.textContent?.headline || asset.formatName || "Campaign text";
      const excerpt = asset.textContent?.body || asset.copy || "";
      preview = { kind: "text" as const, excerpt: typeof excerpt === "string" ? excerpt.slice(0, 200) : String(excerpt).slice(0, 200), wordCount: typeof excerpt === "string" ? excerpt.split(/\s+/).length : 0, tone: "professional" };
      itemType = "text";
    } else {
      preview = { kind: "image", palette: palettes[0], label: asset.prompt.slice(0, 40), imageUrl: asset.imageUrl };
      itemType = "image";
    }
    const libItem: LibraryItem = {
      id: `camp-${asset.id}`, type: itemType,
      model: { id: asset.model || "campaign", name: asset.model || "Campaign AI", provider: "ORA", speed: "medium" as const, quality: 5 },
      prompt: asset.prompt, timestamp: ts, saved: true, selected: false,
      preview, tags: ["campaign", asset.platform || ""].filter(Boolean), source: "campaign", folderId,
    };
    setLibrary(prev => [libItem, ...prev]);
  }, [libraryFolders]);

  // Explicit save-to-library from Campaign Lab (user clicks save button)
  const handleSaveCampaignAssetToLibrary = useCallback((asset: {
    id: string; type: "image" | "video" | "text"; imageUrl?: string; videoUrl?: string;
    prompt: string; model?: string; campaignTheme?: string;
    textContent?: Record<string, any>; copy?: string; platform?: string; formatName?: string;
  }) => {
    try {
      // Check if already saved
      const existingId = `camp-${asset.id}`;
      const already = library.some(l => l.id === existingId);
      if (already) {
        toast("Already in Library — go to Library > Campaigns tab to view", { duration: 2500 });
        return;
      }
      handleCampaignAssetComplete(asset);
      toast.success(`${asset.formatName || "Asset"} saved! Find it in Library > Campaigns tab`, { duration: 3000 });
      // Do NOT auto-switch to library — it would unmount CampaignLab and lose all campaign state
      // Persist to server (CORS-safe)
      serverPost("/library/items", { item: { id: existingId, type: asset.type, prompt: asset.prompt, saved: true, tags: ["campaign"], source: "campaign" } })
        .catch(err => console.error("[HubPage] Campaign library save error:", err));
    } catch (err) {
      console.error("[HubPage] handleSaveCampaignAssetToLibrary error:", err);
      toast.error("Failed to save asset to library");
    }
  }, [handleCampaignAssetComplete, library, getAuthToken]);

  // ── Folder management ──
  const handleCreateFolder = useCallback((source: LibraryTab) => {
    const newFolder: LibraryFolder = { id: `f-${Date.now()}`, name: "New Folder", source };
    setLibraryFolders(prev => [...prev, newFolder]);
    setEditingFolderId(newFolder.id);
    setEditingFolderName("New Folder");
  }, []);

  const handleRenameFolder = useCallback((folderId: string, newName: string) => {
    if (!newName.trim()) return;
    setLibraryFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f));
    setEditingFolderId(null);
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setLibraryFolders(prev => prev.filter(f => f.id !== folderId));
    // Move items in this folder to no folder
    setLibrary(prev => prev.map(item => item.folderId === folderId ? { ...item, folderId: undefined } : item));
  }, []);

  const handleMoveToFolder = useCallback((itemId: string, folderId: string | undefined) => {
    setLibrary(prev => prev.map(item => item.id === itemId ? { ...item, folderId } : item));
  }, []);

  const filteredLibrary = library.filter((item) => {
    if (item.source !== libraryTab) return false;
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
    <div className="flex flex-col bg-background relative h-[calc(100dvh-56px)] md:h-screen">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-5 h-12 border-b bg-card flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Zap size={15} style={{ color: "#E8E4DF" }} />
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#E8E4DF", letterSpacing: "-0.02em" }}>
              Hub
            </span>
          </div>
          <div className="flex items-center gap-1">
            {tabDef.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // When switching to Library, auto-select campaign tab if there are campaign items
                    if (tab.id === "library" && library.some(l => l.source === "campaign")) {
                      setLibraryTab("campaign");
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${isActive ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  style={{ fontSize: "12px", fontWeight: isActive ? 600 : 400 }}
                >
                  <Icon size={13} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
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
            to="/hub/vault"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontSize: "12px", fontWeight: 400 }}
          >
            Brand Vault <ArrowRight size={11} />
          </Link>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-ora-signal-light">
            <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
            <span className="text-ora-signal" style={{ fontSize: "11px", fontWeight: 500 }}>4 models connected</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div ref={resultsRef}
        className={`flex-1 relative min-h-0 flex flex-col ${(activeTab === "generate" && (contentType === "image" || contentType === "film") && (generations.length > 0 || isGenerating)) ? "overflow-hidden" : activeTab === "library" ? "overflow-hidden" : "overflow-y-auto"}`}
        style={{ background: (activeTab === "generate" && (contentType === "image" || contentType === "film") && (generations.length > 0 || isGenerating)) ? "#000" : undefined }}>
        <AnimatePresence mode="wait">
          {activeTab === "generate" && contentType === "campaign" && (
            <motion.div key="campaign-lab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 min-h-0" style={{ display: "flex", flexDirection: "column" }}>
              <CampaignLab onAssetComplete={handleCampaignAssetComplete} onSaveAssetToLibrary={handleSaveCampaignAssetToLibrary} />
            </motion.div>
          )}
          {activeTab === "generate" && contentType !== "campaign" && (
            <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 relative" style={{ display: "flex", flexDirection: "column" }}>
              <GenerateView
                generations={generations}
                isGenerating={isGenerating}
                contentType={contentType}
                activeModels={activeModels}
                onSave={handleSave}
                onCompareAll={handleCompareAll}
                compareItems={compareItems}
                onPreview={setPreviewItem}
                error={generationError}
                onAnimate={handleAnimate}
                onExport={handleExport}
              />
            </motion.div>
          )}
          {activeTab === "library" && (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 flex flex-col">
              <LibraryView
                items={filteredLibrary}
                filter={libraryFilter}
                search={librarySearch}
                onFilterChange={setLibraryFilter}
                onSearchChange={setLibrarySearch}
                onRemove={handleRemoveFromLibrary}
                onPreview={setPreviewItem}
                libraryTab={libraryTab}
                onLibraryTabChange={setLibraryTab}
                folders={libraryFolders}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveToFolder={handleMoveToFolder}
                editingFolderId={editingFolderId}
                editingFolderName={editingFolderName}
                onStartEditFolder={(id, name) => { setEditingFolderId(id); setEditingFolderName(name); }}
                onEditFolderNameChange={setEditingFolderName}
                onAnimate={handleAnimate}
              />
            </motion.div>
          )}
          {activeTab === "compare" && (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 min-h-0 flex flex-col">
              <CompareView items={compareItems} onRemove={(id) => setCompareItems((prev) => prev.filter((c) => c.id !== id))} onSave={handleSave} onExport={handleExport} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ BOTTOM: Type Selector + SMS Command Bar ═══ */}
      {/* Collapsed state: floating expand button */}
      {promptCollapsed && generations.length > 0 && (contentType === "image" || contentType === "film") && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <button onClick={() => setPromptCollapsed(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all hover:scale-105"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Paintbrush size={14} style={{ color: "var(--ora-signal)" }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>New prompt</span>
          </button>
        </div>
      )}
      <AnimatePresence>
      {!(promptCollapsed && generations.length > 0 && (contentType === "image" || contentType === "film")) && (
      <motion.div
        initial={false}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="border-t bg-card flex-shrink-0 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {/* Content type selector + model picker */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
          <div className="flex items-center gap-1">
            {contentTypes.map((ct) => {
              const Icon = ct.icon;
              const isActive = contentType === ct.id;
              const typeColorMap: Record<string, string> = { image: "#5E6AD2", text: "#C27A98", film: "#D4956B", sound: "#C9A84C", campaign: "#C27A98" };
              const tc = typeColorMap[ct.id] || "#888";
              return (
                <button
                  key={ct.id}
                  onClick={() => setContentType(ct.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                  style={{
                    fontSize: "12px", fontWeight: isActive ? 600 : 400,
                    background: isActive ? tc : "transparent",
                    color: isActive ? "#131211" : "#5C5856",
                    border: isActive ? "none" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Icon size={12} />
                  {ct.label}
                </button>
              );
            })}
          </div>

          {contentType !== "campaign" && (
          <>
          <div className="w-px h-4 bg-border mx-1" />

          {/* Model picker */}
          <div>
            <button
              ref={modelPickerBtnRef}
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
              style={{ fontSize: "11px", fontWeight: 400 }}
            >
              <SlidersHorizontal size={11} />
              {activeModels.length === 1 ? activeModels[0].name : `${activeModels.length}/${models.length} models`}
              <ChevronDown size={10} />
            </button>

            {showModelPicker && pickerPos && createPortal(
              <div
                ref={modelPickerRef}
                className="bg-card border rounded-xl p-3 min-w-[280px] max-h-[480px] overflow-y-auto"
                style={{
                  position: "fixed",
                  left: pickerPos.left,
                  bottom: pickerPos.bottom,
                  zIndex: 9999,
                  borderColor: "var(--border)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.08)",
                }}
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
              </div>,
              document.body
            )}
          </div>

          {/* Aspect ratio selector (image & film only) */}
          {(contentType === "image" || contentType === "film") && (
            <div className="flex items-center gap-1 ml-1">
              <div className="w-px h-4 bg-border mx-1" />
              {["1:1", "4:3", "3:4", "16:9", "9:16"].map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${aspectRatio === ar ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  style={{ fontSize: "10px", fontWeight: aspectRatio === ar ? 600 : 400 }}
                >
                  {ar}
                </button>
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {contentType !== "campaign" && (<>
        {/* ── Visual Lab: Reference Image Preview + Scene Presets ── */}
        <AnimatePresence>
          {refImage && (contentType === "image" || contentType === "film") && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-5 pt-2 pb-1">
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden" style={{ border: "2px solid var(--ora-signal)" }}>
                    <img src={refImage.previewUrl} alt="Reference" className="w-full h-full object-cover" />
                    <button onClick={clearRefImage} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-80"><X size={10} /></button>
                    {refImage.uploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-ora-signal border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ora-signal-light">
                        {contentType === "film" ? <Film size={10} className="text-ora-signal" /> : <Layers size={10} className="text-ora-signal" />}
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ora-signal)" }}>{contentType === "film" ? "Motion Lab" : "Visual Lab"}</span>
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                        {refImage.uploading ? "Uploading..." : refImage.signedUrl ? "Ready" : "Upload failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(contentType === "film" ? [
                        { label: "Product Reveal", prompt: "Smooth elegant product reveal, slow rotation with dynamic lighting, professional commercial style" },
                        { label: "Unboxing", prompt: "Cinematic unboxing sequence, hands revealing the product, anticipation building" },
                        { label: "360 Spin", prompt: "Smooth 360 degree rotation of the product, studio lighting, clean background" },
                        { label: "Lifestyle", prompt: "Product being used in a lifestyle setting, natural movement, warm ambient lighting" },
                        { label: "Zoom In", prompt: "Dramatic zoom into product details, macro photography style, shallow depth of field" },
                        { label: "Social Reel", prompt: "Fast-paced dynamic product showcase, trendy transitions, social media reel style" },
                      ] : [
                        { label: "Packshot", prompt: "Product on clean white background, professional packshot, studio lighting" },
                        { label: "Lifestyle", prompt: "Product in a lifestyle setting, warm natural light, modern interior" },
                        { label: "Campaign", prompt: "Product in a bold advertising campaign, cinematic composition, dramatic lighting" },
                        { label: "Social", prompt: "Product styled for social media, flat lay, trendy minimal aesthetic" },
                        { label: "Outdoor", prompt: "Product in an outdoor setting, golden hour, nature background" },
                        { label: "E-commerce", prompt: "Product on neutral surface, soft shadow, e-commerce ready, multiple angles" },
                      ]).map((preset) => (
                        <button key={preset.label} onClick={() => setPrompt(preset.prompt)}
                          className="px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-secondary transition-all cursor-pointer"
                          style={{ fontSize: "10px", fontWeight: 400 }}>{preset.label}</button>
                      ))}
                    </div>
                    {contentType === "image" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span style={{ fontSize: "10px", color: "var(--muted-foreground)", fontWeight: 500 }}>
                          {refStrength > 0.4 ? "Transform" : "Preserve"}
                        </span>
                        <input type="range" min="0.1" max="0.95" step="0.05" value={refStrength}
                          onChange={(e) => setRefStrength(parseFloat(e.target.value))}
                          className="flex-1 h-1 accent-[var(--ora-signal)]" style={{ maxWidth: 120 }} />
                        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{Math.round(refStrength * 100)}%</span>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input for Visual Lab */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleRefUpload(file); e.target.value = ""; }} />

        {/* Input bar — iMessage style */}
        <div className="px-4 pb-4 pt-1">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all focus-within:ring-1 focus-within:ring-white/10"
            style={{ background: "#222120", border: refImage ? "1.5px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.06)" }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) handleRefUpload(file); }}
          >
            {(contentType === "image" || contentType === "film") && !refImage && (
              <button onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground hover:text-ora-signal hover:bg-ora-signal-light transition-all flex-shrink-0"
                title={contentType === "film" ? "Upload image to animate (Motion Lab)" : "Upload reference image (Visual Lab)"}><Camera size={16} /></button>
            )}
            {(contentType === "image" || contentType === "film") && refImage && (contentType === "film" ? <Film size={16} className="text-ora-signal flex-shrink-0" /> : <Layers size={16} className="text-ora-signal flex-shrink-0" />)}
            {contentType !== "image" && contentType !== "film" && <Sparkles size={16} className="text-ora-signal flex-shrink-0" />}
            <input ref={inputRef} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder={refImage && contentType === "film" ? "Describe how to animate this image..." : refImage && contentType === "image" ? "Describe the scene for this product..." : getPlaceholder(contentType)}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
              style={{ fontSize: "15px", fontWeight: 400 }} />
            {/* Voice recording button */}
            {isTranscribing ? (
              <div className="flex items-center gap-2 px-2 flex-shrink-0">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-ora-signal border-t-transparent rounded-full" />
                <span style={{ fontSize: "11px", color: "var(--ora-signal)", fontWeight: 500 }}>Transcribing...</span>
              </div>
            ) : isRecording ? (
              <button onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all flex-shrink-0"
                style={{ background: "rgba(212, 24, 61, 0.1)" }}
                title="Stop recording">
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  <Square size={12} style={{ color: "#d4183d", fill: "#d4183d" }} />
                </motion.div>
                <span style={{ fontSize: "11px", color: "#d4183d", fontWeight: 600 }}>
                  {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, "0")}
                </span>
              </button>
            ) : (
              <button onClick={startRecording} disabled={isGenerating}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground hover:text-ora-signal hover:bg-ora-signal-light transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Voice prompt (OpenAI Whisper)">
                <Mic size={16} />
              </button>
            )}
            {isGenerating ? (
              <div className="flex items-center gap-2 px-3">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                <span style={{ fontSize: "12px", color: "var(--ora-signal)", fontWeight: 500 }}>
                  {refImage && contentType === "film" ? "Motion Lab" : refImage ? "Visual Lab" : "Generating"} from {activeModels.length} model{activeModels.length > 1 ? "s" : ""}...
                </span>
              </div>
            ) : (
              <button onClick={handleGenerate} disabled={!prompt.trim() || (!!refImage && refImage.uploading)}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:opacity-90"
                style={{ background: prompt.trim() ? "var(--primary)" : "var(--secondary)", color: prompt.trim() ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-end mt-1.5 px-1">
            <div className="flex items-center gap-3">
              {(contentType === "image" || contentType === "film") && !refImage && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-muted-foreground hover:text-ora-signal cursor-pointer transition-colors"
                  style={{ fontSize: "10px", fontWeight: 400 }}><Upload size={9} /> {contentType === "film" ? "Drop image for Motion Lab" : "Drop image for Visual Lab"}</button>
              )}
              <span className="w-px h-3 bg-border" />
              <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                {activeModels.length} model{activeModels.length > 1 ? "s" : ""} selected
              </span>
              {contentType === "sound" && sunoCredits !== null && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <span style={{ fontSize: "10px", color: "var(--ora-signal)", fontWeight: 500 }}>
                    {sunoCredits} Suno credits
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Sound configuration panel — always visible when type=sound */}
        {contentType === "sound" && (
          <div className="px-3 pb-2">
            <div className="p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "rgba(26,26,46,0.25)" }}>
              {/* Row 1: Mode toggle + Style + Title */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode */}
                <div className="flex items-center gap-0.5 rounded-lg p-1" style={{ background: "var(--secondary)" }}>
                  <button
                    onClick={() => setSoundInstrumental(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md cursor-pointer transition-all"
                    style={{
                      fontSize: "11px", fontWeight: soundInstrumental ? 600 : 400,
                      background: soundInstrumental ? "var(--ora-signal)" : "transparent",
                      color: soundInstrumental ? "#fff" : "var(--muted-foreground)",
                    }}
                  ><MicOff size={11} /> Instrumental</button>
                  <button
                    onClick={() => setSoundInstrumental(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md cursor-pointer transition-all"
                    style={{
                      fontSize: "11px", fontWeight: !soundInstrumental ? 600 : 400,
                      background: !soundInstrumental ? "var(--ora-signal)" : "transparent",
                      color: !soundInstrumental ? "#fff" : "var(--muted-foreground)",
                    }}
                  ><Mic size={11} /> Vocals</button>
                </div>
                {/* Style */}
                <div className="flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={soundStyle}
                    onChange={(e) => setSoundStyle(e.target.value)}
                    placeholder="Style: Lo-fi, Orchestral, Afrobeat..."
                    className="w-full px-3 py-2 rounded-lg border outline-none"
                    style={{ fontSize: "12px", borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  />
                </div>
                {/* Title */}
                <div className="min-w-[120px]">
                  <input
                    type="text"
                    value={soundTitle}
                    onChange={(e) => setSoundTitle(e.target.value)}
                    placeholder="Track title..."
                    className="w-full px-3 py-2 rounded-lg border outline-none"
                    style={{ fontSize: "12px", borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  />
                </div>
              </div>
              {/* Row 2: Lyrics — shown when Vocals mode */}
              <AnimatePresence>
                {!soundInstrumental && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)" }}>Lyrics</span>
                          {soundLyrics.trim() && (
                            <span className="px-1.5 py-0.5 rounded-md" style={{ fontSize: "9px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>
                              {soundLyrics.trim().split("\n").length} lines
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={generateLyricsFromPrompt}
                            disabled={isGeneratingLyrics}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
                            style={{ fontSize: "11px", fontWeight: 600, color: "#fff", background: "var(--ora-signal)" }}
                          >
                            {isGeneratingLyrics ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            AI Generate Lyrics
                          </button>
                          {soundLyrics.trim() && (
                            <button
                              onClick={() => setSoundLyrics("")}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)", background: "var(--secondary)" }}
                            >
                              <X size={9} /> Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={soundLyrics}
                        onChange={(e) => setSoundLyrics(e.target.value)}
                        placeholder={"Write your own lyrics or click 'AI Generate Lyrics'\n\nUse structure tags:\n[Verse 1]\nYour verse here...\n\n[Chorus]\nYour chorus here...\n\n[Bridge]\nYour bridge here..."}
                        rows={soundLyrics.trim() ? Math.min(12, Math.max(5, soundLyrics.split("\n").length + 2)) : 5}
                        className="w-full px-3 py-2.5 rounded-lg border outline-none resize-y"
                        style={{ fontSize: "12px", lineHeight: 1.65, borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)", fontFamily: "inherit" }}
                      />
                      {soundLyrics.trim() && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "9px", fontWeight: 500, color: "var(--muted-foreground)", background: "var(--secondary)" }}>
                            {soundLyrics.trim().split(/\s+/).length} words
                          </span>
                          {soundLyrics.includes("[") && (
                            <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "9px", fontWeight: 500, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>
                              Structured
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Collapse button when visual results exist */}
        {generations.length > 0 && (contentType === "image" || contentType === "film") && (
          <div className="flex justify-center pb-1">
            <button onClick={() => setPromptCollapsed(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors"
              style={{ fontSize: "9px" }}>
              <ChevronDown size={8} /> Hide prompt bar
            </button>
          </div>
        )}
        </>)}
      </motion.div>
      )}
      </AnimatePresence>

      {/* ═══ PREVIEW MODAL ═══ */}
      <AnimatePresence>
        {previewItem && (
          <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onSave={() => handleSave(previewItem)} onExport={() => handleExport(previewItem)} />
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
    case "campaign": return "Describe your campaign brief...";
  }
}

/* ═══════════════════════════════════
   GENERATE VIEW
   ═���═════════════════════════════════ */

function GenerateView({ generations, isGenerating, contentType, activeModels, onSave, onCompareAll, compareItems, onPreview, error, onAnimate, onExport }: {
  generations: GeneratedItem[];
  isGenerating: boolean;
  contentType: ContentType;
  activeModels: AIModel[];
  onSave: (item: GeneratedItem) => void;
  onCompareAll: (items: GeneratedItem[]) => void;
  compareItems: GeneratedItem[];
  onPreview: (item: GeneratedItem) => void;
  error?: string | null;
  onAnimate?: (item: GeneratedItem) => void;
  onExport: (item: GeneratedItem) => void;
}) {
  const [sliderIndex, setSliderIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // Reset slider and image errors when new generations arrive
  useEffect(() => { setSliderIndex(0); setImgErrors(new Set()); }, [generations.length]);

  // Keyboard navigation for fullscreen slider
  useEffect(() => {
    if (generations.length <= 1) return;
    const isVisualType = contentType === "image" || contentType === "film";
    if (!isVisualType) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setSliderIndex((prev) => (prev - 1 + generations.length) % generations.length);
      if (e.key === "ArrowRight") setSliderIndex((prev) => (prev + 1) % generations.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [generations.length, contentType]);

  // Touch swipe handlers for theater mode
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);
  const handleTouchEnd = useCallback(() => {
    const threshold = 60;
    if (Math.abs(touchDeltaX.current) > threshold && generations.length > 1) {
      if (touchDeltaX.current < 0) {
        setSliderIndex((prev) => (prev + 1) % generations.length);
      } else {
        setSliderIndex((prev) => (prev - 1 + generations.length) % generations.length);
      }
    }
    touchDeltaX.current = 0;
  }, [generations.length]);

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
          The AI providers may be slow or temporarily unavailable. Try again.
        </p>
      </div>
    );
  }
  if (generations.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #D4956B 0%, #C27A98 50%, #5E6AD2 100%)", boxShadow: "0 8px 24px rgba(94,106,210,0.15)" }}>
          <Sparkles size={28} style={{ color: "#E8E4DF" }} />
        </div>
        <h2 className="mb-3" style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.04em", color: "#E8E4DF" }}>
          Generate anything
        </h2>
        <p className="text-center max-w-[420px] mb-8" style={{ fontSize: "15px", lineHeight: 1.55, color: "#9A9590" }}>
          Type what you need below. Select models to compare, then hit Enter. ORA generates from <span style={{ fontWeight: 600, color: "#E8E4DF" }}>{activeModels.length} model{activeModels.length > 1 ? "s" : ""}</span> — you pick the best.
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-[500px]">
          {getSuggestions(contentType).map((s) => (
            <motion.span
              key={s}
              whileHover={{ scale: 1.05, y: -2 }}
              className="px-3.5 py-2 rounded-full cursor-default"
              style={{ border: "1px solid rgba(255,255,255,0.10)", fontSize: "12px", fontWeight: 700, color: "#9A9590", background: "#222120" }}
            >
              {s}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  if (isGenerating) {
    const isVisualGen = contentType === "image" || contentType === "film";
    if (isVisualGen) {
      // Immersive loading: black screen with model cards pulsing
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "#000" }}>
          {/* Pulsing models as 2x2 skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-8" style={{ maxWidth: 480 }}>
            {activeModels.slice(0, 4).map((model, i) => (
              <motion.div key={model.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="aspect-[4/3] flex items-center justify-center relative" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <motion.div animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}>
                    <Sparkles size={20} style={{ color: "var(--ora-signal)" }} />
                  </motion.div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }}
                        transition={{ duration: 6 + i * 1.5, ease: "easeInOut" }}
                        className="h-full rounded-full" style={{ background: "var(--ora-signal)" }} />
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{model.name}</span>
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{model.provider}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.p animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>
            Generating {activeModels.length} variation{activeModels.length > 1 ? "s" : ""}...
          </motion.p>
        </div>
      );
    }
    const cols = activeModels.length === 1 ? "grid-cols-1 max-w-[400px]" : activeModels.length === 2 ? "grid-cols-2 max-w-[640px]" : activeModels.length === 3 ? "grid-cols-3 max-w-[860px]" : "grid-cols-2 lg:grid-cols-4";
    return (
      <div className="p-6">
        <div className={`grid ${cols} gap-4`}>
          {activeModels.map((model, i) => (
            <motion.div key={model.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="aspect-[4/3] bg-secondary/30 flex items-center justify-center relative">
                <motion.div animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}>
                  <Sparkles size={20} className="text-ora-signal/40" />
                </motion.div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.5 + i * 0.3, ease: "easeInOut" }}
                      className="h-full rounded-full" style={{ background: "var(--ora-signal)" }} />
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

  const safeIndex = Math.min(sliderIndex, generations.length - 1);
  const currentItem = generations[safeIndex];
  const isVisual = currentItem?.type === "image" || currentItem?.type === "film";

  // Helper to get real image URL (skip if we know it errored)
  const getImageUrl = (item: GeneratedItem, skipErrors = false) => {
    if (item.preview.kind === "image") {
      const url = item.preview.imageUrl || (item.preview.palette[0]?.startsWith("http") ? item.preview.palette[0] : null);
      if (url && skipErrors && imgErrors.has(item.id)) return null;
      return url;
    }
    return null;
  };
  const getVideoUrl = (item: GeneratedItem) => {
    if (item.preview.kind === "film") return (item.preview as any).videoUrl || null;
    return null;
  };

  // ═══════════════════════════════════════
  // VISUAL TYPES: FULLSCREEN SLIDER
  // ═══════════════��═══════════════════════
  if (isVisual) {
    return (
      <div ref={swipeContainerRef}
        className="absolute inset-0 flex flex-col select-none"
        style={{ background: "#000" }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

        {/* Top overlay: model indicator */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#fff" }}>{currentItem.model.name}</span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{currentItem.model.provider}</span>
            {currentItem.model.speed === "fast" && <Zap size={10} className="text-green-400" />}
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{currentItem.timestamp}</span>
            {generations.length > 1 && (
              <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "11px", fontWeight: 500, color: "#fff", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" }}>
                {safeIndex + 1} / {generations.length}
              </span>
            )}
          </div>
        </div>

        {/* ── Main image area: absolute fill ── */}
        <div className="flex-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem?.id || safeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {getImageUrl(currentItem, true) ? (
                <img
                  src={getImageUrl(currentItem)!}
                  alt={currentItem.preview.kind === "image" ? currentItem.preview.label : "Generated"}
                  draggable={false}
                  onError={() => setImgErrors(prev => new Set(prev).add(currentItem.id))}
                  style={{ userSelect: "none", width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              ) : getVideoUrl(currentItem) ? (
                <video src={getVideoUrl(currentItem)!} className="w-full h-full object-contain"
                  controls muted loop playsInline autoPlay />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PreviewRenderer preview={currentItem.preview} large />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows (desktop only) */}
          {generations.length > 1 && (
            <>
              <button onClick={() => setSliderIndex((prev) => (prev - 1 + generations.length) % generations.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full items-center justify-center cursor-pointer z-20 transition-all hidden md:flex hover:scale-110"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}>
                <ChevronLeft size={20} style={{ color: "rgba(255,255,255,0.8)" }} />
              </button>
              <button onClick={() => setSliderIndex((prev) => (prev + 1) % generations.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full items-center justify-center cursor-pointer z-20 transition-all hidden md:flex hover:scale-110"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}>
                <ChevronRight size={20} style={{ color: "rgba(255,255,255,0.8)" }} />
              </button>
            </>
          )}
        </div>

        {/* Bottom overlay: thumbnails + actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 65%, transparent 100%)" }}>

          {/* Floating thumbnails */}
          {generations.length > 1 && (
            <div className="flex justify-center gap-2.5 px-4 mb-3">
              {generations.map((item, i) => {
                const isActive = i === safeIndex;
                const imgUrl = getImageUrl(item);
                return (
                  <button key={item.id} onClick={() => setSliderIndex(i)}
                    className={`flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer ${isActive ? "ring-2 ring-white scale-110 opacity-100" : "opacity-40 hover:opacity-75"}`}
                    style={{ width: 64, height: 48 }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{item.model.name.slice(0, 6)}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons — glass morphism */}
          <div className="flex items-center justify-center gap-2 px-4 pb-4 pt-1">
            <button onClick={() => onSave(currentItem)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${currentItem.saved ? "text-white" : "text-white/70 hover:text-white"}`}
              style={{ background: currentItem.saved ? "rgba(59,79,196,0.5)" : "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", fontSize: "12px", fontWeight: 500 }}>
              {currentItem.saved ? <Heart size={14} className="fill-current" /> : <Heart size={14} />}
              {currentItem.saved ? "Saved" : "Save to Library"}
            </button>
            {currentItem.saved && (
              <Link to="/hub/library"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer"
                style={{ fontSize: "11px", fontWeight: 400 }}>
                View Library <ChevronRight size={11} />
              </Link>
            )}
            <button onClick={() => onCompareAll(generations)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
              style={{ background: generations.every(g => compareItems.find(c => c.id === g.id)) ? "rgba(59,79,196,0.4)" : "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", fontSize: "12px", fontWeight: 500 }}>
              <Columns2 size={14} /> Compare All ({generations.length})
            </button>
            {currentItem.type === "image" && currentItem.preview.kind === "image" && (currentItem.preview.imageUrl) && onAnimate && (
              <button onClick={() => onAnimate(currentItem)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", fontSize: "12px", fontWeight: 500 }}>
                <Play size={14} /> Animate
              </button>
            )}
            <button onClick={() => onExport(currentItem)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
              style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", fontSize: "12px", fontWeight: 500 }}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // NON-VISUAL TYPES: card layout
  // ═══════════════════════════════════════
  return (
    <div className="p-6 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <p className="text-muted-foreground mb-0.5" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Results from {generations.length} models
          </p>
          <p className="text-foreground truncate max-w-[400px]" style={{ fontSize: "13px", fontWeight: 500 }}>
            "{generations[0]?.prompt}"
          </p>
        </div>
        <button onClick={() => { /* regenerate */ }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
          style={{ borderColor: "var(--border)", fontSize: "11px", fontWeight: 500 }}>
          <RotateCcw size={11} /> Regenerate
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[1600px] mx-auto">
          {generations.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}>
              <ResultCard item={item} onSave={() => onSave(item)} onPreview={() => onPreview(item)} onExport={() => onExport(item)} />
            </motion.div>
          ))}
        </div>
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

/* ═���════���════════════════════════════
   RESULT CARD
   ═══════════════════════════════════ */

function ResultCard({ item, onSave, onPreview, onExport }: {
  item: GeneratedItem;
  onSave: () => void;
  onPreview: () => void;
  onExport: () => void;
}) {
  const isComparing = false;
  return (
    <div
      className={`bg-card border-2 rounded-2xl overflow-hidden group transition-all hover:border-border-strong hover:shadow-2xl ${isComparing ? "ring-4 ring-ora-signal/30 border-ora-signal" : ""}`}
      style={{ borderColor: isComparing ? undefined : "var(--border)", boxShadow: isComparing ? "0 4px 24px rgba(91,91,255,0.15)" : "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      {/* MASSIVE Preview */}
      <div className={`${item.type === "text" || item.type === "code" ? "aspect-[3/4]" : "aspect-[16/10]"} relative cursor-pointer overflow-hidden`} onClick={onPreview}>
        <PreviewRenderer preview={item.preview} />
        {/* Hover overlay with zoom effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <div className="transform scale-90 group-hover:scale-100 transition-transform">
            <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-xl">
              <Eye size={22} className="text-foreground" />
            </div>
          </div>
        </div>
        {/* Type badge */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-md" style={{ background: "rgba(255,255,255,0.9)", border: "2px solid rgba(0,0,0,0.1)" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#E8E4DF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.type}</span>
        </div>
      </div>

      {/* Enhanced Info */}
      <div className="px-5 py-4 bg-gradient-to-b from-white to-[#FAFAFA]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--foreground)" }}>{item.model.name}</span>
            {item.model.speed === "fast" && (
              <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669]">
                <span style={{ fontSize: "9px", fontWeight: 800, color: "white", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fast</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.model.provider}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${item.saved ? "bg-gradient-to-r from-[#5E6AD2] to-[#4B51A8] text-white shadow-lg" : "bg-[#222120] text-foreground hover:bg-[#2a2928] hover:scale-105"}`}
            style={{ fontSize: "12px", fontWeight: 700 }}
          >
            {item.saved ? <Heart size={14} className="fill-current" /> : <Heart size={14} />}
            {item.saved ? "Saved" : "Save"}
          </button>
          <div className="flex-1" />
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
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
   SUNO ACTIONS (post-processing buttons for sound cards)
   ═══════════════════════════════════ */

function SunoActions({ sunoTaskId, sunoAudioId, prompt }: { sunoTaskId: string; sunoAudioId: string; prompt: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  const callSuno = async (action: string, body: Record<string, any>, label: string) => {
    if (loading) return;
    setLoading(action);
    toast(`${label}...`, { duration: 3000 });
    try {
      const res = await fetch(`${API_BASE}/suno/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "text/plain" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (data.wavUrl) { window.open(data.wavUrl, "_blank"); toast.success("WAV ready — downloading"); }
        else if (data.videoUrl) { window.open(data.videoUrl, "_blank"); toast.success("Music video ready"); }
        else if (data.stems) {
          const stemKeys = Object.entries(data.stems).filter(([, v]) => typeof v === "string" && (v as string).startsWith("http"));
          if (stemKeys.length > 0) {
            toast.success(`${stemKeys.length} stems separated`, { description: stemKeys.map(([k]) => k.replace(/Url$/, "")).join(", "), duration: 6000 });
            stemKeys.forEach(([, url]) => window.open(url as string, "_blank"));
          } else { toast.error("No stems returned"); }
        }
        else if (data.lyrics) { toast.success("Lyrics generated", { description: typeof data.lyrics === "string" ? data.lyrics.slice(0, 100) : JSON.stringify(data.lyrics).slice(0, 100), duration: 6000 }); }
        else { toast.success(`${label} complete`); }
      } else {
        console.error(`[SunoActions] ${action} failed:`, data.error);
        toast.error(`${label} failed`, { description: data.error || "Unknown error" });
      }
    } catch (err: any) {
      console.error(`[SunoActions] ${action} error:`, err);
      toast.error(`${label} error`, { description: String(err) });
    }
    setLoading(null);
  };

  const btnCls = "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors";
  const btnStyle = { background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

  return (
    <div className="flex flex-wrap gap-1 w-full">
      <button className={btnCls} style={btnStyle} disabled={!!loading}
        onClick={() => callSuno("wav", { taskId: sunoTaskId, audioId: sunoAudioId }, "WAV Export")}>
        {loading === "wav" ? <Loader2 size={8} className="animate-spin" /> : <FileAudio size={8} />} WAV
      </button>
      <button className={btnCls} style={btnStyle} disabled={!!loading}
        onClick={() => callSuno("vocal-removal", { taskId: sunoTaskId, audioId: sunoAudioId, type: "separate_vocal" }, "Vocal Separation")}>
        {loading === "vocal-removal" ? <Loader2 size={8} className="animate-spin" /> : <Scissors size={8} />} Stems
      </button>
      <button className={btnCls} style={btnStyle} disabled={!!loading}
        onClick={() => callSuno("mp4", { taskId: sunoTaskId, audioId: sunoAudioId }, "Music Video")}>
        {loading === "mp4" ? <Loader2 size={8} className="animate-spin" /> : <Video size={8} />} Video
      </button>
    </div>
  );
}

/* ═══════════════════════════════════
   PREVIEW RENDERER
   ═══════════════════════════════════ */

function PreviewRenderer({ preview, large = false }: { preview: GenerationPreview; large?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  switch (preview.kind) {
    case "image": {
      const realUrl = preview.imageUrl || (preview.palette[0]?.startsWith("http") ? preview.palette[0] : null);
      if (realUrl && !imgFailed) {
        return (
          <div className="w-full h-full relative bg-secondary/30">
            <img src={realUrl} alt={preview.label} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
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
        <div className="w-full h-full p-4 flex flex-col bg-card overflow-hidden">
          <p className="text-foreground/70 flex-1 overflow-y-auto" style={{ fontSize: large ? "13px" : "11px", lineHeight: 1.6 }}>
            {preview.excerpt}
          </p>
          <div className="flex-shrink-0 pt-2 border-t border-border mt-2">
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", fontWeight: 500 }}>{preview.wordCount} words</span>
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
      const hasSuno = !!(preview.sunoTaskId && preview.sunoAudioId);
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-card px-4">
          {preview.title && (
            <div className="w-full mb-1 truncate" style={{ fontSize: "10px", fontWeight: 500, color: "var(--foreground)" }}>{preview.title}</div>
          )}
          <div className="flex items-end gap-px w-full h-10 mb-1">
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
          <div className="flex items-center justify-between w-full mb-1">
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.duration}</span>
            {hasAudio && <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "8px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>Suno</span>}
            {preview.bpm && <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.bpm} BPM</span>}
          </div>
          {hasSuno && hasAudio && (
            <SunoActions sunoTaskId={preview.sunoTaskId!} sunoAudioId={preview.sunoAudioId!} prompt="" />
          )}
        </div>
      );
    }
  }
}

/* ══════════════════════════════════
   LIBRARY VIEW
   ═══════════════════════════════════ */

function LibraryView({ items, filter, search, onFilterChange, onSearchChange, onRemove, onPreview,
  libraryTab, onLibraryTabChange, folders, onCreateFolder, onRenameFolder, onDeleteFolder, onMoveToFolder,
  editingFolderId, editingFolderName, onStartEditFolder, onEditFolderNameChange, onAnimate,
}: {
  items: LibraryItem[];
  filter: ContentType | "all";
  search: string;
  onFilterChange: (f: ContentType | "all") => void;
  onSearchChange: (s: string) => void;
  onRemove: (id: string) => void;
  onPreview: (item: GeneratedItem) => void;
  libraryTab: LibraryTab;
  onLibraryTabChange: (tab: LibraryTab) => void;
  folders: LibraryFolder[];
  onCreateFolder: (source: LibraryTab) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveToFolder: (itemId: string, folderId: string | undefined) => void;
  editingFolderId: string | null;
  editingFolderName: string;
  onStartEditFolder: (id: string, name: string) => void;
  onEditFolderNameChange: (name: string) => void;
  onAnimate?: (item: GeneratedItem) => void;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const tabFolders = folders.filter(f => f.source === libraryTab);
  const displayItems = selectedFolderId
    ? items.filter(item => item.folderId === selectedFolderId)
    : items;

  const filterOptions: { id: ContentType | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...contentTypes.filter(ct => ct.id !== "campaign").map((ct) => ({ id: ct.id, label: ct.label })),
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar: Tabs + Folders ── */}
      <div className="w-56 flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--secondary)" }}>
        {/* Content / Campaign tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["content", "campaign"] as LibraryTab[]).map(tab => (
            <button key={tab} onClick={() => { onLibraryTabChange(tab); setSelectedFolderId(null); }}
              className={`flex-1 px-3 py-3 transition-colors cursor-pointer ${libraryTab === tab ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontSize: "12px", fontWeight: libraryTab === tab ? 600 : 400, textTransform: "capitalize" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Folders list */}
        <div className="flex-1 overflow-y-auto p-2">
          <button onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${!selectedFolderId ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
            style={{ fontSize: "12px", fontWeight: !selectedFolderId ? 500 : 400 }}>
            <FolderOpen size={13} /> All {libraryTab === "content" ? "Content" : "Campaigns"}
            <span className="ml-auto px-1.5 rounded-full" style={{ fontSize: "9px", background: "var(--muted)", color: "var(--muted-foreground)" }}>
              {items.length}
            </span>
          </button>

          {tabFolders.map(folder => (
            <div key={folder.id} className={`group flex items-center gap-1.5 px-3 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer ${selectedFolderId === folder.id ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}>
              {editingFolderId === folder.id ? (
                <input autoFocus value={editingFolderName} onChange={(e) => onEditFolderNameChange(e.target.value)}
                  onBlur={() => onRenameFolder(folder.id, editingFolderName)}
                  onKeyDown={(e) => { if (e.key === "Enter") onRenameFolder(folder.id, editingFolderName); if (e.key === "Escape") onRenameFolder(folder.id, folder.name); }}
                  className="flex-1 bg-transparent border-none outline-none text-foreground min-w-0"
                  style={{ fontSize: "12px" }} />
              ) : (
                <>
                  <button onClick={() => setSelectedFolderId(folder.id)} className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer text-left">
                    <FolderOpen size={12} />
                    <span className="truncate" style={{ fontSize: "12px" }}>{folder.name}</span>
                  </button>
                  <span className="flex-shrink-0 px-1.5 rounded-full" style={{ fontSize: "9px", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                    {items.filter(i => i.folderId === folder.id).length}
                  </span>
                  <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onStartEditFolder(folder.id, folder.name); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer"><Pencil size={9} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 size={9} /></button>
                  </div>
                </>
              )}
            </div>
          ))}

          <button onClick={() => onCreateFolder(libraryTab)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mt-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-card transition-colors cursor-pointer"
            style={{ fontSize: "11px" }}>
            <FolderPlus size={12} /> New Folder
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 max-w-[320px]">
            <Search size={14} className="text-muted-foreground" />
            <input value={search} onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${libraryTab}...`}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
              style={{ fontSize: "13px" }} />
          </div>
          <div className="flex items-center gap-1">
            {filterOptions.map((f) => (
              <button key={f.id} onClick={() => onFilterChange(f.id)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filter === f.id ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                style={{ fontSize: "11px", fontWeight: filter === f.id ? 500 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {displayItems.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen size={24} className="mx-auto mb-3 text-muted-foreground/30" />
            <p style={{ fontSize: "14px", color: "var(--muted-foreground)" }}>
              {selectedFolderId ? "This folder is empty" : `No ${libraryTab} items yet`}
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted-foreground)", opacity: 0.6 }}>
              {libraryTab === "content" ? "Generated content is auto-saved here" : "Campaign assets are auto-saved here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayItems.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card border rounded-xl overflow-hidden group relative"
                style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div className="aspect-[4/3] relative cursor-pointer" onClick={() => onPreview(item)}>
                  <PreviewRenderer preview={item.preview} />
                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); onPreview(item); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                      <Eye size={14} className="text-white" />
                    </button>
                    {item.preview.kind === "image" && (item.preview as any).imageUrl && onAnimate && (
                      <button onClick={(e) => { e.stopPropagation(); onAnimate(item); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                        title="Animate this image">
                        <Play size={14} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="truncate mb-1" style={{ fontSize: "11px", fontWeight: 500, color: "var(--foreground)" }}>
                    {item.prompt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate" style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{item.model.name}</span>
                      <span style={{ fontSize: "8px", color: "var(--muted-foreground)", opacity: 0.5 }}>{item.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => setMovingItemId(movingItemId === item.id ? null : item.id)} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer" title="Move to folder">
                        <FolderOpen size={10} />
                      </button>
                      <button onClick={() => onRemove(item.id)} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive cursor-pointer" title="Remove">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  {/* Move to folder dropdown */}
                  {movingItemId === item.id && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-0 left-0 right-0 z-20 bg-card border-t p-2 space-y-0.5" style={{ borderColor: "var(--border)", boxShadow: "0 -4px 12px rgba(0,0,0,0.08)" }}>
                      <p style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 4 }}>Move to</p>
                      <button onClick={() => { onMoveToFolder(item.id, undefined); setMovingItemId(null); }}
                        className="w-full text-left px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                        style={{ fontSize: "11px" }}>No folder</button>
                      {tabFolders.map(f => (
                        <button key={f.id} onClick={() => { onMoveToFolder(item.id, f.id); setMovingItemId(null); }}
                          className={`w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-secondary ${item.folderId === f.id ? "text-ora-signal" : "text-muted-foreground hover:text-foreground"}`}
                          style={{ fontSize: "11px" }}>{f.name}</button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════���═════════════��═════════════
   COMPARE VIEW
   ═══════════════════════════════════ */

function CompareView({ items, onRemove, onSave, onExport }: {
  items: GeneratedItem[];
  onRemove: (id: string) => void;
  onSave: (item: GeneratedItem) => void;
  onExport: (item: GeneratedItem) => void;
}) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [viewMode, setViewMode] = useState<"grid" | "slider">("grid");
  const [sliderPosition, setSliderPosition] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current || !isDragging.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(pct);
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <Columns2 size={24} className="mb-4 text-muted-foreground/30" />
        <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--foreground)" }}>No items to compare</p>
        <p className="text-center mt-2 max-w-[360px]" style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.55 }}>
          Generate content, then click "Compare" on any result to add it here. Compare up to 8 outputs side by side.
        </p>
      </div>
    );
  }

  // Side-by-side slider mode for exactly 2 images
  const canSlider = items.length === 2 && items.every(i => i.preview.kind === "image" && ((i.preview as any).imageUrl || (i.preview as any).palette?.[0]?.startsWith("http")));

  return (
    <div className="p-6 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Comparing {items.length} result{items.length > 1 ? "s" : ""}
          </p>
          {canSlider && (
            <div className="flex items-center gap-1 border rounded-lg p-0.5" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${viewMode === "grid" ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground"}`}
                style={{ fontWeight: viewMode === "grid" ? 500 : 400 }}>Grid</button>
              <button onClick={() => setViewMode("slider")}
                className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${viewMode === "slider" ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground"}`}
                style={{ fontWeight: viewMode === "slider" ? 500 : 400 }}>Slider</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Zoom</span>
            <input type="range" min="50" max="200" value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-20 h-1 accent-[var(--ora-signal)]" />
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{zoomLevel}%</span>
          </div>
          <button onClick={() => items.forEach((item) => onRemove(item.id))}
            className="text-muted-foreground hover:text-foreground cursor-pointer" style={{ fontSize: "11px" }}>
            Clear all
          </button>
        </div>
      </div>

      {/* Side-by-side slider for 2 images */}
      {viewMode === "slider" && canSlider && (
        <div className="flex-1 min-h-0 mb-4">
          <div ref={sliderRef} className="relative w-full h-full rounded-xl overflow-hidden cursor-col-resize select-none"
            style={{ border: "1px solid var(--border)" }}
            onMouseDown={() => { isDragging.current = true; }}
            onMouseMove={(e) => handleSliderMove(e.clientX)}
            onMouseUp={() => { isDragging.current = false; }}
            onMouseLeave={() => { isDragging.current = false; }}
            onTouchStart={() => { isDragging.current = true; }}
            onTouchMove={(e) => handleSliderMove(e.touches[0].clientX)}
            onTouchEnd={() => { isDragging.current = false; }}>
            {/* Left image (full width, visible up to slider) */}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
              <img src={(items[0].preview as any).imageUrl || (items[0].preview as any).palette?.[0]} alt="" className="w-full h-full object-contain" style={{ background: "#f5f5f7" }} />
            </div>
            {/* Right image (full width, visible from slider) */}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
              <img src={(items[1].preview as any).imageUrl || (items[1].preview as any).palette?.[0]} alt="" className="w-full h-full object-contain" style={{ background: "#f5f5f7" }} />
            </div>
            {/* Slider line */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${sliderPosition}%`, boxShadow: "0 0 8px rgba(0,0,0,0.3)" }}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                <ChevronLeft size={10} style={{ color: "#666" }} /><ChevronRight size={10} style={{ color: "#666" }} />
              </div>
            </div>
            {/* Labels */}
            <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#fff" }}>{items[0].model.name}</span>
            </div>
            <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#fff" }}>{items[1].model.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`grid gap-4 ${items.length === 1 ? "grid-cols-1 max-w-lg" : items.length === 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : items.length <= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                className="bg-card border rounded-xl overflow-hidden relative"
                style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.03)" }}>
                <button onClick={() => onRemove(item.id)}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer border"
                  style={{ borderColor: "var(--border)" }}><X size={11} /></button>

                <div className={items.length <= 2 ? "aspect-[3/2]" : "aspect-[4/3]"} style={{ overflow: "auto" }}>
                  <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "center center", width: "100%", height: "100%" }}>
                    {item.preview.kind === "image" && (item.preview.imageUrl || item.preview.palette[0]?.startsWith("http")) ? (
                      <div className="w-full h-full bg-black/5 flex items-center justify-center">
                        <img src={item.preview.imageUrl || item.preview.palette[0]} alt={item.preview.label} className="w-full h-full object-contain" />
                      </div>
                    ) : item.preview.kind === "film" && (item.preview as any).videoUrl ? (
                      <video src={(item.preview as any).videoUrl} className="w-full h-full object-contain" controls muted loop playsInline />
                    ) : (
                      <PreviewRenderer preview={item.preview} large />
                    )}
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{item.model.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-secondary" style={{ fontSize: "9px", fontWeight: 500, color: "var(--muted-foreground)" }}>{item.model.provider}</span>
                    {item.model.speed === "fast" && <Zap size={9} className="text-green-500" />}
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Quality</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: j < item.model.quality ? "var(--ora-signal)" : "var(--secondary)" }} />
                      ))}
                    </div>
                    <span className="ml-2" style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{item.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <button onClick={() => onSave(item)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors cursor-pointer ${item.saved ? "bg-primary text-primary-foreground" : "border hover:bg-secondary"}`}
                      style={{ borderColor: item.saved ? undefined : "var(--border)", fontSize: "11px", fontWeight: 500 }}>
                      {item.saved ? <Check size={11} /> : <Heart size={11} />}
                      {item.saved ? "Saved" : "Save"}
                    </button>
                    <button onClick={() => onExport(item)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "11px" }}>
                      <Download size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {items.length < 8 && (
              <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 text-muted-foreground/30" style={{ borderColor: "var(--border)" }}>
                <Plus size={20} className="mb-2" />
                <span style={{ fontSize: "12px" }}>Add to compare</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   PREVIEW MODAL
   ═══════════════════════════════════ */

function PreviewModal({ item, onClose, onSave, onExport }: {
  item: GeneratedItem;
  onClose: () => void;
  onSave: () => void;
  onExport: () => void;
}) {
  const isVisual = item.preview.kind === "image" || item.preview.kind === "film";
  const hasRealImage = item.preview.kind === "image" && (item.preview.imageUrl || item.preview.palette[0]?.startsWith("http"));
  const hasRealVideo = item.preview.kind === "film" && (item.preview as any).videoUrl;

  // MASSIVE Full-screen lightbox for visual content
  if (isVisual) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(0,0,0,0.98)" }}
      >
        {/* Enhanced Top bar */}
        <div className="flex items-center justify-between px-8 py-5 flex-shrink-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{item.model.name}</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.model.provider}</span>
            {item.model.speed === "fast" && (
              <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] flex items-center gap-1">
                <Zap size={12} fill="white" color="white" />
                <span style={{ fontSize: "10px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.04em" }}>Fast</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSave}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl transition-all cursor-pointer ${item.saved ? "bg-gradient-to-r from-[#5E6AD2] to-[#4B51A8] text-white shadow-lg" : "bg-white/10 text-white/70 hover:text-white hover:bg-white/20"}`}
              style={{ fontSize: "15px", fontWeight: 800 }}>
              {item.saved ? <Check size={16} /> : <Heart size={16} />}
              {item.saved ? "Saved" : "Save"}
            </button>
            <button onClick={onExport}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/10 text-white/70 hover:text-white hover:bg-white/20 cursor-pointer transition-all"
              style={{ fontSize: "15px", fontWeight: 800 }}>
              <Download size={16} /> Export
            </button>
            <button onClick={onClose}
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 cursor-pointer transition-all ml-3">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MASSIVE Image/Video display */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-6 cursor-zoom-out" onClick={onClose}>
          <motion.div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full" initial={{ scale: 0.97 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
            {hasRealImage ? (
              <img
                src={item.preview.kind === "image" ? (item.preview.imageUrl || item.preview.palette[0]) : ""}
                alt={item.preview.kind === "image" ? item.preview.label : ""}
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-2xl"
                style={{ userSelect: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
              />
            ) : hasRealVideo ? (
              <video
                src={(item.preview as any).videoUrl}
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-2xl"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                controls autoPlay muted loop playsInline
              />
            ) : (
              <div className="w-[800px] h-[600px] rounded-2xl overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                <PreviewRenderer preview={item.preview} large />
              </div>
            )}
          </motion.div>
        </div>

        {/* Enhanced Bottom: prompt */}
        <div className="flex-shrink-0 px-8 pb-6 text-center" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)" }}>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontWeight: 500, fontStyle: "italic" }}>
            "{item.prompt}"
          </p>
        </div>
      </motion.div>
    );
  }

  // Non-visual: card modal
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
        <div className={item.preview.kind === "text" || item.preview.kind === "code" ? "max-h-[60vh] overflow-y-auto" : "aspect-[16/10]"}>
          <PreviewRenderer preview={item.preview} large />
        </div>
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
            <button onClick={onSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${item.saved ? "bg-primary text-primary-foreground" : "border hover:bg-secondary"}`}
              style={{ borderColor: item.saved ? undefined : "var(--border)", fontSize: "13px", fontWeight: 500 }}>
              {item.saved ? <Check size={14} /> : <Heart size={14} />}
              {item.saved ? "Saved to Library" : "Save to Library"}
            </button>
            <button onClick={onExport} className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary cursor-pointer" style={{ borderColor: "var(--border)", fontSize: "13px" }}>
              <Download size={14} /> Export
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer" style={{ fontSize: "13px" }}>Close</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}