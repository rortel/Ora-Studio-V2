import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { RouteGuard } from "../components/RouteGuard";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { toast } from "sonner";
import { downloadAsset } from "../lib/asset-persistence";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Clock,
  Check, FileText, Calendar, Linkedin, Mail,
  MessageSquare, Image, Loader2, Trash2, Video, Hash,
  Type, Eye, Play, Send, Download, AlertCircle, Rocket,
  ExternalLink, CheckCircle2,
} from "lucide-react";

type ContentStatus = "draft" | "scheduled" | "published" | "review" | "deploying" | "failed";

interface CalendarEvent {
  id: string;
  title: string;
  channel: string;
  channelIcon: string;
  time: string;
  status: ContentStatus;
  score: number;
  color: string;
  day: number;
  month: number;
  year: number;
  postingNote?: string;
  campaignTheme?: string;
  assetType?: string;
  copy?: string;
  caption?: string;
  hashtags?: string;
  headline?: string;
  imageUrl?: string;
  videoUrl?: string;
  zernioPostId?: string;
  zernioPostUrl?: string;
  deployedAt?: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "rgba(107,107,123,0.08)", text: "var(--muted-foreground)" },
  scheduled: { label: "Scheduled", bg: "var(--ora-signal-light)", text: "var(--ora-signal)" },
  published: { label: "Published", bg: "rgba(22,163,74,0.08)", text: "#16a34a" },
  review: { label: "In review", bg: "rgba(245,158,11,0.08)", text: "#f59e0b" },
  deploying: { label: "Deploying...", bg: "rgba(59,79,196,0.08)", text: "var(--ora-signal)" },
  failed: { label: "Failed", bg: "rgba(212,24,61,0.08)", text: "#d4183d" },
};

const channelIconMap: Record<string, typeof Linkedin> = {
  LinkedIn: Linkedin, Email: Mail, "Twitter/X": MessageSquare, Instagram: Image,
  Facebook: MessageSquare, TikTok: Video, YouTube: Play, Pinterest: Image,
};

const channelColors: Record<string, string> = {
  LinkedIn: "#0077b5", Email: "#ea4335", "Twitter/X": "#1da1f2", Instagram: "#e1306c",
  Facebook: "#1877F2", TikTok: "#00f2ea", YouTube: "#FF0000", Pinterest: "#E60023",
};

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function CalendarPage() {
  return (
    <RouteGuard requireAuth requireFeature="campaignLab">
      <CalendarPageContent />
    </RouteGuard>
  );
}

function CalendarPageContent() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannel, setNewChannel] = useState("LinkedIn");
  const [newTime, setNewTime] = useState("09:00");
  const [creating, setCreating] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [deployingEvent, setDeployingEvent] = useState<string | null>(null);
  const [deployingAll, setDeployingAll] = useState(false);

  const { getAuthHeader } = useAuth();

  const loadEvents = useCallback(async () => {
    try {
      const token = await getAuthHeader();
      const headers: Record<string, string> = { Authorization: `Bearer ${publicAnonKey}` };
      if (token) headers["X-User-Token"] = token;
      const res = await fetch(`${API_BASE}/calendar`, { headers });
      const data = await res.json();
      if (data.success && data.events && data.events.length > 0) {
        setEvents(data.events);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error("Failed to load calendar:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleCreate = async () => {
    if (!newTitle.trim() || selectedDay === null) return;
    setCreating(true);
    try {
      const token = await getAuthHeader();
      const headers: Record<string, string> = { "Content-Type": "text/plain", Authorization: `Bearer ${publicAnonKey}` };
      const eventData = {
        title: newTitle, channel: newChannel, channelIcon: newChannel, time: newTime,
        status: "draft" as ContentStatus, score: 0, color: channelColors[newChannel] || "#0077b5",
        day: selectedDay, month: currentMonth, year: currentYear,
        _token: token || undefined,
      };
      const res = await fetch(`${API_BASE}/calendar`, { method: "POST", headers, body: JSON.stringify(eventData) });
      const data = await res.json();
      if (data.success && data.event) setEvents((prev) => [...prev, data.event]);
      setNewTitle("");
      setShowNew(false);
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = await getAuthHeader();
      const headers: Record<string, string> = { Authorization: `Bearer ${publicAnonKey}` };
      if (token) headers["X-User-Token"] = token;
      await fetch(`${API_BASE}/calendar/${id}`, { method: "DELETE", headers });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (expandedEvent === id) setExpandedEvent(null);
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Deploy a single event
  const handleDeployEvent = async (eventId: string) => {
    setDeployingEvent(eventId);
    try {
      const token = await getAuthHeader();
      const res = await fetch(`${API_BASE}/calendar/deploy`, {
        method: "POST",
        headers: { "Content-Type": "text/plain", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ eventId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, _token: token }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: data.status as ContentStatus, zernioPostId: data.zernioPostId } : ev));
        toast.success(`${data.status === "scheduled" ? "Scheduled" : "Published"} successfully`);
      } else if (data.needsConnect) {
        toast.error(`Connect your ${data.platform} account first in Campaign Lab`);
      } else {
        toast.error(data.error || "Deploy failed");
      }
    } catch (err: any) {
      toast.error(`Deploy error: ${err?.message || "Network error"}`);
    } finally {
      setDeployingEvent(null);
    }
  };

  // Deploy all events with content
  const handleDeployAll = async () => {
    const deployableEvents = events.filter(ev =>
      (ev.status === "draft" || ev.status === "scheduled") &&
      (ev.copy || ev.caption || ev.headline || ev.imageUrl || ev.videoUrl)
    );
    if (deployableEvents.length === 0) {
      toast.error("No events with content to deploy");
      return;
    }
    setDeployingAll(true);
    try {
      const token = await getAuthHeader();
      const res = await fetch(`${API_BASE}/calendar/deploy-all`, {
        method: "POST",
        headers: { "Content-Type": "text/plain", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          eventIds: deployableEvents.map(ev => ev.id),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          _token: token,
        }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        // Update event statuses
        const resultMap = new Map(data.results.map((r: any) => [r.eventId, r]));
        setEvents(prev => prev.map(ev => {
          const result = resultMap.get(ev.id) as any;
          if (result) return { ...ev, status: result.success ? result.status as ContentStatus : "failed", zernioPostId: result.zernioPostId || ev.zernioPostId };
          return ev;
        }));
        const failed = data.results.filter((r: any) => !r.success).length;
        const needConnect = data.results.filter((r: any) => r.needsConnect).length;
        let msg = `${data.successCount}/${data.totalCount} events deployed`;
        if (failed > 0) msg += ` (${failed} failed)`;
        if (needConnect > 0) msg += ` -- ${needConnect} need social account connection`;
        toast.success(msg);
      } else {
        toast.error(data.error || "Batch deploy failed");
      }
    } catch (err: any) {
      toast.error(`Deploy error: ${err?.message || "Network error"}`);
    } finally {
      setDeployingAll(false);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDay(null);
    setExpandedEvent(null);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDay(null);
    setExpandedEvent(null);
  };

  const monthEvents = events.filter((e) => e.month === currentMonth && e.year === currentYear);
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  monthEvents.forEach((e) => { if (!eventsByDay[e.day]) eventsByDay[e.day] = []; eventsByDay[e.day].push(e); });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];
  const today = new Date().getDate();
  const isCurrentMonth = currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();

  const deployableCount = monthEvents.filter(ev =>
    (ev.status === "draft" || ev.status === "scheduled") &&
    (ev.copy || ev.caption || ev.headline || ev.imageUrl || ev.videoUrl)
  ).length;

  const stats = {
    total: monthEvents.length,
    scheduled: monthEvents.filter((e) => e.status === "scheduled").length,
    drafts: monthEvents.filter((e) => e.status === "draft").length,
    published: monthEvents.filter((e) => e.status === "published").length,
  };

  const hasContent = (ev: CalendarEvent) => !!(ev.copy || ev.caption || ev.imageUrl || ev.videoUrl || ev.headline);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/hub" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Hub
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-foreground" style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.03em" }}>Content Calendar</h1>
                {stats.total > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>{stats.total} pieces</span>
                )}
              </div>
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>Plan, schedule, and publish across all channels.</p>
            </div>
            <div className="flex items-center gap-3">
              {deployableCount > 0 && (
                <button
                  onClick={handleDeployAll}
                  disabled={deployingAll}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all cursor-pointer"
                  style={{
                    background: deployingAll ? "rgba(59,79,196,0.08)" : "var(--ora-signal)",
                    color: deployingAll ? "var(--ora-signal)" : "#fff",
                    fontSize: "14px", fontWeight: 500,
                    opacity: deployingAll ? 0.7 : 1,
                  }}
                >
                  {deployingAll ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                  {deployingAll ? "Deploying..." : `Deploy All (${deployableCount})`}
                </button>
              )}
              <button onClick={() => { if (selectedDay) setShowNew(true); }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                style={{ fontSize: "14px", fontWeight: 500 }}>
                <Plus size={15} /> New Content
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total this month", value: stats.total, icon: Calendar },
            { label: "Scheduled", value: stats.scheduled, icon: Clock },
            { label: "Drafts", value: stats.drafts, icon: FileText },
            { label: "Published", value: stats.published, icon: CheckCircle2 },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} className="text-muted-foreground" />
                  <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{stat.label}</span>
                </div>
                <span className="text-foreground" style={{ fontSize: "24px", fontWeight: 500, letterSpacing: "-0.02em" }}>{stat.value}</span>
              </motion.div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-ora-signal" /></div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            {/* Calendar grid */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-foreground" style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em" }}>{monthNames[currentMonth]} {currentYear}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer text-muted-foreground"><ChevronLeft size={16} /></button>
                  <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer text-muted-foreground"><ChevronRight size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0 mb-2">
                {daysOfWeek.map((d) => (
                  <div key={d} className="text-center py-2" style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0">
                {calendarDays.map((day, idx) => {
                  const dayEvents = day ? eventsByDay[day] || [] : [];
                  const isToday = isCurrentMonth && day === today;
                  const isSelected = day === selectedDay;
                  return (
                    <button key={idx} onClick={() => { if (day) { setSelectedDay(day); setExpandedEvent(null); } }} disabled={!day}
                      className={`relative min-h-[72px] p-1.5 border-t transition-colors cursor-pointer text-left ${isSelected ? "bg-ora-signal-light" : day ? "hover:bg-secondary/50" : ""}`}
                      style={{ borderColor: "var(--border)" }}>
                      {day && (
                        <>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-primary text-primary-foreground" : ""}`}
                            style={{ fontSize: "12px", fontWeight: isToday ? 600 : 400, color: isToday ? "#ffffff" : "var(--foreground)" }}>{day}</span>
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((e) => (
                              <div key={e.id} className="w-full rounded px-1 py-0.5 truncate" style={{ fontSize: "9px", fontWeight: 500, background: e.color + "12", color: e.color }}>
                                {e.status === "published" ? "* " : ""}{e.title.length > 16 ? e.title.slice(0, 16) + "..." : e.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>+{dayEvents.length - 3} more</span>}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {monthEvents.length === 0 && (
                <div className="text-center py-10 border-t border-border mt-2">
                  <Calendar size={28} className="mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-foreground mb-1" style={{ fontSize: "15px", fontWeight: 500 }}>No content planned this month</p>
                  <p className="text-muted-foreground mb-4" style={{ fontSize: "13px", lineHeight: 1.5 }}>
                    Generate a campaign in Campaign Lab and click<br />"Plan Editorial Calendar" to populate your schedule.
                  </p>
                  <Link to="/campaign-lab" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}>
                    Open Campaign Lab
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-card border border-border rounded-xl" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between p-4 pb-0">
                  <h3 className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>
                    {selectedDay ? `${monthNames[currentMonth]} ${selectedDay}` : "Select a day"}
                  </h3>
                  {selectedDay && (
                    <button onClick={() => setShowNew(true)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground cursor-pointer"><Plus size={14} /></button>
                  )}
                </div>

                <div className="p-4">
                  {/* New event form */}
                  <AnimatePresence>
                    {showNew && selectedDay && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                        <div className="border border-ora-signal/20 rounded-lg p-3 space-y-2 bg-ora-signal-light/20">
                          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Content title..."
                            className="w-full bg-card border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal outline-none" style={{ fontSize: "13px" }} />
                          <div className="flex gap-2">
                            <select value={newChannel} onChange={(e) => setNewChannel(e.target.value)}
                              className="bg-card border border-border rounded-md px-3 py-2 text-foreground" style={{ fontSize: "12px" }}>
                              {Object.keys(channelIconMap).map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                              className="bg-card border border-border rounded-md px-3 py-2 text-foreground" style={{ fontSize: "12px" }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-white cursor-pointer disabled:opacity-40"
                              style={{ background: "var(--ora-signal)", fontSize: "12px", fontWeight: 500 }}>
                              {creating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Add
                            </button>
                            <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-md border border-border text-muted-foreground cursor-pointer" style={{ fontSize: "12px" }}>Cancel</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Event list + post preview */}
                  {selectedEvents.length > 0 ? (
                    <div className="space-y-3">
                      {selectedEvents.map((event) => {
                        const Icon = channelIconMap[event.channel] || FileText;
                        const status = statusConfig[event.status] || statusConfig.draft;
                        const isExpanded = expandedEvent === event.id;
                        const contentAvailable = hasContent(event);
                        const isDeploying = deployingEvent === event.id;
                        const canDeploy = contentAvailable && event.status !== "published" && event.status !== "deploying";

                        return (
                          <motion.div key={event.id} layout
                            className="border border-border rounded-lg overflow-hidden hover:border-border-strong transition-colors group">
                            {/* Event header */}
                            <div className="p-3.5 cursor-pointer" onClick={() => setExpandedEvent(isExpanded ? null : event.id)}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: event.color + "14" }}>
                                    <Icon size={12} style={{ color: event.color }} />
                                  </div>
                                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{event.channel}</span>
                                  {contentAvailable && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ fontSize: "9px", fontWeight: 500, background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>
                                      <Eye size={8} /> Preview
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 500 }}>{event.title}</p>
                              {event.campaignTheme && (
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="px-1.5 py-0.5 rounded-full bg-ora-signal-light text-ora-signal" style={{ fontSize: "9px", fontWeight: 600 }}>Campaign</span>
                                  <span className="text-muted-foreground truncate" style={{ fontSize: "10px" }}>{event.campaignTheme}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded" style={{ fontSize: "10px", fontWeight: 600, color: status.text, background: status.bg }}>{status.label}</span>
                                  <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "11px" }}><Clock size={10} /> {event.time}</span>
                                </div>
                                {event.score > 0 && <span className="text-ora-signal" style={{ fontSize: "12px", fontWeight: 600 }}>{event.score}/100</span>}
                              </div>
                            </div>

                            {/* Expanded: post preview + actions */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div style={{ borderTop: "1px solid var(--border)" }}>
                                    {contentAvailable ? (
                                      <div className="p-3.5">
                                        <div className="flex items-center gap-1.5 mb-3">
                                          <Eye size={11} className="text-muted-foreground" />
                                          <span className="uppercase tracking-wider text-muted-foreground" style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em" }}>
                                            Post preview
                                          </span>
                                        </div>

                                        {/* Platform-styled preview card */}
                                        <div className="rounded-lg border border-border overflow-hidden" style={{ background: "var(--secondary)" }}>
                                          <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: event.color + "20" }}>
                                              <Icon size={12} style={{ color: event.color }} />
                                            </div>
                                            <div>
                                              <span className="block text-foreground" style={{ fontSize: "11px", fontWeight: 600, lineHeight: 1.2 }}>Your Brand</span>
                                              <span className="block text-muted-foreground" style={{ fontSize: "9px", lineHeight: 1.2 }}>{event.time} - {event.channel}</span>
                                            </div>
                                          </div>

                                          {event.headline && (
                                            <div className="px-3 pt-2.5">
                                              <p className="text-foreground" style={{ fontSize: "13px", fontWeight: 600, lineHeight: 1.3 }}>{event.headline}</p>
                                            </div>
                                          )}

                                          {event.imageUrl && (
                                            <div className="px-3 pt-2">
                                              <div className="rounded-md overflow-hidden border border-border relative group/img">
                                                <img src={event.imageUrl} alt={event.title} className="w-full h-40 object-cover" />
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); downloadAsset(event.imageUrl!, `ora-${event.channel}-${event.id}.png`, "image"); }}
                                                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                  <Download size={12} />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {event.videoUrl && !event.imageUrl && (
                                            <div className="px-3 pt-2">
                                              <div className="rounded-md overflow-hidden border border-border bg-foreground/5 h-40 flex items-center justify-center relative group/vid">
                                                <a href={event.videoUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5">
                                                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: event.color + "20" }}>
                                                    <Play size={16} style={{ color: event.color }} />
                                                  </div>
                                                  <span className="text-muted-foreground" style={{ fontSize: "10px" }}>Play video</span>
                                                </a>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); downloadAsset(event.videoUrl!, `ora-${event.channel}-${event.id}.mp4`, "video"); }}
                                                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover/vid:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                  <Download size={12} />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {(event.copy || event.caption) && (
                                            <div className="px-3 py-2.5">
                                              <p className="text-foreground whitespace-pre-line" style={{ fontSize: "12px", lineHeight: 1.55 }}>
                                                {(event.copy || event.caption || "").length > 400
                                                  ? (event.copy || event.caption || "").slice(0, 400) + "..."
                                                  : (event.copy || event.caption || "")}
                                              </p>
                                            </div>
                                          )}

                                          {event.copy && event.caption && (
                                            <div className="px-3 pb-2">
                                              <p className="text-muted-foreground italic" style={{ fontSize: "11px", lineHeight: 1.4 }}>{event.caption}</p>
                                            </div>
                                          )}

                                          {event.hashtags && (
                                            <div className="px-3 pb-2.5">
                                              <div className="flex items-start gap-1">
                                                <Hash size={10} className="text-ora-signal mt-0.5 flex-shrink-0" />
                                                <p className="text-ora-signal" style={{ fontSize: "11px", lineHeight: 1.4 }}>{event.hashtags}</p>
                                              </div>
                                            </div>
                                          )}

                                          {(event.assetType || event.postingNote) && (
                                            <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                                              <div className="flex items-center gap-2">
                                                {event.assetType && (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{
                                                    fontSize: "9px", fontWeight: 600,
                                                    background: event.assetType === "video" ? "rgba(239,68,68,0.08)" : event.assetType === "image" ? "rgba(168,85,247,0.08)" : "rgba(107,107,123,0.08)",
                                                    color: event.assetType === "video" ? "#ef4444" : event.assetType === "image" ? "#a855f7" : "var(--muted-foreground)",
                                                  }}>
                                                    {event.assetType === "video" ? <Video size={8} /> : event.assetType === "image" ? <Image size={8} /> : <Type size={8} />}
                                                    {event.assetType}
                                                  </span>
                                                )}
                                                {event.postingNote && (
                                                  <span className="text-muted-foreground truncate" style={{ fontSize: "9px" }}>{event.postingNote}</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 mt-3">
                                          {canDeploy && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDeployEvent(event.id); }}
                                              disabled={isDeploying}
                                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
                                              style={{
                                                background: isDeploying ? "rgba(59,79,196,0.08)" : "var(--ora-signal)",
                                                color: isDeploying ? "var(--ora-signal)" : "#fff",
                                                fontSize: "11px", fontWeight: 600,
                                                opacity: isDeploying ? 0.7 : 1,
                                              }}
                                            >
                                              {isDeploying ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                              {isDeploying ? "Deploying..." : "Deploy"}
                                            </button>
                                          )}
                                          {event.status === "published" && (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ fontSize: "11px", fontWeight: 600, background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>
                                              <CheckCircle2 size={11} /> Published
                                            </span>
                                          )}
                                          {event.zernioPostUrl && (
                                            <a href={event.zernioPostUrl} target="_blank" rel="noopener noreferrer"
                                              className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                              style={{ fontSize: "11px", border: "1px solid var(--border)" }}>
                                              <ExternalLink size={10} /> View post
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-5 px-3.5">
                                        <FileText size={16} className="mx-auto mb-2 text-muted-foreground/30" />
                                        <p className="text-muted-foreground" style={{ fontSize: "11px" }}>No content generated yet for this post.</p>
                                        <p className="text-muted-foreground/60 mt-0.5" style={{ fontSize: "10px" }}>Generate assets in Campaign Lab to see a preview.</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : selectedDay ? (
                    <div className="text-center py-8">
                      <Calendar size={24} className="mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground" style={{ fontSize: "13px" }}>Nothing scheduled for this day.</p>
                      <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 mt-3 text-ora-signal hover:opacity-80 transition-opacity cursor-pointer" style={{ fontSize: "13px", fontWeight: 500 }}>
                        <Plus size={13} /> Create content
                      </button>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
