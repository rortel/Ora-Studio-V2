import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth-context";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Mail, Building2, Briefcase, Shield, CreditCard,
  ArrowRight, Check, Lock, Sparkles, BarChart3, Clock,
  Download, ExternalLink, Settings, Bell, Key, Users,
  ImageIcon, FileText, Film, Music, Code2, RefreshCcw,
  GitBranch, Zap, ChevronRight, Crown, AlertCircle,
  FolderOpen, Globe, Palette, BookOpen, Eye,
  Calendar, TrendingUp, Layers, PenTool,
} from "lucide-react";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type PlanTier = "free" | "starter" | "agency" | "enterprise";
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
  plan: "agency",
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
    contentMax: 5,
    vaults: 0,
    maxVaults: 0,
    campaigns: 0,
    maxCampaigns: 0,
    storageUsed: 0.02,
    storageMax: 0.1,
    renewalDate: "--",
    features: ["AI Hub (3 generations)", "Basic text & image"],
    lockedFeatures: ["Brand Vault", "Studio access", "Flows", "Remix", "Campaigns", "Analytics", "Team", "API access", "Priority support"],
  },
  starter: {
    name: "Starter",
    price: "99",
    period: "/mo",
    color: "var(--ora-signal)",
    agents: 3,
    maxAgents: 3,
    contentUsed: 12,
    contentMax: 20,
    vaults: 1,
    maxVaults: 1,
    campaigns: 2,
    maxCampaigns: 3,
    storageUsed: 0.8,
    storageMax: 5,
    renewalDate: "Apr 4, 2026",
    features: ["1 Brand Vault", "3 agents", "20 pieces/mo", "AI Hub", "Remix (basic)", "Email support"],
    lockedFeatures: ["Full 15-agent team", "Flows", "Campaign Multiplier (10+)", "Team access", "API access", "Priority support"],
  },
  agency: {
    name: "Agency",
    price: "299",
    period: "/mo",
    color: "var(--ora-signal)",
    agents: 15,
    maxAgents: 15,
    contentUsed: 64,
    contentMax: 100,
    vaults: 3,
    maxVaults: 5,
    campaigns: 8,
    maxCampaigns: -1,
    storageUsed: 12.4,
    storageMax: 50,
    renewalDate: "Apr 4, 2026",
    features: ["Full 15-agent team", "Command Center", "Unlimited campaigns", "AI Hub (unlimited)", "Remix", "Flows", "Weekly Strategic Brief", "Approval workflow", "Figma Connect", "Priority support"],
    lockedFeatures: ["Multi-brand Vaults", "Crisis Shield", "API + SSO"],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    period: "",
    color: "#d4a853",
    agents: 15,
    maxAgents: 15,
    contentUsed: 312,
    contentMax: -1,
    vaults: 8,
    maxVaults: -1,
    campaigns: 24,
    maxCampaigns: -1,
    storageUsed: 48.2,
    storageMax: -1,
    renewalDate: "Annual — Jun 1, 2026",
    features: ["Everything in Agency", "Multi-brand Vaults", "Private fine-tuning", "Crisis Shield", "Competitive War Room", "API + SSO", "Dedicated CSM"],
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
  const { user: authCtxUser, profile, isAdmin, remainingCredits, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authCtxUser) {
      navigate("/login");
    }
  }, [authLoading, authCtxUser, navigate]);

  // Map real profile plan to legacy plan tiers for display
  const realPlan = profile?.plan || "free";
  const isSubscriber = realPlan !== "free";
  const mappedPlan: PlanTier = realPlan === "studio" ? "agency" : realPlan === "generate" ? "starter" : "free";

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
  const library = isSubscriber ? mockLibraryAgency : mockLibraryFree;
  const activity = isSubscriber ? mockActivityAgency : mockActivityFree;

  const tabs: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "library", label: "Library", icon: FolderOpen },
    { id: "team", label: "Team", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
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
    starter: { label: "Starter", bg: "var(--ora-signal-light)", color: "var(--ora-signal)", icon: null },
    agency: { label: "Agency", bg: "var(--ora-signal-light)", color: "var(--ora-signal)", icon: Crown },
    enterprise: { label: "Enterprise", bg: "rgba(212,168,83,0.1)", color: "#d4a853", icon: Crown },
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
    { label: "Remix", desc: "Paste anything, get your version", href: "/remix", icon: RefreshCcw, locked: !isSubscriber },
    { label: "Flows", desc: "Chain AI operations", href: "/flows", icon: GitBranch, locked: !isSubscriber },
    { label: "Studio", desc: "Edit across all formats", href: "/studio", icon: Layers, locked: !isSubscriber },
    { label: "Brand Vault", desc: "Your brand's DNA", href: "/studio/vault", icon: BookOpen, locked: !isSubscriber },
    { label: "Campaigns", desc: "All your campaigns", href: "/studio/campaigns", icon: TrendingUp, locked: !isSubscriber },
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