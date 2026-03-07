import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { ArrowLeft, Plus, Search, Filter, MoreHorizontal, FileText, Zap, Trash2, X, Loader2, Check } from "lucide-react";
import { API_BASE } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

const statusColors: Record<string, string> = {
  Live: "bg-green-500",
  Review: "bg-yellow-500",
  Approved: "bg-ora-signal",
  Draft: "bg-muted-foreground/50",
};

interface Campaign {
  id: string;
  name: string;
  brief: string;
  formats: string[];
  score: number;
  status: string;
  date: string;
  pieces: number;
  createdAt?: string;
}

const defaultCampaigns: Campaign[] = [
  { id: "demo-1", name: "Q2 Product Launch", brief: "Launch campaign for AI Analytics feature, targeting CFOs and CTOs", formats: ["LinkedIn", "Email", "SMS", "Landing Page", "Ad", "Stories", "Newsletter"], score: 96, status: "Live", date: "Feb 24, 2026", pieces: 12 },
  { id: "demo-2", name: "Hiring Campaign -- Engineering", brief: "Attract senior engineers with culture-forward messaging", formats: ["LinkedIn", "Email", "SMS", "Stories", "Ad"], score: 93, status: "Review", date: "Feb 23, 2026", pieces: 8 },
  { id: "demo-3", name: "Weekly Newsletter #47", brief: "Product updates, customer story, and industry insights", formats: ["Newsletter"], score: 98, status: "Approved", date: "Feb 22, 2026", pieces: 1 },
];

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrief, setNewBrief] = useState("");
  const [newFormats, setNewFormats] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load campaigns
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/campaigns`);
        const data = await res.json();
        if (data.success && data.campaigns && data.campaigns.length > 0) {
          setCampaigns(data.campaigns);
        } else {
          setCampaigns(defaultCampaigns);
        }
      } catch (err) {
        console.error("Failed to load campaigns:", err);
        setCampaigns(defaultCampaigns);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Create campaign
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          brief: newBrief,
          formats: newFormats.length > 0 ? newFormats : ["LinkedIn"],
          score: 0,
          status: "Draft",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          pieces: 0,
        }),
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev]);
      }
      setNewName("");
      setNewBrief("");
      setNewFormats([]);
      setShowNew(false);
    } catch (err) {
      console.error("Failed to create campaign:", err);
    } finally {
      setCreating(false);
    }
  };

  // Delete campaign
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/campaigns/${id}`, {
        method: "DELETE",
      });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete campaign:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const allFormats = ["LinkedIn", "Email", "SMS", "Landing Page", "Ad", "Stories", "Newsletter"];
  const filtered = campaigns.filter((c) =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.brief.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPieces = campaigns.reduce((a, c) => a + c.pieces, 0);

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/studio" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Studio
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground mb-1" style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.03em" }}>Campaigns</h1>
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>{campaigns.length} campaigns &middot; {totalPieces} content pieces</p>
            </div>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 500 }}>
              <Plus size={15} /> New Campaign
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Search bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search campaigns..."
              className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal outline-none" style={{ fontSize: "14px" }} />
          </div>
        </div>

        {/* New campaign form */}
        <AnimatePresence>
          {showNew && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="bg-card border border-ora-signal/30 rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(59,79,196,0.06)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>New Campaign</span>
                  <button onClick={() => setShowNew(false)} className="text-muted-foreground cursor-pointer"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Campaign name..."
                    className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal outline-none" style={{ fontSize: "14px" }} />
                  <input value={newBrief} onChange={(e) => setNewBrief(e.target.value)} placeholder="Brief description..."
                    className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal outline-none" style={{ fontSize: "14px" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)", fontWeight: 500 }}>Formats:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allFormats.map((f) => (
                        <button key={f} onClick={() => setNewFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                          className={`px-3 py-1.5 rounded-md border transition-all cursor-pointer ${newFormats.includes(f) ? "bg-ora-signal-light border-ora-signal/20 text-ora-signal" : "border-border text-muted-foreground hover:text-foreground"}`}
                          style={{ fontSize: "12px", fontWeight: newFormats.includes(f) ? 500 : 400 }}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleCreate} disabled={creating || !newName.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                    style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {creating ? "Creating..." : "Create Campaign"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-ora-signal" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((campaign, i) => (
              <motion.div key={campaign.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-5 hover:border-border-strong transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-foreground" style={{ fontSize: "16px", fontWeight: 500 }}>{campaign.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-white ${statusColors[campaign.status] || "bg-muted-foreground/50"}`} style={{ fontSize: "10px", fontWeight: 600 }}>
                        {campaign.status}
                      </span>
                      {campaign.score > 0 && (
                        <span className="text-ora-signal" style={{ fontSize: "14px", fontWeight: 600 }}>{campaign.score}/100</span>
                      )}
                    </div>
                    <p className="text-muted-foreground" style={{ fontSize: "14px" }}>{campaign.brief}</p>
                  </div>
                  <button onClick={() => handleDelete(campaign.id)} disabled={deletingId === campaign.id}
                    className="text-muted-foreground hover:text-destructive p-1 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                    {deletingId === campaign.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {campaign.formats.map((f) => (
                      <span key={f} className="px-2 py-1 rounded-md bg-secondary text-muted-foreground" style={{ fontSize: "11px", fontWeight: 450 }}>{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="text-muted-foreground flex items-center gap-1" style={{ fontSize: "12px" }}>
                      <FileText size={12} /> {campaign.pieces} pieces
                    </span>
                    <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{campaign.date}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground" style={{ fontSize: "15px" }}>No campaigns found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}