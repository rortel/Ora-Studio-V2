import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import {
  Shield, Users, CreditCard, Activity, AlertTriangle,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, Search,
  Crown, Zap, Loader2, ArrowRight, Clock, Server,
  DollarSign, BarChart3, Eye, Edit3, Check, X,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { API_BASE, publicAnonKey, supabase } from "../lib/supabase";
import { RouteGuard } from "../components/RouteGuard";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

interface AdminOverview {
  totalUsers: number;
  planCounts: { free: number; generate: number; studio: number };
  totalCreditsUsed: number;
  totalCreditsAllocated: number;
  mrr: number;
  generateRevenue: number;
  studioRevenue: number;
  recentLogs: SystemLog[];
  serverTime: string;
}

interface AdminUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  credits: number;
  creditsUsed: number;
  createdAt: string;
  lastLoginAt: string;
  company?: string;
}

interface SystemLog {
  id: string;
  type: string;
  details: any;
  timestamp: string;
}

type AdminTab = "overview" | "users" | "logs" | "financial" | "costs" | "diagnostics";

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

const ADMIN_EMAIL = "romainortel@gmail.com";

export function AdminPage() {
  return (
    <RouteGuard requireAuth requireAdmin>
      <AdminPageContent />
    </RouteGuard>
  );
}

function AdminPageContent() {
  const { isAdmin, isLoading, accessToken, user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [costsData, setCostsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [error, setError] = useState("");

  /**
   * POST-based admin fetch with Authorization header.
   * _token in body is extracted by server body-parser middleware for user auth.
   */
  const adminPost = useCallback(async (
    path: string,
    extraBody?: Record<string, any>,
    timeout = 30000,
  ): Promise<any> => {
    // Always get the freshest token from Supabase session
    let token = accessToken;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.access_token) {
        token = sess.session.access_token;
      }
    } catch { /* use existing token */ }
    if (!token) throw new Error("No auth token available");
    console.log("[Admin] adminPost token length:", token.length, "preview:", token.slice(0, 20) + "...");

    const url = `${API_BASE}${path}`;
    const body = JSON.stringify({ _token: token, ...extraBody });

    const attempt = async (label: string): Promise<any> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        console.log(`[Admin] ${label} POST ${path}`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${publicAnonKey}`,
            "Content-Type": "text/plain",
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (res.status === 403) throw new Error("Access denied");
        if (res.status === 401) throw new Error("Unauthorized");
        return data;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    };

    try {
      return await attempt("try1");
    } catch (err1) {
      console.warn(`[Admin] ${path} attempt 1 failed:`, err1);
      await new Promise((r) => setTimeout(r, 2500));
      return await attempt("try2");
    }
  }, [accessToken]);

  const isAdminUser = isAdmin || (user?.email?.toLowerCase() === ADMIN_EMAIL);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
    if (!isLoading && user && !isAdminUser && profile) {
      navigate("/profile");
    }
  }, [isLoading, isAdminUser, user, profile, navigate]);

  const fetchData = useCallback(async () => {
    if (!accessToken) {
      console.log("[Admin] No accessToken yet, skipping fetch");
      return;
    }
    console.log("[Admin] accessToken present, length:", accessToken.length, "preview:", accessToken.slice(0, 20) + "...");

    // Refresh session to ensure token is not expired
    let freshToken = accessToken;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        freshToken = sessionData.session.access_token;
        if (freshToken !== accessToken) {
          console.log("[Admin] Using refreshed session token");
        }
      }
    } catch (refreshErr) {
      console.warn("[Admin] Session refresh check failed:", refreshErr);
    }

    setLoading(true);
    setError("");

    const emptyOverview: AdminOverview = {
      totalUsers: 0,
      planCounts: { free: 0, generate: 0, studio: 0 },
      totalCreditsUsed: 0,
      totalCreditsAllocated: 0,
      mrr: 0,
      generateRevenue: 0,
      studioRevenue: 0,
      recentLogs: [],
      serverTime: new Date().toISOString(),
    };

    try {
      // Single POST request — no CORS preflight, all admin data at once
      console.log("[Admin] Fetching all admin data via POST /admin/data...");
      const data = await adminPost("/admin/data");

      if (data.overview) setOverview(data.overview);
      else setOverview(emptyOverview);

      if (data.users) setUsers(data.users);
      if (data.logs) setLogs(data.logs);
      if (data.costs) setCostsData(data.costs);

      if (data.error) setError(data.error);
      else console.log("[Admin] All data loaded:", data.overview?.totalUsers, "users");
    } catch (err) {
      console.error("[Admin] Fetch error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Admin data: ${msg}`);
      if (!overview) setOverview(emptyOverview);
    }
    setLoading(false);
  }, [accessToken, adminPost]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePlanChange = async (userId: string) => {
    if (!editPlan) return;
    try {
      await adminPost(`/admin/users/${userId}/plan`, { plan: editPlan });
      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error("Plan change error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile && !isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-[400px]">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(212,24,61,0.08)" }}>
            <Shield size={22} style={{ color: "var(--destructive)" }} />
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 500, color: "var(--foreground)", marginBottom: "8px" }}>
            Access restricted
          </h2>
          <p style={{ fontSize: "14px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            This page is reserved for the platform administrator.
            {user && (
              <span style={{ display: "block", marginTop: "8px", fontSize: "12px" }}>
                Signed in as: {user.email}
              </span>
            )}
          </p>
          <Link to="/hub" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors" style={{ fontSize: "13px", fontWeight: 500 }}>
            <ArrowRight size={14} /> Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Shield }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "financial", label: "Financial", icon: DollarSign },
    { id: "costs", label: "Costs", icon: CreditCard },
    { id: "logs", label: "System Logs", icon: Activity },
    { id: "diagnostics", label: "Diagnostics", icon: AlertTriangle },
  ];

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Shield size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
                Admin Dashboard
              </h1>
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                {user?.email} -- {overview?.serverTime ? new Date(overview.serverTime).toLocaleString() : ""}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border flex items-start gap-3" style={{ borderColor: "rgba(212,24,61,0.15)", background: "rgba(212,24,61,0.04)" }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--destructive)" }} />
            <p style={{ fontSize: "13px", color: "var(--destructive)", lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
                  active ? "border-ora-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontSize: "13px", fontWeight: active ? 500 : 400 }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {tab === "overview" && overview && <OverviewTab overview={overview} />}
        {tab === "users" && (
          <UsersTab
            users={filteredUsers}
            search={search}
            setSearch={setSearch}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            editPlan={editPlan}
            setEditPlan={setEditPlan}
            onPlanChange={handlePlanChange}
          />
        )}
        {tab === "financial" && overview && <FinancialTab overview={overview} users={users} />}
        {tab === "costs" && overview && <CostsTab overview={overview} users={users} preloadedCosts={costsData} onRefresh={fetchData} />}
        {tab === "logs" && <LogsTab logs={logs} />}
        {tab === "diagnostics" && <DiagnosticsTab authToken={accessToken || publicAnonKey} />}

        {loading && !overview && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !overview && !error && (
          <div className="flex flex-col items-center justify-center py-20">
            <Server size={24} className="mb-3 text-muted-foreground/30" />
            <p style={{ fontSize: "14px", color: "var(--muted-foreground)", marginBottom: "12px" }}>
              No data loaded yet.
            </p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── OVERVIEW TAB ─── */

function OverviewTab({ overview }: { overview: AdminOverview }) {
  const kpis = [
    { label: "Total Users", value: overview.totalUsers, icon: Users, color: "var(--ora-signal)" },
    { label: "MRR", value: `${overview.mrr}`, prefix: "EUR ", icon: DollarSign, color: "#16a34a" },
    { label: "Credits Used", value: overview.totalCreditsUsed, icon: Zap, color: "#f59e0b" },
    { label: "Credits Allocated", value: overview.totalCreditsAllocated, icon: BarChart3, color: "var(--accent)" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-5"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={14} style={{ color: kpi.color }} />
                <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>
                  {kpi.label}
                </span>
              </div>
              <span style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
                {kpi.prefix || ""}{typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Plan Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { plan: "Free (legacy)", count: overview.planCounts.free, color: "var(--muted-foreground)" },
            { plan: "Starter", count: overview.planCounts.starter || 0, color: "#f59e0b" },
            { plan: "Pro", count: overview.planCounts.generate, color: "var(--ora-signal)" },
            { plan: "Business", count: overview.planCounts.studio, color: "#16a34a" },
          ].map((p) => (
            <div key={p.plan} className="text-center">
              <span style={{ fontSize: "32px", fontWeight: 500, color: p.color }}>{p.count}</span>
              <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "4px" }}>{p.plan}</p>
            </div>
          ))}
        </div>
        {overview.totalUsers > 0 && (
          <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden flex">
            {overview.planCounts.free > 0 && <div style={{ width: `${(overview.planCounts.free / overview.totalUsers) * 100}%`, background: "var(--muted-foreground)" }} />}
            {(overview.planCounts as any).starter > 0 && <div style={{ width: `${((overview.planCounts as any).starter / overview.totalUsers) * 100}%`, background: "#f59e0b" }} />}
            {overview.planCounts.generate > 0 && <div style={{ width: `${(overview.planCounts.generate / overview.totalUsers) * 100}%`, background: "var(--ora-signal)" }} />}
            {overview.planCounts.studio > 0 && <div style={{ width: `${(overview.planCounts.studio / overview.totalUsers) * 100}%`, background: "#16a34a" }} />}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Recent Activity</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {overview.recentLogs.slice(0, 15).map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
          {overview.recentLogs.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── USERS TAB ─── */

function UsersTab({ users, search, setSearch, editingUser, setEditingUser, editPlan, setEditPlan, onPlanChange }: {
  users: AdminUser[]; search: string; setSearch: (s: string) => void;
  editingUser: string | null; setEditingUser: (id: string | null) => void;
  editPlan: string; setEditPlan: (p: string) => void; onPlanChange: (userId: string) => void;
}) {
  const planBadgeColor: Record<string, string> = { free: "var(--muted-foreground)", starter: "#f59e0b", generate: "var(--ora-signal)", studio: "#16a34a" };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by email or name..."
          className="w-full bg-input-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground/40" style={{ fontSize: "14px" }} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Plan", "Credits", "Used", "Role", "Joined", "Last Login", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3" style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{u.name || "--"}</span>
                      <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingUser === u.userId ? (
                      <div className="flex items-center gap-1">
                        <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="bg-input-background border border-border rounded px-2 py-1 text-foreground" style={{ fontSize: "12px" }}>
                          <option value="free">Free (legacy)</option>
                          <option value="starter">Starter</option>
                          <option value="generate">Pro</option>
                          <option value="studio">Business</option>
                        </select>
                        <button onClick={() => onPlanChange(u.userId)} className="text-ora-signal hover:opacity-80 cursor-pointer"><Check size={14} /></button>
                        <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14} /></button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{ fontSize: "11px", fontWeight: 500, color: planBadgeColor[u.plan] || "var(--muted-foreground)", background: `${planBadgeColor[u.plan] || "var(--muted-foreground)"}15` }}>
                        {u.plan === "studio" && <Crown size={10} />}
                        {u.plan.charAt(0).toUpperCase() + u.plan.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ fontSize: "13px", color: "var(--foreground)" }}>{u.credits?.toLocaleString()}</td>
                  <td className="px-4 py-3" style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{u.creditsUsed?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs" style={{ fontSize: "10px", fontWeight: 600, color: u.role === "admin" ? "#fff" : "var(--muted-foreground)", background: u.role === "admin" ? "var(--ora-signal)" : "var(--secondary)" }}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "--"}</td>
                  <td className="px-4 py-3" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "--"}</td>
                  <td className="px-4 py-3">
                    {u.role !== "admin" && (
                      <button onClick={() => { setEditingUser(u.userId); setEditPlan(u.plan); }} className="text-muted-foreground hover:text-ora-signal cursor-pointer transition-colors" title="Change plan">
                        <Edit3 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-12">
            <Users size={24} className="mx-auto mb-3 text-muted-foreground/30" />
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FINANCIAL TAB ─── */

function FinancialTab({ overview, users }: { overview: AdminOverview; users: AdminUser[] }) {
  const paidUsers = users.filter((u) => u.plan !== "free" && u.role !== "admin");
  const conversionRate = overview.totalUsers > 0 ? ((paidUsers.length / overview.totalUsers) * 100).toFixed(1) : "0";
  const arpu = paidUsers.length > 0 ? (overview.mrr / paidUsers.length).toFixed(0) : "0";
  const creditUtilization = overview.totalCreditsAllocated > 0
    ? ((overview.totalCreditsUsed / overview.totalCreditsAllocated) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "MRR", value: `EUR ${overview.mrr}`, sub: "Monthly Recurring Revenue" },
          { label: "ARR", value: `EUR ${overview.mrr * 12}`, sub: "Annual Run Rate" },
          { label: "Conversion", value: `${conversionRate}%`, sub: "Free to Paid" },
          { label: "ARPU", value: `EUR ${arpu}`, sub: "Avg Revenue Per User" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{kpi.label}</span>
            <p style={{ fontSize: "24px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--foreground)", marginTop: "8px" }}>{kpi.value}</p>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "4px" }}>{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Revenue Breakdown</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-sm" style={{ background: "#f59e0b" }} /><span style={{ fontSize: "13px", color: "var(--foreground)" }}>Starter (EUR 29/mo)</span></div>
            <div className="flex items-center gap-4"><span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{(overview.planCounts as any).starter || 0} users</span><span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>EUR {(overview as any).starterRevenue || 0}</span></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-sm" style={{ background: "var(--ora-signal)" }} /><span style={{ fontSize: "13px", color: "var(--foreground)" }}>Pro (EUR 79/mo)</span></div>
            <div className="flex items-center gap-4"><span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{overview.planCounts.generate} users</span><span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>EUR {overview.generateRevenue}</span></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-sm" style={{ background: "#16a34a" }} /><span style={{ fontSize: "13px", color: "var(--foreground)" }}>Business (EUR 149/mo)</span></div>
            <div className="flex items-center gap-4"><span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>{overview.planCounts.studio} users</span><span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>EUR {overview.studioRevenue}</span></div>
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>Total MRR</span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--ora-signal)" }}>EUR {overview.mrr}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Credit Utilization</h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span style={{ fontSize: "36px", fontWeight: 500, color: "var(--foreground)" }}>{creditUtilization}%</span>
          <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>of allocated credits consumed</span>
        </div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Number(creditUtilization))}%`, background: Number(creditUtilization) > 80 ? "#f59e0b" : "var(--ora-signal)" }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{overview.totalCreditsUsed.toLocaleString()} used</span>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{overview.totalCreditsAllocated.toLocaleString()} allocated</span>
        </div>
      </div>
    </div>
  );
}

/* ─── COSTS TAB (API Cost Tracking) ─── */

const PROVIDER_COLORS: Record<string, string> = {
  runware: "#10b981", apipod: "#3b4fc4", fal: "#f59e0b", replicate: "#8b5cf6",
  luma: "#06b6d4", higgsfield: "#ec4899", kling: "#f97316", unknown: "#6b7280",
};
const TYPE_COLORS: Record<string, string> = {
  text: "#3b4fc4", image: "#10b981", video: "#f59e0b", audio: "#8b5cf6",
};

// Fixed infrastructure costs (EUR/month)
const FIXED_COSTS = [
  { name: "Figma Make", cost: 350, status: "confirmed" as const },
  { name: "Supabase Pro", cost: 23, status: "confirmed" as const },
  { name: "Domain + misc", cost: 5, status: "confirmed" as const },
];
const TOTAL_FIXED = FIXED_COSTS.reduce((s, c) => s + c.cost, 0);

function CostsTab({ overview, users, preloadedCosts, onRefresh }: { overview: AdminOverview; users: AdminUser[]; preloadedCosts?: any; onRefresh?: () => void }) {
  const costsData = preloadedCosts;

  const total = costsData?.total || { count: 0, costEur: 0, revenueEur: 0, marginEur: 0 };
  const byProvider = costsData?.byProvider || {};
  const byType = costsData?.byType || {};
  const byDay = costsData?.byDay || {};
  const recentEntries = costsData?.recentEntries || [];
  const marginPct = total.revenueEur > 0 ? ((total.marginEur / total.revenueEur) * 100).toFixed(1) : "0";
  const totalMonthlyBurn = TOTAL_FIXED + total.costEur;
  const netAfterFixed = overview.mrr - totalMonthlyBurn;

  // Chart data
  const dayChartData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, d]: [string, any]) => ({
      day: day.slice(5), // MM-DD
      cost: Math.round(d.costEur * 100) / 100,
      revenue: Math.round(d.revenueEur * 100) / 100,
      margin: Math.round(d.marginEur * 100) / 100,
      count: d.count,
    }));

  const pieData = Object.entries(byProvider).map(([name, d]: [string, any]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Math.round(d.totalCostEur * 100) / 100,
    color: PROVIDER_COLORS[name] || "#6b7280",
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {!costsData && (
        <div className="p-4 rounded-xl border flex items-start gap-3" style={{ borderColor: "rgba(212,24,61,0.15)", background: "rgba(212,24,61,0.04)" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--destructive)" }} />
          <p style={{ fontSize: "13px", color: "var(--destructive)", lineHeight: 1.5 }}>No cost data loaded. Click Refresh to reload.</p>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Cost", value: `EUR ${total.costEur.toFixed(2)}`, sub: "API provider spend", color: "var(--destructive)" },
          { label: "Total Revenue", value: `EUR ${total.revenueEur.toFixed(2)}`, sub: "Credits consumed", color: "#16a34a" },
          { label: "Net Margin", value: `EUR ${total.marginEur.toFixed(2)}`, sub: `${marginPct}% margin`, color: total.marginEur >= 0 ? "#16a34a" : "var(--destructive)" },
          { label: "Generations", value: `${total.count}`, sub: "Total API calls", color: "var(--ora-signal)" },
          { label: "Avg Cost/Gen", value: `EUR ${total.count > 0 ? (total.costEur / total.count).toFixed(4) : "0"}`, sub: "Per generation", color: "var(--accent)" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{kpi.label}</span>
            <p style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: kpi.color, marginTop: "8px" }}>{kpi.value}</p>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "4px" }}>{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Burn Summary + Fixed Costs */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Monthly Burn Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>Fixed infrastructure</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--destructive)" }}>-EUR {TOTAL_FIXED}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>Variable API costs (this period)</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--destructive)" }}>-EUR {total.costEur.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>Total monthly burn</span>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--destructive)" }}>EUR {totalMonthlyBurn.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>MRR</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#16a34a" }}>+EUR {overview.mrr}</span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>Net P&L</span>
              <span style={{ fontSize: "16px", fontWeight: 600, color: netAfterFixed >= 0 ? "#16a34a" : "var(--destructive)" }}>
                {netAfterFixed >= 0 ? "+" : ""}EUR {netAfterFixed.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Fixed Infrastructure (EUR/mo)</h3>
          <div className="space-y-3">
            {FIXED_COSTS.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
                  <span style={{ fontSize: "13px", color: "var(--foreground)" }}>{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>EUR {c.cost}</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "9px", fontWeight: 600, color: "#16a34a", background: "rgba(22,163,74,0.08)" }}>
                    CONFIRMED
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>Total fixed</span>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>EUR {TOTAL_FIXED}/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Breakdown + Pie */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Cost by Provider</h3>
          {Object.keys(byProvider).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(byProvider).map(([name, d]: [string, any]) => {
                const pct = total.costEur > 0 ? (d.totalCostEur / total.costEur * 100) : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PROVIDER_COLORS[name] || "#6b7280" }} />
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)", textTransform: "capitalize" }}>{name}</span>
                        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>({d.count} calls)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: "12px", color: "var(--destructive)" }}>-EUR {d.totalCostEur.toFixed(4)}</span>
                        <span style={{ fontSize: "12px", color: "#16a34a" }}>+EUR {d.totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: PROVIDER_COLORS[name] || "#6b7280" }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{d.avgLatency}ms avg</span>
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{d.successCount} ok / {d.failCount} fail</span>
                      <span style={{ fontSize: "10px", fontWeight: 500, color: d.totalMargin >= 0 ? "#16a34a" : "var(--destructive)" }}>
                        Margin: EUR {d.totalMargin.toFixed(4)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No cost data yet. Generate content to see provider costs.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Cost Distribution</h3>
          {pieData.length > 0 ? (
            <div>
              {/* Donut chart via SVG */}
              <svg viewBox="0 0 200 200" width="200" height="200" className="mx-auto">
                {(() => {
                  const totalVal = pieData.reduce((s, d) => s + d.value, 0);
                  let cumAngle = -90;
                  return pieData.map((d, i) => {
                    const angle = totalVal > 0 ? (d.value / totalVal) * 360 : 0;
                    const startAngle = cumAngle;
                    cumAngle += angle;
                    const endAngle = cumAngle;
                    const largeArc = angle > 180 ? 1 : 0;
                    const r = 75; const ir = 45; const cx = 100; const cy = 100;
                    const s1 = Math.cos((startAngle * Math.PI) / 180);
                    const s2 = Math.sin((startAngle * Math.PI) / 180);
                    const e1 = Math.cos((endAngle * Math.PI) / 180);
                    const e2 = Math.sin((endAngle * Math.PI) / 180);
                    const path = `M ${cx + ir * s1} ${cy + ir * s2} L ${cx + r * s1} ${cy + r * s2} A ${r} ${r} 0 ${largeArc} 1 ${cx + r * e1} ${cy + r * e2} L ${cx + ir * e1} ${cy + ir * e2} A ${ir} ${ir} 0 ${largeArc} 0 ${cx + ir * s1} ${cy + ir * s2} Z`;
                    return <path key={i} d={path} fill={d.color} stroke="var(--card)" strokeWidth={2} />;
                  });
                })()}
                <text x="100" y="96" textAnchor="middle" style={{ fontSize: "16px", fontWeight: 500, fill: "var(--foreground)" }}>
                  EUR {pieData.reduce((s, d) => s + d.value, 0).toFixed(2)}
                </text>
                <text x="100" y="112" textAnchor="middle" style={{ fontSize: "10px", fill: "var(--muted-foreground)" }}>
                  total cost
                </text>
              </svg>
              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 justify-center">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{d.name} (EUR {d.value.toFixed(4)})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px]">
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No data</p>
            </div>
          )}
        </div>
      </div>

      {/* Cost by Modality */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Cost by Modality</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["text", "image", "video", "audio"].map((type) => {
            const d = byType[type] || { count: 0, totalCostEur: 0, totalRevenue: 0, totalMargin: 0 };
            return (
              <div key={type} className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                  <span style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--foreground)" }}>{type}</span>
                </div>
                <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--foreground)" }}>{d.count}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Cost</span>
                    <span style={{ fontSize: "10px", color: "var(--destructive)" }}>EUR {(d.totalCostEur || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>Revenue</span>
                    <span style={{ fontSize: "10px", color: "#16a34a" }}>EUR {(d.totalRevenue || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-foreground)" }}>Margin</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: (d.totalMargin || 0) >= 0 ? "#16a34a" : "var(--destructive)" }}>
                      EUR {(d.totalMargin || 0).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Trend Chart */}
      {dayChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Daily Cost vs Revenue (last 14 days)</h3>
          {/* Legend */}
          <div className="flex items-center gap-5 mb-4">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--destructive)" }} /><span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Cost</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#16a34a" }} /><span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Revenue</span></div>
          </div>
          {/* Bar chart */}
          <div className="flex items-end gap-1" style={{ height: "200px" }}>
            {(() => {
              const maxVal = Math.max(...dayChartData.map(d => Math.max(d.cost, d.revenue)), 0.01);
              return dayChartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: "100%" }}>
                  <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                    <div className="rounded-t-sm" style={{ width: "40%", height: `${Math.max(2, (d.cost / maxVal) * 100)}%`, background: "var(--destructive)", opacity: 0.8, minHeight: d.cost > 0 ? "4px" : "0" }} title={`Cost: EUR ${d.cost.toFixed(4)}`} />
                    <div className="rounded-t-sm" style={{ width: "40%", height: `${Math.max(2, (d.revenue / maxVal) * 100)}%`, background: "#16a34a", opacity: 0.8, minHeight: d.revenue > 0 ? "4px" : "0" }} title={`Rev: EUR ${d.revenue.toFixed(4)}`} />
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--muted-foreground)", writingMode: "horizontal-tb" }}>{d.day}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Provider Cost per Call (Reference Table) */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", marginBottom: "16px" }}>Provider Cost Reference (per call)</h3>
        {costsData?.providerCostTable ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Provider / Model", "Cost (USD)", "Cost (EUR)", "Type"].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(costsData.providerCostTable).sort(([a], [b]) => a.localeCompare(b)).map(([key, costUsd]: [string, any]) => {
                  const prefix = key.split("/")[0];
                  const k = key.toLowerCase();
                  const type = prefix === "apipod" ? "text"
                    : k.includes("musicgen") ? "audio"
                    : k.includes("video") || k.includes("ray") || k.includes("ltx") || k.includes("minimax") || k.includes("soul") || k.includes("kling") || k.includes("seedance") || k.includes("dop") ? "video"
                    : "image";
                  return (
                    <tr key={key} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2" style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--foreground)" }}>{key}</td>
                      <td className="px-3 py-2" style={{ fontSize: "12px", color: "var(--foreground)" }}>${costUsd}</td>
                      <td className="px-3 py-2" style={{ fontSize: "12px", color: "var(--foreground)" }}>EUR {(costUsd * 0.92).toFixed(4)}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "10px", fontWeight: 500, color: TYPE_COLORS[type] || "var(--muted-foreground)", background: `${TYPE_COLORS[type] || "var(--muted-foreground)"}12` }}>{type}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>Cost table not loaded</p>
        )}
      </div>

      {/* Recent Cost Entries (log) */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Recent Generations ({recentEntries.length})</h3>
          <button onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            style={{ fontSize: "11px", fontWeight: 500 }}>
            <RefreshCw size={12} /> Refresh Costs
          </button>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {["Time", "Type", "Model", "Provider", "Cost", "Revenue", "Margin", "Latency", "Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2" style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEntries.slice(0, 50).map((entry: any) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "--"}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "10px", fontWeight: 500, color: TYPE_COLORS[entry.type] || "var(--muted-foreground)", background: `${TYPE_COLORS[entry.type] || "var(--muted-foreground)"}12` }}>{entry.type}</span>
                  </td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", color: "var(--foreground)" }}>{entry.model}</td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted-foreground)" }}>{entry.provider}</td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", color: "var(--destructive)" }}>EUR {(entry.costEur || 0).toFixed(4)}</td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", color: "#16a34a" }}>EUR {(entry.revenueEur || 0).toFixed(2)}</td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", fontWeight: 500, color: (entry.marginEur || 0) >= 0 ? "#16a34a" : "var(--destructive)" }}>EUR {(entry.marginEur || 0).toFixed(4)}</td>
                  <td className="px-3 py-2" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{entry.latencyMs}ms</td>
                  <td className="px-3 py-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: entry.success ? "#16a34a" : "var(--destructive)" }} />
                  </td>
                </tr>
              ))}
              {recentEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    <DollarSign size={24} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No generation costs logged yet</p>
                    <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "4px" }}>Generate content from the Hub to see costs here</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── LOGS TAB ─── */

function LogsTab({ logs }: { logs: SystemLog[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>System Events ({logs.length})</h3>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
          {logs.map((log) => (<LogEntry key={log.id} log={log} expanded />))}
          {logs.length === 0 && (
            <div className="text-center py-12">
              <Activity size={24} className="mx-auto mb-3 text-muted-foreground/30" />
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>No system logs yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── DIAGNOSTICS TAB ─── */

interface SingleTestResult {
  provider: string;
  status: string;
  code?: number;
  ms?: number;
  body?: string;
  error?: string;
}

function DiagnosticsTab({ authToken }: { authToken: string }) {
  const [configData, setConfigData] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [healthStatus, setHealthStatus] = useState<"idle" | "ok" | "fail" | "loading">("idle");
  const [healthMs, setHealthMs] = useState(0);
  const [healthError, setHealthError] = useState("");
  const [healthBody, setHealthBody] = useState("");
  const [singleTests, setSingleTests] = useState<Record<string, SingleTestResult | "loading">>({});
  const [genTest, setGenTest] = useState<{ type: string; model?: string; result: any } | null>(null);
  const [genTesting, setGenTesting] = useState(false);

  // No Authorization header — use apikey query param to avoid CORS preflight
  const authH: Record<string, string> = {};

  // Step 1: Health check
  const runHealthCheck = async () => {
    setHealthStatus("loading");
    setHealthError("");
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE}/health`, { headers: authH, signal: controller.signal });
      clearTimeout(timeout);
      const ms = Date.now() - start;
      const text = await res.text();
      console.log(`[Health] HTTP ${res.status} (${ms}ms)`);
      if (res.ok) {
        setHealthMs(ms);
        setHealthBody(text);
        setHealthStatus("ok");
      } else {
        setHealthError(`HTTP ${res.status}: ${text.slice(0, 300)}`);
        setHealthStatus("fail");
      }
    } catch (err) {
      const ms = Date.now() - start;
      setHealthMs(ms);
      setHealthError(`Network error (${ms}ms): ${err instanceof Error ? err.message : err}\n\nURL: ${API_BASE}/health`);
      setHealthStatus("fail");
    }
  };

  // Step 2: Load config (no auth needed — debug route is public)
  const loadConfig = async () => {
    setConfigLoading(true);
    setConfigError("");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(`${API_BASE}/debug/ai-config`, {
        headers: authH,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      console.log("[Diagnostics] ai-config:", data);
      if (res.ok && !data.error) {
        setConfigData(data);
        setConfigLoading(false);
        return;
      }
      setConfigError(`Server returned: ${JSON.stringify(data)}`);
    } catch (err) {
      console.error("[Diagnostics] ai-config error:", err);
      setConfigError(`Failed to load config: ${err}`);
    }
    setConfigLoading(false);
  };

  // Step 3: Individual provider test (no auth needed, increased timeout for slow providers)
  const runSingleTest = async (provider: string) => {
    setSingleTests((prev) => ({ ...prev, [provider]: "loading" }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s — FAL/Replicate can be slow
      const res = await fetch(`${API_BASE}/debug/test-single/${provider}`, {
        headers: authH,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      console.log(`[Diagnostics] test-single/${provider}:`, data);
      setSingleTests((prev) => ({ ...prev, [provider]: data as SingleTestResult }));
    } catch (err) {
      console.error(`[Diagnostics] test-single/${provider} error:`, err);
      setSingleTests((prev) => ({
        ...prev,
        [provider]: { provider, status: "ERROR", error: String(err) } as SingleTestResult,
      }));
    }
  };

  // Step 4: Generation test
  const runGenTest = async (type: string, model?: string) => {
    setGenTesting(true);
    setGenTest(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s — race pattern + fallback needs time
      const res = await fetch(`${API_BASE}/debug/generate-test`, {
        method: "POST",
        headers: { ...authH, "Content-Type": "text/plain" },
        body: JSON.stringify({ type, prompt: "A simple blue circle on a white background", model, _token: authToken }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      console.log("[Diagnostics] generate-test:", data);
      setGenTest({ type, model, result: data });
    } catch (err) {
      console.error("[Diagnostics] generate-test error:", err);
      setGenTest({ type, model, result: { success: false, error: String(err) } });
    }
    setGenTesting(false);
  };

  // Auto-run health check on mount
  useEffect(() => {
    runHealthCheck();
  }, []);

  const statusColor = (status: string) => {
    if (status === "OK") return "#16a34a";
    if (status === "SKIP") return "#f59e0b";
    return "var(--destructive)";
  };

  const statusDot = (status: string) => (
    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusColor(status) }} />
  );

  const providers = [
    { id: "apipod_text", label: "APIPod Text", desc: "Chat completions (GPT-4o)" },
    { id: "apipod_image", label: "APIPod Image", desc: "Image generations (DALL-E 3)" },
    { id: "fal", label: "FAL AI", desc: "Image (Flux Schnell)" },
    { id: "replicate", label: "Replicate", desc: "Account auth check" },
  ];

  return (
    <div className="space-y-6">
      {/* Step 1: Server Health */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--secondary)" }}>
              <Server size={14} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Step 1 -- Server Health</h3>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Verify the Edge Function responds</p>
            </div>
          </div>
          <button onClick={runHealthCheck} disabled={healthStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontSize: "12px", fontWeight: 500 }}>
            {healthStatus === "loading" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Ping
          </button>
        </div>
        {healthStatus === "ok" && (
          <div className="p-3 rounded-lg" style={{ background: "rgba(22,163,74,0.06)" }}>
            <div className="flex items-center gap-2">
              {statusDot("OK")}
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#16a34a" }}>Server OK</span>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>({healthMs}ms)</span>
            </div>
            {healthBody && (
              <pre className="mt-2 ml-5 p-2 bg-secondary/50 rounded" style={{ fontSize: "10px", color: "var(--muted-foreground)", whiteSpace: "pre-wrap" }}>
                {healthBody}
              </pre>
            )}
          </div>
        )}
        {healthStatus === "fail" && (
          <div className="p-3 rounded-lg" style={{ background: "rgba(212,24,61,0.06)" }}>
            <div className="flex items-center gap-2">
              {statusDot("FAIL")}
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--destructive)" }}>Server unreachable</span>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>({healthMs}ms)</span>
            </div>
            {healthError && <p className="mt-1 ml-5" style={{ fontSize: "11px", color: "var(--destructive)" }}>{healthError}</p>}
          </div>
        )}
        {healthStatus === "loading" && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "var(--secondary)" }}>
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
            <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>Pinging server...</span>
          </div>
        )}
      </div>

      {/* Step 2: API Keys */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--secondary)" }}>
              <Eye size={14} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Step 2 -- API Keys</h3>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Check which keys are configured on the server</p>
            </div>
          </div>
          <button onClick={loadConfig} disabled={configLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontSize: "12px", fontWeight: 500 }}>
            {configLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Load Config
          </button>
        </div>
        {configError && <p style={{ fontSize: "12px", color: "var(--destructive)" }}>Error: {configError}</p>}
        {configData && !configData.error && (
          <div className="space-y-2">
            {["apipod", "runware_image", "runware_video", "fal", "replicate"].map((key) => {
              const val = configData[key];
              const isSet = val && !val.includes("NOT SET");
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: isSet ? "#16a34a" : "var(--destructive)" }} />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)", textTransform: "uppercase" }}>{key}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: isSet ? "#16a34a" : "var(--destructive)", fontFamily: "monospace" }}>{val || "NOT SET"}</span>
                </div>
              );
            })}
          </div>
        )}
        {!configData && !configLoading && !configError && (
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>Click "Load Config" to check API key status.</p>
        )}
      </div>

      {/* Step 3: Individual Provider Tests */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--secondary)" }}>
            <Zap size={14} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Step 3 -- Provider Tests (individual)</h3>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Test each provider separately to avoid timeouts. Click each button.</p>
          </div>
        </div>
        <div className="space-y-3">
          {providers.map((p) => {
            const result = singleTests[p.id];
            const isLoading = result === "loading";
            const data = result && result !== "loading" ? result : null;
            return (
              <div key={p.id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {data ? statusDot(data.status) : <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border-strong)" }} />}
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{p.label}</span>
                      <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{p.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {data && (
                      <>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: statusColor(data.status) }}>{data.status}</span>
                        {data.ms && <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{data.ms}ms</span>}
                        {data.code && <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>HTTP {data.code}</span>}
                      </>
                    )}
                    <button onClick={() => runSingleTest(p.id)} disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-primary-foreground cursor-pointer disabled:opacity-50 transition-opacity"
                      style={{ fontSize: "11px", fontWeight: 500, background: "var(--ora-signal)" }}>
                      {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                      {isLoading ? "Testing..." : "Test"}
                    </button>
                  </div>
                </div>
                {data?.body && (
                  <pre className="mt-2 p-2 bg-secondary/50 rounded overflow-x-auto" style={{ fontSize: "10px", color: "var(--muted-foreground)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "120px" }}>
                    {data.body}
                  </pre>
                )}
                {data?.error && (
                  <p className="mt-1" style={{ fontSize: "11px", color: "var(--destructive)" }}>{data.error}</p>
                )}
              </div>
            );
          })}
        </div>
        {/* Run all button */}
        <button
          onClick={() => providers.forEach((p) => runSingleTest(p.id))}
          disabled={Object.values(singleTests).some((v) => v === "loading")}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          style={{ fontSize: "12px", fontWeight: 500 }}>
          <Zap size={12} /> Run All (sequential requests)
        </button>
      </div>

      {/* Step 4: Generation Pipeline Test */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--secondary)" }}>
            <Activity size={14} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>Step 4 -- End-to-End Generation</h3>
            <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Test the full pipeline (ai.tsx fallback chain) with prompt "A simple blue circle"</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: "Text (GPT-4o)", type: "text", model: "gpt-4o" },
            { label: "Text (Claude)", type: "text", model: "claude-sonnet" },
            { label: "Image (ORA Vision)", type: "image", model: "ora-vision" },
            { label: "Image (DALL-E)", type: "image", model: "dall-e" },
            { label: "Image (Flux Pro)", type: "image", model: "flux-pro" },
            { label: "Video (ORA Motion)", type: "video", model: "ora-motion" },
            { label: "Audio (ORA Audio)", type: "audio", model: "ora-audio" },
          ].map((t) => (
            <button key={`${t.type}-${t.model}`} onClick={() => runGenTest(t.type, t.model)} disabled={genTesting}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
              style={{ fontSize: "12px", fontWeight: 500 }}>
              {genTesting ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              {t.label}
            </button>
          ))}
        </div>
        {genTest && (
          <div className="p-4 rounded-lg border border-border" style={{ background: genTest.result.success ? "rgba(22,163,74,0.04)" : "rgba(212,24,61,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              {statusDot(genTest.result.success ? "OK" : "FAIL")}
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                {genTest.type} ({genTest.model}) -- {genTest.result.success ? "SUCCESS" : "FAILED"}
              </span>
              {genTest.result.totalMs && <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>({genTest.result.totalMs}ms)</span>}
            </div>
            {genTest.result.error && (
              <p className="mb-2 ml-5" style={{ fontSize: "12px", color: "var(--destructive)" }}>{genTest.result.error}</p>
            )}
            <pre className="mt-2 p-2 bg-secondary/50 rounded overflow-x-auto" style={{ fontSize: "10px", color: "var(--muted-foreground)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "200px" }}>
              {JSON.stringify(genTest.result, null, 2)}
            </pre>
            {genTest.result.result?.imageUrl && (
              <div className="mt-3">
                <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "4px" }}>Generated image:</p>
                <img src={genTest.result.result.imageUrl} alt="Generated test" className="max-w-[300px] rounded-lg border border-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            {genTest.result.result?.text && (
              <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "4px" }}>Generated text:</p>
                <p style={{ fontSize: "13px", color: "var(--foreground)", lineHeight: 1.5 }}>{genTest.result.result.text.slice(0, 500)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── LOG ENTRY ─── */

function LogEntry({ log, expanded = false }: { log: SystemLog; expanded?: boolean }) {
  const [open, setOpen] = useState(false);
  const typeColors: Record<string, string> = {
    signup: "#16a34a", generation: "var(--ora-signal)", admin_plan_change: "#f59e0b", error: "var(--destructive)",
  };

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="px-1.5 py-0.5 rounded"
          style={{ fontSize: "10px", fontWeight: 600, color: typeColors[log.type] || "var(--muted-foreground)", background: `${typeColors[log.type] || "var(--muted-foreground)"}12` }}>
          {log.type}
        </span>
        <span style={{ fontSize: "12px", color: "var(--foreground)" }}>
          {log.details?.email || log.details?.userId?.slice(0, 8) || "system"}
        </span>
        {log.details?.type && <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>({log.details.type})</span>}
        <span className="flex-1" />
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
        </span>
        {expanded && (
          <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground cursor-pointer">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
      {open && expanded && (
        <pre className="mt-2 p-2 bg-secondary/50 rounded text-xs overflow-x-auto" style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
          {JSON.stringify(log.details, null, 2)}
        </pre>
      )}
    </div>
  );
}