import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import {
  Globe, Palette, BookOpen, Users, Target, Shield,
  ArrowLeft, Save, Loader2, Search, Sparkles, AlertCircle,
  Check, ExternalLink, FileText, Upload, Plus, X,
} from "lucide-react";
import { API_BASE, apiHeaders } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

const defaultSections = [
  { icon: "Globe", title: "Digital Presence", status: "Incomplete", score: 0, items: [{ label: "Website crawled", value: "Not set" }, { label: "Social profiles", value: "Not set" }, { label: "Last updated", value: "Never" }] },
  { icon: "Palette", title: "Tone & Voice", status: "Incomplete", score: 0, items: [{ label: "Formality", value: "Not set" }, { label: "Confidence", value: "Not set" }, { label: "Warmth", value: "Not set" }, { label: "Humor", value: "Not set" }] },
  { icon: "BookOpen", title: "Vocabulary", status: "Incomplete", score: 0, items: [{ label: "Approved terms", value: "0 words" }, { label: "Forbidden terms", value: "0 words" }, { label: "Brand-specific", value: "0 terms" }] },
  { icon: "Users", title: "Audiences", status: "Incomplete", score: 0, items: [{ label: "Primary persona", value: "Not set" }, { label: "Secondary", value: "Not set" }, { label: "Tertiary", value: "Not set" }] },
  { icon: "Target", title: "Competitors", status: "Incomplete", score: 0, items: [{ label: "Tracked", value: "0 competitors" }, { label: "Differentiation score", value: "N/A" }, { label: "Voice overlap risk", value: "N/A" }] },
  { icon: "Shield", title: "Compliance Rules", status: "Incomplete", score: 0, items: [{ label: "Regulatory", value: "Not set" }, { label: "Legal disclaimers", value: "0 active" }, { label: "Accessibility", value: "Not set" }] },
];

const iconMap: Record<string, typeof Globe> = { Globe, Palette, BookOpen, Users, Target, Shield };

interface VaultSection {
  icon: string;
  title: string;
  status: string;
  score: number;
  items: { label: string; value: string }[];
}

interface VaultData {
  sections: VaultSection[];
  approvedTerms: string[];
  forbiddenTerms: string[];
  brandName: string;
  companyUrl?: string;
  guidelinesFileName?: string;
  colors?: string[];
  fonts?: string[];
  keyMessages?: string[];
  updatedAt?: string;
}

export function VaultPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<VaultSection[]>(defaultSections);
  const [approvedTerms, setApprovedTerms] = useState<string[]>([]);
  const [forbiddenTerms, setForbiddenTerms] = useState<string[]>([]);
  const [brandName, setBrandName] = useState("Your Brand");
  const [companyUrl, setCompanyUrl] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [newTerm, setNewTerm] = useState("");
  const [newForbidden, setNewForbidden] = useState("");
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [colors, setColors] = useState<string[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [keyMessages, setKeyMessages] = useState<string[]>([]);
  const [guidelinesFileName, setGuidelinesFileName] = useState<string | null>(null);

  // URL scan state
  const [urlInput, setUrlInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  // Guidelines upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { getAuthHeader } = useAuth();

  // Load vault
  useEffect(() => {
    (async () => {
      try {
        const token = getAuthHeader();
        const res = await fetch(`${API_BASE}/vault`, { headers: apiHeaders(token, false) });
        const data = await res.json();
        if (data.success && data.vault) {
          const v = data.vault as VaultData;
          if (v.sections) setSections(v.sections);
          if (v.approvedTerms) setApprovedTerms(v.approvedTerms);
          if (v.forbiddenTerms) setForbiddenTerms(v.forbiddenTerms);
          if (v.brandName) setBrandName(v.brandName);
          if (v.companyUrl) { setCompanyUrl(v.companyUrl); setUrlInput(v.companyUrl); }
          if (v.guidelinesFileName) setGuidelinesFileName(v.guidelinesFileName);
          if (v.colors) setColors(v.colors);
          if (v.fonts) setFonts(v.fonts);
          if (v.keyMessages) setKeyMessages(v.keyMessages);
          if (v.updatedAt) setLastUpdated(v.updatedAt);
        }
      } catch (err) {
        console.error("Failed to load vault:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [getAuthHeader]);

  // Save vault
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const token = getAuthHeader();
      await fetch(`${API_BASE}/vault`, {
        method: "PUT",
        headers: apiHeaders(token),
        body: JSON.stringify({ sections, approvedTerms, forbiddenTerms, brandName, companyUrl, guidelinesFileName, colors, fonts, keyMessages }),
      });
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error("Failed to save vault:", err);
    } finally {
      setSaving(false);
    }
  }, [sections, approvedTerms, forbiddenTerms, brandName, companyUrl, guidelinesFileName, colors, fonts, keyMessages, getAuthHeader]);

  // ── URL Scan ──
  const handleScanUrl = async () => {
    let url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;
    setScanning(true);
    setScanError(null);
    setScanSuccess(false);
    try {
      const token = getAuthHeader();
      const res = await fetch(`${API_BASE}/vault/scan-url`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.success) {
        setScanError(data.error || "Scan failed");
        return;
      }
      const s = data.scan;
      // Apply scan results to vault
      if (s.brandName) setBrandName(s.brandName);
      setCompanyUrl(url);

      // Update sections from scan
      setSections((prev) => prev.map((sec) => {
        if (sec.title === "Digital Presence") {
          return { ...sec, score: 85, status: "Complete", items: [
            { label: "Website crawled", value: `${url} (${s.wordCount || 0} words)` },
            { label: "Social profiles", value: (s.socialProfiles || []).join(", ") || "None detected" },
            { label: "Last updated", value: "Just now" },
          ]};
        }
        if (sec.title === "Tone & Voice" && s.tone) {
          return { ...sec, score: Math.round(((s.tone.formality + s.tone.confidence + s.tone.warmth + (10 - s.tone.humor)) / 4) * 10), status: "Complete", items: [
            { label: "Formality", value: `${s.tone.formality} / 10` },
            { label: "Confidence", value: `${s.tone.confidence} / 10` },
            { label: "Warmth", value: `${s.tone.warmth} / 10` },
            { label: "Humor", value: `${s.tone.humor} / 10` },
          ]};
        }
        if (sec.title === "Audiences" && s.audiences) {
          return { ...sec, score: 80, status: "Complete", items: [
            { label: "Primary persona", value: s.audiences.primary || "Not detected" },
            { label: "Secondary", value: s.audiences.secondary || "Not detected" },
            { label: "Tertiary", value: s.audiences.tertiary || "Not detected" },
          ]};
        }
        if (sec.title === "Competitors" && s.competitors) {
          return { ...sec, score: 75, status: "Complete", items: [
            { label: "Tracked", value: `${s.competitors.length} competitors` },
            { label: "Differentiation score", value: "Pending full audit" },
            { label: "Voice overlap risk", value: "Medium" },
          ]};
        }
        if (sec.title === "Compliance Rules" && s.compliance) {
          return { ...sec, score: s.compliance.hasPrivacyPolicy ? 85 : 60, status: "Complete", items: [
            { label: "Regulatory", value: s.compliance.regulations || "None detected" },
            { label: "Legal disclaimers", value: s.compliance.hasPrivacyPolicy ? "Privacy policy found" : "None detected" },
            { label: "Accessibility", value: s.compliance.hasAccessibility ? "Detected" : "Not detected" },
          ]};
        }
        return sec;
      }));

      // Vocabulary
      if (s.vocabulary?.approvedTerms?.length) {
        setApprovedTerms((prev) => [...new Set([...prev, ...s.vocabulary.approvedTerms])]);
      }
      if (s.vocabulary?.forbiddenTerms?.length) {
        setForbiddenTerms((prev) => [...new Set([...prev, ...s.vocabulary.forbiddenTerms])]);
      }
      // Colors & typography
      if (s.colors?.length) setColors((prev) => [...new Set([...prev, ...s.colors])]);
      if (s.typography?.length) setFonts((prev) => [...new Set([...prev, ...s.typography])]);
      if (s.keyMessages?.length) setKeyMessages(s.keyMessages);

      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 4000);
    } catch (err) {
      console.error("Scan error:", err);
      setScanError("Network error. Check URL and try again.");
    } finally {
      setScanning(false);
    }
  };

  // ── Guidelines Upload ──
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      let textContent = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        textContent = await file.text();
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // For PDF, read as text (basic extraction — real PDF parsing would need a library)
        textContent = await file.text();
        if (textContent.length < 50) {
          setUploadError("PDF text extraction limited. Please paste the guidelines content as a .txt file instead.");
          setUploading(false);
          return;
        }
      } else {
        // Try reading as text anyway
        textContent = await file.text();
      }

      if (!textContent || textContent.trim().length < 20) {
        setUploadError("File appears empty or unreadable. Try a .txt or .md file.");
        setUploading(false);
        return;
      }

      const token = getAuthHeader();
      const res = await fetch(`${API_BASE}/vault/analyze-guidelines`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify({ content: textContent, fileName: file.name }),
      });
      const data = await res.json();

      if (!data.success) {
        setUploadError(data.error || "Analysis failed");
        return;
      }

      const a = data.analysis;
      if (a.brandName) setBrandName(a.brandName);
      setGuidelinesFileName(file.name);

      // Merge analysis into sections
      setSections((prev) => prev.map((sec) => {
        if (sec.title === "Tone & Voice" && a.tone) {
          return { ...sec, score: Math.round(((a.tone.formality + a.tone.confidence + a.tone.warmth + (10 - a.tone.humor)) / 4) * 10), status: "Complete", items: [
            { label: "Formality", value: `${a.tone.formality} / 10` },
            { label: "Confidence", value: `${a.tone.confidence} / 10` },
            { label: "Warmth", value: `${a.tone.warmth} / 10` },
            { label: "Humor", value: `${a.tone.humor} / 10` },
          ]};
        }
        if (sec.title === "Vocabulary") {
          const approved = a.vocabulary?.approvedTerms?.length || 0;
          const forbidden = a.vocabulary?.forbiddenTerms?.length || 0;
          const brandSpecific = a.vocabulary?.brandSpecific?.length || 0;
          return { ...sec, score: approved > 0 ? 90 : 0, status: approved > 0 ? "Complete" : sec.status, items: [
            { label: "Approved terms", value: `${approved} words` },
            { label: "Forbidden terms", value: `${forbidden} words` },
            { label: "Brand-specific", value: `${brandSpecific} terms` },
          ]};
        }
        if (sec.title === "Audiences" && a.audiences) {
          return { ...sec, score: 85, status: "Complete", items: [
            { label: "Primary persona", value: a.audiences.primary || "Not specified" },
            { label: "Secondary", value: a.audiences.secondary || "Not specified" },
            { label: "Tertiary", value: a.audiences.tertiary || "Not specified" },
          ]};
        }
        if (sec.title === "Compliance Rules" && a.compliance) {
          return { ...sec, score: 80, status: "Complete", items: [
            { label: "Regulatory", value: a.compliance.regulations || "Not specified" },
            { label: "Legal disclaimers", value: a.compliance.legalDisclaimers || "Not specified" },
            { label: "Accessibility", value: a.compliance.accessibility || "Not specified" },
          ]};
        }
        return sec;
      }));

      // Merge vocabulary
      if (a.vocabulary?.approvedTerms?.length) {
        setApprovedTerms((prev) => [...new Set([...prev, ...a.vocabulary.approvedTerms])]);
      }
      if (a.vocabulary?.forbiddenTerms?.length) {
        setForbiddenTerms((prev) => [...new Set([...prev, ...a.vocabulary.forbiddenTerms])]);
      }
      // Visual identity
      if (a.visual?.primaryColors?.length) setColors((prev) => [...new Set([...prev, ...a.visual.primaryColors, ...(a.visual.secondaryColors || [])])]);
      if (a.visual?.fonts?.length) setFonts((prev) => [...new Set([...prev, ...a.visual.fonts])]);

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Failed to analyze file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const addApproved = () => {
    if (newTerm.trim() && !approvedTerms.includes(newTerm.trim().toLowerCase())) {
      setApprovedTerms((prev) => [...prev, newTerm.trim().toLowerCase()]);
      setNewTerm("");
    }
  };
  const addForbidden = () => {
    if (newForbidden.trim() && !forbiddenTerms.includes(newForbidden.trim().toLowerCase())) {
      setForbiddenTerms((prev) => [...prev, newForbidden.trim().toLowerCase()]);
      setNewForbidden("");
    }
  };
  const startEditing = (sectionIndex: number) => {
    const values: Record<string, string> = {};
    sections[sectionIndex].items.forEach((item) => { values[item.label] = item.value; });
    values["_score"] = String(sections[sectionIndex].score);
    setEditValues(values);
    setEditingSection(sectionIndex);
  };
  const saveEditing = () => {
    if (editingSection === null) return;
    setSections((prev) => prev.map((s, i) => {
      if (i !== editingSection) return s;
      return { ...s, score: parseInt(editValues["_score"] || "0") || 0, status: (parseInt(editValues["_score"] || "0") || 0) > 0 ? "Complete" : "Incomplete", items: s.items.map((item) => ({ ...item, value: editValues[item.label] || item.value })) };
    }));
    setEditingSection(null);
    setEditValues({});
  };

  const overallScore = sections.length > 0 ? Math.round(sections.reduce((sum, s) => sum + s.score, 0) / sections.length) : 0;

  if (loading) {
    return <div className="min-h-[calc(100vh-56px)] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-ora-signal" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* ═══ HEADER ═══ */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/studio" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Studio
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-foreground" style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.03em" }}>Brand Vault</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-ora-signal-light text-ora-signal" style={{ fontSize: "12px", fontWeight: 600 }}>{overallScore}/100</span>
              </div>
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
                {brandName} {lastUpdated ? `-- Last saved ${new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "-- Not saved yet"}
              </p>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
              style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Vault"}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-muted-foreground" style={{ fontSize: "12px" }}>Brand name:</span>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
              className="bg-transparent border-b border-border focus:border-ora-signal outline-none text-foreground px-1"
              style={{ fontSize: "13px", fontWeight: 500 }} />
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">

        {/* ═══ SOURCE INPUTS: URL + GUIDELINES ═══ */}
        <div className="grid md:grid-cols-2 gap-5 mb-10">

          {/* ── Company URL Scanner ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-ora-signal-light flex items-center justify-center">
                <Globe size={15} className="text-ora-signal" />
              </div>
              <div>
                <h3 className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>Company Website</h3>
                <p className="text-muted-foreground" style={{ fontSize: "11px" }}>We crawl your site and extract brand signals automatically.</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanUrl()}
                    placeholder="acmecorp.com"
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:border-ora-signal outline-none transition-colors"
                    style={{ fontSize: "14px" }} />
                </div>
                <button onClick={handleScanUrl} disabled={scanning || !urlInput.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex-shrink-0"
                  style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
                  {scanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {scanning ? "Scanning..." : "Scan"}
                </button>
              </div>

              {/* Status */}
              <AnimatePresence mode="wait">
                {scanning && (
                  <motion.div key="scanning" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-ora-signal-light/50">
                    <Loader2 size={12} className="animate-spin text-ora-signal" />
                    <span style={{ fontSize: "12px", color: "var(--ora-signal)" }}>Scraping site & analyzing with AI... This may take 15-30s.</span>
                  </motion.div>
                )}
                {scanError && (
                  <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5">
                    <AlertCircle size={12} className="text-destructive/70 flex-shrink-0" />
                    <span style={{ fontSize: "12px", color: "var(--destructive)" }}>{scanError}</span>
                    <button onClick={() => setScanError(null)} className="ml-auto cursor-pointer"><X size={10} className="text-destructive/40" /></button>
                  </motion.div>
                )}
                {scanSuccess && (
                  <motion.div key="success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8">
                    <Check size={12} className="text-green-600" />
                    <span style={{ fontSize: "12px", color: "#16a34a" }}>Scan complete. Brand data imported into your Vault.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Show current URL if set */}
              {companyUrl && !scanning && !scanSuccess && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground truncate" style={{ fontSize: "11px" }}>{companyUrl}</span>
                  <a href={companyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Brand Guidelines Upload ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-ora-signal-light flex items-center justify-center">
                <FileText size={15} className="text-ora-signal" />
              </div>
              <div>
                <h3 className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>Brand Guidelines</h3>
                <p className="text-muted-foreground" style={{ fontSize: "11px" }}>Upload your brand charter. We extract tone, colors, typography, and rules.</p>
              </div>
            </div>

            <div className="mt-4">
              <input ref={fileRef} type="file" className="hidden" accept=".txt,.md,.pdf,.doc,.docx" onChange={handleFileSelect} />
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragOver ? "border-ora-signal bg-ora-signal-light/30" :
                  uploading ? "border-border bg-secondary/50 cursor-wait" :
                  "border-border hover:border-border-strong hover:bg-secondary/30"
                }`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-ora-signal" />
                    <span style={{ fontSize: "13px", color: "var(--ora-signal)", fontWeight: 500 }}>Analyzing with AI...</span>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Extracting tone, vocabulary, visual rules...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={20} className="text-muted-foreground/40" />
                    <span style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 450 }}>Drop your brand guidelines here</span>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>.txt, .md, .pdf -- or click to browse</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <AnimatePresence mode="wait">
                {uploadError && (
                  <motion.div key="uerror" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5">
                    <AlertCircle size={12} className="text-destructive/70 flex-shrink-0" />
                    <span style={{ fontSize: "12px", color: "var(--destructive)" }}>{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="ml-auto cursor-pointer"><X size={10} className="text-destructive/40" /></button>
                  </motion.div>
                )}
                {uploadSuccess && (
                  <motion.div key="usuccess" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8">
                    <Check size={12} className="text-green-600" />
                    <span style={{ fontSize: "12px", color: "#16a34a" }}>Guidelines analyzed. Brand rules imported into your Vault.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Current file */}
              {guidelinesFileName && !uploading && !uploadSuccess && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <FileText size={10} className="text-muted-foreground/50" />
                  <span className="text-muted-foreground truncate" style={{ fontSize: "11px" }}>{guidelinesFileName}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ═══ EXTRACTED VISUAL IDENTITY (colors + fonts + messages) ═══ */}
        {(colors.length > 0 || fonts.length > 0 || keyMessages.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-6 mb-10" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <h3 className="text-foreground mb-5" style={{ fontSize: "16px", fontWeight: 500 }}>Extracted Visual Identity</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {/* Colors */}
              {colors.length > 0 && (
                <div>
                  <span className="text-muted-foreground uppercase tracking-wide block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Colors</span>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <div key={c} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary border border-border">
                        <div className="w-4 h-4 rounded" style={{ background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
                        <span className="text-foreground" style={{ fontSize: "11px", fontFamily: "monospace" }}>{c}</span>
                        <button onClick={() => setColors((p) => p.filter((x) => x !== c))} className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                          <X size={8} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Fonts */}
              {fonts.length > 0 && (
                <div>
                  <span className="text-muted-foreground uppercase tracking-wide block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Typography</span>
                  <div className="flex flex-wrap gap-2">
                    {fonts.map((f) => (
                      <span key={f} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground" style={{ fontSize: "12px" }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Key messages */}
              {keyMessages.length > 0 && (
                <div>
                  <span className="text-muted-foreground uppercase tracking-wide block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Key Messages</span>
                  <div className="space-y-2">
                    {keyMessages.map((m, i) => (
                      <p key={i} className="text-foreground" style={{ fontSize: "12px", lineHeight: 1.5 }}>{m}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ VAULT SCORE CARDS ═══ */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {sections.map((section, i) => {
            const Icon = iconMap[section.icon] || Globe;
            const isEditing = editingSection === i;
            return (
              <motion.div key={section.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-card border rounded-xl p-5 transition-all ${activeTab === i ? "border-ora-signal shadow-sm" : "border-border hover:border-border-strong"}`}>
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>{section.title}</span>
                      <div className="flex gap-1">
                        <button onClick={saveEditing} className="p-1.5 rounded-md bg-ora-signal-light text-ora-signal cursor-pointer"><Check size={12} /></button>
                        <button onClick={() => setEditingSection(null)} className="p-1.5 rounded-md bg-secondary text-muted-foreground cursor-pointer"><X size={12} /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Score:</span>
                        <input value={editValues["_score"] || ""} onChange={(e) => setEditValues({ ...editValues, _score: e.target.value })}
                          className="w-16 bg-secondary border border-border rounded px-2 py-1 text-foreground" style={{ fontSize: "12px" }} type="number" min="0" max="100" />
                      </div>
                      {section.items.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-muted-foreground flex-shrink-0 w-28 truncate" style={{ fontSize: "11px" }}>{item.label}</span>
                          <input value={editValues[item.label] || ""} onChange={(e) => setEditValues({ ...editValues, [item.label]: e.target.value })}
                            className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-foreground" style={{ fontSize: "12px" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button className="w-full text-left cursor-pointer" onClick={() => { setActiveTab(i); startEditing(i); }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className="text-muted-foreground" />
                        <span className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>{section.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {section.score > 0 && <Check size={12} className="text-ora-signal" />}
                        <span className={section.score > 0 ? "text-ora-signal" : "text-muted-foreground"} style={{ fontSize: "13px", fontWeight: 600 }}>
                          {section.score > 0 ? section.score : "--"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {section.items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{item.label}</span>
                          <span className="text-foreground" style={{ fontSize: "13px", fontWeight: 450 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ═══ VOCABULARY ═══ */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileText size={16} className="text-ora-signal" />
              <h3 className="text-foreground" style={{ fontSize: "16px", fontWeight: 500 }}>Approved Vocabulary</h3>
              <span className="ml-auto text-muted-foreground" style={{ fontSize: "12px" }}>{approvedTerms.length} terms</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {approvedTerms.map((term) => (
                <span key={term} className="group px-3 py-1.5 rounded-lg bg-ora-signal-light text-foreground border border-ora-signal/10 flex items-center gap-1.5" style={{ fontSize: "13px" }}>
                  {term}
                  <button onClick={() => setApprovedTerms((p) => p.filter((t) => t !== term))} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><X size={10} className="text-muted-foreground" /></button>
                </span>
              ))}
              {approvedTerms.length === 0 && <span className="text-muted-foreground/40" style={{ fontSize: "13px" }}>No terms yet. Scan a URL or upload guidelines to auto-populate.</span>}
            </div>
            <div className="flex gap-2">
              <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addApproved()}
                placeholder="Add approved term..." className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal outline-none" style={{ fontSize: "13px" }} />
              <button onClick={addApproved} className="px-3 py-2 rounded-lg bg-ora-signal-light text-ora-signal cursor-pointer hover:bg-ora-signal-medium transition-colors"><Plus size={14} /></button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={16} className="text-destructive/60" />
              <h3 className="text-foreground" style={{ fontSize: "16px", fontWeight: 500 }}>Forbidden Terms</h3>
              <span className="ml-auto text-muted-foreground" style={{ fontSize: "12px" }}>{forbiddenTerms.length} terms</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {forbiddenTerms.map((term) => (
                <span key={term} className="group px-3 py-1.5 rounded-lg bg-destructive/5 text-destructive/70 border border-destructive/10 line-through flex items-center gap-1.5" style={{ fontSize: "13px" }}>
                  {term}
                  <button onClick={() => setForbiddenTerms((p) => p.filter((t) => t !== term))} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-underline"><X size={10} className="text-destructive/50" /></button>
                </span>
              ))}
              {forbiddenTerms.length === 0 && <span className="text-muted-foreground/40" style={{ fontSize: "13px" }}>No terms yet. Upload guidelines to auto-detect.</span>}
            </div>
            <div className="flex gap-2">
              <input value={newForbidden} onChange={(e) => setNewForbidden(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addForbidden()}
                placeholder="Add forbidden term..." className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-destructive/30 outline-none" style={{ fontSize: "13px" }} />
              <button onClick={addForbidden} className="px-3 py-2 rounded-lg bg-destructive/5 text-destructive/60 cursor-pointer hover:bg-destructive/10 transition-colors"><Plus size={14} /></button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}