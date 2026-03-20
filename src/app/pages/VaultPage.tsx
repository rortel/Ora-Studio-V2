import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe, Upload, Loader2, Check, X, Plus,
  Palette, Users, Target, Megaphone, Sparkles,
  Camera, Type, FileText, ArrowRight, RefreshCw,
  Instagram, Linkedin, Twitter, Facebook, Youtube,
  Building2, ShoppingBag, Eye, Paintbrush, Image as ImageIcon,
  Layers, ChevronDown, Shield, Save,
} from "lucide-react";
import { apiUrl, apiHeaders } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { RouteGuard } from "../components/RouteGuard";
import { ImageBank } from "../components/ImageBank";

// ── Helpers ──

function corsBody(token: string | null, data?: Record<string, any>): string {
  return JSON.stringify({ _token: token || "", ...data });
}

// ── Types ──

interface VaultData {
  company_name: string;
  industry: string;
  tagline: string | null;
  products_services: string[];
  target_audiences: { name: string; description: string }[];
  colors: { hex: string; name: string; role: string }[];
  logo_url: string | null;
  logo_description: string | null;
  tone: { formality: number; confidence: number; warmth: number; humor: number; primary_tone: string; adjectives: string[] } | null;
  photo_style: { framing: string; mood: string; lighting: string; subjects: string } | null;
  social_presence: { platform: string; url: string | null; detected: boolean }[];
  key_messages: string[];
  approved_terms: string[];
  forbidden_terms: string[];
  fonts: string[];
  confidence_score: number;
  source_url: string | null;
  updatedAt: string | null;
}

const EMPTY_VAULT: VaultData = {
  company_name: "", industry: "", tagline: null, products_services: [], target_audiences: [],
  colors: [], logo_url: null, logo_description: null, tone: null, photo_style: null,
  social_presence: [], key_messages: [], approved_terms: [], forbidden_terms: [],
  fonts: [], confidence_score: 0, source_url: null, updatedAt: null,
};

// ── Merge logic: enrich existing vault with incoming file DNA ──
// A brand charter is authoritative on directives (tone, colors, fonts,
// photo style, vocabulary). Those fields from the file OVERRIDE or
// COMPLETE existing data. Factual / detection fields (social presence,
// source_url, logo) keep the URL-scan values.

function mergeVaultData(existing: VaultData, incoming: Partial<VaultData>): VaultData {
  // Helper: dedupe string arrays (case-insensitive)
  const dedupeStrings = (a: string[], b: string[]): string[] => {
    const seen = new Set(a.map(s => s.toLowerCase()));
    const merged = [...a];
    for (const item of b) {
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        merged.push(item);
      }
    }
    return merged;
  };

  // Helper: dedupe colors by hex
  const dedupeColors = (
    a: { hex: string; name: string; role: string }[],
    b: { hex: string; name: string; role: string }[]
  ) => {
    const seen = new Set(a.map(c => c.hex.toLowerCase()));
    const merged = [...a];
    for (const color of b) {
      if (!seen.has(color.hex.toLowerCase())) {
        seen.add(color.hex.toLowerCase());
        merged.push(color);
      }
    }
    return merged;
  };

  // Helper: dedupe audiences by name
  const dedupeAudiences = (
    a: { name: string; description: string }[],
    b: { name: string; description: string }[]
  ) => {
    const seen = new Set(a.map(x => x.name.toLowerCase()));
    const merged = [...a];
    for (const aud of b) {
      if (!seen.has(aud.name.toLowerCase())) {
        seen.add(aud.name.toLowerCase());
        merged.push(aud);
      }
    }
    return merged;
  };

  // Helper: merge social presence by platform
  const mergeSocial = (
    a: { platform: string; url: string | null; detected: boolean }[],
    b: { platform: string; url: string | null; detected: boolean }[]
  ) => {
    const map = new Map(a.map(s => [s.platform.toLowerCase(), s]));
    for (const s of b) {
      const key = s.platform.toLowerCase();
      const ex = map.get(key);
      if (!ex) {
        map.set(key, s);
      } else if (s.detected && (!ex.detected || !ex.url)) {
        map.set(key, { ...ex, detected: true, url: s.url || ex.url });
      }
    }
    return [...map.values()];
  };

  // Tone: charter is authoritative on voice directives.
  // If incoming has tone data, its non-zero values override.
  // Adjectives are merged.
  const mergeTone = (
    a: VaultData["tone"],
    b: VaultData["tone"]
  ): VaultData["tone"] => {
    if (!b) return a;
    if (!a) return b;
    return {
      formality: b.formality || a.formality,
      confidence: b.confidence || a.confidence,
      warmth: b.warmth || a.warmth,
      humor: b.humor || a.humor,
      primary_tone: b.primary_tone || a.primary_tone,
      adjectives: dedupeStrings(a.adjectives || [], b.adjectives || []),
    };
  };

  // Photo style: charter is authoritative on visual directives.
  // Non-empty incoming values override.
  const mergePhotoStyle = (
    a: VaultData["photo_style"],
    b: VaultData["photo_style"]
  ): VaultData["photo_style"] => {
    if (!b) return a;
    if (!a) return b;
    return {
      framing: b.framing || a.framing,
      mood: b.mood || a.mood,
      lighting: b.lighting || a.lighting,
      subjects: b.subjects || a.subjects,
    };
  };

  return {
    // Factual: keep URL scan unless empty
    company_name: existing.company_name || incoming.company_name || "",
    industry: existing.industry || incoming.industry || "",
    tagline: existing.tagline || incoming.tagline || null,
    logo_url: existing.logo_url || incoming.logo_url || null,
    logo_description: existing.logo_description || incoming.logo_description || null,
    source_url: existing.source_url || incoming.source_url || null,

    // Directive lists: charter enriches (union + dedupe)
    colors: dedupeColors(existing.colors || [], incoming.colors || []),
    products_services: dedupeStrings(existing.products_services || [], incoming.products_services || []),
    target_audiences: dedupeAudiences(existing.target_audiences || [], incoming.target_audiences || []),
    key_messages: dedupeStrings(existing.key_messages || [], incoming.key_messages || []),
    approved_terms: dedupeStrings(existing.approved_terms || [], incoming.approved_terms || []),
    forbidden_terms: dedupeStrings(existing.forbidden_terms || [], incoming.forbidden_terms || []),
    fonts: dedupeStrings(existing.fonts || [], incoming.fonts || []),

    // Directive objects: charter overrides non-empty fields
    tone: mergeTone(existing.tone, incoming.tone ?? null),
    photo_style: mergePhotoStyle(existing.photo_style, incoming.photo_style ?? null),

    // Detection: merge by platform
    social_presence: mergeSocial(existing.social_presence || [], incoming.social_presence || []),

    // Score: keep highest
    confidence_score: Math.max(existing.confidence_score || 0, incoming.confidence_score || 0),

    // Timestamp: always update
    updatedAt: existing.updatedAt,
  };
}

// ── Exports ──

export function VaultPage() {
  return (
    <RouteGuard requireAuth requireFeature="vault">
      <VaultPageContent />
    </RouteGuard>
  );
}

// ── Main ──

function VaultPageContent() {
  const [vault, setVault] = useState<VaultData>(EMPTY_VAULT);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const { accessToken } = useAuth();
  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  const token = () => tokenRef.current || "";
  const hasData = !!vault.company_name;

  // ── Load ──
  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(apiUrl("/vault"), {
          method: "POST", headers: vaultHeaders(), body: corsBody(accessToken),
        });
        const data = await res.json();
        console.log("[Vault] Load response:", data.success, data.vault ? "has vault" : "no vault");
        if (data.success && data.vault) {
          setVault((prev) => ({ ...prev, ...data.vault }));
          if (data.vault.source_url) setUrlInput(data.vault.source_url);
        }
      } catch (err) { console.error("[Vault] Load error:", err); }
      setLoading(false);
    })();
  }, [accessToken]);

  // ── Save ──
  const saveVault = useCallback(async (newVault?: VaultData) => {
    const v = newVault || vault;
    setSaving(true);
    try {
      await fetch(apiUrl("/vault"), {
        method: "POST", headers: vaultHeaders(), body: corsBody(token(), v),
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) { console.error("[Vault] Save error:", err); }
    setSaving(false);
  }, [vault]);

  // ── Analyze URL ──
  const handleAnalyzeUrl = async (deepScan = false) => {
    let url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeProgress(deepScan ? "Deep scanning website + sub-pages..." : "Scanning website...");
    try {
      console.log("[Vault] Analyzing URL:", url, "deep:", deepScan);
      const res = await fetch(apiUrl("/vault/analyze"), {
        method: "POST", headers: vaultHeaders(), body: corsBody(token(), { url, deep: deepScan }),
      });
      const data = await res.json();
      if (data.success && data.dna) {
        const updated = { ...vault, ...data.dna, source_url: url, updatedAt: new Date().toISOString() };
        setVault(updated);
        setAnalyzeProgress("Saving to vault...");
        await saveVault(updated);
        setAnalyzeProgress("Saved!");
        setTimeout(() => setAnalyzeProgress(""), 2000);
      } else {
        setAnalyzeError(data.error || `Analysis failed (${res.status})`);
      }
    } catch (err: any) {
      console.error("[Vault] Analyze network error:", err);
      setAnalyzeError(err?.message || "Network error");
    }
    setAnalyzing(false);
  };

  // ── Analyze File ──
  const handleFile = async (file: File) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeProgress(`Analyzing ${file.name}...`);
    try {
      const isImage = file.type.startsWith("image/");
      if (isImage || file.type === "application/pdf" || file.name.match(/\.(pptx?|docx?)$/i)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("_token", token());
        const res = await fetch(apiUrl("/vault/analyze-file"), { method: "POST", headers: vaultFormHeaders(), body: formData });
        const data = await res.json();
        if (data.success && data.extractedText) {
          const res2 = await fetch(apiUrl("/vault/analyze"), {
            method: "POST", headers: vaultHeaders(),
            body: corsBody(token(), { content: data.extractedText, sourceName: file.name, sourceType: file.type }),
          });
          const data2 = await res2.json();
          if (data2.success && data2.dna) {
            const updated = mergeVaultData(vault, data2.dna);
            updated.updatedAt = new Date().toISOString();
            setVault(updated);
            setAnalyzeProgress("Saving to vault...");
            await saveVault(updated);
            setAnalyzeProgress("Saved!");
            setTimeout(() => setAnalyzeProgress(""), 2000);
          } else { setAnalyzeError(data2.error || "Analysis failed"); }
        } else { setAnalyzeError(data.error || "Could not extract content from file"); }
      } else {
        const text = await file.text();
        if (text.length < 50) { setAnalyzeError("File content too short"); setAnalyzing(false); return; }
        const res = await fetch(apiUrl("/vault/analyze"), {
          method: "POST", headers: vaultHeaders(),
          body: corsBody(token(), { content: text, sourceName: file.name, sourceType: "file" }),
        });
        const data = await res.json();
        if (data.success && data.dna) {
          const updated = mergeVaultData(vault, data.dna);
          updated.updatedAt = new Date().toISOString();
          setVault(updated);
          setAnalyzeProgress("Saving to vault...");
          await saveVault(updated);
          setAnalyzeProgress("Saved!");
          setTimeout(() => setAnalyzeProgress(""), 2000);
        } else { setAnalyzeError(data.error || "Analysis failed"); }
      }
    } catch (err: any) { setAnalyzeError(err?.message || "File analysis error"); }
    setAnalyzing(false);
  };

  // ── Logo Upload ──
  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("_token", token());
      const res = await fetch(apiUrl("/vault/upload-logo"), { method: "POST", headers: vaultFormHeaders(), body: formData });
      const data = await res.json();
      if (data.success && data.logoUrl) {
        const updated = { ...vault, logo_url: data.logoUrl };
        setVault(updated as VaultData);
        await saveVault(updated as VaultData);
      }
    } catch (err) { console.error("[Vault] Logo upload error:", err); }
    setLogoUploading(false);
  };

  // ── Drop zone ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const socialIcons: Record<string, any> = {
    instagram: Instagram, linkedin: Linkedin, twitter: Twitter, x: Twitter,
    facebook: Facebook, youtube: Youtube,
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const isOpen = (id: string) => !collapsedSections.has(id);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: "#5E6AD2" }} />
      </div>
    );
  }

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 md:py-16">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-3 uppercase" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em", color: "#5E6AD2" }}>
              Brand Intelligence
            </p>
            <h1 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.15, color: "#E8E4DF" }}>
              Brand Vault
            </h1>
            <p className="mt-2" style={{ fontSize: "15px", lineHeight: 1.55, color: "#9A9590", fontWeight: 400, maxWidth: 460 }}>
              Your brand DNA, extracted and structured. Drop a URL, a PDF, or an image.
            </p>
          </div>
          {hasData && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => saveVault()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg cursor-pointer disabled:opacity-50 transition-all shrink-0"
              style={{
                background: saveOk ? "rgba(16,185,129,0.12)" : "rgba(94,106,210,0.12)",
                border: saveOk ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(94,106,210,0.25)",
                fontSize: "13px",
                fontWeight: 500,
                color: saveOk ? "#10B981" : "#5E6AD2",
              }}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saveOk ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving..." : saveOk ? "Saved" : "Save"}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── Scanner ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-xl p-5 mb-10"
        style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}>

        {/* URL row */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Globe size={15} style={{ color: "#5E6AD2", opacity: 0.7 }} />
            <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !analyzing && handleAnalyzeUrl()}
              placeholder="yourcompany.com" disabled={analyzing}
              className="flex-1 bg-transparent outline-none placeholder:text-white/15"
              style={{ fontSize: "14px", color: "#E8E4DF", fontWeight: 400 }} />
          </div>
          <button
            onClick={() => handleAnalyzeUrl(false)} disabled={analyzing || !urlInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg cursor-pointer disabled:opacity-30 transition-opacity"
            style={{ background: "#5E6AD2", fontSize: "13px", fontWeight: 500, color: "#FFF" }}>
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Scan
          </button>
          <button
            onClick={() => handleAnalyzeUrl(true)} disabled={analyzing || !urlInput.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-30 transition-opacity"
            style={{ border: "1px solid rgba(255,255,255,0.10)", fontSize: "13px", fontWeight: 500, color: "#E8E4DF" }}>
            <Layers size={13} /> Deep
          </button>
        </div>

        {/* File drop */}
        <div onClick={() => !analyzing && fileRef.current?.click()}
          className="flex items-center justify-center gap-2.5 py-3.5 rounded-lg cursor-pointer transition-all"
          style={{
            border: `1px dashed ${dragOver ? "rgba(94,106,210,0.5)" : "rgba(255,255,255,0.08)"}`,
            background: dragOver ? "rgba(94,106,210,0.04)" : "transparent",
          }}>
          <Upload size={14} style={{ color: "rgba(255,255,255,0.25)" }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>
            Drop or click -- PDF, PPT, DOCX, images
          </span>
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.svg"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Progress / Error */}
        <AnimatePresence>
          {(analyzing || analyzeProgress) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {analyzing ? (
                <Loader2 size={13} className="animate-spin" style={{ color: "#5E6AD2" }} />
              ) : analyzeProgress === "Saved!" ? (
                <Check size={13} style={{ color: "#10B981" }} />
              ) : null}
              <span style={{ fontSize: "12px", fontWeight: 500, color: analyzeProgress === "Saved!" ? "#10B981" : "#5E6AD2" }}>
                {analyzeProgress}
              </span>
            </motion.div>
          )}
          {analyzeError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <X size={13} style={{ color: "#C45050" }} />
              <span style={{ fontSize: "12px", color: "#C45050" }}>{analyzeError}</span>
              <button onClick={() => setAnalyzeError(null)} className="ml-auto cursor-pointer">
                <X size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Brand Data ── */}
      <AnimatePresence>
        {hasData && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

            {/* ═══ IDENTITY HEADER ═══ */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6 mb-6"
              style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Logo */}
                  <div className="relative group shrink-0">
                    {vault.logo_url ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/90 flex items-center justify-center"
                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
                        <img src={vault.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                        onClick={() => logoRef.current?.click()}
                        style={{ background: "rgba(94,106,210,0.08)", border: "1px dashed rgba(94,106,210,0.3)" }}>
                        {logoUploading ? <Loader2 size={16} className="animate-spin" style={{ color: "#5E6AD2" }} /> : <Plus size={16} style={{ color: "#5E6AD2" }} />}
                      </div>
                    )}
                    {vault.logo_url && (
                      <button onClick={() => logoRef.current?.click()}
                        className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <RefreshCw size={12} className="text-white" />
                      </button>
                    )}
                    <input ref={logoRef} type="file" className="hidden" accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  </div>

                  <div>
                    <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#E8E4DF", letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                      {vault.company_name}
                    </h2>
                    {vault.industry && (
                      <span style={{ fontSize: "13px", fontWeight: 400, color: "#9A9590" }}>{vault.industry}</span>
                    )}
                    {vault.tagline && (
                      <p style={{ fontSize: "13px", color: "#9A9590", fontStyle: "italic", marginTop: 2 }}>"{vault.tagline}"</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {vault.confidence_score > 0 && (
                    <div className="flex items-baseline gap-1 px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(94,106,210,0.08)", border: "1px solid rgba(94,106,210,0.15)" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "#5E6AD2" }}>{vault.confidence_score}</span>
                      <span style={{ fontSize: "10px", color: "rgba(94,106,210,0.6)", fontWeight: 500 }}>/100</span>
                    </div>
                  )}
                  {vault.source_url && (
                    <button onClick={() => handleAnalyzeUrl(true)} disabled={analyzing}
                      className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-white/[0.06]"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                      <RefreshCw size={13} className={analyzing ? "animate-spin" : ""} style={{ color: "#9A9590" }} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ═══ DATA SECTIONS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Colors */}
              <SectionCard icon={Palette} title="Brand Colors" count={vault.colors.length}
                open={isOpen("colors")} onToggle={() => toggleSection("colors")}>
                {vault.colors.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      {vault.colors.map((c, i) => (
                        <div key={i} className="flex-1 transition-all hover:flex-[2] cursor-pointer"
                          style={{ background: c.hex }} title={`${c.name || c.hex} -- ${c.role}`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {vault.colors.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="w-3 h-3 rounded-full" style={{ background: c.hex }} />
                          <span style={{ fontSize: "11px", fontWeight: 500, color: "#E8E4DF", fontFamily: "monospace" }}>{c.hex}</span>
                          {c.name && <span style={{ fontSize: "10px", color: "#9A9590" }}>{c.name}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Tone of Voice */}
              <SectionCard icon={Megaphone} title="Tone of Voice" count={vault.tone?.adjectives?.length || 0}
                open={isOpen("tone")} onToggle={() => toggleSection("tone")}>
                {vault.tone ? (
                  <div className="space-y-3">
                    {vault.tone.primary_tone && (
                      <span className="inline-block px-3 py-1.5 rounded-lg"
                        style={{ background: "rgba(94,106,210,0.12)", border: "1px solid rgba(94,106,210,0.2)", color: "#5E6AD2", fontSize: "12px", fontWeight: 500 }}>
                        {vault.tone.primary_tone}
                      </span>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      <ToneGauge label="Formality" value={vault.tone.formality} />
                      <ToneGauge label="Confidence" value={vault.tone.confidence} />
                      <ToneGauge label="Warmth" value={vault.tone.warmth} />
                      <ToneGauge label="Humor" value={vault.tone.humor} />
                    </div>
                    {vault.tone.adjectives?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {vault.tone.adjectives.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 rounded"
                            style={{ fontSize: "11px", fontWeight: 500, background: "rgba(94,106,210,0.08)", color: "#5E6AD2" }}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Audiences */}
              <SectionCard icon={Users} title="Target Audiences" count={vault.target_audiences.length}
                open={isOpen("audiences")} onToggle={() => toggleSection("audiences")}>
                {vault.target_audiences.length > 0 ? (
                  <div className="space-y-2">
                    {vault.target_audiences.map((a, i) => (
                      <div key={i} className="p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#E8E4DF" }}>{a.name}</span>
                        {a.description && (
                          <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#9A9590", marginTop: 3 }}>{a.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Products */}
              <SectionCard icon={ShoppingBag} title="Products & Services" count={vault.products_services.length}
                open={isOpen("products")} onToggle={() => toggleSection("products")}>
                {vault.products_services.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {vault.products_services.map((p, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg"
                        style={{ fontSize: "12px", fontWeight: 500, background: "rgba(255,255,255,0.04)", color: "#E8E4DF", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {p}
                      </span>
                    ))}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Visual Style */}
              <SectionCard icon={Camera} title="Visual Style" count={vault.photo_style ? 4 : 0}
                open={isOpen("photo")} onToggle={() => toggleSection("photo")}>
                {vault.photo_style ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: "Framing", value: vault.photo_style.framing },
                      { label: "Mood", value: vault.photo_style.mood },
                      { label: "Lighting", value: vault.photo_style.lighting },
                      { label: "Subjects", value: vault.photo_style.subjects },
                    ].filter(x => x.value).map((x, i) => (
                      <div key={i} className="p-2.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "9px", fontWeight: 600, color: "#5E6AD2", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {x.label}
                        </span>
                        <p style={{ fontSize: "12px", fontWeight: 500, color: "#E8E4DF", marginTop: 3 }}>{x.value}</p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Social Presence */}
              <SectionCard icon={Target} title="Social Presence"
                count={vault.social_presence.filter(s => s.detected).length}
                open={isOpen("social")} onToggle={() => toggleSection("social")}>
                {vault.social_presence.filter(s => s.detected).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {vault.social_presence.filter(s => s.detected).map((s, i) => {
                      const Icon = socialIcons[s.platform.toLowerCase()] || Globe;
                      return (
                        <a key={i} href={s.url || "#"} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-white/[0.06]"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                          <Icon size={14} style={{ color: "#9A9590" }} />
                          <span className="capitalize" style={{ fontSize: "12px", fontWeight: 500, color: "#E8E4DF" }}>
                            {s.platform}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Typography */}
              <SectionCard icon={Type} title="Typography" count={vault.fonts.length}
                open={isOpen("fonts")} onToggle={() => toggleSection("fonts")}>
                {vault.fonts.length > 0 ? (
                  <div className="space-y-1.5">
                    {vault.fonts.map((f, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-lg flex items-center justify-between"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "15px", fontWeight: 500, color: "#E8E4DF", fontFamily: f }}>{f}</span>
                        <span style={{ fontSize: "9px", color: "#9A9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Font</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Key Messages */}
              <SectionCard icon={FileText} title="Key Messages" count={vault.key_messages.length}
                open={isOpen("messages")} onToggle={() => toggleSection("messages")}>
                {vault.key_messages.length > 0 ? (
                  <div className="space-y-1.5">
                    {vault.key_messages.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(94,106,210,0.04)", border: "1px solid rgba(94,106,210,0.08)" }}>
                        <ArrowRight size={11} style={{ color: "#5E6AD2", marginTop: 3, flexShrink: 0, opacity: 0.6 }} />
                        <span style={{ fontSize: "12px", lineHeight: 1.55, color: "#E8E4DF" }}>{m}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </SectionCard>

              {/* Vocabulary -- full width */}
              <div className="md:col-span-2">
                <SectionCard icon={Paintbrush} title="Vocabulary"
                  count={vault.approved_terms.length + vault.forbidden_terms.length}
                  open={isOpen("vocab")} onToggle={() => toggleSection("vocab")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Approved
                        </span>
                      </div>
                      {vault.approved_terms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {vault.approved_terms.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded"
                              style={{ fontSize: "11px", fontWeight: 500, background: "rgba(16,185,129,0.08)", color: "#10B981", border: "1px solid rgba(16,185,129,0.15)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ fontSize: "11px", color: "#9A9590" }}>--</span>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#EF4444" }} />
                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Forbidden
                        </span>
                      </div>
                      {vault.forbidden_terms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {vault.forbidden_terms.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded"
                              style={{ fontSize: "11px", fontWeight: 500, background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ fontSize: "11px", color: "#9A9590" }}>--</span>}
                    </div>
                  </div>
                </SectionCard>
              </div>

            </div>

            {/* Footer meta */}
            {vault.updatedAt && (
              <p className="text-center pt-6" style={{ fontSize: "11px", color: "#9A9590", fontWeight: 400 }}>
                Last updated {new Date(vault.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {vault.source_url && <> from <span style={{ color: "#E8E4DF" }}>{vault.source_url}</span></>}
              </p>
            )}

            {/* Image Bank */}
            <div className="mt-8">
              <ImageBank accessToken={accessToken} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!hasData && !loading && !analyzing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center py-20">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(94,106,210,0.08)", border: "1px solid rgba(94,106,210,0.15)" }}>
            <Building2 size={24} style={{ color: "#5E6AD2" }} />
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: 500, color: "#E8E4DF", letterSpacing: "-0.02em" }}>
            No brand data yet
          </h3>
          <p className="max-w-[380px] mx-auto mt-2" style={{ fontSize: "14px", lineHeight: 1.6, color: "#9A9590", fontWeight: 400 }}>
            Enter your company URL or upload a brand guidelines document above. ORA will extract everything automatically.
          </p>
        </motion.div>
      )}

      {!loading && !hasData && accessToken && <ImageBank accessToken={accessToken} />}
    </div>
  );
}

// ════════════════════════════════════════
// SECTION CARD
// ════════════════════════════════════════

function SectionCard({ icon: Icon, title, count, children, open, onToggle }: {
  icon: any; title: string; count: number;
  children: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.02]"
        style={{ background: "transparent" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(94,106,210,0.08)" }}>
            <Icon size={15} style={{ color: "#5E6AD2" }} />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#E8E4DF" }}>{title}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.5 rounded"
              style={{ fontSize: "10px", fontWeight: 500, background: "rgba(255,255,255,0.06)", color: "#9A9590" }}>
              {count}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} style={{ color: "#9A9590" }} />
        </motion.div>
      </button>

      {/* Content -- open by default */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden">
            <div className="px-5 pb-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="pt-3">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════

function ToneGauge({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, (value / 10) * 100));
  return (
    <div className="p-2.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: "10px", fontWeight: 500, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E4DF" }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="h-full rounded-full"
          style={{ background: "#5E6AD2" }}
        />
      </div>
    </div>
  );
}

function EmptyState() {
  return <span style={{ fontSize: "12px", color: "#9A9590", fontWeight: 400 }}>Not detected yet</span>;
}

// ════════════════════════════════════════
// API HELPERS
// ════════════════════════════════════════

function vaultHeaders(): Record<string, string> {
  return { ...apiHeaders(false), "Content-Type": "text/plain" };
}

function vaultFormHeaders(): Record<string, string> {
  return apiHeaders(false);
}