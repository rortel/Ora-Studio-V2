import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon, Upload, Loader2, X, Tag, Trash2,
  Check, Filter, Grid3x3, Sparkles, Eye, Camera,
  Sun, Palette, Target, ChevronDown,
  Layers, Zap,
} from "lucide-react";
import { apiUrl, apiHeaders } from "../lib/supabase";

// ── Types ──

interface ImageAnalysis {
  composition?: { framing?: string; orientation?: string; depth?: string; negative_space?: string; leading_lines?: string; focal_point?: string };
  color?: { dominant_palette?: string[]; palette_name?: string; temperature?: string; saturation?: string; contrast?: string; harmony?: string };
  lighting?: { type?: string; direction?: string; quality?: string; key_ratio?: string; mood_contribution?: string };
  subject?: { primary?: string; secondary?: string; human_presence?: string; environment?: string; props_styling?: string };
  mood?: { primary_emotion?: string; secondary_emotions?: string[]; energy?: string; sophistication?: string };
  technique?: { estimated_focal_length?: string; depth_of_field?: string; shutter_feel?: string; post_processing?: string; style_reference?: string };
  brand_alignment?: { score?: number; strengths?: string[]; concerns?: string[]; recommended_usage?: string[] };
  tags_suggested?: string[];
  category_suggested?: string;
  one_line_description?: string;
  _parseError?: boolean;
  _raw?: string;
}

interface BrandImage {
  id: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  tags: string[];
  category: string;
  uploadedAt: string;
  updatedAt?: string;
  analyzedAt?: string;
  altText?: string;
  analysis?: ImageAnalysis;
  signedUrl: string | null;
  success?: boolean;
  error?: string;
}

const CATEGORIES = [
  "general", "product", "lifestyle", "team", "office",
  "event", "social", "ad", "packaging", "abstract", "other",
];

// ── Props ──

interface ImageBankProps {
  accessToken: string | null;
}

function corsBody(token: string, data?: Record<string, any>): string {
  return JSON.stringify({ _token: token, ...data });
}

// ── Shared style constants ──
const C = {
  bg: "#1a1918",
  bgInner: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.10)",
  text: "#E8E4DF",
  textMuted: "#9A9590",
  textDim: "rgba(255,255,255,0.25)",
  accent: "#5E6AD2",
  accentBg: "rgba(94,106,210,0.08)",
  accentBorder: "rgba(94,106,210,0.15)",
  shadow: "0 1px 3px rgba(0,0,0,0.08)",
  green: "#10B981",
  red: "#EF4444",
  amber: "#b45309",
};

export function ImageBank({ accessToken }: ImageBankProps) {
  const [images, setImages] = useState<BrandImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [inspectImage, setInspectImage] = useState<BrandImage | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));

  const fileRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  const token = () => tokenRef.current || "";

  // ── Load images ──
  const loadImages = useCallback(async () => {
    if (!accessToken) { setLoading(false); return; }
    try {
      const url = apiUrl("/vault/images/list");
      const body: Record<string, any> = { _token: token() };
      if (filterTag) body.tag = filterTag;
      if (filterCategory) body.category = filterCategory;

      console.log("[ImageBank] Loading images via POST, token present:", !!token(), "tokenLen:", token().length);
      const res = await fetch(url, {
        method: "POST",
        headers: { ...apiHeaders(false), "Content-Type": "text/plain" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log("[ImageBank] Load response:", data.success, "count:", data.images?.length || 0, "_debug:", JSON.stringify(data._debug), data.error || "");
      if (data.success) {
        setImages(data.images || []);
      } else {
        console.error("[ImageBank] Load error:", data.error);
      }
    } catch (err) {
      console.error("[ImageBank] Load error:", err);
    }
    setLoading(false);
  }, [accessToken, filterTag, filterCategory]);

  useEffect(() => { loadImages(); }, [loadImages]);

  // ── Upload ──
  const handleUpload = async (files: FileList | File[]) => {
    if (!accessToken || files.length === 0) return;
    setUploading(true);
    setUploadProgress(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      formData.append("_token", token());
      formData.append("category", "general");

      console.log("[ImageBank] Upload token present:", !!token(), "tokenLen:", token().length, "files:", files.length);
      const res = await fetch(apiUrl("/vault/images"), {
        method: "POST",
        headers: apiHeaders(false),
        body: formData,
      });
      const data = await res.json();
      console.log("[ImageBank] Upload response:", res.status, JSON.stringify(data).slice(0, 300));
      console.log("[ImageBank] Upload _debug:", JSON.stringify(data._debug));

      if (data.success && data.images) {
        const successful = data.images.filter((img: any) => img.success);
        const failed = data.images.filter((img: any) => !img.success);

        if (successful.length > 0) {
          setImages((prev) => [...successful, ...prev]);
          setUploadProgress(`${successful.length} uploaded${failed.length > 0 ? `, ${failed.length} failed` : ""} -- analyzing...`);

          for (const img of successful) {
            triggerAnalysis(img.id, false);
          }
        } else {
          setUploadProgress(`Upload failed: ${failed[0]?.error || "Unknown error"}`);
        }
      } else {
        setUploadProgress(data.error || "Upload failed");
      }
    } catch (err: any) {
      console.error("[ImageBank] Upload error:", err);
      setUploadProgress(err?.message || "Upload error");
    }

    setTimeout(() => setUploadProgress(""), 4000);
    setUploading(false);
  };

  // ── Analyze single image ──
  const triggerAnalysis = async (imageId: string, reload = true) => {
    setAnalyzingIds((prev) => new Set(prev).add(imageId));
    try {
      const res = await fetch(apiUrl("/vault/images/analyze"), {
        method: "POST",
        headers: { ...apiHeaders(false), "Content-Type": "text/plain" },
        body: JSON.stringify(corsBody(token(), { imageId })),
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  analysis: data.analysis,
                  tags: data.tags || img.tags,
                  category: data.category || img.category,
                  altText: data.altText || img.altText,
                  analyzedAt: new Date().toISOString(),
                }
              : img
          )
        );
        setInspectImage((prev) => {
          if (prev && prev.id === imageId) {
            return { ...prev, analysis: data.analysis, tags: data.tags || prev.tags, category: data.category || prev.category, altText: data.altText, analyzedAt: new Date().toISOString() };
          }
          return prev;
        });
      } else {
        console.error("[ImageBank] Analyze error:", data.error);
      }
    } catch (err) {
      console.error("[ImageBank] Analyze error:", err);
    }
    setAnalyzingIds((prev) => { const s = new Set(prev); s.delete(imageId); return s; });
  };

  // ── Analyze all unanalyzed ──
  const analyzeAll = async () => {
    const unanalyzed = images.filter((img) => !img.analysis || img.analysis._parseError);
    if (unanalyzed.length === 0) return;
    for (const img of unanalyzed.slice(0, 5)) {
      await triggerAnalysis(img.id, false);
    }
  };

  // ── Drop handler ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  };

  // ── Update tags/category ──
  const handleUpdateImage = async (imageId: string) => {
    setSaving(true);
    try {
      const body = corsBody(token(), {
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        category: editCategory,
      });
      const res = await fetch(apiUrl(`/vault/images/${imageId}`), {
        method: "PUT",
        headers: { ...apiHeaders(false), "Content-Type": "text/plain" },
        body,
      });
      const data = await res.json();
      if (data.success && data.image) {
        setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, ...data.image } : img)));
      }
    } catch (err) {
      console.error("[ImageBank] Update error:", err);
    }
    setSaving(false);
    setEditingId(null);
  };

  // ── Delete ──
  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId);
    try {
      const body = corsBody(token());
      const res = await fetch(apiUrl(`/vault/images/${imageId}`), {
        method: "DELETE",
        headers: { ...apiHeaders(false), "Content-Type": "text/plain" },
        body,
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        if (inspectImage?.id === imageId) setInspectImage(null);
      }
    } catch (err) {
      console.error("[ImageBank] Delete error:", err);
    }
    setDeletingId(null);
  };

  // ── Helpers ──
  const allTags = [...new Set(images.flatMap((img) => img.tags || []))].sort();
  const allCategories = [...new Set(images.map((img) => img.category).filter(Boolean))].sort();
  const unanalyzedCount = images.filter((img) => !img.analysis || img.analysis._parseError).length;
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.accentBg }}>
            <ImageIcon size={15} style={{ color: C.accent }} />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em" }}>
              Image Bank
            </h3>
            <p style={{ fontSize: "12px", color: C.textMuted, fontWeight: 400, lineHeight: 1.4 }}>
              Upload brand photos. AI Art Director analyzes each one.
            </p>
          </div>
        </div>
        {unanalyzedCount > 0 && images.length > 0 && (
          <button
            onClick={analyzeAll}
            disabled={analyzingIds.size > 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
            style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}`, color: C.accent, fontSize: "11px", fontWeight: 500 }}
          >
            <Sparkles size={11} />
            Analyze {unanalyzedCount}
          </button>
        )}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className="flex items-center justify-center gap-2.5 py-4 rounded-xl cursor-pointer transition-all"
        style={{
          border: `1px dashed ${dragOver ? "rgba(94,106,210,0.5)" : C.border}`,
          background: dragOver ? "rgba(94,106,210,0.04)" : "transparent",
        }}
      >
        {uploading ? (
          <Loader2 size={15} className="animate-spin" style={{ color: C.accent }} />
        ) : (
          <Upload size={14} style={{ color: C.textDim }} />
        )}
        <span style={{ fontSize: "12px", color: uploading ? C.accent : C.textDim, fontWeight: uploading ? 500 : 400 }}>
          {uploading ? uploadProgress : "Drop images or click to upload -- JPEG, PNG, WebP, GIF, SVG"}
        </span>
        <input
          ref={fileRef} type="file" className="hidden" multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          onChange={(e) => e.target.files && e.target.files.length > 0 && handleUpload(e.target.files)}
        />
      </div>

      {/* Upload progress toast */}
      <AnimatePresence>
        {uploadProgress && !uploading && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
            style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}` }}>
            <Check size={12} style={{ color: C.accent }} />
            <span style={{ fontSize: "11px", fontWeight: 500, color: C.accent }}>{uploadProgress}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
          <Filter size={12} style={{ color: C.textMuted }} />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1 rounded-lg outline-none"
            style={{ fontSize: "11px", fontWeight: 500, background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>
            <option value="">All categories</option>
            {CATEGORIES.filter((cat) => allCategories.includes(cat) || cat === filterCategory).map((cat) => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          {allTags.length > 0 && (
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
              className="px-2 py-1 rounded-lg outline-none"
              style={{ fontSize: "11px", fontWeight: 500, background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>
              <option value="">All tags</option>
              {allTags.map((tag) => (<option key={tag} value={tag}>{tag}</option>))}
            </select>
          )}
          {(filterTag || filterCategory) && (
            <button onClick={() => { setFilterTag(""); setFilterCategory(""); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
              style={{ fontSize: "11px", color: C.textMuted, border: `1px solid ${C.border}` }}>
              <X size={10} /> Clear
            </button>
          )}
          <span className="ml-auto" style={{ fontSize: "11px", color: C.textMuted }}>
            {images.length} image{images.length !== 1 ? "s" : ""}
            {analyzingIds.size > 0 && (
              <span className="ml-2" style={{ color: C.accent }}>
                <Loader2 size={10} className="inline animate-spin mr-0.5" />
                Analyzing {analyzingIds.size}...
              </span>
            )}
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin" style={{ color: C.textMuted }} />
        </div>
      )}

      {/* Images grid */}
      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
          <AnimatePresence>
            {images.map((img) => {
              const isAnalyzing = analyzingIds.has(img.id);
              const hasAnalysis = !!img.analysis && !img.analysis._parseError;
              const score = img.analysis?.brand_alignment?.score;
              return (
                <motion.div
                  key={img.id} layout
                  initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="group relative rounded-xl overflow-hidden cursor-pointer"
                  style={{ background: C.bg, border: `1px solid ${C.border}`, boxShadow: C.shadow }}
                  onClick={() => setInspectImage(img)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden relative" style={{ background: "rgba(255,255,255,0.02)" }}>
                    {img.signedUrl ? (
                      <img src={img.signedUrl} alt={img.altText || img.fileName} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={18} style={{ color: "rgba(255,255,255,0.1)" }} />
                      </div>
                    )}

                    {/* Analysis overlay */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1">
                          <Loader2 size={14} className="animate-spin text-white" />
                          <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Analyzing...</span>
                        </div>
                      </div>
                    )}

                    {/* Score badge */}
                    {hasAnalysis && score !== undefined && !isAnalyzing && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md"
                        style={{
                          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                          fontSize: "10px", fontWeight: 600,
                          color: score >= 70 ? C.accent : score >= 40 ? C.amber : C.red,
                        }}>
                        {score}/100
                      </div>
                    )}

                    {/* Analyzed dot */}
                    {hasAnalysis && !isAnalyzing && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
                        <Eye size={9} style={{ color: C.accent }} />
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="flex gap-1 pointer-events-auto">
                      {!hasAnalysis && !isAnalyzing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); triggerAnalysis(img.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                          title="Analyze with AI">
                          <Sparkles size={12} style={{ color: C.accent }} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(img.id); setEditTags((img.tags || []).join(", ")); setEditCategory(img.category || "general"); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        title="Edit tags">
                        <Tag size={12} style={{ color: C.text }} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                        disabled={deletingId === img.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        title="Delete">
                        {deletingId === img.id ? <Loader2 size={12} className="animate-spin" style={{ color: C.red }} /> : <Trash2 size={12} style={{ color: C.red }} />}
                      </button>
                    </div>
                  </div>

                  {/* Info bar */}
                  <div className="px-2.5 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    <p className="truncate" style={{ fontSize: "11px", fontWeight: 500, color: C.text, lineHeight: 1.3 }}>
                      {img.altText || img.fileName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="px-1.5 py-0.5 rounded"
                        style={{ fontSize: "9px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(255,255,255,0.04)", color: C.textMuted }}>
                        {img.category || "general"}
                      </span>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{formatSize(img.fileSize || 0)}</span>
                    </div>
                    {img.tags && img.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                        {img.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="px-1 py-0 rounded"
                            style={{ fontSize: "9px", fontWeight: 500, background: C.accentBg, color: C.accent }}>
                            {tag}
                          </span>
                        ))}
                        {img.tags.length > 3 && <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>+{img.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}` }}>
            <Grid3x3 size={18} style={{ color: C.accent }} />
          </div>
          <p style={{ fontSize: "13px", lineHeight: 1.55, color: C.textMuted, fontWeight: 400, maxWidth: 340, margin: "0 auto" }}>
            No images yet. Upload your brand photos -- each one will be analyzed by the AI Art Director.
          </p>
        </div>
      )}

      {/* ═══ Inspect Panel (slide-over) ═══ */}
      <AnimatePresence>
        {inspectImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={() => setInspectImage(null)}
          >
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] h-full overflow-y-auto"
              style={{ background: "#151413", borderLeft: `1px solid ${C.border}`, boxShadow: "-4px 0 24px rgba(0,0,0,0.15)" }}
            >
              <AnalysisPanel
                image={inspectImage}
                isAnalyzing={analyzingIds.has(inspectImage.id)}
                onClose={() => setInspectImage(null)}
                onAnalyze={() => triggerAnalysis(inspectImage.id)}
                onReanalyze={() => triggerAnalysis(inspectImage.id)}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Edit modal ═══ */}
      <AnimatePresence>
        {editingId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={() => setEditingId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-xl p-5 w-full max-w-[380px]"
              style={{ background: C.bg, border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.25)" }}>
              <div className="flex items-center justify-between mb-4">
                <h4 style={{ fontSize: "14px", fontWeight: 500, color: C.text }}>Edit image metadata</h4>
                <button onClick={() => setEditingId(null)} className="cursor-pointer"><X size={15} style={{ color: C.textMuted }} /></button>
              </div>
              {(() => {
                const img = images.find((i) => i.id === editingId);
                if (!img) return null;
                return (
                  <div className="mb-4">
                    {img.signedUrl && (
                      <div className="w-full h-32 rounded-lg overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <img src={img.signedUrl} alt={img.fileName} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="truncate" style={{ fontSize: "12px", color: C.textMuted }}>{img.fileName}</p>
                  </div>
                );
              })()}
              <label className="block mb-1" style={{ fontSize: "11px", fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Tags (comma-separated)</label>
              <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="product, hero, banner..."
                className="w-full px-3 py-2 rounded-lg outline-none mb-3"
                style={{ fontSize: "13px", fontWeight: 400, background: C.bgInner, border: `1px solid ${C.border}`, color: C.text }} />
              <label className="block mb-1" style={{ fontSize: "11px", fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Category</label>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none mb-4"
                style={{ fontSize: "13px", background: C.bgInner, border: `1px solid ${C.border}`, color: C.text }}>
                {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>))}
              </select>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ fontSize: "13px", fontWeight: 500, border: `1px solid ${C.border}`, color: C.textMuted }}>
                  Cancel
                </button>
                <button onClick={() => handleUpdateImage(editingId)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
                  style={{ background: C.accent, fontSize: "13px", fontWeight: 500, color: "#FFF" }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Analysis Panel
// ═══════════════════════════════════════════════════════════

function AnalysisPanel({
  image, isAnalyzing, onClose, onAnalyze, onReanalyze, expandedSections, toggleSection,
}: {
  image: BrandImage;
  isAnalyzing: boolean;
  onClose: () => void;
  onAnalyze: () => void;
  onReanalyze: () => void;
  expandedSections: Set<string>;
  toggleSection: (key: string) => void;
}) {
  const a = image.analysis;
  const hasAnalysis = !!a && !a._parseError;
  const score = a?.brand_alignment?.score;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
        style={{ background: "#151413", borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={14} style={{ color: C.accent }} className="flex-shrink-0" />
          <span style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>Image Analysis</span>
        </div>
        <button onClick={onClose} className="cursor-pointer p-1"><X size={15} style={{ color: C.textMuted }} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Image preview */}
        <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
          {image.signedUrl ? (
            <img src={image.signedUrl} alt={image.altText || image.fileName} className="w-full max-h-[260px] object-contain" />
          ) : (
            <div className="h-40 flex items-center justify-center"><ImageIcon size={20} style={{ color: "rgba(255,255,255,0.1)" }} /></div>
          )}
        </div>

        {/* File info + score */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>{image.fileName}</p>
            {image.altText && <p className="mt-0.5" style={{ fontSize: "12px", lineHeight: 1.4, fontStyle: "italic", color: C.textMuted }}>{image.altText}</p>}
          </div>
          {hasAnalysis && score !== undefined && (
            <div className="flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg"
              style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}` }}>
              <span style={{ fontSize: "16px", fontWeight: 600, color: C.accent, lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: "9px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>Brand fit</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!hasAnalysis && !isAnalyzing && (
          <button onClick={onAnalyze}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-opacity cursor-pointer"
            style={{ background: C.accent, fontSize: "13px", fontWeight: 500, color: "#FFF" }}>
            <Sparkles size={13} /> Analyze with AI Art Director
          </button>
        )}
        {isAnalyzing && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg"
            style={{ background: C.accentBg, border: `1px solid ${C.accentBorder}` }}>
            <Loader2 size={13} className="animate-spin" style={{ color: C.accent }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: C.accent }}>Analyzing image...</span>
          </div>
        )}

        {/* Analysis sections */}
        {hasAnalysis && a && (
          <div className="space-y-1.5">
            {a.composition && (
              <AnalysisSection icon={Layers} title="Composition" sectionKey="composition" expanded={expandedSections.has("composition")} toggle={toggleSection}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <FieldPair label="Framing" value={a.composition.framing} />
                  <FieldPair label="Orientation" value={a.composition.orientation} />
                  <FieldPair label="Depth" value={a.composition.depth} />
                  <FieldPair label="Negative space" value={a.composition.negative_space} />
                  <FieldPair label="Focal point" value={a.composition.focal_point} className="col-span-2" />
                  {a.composition.leading_lines && <FieldPair label="Leading lines" value={a.composition.leading_lines} className="col-span-2" />}
                </div>
              </AnalysisSection>
            )}

            {a.color && (
              <AnalysisSection icon={Palette} title="Color Palette" sectionKey="color" expanded={expandedSections.has("color")} toggle={toggleSection}>
                {a.color.dominant_palette && (
                  <div className="flex gap-1.5 mb-3">
                    {a.color.dominant_palette.map((hex, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: hex, border: `1px solid ${C.border}` }} />
                        <span style={{ fontSize: "8px", fontFamily: "monospace", color: C.textMuted }}>{hex}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <FieldPair label="Palette" value={a.color.palette_name} />
                  <FieldPair label="Temperature" value={a.color.temperature} />
                  <FieldPair label="Saturation" value={a.color.saturation} />
                  <FieldPair label="Contrast" value={a.color.contrast} />
                  <FieldPair label="Harmony" value={a.color.harmony} />
                </div>
              </AnalysisSection>
            )}

            {a.lighting && (
              <AnalysisSection icon={Sun} title="Lighting" sectionKey="lighting" expanded={expandedSections.has("lighting")} toggle={toggleSection}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <FieldPair label="Type" value={a.lighting.type} />
                  <FieldPair label="Direction" value={a.lighting.direction} />
                  <FieldPair label="Quality" value={a.lighting.quality} />
                  <FieldPair label="Key ratio" value={a.lighting.key_ratio} />
                  {a.lighting.mood_contribution && <FieldPair label="Mood contribution" value={a.lighting.mood_contribution} className="col-span-2" />}
                </div>
              </AnalysisSection>
            )}

            {a.subject && (
              <AnalysisSection icon={Target} title="Subject & Styling" sectionKey="subject" expanded={expandedSections.has("subject")} toggle={toggleSection}>
                <div className="space-y-2">
                  <FieldPair label="Primary subject" value={a.subject.primary} />
                  {a.subject.secondary && <FieldPair label="Secondary" value={a.subject.secondary} />}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <FieldPair label="Human presence" value={a.subject.human_presence} />
                    <FieldPair label="Environment" value={a.subject.environment} />
                  </div>
                  {a.subject.props_styling && <FieldPair label="Props & styling" value={a.subject.props_styling} />}
                </div>
              </AnalysisSection>
            )}

            {a.mood && (
              <AnalysisSection icon={Zap} title="Mood & Emotion" sectionKey="mood" expanded={expandedSections.has("mood")} toggle={toggleSection}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <FieldPair label="Primary emotion" value={a.mood.primary_emotion} />
                  <FieldPair label="Energy" value={a.mood.energy} />
                  <FieldPair label="Sophistication" value={a.mood.sophistication} />
                </div>
                {a.mood.secondary_emotions && a.mood.secondary_emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.mood.secondary_emotions.map((em, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded"
                        style={{ fontSize: "10px", fontWeight: 500, background: C.bgInner, color: C.textMuted, border: `1px solid ${C.border}` }}>
                        {em}
                      </span>
                    ))}
                  </div>
                )}
              </AnalysisSection>
            )}

            {a.technique && (
              <AnalysisSection icon={Camera} title="Photographic Technique" sectionKey="technique" expanded={expandedSections.has("technique")} toggle={toggleSection}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <FieldPair label="Focal length" value={a.technique.estimated_focal_length} />
                  <FieldPair label="DOF" value={a.technique.depth_of_field} />
                  <FieldPair label="Shutter feel" value={a.technique.shutter_feel} />
                  <FieldPair label="Style" value={a.technique.style_reference} />
                  {a.technique.post_processing && <FieldPair label="Post-processing" value={a.technique.post_processing} className="col-span-2" />}
                </div>
              </AnalysisSection>
            )}

            {a.brand_alignment && (
              <AnalysisSection icon={Target} title="Brand Alignment" sectionKey="brand" expanded={expandedSections.has("brand")} toggle={toggleSection}>
                {a.brand_alignment.strengths && a.brand_alignment.strengths.length > 0 && (
                  <div className="mb-3">
                    <span className="block mb-1.5" style={{ fontSize: "9px", fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em" }}>Strengths</span>
                    <ul className="space-y-1">
                      {a.brand_alignment.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check size={10} className="flex-shrink-0" style={{ color: C.green, marginTop: 2 }} />
                          <span style={{ fontSize: "11px", lineHeight: 1.45, color: C.text }}>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.brand_alignment.concerns && a.brand_alignment.concerns.length > 0 && (
                  <div className="mb-3">
                    <span className="block mb-1.5" style={{ fontSize: "9px", fontWeight: 600, color: C.amber, textTransform: "uppercase", letterSpacing: "0.08em" }}>Concerns</span>
                    <ul className="space-y-1">
                      {a.brand_alignment.concerns.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <X size={10} className="flex-shrink-0" style={{ color: C.amber, marginTop: 2 }} />
                          <span style={{ fontSize: "11px", lineHeight: 1.45, color: C.text }}>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.brand_alignment.recommended_usage && a.brand_alignment.recommended_usage.length > 0 && (
                  <div>
                    <span className="block mb-1.5" style={{ fontSize: "9px", fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recommended for</span>
                    <div className="flex flex-wrap gap-1">
                      {a.brand_alignment.recommended_usage.map((u, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: "10px", fontWeight: 500, background: C.accentBg, color: C.accent }}>
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </AnalysisSection>
            )}

            {/* Re-analyze */}
            <div className="pt-3">
              <button onClick={onReanalyze} disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                style={{ fontSize: "11px", fontWeight: 500, border: `1px solid ${C.border}`, color: C.textMuted }}>
                <Sparkles size={10} /> Re-analyze
              </button>
              {image.analyzedAt && (
                <span className="ml-2" style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                  Last: {new Date(image.analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Raw fallback */}
        {a && a._parseError && a._raw && (
          <div className="p-3 rounded-lg" style={{ background: C.bgInner, border: `1px solid ${C.border}` }}>
            <span className="block mb-1" style={{ fontSize: "10px", fontWeight: 600, color: C.textMuted }}>Raw analysis (parse error)</span>
            <pre className="whitespace-pre-wrap" style={{ fontSize: "11px", lineHeight: 1.4, color: C.text }}>{a._raw}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function AnalysisSection({
  icon: Icon, title, sectionKey, expanded, toggle, children,
}: {
  icon: any; title: string; sectionKey: string; expanded: boolean; toggle: (k: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.bg, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <button onClick={() => toggle(sectionKey)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 transition-colors text-left cursor-pointer"
        style={{ background: "transparent" }}>
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: C.accent, opacity: 0.6 }} />
          <span style={{ fontSize: "12px", fontWeight: 500, color: C.text }}>{title}</span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} style={{ color: C.textMuted }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}>
            <div className="px-3.5 pb-3 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldPair({ label, value, className = "" }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="block" style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>
        {label}
      </span>
      <span style={{ fontSize: "12px", lineHeight: 1.4, color: C.text }}>{value}</span>
    </div>
  );
}