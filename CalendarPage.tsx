import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Clock, Send,
  Check, FileText, MoreHorizontal, Calendar, Linkedin, Mail,
  MessageSquare, Image, X, Loader2, Trash2,
} from "lucide-react";

type ContentStatus = "draft" | "scheduled" | "published" | "review";

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
}

const statusConfig: Record<ContentStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "rgba(107,107,123,0.08)", text: "var(--muted-foreground)" },
  scheduled: { label: "Scheduled", bg: "var(--ora-signal-light)", text: "var(--ora-signal)" },
  published: { label: "Published", bg: "rgba(22,163,74,0.08)", text: "#16a34a" },
  review: { label: "In review", bg: "rgba(245,158,11,0.08)", text: "#f59e0b" },
};

const channelIconMap: Record<string, typeof Linkedin> = {
  LinkedIn: Linkedin, Email: Mail, "Twitter/X": MessageSquare, Instagram: Image,
};

const channelColors: Record<string, string> = {
  LinkedIn: "#0077b5", Email: "#ea4335", "Twitter/X": "#1da1f2", Instagram: "#e1306c",
};

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const defaultEvents: CalendarEvent[] = [
  { id: "d1", title: "Q2 Kickoff Announcement", channel: "LinkedIn", channelIcon: "LinkedIn", time: "09:00", status: "published", score: 96, color: "#0077b5", day: 2, month: 2, year: 2026 },
  { id: "d2", title: "Product Update Newsletter", channel: "Email", channelIcon: "Email", time: "10:00", status: "scheduled", score: 94, color: "#ea4335", day: 3, month: 2, year: 2026 },
  { id: "d3", title: "Behind the scenes Story", channel: "Instagram", channelIcon: "Instagram", time: "14:00", status: "scheduled", score: 91, color: "#e1306c", day: 3, month: 2, year: 2026 },
  { id: "d4", title: "AI Industry Insights Post", channel: "LinkedIn", channelIcon: "LinkedIn", time: "08:30", status: "draft", score: 88, color: "#0077b5", day: 4, month: 2, year: 2026 },
  { id: "d5", title: "Weekly Tips Thread", channel: "Twitter/X", channelIcon: "Twitter/X", time: "12:00", status: "review", score: 92, color: "#1da1f2", day: 4, month: 2, year: 2026 },
  { id: "d6", title: "Webinar Invitation", channel: "Email", channelIcon: "Email", time: "08:00", status: "scheduled", score: 97, color: "#ea4335", day: 11, month: 2, year: 2026 },
];

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(2);
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(5);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannel, setNewChannel] = useState("LinkedIn");
  const [newTime, setNewTime] = useState("09:00");
  const [creating, setCreating] = useState(false);

  const { getAuthHeader } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthHeader();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${publicAnonKey}`,
        };
        if (token) headers["X-User-Token"] = token;
        
        const res = await fetch(`${API_BASE}/calendar`, { headers });
        const data = await res.json();
        if (data.success && data.events && data.events.length > 0) {
          setEvents(data.events);
        } else {
          setEvents(defaultEvents);
        }
      } catch (err) {
        console.error("Failed to load calendar:", err);
        setEvents(defaultEvents);
      } finally {
        setLoading(false);
      }
    })();
  }, [getAuthHeader]);

  const handleCreate = async () => {
    if (!newTitle.trim() || selectedDay === null) return;
    setCreating(true);
    try {
      const token = await getAuthHeader();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;
      
      const eventData = {
        title: newTitle,
        channel: newChannel,
        channelIcon: newChannel,
        time: newTime,
        status: "draft" as ContentStatus,
        score: 0,
        color: channelColors[newChannel] || "#0077b5",
        day: selectedDay,
        month: currentMonth,
        year: currentYear,
      };
      const res = await fetch(`${API_BASE}/calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify(eventData),
      });
      const data = await res.json();
      if (data.success && data.event) {
        setEvents((prev) => [...prev, data.event]);
      }
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
      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;
      
      await fetch(`${API_BASE}/calendar/${id}`, { method: "DELETE", headers });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDay(null);
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

  const stats = {
    total: monthEvents.length,
    scheduled: monthEvents.filter((e) => e.status === "scheduled").length,
    drafts: monthEvents.filter((e) => e.status === "draft").length,
    published: monthEvents.filter((e) => e.status === "published").length,
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          <Link to="/studio" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4" style={{ fontSize: "13px" }}>
            <ArrowLeft size={14} /> Back to Studio
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-foreground" style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.03em" }}>Content Calendar</h1>
                <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}>{stats.total} pieces</span>
              </div>
              <p className="text-muted-foreground" style={{ fontSize: "15px" }}>Plan, schedule, and publish across all channels.</p>
            </div>
            <button onClick={() => { if (selectedDay) setShowNew(true); }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 500 }}>
              <Plus size={15} /> New Content
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total this month", value: stats.total, icon: Calendar },
            { label: "Scheduled", value: stats.scheduled, icon: Clock },
            { label: "Drafts", value: stats.drafts, icon: FileText },
            { label: "Published", value: stats.published, icon: Check },
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
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-foreground" style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.02em" }}>{months[currentMonth]} {currentYear}</h2>
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
                    <button key={idx} onClick={() => day && setSelectedDay(day)} disabled={!day}
                      className={`relative min-h-[72px] p-1.5 border-t transition-colors cursor-pointer text-left ${isSelected ? "bg-ora-signal-light" : day ? "hover:bg-secondary/50" : ""}`}
                      style={{ borderColor: "var(--border)" }}>
                      {day && (
                        <>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-ora-signal text-white" : ""}`}
                            style={{ fontSize: "12px", fontWeight: isToday ? 600 : 400, color: isToday ? "#ffffff" : "var(--foreground)" }}>{day}</span>
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((e) => (
                              <div key={e.id} className="w-full rounded px-1 py-0.5 truncate" style={{ fontSize: "9px", fontWeight: 500, background: e.color + "12", color: e.color }}>
                                {e.title.length > 16 ? e.title.slice(0, 16) + "..." : e.title}
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
            </motion.div>

            {/* Right sidebar */}
            <div className="space-y-5">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-foreground" style={{ fontSize: "15px", fontWeight: 500 }}>
                    {selectedDay ? `${months[currentMonth]} ${selectedDay}` : "Select a day"}
                  </h3>
                  {selectedDay && (
                    <button onClick={() => setShowNew(true)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground cursor-pointer"><Plus size={14} /></button>
                  )}
                </div>

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

                {selectedEvents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedEvents.map((event) => {
                      const Icon = channelIconMap[event.channel] || FileText;
                      const status = statusConfig[event.status];
                      return (
                        <div key={event.id} className="border border-border rounded-lg p-3.5 hover:border-border-strong transition-colors group">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: event.color + "14" }}>
                                <Icon size={12} style={{ color: event.color }} />
                              </div>
                              <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{event.channel}</span>
                            </div>
                            <button onClick={() => handleDelete(event.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p className="text-foreground mb-2" style={{ fontSize: "13px", fontWeight: 500 }}>{event.title}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded" style={{ fontSize: "10px", fontWeight: 600, color: status.text, background: status.bg }}>{status.label}</span>
                              <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "11px" }}><Clock size={10} /> {event.time}</span>
                            </div>
                            {event.score > 0 && <span className="text-ora-signal" style={{ fontSize: "12px", fontWeight: 600 }}>{event.score}/100</span>}
                          </div>
                        </div>
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
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}