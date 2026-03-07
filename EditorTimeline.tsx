import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Plus, Trash2, Lock, Unlock, Eye, EyeOff, ChevronDown,
  Diamond, Scissors, Copy, Magnet, ZoomIn, ZoomOut,
  Film, Type, Image, Music, Sparkles, Layers,
  GripVertical, MoreHorizontal, Maximize2,
} from "lucide-react";

/* ---- TYPES ---- */

export interface Keyframe {
  time: number; /* 0-100 percent */
  property: string;
  value: string;
}

export interface Segment {
  id: string;
  start: number; /* 0-100 */
  end: number;
  label?: string;
  keyframes?: Keyframe[];
  transition?: "cut" | "fade" | "dissolve" | "slide";
}

export interface Track {
  id: string;
  name: string;
  type: "video" | "image" | "text" | "audio" | "motion" | "effects";
  color: string;
  segments: Segment[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  expanded: boolean;
}

/* ---- MOCK DATA ---- */

const defaultTracks: Track[] = [
  {
    id: "t-video", name: "Visual", type: "video", color: "#3b4fc4",
    segments: [
      { id: "s1", start: 0, end: 40, label: "Hero — AI Analytics", transition: "fade" },
      { id: "s2", start: 40, end: 70, label: "Feature Demo", transition: "dissolve" },
      { id: "s3", start: 70, end: 100, label: "CTA + Logo" },
    ],
    muted: false, locked: false, visible: true, expanded: true,
  },
  {
    id: "t-text", name: "Text", type: "text", color: "#6b7ec9",
    segments: [
      { id: "s4", start: 5, end: 35, label: "Headline", keyframes: [{ time: 5, property: "opacity", value: "0" }, { time: 10, property: "opacity", value: "1" }] },
      { id: "s5", start: 42, end: 65, label: "Subtitle" },
      { id: "s6", start: 72, end: 95, label: "CTA Text", keyframes: [{ time: 72, property: "scale", value: "0.8" }, { time: 78, property: "scale", value: "1" }] },
    ],
    muted: false, locked: false, visible: true, expanded: false,
  },
  {
    id: "t-motion", name: "Motion", type: "motion", color: "#8b5cf6",
    segments: [
      { id: "s7", start: 0, end: 20, label: "Pulse In" },
      { id: "s8", start: 38, end: 45, label: "Transition" },
      { id: "s9", start: 68, end: 75, label: "Reveal" },
    ],
    muted: false, locked: false, visible: true, expanded: false,
  },
  {
    id: "t-audio", name: "Audio", type: "audio", color: "#10b981",
    segments: [
      { id: "s10", start: 0, end: 100, label: "Background — Minimal Ambient" },
    ],
    muted: false, locked: true, visible: true, expanded: false,
  },
  {
    id: "t-effects", name: "Effects", type: "effects", color: "#f59e0b",
    segments: [
      { id: "s11", start: 38, end: 42, label: "Cross Dissolve" },
      { id: "s12", start: 68, end: 72, label: "Fade Through" },
    ],
    muted: false, locked: false, visible: true, expanded: false,
  },
];

/* ---- ICONS ---- */

const trackIcons: Record<string, typeof Film> = {
  video: Film,
  image: Image,
  text: Type,
  audio: Music,
  motion: Sparkles,
  effects: Layers,
};

/* ---- TIMELINE COMPONENT ---- */

interface EditorTimelineProps {
  visible: boolean;
}

export function EditorTimeline({ visible }: EditorTimelineProps) {
  const [tracks, setTracks] = useState<Track[]>(defaultTracks);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(12);
  const [snap, setSnap] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [duration] = useState(15); /* seconds */
  const [speed, setSpeed] = useState(1);
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(false);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  const currentTime = (playhead / 100) * duration;
  const timeStr = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}.${String(Math.floor((t % 1) * 10))}`;

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPlayhead(Math.max(0, Math.min(100, pct)));
    setSelectedSegment(null);
  }, []);

  const toggleTrackProp = useCallback((trackId: string, prop: "muted" | "locked" | "visible" | "expanded") => {
    setTracks((prev) => prev.map((t) => t.id === trackId ? { ...t, [prop]: !t[prop] } : t));
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  if (!visible) return null;

  const trackHeight = 36;
  const visibleTracks = tracks.filter((t) => t.visible || true);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: expanded ? 44 + visibleTracks.length * trackHeight : 44, opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="border-t bg-card flex flex-col overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {/* ── TRANSPORT BAR ── */}
        <div className="flex items-center gap-2 px-3 h-[44px] min-h-[44px] border-b" style={{ borderColor: "var(--border)" }}>
          {/* Playback controls */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPlayhead(0)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Back to start">
              <SkipBack size={12} />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: playing ? "var(--destructive)" : "var(--ora-signal)", color: "#fff" }}
            >
              {playing ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 1 }} />}
            </button>
            <button onClick={() => setPlayhead(100)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Go to end">
              <SkipForward size={12} />
            </button>
          </div>

          {/* Timecode */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 min-w-[110px]">
            <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: "monospace", color: "var(--foreground)", letterSpacing: "0.02em" }}>
              {timeStr(currentTime)}
            </span>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>/</span>
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted-foreground)" }}>
              {timeStr(duration)}
            </span>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSpeed((s) => s === 1 ? 0.5 : s === 0.5 ? 2 : 1)}
              className="px-2 py-0.5 rounded border text-muted-foreground hover:text-foreground cursor-pointer"
              style={{ borderColor: "var(--border)", fontSize: "10px", fontWeight: 500 }}
            >
              {speed}x
            </button>
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Edit tools */}
          <div className="flex items-center gap-0.5">
            {[
              { icon: Scissors, label: "Split", shortcut: "S" },
              { icon: Copy, label: "Duplicate", shortcut: "D" },
              { icon: Diamond, label: "Add Keyframe", shortcut: "K" },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <Icon size={12} />
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Snap */}
          <button
            onClick={() => setSnap(!snap)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-colors ${snap ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground"}`}
            style={{ fontSize: "10px", fontWeight: 500 }}
            title="Snap to grid"
          >
            <Magnet size={10} />
            Snap
          </button>

          <div className="flex-1" />

          {/* Volume */}
          <button
            onClick={() => setMuted(!muted)}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>

          {/* Timeline zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setTimelineZoom((z) => Math.max(50, z - 25))} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <ZoomOut size={11} />
            </button>
            <div className="w-12 h-1 bg-secondary rounded-full relative">
              <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${((timelineZoom - 50) / 150) * 100}%`, background: "var(--ora-signal)" }} />
            </div>
            <button onClick={() => setTimelineZoom((z) => Math.min(200, z + 25))} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <ZoomIn size={11} />
            </button>
          </div>

          <div className="w-px h-4 bg-border" />

          {/* FPS + expand */}
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>30 fps</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Maximize2 size={11} />
          </button>
        </div>

        {/* ── TRACKS AREA ── */}
        {expanded && (
          <div className="flex flex-1 overflow-hidden">
            {/* Track labels */}
            <div className="w-[140px] min-w-[140px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--border)" }}>
              {tracks.map((track) => {
                const TypeIcon = trackIcons[track.type] || Film;
                return (
                  <div
                    key={track.id}
                    className="flex items-center gap-1 px-2 group border-b"
                    style={{ height: trackHeight, borderColor: "var(--border)" }}
                  >
                    <GripVertical size={8} className="text-muted-foreground/20 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0" style={{ background: track.color, opacity: 0.2 }}>
                      <TypeIcon size={8} style={{ color: track.color }} />
                    </div>
                    <span
                      className="flex-1 truncate"
                      style={{ fontSize: "10px", fontWeight: 500, color: track.muted ? "var(--muted-foreground)" : "var(--foreground)", opacity: track.muted ? 0.5 : 1 }}
                    >
                      {track.name}
                    </span>
                    <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleTrackProp(track.id, "muted")} className="w-4 h-4 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground cursor-pointer">
                        {track.muted ? <VolumeX size={8} /> : <Volume2 size={8} />}
                      </button>
                      <button onClick={() => toggleTrackProp(track.id, "locked")} className="w-4 h-4 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground cursor-pointer">
                        {track.locked ? <Lock size={8} /> : <Unlock size={8} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Add track */}
              <button
                className="w-full flex items-center justify-center gap-1 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer transition-colors"
                style={{ fontSize: "10px", fontWeight: 500 }}
              >
                <Plus size={10} />
                Add Track
              </button>
            </div>

            {/* Track segments area */}
            <div
              ref={trackAreaRef}
              className="flex-1 relative overflow-x-auto overflow-y-auto cursor-crosshair"
              onClick={handleTrackClick}
            >
              {/* Time ruler */}
              <div className="sticky top-0 left-0 right-0 h-4 bg-card z-10 border-b flex" style={{ borderColor: "var(--border)" }}>
                {Array.from({ length: duration + 1 }).map((_, i) => {
                  const pct = (i / duration) * 100;
                  return (
                    <div key={i} className="absolute" style={{ left: `${pct}%` }}>
                      <div className="w-px h-2 mt-2" style={{ background: i % 5 === 0 ? "var(--border-strong)" : "var(--border)" }} />
                      {i % 5 === 0 && (
                        <span className="absolute -translate-x-1/2 top-0" style={{ fontSize: "7px", color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                          {i}s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Segment rows */}
              <div className="relative" style={{ marginTop: 0 }}>
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="relative border-b"
                    style={{ height: trackHeight, borderColor: "var(--border)" }}
                  >
                    {/* Grid lines */}
                    {Array.from({ length: duration + 1 }).map((_, i) => {
                      const pct = (i / duration) * 100;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px"
                          style={{ left: `${pct}%`, background: i % 5 === 0 ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.02)" }}
                        />
                      );
                    })}

                    {/* Segments */}
                    {track.segments.map((seg) => {
                      const isSelected = selectedSegment === seg.id;
                      return (
                        <div
                          key={seg.id}
                          className={`absolute top-1 bottom-1 rounded-md cursor-pointer group/seg transition-all ${
                            isSelected ? "ring-1.5 ring-offset-1" : ""
                          } ${track.locked ? "opacity-60" : "hover:brightness-110"}`}
                          style={{
                            left: `${seg.start}%`,
                            width: `${seg.end - seg.start}%`,
                            background: `${track.color}20`,
                            borderLeft: `2px solid ${track.color}60`,
                            borderRight: `2px solid ${track.color}60`,
                            ringColor: isSelected ? track.color : undefined,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSegment(isSelected ? null : seg.id);
                          }}
                        >
                          {/* Segment fill bar */}
                          <div
                            className="absolute inset-y-0 left-0 right-0 rounded-md"
                            style={{ background: `${track.color}15` }}
                          />

                          {/* Segment label */}
                          <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                            <span
                              className="truncate"
                              style={{ fontSize: "9px", fontWeight: 500, color: track.color, opacity: 0.9 }}
                            >
                              {seg.label}
                            </span>
                          </div>

                          {/* Trim handles */}
                          {!track.locked && (
                            <>
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover/seg:opacity-100 transition-opacity rounded-l-md"
                                style={{ background: track.color, opacity: 0.4 }}
                              />
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover/seg:opacity-100 transition-opacity rounded-r-md"
                                style={{ background: track.color, opacity: 0.4 }}
                              />
                            </>
                          )}

                          {/* Keyframes */}
                          {seg.keyframes?.map((kf, ki) => {
                            const segWidth = seg.end - seg.start;
                            const kfPos = segWidth > 0 ? ((kf.time - seg.start) / segWidth) * 100 : 0;
                            return (
                              <div
                                key={ki}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                                style={{ left: `${kfPos}%` }}
                              >
                                <Diamond
                                  size={8}
                                  className="cursor-pointer"
                                  style={{ color: track.color, fill: track.color }}
                                />
                              </div>
                            );
                          })}

                          {/* Transition marker */}
                          {seg.transition && seg.transition !== "cut" && (
                            <div
                              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/seg:opacity-100 transition-opacity"
                              title={seg.transition}
                            >
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ background: "var(--card)", border: `1.5px solid ${track.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                              >
                                <span style={{ fontSize: "6px", fontWeight: 600, color: track.color }}>
                                  {seg.transition === "fade" ? "F" : seg.transition === "dissolve" ? "D" : "S"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute inset-0 rounded-md" style={{ border: `1.5px solid ${track.color}`, boxShadow: `0 0 0 2px ${track.color}25` }} />
                          )}
                        </div>
                      );
                    })}

                    {/* Audio waveform (decorative) */}
                    {track.type === "audio" && (
                      <div className="absolute inset-0 flex items-center px-1 pointer-events-none opacity-30">
                        {Array.from({ length: 80 }).map((_, i) => {
                          const h = 3 + Math.sin(i * 0.5) * 6 + Math.random() * 4;
                          return (
                            <div
                              key={i}
                              className="flex-1 mx-px rounded-sm"
                              style={{ height: h, background: track.color, minWidth: 1 }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `${playhead}%` }}
              >
                <div className="w-px h-full" style={{ background: "var(--destructive)" }} />
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2"
                  style={{ width: 10, height: 10 }}
                >
                  <svg viewBox="0 0 10 10" fill="var(--destructive)" className="w-full h-full">
                    <polygon points="0,0 10,0 5,8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
