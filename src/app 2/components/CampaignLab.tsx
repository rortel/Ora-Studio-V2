import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Upload, Link2, X, Check, Loader2, Eye, Save,
  Instagram, Linkedin, Facebook, Film,
  Image as ImageIcon, FileText, AlertCircle, Download,
  RefreshCw, Shield, Users, MessageSquare,
  Palette, Type, BookOpen, Camera,
  Calendar, Send, Clock, ChevronRight, ChevronLeft, ExternalLink, Plus, Twitter,
  Youtube, LayoutGrid, Megaphone, Clapperboard,
  Smartphone, Info, Target, Zap, TrendingUp, CheckCircle2, CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

interface BrandVault {
  brandName?: string;
  logoUrl?: string;
  logo_url?: string;
  logoStoragePath?: string;
  logo_path?: string;
  approvedTerms?: string[];
  forbiddenTerms?: string[];
  keyMessages?: string[];
  sections?: { title: string; score: number; items: { label: string; value: string }[] }[];
}

interface FormatOption {
  id: string;
  label: string;
  platform: string;
  icon: any;
  type: "image" | "text" | "video";
  aspectRatio: string;
  description: string;
}

interface CarouselSlide {
  text: string;
  imageUrl?: string;
  imagePrompt?: string;
  status?: "pending" | "generating" | "ready" | "error";
}

interface GeneratedAsset {
  id: string;
  formatId: string;
  label: string;
  platform: string;
  type: "image" | "text" | "video";
  status: "pending" | "generating" | "ready" | "error";
  imageUrl?: string;
  videoUrl?: string;
  
  copy?: string;
  caption?: string;
  hashtags?: string;
  error?: string;
  model?: string;
  subject?: string;
  headline?: string;
  ctaText?: string;
  features?: string[];
  imagePrompt?: string;
  videoPrompt?: string;
  carouselSlides?: CarouselSlide[];
}

interface CampaignLabProps {
  onAssetComplete?: (asset: any) => void;
  onSaveAssetToLibrary?: (asset: any) => void;
}

/* ═══════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════ */

const FORMAT_OPTIONS: FormatOption[] = [
  // ── LinkedIn ──
  { id: "linkedin-post", label: "LinkedIn Post", platform: "LinkedIn", icon: Linkedin, type: "image", aspectRatio: "1.91:1", description: "1200x628 + caption" },
  { id: "linkedin-carousel", label: "LinkedIn Carousel", platform: "LinkedIn", icon: LayoutGrid, type: "image", aspectRatio: "1:1", description: "1080x1080 multi-slide" },
  { id: "linkedin-video", label: "LinkedIn Video", platform: "LinkedIn", icon: Film, type: "video", aspectRatio: "16:9", description: "1920x1080 video" },
  { id: "linkedin-text", label: "LinkedIn Text Post", platform: "LinkedIn", icon: FileText, type: "text", aspectRatio: "3:2", description: "Text-only thought leadership" },
  // ── Instagram ──
  { id: "instagram-post", label: "Instagram Post", platform: "Instagram", icon: Instagram, type: "image", aspectRatio: "1:1", description: "1080x1080 + caption" },
  { id: "instagram-carousel", label: "Instagram Carousel", platform: "Instagram", icon: LayoutGrid, type: "image", aspectRatio: "1:1", description: "1080x1080 multi-slide" },
  { id: "instagram-story", label: "Instagram Story", platform: "Instagram", icon: Smartphone, type: "image", aspectRatio: "9:16", description: "1080x1920 vertical" },
  { id: "instagram-reel", label: "Instagram Reel", platform: "Instagram", icon: Film, type: "video", aspectRatio: "9:16", description: "1080x1920 video" },
  // ── Facebook ──
  { id: "facebook-post", label: "Facebook Post", platform: "Facebook", icon: Facebook, type: "image", aspectRatio: "1:1", description: "1200x1200 + caption" },
  { id: "facebook-story", label: "Facebook Story", platform: "Facebook", icon: Smartphone, type: "image", aspectRatio: "9:16", description: "1080x1920 vertical" },
  { id: "facebook-video", label: "Facebook Video", platform: "Facebook", icon: Film, type: "video", aspectRatio: "16:9", description: "1920x1080 video" },
  { id: "facebook-ad", label: "Facebook Ad", platform: "Facebook", icon: Megaphone, type: "image", aspectRatio: "1.91:1", description: "1200x628 ad creative" },
  // ── TikTok ──
  { id: "tiktok-video", label: "TikTok Video", platform: "TikTok", icon: Clapperboard, type: "video", aspectRatio: "9:16", description: "1080x1920 short video" },
  { id: "tiktok-image", label: "TikTok Photo", platform: "TikTok", icon: ImageIcon, type: "image", aspectRatio: "9:16", description: "1080x1920 photo post" },
  // ── Twitter/X ──
  { id: "twitter-post", label: "X Post", platform: "Twitter/X", icon: Twitter, type: "image", aspectRatio: "16:9", description: "1600x900 + tweet" },
  { id: "twitter-text", label: "X Thread", platform: "Twitter/X", icon: FileText, type: "text", aspectRatio: "3:2", description: "Multi-tweet thread" },
  // ── YouTube ──
  { id: "youtube-thumbnail", label: "YouTube Thumbnail", platform: "YouTube", icon: Youtube, type: "image", aspectRatio: "16:9", description: "1280x720 thumbnail" },
  { id: "youtube-short", label: "YouTube Short", platform: "YouTube", icon: Film, type: "video", aspectRatio: "9:16", description: "1080x1920 short video" },
  // ── Pinterest ──
  { id: "pinterest-pin", label: "Pinterest Pin", platform: "Pinterest", icon: ImageIcon, type: "image", aspectRatio: "2:3", description: "1000x1500 pin" },
];

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#E1306C", LinkedIn: "#0077B5", Facebook: "#1877F2",
  "Twitter/X": "#1DA1F2", TikTok: "#00F2EA", YouTube: "#FF0000",
  Pinterest: "#E60023",
};

/* ── Per-format diversity suffixes to avoid visual repetition across formats ── */
const FORMAT_DIVERSITY: Record<string, string> = {
  "linkedin-post": "Wide landscape composition, professional corporate environment, cool neutral tones, clean negative space on right third.",
  "linkedin-carousel": "Square crop centered subject, editorial grid feel, muted desaturated palette, structured layout.",
  "linkedin-video": "Smooth dolly-in motion, boardroom or modern workspace setting, natural window light.",
  "instagram-post": "Square crop, vibrant warm tones, lifestyle context, soft bokeh background, golden-hour warmth.",
  "instagram-carousel": "Square crop, alternating close-up and wide establishing shots, cohesive color story across slides.",
  "instagram-story": "Vertical 9:16 framing, dramatic top-to-bottom composition, bold saturated colors, dynamic angle.",
  "instagram-reel": "Vertical 9:16 cinematic motion, energetic camera movement, trendy visual transitions.",
  "facebook-post": "Square social-friendly crop, bright daylight tones, approachable and relatable context.",
  "facebook-story": "Vertical 9:16, casual authentic feel, warm ambient lighting, lifestyle context.",
  "facebook-video": "Wide 16:9 cinematic, smooth pan or reveal, warm community-oriented setting.",
  "facebook-ad": "Wide landscape 1.91:1, high-contrast hero shot, clean background, product front-and-center with CTA space.",
  "tiktok-video": "Vertical 9:16 fast-paced energy, trendy Gen-Z aesthetic, bold colors, dynamic quick cuts.",
  "tiktok-image": "Vertical 9:16 eye-catching, bold typography-friendly layout, bright punchy colors.",
  "twitter-post": "Wide 16:9, punchy editorial composition, high contrast, newsworthy visual impact.",
  "twitter-text": "",
  "youtube-thumbnail": "Wide 16:9, dramatic lighting with high contrast, expressive close-up or bold product hero, click-worthy composition.",
  "youtube-short": "Vertical 9:16, fast-reveal cinematic motion, dramatic lighting, attention-grabbing first frame.",
  "pinterest-pin": "Tall 2:3 portrait, aspirational lifestyle flat-lay or styled vignette, soft natural palette, Pinterest-aesthetic.",
};

// Maps ORA platform names → Zernio API platform slugs (frontend side)
const ZERNIO_PLATFORM_MAP_FE: Record<string, string> = {
  LinkedIn: "linkedin", Instagram: "instagram", Facebook: "facebook",
  "Twitter/X": "twitter", Twitter: "twitter", TikTok: "tiktok",
  YouTube: "youtube", Pinterest: "pinterest",
};

// Group formats by platform for UI display
const PLATFORM_GROUPS = [
  { platform: "LinkedIn", icon: Linkedin },
  { platform: "Instagram", icon: Instagram },
  { platform: "Facebook", icon: Facebook },
  { platform: "TikTok", icon: Clapperboard },
  { platform: "Twitter/X", icon: Twitter },
  { platform: "YouTube", icon: Youtube },
  { platform: "Pinterest", icon: ImageIcon },
];

// Platforms available for social connection
const CONNECTABLE_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0077B5" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { id: "twitter", label: "Twitter/X", icon: Twitter, color: "#1DA1F2" },
  { id: "tiktok", label: "TikTok", icon: Clapperboard, color: "#00F2EA" },
  { id: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
  { id: "pinterest", label: "Pinterest", icon: ImageIcon, color: "#E60023" },
];

const VAULT_PILLS = [
  { key: "tone", label: "Tone", icon: MessageSquare },
  { key: "vocabulary", label: "Vocabulary", icon: Type },
  { key: "guardrails", label: "Guardrails", icon: Shield },
  { key: "logo", label: "Logo", icon: BookOpen },
  { key: "colors", label: "Colors", icon: Palette },
  { key: "photoStyle", label: "Photo Style", icon: Camera },
];

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */

export function CampaignLab({ onAssetComplete, onSaveAssetToLibrary }: CampaignLabProps) {
  const auth = useAuth();
  const getAuthToken = useCallback(() => auth.getAuthHeader(), [auth]);

  // ── POST helper: text/plain Content-Type avoids CORS preflight ──
  // Authorization header triggers preflight → Supabase gateway blocks OPTIONS
  // Solution: text/plain + Authorization (simple content-type reduces preflight triggers)
  // If still blocked, the server Deno.serve wrapper guarantees CORS headers on all responses
  const serverPost = useCallback((path: string, bodyData: any, timeoutMs?: number) => {
    const token = getAuthToken();
    const payload = token ? { ...bodyData, _token: token } : bodyData;
    return fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    }).then(res => res.json());
  }, [getAuthToken]);

  // ── GET helper (_token as query param, Authorization for Supabase gateway) ──
  const serverGet = useCallback((path: string, timeoutMs?: number) => {
    const token = getAuthToken();
    const sep = path.includes("?") ? "&" : "?";
    const url = token ? `${API_BASE}${path}${sep}_token=${encodeURIComponent(token)}` : `${API_BASE}${path}`;
    return fetch(url, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: AbortSignal.timeout(timeoutMs || 15_000),
    }).then(r => r.json());
  }, [getAuthToken]);

  // ── Form state ──
  const [refPhotos, setRefPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [productUrls, setProductUrls] = useState("");
  const [brief, setBrief] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [toneOverride, setToneOverride] = useState("");
  const [keyMessages, setKeyMessages] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [contentAngle, setContentAngle] = useState("");
  const [language, setLanguage] = useState("auto");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignDuration, setCampaignDuration] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["linkedin-post", "instagram-post", "instagram-story", "facebook-post", "instagram-reel", "linkedin-video"]);
  const [vault, setVault] = useState<BrandVault | null>(null);
  const [vaultLoading, setVaultLoading] = useState(true);

  // ── Generation state ──
  const [phase, setPhase] = useState<"input" | "generating" | "results">("input");
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showLogoOverlay, setShowLogoOverlay] = useState(false);
  const [retryingTexts, setRetryingTexts] = useState(false);
  const [repromptText, setRepromptText] = useState("");
  const [regeneratingAsset, setRegeneratingAsset] = useState<string | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // ── Calendar + Deploy state ──
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarGenerated, setCalendarGenerated] = useState(false);
  const [deployingAssets, setDeployingAssets] = useState<Record<string, "deploying" | "deployed" | "scheduled" | "skipped" | "error">>({});
  const [deployingAll, setDeployingAll] = useState(false);
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear());
  const [zernioAccounts, setZernioAccounts] = useState<any[]>([]);
  const [zernioLoading, setZernioLoading] = useState(false);
  const zernioLoadedRef = useRef(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);



  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const vaultLoadedRef = useRef(false);

  // Resolved brand logo URL (only shown if toggle is on)
  const rawLogoUrl = logoUrl || vault?.logoUrl || vault?.logo_url || null;
  const brandLogoUrl = showLogoOverlay ? rawLogoUrl : null;

  // ── Fetch Brand Vault on mount via POST /user/init (single call, avoids CORS rate-limit) ──
  useEffect(() => {
    const token = getAuthToken();
    if (!token || vaultLoadedRef.current) return;
    vaultLoadedRef.current = true;
    console.log("[CampaignLab] Loading vault...");
    // Fire-and-forget health check (same pattern as Hub)
    fetch(`${API_BASE}/health`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: AbortSignal.timeout(5_000),
    }).then(r => r.json()).then(d => console.log("[CampaignLab] Server health:", d)).catch(() => {});

    const fetchVault = async (attempt: number) => {
      try {
        // Use GET to avoid CORS preflight (POST with application/json triggers OPTIONS)
        const initUrl = token
          ? `${API_BASE}/user/init?_token=${encodeURIComponent(token)}`
          : `${API_BASE}/user/init`;
        const res = await fetch(initUrl, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(15_000),
        });
        const data = await res.json();
        if (data.vault) {
          const vaultLogo = data.vault.logoUrl || data.vault.logo_url || null;
          console.log(`[CampaignLab] Vault loaded (attempt ${attempt}):`, data.vault.brandName || "unnamed", "logo:", vaultLogo ? vaultLogo.slice(0, 80) : "NONE");
          setVault(data.vault);
          if (vaultLogo) setLogoUrl(vaultLogo);
        } else {
          console.log("[CampaignLab] No vault found");
        }
      } catch (err) {
        console.error(`[CampaignLab] Vault fetch error (attempt ${attempt}):`, err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 3000));
          return fetchVault(attempt + 1);
        }
      }
    };
    fetchVault(1).finally(() => setVaultLoading(false));
  }, [getAuthToken]);

  // ── Photo upload handlers (client-side only — used as visual ref in UI) ──
  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")).slice(0, 10 - refPhotos.length);
    const newPhotos = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setRefPhotos(prev => [...prev, ...newPhotos].slice(0, 10));
  }, [refPhotos.length]);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/")).slice(0, 10 - refPhotos.length);
    const newPhotos = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setRefPhotos(prev => [...prev, ...newPhotos].slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [refPhotos.length]);

  const removePhoto = useCallback((index: number) => {
    setRefPhotos(prev => { URL.revokeObjectURL(prev[index].preview); return prev.filter((_, i) => i !== index); });
  }, []);

  // ── Logo upload (uses vault/upload-logo endpoint) ──
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      if (token) formData.append("_token", token);
      const res = await fetch(`${API_BASE}/vault/upload-logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.logoUrl) {
        setLogoUrl(data.logoUrl);
        toast.success("Logo uploaded");
      } else {
        toast.error(data.error || "Logo upload failed");
      }
    } catch (err) {
      console.error("[CampaignLab] Logo upload error:", err);
      toast.error("Logo upload failed");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }, [getAuthToken]);

  // ── Format toggle ──
  const toggleFormat = useCallback((id: string) => {
    setSelectedFormats(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  }, []);

  /* ═══════════════════════════════════
     GENERATION — V2 PIPELINE (high-fidelity when refs exist, fallback to classic)
     ═══════════════════════════════════ */

  // ── Helper: Resize image to max dimension (avoids Edge Function body limit) ──
  const resizeImage = (file: File, maxDim = 2048): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size < 1_500_000) {
          resolve(file); return;
        }
        if (width > height) {
          if (width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
          "image/jpeg", 0.85
        );
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = URL.createObjectURL(file);
    });
  };

  // ── Upload ref photos ONE-BY-ONE (same pattern as Hub handleRefUpload) ──
  const uploadRefPhotos = async (): Promise<string[]> => {
    if (refPhotos.length === 0) return [];
    console.log(`[CampaignLab] Uploading ${refPhotos.length} ref photos...`);
    const urls: string[] = [];

    for (let i = 0; i < refPhotos.length; i++) {
      try {
        const resized = await resizeImage(refPhotos[i].file);
        const sizeKB = (resized.size / 1024).toFixed(0);
        const fd = new FormData();
        fd.append("file0", resized, refPhotos[i].file.name);
        const tok = getAuthToken();
        if (tok) fd.append("_token", tok);
        // Authorization for gateway, _token in FormData for user auth
        const res = await fetch(`${API_BASE}/campaign/upload-refs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          body: fd,
          signal: AbortSignal.timeout(30_000),
        });
        const data = await res.json();
        if (data.success && data.refs?.length) {
          urls.push(data.refs[0].signedUrl);
          console.log(`[CampaignLab] Ref ${i + 1}/${refPhotos.length} uploaded (${sizeKB}KB)`);
        } else {
          console.warn(`[CampaignLab] Ref ${i + 1}:`, data?.error || "no refs");
        }
      } catch (err: any) {
        console.error(`[CampaignLab] Ref ${i + 1} failed:`, err?.message);
      }
    }
    console.log(`[CampaignLab] Upload: ${urls.length}/${refPhotos.length} refs ready`);
    return urls;
  };

  // ── Helper: Vision Analysis of ref photos → Visual DNA ──
  const analyzeRefs = async (imageUrls: string[]): Promise<any | null> => {
    if (imageUrls.length === 0) return null;
    // Send max 3 images to avoid timeout
    const urls = imageUrls.slice(0, 3);
    console.log(`[CampaignLab] Analyzing ${urls.length} ref images (Vision)...`);
    try {
      const data = await serverPost("/campaign/analyze-refs", {
        imageUrls: urls, brief: brief.slice(0, 500), targetAudience: targetAudience.slice(0, 200),
      }, 30_000);
      if (data.success && data.visualDNA) {
        console.log("[CampaignLab] Visual DNA extracted:", Object.keys(data.visualDNA));
        return data.visualDNA;
      }
      console.warn("[CampaignLab] Vision analysis no DNA:", data.reason || "unknown");
      return null;
    } catch (err: any) {
      console.warn("[CampaignLab] Vision analysis failed:", err?.message);
      return null;
    }
  };

  // ── Helper: Build enriched prompt from Visual DNA ──
  const buildEnrichedPrompt = async (visualDNA: any, platform: string, formatType: string): Promise<string | null> => {
    try {
      const data = await serverPost("/campaign/build-prompt", {
        visualDNA, brief: brief.slice(0, 500), platform, formatType, targetAudience: targetAudience.slice(0, 200),
      }, 10_000);
      return data.success ? data.prompt : null;
    } catch { return null; }
  };

  // ── Helper: detect carousel format IDs ──
  const isCarouselFormat = (formatId: string) => formatId.includes("carousel");

  // ── Helper: parse carousel slides from caption text ──
  const parseCarouselSlides = (text: string): CarouselSlide[] => {
    if (!text) return [];
    // Try to split by "Slide N:" patterns
    const slidePattern = /Slide\s*\d+\s*[:.\-]\s*/gi;
    const parts = text.split(slidePattern).filter(s => s.trim());
    if (parts.length >= 3) return parts.map(t => ({ text: t.trim(), status: "pending" as const }));
    // Fallback: split by numbered lines "1." "2." etc.
    const numPattern = /^\d+[.)]\s*/gm;
    const numParts = text.split(numPattern).filter(s => s.trim());
    if (numParts.length >= 3) return numParts.map(t => ({ text: t.trim(), status: "pending" as const }));
    // Fallback: split by double newlines
    const nlParts = text.split(/\n\n+/).filter(s => s.trim());
    if (nlParts.length >= 3) return nlParts.map(t => ({ text: t.trim(), status: "pending" as const }));
    // Last resort: treat entire text as one slide
    return [{ text: text.trim(), status: "pending" as const }];
  };

  // ── Photorealistic suffix for all campaign image prompts ──
  // V2 pipeline uses FAL Flux img2img at strength=0.85 — generates COMPLETELY NEW scenes from the brief.
  // The ref image seeds the product shape/colors (15% preserved), prompt drives the new scene.
  const REALISM_SUFFIX = ". Photorealistic commercial photography, natural lighting. No text overlay, no watermark.";

  // ── Helper: Generate image via GET routes (CORS-safe, no preflight issues) ──
  // Uses /generate/image-ref-via-get with FAL Flux img2img (strength=0.85, preserveContent) when refs exist.
  // Falls back to /generate/image-via-get when no ref.
  const generateImageViaHub = async (prompt: string, aspectRatio: string, imageRefUrl: string | null, models: string[] = ["photon-1"]): Promise<{ imageUrl: string; index: number }[]> => {
    try {
      const realisticPrompt = prompt + REALISM_SUFFIX;
      if (imageRefUrl && !imageRefUrl.startsWith("data:")) {
        // ── GET route with image ref — FAL Flux img2img (strength=0.25, preserveContent) ──
        const encodedPrompt = encodeURIComponent(realisticPrompt.slice(0, 400));
        const encodedRef = encodeURIComponent(imageRefUrl);
        const url = `${API_BASE}/generate/image-ref-via-get?prompt=${encodedPrompt}&models=${encodeURIComponent("photon-1")}&imageRefUrl=${encodedRef}&strength=0.80&mode=content&aspectRatio=${encodeURIComponent(aspectRatio)}`;
        console.log(`[CampaignLab] Image GET+ref: ar=${aspectRatio}, strength=0.80 (FAL img2img — new scene + brand name in prompt), ref=${imageRefUrl.slice(0, 60)}`);
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(140_000),
        });
        const data = await res.json();
        if (data.success && data.results) {
          const ok = data.results
            .filter((r: any) => r.success && r.result?.imageUrl)
            .map((r: any, i: number) => ({ imageUrl: r.result.imageUrl, index: i }));
          if (ok.length > 0) return ok;
        }
        console.warn("[CampaignLab] GET+ref returned no images");
      }
      // No ref OR ref was base64 (can't pass in URL) → standard generation
      const encodedPrompt = encodeURIComponent(realisticPrompt.slice(0, 600));
      const url = `${API_BASE}/generate/image-via-get?prompt=${encodedPrompt}&models=${encodeURIComponent(models[0] || "photon-1")}&aspectRatio=${encodeURIComponent(aspectRatio)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(180_000),
      });
      const data = await res.json();
      if (data.success && data.results?.[0]?.success && data.results[0].result.imageUrl) {
        return [{ imageUrl: data.results[0].result.imageUrl, index: 0 }];
      }
      return [];
    } catch (err: any) {
      console.error("[CampaignLab] Image generation failed:", err?.message);
      return [];
    }
  };

  // ── Helper: Select best image via Vision scoring ──
  const selectBestImage = async (referenceUrl: string, candidateUrls: string[]): Promise<number> => {
    if (candidateUrls.length <= 1) return 0;
    try {
      const data = await serverPost("/campaign/select-best", {
        referenceUrl, candidateUrls,
      }, 25_000);
      if (data.success && typeof data.bestIndex === "number") {
        console.log(`[CampaignLab] Vision selected best=${data.bestIndex}, scores=${JSON.stringify(data.scores?.map((s: any) => s.total))}`);
        return data.bestIndex;
      }
      return 0;
    } catch { return 0; }
  };

  // ── Generate text copy via POST (no URL length limit) ──
  const generateCopy = async (formats: FormatOption[], briefShort: string, urlsShort: string): Promise<Record<string, any>> => {
    try {
      const formatIds = formats.map(f => f.id).join(",");
      const postBody = {
        brief: briefShort.slice(0, 2000),
        targetAudience: targetAudience.slice(0, 300),
        productUrls: urlsShort.slice(0, 500),
        formats: formatIds,
        campaignObjective: campaignObjective || "",
        toneOfVoice: toneOverride || "",
        contentAngle: contentAngle.trim().slice(0, 500),
        keyMessages: keyMessages.trim().slice(0, 800),
        callToAction: ctaText.trim().slice(0, 300),
        language: language || "auto",
        campaignStartDate: campaignStartDate || "",
        campaignDuration: campaignDuration || "",
      };
      const url = `${API_BASE}/campaign/generate-texts`;
      const token = getAuthToken();
      const fullBody = { ...postBody, _token: token || undefined };
      console.log(`[CampaignLab] POST texts: ${formats.length} formats, brief=${briefShort.length}c, body=${JSON.stringify(fullBody).length}c`);

      // text/plain Content-Type avoids CORS preflight (application/json triggers OPTIONS)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(fullBody),
        signal: AbortSignal.timeout(120_000),
      });
      const rawText = await res.text();
      console.log(`[CampaignLab] Text response: HTTP ${res.status}, ${rawText.length}c, body=${rawText.slice(0, 400)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 200)}`);
      const data = JSON.parse(rawText);
      if (data.success && data.copyMap && Object.keys(data.copyMap).length > 0) {
        console.log(`[CampaignLab] Text OK: ${data.formatCount} formats, provider=${data.provider}, ${data.latencyMs}ms, keys=[${Object.keys(data.copyMap).join(",")}]`);
        return data.copyMap;
      }
      console.warn("[CampaignLab] Text returned empty copyMap:", data.error || "no keys");
    } catch (err: any) {
      console.error("[CampaignLab] Text FAILED:", err?.name, err?.message, err);
      // Auto-diagnostic
      try {
        const diagRes = await fetch(`${API_BASE}/test-campaign-text`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: AbortSignal.timeout(15_000),
        });
        const diagData = await diagRes.json();
        console.log("[CampaignLab] DIAGNOSTIC:", JSON.stringify(diagData, null, 2));
      } catch (de: any) {
        console.error("[CampaignLab] DIAGNOSTIC failed too:", de?.name, de?.message);
      }
    }

    console.error("[CampaignLab] Text generation failed — returning empty copyMap");
    return {};
  };

  // ── Helper: Classic image generation (fallback — same as before) ──
  const generateImageClassic = async (fmt: FormatOption, imgPrompt: string) => {
    const arMap: Record<string, string> = { "1:1": "1:1", "1.91:1": "16:9", "9:16": "9:16", "16:9": "16:9" };
    const ar = arMap[fmt.aspectRatio] || "1:1";
    const encodedPrompt = encodeURIComponent(imgPrompt.slice(0, 400));
    const imageGetUrl = `${API_BASE}/generate/image-via-get?prompt=${encodedPrompt}&models=${encodeURIComponent("photon-1")}&aspectRatio=${ar}`;
    console.log(`[CampaignLab] Image GET [${fmt.id}]:`, imageGetUrl.slice(0, 150));
    const res = await fetch(imageGetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: AbortSignal.timeout(180_000),
    });
    const rawText = await res.text();
    const data = JSON.parse(rawText);
    if (data.success && data.results?.[0]?.success && data.results[0].result.imageUrl) {
      return data.results[0].result.imageUrl;
    }
    throw new Error(data.results?.[0]?.error || data.error || "Image generation failed");
  };

  // ── Helper: Video generation with optional first-frame image ──
  const generateVideoWithKeyframe = async (fmt: FormatOption, vidPrompt: string, keyframeImageUrl?: string) => {
    const params = new URLSearchParams({ prompt: vidPrompt.slice(0, 400), model: "ray-flash-2" });
    if (keyframeImageUrl) params.set("imageUrl", keyframeImageUrl);
    const startUrl = `${API_BASE}/generate/video-start?${params.toString()}`;
    console.log(`[CampaignLab] Video START [${fmt.id}]: hasKeyframe=${!!keyframeImageUrl}`, startUrl.slice(0, 150));

    const startRes = await fetch(startUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const startData = JSON.parse(await startRes.text());
    if (!startData.success || !startData.generationId) throw new Error(startData.error || "Failed to start video");

    const generationId = startData.generationId;
    console.log(`[CampaignLab] Video [${fmt.id}] submitted:`, generationId);

    // Poll
    const MAX_POLLS = 60;
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise(r => setTimeout(r, 5_000));
      try {
        const statusUrl = `${API_BASE}/generate/video-status?id=${encodeURIComponent(generationId)}`;
        const statusRes = await fetch(statusUrl, { method: "GET", headers: { Authorization: `Bearer ${publicAnonKey}` }, signal: AbortSignal.timeout(10_000) });
        const statusData = JSON.parse(await statusRes.text());
        console.log(`[CampaignLab] Video [${fmt.id}] poll #${poll + 1}: state=${statusData.state || statusData.status}`);
        if ((statusData.state === "completed" || statusData.status === "completed") && statusData.videoUrl) {
          return statusData.videoUrl;
        }
        if (statusData.state === "failed" || statusData.status === "failed") {
          throw new Error(statusData.error || "Video generation failed");
        }
      } catch (pollErr: any) {
        if (pollErr?.message?.includes("failed")) throw pollErr;
      }
    }
    throw new Error("Video timeout (300s)");
  };

  const handleGenerate = async () => {
    if (!brief.trim() && !productUrls.trim()) {
      toast.error("Add a brief or product URL to start");
      return;
    }
    if (selectedFormats.length === 0) {
      toast.error("Select at least one format");
      return;
    }

    setPhase("generating");
    setGenerationProgress(0);

    const formats = FORMAT_OPTIONS.filter(f => selectedFormats.includes(f.id));
    const placeholders: GeneratedAsset[] = formats.map(f => ({
      id: `asset-${f.id}-${Date.now()}`,
      formatId: f.id,
      label: f.label,
      platform: f.platform,
      type: f.type,
      status: "pending",
    }));
    setAssets(placeholders);

    const hasRefs = refPhotos.length > 0;
    // Compose enriched brief from all fields
    const enrichedParts: string[] = [];
    if (brief.trim()) enrichedParts.push(brief.trim());
    if (campaignObjective) enrichedParts.push(`CAMPAIGN OBJECTIVE: ${campaignObjective}`);
    if (toneOverride) enrichedParts.push(`TONE OF VOICE: ${toneOverride}`);
    if (contentAngle.trim()) enrichedParts.push(`CONTENT ANGLE / HOOK: ${contentAngle.trim()}`);
    if (keyMessages.trim()) enrichedParts.push(`KEY MESSAGES:\n${keyMessages.trim()}`);
    if (ctaText.trim()) enrichedParts.push(`CALL TO ACTION: ${ctaText.trim()}`);
    if (language !== "auto") enrichedParts.push(`LANGUAGE: ${language}`);
    if (campaignStartDate) enrichedParts.push(`CAMPAIGN START DATE: ${campaignStartDate}`);
    if (campaignDuration) enrichedParts.push(`CAMPAIGN DURATION: ${campaignDuration}`);
    const briefShort = enrichedParts.join("\n\n").slice(0, 2000);
    const urlsShort = (productUrls || "").slice(0, 300);

    try {
      // ═══ PHASE 0: Upload ref photos (if any) ═══
      let refSignedUrls: string[] = [];
      if (hasRefs) {
        setGenerationProgress(5);
        refSignedUrls = await uploadRefPhotos();
        console.log(`[CampaignLab] ${refSignedUrls.length} ref URLs obtained`);
      }

      const useV2Pipeline = refSignedUrls.length > 0;
      console.log(`[CampaignLab] Pipeline: ${useV2Pipeline ? "V2 (high-fidelity)" : "CLASSIC (text-only)"}, ${refSignedUrls.length} refs`);

      // ═══ PHASE 1: Vision Analysis + Text Copy in PARALLEL ═══
      setGenerationProgress(10);
      const [visualDNA, copyMap] = await Promise.all([
        useV2Pipeline ? analyzeRefs(refSignedUrls) : Promise.resolve(null),
        generateCopy(formats, briefShort, urlsShort),
      ]);
      setGenerationProgress(35);

      // Build ultra-precise product description from Visual DNA for image/video prompts
      // Visual DNA keys from GPT-4o Vision: subject, environment, color_palette, lighting,
      // composition, texture, mood, photography_style, post_processing, distinctive_elements
      let productDescription = "";
      if (visualDNA) {
        console.log("[CampaignLab] Visual DNA keys:", Object.keys(visualDNA));
        const dna = visualDNA;
        const parts: string[] = [];
        // Priority 1: SUBJECT is the most critical — hyper-specific product description
        if (dna.subject) parts.push(`SUBJECT: ${dna.subject}`);
        // Priority 2: DISTINCTIVE_ELEMENTS — unique features that MUST be reproduced
        if (dna.distinctive_elements) parts.push(`MUST REPRODUCE: ${dna.distinctive_elements}`);
        // Priority 3: Visual context
        if (dna.environment) parts.push(`Environment: ${dna.environment}`);
        if (dna.color_palette) parts.push(`Colors: ${dna.color_palette}`);
        if (dna.lighting) parts.push(`Lighting: ${dna.lighting}`);
        if (dna.texture) parts.push(`Texture: ${dna.texture}`);
        if (dna.composition) parts.push(`Composition: ${dna.composition}`);
        if (dna.photography_style) parts.push(`Style: ${dna.photography_style}`);
        if (dna.mood) parts.push(`Mood: ${dna.mood}`);
        if (dna.post_processing) parts.push(`Post-processing: ${dna.post_processing}`);
        // Fallback: use raw_analysis if no structured fields
        if (parts.length === 0 && dna.raw_analysis) {
          const raw = typeof dna.raw_analysis === "string" ? dna.raw_analysis : JSON.stringify(dna.raw_analysis);
          parts.push(raw.slice(0, 600));
        }
        if (parts.length > 0) {
          productDescription = `[PRODUCT REFERENCE — reproduce EXACTLY as described, do NOT alter the product]: ${parts.join(". ")}. `;
          console.log(`[CampaignLab] Product description (${productDescription.length}c): ${productDescription.slice(0, 300)}...`);
        }
      }
      const textSuccess = Object.keys(copyMap).length > 0;
      if (!textSuccess) {
        toast.error("Text generation failed. Images will still generate.");
      }
      console.log("[CampaignLab] copyMap keys:", Object.keys(copyMap));

      // ═══ PHASE 2: Update assets with copy data ═══
      setAssets(prev => prev.map(a => {
        const fc = copyMap[a.formatId] || {};
        const captionText = fc.caption || fc.text || fc.copy || fc.body || fc.content || fc.message || "";
        const hashtagsText = typeof fc.hashtags === "string" ? fc.hashtags : Array.isArray(fc.hashtags) ? fc.hashtags.join(" ") : "";
        const subjectText = fc.subject || "";
        const hasCopy = !!(captionText || fc.headline);

        // Parse carousel slides for carousel formats
        let carouselSlides: CarouselSlide[] | undefined;
        if (isCarouselFormat(a.formatId) && captionText) {
          // If API returned slides array directly, use it
          if (Array.isArray(fc.slides) && fc.slides.length > 0) {
            carouselSlides = fc.slides.map((s: any) => ({
              text: typeof s === "string" ? s : (s.text || s.caption || ""),
              imagePrompt: s.imagePrompt || "",
              status: "pending" as const,
            }));
          } else {
            carouselSlides = parseCarouselSlides(captionText);
          }
          // Generate image prompts for each slide based on slide content
          carouselSlides = carouselSlides.map((slide, idx) => ({
            ...slide,
            imagePrompt: slide.imagePrompt || `Slide ${idx + 1} for ${a.platform} carousel: ${slide.text.slice(0, 120)}. Professional brand visual matching the slide content.`,
          }));
        }

        return {
          ...a,
          caption: captionText,
          copy: captionText,
          hashtags: hashtagsText,
          subject: subjectText,
          headline: fc.headline || "",
          ctaText: fc.ctaText || fc.cta || "",
          features: fc.features || [],
          imagePrompt: fc.imagePrompt || "",
          videoPrompt: fc.videoPrompt || "",
          carouselSlides,
          status: a.type === "text"
            ? (hasCopy ? "ready" as const : "error" as const)
            : "generating" as const,
          error: (a.type === "text" && !hasCopy) ? "Text generation failed" : undefined,
        };
      }));

      // ═══ PHASE 3: IMAGE GENERATION ═══
      const imageFormats = formats.filter(f => f.type === "image");
      const generatedImageUrls: Record<string, string> = {}; // formatId → best imageUrl (for video keyframes)

      if (imageFormats.length > 0) {
        console.log(`[CampaignLab] Image generation: ${imageFormats.length} formats, v2=${useV2Pipeline}`);
        setGenerationProgress(40);

        await Promise.all(imageFormats.map(async (fmt) => {
          try {
            const fc = copyMap[fmt.id] || {};
            const arMap: Record<string, string> = { "1:1": "1:1", "1.91:1": "16:9", "9:16": "9:16", "16:9": "16:9", "2:3": "2:3" };
            const ar = arMap[fmt.aspectRatio] || "1:1";

            // ── CAROUSEL: generate one image per slide ──
            if (isCarouselFormat(fmt.id)) {
              // Build slides from copyMap directly (reliable, no state dependency)
              let currentSlides: CarouselSlide[] = [];
              const captionText = fc.caption || fc.text || fc.copy || fc.body || fc.content || fc.message || "";
              if (Array.isArray(fc.slides) && fc.slides.length > 0) {
                currentSlides = fc.slides.map((s: any, idx: number) => ({
                  text: typeof s === "string" ? s : (s.text || s.caption || ""),
                  imagePrompt: s.imagePrompt || `Slide ${idx + 1} for ${fmt.platform} carousel: ${(typeof s === "string" ? s : (s.text || "")).slice(0, 120)}. Professional brand visual.`,
                  status: "pending" as const,
                }));
              } else if (captionText) {
                currentSlides = parseCarouselSlides(captionText).map((s, idx) => ({
                  ...s,
                  imagePrompt: `Slide ${idx + 1} for ${fmt.platform} carousel: ${s.text.slice(0, 120)}. Professional brand visual matching the slide content.`,
                }));
              }
              if (currentSlides.length === 0) currentSlides = [{ text: briefShort, status: "pending" }];

              console.log(`[CampaignLab] Carousel [${fmt.id}]: ${currentSlides.length} slides to illustrate`);

              const updatedSlides = [...currentSlides];
              // Generate images for each slide (in parallel batches of 3 to not overwhelm)
              const batchSize = 3;
              for (let batchStart = 0; batchStart < updatedSlides.length; batchStart += batchSize) {
                const batch = updatedSlides.slice(batchStart, batchStart + batchSize);
                await Promise.all(batch.map(async (slide, batchIdx) => {
                  const slideIdx = batchStart + batchIdx;
                  const carouselDiversity = FORMAT_DIVERSITY[fmt.id] || "";
                  // V2: FAL img2img at 0.75 — describe a vivid NEW scene for each slide
                  const slideScene = slide.imagePrompt || `${slide.text.slice(0, 120)}. ${fmt.platform} visual.`;
                  const slideBriefCtx = contentAngle.trim() ? `Campaign context: ${contentAngle.trim().slice(0, 80)}. ` : (brief.trim() ? `Campaign: ${brief.trim().slice(0, 80)}. ` : "");
                  const slidePrompt = useV2Pipeline && refSignedUrls.length > 0
                    ? `${slideBriefCtx}${slideScene.slice(0, 200)}.${carouselDiversity ? ` ${carouselDiversity}` : ""} Photorealistic, new scene, professional lighting.`
                    : productDescription + slideScene + ` ${briefShort.slice(0, 100)}.` + (carouselDiversity ? ` ${carouselDiversity}` : "") + REALISM_SUFFIX;
                  try {
                    if (useV2Pipeline && refSignedUrls.length > 0) {
                      const refUrl = refSignedUrls[slideIdx % refSignedUrls.length];
                      const candidates = await generateImageViaHub(slidePrompt, ar, refUrl, ["photon-1"]);
                      if (candidates.length > 0) {
                        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], imageUrl: candidates[0].imageUrl, status: "ready" };
                      } else {
                        const url = await generateImageClassic(fmt, slidePrompt);
                        updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], imageUrl: url, status: "ready" };
                      }
                    } else {
                      const url = await generateImageClassic(fmt, slidePrompt);
                      updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], imageUrl: url, status: "ready" };
                    }
                    console.log(`[CampaignLab] Carousel [${fmt.id}] slide ${slideIdx + 1}/${updatedSlides.length} OK`);
                  } catch (slideErr: any) {
                    console.error(`[CampaignLab] Carousel [${fmt.id}] slide ${slideIdx + 1} error:`, slideErr?.message);
                    updatedSlides[slideIdx] = { ...updatedSlides[slideIdx], status: "error" };
                  }
                  // Update asset with progress
                  setAssets(prev => prev.map(a => a.formatId === fmt.id ? {
                    ...a, carouselSlides: [...updatedSlides],
                    imageUrl: updatedSlides.find(s => s.imageUrl)?.imageUrl || a.imageUrl,
                  } : a));
                }));
              }

              const allDone = updatedSlides.every(s => s.status === "ready" || s.status === "error");
              const firstImageUrl = updatedSlides.find(s => s.imageUrl)?.imageUrl;
              setAssets(prev => prev.map(a => a.formatId === fmt.id ? {
                ...a, status: allDone ? "ready" : "generating",
                carouselSlides: updatedSlides,
                imageUrl: firstImageUrl || a.imageUrl,
                model: "photon-1",
              } : a));
              if (firstImageUrl) generatedImageUrls[fmt.id] = firstImageUrl;
              console.log(`[CampaignLab] Carousel [${fmt.id}] complete: ${updatedSlides.filter(s => s.imageUrl).length}/${updatedSlides.length} slides`);
              return;
            }

            // ── SINGLE IMAGE (non-carousel) ──
            if (useV2Pipeline) {
              // V2: FAL Flux img2img at strength=0.85 — generates a COMPLETELY NEW scene from the brief.
              // The prompt must describe a vivid, specific NEW environment/situation so the model
              // transforms the background while the product's shape/colors guide what stays.
              const diversitySuffix = FORMAT_DIVERSITY[fmt.id] || "";
              const sceneContext = fc.imagePrompt
                ? fc.imagePrompt.trim().slice(0, 300)
                : `Product in a scene that illustrates: ${briefShort.slice(0, 200)}. ${fmt.platform} format.`;
              const briefContext = contentAngle.trim() ? `Campaign context: ${contentAngle.trim().slice(0, 100)}. ` : (brief.trim() ? `Campaign: ${brief.trim().slice(0, 100)}. ` : "");
              const finalPrompt = `${briefContext}${sceneContext}. ${diversitySuffix} Photorealistic commercial photography, new environment, professional lighting.`;

              const fmtIdx = imageFormats.indexOf(fmt);
              const refUrl = refSignedUrls.length > 0
                ? refSignedUrls[fmtIdx % refSignedUrls.length]
                : null;

              console.log(`[CampaignLab] V2 Image [${fmt.id}]: ref=${refUrl ? `#${(fmtIdx % refSignedUrls.length) + 1}/${refSignedUrls.length}` : "NONE"}, prompt=${finalPrompt.slice(0, 80)}...`);

              const candidates = await generateImageViaHub(finalPrompt, ar, refUrl, ["photon-1"]);

              if (candidates.length === 0) {
                console.warn(`[CampaignLab] V2 Hub failed for [${fmt.id}], falling back to classic`);
                const classicUrl = await generateImageClassic(fmt, finalPrompt + REALISM_SUFFIX);
                setAssets(prev => prev.map(a => a.formatId === fmt.id ? { ...a, status: "ready", imageUrl: classicUrl, model: "photon-1" } : a));
                generatedImageUrls[fmt.id] = classicUrl;
                return;
              }

              const bestUrl = candidates[0].imageUrl;

              setAssets(prev => prev.map(a =>
                a.formatId === fmt.id ? { ...a, status: "ready", imageUrl: bestUrl, model: "photon-1-v2" } : a
              ));
              generatedImageUrls[fmt.id] = bestUrl;
              console.log(`[CampaignLab] V2 Image [${fmt.id}] OK:`, bestUrl.slice(0, 60));

            } else {
              const diversitySuffix = FORMAT_DIVERSITY[fmt.id] || "";
              const imgPrompt = (fc.imagePrompt || `Professional ${fmt.platform} post. ${briefShort.slice(0, 120)}. Cinematic brand photography, no text.`) + (diversitySuffix ? ` ${diversitySuffix}` : "") + REALISM_SUFFIX;
              const classicUrl = await generateImageClassic(fmt, imgPrompt);
              setAssets(prev => prev.map(a =>
                a.formatId === fmt.id ? { ...a, status: "ready", imageUrl: classicUrl, model: "photon-1" } : a
              ));
              generatedImageUrls[fmt.id] = classicUrl;
              console.log(`[CampaignLab] Classic Image [${fmt.id}] OK:`, classicUrl.slice(0, 60));
            }
          } catch (err: any) {
            const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
            console.error(`[CampaignLab] Image [${fmt.id}] error:`, err?.message);
            setAssets(prev => prev.map(a =>
              a.formatId === fmt.id ? { ...a, status: "error", error: isTimeout ? "Timed out (180s)" : String(err?.message || err) } : a
            ));
          }
          setGenerationProgress(prev => Math.min(prev + Math.floor(40 / imageFormats.length), 90));
        }));
      }

      // ═══ PHASE 4: VIDEO GENERATION (with keyframe from best image) ═══
      const videoFormats = formats.filter(f => f.type === "video");

      // Switch to results — images + text done. Videos update live.
      setGenerationProgress(100);
      setPhase("results");
      toast.success(`Campaign generated: ${formats.length} assets${videoFormats.length > 0 ? ` (${videoFormats.length} videos still rendering...)` : ""}`);

      if (videoFormats.length > 0) {
        console.log(`[CampaignLab] Video generation: ${videoFormats.length} formats (background)`);
        await Promise.all(videoFormats.map(async (fmt) => {
          try {
            const fc = copyMap[fmt.id] || {};
            const vidDiversity = FORMAT_DIVERSITY[fmt.id] || "";
            const vidPrompt = productDescription + (fc.videoPrompt || fc.imagePrompt || `Cinematic video. ${briefShort.slice(0, 120)}. Smooth motion.`) + (vidDiversity ? ` ${vidDiversity}` : "");

            // ── Find best keyframe image for video: PRIORITIZE ref photos for product fidelity ──
            let keyframeUrl: string | undefined;

            // Priority 1: Use ref photo directly (best for product fidelity)
            if (refSignedUrls.length > 0) {
              const vidIdx = videoFormats.indexOf(fmt);
              keyframeUrl = refSignedUrls[vidIdx % refSignedUrls.length];
              console.log(`[CampaignLab] Video [${fmt.id}]: using ref photo #${(vidIdx % refSignedUrls.length) + 1} as keyframe (product fidelity)`);
            }

            // Priority 2: Same-platform generated image
            if (!keyframeUrl) {
              const samePlatformImage = Object.entries(generatedImageUrls).find(([fid]) => {
                const f = FORMAT_OPTIONS.find(fo => fo.id === fid);
                return f?.platform === fmt.platform;
              });
              if (samePlatformImage) {
                keyframeUrl = samePlatformImage[1];
                console.log(`[CampaignLab] Video [${fmt.id}]: using same-platform image as keyframe`);
              }
            }

            // Priority 3: Any available generated image
            if (!keyframeUrl) {
              const anyImage = Object.values(generatedImageUrls)[0];
              if (anyImage) {
                keyframeUrl = anyImage;
                console.log(`[CampaignLab] Video [${fmt.id}]: using first available image as keyframe`);
              }
            }

            const videoUrl = await generateVideoWithKeyframe(fmt, vidPrompt, keyframeUrl);
            setAssets(prev => prev.map(a =>
              a.formatId === fmt.id ? { ...a, status: "ready", videoUrl, model: "ray-flash-2" } : a
            ));
          } catch (err: any) {
            console.error(`[CampaignLab] Video [${fmt.id}] error:`, err?.message);
            setAssets(prev => prev.map(a =>
              a.formatId === fmt.id ? { ...a, status: "error", error: err?.message || "Video failed" } : a
            ));
          }
        }));
      }

    } catch (err: any) {
      console.error("[CampaignLab] Generation error:", err);
      toast.error(err.message || "Campaign generation failed");
      setPhase("input");
    }
  };

  // ── Save asset to library ──
  const handleSaveAsset = (asset: GeneratedAsset) => {
    if (!onSaveAssetToLibrary) return;
    onSaveAssetToLibrary({
      id: asset.id,
      type: asset.type,
      imageUrl: asset.imageUrl,
      videoUrl: asset.videoUrl,
      prompt: asset.copy || brief,
      model: asset.model || "gpt-4o",
      campaignTheme: brief,
      copy: asset.copy,
      caption: asset.caption,
      hashtags: asset.hashtags,
      platform: asset.platform,
      formatName: asset.label,
      subject: asset.subject,
      headline: asset.headline,
      ctaText: asset.ctaText,
      features: asset.features,
      imagePrompt: asset.imagePrompt,
      videoPrompt: asset.videoPrompt,
    });
  };

  // ── Download asset ──
  const handleDownload = async (asset: GeneratedAsset) => {
    const url = asset.imageUrl || asset.videoUrl;
    if (url) {
      // External CDN URLs (Luma, FAL, etc.) don't support CORS fetch — open in new tab
      // For Supabase-hosted URLs, try blob download first
      const isSupabaseUrl = url.includes("supabase.co");
      if (isSupabaseUrl) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `ora-${asset.formatId}-${Date.now()}.${asset.type === "video" ? "mp4" : "png"}`;
          a.click();
          URL.revokeObjectURL(a.href);
          return;
        } catch { /* fall through to window.open */ }
      }
      window.open(url, "_blank");
    } else if (asset.copy) {
      const blob = new Blob([`${asset.caption || ""}\n\n${asset.hashtags || ""}`], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ora-${asset.formatId}-${Date.now()}.txt`;
      a.click();
    }
  };

  // ── Retry text generation for failed text assets ──
  const retryTextGeneration = async () => {
    if (retryingTexts) return;
    setRetryingTexts(true);
    toast("Retrying text generation...");
    try {
      const textAssets = assets.filter(a => a.type === "text" || (!a.caption && !a.copy));
      const formats = textAssets
        .map(a => FORMAT_OPTIONS.find(f => f.id === a.formatId))
        .filter(Boolean) as FormatOption[];
      if (formats.length === 0) {
        // Retry all formats
        const allFmtIds = assets.map(a => a.formatId);
        formats.push(...FORMAT_OPTIONS.filter(f => allFmtIds.includes(f.id)));
      }
      const briefShort = (brief || "").slice(0, 800);
      const urlsShort = (productUrls || "").slice(0, 300);
      const copyMap = await generateCopy(formats, briefShort, urlsShort);
      const textOk = Object.keys(copyMap).length > 0;
      if (textOk) {
        setAssets(prev => prev.map(a => {
          const fc = copyMap[a.formatId] || {};
          const captionText = fc.caption || fc.text || fc.copy || fc.body || fc.content || fc.message || "";
          const hashtagsText = typeof fc.hashtags === "string" ? fc.hashtags : Array.isArray(fc.hashtags) ? fc.hashtags.join(" ") : "";
          const hasCopy = !!(captionText || fc.headline);
          if (!hasCopy && a.status === "ready" && (a.caption || a.copy)) return a; // keep existing good data
          return {
            ...a,
            caption: captionText || a.caption || "",
            copy: captionText || a.copy || "",
            hashtags: hashtagsText || a.hashtags || "",
            subject: fc.subject || a.subject || "",
            headline: fc.headline || a.headline || "",
            ctaText: fc.ctaText || fc.cta || a.ctaText || "",
            features: fc.features || a.features || [],
            imagePrompt: fc.imagePrompt || a.imagePrompt || "",
            videoPrompt: fc.videoPrompt || a.videoPrompt || "",
            status: a.type === "text" ? (hasCopy ? "ready" as const : a.status) : a.status,
            error: (a.type === "text" && hasCopy) ? undefined : a.error,
          };
        }));
        toast.success(`Text generated: ${Object.keys(copyMap).length} formats`);
      } else {
        toast.error("Text generation failed again. Check console for details.");
      }
    } catch (err: any) {
      console.error("[CampaignLab] Retry text failed:", err);
      toast.error(`Retry failed: ${err?.message || "unknown error"}`);
    } finally {
      setRetryingTexts(false);
    }
  };

  // ── Regenerate a single asset with custom prompt (re-prompt) ──
  const handleRegenerateAsset = async (asset: GeneratedAsset, customPrompt: string) => {
    if (!customPrompt.trim() || regeneratingAsset) return;
    setRegeneratingAsset(asset.formatId);
    const fmt = FORMAT_OPTIONS.find(f => f.id === asset.formatId);
    if (!fmt) { setRegeneratingAsset(null); return; }
    const diversitySuffix = FORMAT_DIVERSITY[fmt.id] || "";
    const fullPrompt = customPrompt.trim() + (diversitySuffix ? ` ${diversitySuffix}` : "");

    try {
      if (asset.type === "image" || (asset.type !== "video" && asset.type !== "text")) {
        const arMap: Record<string, string> = { "1:1": "1:1", "1.91:1": "16:9", "9:16": "9:16", "16:9": "16:9", "2:3": "2:3" };
        const ar = arMap[fmt.aspectRatio] || "1:1";
        toast("Regenerating image...");
        const results = await generateImageViaHub(fullPrompt, ar, null, ["photon-1"]);
        if (results.length > 0) {
          setAssets(prev => prev.map(a => a.formatId === asset.formatId ? { ...a, imageUrl: results[0].imageUrl, imagePrompt: customPrompt } : a));
          setSelectedAsset(prev => prev && prev.formatId === asset.formatId ? { ...prev, imageUrl: results[0].imageUrl, imagePrompt: customPrompt } : prev);
          toast.success("Image regenerated");
        } else {
          const classicUrl = await generateImageClassic(fmt, fullPrompt + REALISM_SUFFIX);
          setAssets(prev => prev.map(a => a.formatId === asset.formatId ? { ...a, imageUrl: classicUrl, imagePrompt: customPrompt } : a));
          setSelectedAsset(prev => prev && prev.formatId === asset.formatId ? { ...prev, imageUrl: classicUrl, imagePrompt: customPrompt } : prev);
          toast.success("Image regenerated (fallback)");
        }
      } else if (asset.type === "video") {
        toast("Regenerating video (this may take a few minutes)...");
        const videoUrl = await generateVideoWithKeyframe(fmt, fullPrompt + ". " + diversitySuffix, undefined);
        setAssets(prev => prev.map(a => a.formatId === asset.formatId ? { ...a, videoUrl, videoPrompt: customPrompt } : a));
        setSelectedAsset(prev => prev && prev.formatId === asset.formatId ? { ...prev, videoUrl, videoPrompt: customPrompt } : prev);
        toast.success("Video regenerated");
      }
    } catch (err: any) {
      console.error("[CampaignLab] Regenerate error:", err);
      toast.error(`Regeneration failed: ${err?.message || "Unknown error"}`);
    } finally {
      setRegeneratingAsset(null);
      setRepromptText("");
    }
  };

  // ── Save entire campaign to Library ──
  const handleSaveCampaign = async () => {
    if (savingCampaign) return;
    setSavingCampaign(true);
    try {
      const readyAssets = assets.filter(a => a.status === "ready");
      if (readyAssets.length === 0) { toast.error("No ready assets to save"); setSavingCampaign(false); return; }
      const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const campaignItem = {
        id: campaignId,
        type: "campaign",
        title: brief.trim().slice(0, 100) || "Untitled Campaign",
        brief: brief.trim(),
        objective: campaignObjective,
        tone: toneOverride,
        language,
        platforms: [...new Set(readyAssets.map(a => a.platform))],
        formatCount: readyAssets.length,
        thumbnail: readyAssets.find(a => a.imageUrl)?.imageUrl || "",
        assets: readyAssets.map(a => ({
          formatId: a.formatId,
          label: a.label,
          platform: a.platform,
          type: a.type,
          imageUrl: a.imageUrl || "",
          videoUrl: a.videoUrl || "",
          copy: a.copy || a.caption || "",
          caption: a.caption || "",
          hashtags: a.hashtags || "",
          headline: a.headline || "",
          ctaText: a.ctaText || "",
          subject: a.subject || "",
          imagePrompt: a.imagePrompt || "",
          videoPrompt: a.videoPrompt || "",
        })),
        createdAt: new Date().toISOString(),
        model: "multi-agent",
        prompt: brief.trim(),
      };
      await serverPost("/library/items", { item: campaignItem });
      toast.success(`Campaign saved to Library (${readyAssets.length} assets)`);
    } catch (err: any) {
      console.error("[CampaignLab] Save campaign error:", err);
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingCampaign(false);
    }
  };

  // ── Fetch Zernio connected accounts when entering results ──
  useEffect(() => {
    if (phase !== "results" || zernioLoadedRef.current) return;
    zernioLoadedRef.current = true;
    setZernioLoading(true);
    serverGet("/zernio/accounts")
      .then(data => {
        if (data.success && data.accounts) {
          setZernioAccounts(data.accounts);
          console.log(`[CampaignLab] Zernio accounts:`, data.accounts.map((a: any) => `${a.platform}:${a._id}`));
        }
      })
      .catch(err => console.log("[CampaignLab] Zernio accounts fetch:", err))
      .finally(() => setZernioLoading(false));
  }, [phase, serverGet]);

  // ── Refresh Zernio accounts list ──
  const refreshZernioAccounts = useCallback(() => {
    setZernioLoading(true);
    serverGet("/zernio/accounts")
      .then(data => {
        if (data.success && data.accounts) {
          setZernioAccounts(data.accounts);
          console.log(`[CampaignLab] Refreshed accounts:`, data.accounts.map((a: any) => `${a.platform}:${a._id}`));
        }
      })
      .catch(err => console.log("[CampaignLab] Accounts refresh:", err))
      .finally(() => setZernioLoading(false));
  }, [serverGet]);

  // ── Connect a social platform via OAuth popup (transparent — no Zernio branding) ──
  const handleConnectPlatform = useCallback(async (platform: string) => {
    setConnectingPlatform(platform);
    try {
      // Get OAuth URL from backend (auto-creates Zernio profile if needed)
      const token = getAuthToken();
      const qp = new URLSearchParams({ redirectUrl: window.location.origin + "/hub" });
      if (token) qp.set("_token", token);
      const data = await serverGet(`/zernio/connect/${platform}?${qp.toString()}`);
      if (!data.success || !data.authUrl) {
        toast.error(data.error || `Failed to initiate ${platform} connection`);
        setConnectingPlatform(null);
        return;
      }

      // Open OAuth popup
      const popup = window.open(data.authUrl, `connect_${platform}`, "width=600,height=700,left=200,top=100");
      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setConnectingPlatform(null);
        return;
      }

      // Poll for popup close
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          setConnectingPlatform(null);
          // Refresh accounts after OAuth completes
          setTimeout(() => refreshZernioAccounts(), 1500);
          toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully`);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!popup.closed) popup.close();
        setConnectingPlatform(null);
      }, 300_000);
    } catch (err: any) {
      console.error(`[CampaignLab] Connect ${platform} error:`, err);
      toast.error(`Connection failed: ${err?.message || "Unknown error"}`);
      setConnectingPlatform(null);
    }
  }, [serverGet, getAuthToken, refreshZernioAccounts]);

  // ── Generate editorial calendar from ready assets (frontend-only, deterministic) ──
  const handleGenerateCalendar = () => {
    const readyAssets = assets.filter(a => a.status === "ready");
    if (readyAssets.length === 0) { toast.error("No ready assets to schedule"); return; }
    setCalendarLoading(true);
    setShowCalendarPanel(true);

    // Best posting times per platform (day-of-week preferences + time slots)
    // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const platformSchedule: Record<string, { days: number[]; times: string[] }> = {
      LinkedIn:    { days: [2, 3, 4], times: ["09:00", "10:00", "11:00"] },
      Instagram:   { days: [1, 3, 5], times: ["12:00", "18:00", "20:00"] },
      Facebook:    { days: [2, 4, 6], times: ["13:00", "15:00", "19:00"] },
      "Twitter/X": { days: [1, 2, 3, 4, 5], times: ["08:00", "12:30", "17:00"] },
      TikTok:      { days: [2, 4, 6], times: ["19:00", "20:00", "21:00"] },
      YouTube:     { days: [4, 5, 6], times: ["14:00", "16:00", "17:00"] },
      Pinterest:   { days: [1, 3, 5, 6], times: ["14:00", "20:00", "21:00"] },
      Email:       { days: [2, 4], times: ["09:30", "10:00", "14:00"] },
    };

    const calChannelColors: Record<string, string> = {
      LinkedIn: "#0077B5", Instagram: "#E1306C", Facebook: "#1877F2",
      Email: "#EA4335", "Twitter/X": "#1DA1F2", TikTok: "#00f2ea",
      YouTube: "#FF0000", Pinterest: "#E60023",
    };

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Group assets by platform
    const byPlatform: Record<string, GeneratedAsset[]> = {};
    readyAssets.forEach(a => {
      if (!byPlatform[a.platform]) byPlatform[a.platform] = [];
      byPlatform[a.platform].push(a);
    });

    const usedSlots = new Set<string>();
    const events: any[] = [];
    const platforms = Object.keys(byPlatform);
    let dayOffset = 0;
    const maxDays = 28;

    // Interleave platforms for variety
    const queue: GeneratedAsset[] = [];
    const maxLen = Math.max(...platforms.map(p => byPlatform[p].length));
    for (let i = 0; i < maxLen; i++) {
      for (const p of platforms) {
        if (byPlatform[p][i]) queue.push(byPlatform[p][i]);
      }
    }

    for (const asset of queue) {
      const sched = platformSchedule[asset.platform] || { days: [1, 3, 5], times: ["10:00", "14:00"] };
      let scheduled = false;

      for (let d = dayOffset; d < dayOffset + maxDays && !scheduled; d++) {
        const candidate = new Date(startDate);
        candidate.setDate(candidate.getDate() + d);
        const dow = candidate.getDay();
        if (!sched.days.includes(dow)) continue;

        const slotKey = `${candidate.toDateString()}-${asset.platform}`;
        if (usedSlots.has(slotKey)) continue;
        usedSlots.add(slotKey);

        const timeIdx = events.filter(e => e.channel === asset.platform).length % sched.times.length;
        const time = sched.times[timeIdx];
        const title = asset.label || `${asset.platform} post`;
        const postingNote = asset.type === "video" ? "Video content — ensure thumbnail is set"
          : asset.type === "image" ? "Visual post — review image before publishing"
          : "Text post — proofread copy";

        events.push({
          id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title, channel: asset.platform, time,
          day: candidate.getDate(), month: candidate.getMonth(), year: candidate.getFullYear(),
          color: calChannelColors[asset.platform] || "#7A7572",
          postingNote, formatId: asset.formatId,
          assetType: asset.type,
          copy: asset.copy || "",
          caption: asset.caption || "",
          hashtags: asset.hashtags || "",
          headline: asset.headline || "",
          imageUrl: asset.imageUrl || "",
          videoUrl: asset.videoUrl || "",
        });
        scheduled = true;
        if (d === dayOffset) dayOffset = d + 1;
      }

      if (!scheduled) {
        dayOffset += 1;
        const fallback = new Date(startDate);
        fallback.setDate(fallback.getDate() + dayOffset);
        events.push({
          id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: asset.label || `${asset.platform} post`,
          channel: asset.platform,
          time: (platformSchedule[asset.platform]?.times || ["10:00"])[0],
          day: fallback.getDate(), month: fallback.getMonth(), year: fallback.getFullYear(),
          color: calChannelColors[asset.platform] || "#7A7572",
          postingNote: "Overflow slot — consider rescheduling",
          formatId: asset.formatId,
          assetType: asset.type,
          copy: asset.copy || "",
          caption: asset.caption || "",
          hashtags: asset.hashtags || "",
          headline: asset.headline || "",
          imageUrl: asset.imageUrl || "",
          videoUrl: asset.videoUrl || "",
        });
      }
    }

    events.sort((a, b) => {
      const da = new Date(a.year, a.month, a.day, ...a.time.split(":").map(Number) as [number, number]);
      const db = new Date(b.year, b.month, b.day, ...b.time.split(":").map(Number) as [number, number]);
      return da.getTime() - db.getTime();
    });

    setCalendarEvents(events);
    setCalendarGenerated(true);
    if (events.length > 0) {
      setCalendarViewMonth(events[0].month);
      setCalendarViewYear(events[0].year);
    }
    toast.success(`Editorial calendar: ${events.length} posts planned`);
    setCalendarLoading(false);

    // Persist events to server so CalendarPage can display them
    try {
      for (const ev of events) {
        serverPost("/calendar", {
          title: ev.title,
          channel: ev.channel,
          channelIcon: ev.channel,
          time: ev.time,
          status: "scheduled",
          score: 0,
          color: ev.color,
          day: ev.day,
          month: ev.month,
          year: ev.year,
          postingNote: ev.postingNote || "",
          campaignTheme: brief || "Campaign",
          assetType: ev.assetType || "",
          copy: ev.copy || "",
          caption: ev.caption || "",
          hashtags: ev.hashtags || "",
          headline: ev.headline || "",
          imageUrl: ev.imageUrl || "",
          videoUrl: ev.videoUrl || "",
        }, 10_000).catch(() => {});
      }
    } catch (_) { /* best-effort sync */ }
  };

  // ── Deploy a single asset via Zernio ──
  const handleDeployAsset = async (asset: GeneratedAsset, scheduledAt?: string) => {
    setDeployingAssets(prev => ({ ...prev, [asset.formatId]: "deploying" }));
    try {
      // Find matching calendar event
      const matchingEvent = calendarEvents.find(ev =>
        ev.channel === asset.platform || ev.title?.toLowerCase().includes(asset.platform.toLowerCase())
      );
      const data = await serverPost("/campaign/deploy", {
        platform: asset.platform,
        caption: asset.caption || asset.copy || "",
        hashtags: asset.hashtags || "",
        headline: asset.headline || "",
        imageUrl: asset.imageUrl || undefined,
        videoUrl: asset.videoUrl || undefined,
        scheduledAt: scheduledAt || undefined,
        calendarEventId: matchingEvent?.id || undefined,
      }, 35_000);

      if (data.status === "skipped") {
        setDeployingAssets(prev => ({ ...prev, [asset.formatId]: "skipped" }));
        toast(`${asset.label}: ${data.reason || "Skipped"}`);
      } else if (data.success) {
        const status = data.status === "scheduled" ? "scheduled" : "deployed";
        setDeployingAssets(prev => ({ ...prev, [asset.formatId]: status }));
        toast.success(`${asset.label} ${status === "scheduled" ? "scheduled" : "deployed"} to ${asset.platform}${data.zernioPostUrl ? "" : ""}`);
      } else if (data.needsConnect) {
        setDeployingAssets(prev => ({ ...prev, [asset.formatId]: "error" }));
        const zernioPlatform = ZERNIO_PLATFORM_MAP_FE[asset.platform] || asset.platform.toLowerCase();
        toast.error(`No ${asset.platform} account connected. Click "Connect" to link your account.`, { action: { label: `Connect ${asset.platform}`, onClick: () => handleConnectPlatform(zernioPlatform) } });
      } else {
        setDeployingAssets(prev => ({ ...prev, [asset.formatId]: "error" }));
        toast.error(`Deploy failed: ${data.error || "Unknown error"}`);
        console.error("[CampaignLab] Deploy error:", data.error);
      }
    } catch (err: any) {
      setDeployingAssets(prev => ({ ...prev, [asset.formatId]: "error" }));
      toast.error(`Deploy error: ${err?.message || "Network error"}`);
      console.error("[CampaignLab] Deploy error:", err);
    }
  };

  // ── Deploy all ready assets ──
  const handleDeployAll = async () => {
    const readyAssets = assets.filter(a => a.status === "ready");
    if (readyAssets.length === 0) return;
    setDeployingAll(true);

    // Build deployments with calendar-matched scheduling
    const usedEventIds = new Set<string>();
    const deployments = readyAssets.map(a => {
      const matchingEvent = calendarEvents.find(ev =>
        (ev.channel === a.platform || ev.title?.toLowerCase().includes(a.platform.toLowerCase())) &&
        !usedEventIds.has(ev.id)
      );
      if (matchingEvent) usedEventIds.add(matchingEvent.id);
      const scheduledAt = matchingEvent
        ? new Date(matchingEvent.year, matchingEvent.month, matchingEvent.day, parseInt(matchingEvent.time?.split(":")[0] || "9"), parseInt(matchingEvent.time?.split(":")[1] || "0")).toISOString()
        : undefined;
      return {
        formatId: a.formatId,
        platform: a.platform,
        caption: a.caption || a.copy || "",
        hashtags: a.hashtags || "",
        headline: a.headline || "",
        imageUrl: a.imageUrl || undefined,
        videoUrl: a.videoUrl || undefined,
        scheduledAt: calendarGenerated ? scheduledAt : undefined,
        calendarEventId: matchingEvent?.id || undefined,
      };
    });

    try {
      readyAssets.forEach(a => setDeployingAssets(prev => ({ ...prev, [a.formatId]: "deploying" })));
      const data = await serverPost("/campaign/deploy-batch", { deployments, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, 60_000);
      if (data.success && data.results) {
        for (const r of data.results) {
          setDeployingAssets(prev => ({
            ...prev,
            [r.formatId]: r.status === "skipped" ? "skipped" : r.success ? (r.status === "scheduled" ? "scheduled" : "deployed") : "error",
          }));
        }
        const skipped = data.results.filter((r: any) => r.status === "skipped").length;
        const failed = data.results.filter((r: any) => !r.success && r.status !== "skipped").length;
        const needConnect = data.results.filter((r: any) => r.needsConnect).length;
        let msg = `${data.successCount}/${data.totalCount} assets deployed`;
        if (skipped > 0) msg += ` (${skipped} skipped: Email/Web)`;
        if (needConnect > 0) msg += ` -- ${needConnect} need social account connection`;
        toast.success(msg);
      } else {
        toast.error(data.error || "Batch deploy failed");
        readyAssets.forEach(a => setDeployingAssets(prev => ({ ...prev, [a.formatId]: "error" })));
      }
    } catch (err: any) {
      console.error("[CampaignLab] Batch deploy error:", err);
      toast.error("Batch deploy failed");
      readyAssets.forEach(a => setDeployingAssets(prev => ({ ...prev, [a.formatId]: "error" })));
    } finally {
      setDeployingAll(false);
    }
  };

  const canGenerate = (brief.trim() || productUrls.trim()) && selectedFormats.length > 0;

  // ── Brief Completeness Score ──
  const briefScoreItems = [
    { key: "brief", label: "Campaign brief", filled: brief.trim().length > 20, weight: 25 },
    { key: "objective", label: "Objective", filled: !!campaignObjective, weight: 15 },
    { key: "audience", label: "Target audience", filled: targetAudience.trim().length > 5, weight: 12 },
    { key: "tone", label: "Tone of voice", filled: !!toneOverride, weight: 8 },
    { key: "cta", label: "Call to action", filled: ctaText.trim().length > 2, weight: 10 },
    { key: "messages", label: "Key messages", filled: keyMessages.trim().length > 10, weight: 10 },
    { key: "angle", label: "Content angle", filled: contentAngle.trim().length > 3, weight: 5 },
    { key: "dates", label: "Period & duration", filled: !!(campaignStartDate || campaignDuration), weight: 5 },
    { key: "formats", label: "Formats selected", filled: selectedFormats.length > 0, weight: 5 },
    { key: "vault", label: "Brand Vault", filled: !!vault, weight: 5 },
  ];
  const briefScore = briefScoreItems.reduce((acc, item) => acc + (item.filled ? item.weight : 0), 0);
  const briefScoreLabel = briefScore < 30 ? "Minimal" : briefScore < 55 ? "Basic" : briefScore < 80 ? "Good" : "Expert";
  const briefScoreColor = briefScore < 30 ? "#d4183d" : briefScore < 55 ? "#f59e0b" : briefScore < 80 ? "#3b82f6" : "#10b981";

  // ── Contextual objective tips ──
  const OBJECTIVE_TIPS: Record<string, { tip: string; suggestedFormats: string[]; suggestedTone: string }> = {
    "Brand Awareness": {
      tip: "Focus on visual storytelling and broad reach. Prioritize video and carousel formats for maximum impressions. Use aspirational messaging.",
      suggestedFormats: ["instagram-post", "instagram-reel", "linkedin-post", "facebook-video", "youtube-short", "tiktok-video"],
      suggestedTone: "Inspirational",
    },
    "Lead Generation": {
      tip: "Lead with a clear value proposition and strong CTA. Gated content works well. Facebook/LinkedIn ads perform best for B2B leads.",
      suggestedFormats: ["linkedin-post", "facebook-ad", "instagram-post", "twitter-post", "linkedin-text"],
      suggestedTone: "Professional",
    },
    "Product Launch": {
      tip: "Build anticipation with teaser content, then reveal. Use countdown mechanics. Multi-format cascade creates buzz across channels.",
      suggestedFormats: ["instagram-story", "instagram-reel", "linkedin-post", "facebook-post", "tiktok-video", "twitter-post", "youtube-short"],
      suggestedTone: "Bold & Confident",
    },
    "Engagement & Community": {
      tip: "Ask questions, share stories, use polls. Conversational content drives comments. Carousel and text posts get highest engagement.",
      suggestedFormats: ["linkedin-text", "instagram-carousel", "facebook-post", "twitter-text", "tiktok-video"],
      suggestedTone: "Casual & Friendly",
    },
    "Conversion & Sales": {
      tip: "Lead with benefits, social proof, and urgency. Direct response copy with clear CTAs. A/B test ad variations.",
      suggestedFormats: ["facebook-ad", "instagram-post", "instagram-story", "linkedin-post", "twitter-post", "pinterest-pin"],
      suggestedTone: "Bold & Confident",
    },
    "Thought Leadership": {
      tip: "Share unique insights, data, and expert perspectives. Long-form content positions authority. LinkedIn is your primary channel.",
      suggestedFormats: ["linkedin-text", "linkedin-carousel", "linkedin-post", "twitter-text"],
      suggestedTone: "Professional",
    },
    "Event Promotion": {
      tip: "Create urgency with dates and limited spots. Visual countdown content works well. Cross-platform reminders increase attendance.",
      suggestedFormats: ["instagram-story", "linkedin-post", "facebook-post", "twitter-post", "instagram-post"],
      suggestedTone: "Bold & Confident",
    },
    "Recruitment": {
      tip: "Show culture, team stories, and growth opportunities. Authentic behind-the-scenes content attracts talent. LinkedIn is essential.",
      suggestedFormats: ["linkedin-post", "linkedin-text", "instagram-post", "instagram-story", "facebook-post", "tiktok-video"],
      suggestedTone: "Casual & Friendly",
    },
    "Retention & Loyalty": {
      tip: "Celebrate customers, share tips and exclusive content. Personalized messaging increases retention. Email and social reinforce each other.",
      suggestedFormats: ["linkedin-post", "instagram-post", "facebook-post", "instagram-carousel"],
      suggestedTone: "Casual & Friendly",
    },
  };
  const currentObjectiveTip = campaignObjective ? OBJECTIVE_TIPS[campaignObjective] : null;

  /* ═══════════════════════════════════
     RENDER
     ═══════════════════════════════════ */

  return (
    <div className="flex flex-col h-full" style={{ background: "#131211" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,79,196,0.12)" }}>
            <Sparkles size={16} style={{ color: "var(--ora-signal)" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#E8E4DF", letterSpacing: "-0.02em" }}>
              Campaign Lab
            </h2>
            <p style={{ fontSize: "11px", color: "#7A7572", marginTop: 1 }}>
              One brief. Every format. Brand-compliant.
            </p>
          </div>
        </div>
        {phase === "results" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveCampaign}
              disabled={savingCampaign || assets.filter(a => a.status === "ready").length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer"
              style={{ background: "rgba(94,106,210,0.12)", border: "1px solid rgba(94,106,210,0.25)", color: "var(--ora-signal)", fontSize: "13px", fontWeight: 600, opacity: savingCampaign ? 0.6 : 1 }}
            >
              {savingCampaign ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {savingCampaign ? "Saving..." : "Save Campaign"}
            </button>
            <button
              onClick={() => { setPhase("input"); setAssets([]); setCalendarEvents([]); setCalendarGenerated(false); setDeployingAssets({}); setShowCalendarPanel(false); zernioLoadedRef.current = false; setZernioAccounts([]); setConnectingPlatform(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF", fontSize: "13px", fontWeight: 500 }}
            >
              <RefreshCw size={13} />
              New Campaign
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {/* ═══ INPUT PHASE ═══ */}
          {phase === "input" && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto px-6 py-8 space-y-8">

              {/* ── Brief Completeness Score ── */}
              <div className="rounded-xl px-5 py-4" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target size={14} style={{ color: briefScoreColor }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Brief Quality
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "22px", fontWeight: 700, color: briefScoreColor, letterSpacing: "-0.02em" }}>
                      {briefScore}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: briefScoreColor }}>
                      / 100
                    </span>
                    <span className="ml-1 px-2 py-0.5 rounded-full"
                      style={{ fontSize: "10px", fontWeight: 600, color: briefScoreColor, background: `${briefScoreColor}18`, border: `1px solid ${briefScoreColor}30` }}>
                      {briefScoreLabel}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: briefScoreColor }}
                    animate={{ width: `${briefScore}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {briefScoreItems.map(item => (
                    <div key={item.key} className="flex items-center gap-1.5">
                      {item.filled
                        ? <CheckCircle2 size={10} style={{ color: "#10b981" }} />
                        : <CircleDot size={10} style={{ color: "#3a3836" }} />
                      }
                      <span style={{ fontSize: "11px", color: item.filled ? "#9A9590" : "#4a4644" }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                {briefScore < 55 && (
                  <p className="mt-3 flex items-start gap-2" style={{ fontSize: "12px", color: "#7A7572", lineHeight: 1.5 }}>
                    <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#5C5856" }} />
                    The more context you provide, the more precise and on-brand the 15 agents will be. A score above 70 significantly improves output quality.
                  </p>
                )}
              </div>

              {/* Reference Photos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Camera size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Reference photos
                  </span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional, up to 10)</span>
                </div>
                <div
                  className="rounded-xl border-2 border-dashed transition-colors cursor-pointer"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(59,79,196,0.4)"; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  onDrop={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; handlePhotoDrop(e); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {refPhotos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Upload size={20} style={{ color: "#5C5856" }} />
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "#9A9590" }}>Drop reference photos here</span>
                      <span style={{ fontSize: "12px", color: "#5C5856" }}>Product shots, mood boards, style references...</span>
                    </div>
                  ) : (
                    <div className="p-3 flex flex-wrap gap-2">
                      {refPhotos.map((photo, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={e => { e.stopPropagation(); removePhoto(i); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <X size={10} style={{ color: "#fff" }} />
                          </button>
                        </div>
                      ))}
                      {refPhotos.length < 10 && (
                        <div className="w-20 h-20 rounded-lg border border-dashed flex items-center justify-center" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                          <Upload size={14} style={{ color: "#5C5856" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
              </div>

              {/* Product / Service URLs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Product / Service URLs
                  </span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                </div>
                <input
                  value={productUrls}
                  onChange={e => setProductUrls(e.target.value)}
                  placeholder="https://yoursite.com/product-page"
                  className="w-full rounded-xl px-4 py-3 transition-all"
                  style={{
                    background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                    fontSize: "14px", outline: "none",
                  }}
                  onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                  onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                />
              </div>

              {/* Campaign Brief */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Campaign Brief
                  </span>
                </div>
                <textarea
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  placeholder={"Describe your campaign...\ne.g. Launch our new summer collection -- luxury, minimalist, target 25-45 professionals."}
                  className="w-full rounded-xl px-5 py-4 resize-none transition-all"
                  style={{
                    background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                    fontSize: "14px", lineHeight: 1.6, minHeight: 100, outline: "none",
                  }}
                  onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                  onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                />
              </div>

              {/* Campaign Objective + Language — side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Megaphone size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Objective
                    </span>
                  </div>
                  <select
                    value={campaignObjective}
                    onChange={e => setCampaignObjective(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 transition-all cursor-pointer"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: campaignObjective ? "#E8E4DF" : "#5C5856",
                      fontSize: "14px", outline: "none", appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C5856' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  >
                    <option value="">Select objective...</option>
                    <option value="Brand Awareness">Brand Awareness</option>
                    <option value="Lead Generation">Lead Generation</option>
                    <option value="Product Launch">Product Launch</option>
                    <option value="Engagement & Community">Engagement & Community</option>
                    <option value="Conversion & Sales">Conversion & Sales</option>
                    <option value="Thought Leadership">Thought Leadership</option>
                    <option value="Event Promotion">Event Promotion</option>
                    <option value="Recruitment">Recruitment</option>
                    <option value="Retention & Loyalty">Retention & Loyalty</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Language
                    </span>
                  </div>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 transition-all cursor-pointer"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                      fontSize: "14px", outline: "none", appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C5856' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="English">English</option>
                    <option value="French">French</option>
                    <option value="Spanish">Spanish</option>
                    <option value="German">German</option>
                    <option value="Italian">Italian</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Dutch">Dutch</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Chinese">Chinese</option>
                  </select>
                </div>
              </div>

              {/* Objective Smart Tip */}
              {currentObjectiveTip && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-5 py-4"
                  style={{ background: "rgba(94,106,210,0.06)", border: "1px solid rgba(94,106,210,0.12)" }}
                >
                  <div className="flex items-start gap-3">
                    <Zap size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--ora-signal)" }} />
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ora-signal)" }}>
                        Agent recommendation for "{campaignObjective}"
                      </span>
                      <p style={{ fontSize: "12px", color: "#9A9590", lineHeight: 1.55, marginTop: 4 }}>
                        {currentObjectiveTip.tip}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        {!toneOverride && (
                          <button
                            onClick={() => setToneOverride(currentObjectiveTip.suggestedTone)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                            style={{ background: "rgba(94,106,210,0.1)", border: "1px solid rgba(94,106,210,0.2)", fontSize: "11px", fontWeight: 500, color: "var(--ora-signal)" }}
                          >
                            <TrendingUp size={10} />
                            Apply suggested tone: {currentObjectiveTip.suggestedTone}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedFormats(currentObjectiveTip.suggestedFormats)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                          style={{ background: "rgba(94,106,210,0.1)", border: "1px solid rgba(94,106,210,0.2)", fontSize: "11px", fontWeight: 500, color: "var(--ora-signal)" }}
                        >
                          <LayoutGrid size={10} />
                          Apply optimal formats ({currentObjectiveTip.suggestedFormats.length})
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Campaign Period + Duration — side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Start date
                    </span>
                    <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                  </div>
                  <input
                    type="date"
                    value={campaignStartDate}
                    onChange={e => setCampaignStartDate(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 transition-all cursor-pointer"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)",
                      color: campaignStartDate ? "#E8E4DF" : "#5C5856",
                      fontSize: "14px", outline: "none",
                      colorScheme: "dark",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Duration
                    </span>
                    <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                  </div>
                  <select
                    value={campaignDuration}
                    onChange={e => setCampaignDuration(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 transition-all cursor-pointer"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)",
                      color: campaignDuration ? "#E8E4DF" : "#5C5856",
                      fontSize: "14px", outline: "none", appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C5856' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  >
                    <option value="">Select duration...</option>
                    <option value="1 day (flash)">1 day (flash)</option>
                    <option value="3 days">3 days</option>
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="6 weeks">6 weeks</option>
                    <option value="2 months">2 months</option>
                    <option value="3 months (quarter)">3 months (quarter)</option>
                    <option value="6 months">6 months</option>
                    <option value="Ongoing / Evergreen">Ongoing / Evergreen</option>
                  </select>
                </div>
              </div>

              {/* Tone Override */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Tone of voice
                  </span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>(overrides vault default)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["", "Professional", "Casual & Friendly", "Bold & Confident", "Inspirational", "Educational", "Provocative", "Humorous", "Luxury & Refined", "Technical"].map(tone => {
                    const isSelected = toneOverride === tone;
                    const label = tone || "Vault Default";
                    return (
                      <button
                        key={tone}
                        onClick={() => setToneOverride(tone)}
                        className="px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        style={{
                          background: isSelected ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isSelected ? "rgba(94,106,210,0.4)" : "rgba(255,255,255,0.06)"}`,
                          color: isSelected ? "var(--ora-signal)" : "#7A7572",
                          fontSize: "12px", fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Angle */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Content angle / Hook
                  </span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                </div>
                <input
                  value={contentAngle}
                  onChange={e => setContentAngle(e.target.value)}
                  placeholder='e.g. "3 reasons why...", customer success story, behind-the-scenes, data-driven insight'
                  className="w-full rounded-xl px-4 py-3 transition-all"
                  style={{
                    background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                    fontSize: "14px", outline: "none",
                  }}
                  onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                  onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                />
              </div>

              {/* Key Messages */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Type size={14} style={{ color: "#9A9590" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                    Key messages / Talking points
                  </span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                </div>
                <textarea
                  value={keyMessages}
                  onChange={e => setKeyMessages(e.target.value)}
                  placeholder={"- Our product saves 10 hours/week\n- Used by 500+ companies\n- SOC 2 certified\n- Free trial, no credit card"}
                  className="w-full rounded-xl px-5 py-4 resize-none transition-all"
                  style={{
                    background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                    fontSize: "14px", lineHeight: 1.6, minHeight: 80, outline: "none",
                  }}
                  onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                  onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                />
              </div>

              {/* Target Audience + CTA — side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Target audience
                    </span>
                    <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                  </div>
                  <input
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    placeholder="e.g. Tech professionals 25-45"
                    className="w-full rounded-xl px-4 py-3 transition-all"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                      fontSize: "14px", outline: "none",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Send size={14} style={{ color: "#9A9590" }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                      Call to action
                    </span>
                    <span style={{ fontSize: "11px", color: "#5C5856" }}>(optional)</span>
                  </div>
                  <input
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    placeholder='e.g. "Start free trial", "Book a demo"'
                    className="w-full rounded-xl px-4 py-3 transition-all"
                    style={{
                      background: "#1a1918", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF",
                      fontSize: "14px", outline: "none",
                    }}
                    onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                    onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                  />
                </div>
              </div>

              {/* Brand Vault Status */}
              <div className="rounded-xl px-5 py-4" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} style={{ color: vault ? "#10b981" : "#5C5856" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: vault ? "#10b981" : "#7A7572" }}>
                    {vaultLoading ? "Loading Brand Vault..." : vault ? "Brand Vault active" : "Brand Vault not configured"}
                  </span>
                </div>
                {vault && (
                  <div className="flex flex-wrap items-center gap-2">
                    {VAULT_PILLS.map(pill => (
                      <span key={pill.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(59,79,196,0.08)", border: "1px solid rgba(59,79,196,0.15)" }}>
                        <pill.icon size={10} style={{ color: "var(--ora-signal)" }} />
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ora-signal)" }}>{pill.label}</span>
                      </span>
                    ))}
                  </div>
                )}
                {!vault && !vaultLoading && (
                  <p style={{ fontSize: "12px", color: "#5C5856", lineHeight: 1.5 }}>
                    Configure your Brand Vault for brand-compliant content.
                  </p>
                )}
              </div>

              {/* Logo Upload */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>Logo</span>
                {logoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain" style={{ background: "#222120" }} />
                    <Check size={12} style={{ color: "#10b981" }} />
                  </div>
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9590", fontSize: "12px" }}
                  >
                    {uploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Upload logo
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                {rawLogoUrl && (
                  <button
                    onClick={() => setShowLogoOverlay(!showLogoOverlay)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all"
                    style={{ background: showLogoOverlay ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${showLogoOverlay ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}`, fontSize: "10px", fontWeight: 600, color: showLogoOverlay ? "#34d399" : "#5C5856" }}
                  >
                    {showLogoOverlay ? <Check size={9} /> : <Eye size={9} />}
                    Overlay
                  </button>
                )}
              </div>

              {/* Format Selection — grouped by platform */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#7A7572", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Output Formats
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedFormats(FORMAT_OPTIONS.map(f => f.id))}
                      className="px-2 py-0.5 rounded cursor-pointer" style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "rgba(94,106,210,0.08)" }}>
                      All
                    </button>
                    <button onClick={() => setSelectedFormats([])}
                      className="px-2 py-0.5 rounded cursor-pointer" style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", background: "rgba(255,255,255,0.04)" }}>
                      None
                    </button>
                  </div>
                </div>
                <div className="space-y-3" style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                  {PLATFORM_GROUPS.map(group => {
                    const groupFormats = FORMAT_OPTIONS.filter(f => f.platform === group.platform);
                    if (groupFormats.length === 0) return null;
                    const color = PLATFORM_COLORS[group.platform] || "#7A7572";
                    const allSelected = groupFormats.every(f => selectedFormats.includes(f.id));
                    const someSelected = groupFormats.some(f => selectedFormats.includes(f.id));
                    const PlatIcon = group.icon;
                    return (
                      <div key={group.platform}>
                        <button
                          onClick={() => {
                            if (allSelected) {
                              setSelectedFormats(prev => prev.filter(id => !groupFormats.some(f => f.id === id)));
                            } else {
                              setSelectedFormats(prev => [...new Set([...prev, ...groupFormats.map(f => f.id)])]);
                            }
                          }}
                          className="flex items-center gap-2 mb-1.5 cursor-pointer"
                          style={{ fontSize: "11px", fontWeight: 600, color: someSelected ? color : "#5C5856" }}>
                          <PlatIcon size={11} />
                          {group.platform}
                          <span style={{ fontSize: "9px", fontWeight: 400, color: "#5C5856" }}>
                            ({groupFormats.filter(f => selectedFormats.includes(f.id)).length}/{groupFormats.length})
                          </span>
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                          {groupFormats.map(fmt => {
                            const Icon = fmt.icon;
                            const isSelected = selectedFormats.includes(fmt.id);
                            return (
                              <button
                                key={fmt.id}
                                onClick={() => toggleFormat(fmt.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                style={{
                                  background: isSelected ? `${color}15` : "rgba(255,255,255,0.02)",
                                  border: `1px solid ${isSelected ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                                  color: isSelected ? color : "#5C5856",
                                  fontSize: "11px", fontWeight: isSelected ? 600 : 400,
                                }}
                                title={fmt.description}
                              >
                                <Icon size={10} />
                                {fmt.label.replace(`${fmt.platform} `, "")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>



              {/* ── Brief Summary (what agents will receive) ── */}
              {canGenerate && briefScore >= 25 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl px-5 py-4"
                  style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={13} style={{ color: "#7A7572" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#7A7572", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Agent Briefing Preview
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {brief.trim() && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Brief</span>
                        <span style={{ fontSize: "11px", color: "#9A9590", lineHeight: 1.5 }}>{brief.trim().slice(0, 120)}{brief.trim().length > 120 ? "..." : ""}</span>
                      </div>
                    )}
                    {campaignObjective && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Objective</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{campaignObjective}</span>
                      </div>
                    )}
                    {toneOverride && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Tone</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{toneOverride}</span>
                      </div>
                    )}
                    {targetAudience.trim() && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Audience</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{targetAudience.trim().slice(0, 100)}</span>
                      </div>
                    )}
                    {ctaText.trim() && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>CTA</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{ctaText.trim()}</span>
                      </div>
                    )}
                    {contentAngle.trim() && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Angle</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{contentAngle.trim().slice(0, 100)}</span>
                      </div>
                    )}
                    {(campaignStartDate || campaignDuration) && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Period</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>
                          {campaignStartDate && new Date(campaignStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {campaignStartDate && campaignDuration && " — "}
                          {campaignDuration}
                        </span>
                      </div>
                    )}
                    {language !== "auto" && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Language</span>
                        <span style={{ fontSize: "11px", color: "#9A9590" }}>{language}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Formats</span>
                      <span style={{ fontSize: "11px", color: "#9A9590" }}>
                        {selectedFormats.length} format{selectedFormats.length !== 1 ? "s" : ""} across {new Set(FORMAT_OPTIONS.filter(f => selectedFormats.includes(f.id)).map(f => f.platform)).size} platforms
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#5C5856", minWidth: 70 }}>Vault</span>
                      <span style={{ fontSize: "11px", color: vault ? "#10b981" : "#5C5856" }}>
                        {vault ? `${vault.brandName || "Active"} — tone, vocabulary, guardrails enforced` : "Not configured"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl transition-all cursor-pointer"
                style={{
                  background: canGenerate ? "var(--ora-signal)" : "rgba(255,255,255,0.04)",
                  color: canGenerate ? "#fff" : "#5C5856",
                  fontWeight: 600, fontSize: "15px",
                  cursor: canGenerate ? "pointer" : "not-allowed",
                }}
              >
                <Sparkles size={18} />
                Generate Campaign ({selectedFormats.length} format{selectedFormats.length !== 1 ? "s" : ""})
              </button>
              {canGenerate && briefScore < 50 && (
                <p className="text-center" style={{ fontSize: "11px", color: "#5C5856", marginTop: "-4px" }}>
                  Tip: fill more fields above to get higher quality output from the 15 agents
                </p>
              )}
            </motion.div>
          )}

          {/* ═══ GENERATING PHASE ═══ */}
          {phase === "generating" && (
            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 py-20">
              <Loader2 size={32} className="animate-spin" style={{ color: "var(--ora-signal)" }} />
              <div className="text-center">
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#E8E4DF", marginBottom: 4 }}>
                  Generating campaign...
                </p>
                <p style={{ fontSize: "13px", color: "#7A7572" }}>
                  {refPhotos.length > 0
                    ? generationProgress < 10 ? "Uploading reference photos..."
                    : generationProgress < 35 ? "Analyzing visual DNA + generating copy..."
                    : generationProgress < 90 ? "Generating visuals with reference matching..."
                    : "Finalizing campaign..."
                    : "15 agents working: copy, visuals, compliance, adaptation"
                  }
                </p>
              </div>
              <div className="w-80 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full" style={{ background: "var(--ora-signal)" }}
                  animate={{ width: `${generationProgress}%` }} transition={{ duration: 0.5 }} />
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {assets.map(asset => {
                  const color = PLATFORM_COLORS[asset.platform] || "#7A7572";
                  const isReady = asset.status === "ready";
                  const isError = asset.status === "error";
                  return (
                    <span key={asset.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{
                      background: isReady ? `${color}15` : isError ? "rgba(212,24,61,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isReady ? `${color}30` : isError ? "rgba(212,24,61,0.2)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      {isReady ? <Check size={10} style={{ color }} /> : isError ? <AlertCircle size={10} style={{ color: "#d4183d" }} /> : <Loader2 size={10} className="animate-spin" style={{ color: "#5C5856" }} />}
                      <span style={{ fontSize: "10px", fontWeight: 500, color: isReady ? color : isError ? "#d4183d" : "#5C5856" }}>{asset.label}</span>
                    </span>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ RESULTS PHASE ═══ */}
          {phase === "results" && (
            <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-6 py-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#E8E4DF", letterSpacing: "-0.02em" }}>
                    Campaign Ready
                  </h3>
                  <p style={{ fontSize: "13px", color: "#7A7572", marginTop: 2 }}>
                    {assets.filter(a => a.status === "ready").length}/{assets.length} assets generated
                    {vault?.brandName ? ` for ${vault.brandName}` : ""}
                    {Object.values(deployingAssets).filter(s => s === "deployed" || s === "scheduled").length > 0 && (
                      <span style={{ color: "#10b981", marginLeft: 8 }}>
                        {Object.values(deployingAssets).filter(s => s === "deployed" || s === "scheduled").length} deployed
                      </span>
                    )}
                  </p>
                </div>
                {assets.some(a => a.status === "error" || (!a.caption && !a.copy && a.status !== "generating")) && (
                  <button
                    onClick={retryTextGeneration}
                    disabled={retryingTexts}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer"
                    style={{
                      background: retryingTexts ? "rgba(255,255,255,0.03)" : "var(--ora-signal)",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                      opacity: retryingTexts ? 0.6 : 1,
                    }}
                  >
                    {retryingTexts ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {retryingTexts ? "Generating texts..." : "Retry Texts"}
                  </button>
                )}
              </div>

              {/* Social Accounts — transparent integration */}
              <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,79,196,0.12)" }}>
                    <Send size={11} style={{ color: "var(--ora-signal)" }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "#E8E4DF", fontWeight: 600 }}>Social Accounts</span>
                  {zernioLoading && <Loader2 size={10} className="animate-spin" style={{ color: "#7A7572" }} />}
                  {!zernioLoading && zernioAccounts.length > 0 && (
                    <button onClick={refreshZernioAccounts} className="ml-auto cursor-pointer" title="Refresh accounts">
                      <RefreshCw size={10} style={{ color: "#5C5856" }} />
                    </button>
                  )}
                </div>
                {/* Connected accounts */}
                {zernioAccounts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-2 ml-9">
                    {zernioAccounts.map((acc: any, i: number) => {
                      const pName = acc.platform?.charAt(0).toUpperCase() + acc.platform?.slice(1);
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ background: `${PLATFORM_COLORS[pName] || "#7A7572"}15`, fontSize: "11px", fontWeight: 600, color: PLATFORM_COLORS[pName] || "#9A9590" }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
                          {pName} {acc.username ? `@${acc.username}` : ""}
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Connect buttons for unconnected platforms */}
                <div className="flex items-center gap-2 flex-wrap ml-9">
                  {CONNECTABLE_PLATFORMS.filter(p => !zernioAccounts.some((a: any) => a.platform === p.id)).map(p => {
                    const isConnecting = connectingPlatform === p.id;
                    return (
                      <button key={p.id} onClick={() => handleConnectPlatform(p.id)}
                        disabled={isConnecting || !!connectingPlatform}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                        style={{
                          background: isConnecting ? `${p.color}20` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isConnecting ? `${p.color}40` : "rgba(255,255,255,0.08)"}`,
                          fontSize: "11px", fontWeight: 500, color: isConnecting ? p.color : "#7A7572",
                          opacity: connectingPlatform && !isConnecting ? 0.4 : 1,
                        }}>
                        {isConnecting ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                        {isConnecting ? `Connecting ${p.label}...` : p.label}
                      </button>
                    );
                  })}
                  {CONNECTABLE_PLATFORMS.filter(p => !zernioAccounts.some((a: any) => a.platform === p.id)).length === 0 && zernioAccounts.length > 0 && (
                    <span style={{ fontSize: "10px", color: "#5C5856" }}>All platforms connected</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset, i) => {
                  const fmt = FORMAT_OPTIONS.find(f => f.id === asset.formatId);
                  const Icon = fmt?.icon || ImageIcon;
                  const color = PLATFORM_COLORS[asset.platform] || "#7A7572";

                  return (
                    <motion.div key={asset.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }} className="rounded-xl overflow-hidden group"
                      style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {/* Preview area */}
                      <div className="relative cursor-pointer"
                        style={{ aspectRatio: asset.type === "text" ? "3/2" : (fmt?.aspectRatio || "1/1"), background: "#0e0d0c", maxHeight: 280 }}
                        onClick={() => setSelectedAsset(asset)}>
                        {asset.status === "ready" && asset.imageUrl ? (
                          <div className="relative w-full h-full">
                            {/* Carousel: show first slide with slide count badge */}
                            {asset.carouselSlides && asset.carouselSlides.length > 1 ? (
                              <div className="relative w-full h-full">
                                <img src={asset.carouselSlides[0]?.imageUrl || asset.imageUrl} alt={asset.label} className="w-full h-full object-cover" />
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
                                  <LayoutGrid size={9} style={{ color: "#E8E4DF" }} />
                                  <span style={{ fontSize: "9px", fontWeight: 600, color: "#E8E4DF" }}>
                                    {asset.carouselSlides.filter(s => s.imageUrl).length} slides
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <img src={asset.imageUrl} alt={asset.label} className="w-full h-full object-cover" />
                            )}
                            {/* Brand logo overlay */}
                            {brandLogoUrl && (
                              <img
                                src={brandLogoUrl}
                                alt="Brand logo"
                                className="absolute"
                                style={{
                                  bottom: 10, right: 10,
                                  width: "14%", maxWidth: 56, minWidth: 24,
                                  height: "auto",
                                  objectFit: "contain",
                                  filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
                                  opacity: 0.9,
                                  borderRadius: 3,
                                }}
                              />
                            )}
                          </div>
                        ) : asset.status === "ready" && asset.videoUrl ? (
                          <div className="relative w-full h-full">
                            <video
                              src={asset.videoUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              data-asset-id={asset.id}
                              onMouseEnter={e => {
                                const v = e.target as HTMLVideoElement;
                                v.play().catch(() => {});
                              }}
                              onMouseLeave={e => {
                                const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0;
                              }}
                            />
                            {/* Brand logo overlay on video */}
                            {brandLogoUrl && (
                              <img src={brandLogoUrl} alt="Brand logo" className="absolute"
                                style={{ bottom: 10, right: 10, width: "14%", maxWidth: 56, minWidth: 24, height: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", opacity: 0.9, borderRadius: 3 }} />
                            )}
                          </div>
                        ) : asset.status === "ready" && asset.type === "text" ? (
                          <div className="w-full h-full p-4 overflow-hidden">
                            {asset.subject && (
                              <p className="line-clamp-1 mb-2" style={{ fontSize: "11px", fontWeight: 600, color: "var(--ora-signal)", lineHeight: 1.3 }}>
                                {asset.subject}
                              </p>
                            )}
                            {asset.headline && (
                              <p className="line-clamp-2 mb-2" style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF", lineHeight: 1.3 }}>
                                {asset.headline}
                              </p>
                            )}
                            <p className="line-clamp-5" style={{ fontSize: "12px", color: "#9A9590", lineHeight: 1.6 }}>
                              {asset.caption || asset.copy || ""}
                            </p>
                            {!asset.caption && !asset.copy && !asset.headline && (
                              <div className="flex flex-col items-center justify-center gap-2 py-4">
                                <FileText size={20} style={{ color: "#5C5856" }} />
                                <span style={{ fontSize: "12px", color: "#7A7572" }}>No text generated</span>
                                <button onClick={(e) => { e.stopPropagation(); retryTextGeneration(); }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md cursor-pointer"
                                  style={{ background: "var(--ora-signal)", color: "#fff", fontSize: "11px", fontWeight: 600 }}>
                                  <RefreshCw size={10} /> Retry
                                </button>
                              </div>
                            )}
                            {asset.ctaText && (
                              <span className="inline-block mt-2 px-3 py-1 rounded text-xs" style={{ background: "var(--ora-signal)", color: "#fff", fontWeight: 600, fontSize: "10px" }}>
                                {asset.ctaText}
                              </span>
                            )}
                          </div>
                        ) : asset.status === "generating" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Loader2 size={20} className="animate-spin" style={{ color }} />
                            <span style={{ fontSize: "11px", color: "#5C5856" }}>Generating...</span>
                          </div>
                        ) : asset.status === "error" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            <AlertCircle size={20} style={{ color: "#d4183d" }} />
                            <span style={{ fontSize: "11px", color: "#d4183d" }}>{asset.error?.slice(0, 50) || "Error"}</span>
                            <button onClick={(e) => { e.stopPropagation(); retryTextGeneration(); }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md cursor-pointer"
                              style={{ background: "var(--ora-signal)", color: "#fff", fontSize: "11px", fontWeight: 600 }}>
                              <RefreshCw size={10} /> Retry Texts
                            </button>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon size={28} style={{ color: "#3d3c3b" }} />
                          </div>
                        )}

                        {asset.status === "ready" && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={18} style={{ color: "white" }} />
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                            <Icon size={10} style={{ color }} />
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "#fff" }}>{asset.platform}</span>
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>{asset.label}</span>
                          {asset.status === "ready" && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeployAsset(asset)}
                                disabled={deployingAssets[asset.formatId] === "deploying" || deployingAssets[asset.formatId] === "deployed"}
                                className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                                title={deployingAssets[asset.formatId] === "deployed" ? "Published" : deployingAssets[asset.formatId] === "scheduled" ? "Scheduled" : "Publish to platform"}
                                style={{ background: deployingAssets[asset.formatId] === "deployed" ? "rgba(16,185,129,0.15)" : deployingAssets[asset.formatId] === "scheduled" ? "rgba(59,79,196,0.15)" : "rgba(255,255,255,0.04)" }}>
                                {deployingAssets[asset.formatId] === "deploying" ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--ora-signal)" }} />
                                  : deployingAssets[asset.formatId] === "deployed" ? <Check size={12} style={{ color: "#10b981" }} />
                                  : deployingAssets[asset.formatId] === "scheduled" ? <Clock size={12} style={{ color: "var(--ora-signal)" }} />
                                  : <Send size={12} style={{ color: "#7A7572" }} />}
                              </button>
                              <button onClick={() => handleSaveAsset(asset)} className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <Save size={12} style={{ color: "#7A7572" }} />
                              </button>
                              <button onClick={() => handleDownload(asset)} className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <Download size={12} style={{ color: "#7A7572" }} />
                              </button>
                            </div>
                          )}
                        </div>
                        {asset.headline && (
                          <p className="line-clamp-1 mb-1" style={{ fontSize: "12px", fontWeight: 600, color: "#C4BEB8", lineHeight: 1.4 }}>{asset.headline}</p>
                        )}
                        {(asset.caption || asset.copy) && (
                          <p className="line-clamp-3" style={{ fontSize: "12px", color: "#7A7572", lineHeight: 1.5 }}>{asset.caption || asset.copy}</p>
                        )}
                        {asset.hashtags && (
                          <p className="line-clamp-1 mt-1" style={{ fontSize: "11px", color: "var(--ora-signal)", lineHeight: 1.4 }}>{asset.hashtags}</p>
                        )}
                        {asset.status === "ready" && (
                          <div className="flex items-center gap-1 mt-2">
                            <Check size={11} style={{ color: "#10b981" }} />
                            <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 600 }}>Brand-compliant</span>
                          </div>
                        )}

                        {deployingAssets[asset.formatId] && (
                          <div className="flex items-center gap-1 mt-1">
                            {deployingAssets[asset.formatId] === "deployed" && <><Send size={9} style={{ color: "#10b981" }} /><span style={{ fontSize: "9px", color: "#10b981", fontWeight: 600 }}>Published</span></>}
                            {deployingAssets[asset.formatId] === "scheduled" && <><Clock size={9} style={{ color: "var(--ora-signal)" }} /><span style={{ fontSize: "9px", color: "var(--ora-signal)", fontWeight: 600 }}>Scheduled</span></>}
                            {deployingAssets[asset.formatId] === "deploying" && <><Loader2 size={9} className="animate-spin" style={{ color: "#7A7572" }} /><span style={{ fontSize: "9px", color: "#7A7572", fontWeight: 600 }}>Deploying...</span></>}
                            {deployingAssets[asset.formatId] === "skipped" && <><Check size={9} style={{ color: "#7A7572" }} /><span style={{ fontSize: "9px", color: "#7A7572", fontWeight: 600 }}>Skipped (not supported)</span></>}
                            {deployingAssets[asset.formatId] === "error" && <><AlertCircle size={9} style={{ color: "#d4183d" }} /><span style={{ fontSize: "9px", color: "#d4183d", fontWeight: 600 }}>Deploy failed</span></>}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ═══ CALENDAR + DEPLOY PANEL ═══ */}
              <div className="mt-8 space-y-4">
                {/* Action bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleGenerateCalendar}
                    disabled={calendarLoading || assets.filter(a => a.status === "ready").length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    style={{
                      background: calendarGenerated ? "rgba(16,185,129,0.08)" : "rgba(59,79,196,0.1)",
                      border: `1px solid ${calendarGenerated ? "rgba(16,185,129,0.2)" : "rgba(59,79,196,0.2)"}`,
                      color: calendarGenerated ? "#10b981" : "var(--ora-signal)",
                      fontSize: "13px", fontWeight: 600,
                      opacity: calendarLoading ? 0.6 : 1,
                    }}
                  >
                    {calendarLoading ? <Loader2 size={14} className="animate-spin" /> : calendarGenerated ? <Check size={14} /> : <Calendar size={14} />}
                    {calendarLoading ? "Generating schedule..." : calendarGenerated ? `${calendarEvents.length} posts planned` : "Plan Editorial Calendar"}
                  </button>

                  {calendarGenerated && (
                    <button
                      onClick={() => setShowCalendarPanel(prev => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9590", fontSize: "12px", fontWeight: 500 }}
                    >
                      <ChevronRight size={12} style={{ transform: showCalendarPanel ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                      {showCalendarPanel ? "Hide calendar" : "Show calendar"}
                    </button>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {calendarGenerated && (
                      <Link
                        to="/hub/calendar"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9590", fontSize: "12px", fontWeight: 500 }}
                      >
                        <ExternalLink size={12} />
                        Open Calendar
                      </Link>
                    )}
                    <button
                      onClick={handleDeployAll}
                      disabled={deployingAll || assets.filter(a => a.status === "ready").length === 0}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                      style={{
                        background: deployingAll ? "rgba(255,255,255,0.04)" : "var(--ora-signal)",
                        color: "#fff", fontSize: "13px", fontWeight: 600,
                        opacity: (deployingAll || assets.filter(a => a.status === "ready").length === 0) ? 0.5 : 1,
                      }}
                    >
                      {deployingAll ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {deployingAll ? "Deploying..." : calendarGenerated ? "Deploy All (Scheduled)" : "Deploy All Now"}
                    </button>
                  </div>
                </div>

                {/* Calendar preview — real monthly grid */}
                <AnimatePresence>
                  {showCalendarPanel && calendarGenerated && calendarEvents.length > 0 && (() => {
                    const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                    const channelColors: Record<string, string> = {
                      LinkedIn: "#0077B5", Instagram: "#E1306C", Facebook: "#1877F2",
                      Email: "#EA4335", "Twitter/X": "#1DA1F2", TikTok: "#00f2ea",
                      YouTube: "#FF0000", Pinterest: "#E60023", Web: "#4285F4",
                    };

                    // Build grid for current view month
                    const firstDay = new Date(calendarViewYear, calendarViewMonth, 1);
                    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
                    // Monday = 0
                    let startDow = firstDay.getDay() - 1;
                    if (startDow < 0) startDow = 6;
                    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

                    // Events for this month
                    const monthEvents = calendarEvents.filter(ev => ev.month === calendarViewMonth && ev.year === calendarViewYear);
                    const eventsByDay: Record<number, typeof calendarEvents> = {};
                    monthEvents.forEach(ev => {
                      if (!eventsByDay[ev.day]) eventsByDay[ev.day] = [];
                      eventsByDay[ev.day].push(ev);
                    });

                    // Count events per month for navigation dots
                    const monthsWithEvents = new Set(calendarEvents.map(ev => `${ev.year}-${ev.month}`));

                    const navigateMonth = (dir: -1 | 1) => {
                      let m = calendarViewMonth + dir;
                      let y = calendarViewYear;
                      if (m < 0) { m = 11; y--; }
                      if (m > 11) { m = 0; y++; }
                      setCalendarViewMonth(m);
                      setCalendarViewYear(y);
                    };

                    const today = new Date();
                    const isToday = (d: number) => d === today.getDate() && calendarViewMonth === today.getMonth() && calendarViewYear === today.getFullYear();

                    return (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl overflow-hidden" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {/* Header */}
                          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center gap-3">
                              <Calendar size={14} style={{ color: "var(--ora-signal)" }} />
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>Editorial Calendar</span>
                              <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "rgba(59,79,196,0.1)" }}>
                                {calendarEvents.length} posts
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-md cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <ChevronLeft size={14} style={{ color: "#9A9590" }} />
                              </button>
                              <span style={{ fontSize: "14px", fontWeight: 600, color: "#E8E4DF", minWidth: 140, textAlign: "center" }}>
                                {MONTHS_FULL[calendarViewMonth]} {calendarViewYear}
                                {monthsWithEvents.has(`${calendarViewYear}-${calendarViewMonth}`) && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full ml-2" style={{ background: "var(--ora-signal)", verticalAlign: "middle" }} />
                                )}
                              </span>
                              <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-md cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <ChevronRight size={14} style={{ color: "#9A9590" }} />
                              </button>
                            </div>
                          </div>

                          {/* Day-of-week headers */}
                          <div className="grid grid-cols-7 px-2 pt-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            {DOW.map(d => (
                              <div key={d} className="text-center py-2" style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {d}
                              </div>
                            ))}
                          </div>

                          {/* Grid cells */}
                          <div className="grid grid-cols-7 px-2 pb-2">
                            {Array.from({ length: totalCells }).map((_, idx) => {
                              const dayNum = idx - startDow + 1;
                              const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                              const dayEvents = inMonth ? (eventsByDay[dayNum] || []) : [];
                              const todayMark = inMonth && isToday(dayNum);

                              return (
                                <div key={idx} className="relative min-h-[72px] p-1" style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
                                  {inMonth && (
                                    <>
                                      <span style={{
                                        fontSize: "11px", fontWeight: todayMark ? 700 : 400,
                                        color: todayMark ? "var(--ora-signal)" : dayEvents.length > 0 ? "#E8E4DF" : "#3a3836",
                                        display: "block", textAlign: "right", paddingRight: 2, paddingTop: 1,
                                      }}>
                                        {dayNum}
                                      </span>
                                      <div className="mt-0.5 space-y-0.5">
                                        {dayEvents.slice(0, 3).map((ev, ei) => {
                                          const color = channelColors[ev.channel] || ev.color || "#7A7572";
                                          return (
                                            <motion.div
                                              key={ev.id || ei}
                                              initial={{ opacity: 0, scale: 0.9 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              transition={{ delay: ei * 0.05 }}
                                              className="rounded px-1 py-0.5 truncate cursor-default group relative"
                                              style={{ background: `${color}18`, borderLeft: `2px solid ${color}` }}
                                              title={`${ev.time} — ${ev.channel}: ${ev.title}${ev.postingNote ? "\n" + ev.postingNote : ""}`}
                                            >
                                              <span style={{ fontSize: "8px", fontWeight: 600, color, display: "block", lineHeight: 1.2 }}>
                                                {ev.time} {ev.channel}
                                              </span>
                                              <span className="truncate block" style={{ fontSize: "8px", color: "#9A9590", lineHeight: 1.2 }}>
                                                {ev.title}
                                              </span>
                                            </motion.div>
                                          );
                                        })}
                                        {dayEvents.length > 3 && (
                                          <span style={{ fontSize: "8px", fontWeight: 600, color: "#5C5856", paddingLeft: 2 }}>
                                            +{dayEvents.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Legend + list summary below grid */}
                          <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex flex-wrap gap-3 mb-3">
                              {[...new Set(calendarEvents.map(e => e.channel))].map(ch => (
                                <span key={ch} className="inline-flex items-center gap-1.5" style={{ fontSize: "10px", fontWeight: 500, color: channelColors[ch] || "#7A7572" }}>
                                  <span className="w-2 h-2 rounded-full" style={{ background: channelColors[ch] || "#7A7572" }} />
                                  {ch} ({calendarEvents.filter(e => e.channel === ch).length})
                                </span>
                              ))}
                            </div>
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                              {[...calendarEvents].sort((a, b) => {
                                const da = new Date(a.year, a.month, a.day);
                                const db = new Date(b.year, b.month, b.day);
                                return da.getTime() - db.getTime();
                              }).map((ev, i) => {
                                const color = channelColors[ev.channel] || ev.color || "#7A7572";
                                const evDate = new Date(ev.year, ev.month, ev.day);
                                const dateStr = evDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                                return (
                                  <div key={ev.id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#7A7572", minWidth: 90 }}>{dateStr}</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${color}15`, fontSize: "9px", fontWeight: 600, color }}>{ev.time}</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${color}15`, fontSize: "9px", fontWeight: 600, color }}>{ev.channel}</span>
                                    <span className="truncate flex-1" style={{ fontSize: "11px", fontWeight: 500, color: "#E8E4DF" }}>{ev.title}</span>
                                    {ev.postingNote && <span className="truncate hidden sm:block" style={{ fontSize: "9px", color: "#5C5856", maxWidth: 200 }}>{ev.postingNote}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ASSET DETAIL MODAL ═══ */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setSelectedAsset(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="max-w-4xl w-full max-h-[90vh] overflow-auto rounded-xl"
              style={{ background: "#131211", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "#E8E4DF" }}>{selectedAsset.label}</span>
                  <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "10px", fontWeight: 600, color: PLATFORM_COLORS[selectedAsset.platform] || "#7A7572", background: `${PLATFORM_COLORS[selectedAsset.platform] || "#7A7572"}15` }}>
                    {selectedAsset.platform}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { handleDeployAsset(selectedAsset); }}
                    disabled={deployingAssets[selectedAsset.formatId] === "deploying" || deployingAssets[selectedAsset.formatId] === "deployed"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer"
                    style={{
                      background: deployingAssets[selectedAsset.formatId] === "deployed" ? "rgba(16,185,129,0.15)" : deployingAssets[selectedAsset.formatId] === "deploying" ? "rgba(255,255,255,0.06)" : "#10b981",
                      color: "#fff", fontSize: "12px", fontWeight: 600,
                      opacity: deployingAssets[selectedAsset.formatId] === "deploying" ? 0.6 : 1,
                    }}
                  >
                    {deployingAssets[selectedAsset.formatId] === "deploying" ? <><Loader2 size={12} className="animate-spin" /> Deploying...</>
                      : deployingAssets[selectedAsset.formatId] === "deployed" ? <><Check size={12} /> Deployed</>
                      : <><Send size={12} /> Deploy to {selectedAsset.platform}</>}
                  </button>
                  <button onClick={() => handleSaveAsset(selectedAsset)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "var(--ora-signal)", color: "#fff", fontSize: "12px", fontWeight: 600 }}>
                    <Save size={12} /> Save to Library
                  </button>
                  <button onClick={() => handleDownload(selectedAsset)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "rgba(255,255,255,0.06)", color: "#E8E4DF", fontSize: "12px", fontWeight: 500 }}>
                    <Download size={12} /> Export
                  </button>
                  <button onClick={() => setSelectedAsset(null)} className="p-2 rounded-lg cursor-pointer" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <X size={16} style={{ color: "#7A7572" }} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                {/* Carousel slides browser */}
                {selectedAsset.carouselSlides && selectedAsset.carouselSlides.length > 1 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <LayoutGrid size={14} style={{ color: "var(--ora-signal)" }} />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>
                        Carousel — {selectedAsset.carouselSlides.length} slides
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                      {selectedAsset.carouselSlides.map((slide, idx) => (
                        <div key={idx} className="flex-shrink-0 rounded-xl overflow-hidden relative" style={{ width: 220, background: "#0e0d0c", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {slide.imageUrl ? (
                            <img src={slide.imageUrl} alt={`Slide ${idx + 1}`} className="w-full" style={{ aspectRatio: "1/1", objectFit: "cover" }} />
                          ) : (
                            <div className="flex items-center justify-center" style={{ aspectRatio: "1/1", background: "#131211" }}>
                              {slide.status === "generating" ? <Loader2 size={16} className="animate-spin" style={{ color: "var(--ora-signal)" }} />
                                : <AlertCircle size={16} style={{ color: "#5C5856" }} />}
                            </div>
                          )}
                          {brandLogoUrl && slide.imageUrl && (
                            <img src={brandLogoUrl} alt="Logo" className="absolute" style={{ bottom: 6, right: 6, width: "16%", maxWidth: 32, height: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", opacity: 0.9, borderRadius: 2 }} />
                          )}
                          <div className="p-3">
                            <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--ora-signal)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Slide {idx + 1}</span>
                            <p className="line-clamp-3 mt-1" style={{ fontSize: "11px", color: "#9A9590", lineHeight: 1.5 }}>{slide.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Single image (non-carousel) */}
                {selectedAsset.imageUrl && (!selectedAsset.carouselSlides || selectedAsset.carouselSlides.length <= 1) && (
                  <div className="relative inline-block w-full">
                    <img src={selectedAsset.imageUrl} alt={selectedAsset.label} className="w-full rounded-xl max-h-[50vh] object-contain" style={{ background: "#0e0d0c" }} />
                    {brandLogoUrl && (
                      <img src={brandLogoUrl} alt="Brand logo" className="absolute" style={{ bottom: 12, right: 12, width: "10%", maxWidth: 64, minWidth: 28, height: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", opacity: 0.9, borderRadius: 3 }} />
                    )}
                  </div>
                )}
                {selectedAsset.videoUrl && (
                  <div className="space-y-2">
                    <div className="relative">
                      <video
                        id={`modal-video-${selectedAsset.id}`}
                        src={selectedAsset.videoUrl}
                        className="w-full rounded-xl" controls autoPlay
                        muted
                        loop playsInline
                        style={{ maxHeight: "50vh", background: "#0e0d0c" }}
                      />
                      {brandLogoUrl && (
                        <img src={brandLogoUrl} alt="Brand logo" className="absolute" style={{ bottom: 16, right: 16, width: "10%", maxWidth: 64, minWidth: 28, height: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", opacity: 0.9, borderRadius: 3 }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Subject line (email) */}
                {selectedAsset.subject && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                      Subject Line
                    </span>
                    <p style={{ fontSize: "15px", fontWeight: 600, color: "#E8E4DF", lineHeight: 1.5 }}>
                      {selectedAsset.subject}
                    </p>
                  </div>
                )}

                {/* Headline */}
                {selectedAsset.headline && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                      Headline
                    </span>
                    <p style={{ fontSize: "16px", fontWeight: 600, color: "#E8E4DF", lineHeight: 1.4, letterSpacing: "-0.01em" }}>
                      {selectedAsset.headline}
                    </p>
                  </div>
                )}

                {/* Main copy / caption */}
                {(selectedAsset.caption || selectedAsset.copy) && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                      {selectedAsset.type === "text" ? "Body Copy" : "Caption"}
                    </span>
                    <p style={{ fontSize: "14px", color: "#E8E4DF", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {selectedAsset.caption || selectedAsset.copy}
                    </p>
                  </div>
                )}

                {/* Hashtags */}
                {selectedAsset.hashtags && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                      Hashtags
                    </span>
                    <p style={{ fontSize: "13px", color: "var(--ora-signal)", lineHeight: 1.6 }}>{selectedAsset.hashtags}</p>
                  </div>
                )}

                {/* Features (landing page) */}
                {selectedAsset.features && selectedAsset.features.length > 0 && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                      Key Features
                    </span>
                    <ul className="space-y-2">
                      {selectedAsset.features.map((feat, fi) => (
                        <li key={fi} className="flex items-start gap-2">
                          <Check size={12} style={{ color: "var(--ora-signal)", marginTop: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: "13px", color: "#C4BEB8", lineHeight: 1.5 }}>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA */}
                {selectedAsset.ctaText && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                      Call to Action
                    </span>
                    <span className="inline-flex items-center px-5 py-2.5 rounded-lg" style={{ background: "var(--ora-signal)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>
                      {selectedAsset.ctaText}
                    </span>
                  </div>
                )}

                {/* Re-prompt / Regenerate */}
                {selectedAsset.type !== "text" && (
                  <div className="rounded-xl p-5" style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5856", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                      Re-prompt & Regenerate
                    </span>
                    <div className="flex gap-2">
                      <input
                        value={repromptText}
                        onChange={e => setRepromptText(e.target.value)}
                        placeholder={`Describe what you want instead... (current: ${selectedAsset.imagePrompt?.slice(0, 60) || selectedAsset.videoPrompt?.slice(0, 60) || "auto-generated"})`}
                        className="flex-1 rounded-lg px-4 py-2.5 transition-all"
                        style={{ background: "#131211", border: "1px solid rgba(255,255,255,0.08)", color: "#E8E4DF", fontSize: "13px", outline: "none" }}
                        onFocus={e => (e.target.style.border = "1px solid rgba(59,79,196,0.4)")}
                        onBlur={e => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
                        onKeyDown={e => { if (e.key === "Enter" && repromptText.trim()) handleRegenerateAsset(selectedAsset, repromptText); }}
                      />
                      <button
                        onClick={() => handleRegenerateAsset(selectedAsset, repromptText)}
                        disabled={!repromptText.trim() || regeneratingAsset === selectedAsset.formatId}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{
                          background: regeneratingAsset === selectedAsset.formatId ? "rgba(255,255,255,0.04)" : "var(--ora-signal)",
                          color: "#fff", fontSize: "13px", fontWeight: 600,
                          opacity: (!repromptText.trim() || regeneratingAsset === selectedAsset.formatId) ? 0.5 : 1,
                        }}
                      >
                        {regeneratingAsset === selectedAsset.formatId ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {regeneratingAsset === selectedAsset.formatId ? "Regenerating..." : "Regenerate"}
                      </button>
                    </div>
                    {selectedAsset.imagePrompt && (
                      <p className="mt-2" style={{ fontSize: "11px", color: "#5C5856", lineHeight: 1.5 }}>
                        Current prompt: {selectedAsset.imagePrompt.slice(0, 150)}{selectedAsset.imagePrompt.length > 150 ? "..." : ""}
                      </p>
                    )}
                    {selectedAsset.videoPrompt && !selectedAsset.imagePrompt && (
                      <p className="mt-2" style={{ fontSize: "11px", color: "#5C5856", lineHeight: 1.5 }}>
                        Current prompt: {selectedAsset.videoPrompt.slice(0, 150)}{selectedAsset.videoPrompt.length > 150 ? "..." : ""}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                  <Shield size={14} style={{ color: "#10b981" }} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#10b981" }}>Brand-compliant</span>
                  <span style={{ fontSize: "11px", color: "#5C5856" }}>-- Validated by Compliance Guard agent</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}