import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload, Search, X, Image, Film, Palette, Sparkles, FolderOpen, Check,
  Trash2, Download, Loader2, Plus, Music,
} from "lucide-react";
import { API_BASE, publicAnonKey } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

export interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "brand-asset";
  mimeType?: string;
  size?: number;
  gradient?: string;
  signedUrl?: string | null;
  source: "generated" | "uploaded" | "brand";
  clientId?: string;
  createdAt?: string;
  date?: string;
  dimensions?: string | null;
  prompt?: string;
}

/* Fallback items shown when not logged in or API fails */
const fallbackMedia: MediaItem[] = [
  { id: "g1", name: "AI Analytics Visual", type: "image", gradient: "linear-gradient(135deg, #e8eaf6, #c5cae9)", source: "generated", date: "Today", dimensions: "1200x628" },
  { id: "g2", name: "Product Hero — Dark", type: "image", gradient: "linear-gradient(135deg, #1a1a2e, #3b4fc4)", source: "generated", date: "Today", dimensions: "1920x1080" },
  { id: "g3", name: "Story Visual — Signal", type: "image", gradient: "linear-gradient(180deg, #1a1a2e, #3b4fc4)", source: "generated", date: "Today", dimensions: "1080x1920" },
  { id: "g4", name: "Email Banner", type: "image", gradient: "linear-gradient(135deg, #e3f2fd, #bbdefb)", source: "generated", date: "Yesterday", dimensions: "600x200" },
  { id: "b1", name: "Logo — Primary", type: "brand-asset", gradient: "linear-gradient(135deg, #f5f5f7, #ededf0)", source: "brand", date: "Brand Kit", dimensions: "800x200" },
  { id: "b2", name: "Logo — White", type: "brand-asset", gradient: "linear-gradient(135deg, #2d2d5e, #1a1a2e)", source: "brand", date: "Brand Kit", dimensions: "800x200" },
  { id: "b3", name: "Icon Set — Product", type: "brand-asset", gradient: "linear-gradient(135deg, #f0f0f3, #e4e7f0)", source: "brand", date: "Brand Kit", dimensions: "1200x800" },
];

type TabId = "all" | "generated" | "uploaded" | "brand";

const tabs: { id: TabId; label: string; icon: typeof Image }[] = [
  { id: "all", label: "All", icon: FolderOpen },
  { id: "generated", label: "AI", icon: Sparkles },
  { id: "uploaded", label: "Uploads", icon: Upload },
  { id: "brand", label: "Brand", icon: Palette },
];

interface MediaLibraryProps {
  onAddToCanvas?: (item: MediaItem) => void;
  clientId?: string;
}

export function MediaLibrary({ onAddToCanvas, clientId = "default" }: MediaLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaItem[]>(fallbackMedia);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getAuthHeader, user } = useAuth();

  // Fetch media from server on mount and when clientId changes
  const fetchMedia = useCallback(async () => {
    if (!user) return;
    try {
      const token = getAuthHeader();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;

      const res = await fetch(
        `${API_BASE}/studio/media?clientId=${encodeURIComponent(clientId)}`,
        { headers }
      );
      const data = await res.json();
      if (data.success && data.items?.length > 0) {
        const mapped: MediaItem[] = data.items.map((item: any) => ({
          ...item,
          date: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Unknown",
          gradient: item.signedUrl ? undefined : `linear-gradient(135deg, hsl(${Math.abs(hashCode(item.id)) % 360}, 30%, 85%), hsl(${(Math.abs(hashCode(item.id)) + 40) % 360}, 30%, 75%))`,
        }));
        // Merge with brand fallback items
        setItems([...mapped, ...fallbackMedia.filter((f) => f.source === "brand")]);
      } else {
        setItems(fallbackMedia);
      }
    } catch (err) {
      console.error("Failed to fetch media:", err);
      setItems(fallbackMedia);
    }
  }, [user, clientId, getAuthHeader]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const filteredItems = items.filter((item) => {
    const matchesTab = activeTab === "all" || item.source === activeTab;
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Real upload handler
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!user) {
      // Offline / not logged in — add locally
      const newItems: MediaItem[] = Array.from(files).map((file, i) => ({
        id: `local-${Date.now()}-${i}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        type: file.type.startsWith("video") ? "video" as const : file.type.startsWith("audio") ? "audio" as const : "image" as const,
        gradient: `linear-gradient(135deg, hsl(${Math.random() * 360}, 30%, 85%), hsl(${Math.random() * 360}, 30%, 75%))`,
        source: "uploaded" as const,
        date: "Just now",
        dimensions: "Analyzing...",
      }));
      setItems((prev) => [...newItems, ...prev]);
      setActiveTab("uploaded");
      return;
    }

    setUploading(true);
    const token = getAuthHeader();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${publicAnonKey}`,
    };
    if (token) headers["X-User-Token"] = token;

    const uploaded: MediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId);
        formData.append("name", file.name);

        // Remove Content-Type from headers — let browser set multipart boundary
        const uploadHeaders = { ...headers };

        const res = await fetch(`${API_BASE}/studio/media/upload`, {
          method: "POST",
          headers: uploadHeaders,
          body: formData,
        });

        const data = await res.json();
        if (data.success && data.item) {
          uploaded.push({
            ...data.item,
            date: "Just now",
            gradient: data.item.signedUrl ? undefined : `linear-gradient(135deg, hsl(${Math.random() * 360}, 30%, 85%), hsl(${Math.random() * 360}, 30%, 75%))`,
          });
        } else {
          console.error(`Upload failed for ${file.name}:`, data.error);
        }
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
      }
    }

    if (uploaded.length > 0) {
      setItems((prev) => [...uploaded, ...prev]);
      setActiveTab("uploaded");
    }
    setUploading(false);
    setUploadProgress(null);
  };

  // AI generate image
  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;
    setGenerating(true);

    try {
      const token = getAuthHeader();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;

      const res = await fetch(`${API_BASE}/studio/media/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: generatePrompt, clientId }),
      });
      const data = await res.json();

      if (data.success && data.item) {
        setItems((prev) => [{
          ...data.item,
          date: "Just now",
        }, ...prev]);
        setActiveTab("generated");
        setGeneratePrompt("");
        setShowGenerate(false);
      } else {
        console.error("Generate failed:", data.error);
      }
    } catch (err) {
      console.error("Generate error:", err);
    }
    setGenerating(false);
  };

  // Delete media
  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try {
      const token = getAuthHeader();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;

      const res = await fetch(
        `${API_BASE}/studio/media/${itemId}?clientId=${encodeURIComponent(clientId)}`,
        { method: "DELETE", headers }
      );
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setSelectedItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
    setDeleting(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media..."
            className="w-full bg-secondary/80 border-none rounded-md pl-8 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground/40"
            style={{ fontSize: "12px" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 flex gap-1 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                isActive ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              style={{ fontSize: "10px", fontWeight: isActive ? 600 : 400 }}
            >
              <Icon size={10} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Upload zone */}
      <div
        className={`mx-3 mb-2 border-2 border-dashed rounded-lg p-3 text-center transition-all cursor-pointer ${
          isDragOver ? "border-ora-signal bg-ora-signal-light" : "border-border hover:border-border-strong"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="mx-auto mb-1 text-ora-signal animate-spin" />
            <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--ora-signal)" }}>
              {uploadProgress || "Uploading..."}
            </p>
          </>
        ) : (
          <>
            <Upload size={16} className={`mx-auto mb-1 ${isDragOver ? "text-ora-signal" : "text-muted-foreground"}`} />
            <p style={{ fontSize: "11px", fontWeight: 500, color: isDragOver ? "var(--ora-signal)" : "var(--muted-foreground)" }}>
              Drop files or click to upload
            </p>
            <p style={{ fontSize: "9px", color: "var(--muted-foreground)", marginTop: 2 }}>
              PNG, JPG, SVG, MP4, MOV, MP3
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* AI Generate */}
      <div className="mx-3 mb-2">
        {showGenerate ? (
          <div className="border rounded-lg p-2 space-y-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-ora-signal flex-shrink-0" />
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--foreground)" }}>AI Generate</span>
              <span className="flex-1" />
              <button onClick={() => setShowGenerate(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={10} />
              </button>
            </div>
            <input
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
              placeholder="Describe the image..."
              className="w-full bg-secondary/60 border-none rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/40"
              style={{ fontSize: "11px" }}
              disabled={generating}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !generatePrompt.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--ora-signal)", fontSize: "10px", fontWeight: 500 }}
            >
              {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowGenerate(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", fontSize: "10px", fontWeight: 500 }}
          >
            <Sparkles size={10} />
            AI Generate Image
          </button>
        )}
      </div>

      {/* Media grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)" }}>
            {filteredItems.length} items
          </span>
          {selectedItems.size > 0 && (
            <button
              onClick={() => {
                const item = items.find((i) => selectedItems.has(i.id));
                if (item && onAddToCanvas) onAddToCanvas(item);
              }}
              className="px-2 py-0.5 rounded text-white cursor-pointer"
              style={{ background: "var(--ora-signal)", fontSize: "10px", fontWeight: 500 }}
            >
              Add to canvas ({selectedItems.size})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <AnimatePresence>
            {filteredItems.map((item, i) => {
              const isSelected = selectedItems.has(item.id);
              const isDeleting = deleting === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                  className={`group relative rounded-lg overflow-hidden cursor-pointer border transition-all ${
                    isSelected ? "border-ora-signal ring-1 ring-ora-signal/30" : "border-transparent hover:border-border-strong"
                  } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => toggleSelect(item.id)}
                  onDoubleClick={() => onAddToCanvas?.(item)}
                >
                  <div className="aspect-square relative overflow-hidden" style={item.signedUrl ? {} : { background: item.gradient || "#f0f0f3" }}>
                    {/* Show real image if signed URL exists */}
                    {item.signedUrl && (
                      <img
                        src={item.signedUrl}
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {item.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film size={16} className="text-white/60" />
                      </div>
                    )}
                    {item.type === "audio" as string && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Music size={16} className="text-white/60" />
                      </div>
                    )}
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--ora-signal)" }}>
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    {/* Source badge */}
                    <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 text-white" style={{ fontSize: "8px", fontWeight: 500 }}>
                        {item.source === "generated" ? "AI" : item.source === "brand" ? "Brand" : "Upload"}
                      </span>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                  <div className="p-1.5 bg-card">
                    <p className="truncate" style={{ fontSize: "10px", fontWeight: 450, color: "var(--foreground)" }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>
                      {item.dimensions || item.date || (item.size ? formatSize(item.size) : "")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
