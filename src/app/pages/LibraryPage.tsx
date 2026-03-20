import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderOpen, FolderPlus, Search, Download, Trash2, MoreHorizontal,
  ImageIcon, FileText, Film, Music, Code2, ArrowUpDown,
  Check, X, Pencil, ChevronRight, Loader2, BookOpen,
  Plus, Grid3x3, List, Rocket, Eye, FolderInput, Sparkles,
  Instagram, Linkedin, Facebook, Camera, Clapperboard,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { RouteGuard } from "../components/RouteGuard";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

interface LibraryFolder {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface LibraryItem {
  id: string;
  type: string;
  model: { id: string; name: string; provider: string; speed: string; quality: number };
  prompt: string;
  timestamp: string;
  preview: any;
  folderId: string | null;
  savedAt: string;
  updatedAt: string;
  customName?: string;
}

type SortMode = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "modified-desc";
type ViewMode = "grid" | "list";
type LibraryTab = "content" | "campaigns";

/* ═══════════════════════════════════
   HELPERS
   ═══════════════════════════════════ */

function getItemName(item: LibraryItem): string {
  return item.customName || item.prompt || "Untitled";
}

function getTypeIcon(type: string) {
  switch (type) {
    case "image": return ImageIcon;
    case "text": return FileText;
    case "code": return Code2;
    case "film": return Film;
    case "sound": return Music;
    default: return FileText;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "image": return "Image";
    case "text": return "Text";
    case "code": return "Code";
    case "film": return "Film";
    case "sound": return "Sound";
    default: return type;
  }
}

function getAssetUrl(item: LibraryItem): string | null {
  if (!item.preview) return null;
  if (item.preview.kind === "image") return item.preview.imageUrl || null;
  if (item.preview.kind === "film") return item.preview.videoUrl || null;
  if (item.preview.kind === "sound") return item.preview.audioUrl || null;
  return null;
}

function sortItems(items: LibraryItem[], mode: SortMode): LibraryItem[] {
  const sorted = [...items];
  switch (mode) {
    case "date-desc": return sorted.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    case "date-asc": return sorted.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
    case "name-asc": return sorted.sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
    case "name-desc": return sorted.sort((a, b) => getItemName(b).localeCompare(getItemName(a)));
    case "modified-desc": return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    default: return sorted;
  }
}

/* ═══════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════ */

export function LibraryPage() {
  return (
    <RouteGuard requireAuth requireFeature="hub">
      <LibraryPageContent />
    </RouteGuard>
  );
}

function LibraryPageContent() {
  const { getAuthHeader } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "campaigns" ? "campaigns" : "content";
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("date-desc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null);
  const [moveTargetItem, setMoveTargetItem] = useState<string | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Server call helper with proper Authorization header
  const serverPost = useCallback((path: string, bodyData: any) => {
    const token = getAuthHeader();
    const url = `${API_BASE}${path}`;
    return fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...bodyData, _token: token }),
    }).then(res => res.json());
  }, [getAuthHeader]);

  // Fetch library data
  const fetchData = useCallback(async () => {
    try {
      console.log("[Library] Fetching items + folders...");
      const [itemsData, foldersData] = await Promise.all([
        serverPost("/library/list", {}),
        serverPost("/library/folders-list", {}),
      ]);
      console.log("[Library] Loaded:", itemsData.items?.length || 0, "items,", foldersData.folders?.length || 0, "folders");
      if (itemsData.success) setItems(itemsData.items || []);
      if (foldersData.success) setFolders(foldersData.folders || []);
    } catch (err) {
      console.error("[Library] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [serverPost]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    const handle = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSortMenu]);

  // Close context menu on click
  useEffect(() => {
    if (!contextMenu) return;
    const handle = () => setContextMenu(null);
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [contextMenu]);

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      const data = await serverPost("/library/folders-create", { name: newFolderName.trim() });
      if (data.success && data.folder) {
        setFolders((prev) => [...prev, data.folder]);
      }
    } catch (err) {
      console.error("[Library] create folder error:", err);
    }
    setNewFolderName("");
    setShowNewFolder(false);
  }, [newFolderName, serverPost]);

  // Rename folder
  const handleRenameFolder = useCallback(async (folderId: string) => {
    if (!editFolderName.trim()) { setEditingFolderId(null); return; }
    try {
      const data = await serverPost("/library/folders-rename", { folderId, name: editFolderName.trim() });
      if (data.success) {
        setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name: editFolderName.trim() } : f));
      }
    } catch (err) {
      console.error("[Library] rename folder error:", err);
    }
    setEditingFolderId(null);
  }, [editFolderName, serverPost]);

  // Delete folder
  const handleDeleteFolder = useCallback(async (folderId: string) => {
    try {
      await serverPost("/library/folders-delete", { folderId });
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setItems((prev) => prev.map((item) => item.folderId === folderId ? { ...item, folderId: null } : item));
      if (activeFolderId === folderId) setActiveFolderId(null);
    } catch (err) {
      console.error("[Library] delete folder error:", err);
    }
  }, [serverPost, activeFolderId]);

  // Delete item
  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await serverPost("/library/items-delete", { itemId });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error("[Library] delete item error:", err);
    }
  }, [serverPost]);

  // Move item to folder
  const handleMoveItem = useCallback(async (itemId: string, folderId: string | null) => {
    try {
      await serverPost("/library/items-update", { itemId, updates: { folderId } });
      setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, folderId } : item));
    } catch (err) {
      console.error("[Library] move item error:", err);
    }
    setMoveTargetItem(null);
  }, [serverPost]);

  // Download asset
  const handleDownload = useCallback(async (item: LibraryItem) => {
    const url = getAssetUrl(item);
    if (!url) {
      // For text/code, download as text file
      if (item.preview?.kind === "text" || item.preview?.kind === "code") {
        const text = item.preview.kind === "text" ? item.preview.excerpt : item.preview.snippet;
        const ext = item.preview.kind === "code" ? ".ts" : ".txt";
        const blob = new Blob([text], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${getItemName(item).slice(0, 40)}${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      return;
    }
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = item.type === "image" ? ".png" : item.type === "film" ? ".mp4" : item.type === "sound" ? ".wav" : "";
      a.download = `${getItemName(item).slice(0, 40)}${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  }, []);

  // Split items by type
  const contentItems = items.filter((item) => item.type !== "campaign");
  const campaignItems = items.filter((item) => item.type === "campaign");

  // Filtered + sorted items (content only)
  const filteredItems = sortItems(
    contentItems.filter((item) => {
      if (activeFolderId === "__unfiled__" && item.folderId) return false;
      if (activeFolderId !== null && activeFolderId !== "__unfiled__" && item.folderId !== activeFolderId) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = getItemName(item).toLowerCase();
        const model = (item.model?.name || "").toLowerCase();
        if (!name.includes(q) && !model.includes(q)) return false;
      }
      return true;
    }),
    sortMode,
  );

  const folderItemCounts = folders.reduce<Record<string, number>>((acc, f) => {
    acc[f.id] = items.filter((item) => item.folderId === f.id).length;
    return acc;
  }, {});
  const unfiledCount = items.filter((item) => !item.folderId).length;

  const sortLabels: Record<SortMode, string> = {
    "date-desc": "Newest first",
    "date-asc": "Oldest first",
    "name-asc": "Name A-Z",
    "name-desc": "Name Z-A",
    "modified-desc": "Last modified",
  };

  const typeOptions = [
    { id: "all", label: "All" },
    { id: "image", label: "Images" },
    { id: "text", label: "Text" },
    { id: "code", label: "Code" },
    { id: "film", label: "Film" },
    { id: "sound", label: "Sound" },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: "#5E6AD2" }} />
      </div>
    );
  }

  const typeBg: Record<string, string> = { image: "#5E6AD2", film: "#D4956B", text: "#C27A98", code: "#6D9B7E", sound: "#C9A84C" };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-8 md:py-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 500, letterSpacing: "-0.05em", lineHeight: 0.95, color: "#E8E4DF" }}>
              Library
            </h1>
            <p className="mt-2" style={{ fontSize: "15px", color: "#9A9590", fontWeight: 400 }}>
              {contentItems.length} asset{contentItems.length !== 1 ? "s" : ""}, {campaignItems.length} campaign{campaignItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            to="/hub"
            className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all hover:opacity-90"
            style={{ background: "#E8E4DF", color: "#131211", fontSize: "14px", fontWeight: 500 }}
          >
            <Plus size={14} />
            Generate new
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("content")}
            className="px-5 py-2.5 rounded-full cursor-pointer transition-all"
            style={{
              fontSize: "13px", fontWeight: 800,
              background: activeTab === "content" ? "#E8E4DF" : "#222120",
              color: activeTab === "content" ? "#131211" : "#5C5856",
              border: activeTab === "content" ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Generated Content
            <span className="ml-1.5" style={{ fontSize: "11px", opacity: 0.6 }}>({contentItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className="px-5 py-2.5 rounded-full cursor-pointer transition-all"
            style={{
              fontSize: "13px", fontWeight: 800,
              background: activeTab === "campaigns" ? "#E8E4DF" : "#222120",
              color: activeTab === "campaigns" ? "#131211" : "#5C5856",
              border: activeTab === "campaigns" ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Campaigns
            <span className="ml-1.5" style={{ fontSize: "11px", opacity: 0.6 }}>({campaignItems.length})</span>
          </button>
        </div>

        {/* ═══ CAMPAIGNS TAB ═══ */}
        {activeTab === "campaigns" && (
          <div>
            {campaignItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: "linear-gradient(135deg, #D4956B 0%, #C27A98 100%)", boxShadow: "0 8px 24px rgba(194,122,152,0.15)" }}>
                  <Sparkles size={28} style={{ color: "#FFF" }} />
                </div>
                <h2 style={{ fontSize: "24px", fontWeight: 500, letterSpacing: "-0.03em", color: "#E8E4DF", marginBottom: "8px" }}>
                  No campaigns yet
                </h2>
                <p style={{ fontSize: "15px", color: "#9A9590", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 24px" }}>
                  Create a campaign from the AI Hub using Campaign Lab. Your campaigns will automatically appear here.
                </p>
                <Link
                  to="/hub"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
                  style={{ background: "#E8E4DF", color: "#131211", fontSize: "14px", fontWeight: 500 }}
                >
                  <Rocket size={14} />
                  Open AI Hub
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortItems(campaignItems, sortMode).map((item, i) => {
                  const preview = item.preview as any;
                  const platforms = preview?.platforms || [];
                  const headline = preview?.copy?.headline || "";
                  const deliverableCount = preview?.deliverableCount || 0;
                  const thumbnails = [preview?.packshotUrl, preview?.lifestyleUrl].filter(Boolean);

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.3) }}
                      className="bg-card border border-border rounded-xl overflow-hidden group"
                      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                    >
                      {/* Image strip */}
                      <div className="flex h-[140px]">
                        {thumbnails.length > 0 ? thumbnails.map((url: string, ti: number) => (
                          <div key={ti} className="flex-1 relative overflow-hidden bg-secondary/30">
                            <img src={url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                          </div>
                        )) : (
                          <div className="flex-1 flex items-center justify-center bg-secondary/20">
                            <Sparkles size={24} className="text-muted-foreground/20" />
                          </div>
                        )}
                        {preview?.videoUrl && (
                          <div className="flex-1 relative overflow-hidden bg-black">
                            <video src={preview.videoUrl} className="w-full h-full object-cover" muted playsInline
                              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm" style={{ fontSize: "9px", fontWeight: 500, color: "#fff" }}>Reel</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ora-signal-light">
                                <Sparkles size={9} className="text-ora-signal" />
                                <span style={{ fontSize: "10px", fontWeight: 600 }} className="text-ora-signal">Campaign</span>
                              </div>
                              <span style={{ fontSize: "10px" }} className="text-muted-foreground">{deliverableCount} deliverables</span>
                            </div>
                            {headline && (
                              <p className="truncate" style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>{headline}</p>
                            )}
                            <p className="truncate" style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                              {getItemName(item)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Platforms */}
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center gap-1.5">
                            {platforms.map((p: string) => {
                              const PIcon = p === "Instagram" ? Instagram : p === "LinkedIn" ? Linkedin : Facebook;
                              const pColor = p === "Instagram" ? "#E4405F" : p === "LinkedIn" ? "#0A66C2" : "#1877F2";
                              return (
                                <div key={p} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${pColor}10` }}>
                                  <PIcon size={12} style={{ color: pColor }} />
                                </div>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                            {new Date(item.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ CONTENT TAB ═══ */}
        {activeTab === "content" && (
        <div className="flex gap-6">
          {/* Sidebar — Folders */}
          <div className="w-[220px] flex-shrink-0 hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A9590" }}>
                Collections
              </span>
              <button
                onClick={() => setShowNewFolder(true)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
              >
                <FolderPlus size={13} />
              </button>
            </div>

            {/* New folder input */}
            <AnimatePresence>
              {showNewFolder && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary">
                    <FolderOpen size={13} className="text-ora-signal flex-shrink-0" />
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }}
                      placeholder="Folder name..."
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
                      style={{ fontSize: "12px" }}
                    />
                    <button onClick={handleCreateFolder} className="w-5 h-5 rounded flex items-center justify-center text-ora-signal hover:bg-ora-signal-light cursor-pointer"><Check size={11} /></button>
                    <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary cursor-pointer"><X size={11} /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* All items */}
            <button
              onClick={() => setActiveFolderId(null)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer mb-0.5 ${activeFolderId === null ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              <FolderOpen size={14} />
              <span className="flex-1 text-left truncate" style={{ fontSize: "13px", fontWeight: activeFolderId === null ? 500 : 400 }}>All items</span>
              <span style={{ fontSize: "10px", color: activeFolderId === null ? "var(--ora-signal)" : "var(--muted-foreground)" }}>{items.length}</span>
            </button>

            {/* Unfiled */}
            {unfiledCount > 0 && unfiledCount !== items.length && (
              <button
                onClick={() => setActiveFolderId("__unfiled__")}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer mb-0.5 ${activeFolderId === "__unfiled__" ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              >
                <FolderOpen size={14} />
                <span className="flex-1 text-left truncate" style={{ fontSize: "13px", fontWeight: activeFolderId === "__unfiled__" ? 500 : 400 }}>Unfiled</span>
                <span style={{ fontSize: "10px", color: activeFolderId === "__unfiled__" ? "var(--ora-signal)" : "var(--muted-foreground)" }}>{unfiledCount}</span>
              </button>
            )}

            {/* User folders */}
            {folders.map((folder) => (
              <div key={folder.id} className="group relative">
                {editingFolderId === folder.id ? (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary mb-0.5">
                    <FolderOpen size={13} className="text-ora-signal flex-shrink-0" />
                    <input
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(folder.id); if (e.key === "Escape") setEditingFolderId(null); }}
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-foreground min-w-0"
                      style={{ fontSize: "12px" }}
                    />
                    <button onClick={() => handleRenameFolder(folder.id)} className="w-5 h-5 rounded flex items-center justify-center text-ora-signal cursor-pointer"><Check size={11} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer mb-0.5 ${activeFolderId === folder.id ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  >
                    <FolderOpen size={14} />
                    <span className="flex-1 text-left truncate" style={{ fontSize: "13px", fontWeight: activeFolderId === folder.id ? 500 : 400 }}>{folder.name}</span>
                    <span style={{ fontSize: "10px", color: activeFolderId === folder.id ? "var(--ora-signal)" : "var(--muted-foreground)" }}>
                      {folderItemCounts[folder.id] || 0}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary/80 cursor-pointer"
                      ><Pencil size={9} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary/80 text-destructive cursor-pointer"
                      ><Trash2 size={9} /></button>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              {/* Search */}
              <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 border border-border bg-card min-w-[200px] max-w-[360px]"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <Search size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
                  style={{ fontSize: "13px" }}
                />
              </div>

              {/* Type filter pills */}
              <div className="flex items-center gap-1.5">
                {typeOptions.map((opt) => {
                  const pillColor = typeBg[opt.id] || "#E8E4DF";
                  const isActive = typeFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setTypeFilter(opt.id)}
                      className="px-3 py-1.5 rounded-full cursor-pointer transition-all"
                      style={{
                        fontSize: "11px", fontWeight: isActive ? 800 : 600,
                        background: isActive ? (opt.id === "all" ? "#E8E4DF" : pillColor) : "#222120",
                        color: isActive ? "#131211" : "#5C5856",
                        border: isActive ? "none" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="w-px h-5 bg-border" />

              {/* Sort */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                  style={{ fontSize: "11px", fontWeight: 400 }}
                >
                  <ArrowUpDown size={12} />
                  {sortLabels[sortMode]}
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-8 bg-card border border-border rounded-xl py-1.5 z-30 min-w-[160px]"
                    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
                    {(Object.entries(sortLabels) as [SortMode, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setSortMode(key); setShowSortMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3.5 py-2 transition-colors cursor-pointer ${sortMode === key ? "text-ora-signal bg-ora-signal-light" : "text-foreground hover:bg-secondary"}`}
                        style={{ fontSize: "12px", fontWeight: sortMode === key ? 500 : 400 }}
                      >
                        {sortMode === key && <Check size={11} />}
                        <span className={sortMode === key ? "" : "pl-[19px]"}>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${viewMode === "grid" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  style={{ boxShadow: viewMode === "grid" ? "0 1px 2px rgba(0,0,0,0.04)" : "none" }}
                >
                  <Grid3x3 size={13} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${viewMode === "list" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  style={{ boxShadow: viewMode === "list" ? "0 1px 2px rgba(0,0,0,0.04)" : "none" }}
                >
                  <List size={13} />
                </button>
              </div>
            </div>

            {/* Mobile folder filter */}
            <div className="flex md:hidden items-center gap-2 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveFolderId(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${activeFolderId === null ? "bg-ora-signal-light border-ora-signal/30 text-ora-signal" : "border-border text-muted-foreground"}`}
                style={{ fontSize: "12px", fontWeight: activeFolderId === null ? 500 : 400 }}
              >All ({items.length})</button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${activeFolderId === f.id ? "bg-ora-signal-light border-ora-signal/30 text-ora-signal" : "border-border text-muted-foreground"}`}
                  style={{ fontSize: "12px", fontWeight: activeFolderId === f.id ? 500 : 400 }}
                >{f.name} ({folderItemCounts[f.id] || 0})</button>
              ))}
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground cursor-pointer"
                style={{ fontSize: "12px" }}
              ><FolderPlus size={11} /></button>
            </div>

            {/* Empty state */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: "linear-gradient(135deg, #6C47FF 0%, #EC4899 100%)", boxShadow: "0 8px 24px rgba(108,71,255,0.2)" }}>
                  <BookOpen size={28} style={{ color: "#FFF" }} />
                </div>
                <h2 style={{ fontSize: "24px", fontWeight: 500, letterSpacing: "-0.03em", color: "#E8E4DF", marginBottom: "8px" }}>
                  {items.length === 0 ? "Your library is empty" : "No matching items"}
                </h2>
                <p style={{ fontSize: "15px", color: "#9A9590", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 24px" }}>
                  {items.length === 0
                    ? "Generate content in the AI Hub and save your favorites here. They'll be organized and always available."
                    : "Try adjusting your search or filters."}
                </p>
                {items.length === 0 && (
                  <Link
                    to="/hub"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all hover:scale-105"
                    style={{ background: "#E8E4DF", color: "#131211", fontSize: "14px", fontWeight: 500 }}
                  >
                    <Rocket size={14} />
                    Open AI Hub
                  </Link>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* ═══ MASONRY GRID VIEW ═══ */
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {filteredItems.map((item, i) => {
                  const Icon = getTypeIcon(item.type);
                  const url = getAssetUrl(item);
                  const isVisual = item.type === "image" || item.type === "film";
                  const typeColor = typeBg[item.type] || "#888";
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
                      className="break-inside-avoid rounded-2xl overflow-hidden group cursor-pointer"
                      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#1a1918", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
                    >
                      {/* Thumbnail */}
                      <div className={`relative ${isVisual ? "" : "aspect-[4/3]"}`} style={{ background: isVisual ? undefined : "#222120" }} onClick={() => setPreviewItem(item)}>
                        {url && item.type === "image" ? (
                          <img src={url} alt={getItemName(item)} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                        ) : url && item.type === "film" ? (
                          <div className="relative">
                            <video src={url} className="w-full object-cover" muted playsInline
                              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6">
                            <Icon size={24} style={{ color: typeColor, opacity: 0.4 }} />
                            <span style={{ fontSize: "10px", fontWeight: 800, color: typeColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{getTypeLabel(item.type)}</span>
                            {item.preview?.kind === "text" && (
                              <p className="text-center line-clamp-3 mt-1" style={{ fontSize: "11px", color: "#9A9590", lineHeight: 1.5 }}>
                                {(item.preview as any).excerpt?.slice(0, 120)}...
                              </p>
                            )}
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                            <Eye size={18} style={{ color: "#131211" }} />
                          </div>
                        </div>
                        {/* Type badge */}
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "10px", fontWeight: 900, background: typeColor, color: "#131211", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {getTypeLabel(item.type)}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="px-4 py-3">
                        <p className="truncate mb-1" style={{ fontSize: "13px", fontWeight: 700, color: "#E8E4DF" }}>
                          {getItemName(item)}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#9A9590" }}>{item.model?.name || "AI"}</span>
                            <span style={{ fontSize: "9px", color: "#5C5856" }}>
                              {new Date(item.savedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#222120] cursor-pointer" title="Download HD">
                              <Download size={12} style={{ color: "#9A9590" }} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setMoveTargetItem(item.id); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#222120] cursor-pointer" title="Move to folder">
                              <FolderInput size={12} style={{ color: "#9A9590" }} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[rgba(196,91,74,0.1)] cursor-pointer" title="Remove">
                              <Trash2 size={12} style={{ color: "#EF4444" }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* ═══ LIST VIEW ═══ */
              <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                {/* Header */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-secondary/30">
                  <span className="flex-1" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Name</span>
                  <span className="w-20 hidden sm:block" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Type</span>
                  <span className="w-24 hidden md:block" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Model</span>
                  <span className="w-24 hidden lg:block" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Saved</span>
                  <span className="w-24" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Actions</span>
                </div>
                {filteredItems.map((item, i) => {
                  const Icon = getTypeIcon(item.type);
                  const folder = folders.find((f) => f.id === item.folderId);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors group cursor-pointer"
                      onClick={() => setPreviewItem(item)}
                    >
                      {/* Name */}
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{getItemName(item)}</p>
                          {folder && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <FolderOpen size={9} className="text-muted-foreground" />
                              <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{folder.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="w-20 hidden sm:block" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{getTypeLabel(item.type)}</span>
                      <span className="w-24 hidden md:block truncate" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{item.model?.name || "AI"}</span>
                      <span className="w-24 hidden lg:block" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{new Date(item.savedAt).toLocaleDateString()}</span>
                      <div className="w-24 flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Download HD">
                          <Download size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMoveTargetItem(item.id); }} className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Move">
                          <FolderInput size={13} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-secondary cursor-pointer" title="Remove">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ═══ MOVE TO FOLDER MODAL ═══ */}
      <AnimatePresence>
        {moveTargetItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMoveTargetItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl w-[360px] mx-6 overflow-hidden"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 24px 80px rgba(0,0,0,0.12)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-border">
                <h3 style={{ fontSize: "16px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)" }}>Move to folder</h3>
              </div>
              <div className="p-3 max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => handleMoveItem(moveTargetItem, null)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                >
                  <FolderOpen size={15} className="text-muted-foreground" />
                  <span style={{ fontSize: "13px", color: "var(--foreground)" }}>No folder (unfiled)</span>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveItem(moveTargetItem, folder.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <FolderOpen size={15} className="text-ora-signal" />
                    <span style={{ fontSize: "13px", color: "var(--foreground)" }}>{folder.name}</span>
                    <span className="ml-auto" style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{folderItemCounts[folder.id] || 0}</span>
                  </button>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border flex justify-end">
                <button
                  onClick={() => setMoveTargetItem(null)}
                  className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ fontSize: "13px" }}
                >Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PREVIEW MODAL ═══ */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: previewItem.type === "image" || previewItem.type === "film" ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.4)" }}
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className={`relative ${previewItem.type === "image" || previewItem.type === "film" ? "max-w-[90vw] max-h-[85vh]" : "bg-card rounded-2xl max-w-2xl w-full mx-6"}`}
              style={previewItem.type !== "image" && previewItem.type !== "film" ? { boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 24px 80px rgba(0,0,0,0.12)" } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {(previewItem.type === "image" || previewItem.type === "film") && getAssetUrl(previewItem) ? (
                <>
                  {previewItem.type === "image" ? (
                    <img src={getAssetUrl(previewItem)!} alt={getItemName(previewItem)} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" crossOrigin="anonymous" />
                  ) : (
                    <video src={getAssetUrl(previewItem)!} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" controls autoPlay muted loop playsInline />
                  )}
                  {/* Floating actions */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(previewItem)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white transition-all cursor-pointer hover:scale-105"
                      style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(16px)", fontSize: "12px", fontWeight: 500 }}
                    >
                      <Download size={14} /> Download HD
                    </button>
                    <button
                      onClick={() => setPreviewItem(null)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-colors"
                      style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {previewItem.preview?.kind === "text" && (
                      <p style={{ fontSize: "14px", color: "var(--foreground)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{previewItem.preview.excerpt}</p>
                    )}
                    {previewItem.preview?.kind === "code" && (
                      <pre className="font-mono rounded-lg p-4" style={{ fontSize: "12px", color: "#e2e8f0", background: "#1a1a2e", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {previewItem.preview.snippet}
                      </pre>
                    )}
                    {previewItem.preview?.kind === "sound" && previewItem.preview.audioUrl && (
                      <div className="flex flex-col items-center gap-4 py-8">
                        <Music size={32} className="text-ora-signal" />
                        <audio src={previewItem.preview.audioUrl} controls className="w-full" />
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-border flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>{getItemName(previewItem)}</p>
                      <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{previewItem.model?.name} - {new Date(previewItem.savedAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(previewItem)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer"
                      style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      onClick={() => setPreviewItem(null)}
                      className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                      style={{ fontSize: "13px" }}
                    >Close</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}