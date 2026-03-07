import { API_BASE, apiHeaders } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, RefreshCw } from "lucide-react";

const defaultKpis = [
  { label: "Brand Health Score", value: "0", suffix: "/100", trend: "--", dir: "flat" },
  { label: "Content Produced", value: "0", suffix: " pieces", trend: "--", dir: "flat" },
  { label: "Campaigns", value: "0", suffix: "", trend: "--", dir: "flat" },
  { label: "Calendar Events", value: "0", suffix: "", trend: "--", dir: "flat" },
  { label: "Brand Scans", value: "0", suffix: "", trend: "--", dir: "flat" },
  { label: "Brand Vault", value: "--", suffix: "", trend: "--", dir: "flat" },
];

const defaultWeeklyData = [
  { week: "Week 1", pieces: 0, compliance: 0, score: 0 },
  { week: "Week 2", pieces: 0, compliance: 0, score: 0 },
  { week: "Week 3", pieces: 0, compliance: 0, score: 0 },
  { week: "Week 4", pieces: 0, compliance: 0, score: 0 },
];

const defaultFormatPerformance = [
  { format: "LinkedIn", pieces: 0, avgScore: 0 },
  { format: "Email", pieces: 0, avgScore: 0 },
  { format: "SMS", pieces: 0, avgScore: 0 },
  { format: "Newsletter", pieces: 0, avgScore: 0 },
  { format: "Landing Page", pieces: 0, avgScore: 0 },
  { format: "Ad Copy", pieces: 0, avgScore: 0 },
  { format: "Stories", pieces: 0, avgScore: 0 },
];

interface AnalyticsData {
  totalCampaigns: number;
  totalPieces: number;
  totalEvents: number;
  avgBrandScore: number;
  hasVault: boolean;
  brandScans: number;
  campaigns: any[];
  events: any[];
  scores: any[];
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(defaultKpis);
  const [weeklyData, setWeeklyData] = useState(defaultWeeklyData);
  const [formatPerformance, setFormatPerformance] = useState(defaultFormatPerformance);
  const [campaignList, setCampaignList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { getAuthHeader } = useAuth();

  const loadAnalytics = useCallback(async () => {
    try {
      const token = getAuthHeader();
      const res = await fetch(`${API_BASE}/analytics`, { headers: apiHeaders(token, false) });
      const data = await res.json();
      if (data.success) {
        const a: AnalyticsData = data.analytics;

        // Build KPIs from real data
        setKpis([
          { label: "Brand Health Score", value: a.avgBrandScore > 0 ? String(a.avgBrandScore) : "--", suffix: a.avgBrandScore > 0 ? "/100" : "", trend: a.avgBrandScore > 90 ? "+strong" : a.avgBrandScore > 0 ? "active" : "--", dir: a.avgBrandScore > 80 ? "up" : "flat" },
          { label: "Content Produced", value: String(a.totalPieces), suffix: " pieces", trend: a.totalPieces > 0 ? "active" : "--", dir: a.totalPieces > 0 ? "up" : "flat" },
          { label: "Campaigns", value: String(a.totalCampaigns), suffix: "", trend: a.totalCampaigns > 0 ? `${a.totalCampaigns} total` : "--", dir: a.totalCampaigns > 0 ? "up" : "flat" },
          { label: "Calendar Events", value: String(a.totalEvents), suffix: "", trend: a.totalEvents > 0 ? "scheduled" : "--", dir: a.totalEvents > 0 ? "up" : "flat" },
          { label: "Brand Scans", value: String(a.brandScans), suffix: "", trend: a.brandScans > 0 ? "analyzed" : "--", dir: a.brandScans > 0 ? "up" : "flat" },
          { label: "Brand Vault", value: a.hasVault ? "Active" : "Not set", suffix: "", trend: a.hasVault ? "configured" : "setup needed", dir: a.hasVault ? "up" : "flat" },
        ]);

        // Build format performance from campaigns
        if (a.campaigns && a.campaigns.length > 0) {
          setCampaignList(a.campaigns);
          const formatMap: Record<string, { pieces: number; totalScore: number; count: number }> = {};
          a.campaigns.forEach((c: any) => {
            (c.formats || []).forEach((f: string) => {
              if (!formatMap[f]) formatMap[f] = { pieces: 0, totalScore: 0, count: 0 };
              formatMap[f].pieces += (c.pieces || 0) / (c.formats?.length || 1);
              formatMap[f].totalScore += c.score || 0;
              formatMap[f].count += 1;
            });
          });
          const fp = Object.entries(formatMap).map(([format, data]) => ({
            format,
            pieces: Math.round(data.pieces),
            avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
          }));
          if (fp.length > 0) setFormatPerformance(fp);

          // Build weekly data from campaign dates
          const weeks: Record<number, { pieces: number; scores: number[]; count: number }> = {};
          a.campaigns.forEach((c: any, i: number) => {
            const weekNum = Math.min(Math.floor(i / 2), 7);
            if (!weeks[weekNum]) weeks[weekNum] = { pieces: 0, scores: [], count: 0 };
            weeks[weekNum].pieces += c.pieces || 0;
            if (c.score > 0) weeks[weekNum].scores.push(c.score);
            weeks[weekNum].count += 1;
          });
          const wd = Object.entries(weeks).map(([num, d]) => ({
            week: `Week ${parseInt(num) + 1}`,
            pieces: d.pieces,
            compliance: d.scores.length > 0 ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : 0,
            score: d.scores.length > 0 ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : 0,
          }));
          if (wd.length > 0) setWeeklyData(wd);
        }
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const handleRefresh = () => { setRefreshing(true); loadAnalytics(); };

  const maxPieces = Math.max(...weeklyData.map((d) => d.pieces), 1);
  const maxFormatScore = Math.max(...formatPerformance.map((f) => f.avgScore), 1);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-ora-signal" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/studio" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Studio
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground mb-1" style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.03em" }}>Analytics</h1>
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>Real-time data from your campaigns, calendar, and brand scans.</p>
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
              style={{ fontSize: "13px", fontWeight: 500 }}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-4">
              <p className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>{kpi.label}</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-foreground" style={{ fontSize: "26px", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>{kpi.value}</span>
                <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{kpi.suffix}</span>
              </div>
              {kpi.trend && kpi.trend !== "--" && (
                <div className="flex items-center gap-1 mt-1.5">
                  {kpi.dir === "up" ? <TrendingUp size={12} className="text-green-500" /> : kpi.dir === "down" ? <TrendingDown size={12} className="text-destructive" /> : <Minus size={12} className="text-muted-foreground" />}
                  <span className={kpi.dir === "up" ? "text-green-600" : "text-muted-foreground"} style={{ fontSize: "11px", fontWeight: 500 }}>{kpi.trend}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* Content production chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-5" style={{ fontSize: "16px", fontWeight: 500 }}>Content Production</h3>
            {weeklyData.some((d) => d.pieces > 0) ? (
              <div className="flex items-end gap-3 h-[180px]">
                {weeklyData.map((d, i) => (
                  <div key={d.week} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-muted-foreground" style={{ fontSize: "10px" }}>{d.pieces}</span>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(d.pieces / maxPieces) * 140}px` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                      className="w-full bg-ora-signal/20 rounded-t-md relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 bg-ora-signal rounded-t-md"
                        style={{ height: d.compliance > 0 ? `${Math.max((d.compliance - 70) * 3, 10)}%` : "0%" }} />
                    </motion.div>
                    <span className="text-muted-foreground" style={{ fontSize: "9px" }}>W{i + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No production data yet. Create campaigns to see metrics.</p>
              </div>
            )}
          </motion.div>

          {/* Format performance */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-5" style={{ fontSize: "16px", fontWeight: 500 }}>Format Performance</h3>
            {formatPerformance.some((f) => f.avgScore > 0) ? (
              <div className="space-y-3.5">
                {formatPerformance.filter((f) => f.avgScore > 0 || f.pieces > 0).map((f) => (
                  <div key={f.format} className="flex items-center gap-3">
                    <span className="text-foreground w-24 flex-shrink-0" style={{ fontSize: "14px" }}>{f.format}</span>
                    <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(f.avgScore / 100) * 100}%` }} transition={{ delay: 0.4, duration: 0.6 }}
                        className="h-full bg-ora-signal rounded-full" />
                    </div>
                    <span className="text-ora-signal flex-shrink-0" style={{ fontSize: "13px", fontWeight: 600 }}>{f.avgScore || "--"}</span>
                    <span className="text-muted-foreground flex-shrink-0 w-16 text-right" style={{ fontSize: "12px" }}>{f.pieces} pieces</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No format data yet. Create campaigns with format targets.</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent campaigns table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-foreground mb-5" style={{ fontSize: "16px", fontWeight: 500 }}>Campaign Activity</h3>
          {campaignList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Campaign</th>
                    <th className="text-right py-2.5 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Score</th>
                    <th className="text-right py-2.5 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Pieces</th>
                    <th className="text-right py-2.5 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Status</th>
                    <th className="text-right py-2.5 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignList.slice(0, 10).map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                          <span className="text-foreground" style={{ fontSize: "14px" }}>{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-ora-signal" style={{ fontSize: "14px", fontWeight: 600 }}>{c.score > 0 ? `${c.score}/100` : "--"}</td>
                      <td className="py-3 text-right text-foreground" style={{ fontSize: "14px", fontWeight: 500 }}>{c.pieces || 0}</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-xs" style={{ fontSize: "10px", fontWeight: 600, background: "var(--secondary)", color: "var(--muted-foreground)" }}>{c.status}</span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground" style={{ fontSize: "12px" }}>{c.date || c.createdAt?.slice(0, 10) || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No campaign data yet.</p>
              <Link to="/studio/campaigns" className="inline-flex items-center gap-1 mt-2 text-ora-signal" style={{ fontSize: "13px", fontWeight: 500 }}>
                Create your first campaign <TrendingUp size={12} />
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}