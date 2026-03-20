import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth-context";
import { RouteGuard } from "../components/RouteGuard";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Mail, Building2, Briefcase, Shield, CreditCard,
  ArrowRight, Check, Lock, Sparkles, BarChart3, Clock,
  Download, ExternalLink, Settings, Bell, Key, Users,
  ImageIcon, FileText, Film, Music, Code2, RefreshCcw,
  GitBranch, Zap, ChevronRight, Crown, AlertCircle,
  FolderOpen, Globe, Palette, BookOpen, Eye,
  Calendar, TrendingUp, Layers, PenTool,
  Linkedin, Instagram, Facebook, Twitter, Plus, Loader2, Send, RefreshCw,
} from "lucide-react";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type PlanTier = "free" | "pro" | "business";
type ProfileTab = "overview" | "library" | "team" | "settings";

interface UserProfile {
  name: string;
  email: string;
  company: string;
  role: string;
  initials: string;
  plan: PlanTier;
  joinedDate: string;
  avatar?: string;
}

interface PlanDetails {
  name: string;
  price: string;
  period: string;
  color: string;
  agents: number;
  maxAgents: number;
  contentUsed: number;
  contentMax: number;
  vaults: number;
  maxVaults: number;
  campaigns: number;
  maxCampaigns: number;
  storageUsed: number;
  storageMax: number;
  renewalDate: string;
  features: string[];
  lockedFeatures: string[];
}

interface LibraryAsset {
  id: string;
  type: "image" | "text" | "code" | "film" | "sound";
  name: string;
  date: string;
  source: "hub" | "remix" | "studio";
}

interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  icon: typeof Sparkles;
  iconColor: string;
}

interface TeamMember {
  name: string;
  email: string;
  role: string;
  initials: string;
  status: "active" | "invited";
}

/* ═══════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════ */

const freeUser: UserProfile = {
  name: "Alex Martin",
  email: "alex@martin-studio.com",
  company: "Martin Studio",
  role: "Founder",
  initials: "AM",
  plan: "free",
  joinedDate: "Feb 2026",
};

const agencyUser: UserProfile = {
  name: "Alex Martin",
  email: "alex@acmecorp.com",
  company: "Acme Corp",
  role: "CMO",
  initials: "AM",
  plan: "business",
  joinedDate: "Nov 2025",
};

const planData: Record<PlanTier, PlanDetails> = {
  free: {
    name: "Free",
    price: "0",
    period: "",
    color: "var(--muted-foreground)",
    agents: 1,
    maxAgents: 1,
    contentUsed: 3,
    contentMax: 50,
    vaults: 0,
    maxVaults: 0,
    campaigns: 0,
    maxCampaigns: 0,
    storageUsed: 0.02,
    storageMax: 0.1,
    renewalDate: "--",
    features: ["50 credits, no card required", "3 AI models (GPT-4o, Claude, Gemini)", "Text and image generation", "Basic Arena (2 models)", "Credits never expire"],
    lockedFeatures: ["All AI models (10+)", "Code, audio, video generation", "Full Arena", "Brand Vault", "Campaign Lab", "Canvas editor", "Priority support"],
  },
  pro: {
    name: "Pro",
    price: "39",
    period: "/mo",
    color: "var(--ora-signal)",
    agents: 10,
    maxAgents: 10,
    contentUsed: 187,
    contentMax: 500,
    vaults: 0,
    maxVaults: 0,
    campaigns: 0,
    maxCampaigns: 0,
    storageUsed: 2.1,
    storageMax: 10,
    renewalDate: "Apr 4, 2026",
    features: ["500 credits/month included", "All AI models (10+)", "Text, image, code, audio, video", "Full Arena (unlimited models)", "Priority generation queue", "Credit packs available", "Credits roll over indefinitely"],
    lockedFeatures: ["Brand Vault", "Campaign Lab", "Canvas editor", "Asset Builder", "Brand Score", "Content Calendar", "Priority support"],
  },
  business: {
    name: "Business",
    price: "149",
    period: "/mo",
    color: "var(--ora-signal)",
    agents: 15,
    maxAgents: 15,
    contentUsed: 1240,
    contentMax: 2500,
    vaults: 3,
    maxVaults: 5,
    campaigns: 8,
    maxCampaigns: -1,
    storageUsed: 12.4,
    storageMax: 50,
    renewalDate: "Apr 4, 2026",
    features: ["2,500 credits/month included", "Everything in Pro +", "Brand Vault (brand identity)", "Campaign Lab (multi-platform)", "Canvas editor (Canva-like)", "Complete Asset Builder", "Brand Score & compliance", "Content Calendar", "Priority support"],
    lockedFeatures: [],
  },
};

const mockLibraryFree: LibraryAsset[] = [
  { id: "a1", type: "image", name: "Abstract brand pattern", date: "Today", source: "hub" },
  { id: "a2", type: "text", name: "Product description draft", date: "Yesterday", source: "hub" },
  { id: "a3", type: "text", name: "Tagline variations", date: "2 days ago", source: "hub" },
];

const mockLibraryAgency: LibraryAsset[] = [
  { id: "a1", type: "image", name: "Q2 Campaign — Hero Visual", date: "Today", source: "studio" },
  { id: "a2", type: "text", name: "LinkedIn post — Product Launch", date: "Today", source: "remix" },
  { id: "a3", type: "code", name: "Email template — April NL", date: "Yesterday", source: "studio" },
  { id: "a4", type: "film", name: "15s Social Teaser", date: "Yesterday", source: "hub" },
  { id: "a5", type: "sound", name: "Podcast intro jingle", date: "2 days ago", source: "hub" },
  { id: "a6", type: "image", name: "Ad Creative — Variant B", date: "2 days ago", source: "studio" },
  { id: "a7", type: "text", name: "Email copy — Re-engagement", date: "3 days ago", source: "remix" },
  { id: "a8", type: "image", name: "Newsletter header", date: "4 days ago", source: "studio" },
];

const mockActivityFree: ActivityItem[] = [
  { id: "act1", action: "Generated image", detail: "Abstract pattern via AI Hub", timestamp: "2h ago", icon: ImageIcon, iconColor: "var(--ora-signal)" },
  { id: "act2", action: "Generated text", detail: "Product description draft", timestamp: "Yesterday", icon: FileText, iconColor: "#6b7ec9" },
  { id: "act3", action: "Signed up", detail: "Welcome to ORA", timestamp: "2 days ago", icon: Sparkles, iconColor: "var(--ora-signal)" },
];

const mockActivityAgency: ActivityItem[] = [
  { id: "act1", action: "Ran flow", detail: "Product Launch Campaign — 4 steps completed", timestamp: "32m ago", icon: GitBranch, iconColor: "var(--ora-signal)" },
  { id: "act2", action: "Remixed content", detail: "Competitor ad → 4 brand-compliant formats", timestamp: "1h ago", icon: RefreshCcw, iconColor: "#6b7ec9" },
  { id: "act3", action: "Exported campaign", detail: "Q2 Launch — LinkedIn + Email + Ad + Stories", timestamp: "2h ago", icon: Download, iconColor: "#16a34a" },
  { id: "act4", action: "Brand score: 96/100", detail: "Newsletter copy validated by Compliance Guard", timestamp: "3h ago", icon: Shield, iconColor: "#16a34a" },
  { id: "act5", action: "Generated visuals", detail: "4 variants via AI Hub (Flux Pro, DALL-E 3)", timestamp: "Yesterday", icon: ImageIcon, iconColor: "var(--ora-signal)" },
  { id: "act6", action: "Updated Brand Vault", detail: "Added 12 new approved terms", timestamp: "Yesterday", icon: BookOpen, iconColor: "#d97706" },
  { id: "act7", action: "Team invite sent", detail: "sarah@acmecorp.com — Editor role", timestamp: "2 days ago", icon: Users, iconColor: "#4a5568" },
];

const mockTeam: TeamMember[] = [
  { name: "Alex Martin", email: "alex@acmecorp.com", role: "Owner", initials: "AM", status: "active" },
  { name: "Sarah Chen", email: "sarah@acmecorp.com", role: "Editor", initials: "SC", status: "active" },
  { name: "Jules Moreau", email: "jules@acmecorp.com", role: "Viewer", initials: "JM", status: "active" },
  { name: "Lena Park", email: "lena@acmecorp.com", role: "Editor", initials: "LP", status: "invited" },
];

/* ═══════════════════════════════════
   TYPE ICONS
   ═══════════════════════════════════ */

const typeIcons: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  text: FileText,
  code: Code2,
  film: Film,
  sound: Music,
};

const sourceLabels: Record<string, string> = {
  hub: "AI Hub",
  remix: "Remix",
  studio: "Studio",
};

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */

export function ProfilePage() {
  return (
    <RouteGuard requireAuth>
      <ProfilePageContent />
    </RouteGuard>
  );
}

function ProfilePageContent() {
  const { user: authCtxUser, profile, isAdmin, plan: authPlan, remainingCredits, signOut, isLoading: authLoading, accessToken } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [realLibrary, setRealLibrary] = useState<LibraryAsset[]>([]);
  const [realActivity, setRealActivity] = useState<ActivityItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authCtxUser) {
      navigate("/login");
    }
  }, [authLoading, authCtxUser, navigate]);

  // Fetch real library items for profile view
  useEffect(() => {
    if (!accessToken) { setLibraryLoading(false); return; }
    (async () => {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "text/plain",
        };
        const res = await fetch(`${API_BASE}/library/list`, {
          method: "POST",
          headers,
          body: JSON.stringify({ _token: accessToken }),
          signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json();
        if (data.success && data.items) {
          const items: LibraryAsset[] = data.items.slice(0, 12).map((item: any) => {
            const typeMap: Record<string, string> = { image: "image", text: "text", code: "code", film: "film", sound: "sound" };
            const itemType = typeMap[item.type] || "text";
            const name = item.customName || item.prompt?.slice(0, 60) || "Untitled";
            const savedDate = item.savedAt ? new Date(item.savedAt) : new Date();
            const now = new Date();
            const diffMs = now.getTime() - savedDate.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            let dateStr = "Today";
            if (diffDays === 1) dateStr = "Yesterday";
            else if (diffDays > 1 && diffDays < 7) dateStr = `${diffDays} days ago`;
            else if (diffDays >= 7) dateStr = savedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            return { id: item.id, type: itemType as LibraryAsset["type"], name, date: dateStr, source: "hub" as const };
          });
          setRealLibrary(items);

          // Build activity from most recent library items
          const typeActions: Record<string, { action: string; icon: typeof Sparkles; iconColor: string }> = {
            image: { action: "Generated image", icon: ImageIcon, iconColor: "var(--ora-signal)" },
            text: { action: "Generated text", icon: FileText, iconColor: "#6b7ec9" },
            code: { action: "Generated code", icon: Code2, iconColor: "#16a34a" },
            film: { action: "Generated video", icon: Film, iconColor: "#d97706" },
            sound: { action: "Generated audio", icon: Music, iconColor: "#c026d3" },
          };
          const acts: ActivityItem[] = items.slice(0, 8).map((item, i) => {
            const cfg = typeActions[item.type] || typeActions.text;
            return {
              id: `act-${i}`,
              action: cfg.action,
              detail: item.name,
              timestamp: item.date,
              icon: cfg.icon,
              iconColor: cfg.iconColor,
            };
          });
          if (acts.length === 0) {
            acts.push({ id: "act-signup", action: "Signed up", detail: "Welcome to ORA", timestamp: "Recently", icon: Sparkles, iconColor: "var(--ora-signal)" });
          }
          setRealActivity(acts);
        }
      } catch (err) {
        console.error("[Profile] Library fetch error:", err);
      }
      setLibraryLoading(false);
    })();
  }, [accessToken]);

  // Plan is now already mapped in auth-context (free/pro/business)
  const isSubscriber = authPlan !== "free";
  const mappedPlan: PlanTier = authPlan as PlanTier;

  const baseUser = isSubscriber ? agencyUser : freeUser;
  const user: UserProfile = authCtxUser ? {
    ...baseUser,
    name: profile?.name || authCtxUser.name || authCtxUser.email.split("@")[0],
    email: authCtxUser.email,
    initials: (profile?.name || authCtxUser.name || authCtxUser.email.split("@")[0]).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
    plan: mappedPlan,
    joinedDate: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Mar 2026",
    company: profile?.company || baseUser.company,
    role: profile?.jobTitle || baseUser.role,
  } : baseUser;
  const plan = planData[user.plan];

  // Use real library/activity data when available, fallback to mock
  const library = realLibrary.length > 0 ? realLibrary : (isSubscriber ? mockLibraryAgency : mockLibraryFree);
  const activity = realActivity.length > 0 ? realActivity : (isSubscriber ? mockActivityAgency : mockActivityFree);

  // Update plan usage from real profile data
  if (profile) {
    plan.contentUsed = profile.creditsUsed || 0;
    plan.contentMax = profile.credits || plan.contentMax;
  }

  const tabs: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "library", label: "Library", icon: FolderOpen },
    { id: "team", label: "Team", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1200px] mx-auto px-6 py-8">

        {/* Auth status + Credits */}
        <div className="flex items-center justify-between mb-6">
          {authCtxUser && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                  Signed in as {authCtxUser.email}
                </span>
              </div>
              {!isAdmin && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border" style={{ fontSize: "11px" }}>
                  <Zap size={10} className="text-ora-signal" />
                  <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{remainingCredits}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>credits remaining</span>
                </div>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: "var(--ora-signal-light)", fontSize: "11px", fontWeight: 500, color: "var(--ora-signal)" }}>
                  <Shield size={10} /> Admin -- unlimited
                </span>
              )}
            </div>
          )}
          <div className="ml-auto" />
        </div>

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div className="flex items-center gap-5">
            <div
              className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
              style={{
                background: isSubscriber ? "var(--primary)" : "var(--secondary)",
                color: isSubscriber ? "var(--primary-foreground)" : "var(--muted-foreground)",
                fontSize: "22px",
                fontWeight: 600,
              }}
            >
              {user.initials}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.2 }}>
                  {user.name}
                </h1>
                <PlanBadge plan={user.plan} />
              </div>
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                {user.role} at {user.company}
              </p>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                  <Mail size={10} /> {user.email}
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                  <Calendar size={10} /> Joined {user.joinedDate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ora-signal/20 text-ora-signal hover:bg-ora-signal-light transition-colors"
                style={{ fontSize: "12px", fontWeight: 500 }}
              >
                <Shield size={13} /> Admin Dashboard
              </Link>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border hover:bg-secondary transition-colors cursor-pointer"
              style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}
            >
              {authCtxUser ? "Sign out" : "Edit profile"}
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b" style={{ borderColor: "var(--border)" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLocked = !isSubscriber && (tab.id === "team");
            return (
              <button
                key={tab.id}
                onClick={() => !isLocked && setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-all cursor-pointer -mb-px ${
                  isActive
                    ? "border-ora-signal text-foreground"
                    : isLocked
                    ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                style={{ fontSize: "13px", fontWeight: isActive ? 500 : 400 }}
              >
                {isLocked ? <Lock size={12} /> : <Icon size={13} />}
                {tab.label}
                {isLocked && (
                  <span className="px-1.5 py-0.5 rounded bg-secondary ml-1" style={{ fontSize: "8px", fontWeight: 600, color: "var(--muted-foreground)" }}>
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <OverviewTab user={user} plan={plan} activity={activity} library={library} isSubscriber={isSubscriber} />
            </motion.div>
          )}
          {activeTab === "library" && (
            <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <LibraryTab library={library} isSubscriber={isSubscriber} />
            </motion.div>
          )}
          {activeTab === "team" && isSubscriber && (
            <motion.div key="team" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <TeamTab />
            </motion.div>
          )}
          {activeTab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SettingsTab isSubscriber={isSubscriber} authEmail={authCtxUser?.email} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   PLAN BADGE
   ═══════════════════════════════════ */

function PlanBadge({ plan }: { plan: PlanTier }) {
  const config = {
    free: { label: "Free", bg: "var(--secondary)", color: "var(--muted-foreground)", icon: null },
    pro: { label: "Pro", bg: "var(--ora-signal-light)", color: "var(--ora-signal)", icon: null },
    business: { label: "Business", bg: "var(--ora-signal-light)", color: "var(--ora-signal)", icon: Crown },
  }[plan];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: config.bg, fontSize: "11px", fontWeight: 600, color: config.color }}>
      {config.icon && <Crown size={10} />}
      {config.label}
    </span>
  );
}

/* ═══════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════ */

function OverviewTab({ user, plan, activity, library, isSubscriber }: { user: UserProfile; plan: PlanDetails; activity: ActivityItem[]; library: LibraryAsset[]; isSubscriber: boolean }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        {/* Subscription Card */}
        <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.03)" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <CreditCard size={14} style={{ color: plan.color }} />
                  <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Current plan</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontSize: "28px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                    {plan.price === "0" ? "Free" : `${plan.price}`}
                  </span>
                  {plan.period && <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{plan.period}</span>}
                </div>
              </div>
              {!isSubscriber ? (
                <Link to="/pricing" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white hover:opacity-90 transition-opacity" style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
                  <Zap size={14} /> Upgrade
                </Link>
              ) : (
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Renews {plan.renewalDate}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <UsageMeter label="Content pieces" used={plan.contentUsed} max={plan.contentMax} icon={FileText} unit="" />
              <UsageMeter label="Active agents" used={plan.agents} max={plan.maxAgents} icon={Sparkles} unit="" />
              <UsageMeter label="Brand Vaults" used={plan.vaults} max={plan.maxVaults} icon={BookOpen} unit="" />
              <UsageMeter label="Storage" used={plan.storageUsed} max={plan.storageMax} icon={FolderOpen} unit=" GB" />
            </div>
          </div>
          {!isSubscriber && (
            <div className="border-t px-5 py-4 bg-ora-signal-light/20" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <Crown size={14} className="text-ora-signal flex-shrink-0" />
                <p className="flex-1" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>15 agents, Brand Vault, Studio, Flows, Remix, unlimited campaigns</p>
                <Link to="/pricing" className="text-ora-signal flex items-center gap-1 flex-shrink-0" style={{ fontSize: "12px", fontWeight: 500 }}>
                  See plans <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
        <QuickAccess isSubscriber={isSubscriber} />
      </div>
      {/* Activity */}
      <div className="border rounded-xl bg-card p-5" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Recent activity</span>
        <div className="mt-4 space-y-0">
          {activity.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative">
                {i < activity.length - 1 && <div className="absolute left-[13px] top-[32px] w-px h-[calc(100%-16px)]" style={{ background: "var(--border)" }} />}
                <div className="flex gap-3 py-2.5">
                  <div className="w-[26px] h-[26px] rounded-full border bg-card flex items-center justify-center flex-shrink-0 z-10" style={{ borderColor: "var(--border)" }}>
                    <Icon size={10} style={{ color: item.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{item.action}</p>
                    <p className="truncate" style={{ fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1.4 }}>{item.detail}</p>
                    <span style={{ fontSize: "9px", color: "var(--muted-foreground)", opacity: 0.6 }}>{item.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   USAGE METER
   ═══════════════════════════════════ */

function UsageMeter({ label, used, max, icon: Icon, unit }: { label: string; used: number; max: number; icon: typeof FileText; unit: string }) {
  const percent = max <= 0 ? (max === -1 ? 30 : 0) : Math.min((used / max) * 100, 100);
  const isUnlimited = max === -1;
  const isNear = !isUnlimited && max > 0 && percent > 80;
  return (
    <div className="p-3 rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={11} className="text-muted-foreground" />
          <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)" }}>{label}</span>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 600, color: isNear ? "var(--destructive)" : "var(--foreground)" }}>
          {used}{unit}{isUnlimited ? "" : ` / ${max}${unit}`}
        </span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${max === 0 ? 0 : percent}%`, background: isNear ? "var(--destructive)" : "var(--ora-signal)" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   QUICK ACCESS
   ═══════════════════════════════════ */

function QuickAccess({ isSubscriber }: { isSubscriber: boolean }) {
  const items = [
    { label: "AI Hub", desc: "Generate with multiple models", href: "/hub", icon: Sparkles, locked: false },
    { label: "Library", desc: "Your saved content", href: "/hub/library", icon: BookOpen, locked: false },
    { label: "Brand Vault", desc: "Your brand's DNA", href: "/hub/vault", icon: BookOpen, locked: !isSubscriber },
    { label: "Analytics", desc: "Track performance", href: "/hub/analytics", icon: GitBranch, locked: !isSubscriber },
  ];
  return (
    <div>
      <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Quick access</span>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className={`relative p-3 rounded-xl border transition-all ${item.locked ? "opacity-50 cursor-not-allowed" : "hover:border-border-strong hover:bg-secondary/20 cursor-pointer"}`} style={{ borderColor: "var(--border)" }}>
              {item.locked && <Lock size={9} className="absolute top-2 right-2 text-muted-foreground/40" />}
              <Icon size={16} className={item.locked ? "text-muted-foreground/30 mb-2" : "text-ora-signal mb-2"} />
              <p style={{ fontSize: "12px", fontWeight: 500, color: item.locked ? "var(--muted-foreground)" : "var(--foreground)" }}>{item.label}</p>
              <p style={{ fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1.3 }}>{item.desc}</p>
            </div>
          );
          return item.locked ? <div key={item.label}>{content}</div> : <Link key={item.label} to={item.href}>{content}</Link>;
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   LIBRARY TAB
   ═══════════════════════════════════ */

function LibraryTab({ library, isSubscriber }: { library: LibraryAsset[]; isSubscriber: boolean }) {
  const [filter, setFilter] = useState<string>("all");
  const types = ["all", "image", "text", "code", "film", "sound"];
  const filtered = filter === "all" ? library : library.filter((a) => a.type === filter);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-5">
        {types.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer ${filter === t ? "bg-ora-signal-light border-ora-signal/20 text-ora-signal" : "border-border text-muted-foreground hover:text-foreground"}`}
            style={{ fontSize: "11px", fontWeight: filter === t ? 500 : 400, textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((asset, i) => {
          const Icon = typeIcons[asset.type];
          return (
            <motion.div key={asset.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="border rounded-xl bg-card overflow-hidden hover:border-border-strong transition-all cursor-pointer group" style={{ borderColor: "var(--border)" }}>
              <div className="h-28 bg-secondary/40 flex items-center justify-center relative">
                <Icon size={24} className="text-muted-foreground/20" />
                <div className="absolute top-2 left-2">
                  <span className="px-1.5 py-0.5 rounded bg-white/80 backdrop-blur-sm" style={{ fontSize: "9px", fontWeight: 500, color: "var(--muted-foreground)", textTransform: "capitalize" }}>{asset.type}</span>
                </div>
              </div>
              <div className="p-3">
                <p className="truncate mb-0.5" style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>{asset.name}</p>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-secondary" style={{ fontSize: "9px", fontWeight: 500, color: "var(--muted-foreground)" }}>{sourceLabels[asset.source]}</span>
                  <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{asset.date}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   TEAM TAB
   ═══════════════════════════════════ */

function TeamTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)" }}>Team</h2>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{mockTeam.length} members</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer" style={{ background: "var(--ora-signal)", fontSize: "12px", fontWeight: 500 }}>
          <Users size={13} /> Invite member
        </button>
      </div>
      <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-[1fr_1fr_120px_80px] gap-4 px-5 py-2.5 border-b bg-secondary/30" style={{ borderColor: "var(--border)" }}>
          {["Member", "Email", "Role", "Status"].map((h) => (
            <span key={h} style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</span>
          ))}
        </div>
        {mockTeam.map((member) => (
          <div key={member.email} className="grid grid-cols-[1fr_1fr_120px_80px] gap-4 px-5 py-3 border-b last:border-b-0 hover:bg-secondary/20" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-foreground)" }}>{member.initials}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{member.name}</span>
            </div>
            <span className="flex items-center" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{member.email}</span>
            <span className="flex items-center px-2 py-0.5 rounded bg-secondary self-center justify-self-start" style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)" }}>{member.role}</span>
            <div className="flex items-center">
              {member.status === "active" ? (
                <span className="flex items-center gap-1" style={{ fontSize: "10px", fontWeight: 500, color: "#16a34a" }}><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active</span>
              ) : (
                <span className="flex items-center gap-1" style={{ fontSize: "10px", fontWeight: 500, color: "#d97706" }}><Clock size={9} /> Invited</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   SOCIAL ACCOUNTS SECTION (transparent Zernio)
   ═══════════════════════════════════ */

const SOCIAL_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0077B5" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { id: "twitter", label: "Twitter/X", icon: Twitter, color: "#1DA1F2" },
];

function SocialAccountsSection() {
  const auth = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const makeHeaders = useCallback(() => {
    return { Authorization: `Bearer ${publicAnonKey}` } as Record<string, string>;
  }, []);

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    const token = auth.getAuthHeader();
    const url = token ? `${API_BASE}/zernio/accounts?_token=${encodeURIComponent(token)}` : `${API_BASE}/zernio/accounts`;
    fetch(url, { headers: makeHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success && data.accounts) setAccounts(data.accounts); })
      .catch(err => console.error("[SocialAccounts] Fetch error:", err))
      .finally(() => setLoading(false));
  }, [makeHeaders]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleConnect = useCallback(async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch(`${API_BASE}/zernio/connect/${platform}?redirectUrl=${encodeURIComponent(window.location.origin + "/profile")}`, {
        headers: makeHeaders(),
      });
      const data = await res.json();
      if (!data.success || !data.authUrl) {
        setConnecting(null);
        return;
      }
      const popup = window.open(data.authUrl, `connect_${platform}`, "width=600,height=700,left=200,top=100");
      if (!popup) { setConnecting(null); return; }
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          setConnecting(null);
          setTimeout(() => fetchAccounts(), 1500);
        }
      }, 500);
      setTimeout(() => { clearInterval(poll); if (!popup.closed) popup.close(); setConnecting(null); }, 300_000);
    } catch { setConnecting(null); }
  }, [makeHeaders, fetchAccounts]);

  const handleDisconnect = useCallback(async (platform: string, accountId?: string) => {
    setDisconnecting(platform);
    try {
      const res = await fetch(`${API_BASE}/zernio/disconnect`, {
        method: "POST",
        headers: { ...makeHeaders(), "Content-Type": "text/plain" },
        body: JSON.stringify({ _token: auth.getAuthHeader(), platform, accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(prev => prev.filter((a: any) => a.platform !== platform));
      }
    } catch (err) { console.error("[SocialAccounts] Disconnect error:", err); }
    finally { setDisconnecting(null); }
  }, [makeHeaders, auth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Social Accounts</h3>
        <button onClick={fetchAccounts} className="cursor-pointer p-1 rounded hover:bg-secondary transition-colors" title="Refresh">
          <RefreshCw size={12} className={`text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {SOCIAL_PLATFORMS.map((p, i) => {
          const connected = accounts.find((a: any) => a.platform === p.id);
          const isConnecting = connecting === p.id;
          const Icon = p.icon;
          return (
            <div key={p.id} className={`flex items-center justify-between px-5 py-3 ${i < SOCIAL_PLATFORMS.length - 1 ? "border-b" : ""}`} style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${p.color}12` }}>
                  <Icon size={14} style={{ color: p.color }} />
                </div>
                <div>
                  <span style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: 500 }}>{p.label}</span>
                  {connected && (
                    <span className="block" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                      {connected.username ? `@${connected.username}` : "Connected"}
                    </span>
                  )}
                </div>
              </div>
              {connected ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)", fontSize: "10px", fontWeight: 600, color: "#10b981" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
                    Connected
                  </span>
                  <button
                    onClick={() => handleDisconnect(p.id, connected._id)}
                    disabled={disconnecting === p.id}
                    className="px-2 py-0.5 rounded text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    style={{ fontSize: "10px", fontWeight: 500 }}
                  >
                    {disconnecting === p.id ? "..." : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={isConnecting || !!connecting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer transition-all hover:bg-secondary"
                  style={{ borderColor: "var(--border)", fontSize: "11px", fontWeight: 500, color: "var(--foreground)", opacity: connecting && !isConnecting ? 0.4 : 1 }}
                >
                  {isConnecting ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
        Connect your social accounts to publish content directly from Campaign Lab.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════
   SETTINGS TAB
   ═══════════════════════════════════ */

function SettingsTab({ isSubscriber, authEmail }: { isSubscriber: boolean; authEmail?: string }) {
  const sections = [
    {
      title: "Profile",
      items: [
        { label: "Display name", value: isSubscriber ? "Alex Martin" : "Alex Martin", editable: true },
        { label: "Email", value: authEmail || (isSubscriber ? "alex@acmecorp.com" : "alex@martin-studio.com"), editable: true },
        { label: "Company", value: isSubscriber ? "Acme Corp" : "Martin Studio", editable: true },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "Campaign alerts", value: isSubscriber ? "Enabled" : "Disabled", editable: true },
        { label: "Weekly digest", value: isSubscriber ? "Enabled" : "Disabled", editable: true },
      ],
    },
    {
      title: "Integrations",
      items: [
        { label: "API key", value: isSubscriber ? "sk-ora-...7f3a" : "Upgrade required", editable: isSubscriber },
        { label: "Figma Connect", value: isSubscriber ? "Connected" : "Upgrade required", editable: isSubscriber },
      ],
    },
  ];
  return (
    <div className="max-w-[720px] space-y-8">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-4" style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>{section.title}</h3>
          <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {section.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <span style={{ fontSize: "13px", color: "var(--foreground)" }}>{item.label}</span>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "12px", color: "var(--muted-foreground)", opacity: item.editable ? 1 : 0.4 }}>{item.value}</span>
                  {item.editable ? (
                    <button className="px-2.5 py-1 rounded-md border hover:bg-secondary cursor-pointer transition-colors" style={{ borderColor: "var(--border)", fontSize: "10px", fontWeight: 500 }}>Edit</button>
                  ) : (
                    <Lock size={10} className="text-muted-foreground/30" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div>
        <h3 className="mb-4" style={{ fontSize: "14px", fontWeight: 500, color: "var(--destructive)" }}>Danger zone</h3>
        <div className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "rgba(212,24,61,0.15)" }}>
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p style={{ fontSize: "13px", color: "var(--foreground)" }}>Delete account</p>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Permanently delete your account and all data</p>
            </div>
            <button className="px-3 py-1.5 rounded-md border text-destructive hover:bg-destructive/5 cursor-pointer transition-colors" style={{ borderColor: "rgba(212,24,61,0.2)", fontSize: "11px", fontWeight: 500 }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}