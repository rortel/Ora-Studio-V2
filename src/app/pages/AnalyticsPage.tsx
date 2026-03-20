import { API_BASE, apiUrl, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { RouteGuard } from "../components/RouteGuard";
import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, RefreshCw,
  Send, Eye, MousePointer, MessageSquare, ExternalLink, CheckCircle2, Clock, AlertCircle,
  Heart, Share2, Bookmark, ThumbsUp,
} from "lucide-react";

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
  return (
    <RouteGuard requireAuth requireFeature="analytics">
      <AnalyticsPageContent />
    </RouteGuard>
  );
}

function AnalyticsPageContent() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(defaultKpis);
  const [weeklyData, setWeeklyData] = useState(defaultWeeklyData);
  const [formatPerformance, setFormatPerformance] = useState(defaultFormatPerformance);
  const [campaignList, setCampaignList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [socialData, setSocialData] = useState<any>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [postMetrics, setPostMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const { getAuthHeader } = useAuth();

  const loadAnalytics = useCallback(async () => {
    try {
      const token = getAuthHeader();
      const res = await fetch(apiUrl("/analytics"), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${publicAnonKey}`,
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ _token: token }),
      });
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

  const loadSocialAnalytics = useCallback(async () => {
    setSocialLoading(true);
    setMetricsLoading(true);
    try {
      const token = getAuthHeader();
      // Fetch deploy summary
      const res = await fetch(apiUrl("/analytics/social"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${publicAnonKey}`, "Content-Type": "text/plain" },
        body: JSON.stringify({ _token: token }),
      });
      const data = await res.json();
      if (data.success) setSocialData(data);

      // Fetch detailed post metrics from Zernio
      const metricsRes = await fetch(apiUrl("/analytics/all-posts-metrics"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${publicAnonKey}`, "Content-Type": "text/plain" },
        body: JSON.stringify({ _token: token }),
      });
      const metricsData = await metricsRes.json();
      if (metricsData.success) setPostMetrics(metricsData);
    } catch (err) {
      console.error("Failed to load social analytics:", err);
    } finally {
      setSocialLoading(false);
      setMetricsLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { loadAnalytics(); loadSocialAnalytics(); }, [loadAnalytics, loadSocialAnalytics]);

  const handleRefresh = () => { setRefreshing(true); loadAnalytics(); loadSocialAnalytics(); };

  const maxPieces = Math.max(...weeklyData.map((d) => d.pieces), 1);
  const maxFormatScore = Math.max(...formatPerformance.map((f) => f.avgScore), 1);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-ora-signal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/hub" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Hub
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

        {/* Social Deployment Analytics */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="bg-card border border-border rounded-xl p-6 mb-10">
          <h3 className="text-foreground mb-5" style={{ fontSize: "16px", fontWeight: 500 }}>Social Media Deployment</h3>
          {socialLoading || metricsLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-ora-signal" /></div>
          ) : socialData && (socialData.summary?.totalDeployed > 0 || socialData.summary?.totalScheduled > 0) ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 rounded-lg" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.12)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={12} style={{ color: "#16a34a" }} />
                    <span className="text-muted-foreground" style={{ fontSize: "11px" }}>Published</span>
                  </div>
                  <span className="text-foreground" style={{ fontSize: "22px", fontWeight: 500 }}>{socialData.summary.totalDeployed}</span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--ora-signal-light)", border: "1px solid rgba(59,79,196,0.12)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} className="text-ora-signal" />
                    <span className="text-muted-foreground" style={{ fontSize: "11px" }}>Scheduled</span>
                  </div>
                  <span className="text-foreground" style={{ fontSize: "22px", fontWeight: 500 }}>{socialData.summary.totalScheduled}</span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "rgba(212,24,61,0.04)", border: "1px solid rgba(212,24,61,0.1)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle size={12} className="text-destructive" />
                    <span className="text-muted-foreground" style={{ fontSize: "11px" }}>Failed</span>
                  </div>
                  <span className="text-foreground" style={{ fontSize: "22px", fontWeight: 500 }}>{socialData.summary.totalFailed}</span>
                </div>
              </div>

              {/* Per-platform breakdown */}
              {Object.keys(socialData.summary.platforms || {}).length > 0 && (
                <div className="mb-6">
                  <span className="text-muted-foreground uppercase tracking-wider block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>By Platform</span>
                  <div className="space-y-2.5">
                    {Object.entries(socialData.summary.platforms).map(([platform, data]: [string, any]) => (
                      <div key={platform} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                        <span className="text-foreground w-24 flex-shrink-0" style={{ fontSize: "13px", fontWeight: 500 }}>{platform}</span>
                        <div className="flex items-center gap-4 flex-1">
                          <span className="flex items-center gap-1" style={{ fontSize: "12px", color: "#16a34a" }}>
                            <Send size={10} /> {data.deployed}
                          </span>
                          <span className="flex items-center gap-1" style={{ fontSize: "12px", color: "var(--ora-signal)" }}>
                            <Clock size={10} /> {data.scheduled}
                          </span>
                          {data.impressions > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "12px" }}>
                              <Eye size={10} /> {data.impressions.toLocaleString()}
                            </span>
                          )}
                          {data.engagements > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "12px" }}>
                              <MessageSquare size={10} /> {data.engagements.toLocaleString()}
                            </span>
                          )}
                          {data.clicks > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "12px" }}>
                              <MousePointer size={10} /> {data.clicks.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent posts */}
              {socialData.posts?.length > 0 && (
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Recent Posts</span>
                  <div className="space-y-2">
                    {socialData.posts.slice(0, 8).map((post: any) => (
                      <div key={post.id} className="flex items-center justify-between py-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground" style={{ fontSize: "13px" }}>{post.platform}</span>
                          <span className="px-1.5 py-0.5 rounded" style={{
                            fontSize: "10px", fontWeight: 600,
                            background: post.status === "published" ? "rgba(22,163,74,0.08)" : post.status === "scheduled" ? "var(--ora-signal-light)" : "rgba(212,24,61,0.08)",
                            color: post.status === "published" ? "#16a34a" : post.status === "scheduled" ? "var(--ora-signal)" : "#d4183d",
                          }}>{post.status}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {post.metrics && (
                            <div className="flex items-center gap-2">
                              {post.metrics.impressions > 0 && <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{post.metrics.impressions} views</span>}
                              {post.metrics.engagements > 0 && <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{post.metrics.engagements} eng.</span>}
                            </div>
                          )}
                          <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{post.createdAt?.slice(0, 10)}</span>
                          {post.zernioPostUrl && (
                            <a href={post.zernioPostUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <Send size={22} className="mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No social deployments yet.</p>
              <p className="text-muted-foreground/60 mt-1" style={{ fontSize: "12px" }}>Deploy content from Campaign Lab or Calendar to see platform metrics.</p>
            </div>
          )}
        </motion.div>

        {/* Post-Level Performance Metrics from Zernio */}
        {postMetrics && postMetrics.posts?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="bg-card border border-border rounded-xl p-6 mb-10">
            <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 500 }}>Post Performance</h3>
            <p className="text-muted-foreground mb-5" style={{ fontSize: "13px" }}>Engagement metrics fetched from your connected social platforms via Zernio.</p>

            {/* Totals KPIs */}
            {postMetrics.totals && (postMetrics.totals.likes > 0 || postMetrics.totals.impressions > 0 || postMetrics.totals.comments > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                {[
                  { label: "Impressions", value: postMetrics.totals.impressions, icon: Eye },
                  { label: "Likes", value: postMetrics.totals.likes, icon: Heart },
                  { label: "Comments", value: postMetrics.totals.comments, icon: MessageSquare },
                  { label: "Shares", value: postMetrics.totals.shares, icon: Share2 },
                  { label: "Clicks", value: postMetrics.totals.clicks, icon: MousePointer },
                  { label: "Saves", value: postMetrics.totals.saves, icon: Bookmark },
                  { label: "Reach", value: postMetrics.totals.reach, icon: TrendingUp },
                ].filter(m => m.value > 0).map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={11} className="text-ora-signal" />
                        <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: 500 }}>{m.label}</span>
                      </div>
                      <span className="text-foreground" style={{ fontSize: "20px", fontWeight: 500 }}>{m.value.toLocaleString()}</span>
                    </div>
                  );
                })}
                {postMetrics.totals.engagementRate && (
                  <div className="p-3 rounded-lg border border-ora-signal/20" style={{ background: "var(--ora-signal-light)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ThumbsUp size={11} className="text-ora-signal" />
                      <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: 500 }}>Eng. Rate</span>
                    </div>
                    <span className="text-ora-signal" style={{ fontSize: "20px", fontWeight: 600 }}>{postMetrics.totals.engagementRate}</span>
                  </div>
                )}
              </div>
            )}

            {/* Per-platform metrics */}
            {postMetrics.byPlatform && Object.keys(postMetrics.byPlatform).length > 0 && (
              <div className="mb-6">
                <span className="text-muted-foreground uppercase tracking-wider block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Platform Breakdown</span>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}>Platform</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}>Posts</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}><Eye size={10} className="inline" /> Views</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}><Heart size={10} className="inline" /> Likes</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}><MessageSquare size={10} className="inline" /> Comments</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}><Share2 size={10} className="inline" /> Shares</th>
                        <th className="text-right py-2 text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500 }}><MousePointer size={10} className="inline" /> Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(postMetrics.byPlatform).map(([plat, data]: [string, any]) => (
                        <tr key={plat} className="border-b border-border/50">
                          <td className="py-2.5 text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>{plat}</td>
                          <td className="py-2.5 text-right text-foreground" style={{ fontSize: "13px" }}>{data.count}</td>
                          <td className="py-2.5 text-right text-muted-foreground" style={{ fontSize: "13px" }}>{data.impressions > 0 ? data.impressions.toLocaleString() : "--"}</td>
                          <td className="py-2.5 text-right text-muted-foreground" style={{ fontSize: "13px" }}>{data.likes > 0 ? data.likes.toLocaleString() : "--"}</td>
                          <td className="py-2.5 text-right text-muted-foreground" style={{ fontSize: "13px" }}>{data.comments > 0 ? data.comments.toLocaleString() : "--"}</td>
                          <td className="py-2.5 text-right text-muted-foreground" style={{ fontSize: "13px" }}>{data.shares > 0 ? data.shares.toLocaleString() : "--"}</td>
                          <td className="py-2.5 text-right text-muted-foreground" style={{ fontSize: "13px" }}>{data.clicks > 0 ? data.clicks.toLocaleString() : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Individual post metrics */}
            <div>
              <span className="text-muted-foreground uppercase tracking-wider block mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em" }}>Individual Posts</span>
              <div className="space-y-2">
                {postMetrics.posts.slice(0, 15).map((post: any, idx: number) => {
                  const m = post.metrics || {};
                  const hasMetrics = m.likes || m.comments || m.shares || m.impressions;
                  return (
                    <div key={post.deployId || idx} className="flex items-center justify-between py-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-foreground flex-shrink-0" style={{ fontSize: "12px", fontWeight: 500 }}>{post.platform}</span>
                        <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{
                          fontSize: "9px", fontWeight: 600,
                          background: post.status === "published" ? "rgba(22,163,74,0.08)" : "var(--ora-signal-light)",
                          color: post.status === "published" ? "#16a34a" : "var(--ora-signal)",
                        }}>{post.status}</span>
                        {post.content && (
                          <span className="text-muted-foreground truncate" style={{ fontSize: "11px" }}>{post.content}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {hasMetrics ? (
                          <>
                            {m.impressions > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><Eye size={9} /> {m.impressions.toLocaleString()}</span>}
                            {m.likes > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><Heart size={9} /> {m.likes}</span>}
                            {m.comments > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><MessageSquare size={9} /> {m.comments}</span>}
                            {m.shares > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><Share2 size={9} /> {m.shares}</span>}
                            {m.clicks > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><MousePointer size={9} /> {m.clicks}</span>}
                            {m.saves > 0 && <span className="flex items-center gap-0.5 text-muted-foreground" style={{ fontSize: "11px" }}><Bookmark size={9} /> {m.saves}</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground/50" style={{ fontSize: "10px" }}>
                            {post._hasAnalytics === false ? "No analytics available yet" : "Pending..."}
                          </span>
                        )}
                        <span className="text-muted-foreground" style={{ fontSize: "10px" }}>{(post.publishedAt || post.scheduledAt || "")?.slice(0, 10)}</span>
                        {post.zernioPostUrl && (
                          <a href={post.zernioPostUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink size={10} /></a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

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
              <Link to="/hub" className="inline-flex items-center gap-1 mt-2 text-ora-signal" style={{ fontSize: "13px", fontWeight: 500 }}>
                Create your first campaign <TrendingUp size={12} />
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}